import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useAIPageContext } from "@/store/useAIContextStore";
import Modal from "@/components/Modal";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, RefreshCw, Loader2, Search, ExternalLink, Trash2, Send, Eye,
  CheckCircle2, XCircle, Clock, RotateCcw, MessageSquare,
} from "lucide-react";

// ── Tipos ──
type ApprovalStatus = "aguardando" | "aprovado" | "reprovado" | "revisao_solicitada";

interface Approval {
  id: string;
  client_id: string;
  client_name: string | null;
  title: string | null;
  social_media_responsavel: string | null;
  piece_type: string;
  plataforma: string | null;
  data_publicacao_prevista: string | null;
  description: string | null;          // descricao_post
  piece_url: string | null;            // conteudo
  legenda_sugerida: string | null;
  observacoes_internas: string | null;
  prazo_resposta: string | null;
  status: ApprovalStatus;
  client_feedback: string | null;
  client_responded_at: string | null;
  webhook_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

const PIECE_TYPES = [
  { value: "static", label: "Imagem / Estático" },
  { value: "carousel", label: "Carrossel" },
  { value: "video", label: "Vídeo" },
  { value: "reels", label: "Reels" },
  { value: "story", label: "Story" },
  { value: "outro", label: "Outro" },
];
const pieceLabel = (t: string) => PIECE_TYPES.find((p) => p.value === t)?.label || t;

const PLATAFORMAS = ["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "X / Twitter", "Pinterest", "Outro"];

const STATUS_META: Record<ApprovalStatus, { label: string; cls: string; icon: typeof Clock }> = {
  aguardando:          { label: "Aguardando",          cls: "bg-warning/15 text-warning border-warning/30",       icon: Clock },
  aprovado:            { label: "Aprovado",            cls: "bg-success/15 text-success border-success/30",       icon: CheckCircle2 },
  reprovado:           { label: "Reprovado",           cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  revisao_solicitada:  { label: "Revisão solicitada",  cls: "bg-info/15 text-info border-info/30",                icon: RotateCcw },
};

// exibe ISO ("2026-06-15T10:00:00Z") como "15/06/2026 10:00" (hora UTC = a que foi digitada)
const fmtDateTime = (d: string | null) => {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : d;
};
// datetime-local ("2026-06-15T10:00") -> ISO UTC; a hora digitada é enviada como UTC
const toUtcIso = (local: string) => (local ? new Date(local + "Z").toISOString() : null);

const emptyForm = {
  clientId: "",
  title: "",
  social_media_responsavel: "",
  piece_type: "static",
  plataforma: "Instagram",
  data_publicacao_prevista: "",
  prazo_resposta: "",
  pieceUrl: "",
  description: "",
  legenda_sugerida: "",
  observacoes_internas: "",
};

export default function AprovacoesPanel() {
  const { clients } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const allUsers = useAuthStore((s) => s.users);
  const activeUsers = useMemo(() => allUsers.filter((u) => u.active), [allUsers]);

  const socialClients = useMemo(
    () => clients
      .filter((c) => c.services.some((s) => s.toLowerCase().includes("social media")))
      .sort((a, b) => a.company.localeCompare(b.company)),
    [clients],
  );

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApprovalStatus>("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [selected, setSelected] = useState<Approval | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");

  const reloadRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carregamento ──
  const load = useCallback(async () => {
    try {
      const { data: rows } = await supabase.from("sm_approvals").select("*").order("created_at", { ascending: false });
      setApprovals((rows as Approval[]) || []);
    } catch {
      toast.error("Falha ao carregar aprovações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Realtime: reflete a resposta do cliente ao vivo ──
  useEffect(() => {
    const channel = supabase
      .channel("sm-approvals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_approvals" }, () => {
        if (reloadRef.current) clearTimeout(reloadRef.current);
        reloadRef.current = setTimeout(() => { load(); }, 400);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // ── Estatísticas ──
  const stats = useMemo(() => {
    const c = { aguardando: 0, aprovado: 0, reprovado: 0, revisao_solicitada: 0 };
    approvals.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [approvals]);

  // ── Filtro ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return approvals.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (a.title || "").toLowerCase().includes(q) ||
        (a.client_name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.plataforma || "").toLowerCase().includes(q)
      );
    });
  }, [approvals, search, statusFilter]);

  // ── Contexto para a IA ──
  useAIPageContext(
    "Aprovações de Conteúdo — Social Media",
    {
      total: approvals.length,
      por_status: stats,
      aprovacoes: filtered.slice(0, 40).map((a) => ({
        cliente: a.client_name, titulo: a.title, plataforma: a.plataforma, tipo: a.piece_type,
        responsavel: a.social_media_responsavel, status: a.status, feedback: a.client_feedback,
        publicacao_prevista: a.data_publicacao_prevista, prazo_resposta: a.prazo_resposta,
      })),
    },
    [approvals, filtered, stats],
  );

  const displayTitle = (a: Approval) =>
    a.title || a.description || `${a.plataforma || ""} · ${pieceLabel(a.piece_type)}`.trim();

  // ── Dispara/Reenvia via Edge Function (token de callback fica no servidor) ──
  const sendApproval = async (approvalId: string, opts: { silentEmpty?: boolean } = {}) => {
    const { data, error } = await supabase.functions.invoke("sm-send-approval", { body: { approval_id: approvalId } });
    if (error) { toast.error(`Webhook não enviado: ${error.message}`); return; }
    const r = data as { ok?: boolean; delivered?: number; total?: number; message?: string };
    if (r?.ok && (r.delivered ?? 0) > 0) toast.success("Enviado ao cliente!");
    else if (r?.ok && (r.total ?? 0) === 0) { if (!opts.silentEmpty) toast.warning("Nenhum webhook inscrito em 'approval.created'. Cadastre em Integração IA & Webhooks."); }
    else if (r?.ok) toast.warning("Disparado, mas sem entrega 2xx (verifique a URL do webhook).");
    else toast.warning("Falha ao disparar o webhook.");
  };

  // ── Criar aprovação ──
  const handleCreate = async () => {
    if (!form.clientId) { toast.error("Selecione o cliente"); return; }
    if (!form.pieceUrl.trim()) { toast.error("Informe o link do conteúdo (peça)"); return; }

    setBusy(true);
    try {
      const client = socialClients.find((c) => c.id === form.clientId);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { data: inserted, error } = await supabase
        .from("sm_approvals")
        .insert({
          client_id: form.clientId,
          client_name: client?.company ?? null,
          title: form.title.trim() || null,
          social_media_responsavel: form.social_media_responsavel.trim() || null,
          piece_type: form.piece_type,
          plataforma: form.plataforma || null,
          data_publicacao_prevista: toUtcIso(form.data_publicacao_prevista),
          prazo_resposta: toUtcIso(form.prazo_resposta),
          piece_url: form.pieceUrl.trim(),
          description: form.description.trim() || null,
          legenda_sugerida: form.legenda_sugerida.trim() || null,
          observacoes_internas: form.observacoes_internas.trim() || null,
          status: "aguardando",
          created_by: uid,
        })
        .select("*")
        .single();
      if (error) throw error;

      toast.success("Aprovação criada!");
      await sendApproval((inserted as Approval).id);

      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast.error(`Falha ao criar: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  // ── Reenviar ──
  const handleResend = async (a: Approval) => {
    setBusy(true);
    try { await sendApproval(a.id); await load(); }
    finally { setBusy(false); }
  };

  // ── Resposta manual (fallback / sem sistema externo) ──
  const handleManualResponse = async (a: Approval, status: ApprovalStatus, feedback?: string) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("sm_approvals")
        .update({
          status,
          client_feedback: feedback?.trim() || a.client_feedback || null,
          client_responded_at: new Date().toISOString(),
        })
        .eq("id", a.id);
      if (error) throw error;
      toast.success(`Marcado como "${STATUS_META[status].label}"`);
      setSelected(null);
      setFeedbackDraft("");
      await load();
    } catch (e: any) {
      toast.error(`Falha: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  // ── Excluir ──
  const handleDelete = async (a: Approval) => {
    if (!confirm("Excluir esta aprovação?")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("sm_approvals").delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Aprovação excluída");
      setSelected(null);
      await load();
    } catch (e: any) {
      toast.error(`Falha ao excluir: ${e?.message || e}`);
    } finally { setBusy(false); }
  };

  const openForm = () => {
    setForm({ ...emptyForm, social_media_responsavel: currentUser?.name || "" });
    setShowForm(true);
  };

  const StatusBadge = ({ status }: { status: ApprovalStatus }) => {
    const m = STATUS_META[status];
    const Icon = m.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${m.cls}`}>
        <Icon className="w-2.5 h-2.5" /> {m.label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          ["aguardando", "Aguardando", "text-warning"],
          ["aprovado", "Aprovados", "text-success"],
          ["revisao_solicitada", "Em revisão", "text-info"],
          ["reprovado", "Reprovados", "text-destructive"],
        ] as const).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setStatusFilter((cur) => (cur === key ? "all" : key))}
            className={`p-3 rounded-lg border bg-card text-center transition-colors hover:bg-muted/40 ${statusFilter === key ? "ring-2 ring-primary/40" : ""}`}
          >
            <p className={`text-xl font-bold ${color}`}>{stats[key as ApprovalStatus]}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, cliente, plataforma..."
            className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {statusFilter !== "all" && (
          <button onClick={() => setStatusFilter("all")} className="px-3 py-2 rounded-md border text-xs text-muted-foreground hover:text-foreground">
            Limpar filtro
          </button>
        )}
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
        <button onClick={openForm} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Aprovação
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{approvals.length === 0 ? "Nenhuma aprovação criada ainda" : "Nenhuma aprovação encontrada"}</p>
          <p className="text-xs mt-1">Clique em "Nova Aprovação" para enviar uma peça ao cliente</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Peça</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Plataforma</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Publicação</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground font-medium max-w-[260px] truncate">{displayTitle(a)}</span>
                      {a.client_feedback && <MessageSquare className="w-3 h-3 text-info shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{pieceLabel(a.piece_type)}{a.social_media_responsavel ? ` · ${a.social_media_responsavel}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{a.client_name || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.plataforma || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDateTime(a.data_publicacao_prevista)}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {a.piece_url && (
                        <a href={a.piece_url.startsWith("http") ? a.piece_url : `https://${a.piece_url}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Abrir conteúdo">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button onClick={() => { setSelected(a); setFeedbackDraft(""); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleResend(a)} disabled={busy} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Reenviar ao cliente">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(a)} disabled={busy} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: nova aprovação */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nova Aprovação de Conteúdo" maxWidth="max-w-2xl">
        <div className="space-y-3.5">
          <p className="text-xs text-muted-foreground">
            Ao salvar, o sistema envia o webhook <code className="font-mono bg-muted px-1 rounded">approval.created</code> com os campos abaixo para o destino cadastrado em Integração IA &amp; Webhooks.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente *</label>
              <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {socialClients.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Social media responsável</label>
              <select value={form.social_media_responsavel} onChange={(e) => setForm((f) => ({ ...f, social_media_responsavel: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {activeUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Tipo de conteúdo</label>
              <select value={form.piece_type} onChange={(e) => setForm((f) => ({ ...f, piece_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {PIECE_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Plataforma</label>
              <select value={form.plataforma} onChange={(e) => setForm((f) => ({ ...f, plataforma: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {PLATAFORMAS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Identificação (interna)</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Opcional" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Data de publicação prevista</label>
              <input type="datetime-local" value={form.data_publicacao_prevista} onChange={(e) => setForm((f) => ({ ...f, data_publicacao_prevista: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Prazo de resposta do cliente</label>
              <input type="datetime-local" value={form.prazo_resposta} onChange={(e) => setForm((f) => ({ ...f, prazo_resposta: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Conteúdo — link da peça * <span className="text-muted-foreground font-normal">(imagem, vídeo ou pasta do Drive)</span></label>
            <input value={form.pieceUrl} onChange={(e) => setForm((f) => ({ ...f, pieceUrl: e.target.value }))}
              placeholder="https://drive.google.com/..." className="w-full px-3 py-2 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground font-mono" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Descrição do post</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Do que se trata a peça..." rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Legenda sugerida</label>
            <textarea value={form.legenda_sugerida} onChange={(e) => setForm((f) => ({ ...f, legenda_sugerida: e.target.value }))}
              placeholder="Legenda proposta para a publicação..." rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Observações internas</label>
            <textarea value={form.observacoes_internas} onChange={(e) => setForm((f) => ({ ...f, observacoes_internas: e.target.value }))}
              placeholder="Pontos de atenção, contexto para o cliente..." rows={2}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreate} disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Criar e enviar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: detalhe / resposta */}
      {selected && (
        <Modal open={!!selected} onClose={() => { setSelected(null); setFeedbackDraft(""); }} title={displayTitle(selected)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selected.status} />
              <span className="text-[10px] text-muted-foreground">
                Criada em {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              {selected.webhook_sent_at && (
                <span className="text-[10px] text-success inline-flex items-center gap-1"><Send className="w-2.5 h-2.5" /> webhook enviado</span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {[
                ["Cliente", selected.client_name],
                ["Responsável", selected.social_media_responsavel],
                ["Tipo", pieceLabel(selected.piece_type)],
                ["Plataforma", selected.plataforma],
                ["Publicação prevista", fmtDateTime(selected.data_publicacao_prevista)],
                ["Prazo de resposta", fmtDateTime(selected.prazo_resposta)],
              ].map(([label, val], i) => (
                <div key={i} className="p-2.5 rounded-md border bg-muted/20">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-foreground text-sm">{val || "—"}</p>
                </div>
              ))}
            </div>

            {selected.piece_url && (
              <a href={selected.piece_url.startsWith("http") ? selected.piece_url : `https://${selected.piece_url}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {selected.piece_url}
              </a>
            )}

            {selected.description && (
              <div className="p-2.5 rounded-md border bg-muted/20">
                <p className="text-[10px] text-muted-foreground mb-0.5">Descrição do post</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
              </div>
            )}
            {selected.legenda_sugerida && (
              <div className="p-2.5 rounded-md border bg-muted/20">
                <p className="text-[10px] text-muted-foreground mb-0.5">Legenda sugerida</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.legenda_sugerida}</p>
              </div>
            )}
            {selected.observacoes_internas && (
              <div className="p-2.5 rounded-md border bg-muted/20">
                <p className="text-[10px] text-muted-foreground mb-0.5">Observações internas</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.observacoes_internas}</p>
              </div>
            )}

            {selected.client_feedback && (
              <div className="p-2.5 rounded-md border border-info/30 bg-info/10">
                <p className="text-[10px] text-info mb-0.5 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Retorno do cliente</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.client_feedback}</p>
                {selected.client_responded_at && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Respondido em {format(new Date(selected.client_responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            )}

            {/* Resposta manual */}
            <div className="pt-2 border-t space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Registrar resposta manualmente</p>
              <textarea value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)}
                placeholder="Comentário do cliente (opcional)..." rows={2}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleManualResponse(selected, "aprovado", feedbackDraft)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success text-xs font-medium hover:bg-success/20 disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                </button>
                <button onClick={() => handleManualResponse(selected, "revisao_solicitada", feedbackDraft)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-info/10 text-info text-xs font-medium hover:bg-info/20 disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" /> Solicitar revisão
                </button>
                <button onClick={() => handleManualResponse(selected, "reprovado", feedbackDraft)} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> Reprovar
                </button>
              </div>
            </div>

            <div className="flex gap-2 justify-between pt-3 border-t">
              <button onClick={() => handleResend(selected)} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> Reenviar ao cliente
              </button>
              <button onClick={() => { setSelected(null); setFeedbackDraft(""); }} className="px-4 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground">Fechar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
