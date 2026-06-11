import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAIContextStore } from "@/store/useAIContextStore";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { Bot, X, Send, Loader2, Sparkles, Eye, MessageSquarePlus, Zap, Gauge, Brain, CalendarPlus, Check, AlertTriangle } from "lucide-react";

interface ModelPresets { rapido?: string; medio?: string; inteligente?: string }
interface AiKey { id: string; provider: string; label: string | null; model: string | null; models: string[] | null; model_presets: ModelPresets | null; }
type ActionState = "pending" | "running" | "done" | "cancelled" | "error";
interface PendingAction { tipo: string; dados: Record<string, any>; }
interface ChatMsg { role: "user" | "assistant"; content: string; action?: PendingAction; actionState?: ActionState; actionResult?: string; }

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI", anthropic: "Claude", google: "Gemini", groq: "Groq", openrouter: "OpenRouter", custom: "Custom",
};

const POS_KEY = "jg_ai_chat_pos";
const KEY_KEY = "jg_ai_chat_keyid";

// ── parsing de ações vindas da IA ──────────────────────────────────────────
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// extrai um objeto JSON balanceado que contenha "tipo" (mesmo cercado por ```)
function findJsonWithTipo(text: string): string | null {
  const idx = text.indexOf('"tipo"');
  if (idx < 0) return null;
  const start = text.lastIndexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function extractAction(text: string): { clean: string; action: PendingAction | null } {
  const raw = findJsonWithTipo(text);
  if (!raw) return { clean: text, action: null };
  let action: PendingAction | null = null;
  try { action = JSON.parse(raw); } catch { return { clean: text, action: null }; }
  if (!action || typeof action.tipo !== "string") return { clean: text, action: null };
  let clean = text.replace(raw, "");
  clean = clean.replace(/```(?:jg-action|json)?/gi, "").trim();
  return { clean, action };
}

function resolveClient(clients: { id: string; name: string }[], name: string) {
  const q = norm(name);
  if (!q) return null;
  return clients.find((c) => norm(c.name) === q)
    || clients.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name)))
    || null;
}

function fmtDateBR(iso?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// data/hora atual no fuso de Brasília (resolvida no cliente)
function nowBrasilia() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday, time: `${parts.hour}:${parts.minute}` };
}

// system prompt com as capacidades de ação. Enviado no campo `system` da edge function,
// então não exige redeploy: a IA aprende a emitir o bloco ```jg-action```.
function buildSystemPrompt(): string {
  const n = nowBrasilia();
  return `Você é o assistente do sistema interno da JG (agência de marketing). Responda em português do Brasil, de forma objetiva e útil.

## Ações que você pode executar no sistema
Você NÃO apenas responde: você pode preparar ações reais. Quando o usuário pedir CLARAMENTE para criar/agendar/marcar uma gravação, escreva uma frase curta confirmando o que entendeu e, no FINAL da resposta, inclua EXATAMENTE um bloco de ação cercado por três crases com a tag jg-action:

\`\`\`jg-action
{"tipo":"criar_gravacao","dados":{"titulo":"","cliente_nome":"","data":"YYYY-MM-DD","inicio":"HH:MM","fim":"HH:MM","local":"","descricao":"","responsavel":""}}
\`\`\`

Regras:
- Hoje é ${n.weekday}, ${n.date}, ${n.time} (horário de Brasília). Use isso para resolver "hoje", "amanhã", "depois de amanhã", "semana que vem", etc.
- "data" sempre no formato YYYY-MM-DD. "inicio"/"fim" no formato HH:MM (24h). Se o usuário não informar o horário de fim, use 1 hora após o início.
- "cliente_nome": o nome do cliente exatamente como o usuário falou (o sistema resolve o ID sozinho). Se o usuário não citar cliente, deixe "".
- Deixe vazio ("") qualquer campo que o usuário não tenha informado — NUNCA invente dados.
- Só inclua o bloco quando for um pedido de CRIAÇÃO. Para perguntas, consultas ou resumos, responda normalmente, SEM bloco.
- Não descreva o JSON em texto nem repita os campos fora do bloco; o card de confirmação já mostra tudo ao usuário.`;
}

export default function FloatingAIChat() {
  const location = useLocation();
  const ctxLabel = useAIContextStore((s) => s.label);
  const ctxData = useAIContextStore((s) => s.data);
  const clients = useAppStore((s) => s.clients);
  const team = useAppStore((s) => s.team);
  const currentUserName = useAuthStore((s) => s.currentUser?.name) || "";

  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<AiKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(() => localStorage.getItem(KEY_KEY) || "");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // posição do botão flutuante (arrastável)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || ""); }
    catch { return { x: window.innerWidth - 80, y: window.innerHeight - 90 }; }
  });
  const dragRef = useRef<{ dragging: boolean; moved: boolean; offX: number; offY: number }>({ dragging: false, moved: false, offX: 0, offY: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  // carrega os tokens ativos (com seus modelos)
  useEffect(() => {
    supabase.from("sm_ai_api_keys").select("id, provider, label, model, models, model_presets").eq("is_active", true).order("created_at")
      .then(({ data }) => setKeys((data as AiKey[]) || []));
  }, [open]);

  // opções achatadas: cada par (token × modelo) vira uma opção do seletor
  const options = useMemo(() => {
    const opts: { value: string; keyId: string; model: string; label: string }[] = [];
    for (const k of keys) {
      const prov = PROVIDER_LABEL[k.provider] || k.provider;
      const presetModels = Object.values(k.model_presets || {}).filter(Boolean) as string[];
      const base = (k.models && k.models.length) ? k.models : (k.model ? [k.model] : []);
      const ms = [...new Set([...base, ...presetModels])];
      if (ms.length === 0) ms.push("");
      for (const m of ms) {
        opts.push({ value: `${k.id}::${m}`, keyId: k.id, model: m, label: `${prov}${m ? ` · ${m}` : " · (padrão)"}${k.label ? ` (${k.label})` : ""}` });
      }
    }
    return opts;
  }, [keys]);

  // token/modelo ativos e botões de modo (presets) do token selecionado
  const sepIdx = selectedKey.indexOf("::");
  const activeKeyId = sepIdx >= 0 ? selectedKey.slice(0, sepIdx) : selectedKey;
  const activeModel = sepIdx >= 0 ? selectedKey.slice(sepIdx + 2) : "";
  const activePresets = keys.find((k) => k.id === activeKeyId)?.model_presets || {};
  const tierButtons = ([["rapido", "Rápido", Zap], ["medio", "Médio", Gauge], ["inteligente", "Inteligente", Brain]] as const)
    .map(([key, label, Icon]) => ({ key, label, Icon, model: activePresets[key] }))
    .filter((t): t is { key: string; label: string; Icon: typeof Zap; model: string } => !!t.model);

  // garante que a seleção atual seja válida
  useEffect(() => {
    setSelectedKey((cur) => (cur && options.some((o) => o.value === cur)) ? cur : (options[0]?.value || ""));
  }, [options]);

  useEffect(() => { if (selectedKey) localStorage.setItem(KEY_KEY, selectedKey); }, [selectedKey]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  // ── drag do botão ──
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, moved: false, offX: e.clientX - pos.x, offY: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const nx = e.clientX - dragRef.current.offX;
    const ny = e.clientY - dragRef.current.offY;
    if (Math.abs(e.clientX - (dragRef.current.offX + pos.x)) > 4 || Math.abs(e.clientY - (dragRef.current.offY + pos.y)) > 4) dragRef.current.moved = true;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - 64, nx)),
      y: Math.max(8, Math.min(window.innerHeight - 64, ny)),
    });
  };
  const onPointerUp = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
    if (!dragRef.current.moved) setOpen((v) => !v); // clique (sem arrastar) abre/fecha
  };

  const buildContext = useCallback(() => {
    const mainEl = document.querySelector("main") as HTMLElement | null;
    const visibleText = (mainEl?.innerText || "").replace(/\s+\n/g, "\n").slice(0, 5000);
    return {
      rota: location.pathname,
      tela: ctxLabel || document.title,
      dados_estruturados: ctxData ?? null,
      texto_visivel: visibleText,
    };
  }, [location.pathname, ctxLabel, ctxData]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!selectedKey) { toast.error("Cadastre um token de IA em Integração IA & Webhooks"); return; }
    const newMsgs = [...messages, { role: "user" as const, content: text }];
    setMessages(newMsgs);
    setInput("");
    setSending(true);
    try {
      const sep = selectedKey.indexOf("::");
      const keyId = sep >= 0 ? selectedKey.slice(0, sep) : selectedKey;
      const model = sep >= 0 ? selectedKey.slice(sep + 2) : "";
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { key_id: keyId, model: model || undefined, messages: newMsgs, system: buildSystemPrompt(), context: buildContext() },
      });
      if (error) {
        // extrai o motivo real do corpo da resposta (modelo inexistente, token inválido, etc.)
        let detail = error.message || "erro";
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const b = await ctx.json();
            detail = b?.detail || b?.error || detail;
          }
        } catch { /* ignore */ }
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${detail}` }]);
        return;
      }
      const r = data as { ok?: boolean; reply?: string; error?: string; detail?: string };
      if (r.ok && r.reply) {
        const { clean, action } = extractAction(r.reply);
        setMessages((m) => [...m, {
          role: "assistant",
          content: clean || (action ? "Revise e confirme a ação abaixo:" : r.reply!),
          action: action || undefined,
          actionState: action ? "pending" : undefined,
        }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${r.error || "erro"}${r.detail ? ": " + r.detail : ""}` }]);
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ Falha: ${e?.message || e}` }]);
    } finally { setSending(false); }
  };

  // executa a ação "criar_gravacao": resolve cliente/responsável e insere em recordings
  const executeCriarGravacao = async (d: Record<string, any>): Promise<{ ok: boolean; msg: string }> => {
    if (!d.data || !/^\d{4}-\d{2}-\d{2}$/.test(d.data)) return { ok: false, msg: "Data inválida ou ausente." };
    const client = resolveClient(clients, d.cliente_nome || "");
    const member = (d.responsavel ? team.find((t) => norm(t.name) === norm(d.responsavel) || norm(t.name).includes(norm(d.responsavel))) : null) || null;
    const payload = {
      title: d.titulo || "Gravação",
      description: d.descricao || "",
      date: d.data,
      start_time: d.inicio || "09:00",
      end_time: d.fim || null,
      location: d.local || "",
      responsible_name: member?.name || null,
      participants: [] as string[],
      status: "agendado",
      color: "#FBBF24",
      notes: "",
      roteiro: "",
      roteiro_sent: false,
      client_id: client?.id || null,
      client_name: client?.name || (d.cliente_nome || null),
      created_by: currentUserName || "IA",
    };
    const { data: rec, error } = await supabase.from("recordings").insert(payload).select().single();
    if (error) return { ok: false, msg: error.message };
    // sync best-effort com o Google Calendar (não bloqueia)
    try { await supabase.functions.invoke("google-calendar-push", { body: { action: "upsert", recording_id: (rec as { id: string }).id } }); } catch { /* ignore */ }
    return { ok: true, msg: `Gravação "${payload.title}" agendada para ${fmtDateBR(payload.date)} às ${payload.start_time}.` };
  };

  const confirmAction = async (i: number) => {
    const msg = messages[i];
    if (!msg?.action) return;
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionState: "running" } : x)));
    let res: { ok: boolean; msg: string };
    try {
      if (msg.action.tipo === "criar_gravacao") res = await executeCriarGravacao(msg.action.dados || {});
      else res = { ok: false, msg: `Ação não suportada: ${msg.action.tipo}` };
    } catch (e: any) {
      res = { ok: false, msg: e?.message || "Falha ao executar." };
    }
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionState: res.ok ? "done" : "error", actionResult: res.msg } : x)));
    if (res.ok) toast.success(res.msg); else toast.error(res.msg);
  };

  const cancelAction = (i: number) => setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionState: "cancelled" } : x)));

  const newChat = () => { setMessages([]); setInput(""); };


  return (
    <>
      {/* Botão flutuante */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ left: pos.x, top: pos.y }}
        className="fixed z-[60] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform cursor-grab active:cursor-grabbing touch-none"
        title="Assistente IA (arraste para mover)"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {/* Painel do chat */}
      {open && (
        <div
          style={{
            left: Math.min(pos.x, window.innerWidth - 392),
            top: Math.max(8, Math.min(pos.y - 470, window.innerHeight - 540)),
          }}
          className="fixed z-[59] w-[380px] h-[520px] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden"
        >
          {/* header */}
          <div className="px-3 py-2.5 border-b bg-muted/40 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary/15 text-primary flex items-center justify-center"><Bot className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Assistente IA</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                <Eye className="w-2.5 h-2.5 shrink-0" /> vendo: {ctxLabel || location.pathname}
              </p>
            </div>
            <button onClick={newChat} disabled={messages.length === 0 && !input.trim()}
              className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40" title="Novo chat (limpar conversa)">
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Fechar"><X className="w-4 h-4" /></button>
          </div>

          {/* seletor de modelo */}
          <div className="px-3 py-2 border-b space-y-2">
            {options.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nenhum token de IA cadastrado. Vá em <span className="font-medium">Integração IA &amp; Webhooks</span>.</p>
            ) : (
              <>
                {tierButtons.length > 0 && (
                  <div className="flex gap-1">
                    {tierButtons.map((t) => {
                      const active = activeModel === t.model;
                      return (
                        <button key={t.key} onClick={() => setSelectedKey(`${activeKeyId}::${t.model}`)} title={t.model}
                          className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                          <t.Icon className="w-3 h-3" /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md border bg-background text-foreground">
                  {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground mt-8 space-y-2">
                <Sparkles className="w-7 h-7 mx-auto opacity-50" />
                <p>Pergunte sobre a tela — ou peça uma ação.</p>
                <p className="text-[10px]">Ex: "resuma os posts atrasados" · "agende uma gravação amanhã 20h do cliente Anil Piscinas"</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                {m.content && (
                  <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {m.content}
                    </div>
                  </div>
                )}
                {m.action && (
                  <ActionCard
                    action={m.action}
                    state={m.actionState || "pending"}
                    result={m.actionResult}
                    clients={clients}
                    onConfirm={() => confirmAction(i)}
                    onCancel={() => cancelAction(i)}
                  />
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-lg bg-muted text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /></div>
              </div>
            )}
          </div>

          {/* input */}
          <div className="p-2.5 border-t flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Pergunte sobre esta tela..."
              rows={1}
              className="flex-1 resize-none max-h-24 text-xs px-3 py-2 rounded-md border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={send} disabled={sending || !input.trim() || !selectedKey}
              className="h-9 w-9 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Card de confirmação de ação (criar gravação) ────────────────────────────
function ActionCard({
  action, state, result, clients, onConfirm, onCancel,
}: {
  action: PendingAction;
  state: ActionState;
  result?: string;
  clients: { id: string; name: string }[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const d = action.dados || {};
  const titleByType: Record<string, string> = { criar_gravacao: "Agendar gravação" };
  const cardTitle = titleByType[action.tipo] || action.tipo;
  const matched = action.tipo === "criar_gravacao" ? resolveClient(clients, d.cliente_nome || "") : null;
  const clientLabel = matched?.name || (d.cliente_nome ? `${d.cliente_nome} (não cadastrado)` : "—");
  const clientUnresolved = !!d.cliente_nome && !matched;

  const Row = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div className="flex gap-2">
        <span className="text-muted-foreground w-16 shrink-0">{label}</span>
        <span className="text-foreground font-medium break-words">{value}</span>
      </div>
    ) : null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-[11px] space-y-1.5">
      <div className="flex items-center gap-1.5 font-semibold text-foreground">
        <CalendarPlus className="w-3.5 h-3.5 text-primary" /> {cardTitle}
      </div>
      <div className="space-y-1">
        <Row label="Título" value={d.titulo || "Gravação"} />
        <Row label="Cliente" value={clientLabel} />
        <Row label="Data" value={fmtDateBR(d.data)} />
        <Row label="Horário" value={d.inicio ? `${d.inicio}${d.fim ? ` – ${d.fim}` : ""}` : undefined} />
        <Row label="Local" value={d.local} />
        <Row label="Resp." value={d.responsavel} />
      </div>
      {clientUnresolved && state === "pending" && (
        <p className="flex items-start gap-1 text-amber-600">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Cliente não encontrado no cadastro — será salvo só pelo nome.
        </p>
      )}
      {state === "done" && (
        <p className="flex items-start gap-1 text-green-600"><Check className="w-3 h-3 mt-0.5 shrink-0" /> {result}</p>
      )}
      {state === "error" && (
        <p className="flex items-start gap-1 text-destructive"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {result}</p>
      )}
      {state === "cancelled" && <p className="text-muted-foreground">Ação cancelada.</p>}
      {state === "running" && (
        <p className="flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Agendando…</p>
      )}
      {(state === "pending" || state === "error") && (
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={onCancel}
            className="flex-1 h-7 rounded-md border text-[11px] font-medium text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 h-7 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90">
            {state === "error" ? "Tentar de novo" : "Confirmar e agendar"}
          </button>
        </div>
      )}
    </div>
  );
}
