import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAIContextStore } from "@/store/useAIContextStore";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { Bot, X, Send, Loader2, Sparkles, Eye, MessageSquarePlus, Zap, Gauge, Brain, Check, AlertTriangle } from "lucide-react";
import {
  buildActionsSystemPrompt, extractAction, executeAction, previewAction, getActionDef,
  type PendingAction, type ActionState, type ActionContext,
} from "@/lib/aiActions";

interface ModelPresets { rapido?: string; medio?: string; inteligente?: string }
interface AiKey { id: string; provider: string; label: string | null; model: string | null; models: string[] | null; model_presets: ModelPresets | null; }
interface ChatMsg { role: "user" | "assistant"; content: string; action?: PendingAction; actionState?: ActionState; actionResult?: string; }
type Tier = "rapido" | "medio" | "inteligente";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI", anthropic: "Claude", google: "Gemini", groq: "Groq", openrouter: "OpenRouter", custom: "Custom",
};

// 3 níveis de modelo: Baixo / Médio / Alto (mapeiam para os presets do token)
const TIERS = [
  { key: "rapido" as Tier, label: "Baixo", Icon: Zap },
  { key: "medio" as Tier, label: "Médio", Icon: Gauge },
  { key: "inteligente" as Tier, label: "Alto", Icon: Brain },
];

// resolve o modelo concreto a partir do nível escolhido (com fallbacks)
function resolveTierModel(token: AiKey | undefined, tier: Tier): string {
  if (!token) return "";
  const presets = (token.model_presets || {}) as Record<string, string | undefined>;
  return presets[tier] || token.model || (token.models && token.models[0]) || "";
}

const POS_KEY = "jg_ai_chat_pos";
const KEY_KEY = "jg_ai_chat_keyid";
const TIER_KEY = "jg_ai_chat_tier";

// Garante um token do Supabase Auth válido antes de chamar a edge function.
// Renova a sessão se estiver expirada/perto de expirar (evita o erro "unauthorized").
async function ensureFreshSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const expMs = (session.expires_at ?? 0) * 1000;
  if (expMs && expMs < Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return false;
  }
  return true;
}

