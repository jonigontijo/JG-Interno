import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useAIPageContext } from "@/store/useAIContextStore";
import Modal from "@/components/Modal";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users, Loader2, RefreshCw, Search, Pencil, Save, Calendar as CalendarIcon,
  Instagram, Facebook, Youtube, Linkedin, Hash, CheckCircle2, XCircle, Power, Link2,
} from "lucide-react";

interface SMConfig {
  id: string;
  client_id: string;
  active_platforms: string[];
  post_frequency: Record<string, number>;
  responsible_id: string | null;
  contract_start: string | null;
  contract_end: string | null;
  contract_notes: string | null;
  client_webhook_url: string | null;
  is_active: boolean;
}

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "tiktok", label: "TikTok", icon: Hash },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "twitter", label: "X / Twitter", icon: Hash },
  { value: "pinterest", label: "Pinterest", icon: Hash },
  { value: "outro", label: "Outro", icon: Hash },
];
const platLabel = (v: string) => PLATFORMS.find((p) => p.value === v)?.label || v;

interface DraftState {
  clientId: string;
  clientName: string;
  active_platforms: string[];
  post_frequency: Record<string, number>;
  responsible_id: string;
  contract_start: string;
  contract_end: string;
  contract_notes: string;
  client_webhook_url: string;
  is_active: boolean;
}

