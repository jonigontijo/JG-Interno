import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAIContextStore } from "@/store/useAIContextStore";
import { toast } from "sonner";
import { Bot, X, Send, Loader2, Sparkles, Eye, MessageSquarePlus } from "lucide-react";

interface AiKey { id: string; provider: string; label: string | null; model: string | null; models: string[] | null; }
interface ChatMsg { role: "user" | "assistant"; content: string; }

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI", anthropic: "Claude", google: "Gemini", groq: "Groq", openrouter: "OpenRouter", custom: "Custom",
};

const POS_KEY = "jg_ai_chat_pos";
const KEY_KEY = "jg_ai_chat_keyid";

export default function FloatingAIChat() {
  const location = useLocation();
  const ctxLabel = useAIContextStore((s) => s.label);
  const ctxData = useAIContextStore((s) => s.data);

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
    supabase.from("sm_ai_api_keys").select("id, provider, label, model, models").eq("is_active", true).order("created_at")
      .then(({ data }) => setKeys((data as AiKey[]) || []));
  }, [open]);

  // opções achatadas: cada par (token × modelo) vira uma opção do seletor
  const options = useMemo(() => {
    const opts: { value: string; keyId: string; model: string; label: string }[] = [];
    for (const k of keys) {
      const prov = PROVIDER_LABEL[k.provider] || k.provider;
      const ms = (k.models && k.models.length) ? k.models : (k.model ? [k.model] : [""]);
      for (const m of ms) {
        opts.push({ value: `${k.id}::${m}`, keyId: k.id, model: m, label: `${prov}${m ? ` · ${m}` : " · (padrão)"}${k.label ? ` (${k.label})` : ""}` });
      }
    }
    return opts;
  }, [keys]);

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
        body: { key_id: keyId, model: model || undefined, messages: newMsgs, context: buildContext() },
      });
      if (error) throw error;
      const r = data as { ok?: boolean; reply?: string; error?: string; detail?: string };
      if (r.ok && r.reply) setMessages((m) => [...m, { role: "assistant", content: r.reply! }]);
      else setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${r.error || "erro"}${r.detail ? ": " + r.detail : ""}` }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ Falha: ${e?.message || e}` }]);
    } finally { setSending(false); }
  };

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
          <div className="px-3 py-2 border-b">
            {options.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nenhum token de IA cadastrado. Vá em <span className="font-medium">Integração IA &amp; Webhooks</span>.</p>
            ) : (
              <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-md border bg-background text-foreground">
                {options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-xs text-muted-foreground mt-8 space-y-2">
                <Sparkles className="w-7 h-7 mx-auto opacity-50" />
                <p>Pergunte algo sobre a tela atual.</p>
                <p className="text-[10px]">Ex: "resuma os posts atrasados desta planilha" · "quais clientes precisam de post hoje?"</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {m.content}
                </div>
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