export default function FloatingAIChat() {
  const location = useLocation();
  const ctxLabel = useAIContextStore((s) => s.label);
  const ctxData = useAIContextStore((s) => s.data);
  const clients = useAppStore((s) => s.clients);
  const team = useAppStore((s) => s.team);
  const currentUserName = useAuthStore((s) => s.currentUser?.name) || "";
  const currentUserId = useAuthStore((s) => s.currentUser?.id) || "";
  const currentUserAuthId = useAuthStore((s) => s.currentUser?.authId) || null;

  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<AiKey[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string>(() => localStorage.getItem(KEY_KEY) || "");
  const [selectedTier, setSelectedTier] = useState<Tier>(() => (localStorage.getItem(TIER_KEY) as Tier) || "medio");
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

  // dropdown lista só os provedores/IA (um por token)
  const tokenOptions = useMemo(
    () => keys.map((k) => ({ id: k.id, label: `${PROVIDER_LABEL[k.provider] || k.provider}${k.label ? ` · ${k.label}` : ""}` })),
    [keys],
  );

  // token ativo + modelo resolvido pelo nível (Baixo/Médio/Alto)
  const activeToken = keys.find((k) => k.id === selectedTokenId);
  const activeModel = resolveTierModel(activeToken, selectedTier);

  // garante que o token selecionado ainda exista
  useEffect(() => {
    setSelectedTokenId((cur) => (cur && keys.some((k) => k.id === cur)) ? cur : (keys[0]?.id || ""));
  }, [keys]);

  useEffect(() => { if (selectedTokenId) localStorage.setItem(KEY_KEY, selectedTokenId); }, [selectedTokenId]);
  useEffect(() => { localStorage.setItem(TIER_KEY, selectedTier); }, [selectedTier]);
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
    if (!selectedTokenId) { toast.error("Cadastre um token de IA em Integração IA & Webhooks"); return; }
    const newMsgs = [...messages, { role: "user" as const, content: text }];
    setMessages(newMsgs);
    setInput("");
    setSending(true);
    try {
      // sessão válida é obrigatória: a edge function exige o JWT do usuário
      const hasSession = await ensureFreshSession();
      if (!hasSession) {
        setMessages((m) => [...m, { role: "assistant", content: "⚠️ Sua sessão expirou. Saia e entre novamente para usar o assistente." }]);
        return;
      }
      const model = resolveTierModel(keys.find((k) => k.id === selectedTokenId), selectedTier);
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { key_id: selectedTokenId, model: model || undefined, messages: newMsgs, system: buildActionsSystemPrompt(), context: buildContext() },
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
        if (detail === "unauthorized") detail = "Sua sessão expirou. Saia e entre novamente para usar o assistente.";
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

  // contexto passado às ações (resolução de cliente/responsável + autoria)
  const actionCtx: ActionContext = useMemo(
    () => ({ clients, team, currentUserName, currentUserId, currentUserAuthId }),
    [clients, team, currentUserName, currentUserId, currentUserAuthId],
  );

  const confirmAction = async (i: number) => {
    const msg = messages[i];
    if (!msg?.action) return;
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, actionState: "running" } : x)));
    let res: { ok: boolean; msg: string };
    try {
      res = await executeAction(msg.action, actionCtx);
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

          {/* seletor: dropdown = IA/provedor · botões = nível do modelo (Baixo/Médio/Alto) */}
          <div className="px-3 py-2 border-b space-y-2">
            {tokenOptions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nenhum token de IA cadastrado. Vá em <span className="font-medium">Integração IA &amp; Webhooks</span>.</p>
            ) : (
              <>
                <select value={selectedTokenId} onChange={(e) => setSelectedTokenId(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-md border bg-background text-foreground">
                  {tokenOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {TIERS.map((t) => {
                    const active = selectedTier === t.key;
                    const model = resolveTierModel(activeToken, t.key);
                    return (
                      <button key={t.key} onClick={() => setSelectedTier(t.key)} title={model ? `Modelo: ${model}` : "Modelo não configurado para este nível"}
                        className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                        <t.Icon className="w-3 h-3" /> {t.label}
                      </button>
                    );
                  })}
                </div>
                {activeModel && <p className="text-[10px] text-muted-foreground truncate">Usando: {activeModel}</p>}
              </>
            )}
          </div>

          {/* mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground mt-8 space-y-2">
                <Sparkles className="w-7 h-7 mx-auto opacity-50" />
                <p>Pergunte sobre a tela — ou peça uma ação.</p>
                <p className="text-[10px] leading-relaxed">
                  Ex: "agende uma gravação amanhã 20h do cliente Anil Piscinas" · "crie uma tarefa pro João revisar a arte até sexta" · "adicione um lead: Maria, empresa XPTO" · "marque a gravação institucional como gravada"
                </p>
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
                    ctx={actionCtx}
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
            <button onClick={send} disabled={sending || !input.trim() || !selectedTokenId}
              className="h-9 w-9 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Card de confirmação de ação (genérico, dirigido pelo registro) ──────────
function ActionCard({
  action, state, result, ctx, onConfirm, onCancel,
}: {
  action: PendingAction;
  state: ActionState;
  result?: string;
  ctx: ActionContext;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const def = getActionDef(action.tipo);
  const Icon = def?.icon ?? Sparkles;
  const cardTitle = def?.label ?? action.tipo;
  const rows = previewAction(action, ctx).filter((r) => r.value && r.value !== "—" || r.warn);
  const hasWarn = rows.some((r) => r.warn);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-[11px] space-y-1.5">
      <div className="flex items-center gap-1.5 font-semibold text-foreground">
        <Icon className="w-3.5 h-3.5 text-primary" /> {cardTitle}
      </div>
      <div className="space-y-1">
        {rows.map((r, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="text-muted-foreground w-20 shrink-0">{r.label}</span>
            <span className={`font-medium break-words ${r.warn ? "text-amber-600" : "text-foreground"}`}>{r.value}</span>
          </div>
        ))}
      </div>
      {hasWarn && state === "pending" && (
        <p className="flex items-start gap-1 text-amber-600">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> Verifique os campos destacados antes de confirmar.
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
        <p className="flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Executando…</p>
      )}
      {(state === "pending" || state === "error") && (
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={onCancel}
            className="flex-1 h-7 rounded-md border text-[11px] font-medium text-muted-foreground hover:bg-muted">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 h-7 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90">
            {state === "error" ? "Tentar de novo" : "Confirmar"}
          </button>
        </div>
      )}
    </div>
  );
}