export default function ClientesSMPanel() {
  const { clients } = useAppStore();
  const allUsers = useAuthStore((s) => s.users);

  const socialClients = useMemo(
    () => clients
      .filter((c) => c.services.some((s) => s.toLowerCase().includes("social media")))
      .sort((a, b) => a.company.localeCompare(b.company)),
    [clients],
  );

  const activeUsers = useMemo(() => allUsers.filter((u) => u.active && u.authId), [allUsers]);
  const userName = useCallback(
    (authId: string | null) => (authId ? activeUsers.find((u) => u.authId === authId)?.name || "—" : "—"),
    [activeUsers],
  );

  const [configs, setConfigs] = useState<Record<string, SMConfig>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from("sm_client_configs").select("*");
      const map: Record<string, SMConfig> = {};
      ((data as any[]) || []).forEach((c) => {
        map[c.client_id] = {
          ...c,
          active_platforms: c.active_platforms || [],
          post_frequency: c.post_frequency || {},
        };
      });
      setConfigs(map);
    } catch {
      toast.error("Falha ao carregar configurações de clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("sm-client-configs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_client_configs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return socialClients;
    return socialClients.filter((c) => c.company.toLowerCase().includes(q));
  }, [socialClients, search]);

  const totalFreq = (f: Record<string, number>) => Object.values(f || {}).reduce((a, b) => a + (Number(b) || 0), 0);

  // ── contexto IA ──
  useAIPageContext(
    "Clientes Social Media — Configurações",
    {
      total_clientes: socialClients.length,
      configurados: Object.keys(configs).length,
      clientes: filtered.slice(0, 50).map((c) => {
        const cfg = configs[c.id];
        return {
          cliente: c.company,
          plataformas: cfg?.active_platforms || [],
          posts_por_mes: cfg ? totalFreq(cfg.post_frequency) : 0,
          responsavel: userName(cfg?.responsible_id || null),
          ativo: cfg?.is_active ?? null,
        };
      }),
    },
    [configs, filtered],
  );

  const openEdit = (clientId: string, clientName: string) => {
    const cfg = configs[clientId];
    setDraft({
      clientId,
      clientName,
      active_platforms: cfg?.active_platforms || [],
      post_frequency: cfg?.post_frequency || {},
      responsible_id: cfg?.responsible_id || "",
      contract_start: cfg?.contract_start || "",
      contract_end: cfg?.contract_end || "",
      contract_notes: cfg?.contract_notes || "",
      client_webhook_url: cfg?.client_webhook_url || "",
      is_active: cfg?.is_active ?? true,
    });
  };

  const togglePlatform = (p: string) => {
    setDraft((d) => {
      if (!d) return d;
      const has = d.active_platforms.includes(p);
      const active_platforms = has ? d.active_platforms.filter((x) => x !== p) : [...d.active_platforms, p];
      const post_frequency = { ...d.post_frequency };
      if (has) delete post_frequency[p];
      else if (post_frequency[p] == null) post_frequency[p] = 0;
      return { ...d, active_platforms, post_frequency };
    });
  };

  const setFreq = (p: string, n: number) => {
    setDraft((d) => (d ? { ...d, post_frequency: { ...d.post_frequency, [p]: n } } : d));
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = {
        client_id: draft.clientId,
        active_platforms: draft.active_platforms,
        post_frequency: draft.post_frequency as any,
        responsible_id: draft.responsible_id || null,
        contract_start: draft.contract_start || null,
        contract_end: draft.contract_end || null,
        contract_notes: draft.contract_notes.trim() || null,
        client_webhook_url: draft.client_webhook_url.trim() || null,
        is_active: draft.is_active,
      };
      const { error } = await supabase.from("sm_client_configs").upsert(payload, { onConflict: "client_id" });
      if (error) throw error;
      toast.success("Configuração salva!");
      setDraft(null);
      await load();
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..."
            className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum cliente de Social Media encontrado</p>
          <p className="text-xs mt-1">Clientes com o serviço "Social Media" aparecem aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const cfg = configs[c.id];
            const configured = !!cfg;
            const freq = cfg ? totalFreq(cfg.post_frequency) : 0;
            return (
              <div key={c.id} className="rounded-lg border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.company}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {configured ? (
                        cfg.is_active ? (
                          <span className="text-[10px] inline-flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" /> Ativo</span>
                        ) : (
                          <span className="text-[10px] inline-flex items-center gap-1 text-muted-foreground"><Power className="w-3 h-3" /> Inativo</span>
                        )
                      ) : (
                        <span className="text-[10px] text-warning">Não configurado</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => openEdit(c.id, c.company)}
                    className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar configuração">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

                {configured && cfg.active_platforms.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {cfg.active_platforms.map((p) => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {platLabel(p)}{cfg.post_frequency[p] ? ` · ${cfg.post_frequency[p]}` : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">Sem plataformas definidas</p>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px] mt-auto pt-2 border-t">
                  <div>
                    <p className="text-muted-foreground">Posts/mês</p>
                    <p className="text-foreground font-medium">{freq || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="text-foreground font-medium truncate">{userName(cfg?.responsible_id || null)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal edição */}
      {draft && (
        <Modal open={!!draft} onClose={() => setDraft(null)} title={`Config. Social Media — ${draft.clientName}`}>
          <div className="space-y-4">
            {/* Plataformas + frequência */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-2">Plataformas ativas &amp; posts/mês</label>
              <div className="space-y-1.5">
                {PLATFORMS.map((p) => {
                  const checked = draft.active_platforms.includes(p.value);
                  const Icon = p.icon;
                  return (
                    <div key={p.value} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${checked ? "bg-primary/5 border-primary/30" : "bg-background"}`}>
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={checked} onChange={() => togglePlatform(p.value)} />
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{p.label}</span>
                      </label>
                      {checked && (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} value={draft.post_frequency[p.value] ?? 0}
                            onChange={(e) => setFreq(p.value, Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 px-2 py-1 rounded-md border bg-background text-sm text-foreground text-center" />
                          <span className="text-[10px] text-muted-foreground">/mês</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Responsável */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável</label>
              <select value={draft.responsible_id} onChange={(e) => setDraft((d) => (d ? { ...d, responsible_id: e.target.value } : d))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Sem responsável</option>
                {activeUsers.map((u) => <option key={u.authId} value={u.authId}>{u.name}{u.role ? ` (${u.role})` : ""}</option>)}
              </select>
            </div>

            {/* Contrato */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Início do contrato</label>
                <input type="date" value={draft.contract_start} onChange={(e) => setDraft((d) => (d ? { ...d, contract_start: e.target.value } : d))}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Fim do contrato</label>
                <input type="date" value={draft.contract_end} onChange={(e) => setDraft((d) => (d ? { ...d, contract_end: e.target.value } : d))}
                  className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
              </div>
            </div>

            {/* Webhook por cliente */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5 flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Webhook de aprovação do cliente <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input value={draft.client_webhook_url} onChange={(e) => setDraft((d) => (d ? { ...d, client_webhook_url: e.target.value } : d))}
                placeholder="https://..." className="w-full px-3 py-2 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground font-mono" />
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Observações do contrato</label>
              <textarea value={draft.contract_notes} onChange={(e) => setDraft((d) => (d ? { ...d, contract_notes: e.target.value } : d))}
                rows={3} placeholder="Escopo, linha editorial, particularidades..." className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
            </div>

            {/* Ativo */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => (d ? { ...d, is_active: e.target.checked } : d))} />
              <span className="text-sm text-foreground">Cliente ativo no Social Media</span>
            </label>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
              <button onClick={handleSave} disabled={busy}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
