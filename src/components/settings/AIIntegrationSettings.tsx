import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import {
  Bot, Copy, Check, Loader2, KeyRound, Plus, Trash2, RefreshCw,
  Webhook, Eye, EyeOff, Power, Send, Pencil, X,
} from "lucide-react";
import { WEBHOOK_EVENTS, EVENT_GROUPS, eventLabel } from "@/lib/webhookEvents";

interface AiKey {
  id: string;
  provider: string;
  label: string | null;
  api_key: string;
  model: string | null;
  base_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface IntegrationSettings {
  id: number;
  callback_secret: string;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
  last_fired_at: string | null;
  last_status: number | null;
  last_error: string | null;
  fire_count: number;
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google", label: "Google (Gemini)" },
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom / Self-hosted" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/sm-callback`;
const FIRE_EVENT_URL = `${SUPABASE_URL}/functions/v1/sm-fire-event`;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const emptyWebhook = { id: "", name: "", url: "", events: [] as string[], secret: "", is_active: true };

export default function AIIntegrationSettings({ adminOnly = false }: { adminOnly?: boolean } = {}) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = !!currentUser?.isAdmin;

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [keys, setKeys] = useState<AiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form token IA
  const [form, setForm] = useState({ provider: "openai", label: "", api_key: "", model: "", base_url: "" });
  const [showForm, setShowForm] = useState(false);

  // form webhook
  const [whForm, setWhForm] = useState<typeof emptyWebhook>(emptyWebhook);
  const [showWhForm, setShowWhForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: k }, { data: w }] = await Promise.all([
        supabase.from("sm_integration_settings").select("id, callback_secret").eq("id", 1).maybeSingle(),
        supabase.from("sm_ai_api_keys").select("*").order("created_at", { ascending: false }),
        supabase.from("sm_webhooks").select("*").order("created_at", { ascending: false }),
      ]);
      setSettings(s as IntegrationSettings | null);
      setKeys((k as AiKey[]) || []);
      setWebhooks((w as WebhookRow[]) || []);
    } catch {
      toast.error("Falha ao carregar configurações de IA");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Tokens IA ──
  const handleAddKey = async () => {
    if (!form.api_key.trim()) { toast.error("Informe o token da API"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("sm_ai_api_keys").insert({
        provider: form.provider, label: form.label || null, api_key: form.api_key.trim(),
        model: form.model || null, base_url: form.base_url || null, created_by: currentUser?.id ?? null,
      });
      if (error) throw error;
      toast.success("Token de IA salvo!");
      setForm({ provider: "openai", label: "", api_key: "", model: "", base_url: "" });
      setShowForm(false);
      await load();
    } catch (e: any) { toast.error(`Falha ao salvar: ${e?.message || e}`); }
    finally { setBusy(false); }
  };
  const handleToggleKey = async (id: string, current: boolean) => {
    await supabase.from("sm_ai_api_keys").update({ is_active: !current }).eq("id", id); await load();
  };
  const handleDeleteKey = async (id: string) => {
    if (!confirm("Remover este token de IA?")) return;
    await supabase.from("sm_ai_api_keys").delete().eq("id", id); toast.success("Token removido"); await load();
  };

  // ── Segredo callback ──
  const handleRegenSecret = async () => {
    if (!confirm("Gerar um novo segredo de callback? O n8n / app do cliente precisará ser atualizado.")) return;
    setBusy(true);
    try {
      const newSecret = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const { error } = await supabase.from("sm_integration_settings")
        .update({ callback_secret: newSecret, updated_by: currentUser?.id ?? null }).eq("id", 1);
      if (error) throw error;
      toast.success("Novo segredo gerado!"); await load();
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setBusy(false); }
  };

  // ── Webhooks ──
  const openNewWebhook = () => { setWhForm(emptyWebhook); setShowWhForm(true); };
  const openEditWebhook = (w: WebhookRow) => {
    setWhForm({ id: w.id, name: w.name, url: w.url, events: w.events || [], secret: w.secret || "", is_active: w.is_active });
    setShowWhForm(true);
  };
  const toggleEvent = (key: string) => {
    setWhForm(f => ({ ...f, events: f.events.includes(key) ? f.events.filter(e => e !== key) : [...f.events, key] }));
  };
  const handleSaveWebhook = async () => {
    if (!whForm.name.trim() || !whForm.url.trim()) { toast.error("Preencha nome e URL"); return; }
    if (whForm.events.length === 0) { toast.error("Selecione ao menos um evento"); return; }
    setBusy(true);
    try {
      const payload = {
        name: whForm.name.trim(), url: whForm.url.trim(), events: whForm.events,
        secret: whForm.secret || null, is_active: whForm.is_active,
      };
      if (whForm.id) {
        const { error } = await supabase.from("sm_webhooks").update(payload).eq("id", whForm.id);
        if (error) throw error;
        toast.success("Webhook atualizado!");
      } else {
        const { error } = await supabase.from("sm_webhooks").insert({ ...payload, created_by: currentUser?.id ?? null });
        if (error) throw error;
        toast.success("Webhook cadastrado!");
      }
      setShowWhForm(false); setWhForm(emptyWebhook); await load();
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setBusy(false); }
  };
  const handleToggleWebhook = async (id: string, current: boolean) => {
    await supabase.from("sm_webhooks").update({ is_active: !current }).eq("id", id); await load();
  };
  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Remover este webhook?")) return;
    await supabase.from("sm_webhooks").delete().eq("id", id); toast.success("Webhook removido"); await load();
  };
  const handleTestWebhook = async (w: WebhookRow) => {
    if (!settings?.callback_secret) return;
    setBusy(true);
    try {
      const ev = w.events[0];
      const resp = await fetch(FIRE_EVENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-jg-secret": settings.callback_secret },
        body: JSON.stringify({ event: ev, payload: { test: true, message: "Disparo de teste do JG Interno" } }),
      });
      const r = await resp.json();
      if (r.ok && r.delivered > 0) toast.success(`Teste enviado! Evento "${eventLabel(ev)}" entregue.`);
      else if (r.ok) toast.warning(`Disparado, mas nenhuma entrega 2xx (verifique a URL).`);
      else toast.error(`Falha no disparo: ${r.error || "erro"}`);
      await load();
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setBusy(false); }
  };

  const mask = (s: string) => s.length <= 8 ? "••••" : s.slice(0, 4) + "••••••••" + s.slice(-4);

  if (adminOnly && !isAdmin) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center border bg-info/10 text-info border-info/20">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Integração IA &amp; Webhooks</h2>
        <span className="text-[10px] text-muted-foreground ml-1">Social Media</span>
      </div>

      {loading ? (
        <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="p-4 space-y-6">

          {/* ── URL de Callback ── */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Webhook className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">URL de Callback (entrada)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Endpoint que o n8n / app do cliente chama para devolver respostas (aprovações, status de posts, eventos do Google Agenda). Envie o segredo no header <code className="font-mono bg-muted px-1 rounded">x-jg-secret</code>.
            </p>
            <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 border">
              <code className="text-xs font-mono text-foreground flex-1 break-all">{CALLBACK_URL}</code>
              <CopyButton value={CALLBACK_URL} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-32 shrink-0">Segredo (x-jg-secret):</span>
              <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 border flex-1 min-w-0">
                <code className="text-xs font-mono text-foreground flex-1 break-all">
                  {showSecret ? settings?.callback_secret : mask(settings?.callback_secret || "")}
                </code>
                <button onClick={() => setShowSecret(v => !v)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0">
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <CopyButton value={settings?.callback_secret || ""} />
              </div>
              <button onClick={handleRegenSecret} disabled={busy}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50 shrink-0" title="Gerar novo segredo">
                <RefreshCw className="w-3 h-3" /> Renovar
              </button>
            </div>
            <details className="text-xs text-muted-foreground mt-1">
              <summary className="cursor-pointer hover:text-foreground">Ver ações suportadas (callback)</summary>
              <ul className="mt-2 space-y-1 pl-4 list-disc">
                <li><code className="font-mono">approval_response</code> — atualiza status de aprovação <code>{`{approval_id, status, feedback?}`}</code></li>
                <li><code className="font-mono">post_status</code> — atualiza status do post <code>{`{post_id, status}`}</code></li>
                <li><code className="font-mono">calendar_event</code> — vincula evento do Google Agenda</li>
                <li><code className="font-mono">ai_log</code> — registra ação da IA</li>
                <li><code className="font-mono">ping</code> — teste de conexão</li>
              </ul>
            </details>
          </section>

          {/* ── Webhooks por evento ── */}
          <section className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Webhooks de saída (por evento)</h3>
              <button onClick={openNewWebhook}
                className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-semibold hover:bg-muted">
                <Plus className="w-3 h-3" /> Novo webhook
              </button>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Cada webhook recebe um POST apenas quando os eventos selecionados ocorrem.
            </p>

            {showWhForm && (
              <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{whForm.id ? "Editar webhook" : "Novo webhook"}</span>
                  <button onClick={() => { setShowWhForm(false); setWhForm(emptyWebhook); }} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Nome *</label>
                    <input value={whForm.name} onChange={(e) => setWhForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs" placeholder="Ex: Aprovação cliente" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Segredo (opcional, header x-jg-event-secret)</label>
                    <input value={whForm.secret} onChange={(e) => setWhForm(f => ({ ...f, secret: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs font-mono" placeholder="opcional" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">URL de destino *</label>
                  <input value={whForm.url} onChange={(e) => setWhForm(f => ({ ...f, url: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs font-mono" placeholder="https://webhooks.techjg.com.br/webhook/..." />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1.5">Eventos *</label>
                  <div className="space-y-2">
                    {EVENT_GROUPS.map(group => (
                      <div key={group}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{group}</p>
                        <div className="space-y-1">
                          {WEBHOOK_EVENTS.filter(e => e.group === group).map(ev => (
                            <label key={ev.key} className="flex items-start gap-2 cursor-pointer group">
                              <input type="checkbox" checked={whForm.events.includes(ev.key)} onChange={() => toggleEvent(ev.key)} className="mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-foreground">{ev.label}</span>
                                <span className="text-[10px] text-muted-foreground block">{ev.description}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowWhForm(false); setWhForm(emptyWebhook); }} className="flex-1 py-1.5 rounded-md border text-xs hover:bg-muted">Cancelar</button>
                  <button onClick={handleSaveWebhook} disabled={busy}
                    className="flex-1 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                    {busy ? "Salvando..." : "Salvar webhook"}
                  </button>
                </div>
              </div>
            )}

            {webhooks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum webhook cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {webhooks.map(w => (
                  <div key={w.id} className="rounded-md border bg-background p-3 group">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${w.is_active ? "bg-success" : "bg-muted-foreground/40"}`} />
                      <span className="text-xs font-semibold text-foreground truncate">{w.name}</span>
                      {w.last_status != null && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${w.last_status >= 200 && w.last_status < 300 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          {w.last_status}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleTestWebhook(w)} disabled={busy} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Testar disparo"><Send className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEditWebhook(w)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToggleWebhook(w.id, w.is_active)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title={w.is_active ? "Desativar" : "Ativar"}><Power className={`w-3.5 h-3.5 ${w.is_active ? "text-success" : ""}`} /></button>
                        <button onClick={() => handleDeleteWebhook(w.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <code className="text-[11px] font-mono text-muted-foreground block mt-1 break-all">{w.url}</code>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {w.events.map(ev => (
                        <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info border border-info/20">{eventLabel(ev)}</span>
                      ))}
                    </div>
                    {w.fire_count > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Disparado {w.fire_count}× · último: {w.last_fired_at ? new Date(w.last_fired_at).toLocaleString("pt-BR") : "-"}
                        {w.last_error && <span className="text-destructive"> · {w.last_error}</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Tokens de IA ── */}
          <section className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Tokens de API de IA</h3>
              <button onClick={() => setShowForm(v => !v)} className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-semibold hover:bg-muted">
                <Plus className="w-3 h-3" /> Novo token
              </button>
            </div>

            {showForm && (
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Provedor</label>
                    <select value={form.provider} onChange={(e) => setForm(f => ({ ...f, provider: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs">
                      {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Apelido (opcional)</label>
                    <input value={form.label} onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs" placeholder="Ex: OpenAI Produção" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Token / API Key *</label>
                  <input type="password" value={form.api_key} onChange={(e) => setForm(f => ({ ...f, api_key: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs font-mono" placeholder="sk-..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Modelo padrão (opcional)</label>
                    <input value={form.model} onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs" placeholder="gpt-4o / claude-sonnet-4" />
                  </div>
                  {form.provider === "custom" && (
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Base URL</label>
                      <input value={form.base_url} onChange={(e) => setForm(f => ({ ...f, base_url: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-md border bg-background text-foreground text-xs font-mono" placeholder="https://..." />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-1.5 rounded-md border text-xs hover:bg-muted">Cancelar</button>
                  <button onClick={handleAddKey} disabled={busy}
                    className="flex-1 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50">
                    {busy ? "Salvando..." : "Salvar token"}
                  </button>
                </div>
              </div>
            )}

            {keys.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum token cadastrado ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 px-3 py-2 rounded-md border bg-background group">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${k.is_active ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground"}`}>
                      {PROVIDERS.find(p => p.value === k.provider)?.label || k.provider}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{k.label || "(sem apelido)"}{k.model && <span className="text-muted-foreground"> · {k.model}</span>}</p>
                      <code className="text-[11px] font-mono text-muted-foreground">{revealedKey === k.id ? k.api_key : mask(k.api_key)}</code>
                    </div>
                    <button onClick={() => setRevealedKey(revealedKey === k.id ? null : k.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0">
                      {revealedKey === k.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <CopyButton value={k.api_key} />
                    <button onClick={() => handleToggleKey(k.id, k.is_active)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground shrink-0" title={k.is_active ? "Desativar" : "Ativar"}>
                      <Power className={`w-3.5 h-3.5 ${k.is_active ? "text-success" : ""}`} />
                    </button>
                    <button onClick={() => handleDeleteKey(k.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
