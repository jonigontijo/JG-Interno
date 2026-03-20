import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle, Users, BarChart3, HandHelping, Eye, Upload,
  Link2, Bell, X, Image, FileText, Trash2, Copy, ExternalLink, Loader2, CheckCircle, Clock
} from "lucide-react";

export default function SocialDashboardPage() {
  const APPROVAL_PUBLIC_ORIGIN = "https://jginterno.lovable.app";
  const { tasks, clients, team, requests } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const socialTasks = tasks.filter(t => t.module === "Social Media");
  const socialClients = clients.filter(c => c.services.some(s => s.toLowerCase().includes("social media")));

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadClientId, setUploadClientId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpRequest, setHelpRequest] = useState({ clientId: "", message: "" });
  const [activeSection, setActiveSection] = useState<"overview" | "report" | "team" | "approval_control">("overview");
  const [uploading, setUploading] = useState(false);
  const [clientPosts, setClientPosts] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quickUploadClientId, setQuickUploadClientId] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<"all" | "pending" | "complete" | "rejected">("all");

  // Load uploaded posts from DB
  useEffect(() => {
    loadClientPosts();
  }, []);

  const loadClientPosts = async () => {
    const { data } = await (supabase as any).from('client_posts').select('*').order('uploaded_at', { ascending: false });
    if (data) setClientPosts(data);
  };

  const handleFileUpload = async (files: FileList, clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !currentUser) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} excede 20MB`);
          continue;
        }
        const ext = file.name.split('.').pop();
        const path = `${clientId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('social-posts').upload(path, file);
        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}: ${uploadError.message}`);
          continue;
        }
        const { data: urlData } = supabase.storage.from('social-posts').getPublicUrl(path);
        const fileType = file.type.startsWith('video') ? 'video' : 'image';
        await (supabase as any).from('client_posts').insert({
          client_id: clientId,
          client_name: client.company,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: fileType,
          uploaded_by: currentUser.name,
          status: 'ready',
        });
      }
      toast.success("Post(s) enviado(s) com sucesso!");
      loadClientPosts();
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
      setQuickUploadClientId(null);
    }
  };

  const handleDeletePost = async (postId: string, fileUrl: string) => {
    // Extract path from URL
    const urlParts = fileUrl.split('/social-posts/');
    if (urlParts[1]) {
      await supabase.storage.from('social-posts').remove([urlParts[1]]);
    }
    await (supabase as any).from('client_posts').delete().eq('id', postId);
    toast.success("Post removido");
    loadClientPosts();
  };

  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
  const [approvalLinks, setApprovalLinks] = useState<Record<string, string>>({});

  const generateApprovalLink = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !currentUser) return;
    setGeneratingLink(clientId);
    try {
      // Check if there's already an active token
      const { data: existing } = await (supabase as any)
        .from('approval_tokens')
        .select('token')
        .eq('client_id', clientId)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      let token: string;
      if (existing && existing.length > 0) {
        token = existing[0].token;
      } else {
        const { data: newToken, error } = await (supabase as any)
          .from('approval_tokens')
          .insert({
            client_id: clientId,
            client_name: client.company,
            created_by: currentUser.name,
          })
          .select('token')
          .single();
        if (error) throw error;
        token = newToken.token;
      }

      const baseOrigin = window.location.hostname.includes('lovableproject.com')
        ? APPROVAL_PUBLIC_ORIGIN
        : window.location.origin;
      const link = `${baseOrigin}/approve/${token}`;
      setApprovalLinks(prev => ({ ...prev, [clientId]: link }));
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência!");
    } catch (e: any) {
      toast.error("Erro ao gerar link: " + e.message);
    } finally {
      setGeneratingLink(null);
    }
  };

  const isCoordinator = currentUser?.role?.includes("Coordenação") || currentUser?.roles?.some(r => r.includes("Coordenação")) || currentUser?.isAdmin;

  const clientPostTracking = useMemo(() => {
    return socialClients.map(client => {
      const clientSocialTasks = socialTasks.filter(t => t.clientId === client.id);
      
      // Count from uploaded posts (client_posts table)
      const uploadedPosts = clientPosts.filter(p => p.client_id === client.id);
      const uploadedApproved = uploadedPosts.filter(p => p.approval_status === 'approved').length;
      const uploadedPending = uploadedPosts.filter(p => p.approval_status === 'pending').length;
      const uploadedRejected = uploadedPosts.filter(p => p.approval_status === 'rejected').length;
      
      // Count from tasks
      const taskPostsReady = clientSocialTasks.filter(t => t.type === "Aprovado" || t.type === "Publicado" || t.status === "done").length;
      const taskPostsAwaiting = clientSocialTasks.filter(t => t.type === "Aprovação" || t.status === "approval" || t.status === "waiting_client").length;
      const postsBeingMade = clientSocialTasks.filter(t =>
        t.status === "in_progress" || t.status === "backlog" || t.status === "pending"
      ).length;
      const postsPublished = clientSocialTasks.filter(t => t.type === "Publicado").length;
      
      // Merge: uploaded posts take priority
      const postsReady = taskPostsReady + uploadedApproved;
      const postsAwaitingApproval = taskPostsAwaiting + uploadedPending;
      const postsRejected = uploadedRejected;
      
      const totalPostsMonth = client.socialMediaPosts || 12;
      const remaining = totalPostsMonth - postsReady - postsPublished - postsBeingMade - postsAwaitingApproval;

      const designer = client.assignedTeam?.find(a => a.role.includes("Designer"))?.memberName || "—";
      const videomaker = client.assignedTeam?.find(a => a.role.includes("Videomaker"))?.memberName || "—";

      let daysUntilRenewal: number | null = null;
      if (client.paymentDueDay) {
        const today = new Date();
        let renewalDate = new Date(today.getFullYear(), today.getMonth(), client.paymentDueDay);
        if (renewalDate <= today) renewalDate = new Date(today.getFullYear(), today.getMonth() + 1, client.paymentDueDay);
        daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      return { clientId: client.id, clientName: client.company, totalPostsMonth, postsReady, postsAwaitingApproval, postsBeingMade, postsPublished, postsRejected, remaining, renewalDate: client.paymentDueDay ? `Dia ${client.paymentDueDay}` : "—", daysUntilRenewal, responsibleDesigner: designer, responsibleVideomaker: videomaker, uploadedTotal: uploadedPosts.length };
    });
  }, [socialClients, socialTasks, clientPosts]);

  const urgentClients = clientPostTracking.filter(c => {
    if (c.daysUntilRenewal !== null && c.daysUntilRenewal <= 10 && c.remaining > 0) return true;
    return c.remaining > 0 && (c.postsReady + c.postsPublished) < c.totalPostsMonth * 0.3;
  });
  const criticalClients = urgentClients.filter(c => c.daysUntilRenewal !== null && c.daysUntilRenewal <= 5);
  const warningClients = urgentClients.filter(c => !criticalClients.includes(c));

  const teamWorkload = useMemo(() => {
    const socialRoles = ["Social Media - Designer", "Social Media - Videomaker", "Social Media - Editor"];
    const socialTeam = team.filter(m => socialRoles.some(r => m.roles.includes(r)));
    return socialTeam.map(member => {
      const memberTasks = socialTasks.filter(t => t.assignee === member.name && t.status !== "done" && t.status !== "completed");
      return { ...member, activeSocialTasks: memberTasks.length };
    }).sort((a, b) => a.activeSocialTasks - b.activeSocialTasks);
  }, [team, socialTasks]);

  const totalPosts = clientPostTracking.reduce((s, c) => s + c.totalPostsMonth, 0);
  const totalReady = clientPostTracking.reduce((s, c) => s + c.postsReady, 0);
  const totalAwaiting = clientPostTracking.reduce((s, c) => s + c.postsAwaitingApproval, 0);
  const totalInProd = clientPostTracking.reduce((s, c) => s + c.postsBeingMade, 0);
  const totalRemaining = clientPostTracking.reduce((s, c) => s + Math.max(0, c.remaining), 0);

  const sections = [
    { key: "overview", label: "Visão Geral", icon: BarChart3 },
    { key: "report", label: "Relatório por Cliente", icon: BarChart3 },
    { key: "team", label: "Equipe & Distribuição", icon: Users },
    ...(isCoordinator ? [{ key: "approval_control", label: "Controle de Aprovação", icon: CheckCircle }] : []),
  ];

  const handleTogglePosted = async (postId: string, newPosted: boolean) => {
    await (supabase as any).from('client_posts').update({
      posted: newPosted,
      posted_at: newPosted ? new Date().toISOString() : null,
    }).eq('id', postId);
    loadClientPosts();
    toast.success(newPosted ? "Marcado como postado!" : "Desmarcado");
  };

  const [approvalControlFilter, setApprovalControlFilter] = useState<"all" | "approved" | "rejected" | "pending">("all");
  const [postedFilter, setPostedFilter] = useState<"all" | "posted" | "not_posted">("all");

  return (
    <div>
      <PageHeader title="Painel Social" description="Acompanhamento de produção de posts por cliente" />

      {/* Section Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {sections.map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeSection === s.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {/* ===== SECTION: Visão Geral ===== */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{totalPosts}</p>
              <p className="text-xs text-muted-foreground">Contratados</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-success">{totalReady}</p>
              <p className="text-xs text-muted-foreground">Prontos</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-warning">{totalAwaiting}</p>
              <p className="text-xs text-muted-foreground">Aguard. Aprovação</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalInProd}</p>
              <p className="text-xs text-muted-foreground">Em Produção</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className={`text-2xl font-bold ${totalRemaining > 0 ? "text-destructive" : "text-success"}`}>{totalRemaining}</p>
              <p className="text-xs text-muted-foreground">Faltam</p>
            </div>
          </div>

          {/* Two-column: Alerts + Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Alerts Column */}
            <div className="space-y-4">
              {criticalClients.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <h3 className="text-sm font-semibold text-destructive">🚨 Críticos (≤ 5 dias)</h3>
                  </div>
                  <div className="space-y-2">
                    {criticalClients.map(c => (
                      <div key={c.clientId} className="flex items-center justify-between text-xs p-2 rounded bg-card border border-destructive/20 cursor-pointer hover:bg-muted/20" onClick={() => setSelectedClientId(c.clientId)}>
                        <span className="font-medium text-foreground">{c.clientName}</span>
                        <span className="text-destructive">{c.remaining} faltam · {c.daysUntilRenewal}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {warningClients.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <h3 className="text-sm font-semibold text-warning">⚠️ Atenção</h3>
                  </div>
                  <div className="space-y-2">
                    {warningClients.map(c => (
                      <div key={c.clientId} className="flex items-center justify-between text-xs p-2 rounded bg-card border cursor-pointer hover:bg-muted/20" onClick={() => setSelectedClientId(c.clientId)}>
                        <span className="font-medium text-foreground">{c.clientName}</span>
                        <span className="text-warning">{c.remaining} faltam · {c.daysUntilRenewal !== null ? `${c.daysUntilRenewal}d` : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {criticalClients.length === 0 && warningClients.length === 0 && (
                <div className="rounded-lg border bg-success/5 p-6 text-center">
                  <p className="text-sm text-success font-medium">✅ Nenhum alerta de urgência</p>
                  <p className="text-xs text-muted-foreground mt-1">Todos os clientes estão em dia</p>
                </div>
              )}
            </div>

            {/* Quick client list with progress */}
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">Progresso por Cliente</h3>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {clientPostTracking.map(c => {
                  const pct = c.totalPostsMonth > 0 ? Math.round(((c.postsReady + c.postsPublished) / c.totalPostsMonth) * 100) : 0;
                  const isCritical = c.daysUntilRenewal !== null && c.daysUntilRenewal <= 5 && c.remaining > 0;
                  const uploadedCount = clientPosts.filter(p => p.client_id === c.clientId).length;
                  return (
                    <div key={c.clientId} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 hover:bg-muted/20">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedClientId(c.clientId)}>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{c.clientName}</p>
                          {isCritical && <span className="text-[9px] text-destructive">🚨</span>}
                          {uploadedCount > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">{uploadedCount} 📎</span>
                          )}
                          {c.postsRejected > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-mono">{c.postsRejected} ✗</span>
                          )}
                        </div>
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 80 ? "bg-success" : pct >= 50 ? "bg-primary" : pct >= 30 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-xs font-mono font-bold text-foreground">{pct}%</p>
                        <p className="text-[9px] text-muted-foreground">{c.postsReady + c.postsPublished}/{c.totalPostsMonth}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickUploadClientId(c.clientId);
                          fileInputRef.current?.click();
                        }}
                        className="p-1.5 rounded-md hover:bg-primary/10 transition-colors flex-shrink-0"
                        title={`Subir post para ${c.clientName}`}
                        disabled={uploading}
                      >
                        <Upload className={`w-4 h-4 ${uploading && quickUploadClientId === c.clientId ? "animate-pulse text-primary" : "text-muted-foreground hover:text-primary"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && quickUploadClientId) {
                    handleFileUpload(e.target.files, quickUploadClientId);
                  }
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION: Relatório por Cliente ===== */}
      {activeSection === "report" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Relatório Detalhado de Posts</h3>
            </div>
            <div className="flex items-center gap-1">
              {([
                { key: "all", label: "Todos" },
                { key: "pending", label: "Com Pendências" },
                { key: "complete", label: "Completos" },
                { key: "rejected", label: "Com Rejeitados" },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setReportFilter(f.key)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${reportFilter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                  <th className="text-left py-2.5 px-4 font-medium">Cliente</th>
                  <th className="text-center py-2.5 px-2 font-medium">Contratados</th>
                  <th className="text-center py-2.5 px-2 font-medium">Prontos</th>
                  <th className="text-center py-2.5 px-2 font-medium">Aguard. Aprov.</th>
                  <th className="text-center py-2.5 px-2 font-medium">Em Produção</th>
                  <th className="text-center py-2.5 px-2 font-medium">Publicados</th>
                  <th className="text-center py-2.5 px-2 font-medium text-destructive">Rejeitados</th>
                  <th className="text-center py-2.5 px-2 font-medium">Restantes</th>
                  <th className="text-center py-2.5 px-2 font-medium">Renovação</th>
                  <th className="text-left py-2.5 px-3 font-medium">Designer</th>
                  <th className="text-left py-2.5 px-3 font-medium">Videomaker</th>
                  <th className="text-center py-2.5 px-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientPostTracking.filter(c => {
                  if (reportFilter === "pending") return c.remaining > 0 || c.postsAwaitingApproval > 0;
                  if (reportFilter === "complete") return c.remaining <= 0;
                  if (reportFilter === "rejected") return c.postsRejected > 0;
                  return true;
                }).map(c => {
                  const isLow = c.remaining > 0 && (c.postsReady + c.postsPublished) < c.totalPostsMonth * 0.3;
                  const isCritical = c.daysUntilRenewal !== null && c.daysUntilRenewal <= 5 && c.remaining > 0;
                  const isWarning = c.daysUntilRenewal !== null && c.daysUntilRenewal <= 10 && c.remaining > 0;
                  return (
                    <tr key={c.clientId} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${isCritical ? "bg-destructive/5" : isWarning ? "bg-warning/5" : isLow ? "bg-destructive/5" : ""}`}>
                      <td className="py-2.5 px-4 text-sm font-medium text-foreground">
                        {c.clientName}
                        {isCritical && <span className="ml-1 text-[9px]">🚨</span>}
                        {isWarning && !isCritical && <span className="ml-1 text-[9px]">⚠️</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center text-sm font-mono text-foreground">{c.totalPostsMonth}</td>
                      <td className="py-2.5 px-2 text-center"><span className="text-sm font-mono font-bold text-success">{c.postsReady}</span></td>
                      <td className="py-2.5 px-2 text-center"><span className="text-sm font-mono text-warning">{c.postsAwaitingApproval}</span></td>
                      <td className="py-2.5 px-2 text-center"><span className="text-sm font-mono text-primary">{c.postsBeingMade}</span></td>
                      <td className="py-2.5 px-2 text-center"><span className="text-sm font-mono text-muted-foreground">{c.postsPublished}</span></td>
                      <td className="py-2.5 px-2 text-center"><span className={`text-sm font-mono ${c.postsRejected > 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>{c.postsRejected}</span></td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`text-sm font-mono font-bold ${c.remaining <= 0 ? "text-success" : isLow ? "text-destructive" : "text-foreground"}`}>
                          {c.remaining <= 0 ? "✓" : c.remaining}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {c.daysUntilRenewal !== null ? (
                          <span className={`text-sm font-mono ${c.daysUntilRenewal <= 5 ? "text-destructive font-bold" : c.daysUntilRenewal <= 10 ? "text-warning font-bold" : "text-foreground"}`}>
                            {c.daysUntilRenewal}d
                          </span>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{c.responsibleDesigner}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{c.responsibleVideomaker}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSelectedClientId(c.clientId)} className="p-1 rounded hover:bg-muted transition-colors" title="Ver detalhes">
                            <Eye className="w-3.5 h-3.5 text-primary" />
                          </button>
                          {isCoordinator && (
                            <>
                              <button onClick={() => { setUploadClientId(c.clientId); setShowUploadModal(true); }} className="p-1 rounded hover:bg-muted transition-colors" title="Enviar post">
                                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => generateApprovalLink(c.clientId)}
                                disabled={generatingLink === c.clientId}
                                className="p-1 rounded hover:bg-muted transition-colors" title="Gerar link de aprovação"
                              >
                                {generatingLink === c.clientId ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Link2 className="w-3.5 h-3.5 text-primary" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {clientPostTracking.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente com Social Media ativo.</p>}
          </div>
        </div>
      )}

      {/* ===== SECTION: Equipe & Distribuição ===== */}
      {activeSection === "team" && (
        <div className="space-y-6">
          {isCoordinator && (
            <div className="flex justify-end">
              <button onClick={() => setShowHelpModal(true)} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                <HandHelping className="w-4 h-4" /> Pedir Ajuda / Redistribuir
              </button>
            </div>
          )}

          {/* Team Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamWorkload.map(member => {
              const loadPercent = member.capacity > 0 ? Math.round((member.activeSocialTasks / member.capacity) * 100) : 0;
              const memberClientsCount = socialClients.filter(c =>
                c.assignedTeam?.some(a => a.memberId === member.id)
              ).length;
              const isOverloaded = member.activeSocialTasks > 8;
              const isBusy = member.activeSocialTasks > 5;

              return (
                <div key={member.id} className={`rounded-lg border p-4 ${isOverloaded ? "border-destructive/30 bg-destructive/5" : isBusy ? "border-warning/30 bg-warning/5" : "bg-card"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                    {isOverloaded && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Sobrecarregado</span>}
                    {isBusy && !isOverloaded && <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning">Ocupado</span>}
                    {!isBusy && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success">Disponível</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center p-2 rounded bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{member.activeSocialTasks}</p>
                      <p className="text-[9px] text-muted-foreground">Tarefas ativas</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{memberClientsCount}</p>
                      <p className="text-[9px] text-muted-foreground">Clientes</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Ocupação</span>
                      <span className="font-mono">{loadPercent}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${loadPercent > 80 ? "bg-destructive" : loadPercent > 50 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(loadPercent, 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Suggestion */}
          {teamWorkload.length > 1 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary">💡 Sugestão de Redistribuição</h3>
              </div>
              <p className="text-xs text-foreground">
                <span className="font-semibold">{teamWorkload[teamWorkload.length - 1]?.name}</span> tem mais tarefas ({teamWorkload[teamWorkload.length - 1]?.activeSocialTasks}).
                Considere redistribuir para <span className="font-semibold">{teamWorkload[0]?.name}</span> ({teamWorkload[0]?.activeSocialTasks} tarefas) que está com menor carga.
              </p>
            </div>
          )}

          {teamWorkload.length === 0 && (
            <div className="rounded-lg border bg-card p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum membro da equipe de Social Media encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* ===== SECTION: Controle de Aprovação (Karen) ===== */}
      {activeSection === "approval_control" && isCoordinator && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-success">{clientPosts.filter(p => p.approval_status === 'approved').length}</p>
              <p className="text-xs text-muted-foreground">Aprovados</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{clientPosts.filter(p => p.approval_status === 'rejected').length}</p>
              <p className="text-xs text-muted-foreground">Rejeitados</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-warning">{clientPosts.filter(p => p.approval_status === 'pending').length}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <div className="rounded-lg border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">{clientPosts.filter(p => p.posted).length}</p>
              <p className="text-xs text-muted-foreground">Já Postados</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {([
                { key: "all", label: "Todos" },
                { key: "approved", label: "✅ Aprovados" },
                { key: "rejected", label: "❌ Rejeitados" },
                { key: "pending", label: "⏳ Pendentes" },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setApprovalControlFilter(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${approvalControlFilter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="border-l mx-1" />
            <div className="flex gap-1">
              {([
                { key: "all", label: "Todos" },
                { key: "posted", label: "📤 Postados" },
                { key: "not_posted", label: "📥 Não Postados" },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setPostedFilter(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${postedFilter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Posts table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                    <th className="text-left py-2.5 px-4 font-medium">Arquivo</th>
                    <th className="text-left py-2.5 px-3 font-medium">Cliente</th>
                    <th className="text-center py-2.5 px-3 font-medium">Aprovação</th>
                    <th className="text-center py-2.5 px-3 font-medium">Postado</th>
                    <th className="text-left py-2.5 px-3 font-medium">Motivo Rejeição</th>
                    <th className="text-left py-2.5 px-3 font-medium">Enviado por</th>
                    <th className="text-left py-2.5 px-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {clientPosts
                    .filter(p => {
                      if (approvalControlFilter !== "all" && p.approval_status !== approvalControlFilter) return false;
                      if (postedFilter === "posted" && !p.posted) return false;
                      if (postedFilter === "not_posted" && p.posted) return false;
                      return true;
                    })
                    .map((post: any) => {
                      const approvalLabel = post.approval_status === 'approved' ? 'Aprovado' : post.approval_status === 'rejected' ? 'Rejeitado' : 'Pendente';
                      const approvalColor = post.approval_status === 'approved' ? 'text-success' : post.approval_status === 'rejected' ? 'text-destructive' : 'text-warning';
                      return (
                        <tr key={post.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${post.approval_status === 'rejected' ? 'bg-destructive/5' : ''}`}>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {post.file_type === 'image' ? (
                                <img src={post.file_url} alt={post.file_name} className="w-10 h-10 rounded object-cover border" />
                              ) : (
                                <div className="w-10 h-10 rounded border flex items-center justify-center bg-muted">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-foreground truncate max-w-[150px]">{post.file_name}</p>
                                <p className="text-[9px] text-muted-foreground">{post.file_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-foreground">{post.client_name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-xs font-medium ${approvalColor}`}>
                              {approvalLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleTogglePosted(post.id, !post.posted)}
                              className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors ${
                                post.posted
                                  ? "bg-success/15 text-success hover:bg-success/25"
                                  : "bg-muted text-muted-foreground hover:bg-warning/15 hover:text-warning"
                              }`}
                            >
                              {post.posted ? "✅ Postado" : "📥 Não Postado"}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                            {post.rejection_reason || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{post.uploaded_by}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {new Date(post.uploaded_at).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {clientPosts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum post enviado ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClientId && (() => {
        const client = clients.find(c => c.id === selectedClientId);
        const tracking = clientPostTracking.find(c => c.clientId === selectedClientId);
        const clientTasks = socialTasks.filter(t => t.clientId === selectedClientId);
        const clientReqs = requests.filter(r => r.clientId === selectedClientId && r.department === "social_media");
        if (!client || !tracking) return null;

        const socialMembers = (client.assignedTeam || []).filter(a =>
          a.role.includes("Designer") || a.role.includes("Videomaker") || a.role.includes("Editor") || a.role.includes("Social Media")
        );

        return (
          <Modal open={!!selectedClientId} onClose={() => setSelectedClientId(null)} title={`${client.company} - Detalhes`}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 rounded-md border bg-success/5 text-center">
                  <p className="text-lg font-bold text-success">{tracking.postsReady}</p>
                  <p className="text-[10px] text-muted-foreground">Prontos</p>
                </div>
                <div className="p-3 rounded-md border bg-warning/5 text-center">
                  <p className="text-lg font-bold text-warning">{tracking.postsAwaitingApproval}</p>
                  <p className="text-[10px] text-muted-foreground">Aguardando</p>
                </div>
                <div className="p-3 rounded-md border bg-primary/5 text-center">
                  <p className="text-lg font-bold text-primary">{tracking.postsBeingMade}</p>
                  <p className="text-[10px] text-muted-foreground">Em Produção</p>
                </div>
                <div className="p-3 rounded-md border text-center">
                  <p className="text-lg font-bold text-foreground">{tracking.remaining}</p>
                  <p className="text-[10px] text-muted-foreground">Faltam</p>
                </div>
              </div>

              {tracking.daysUntilRenewal !== null && (
                <div className={`p-3 rounded-md border ${tracking.daysUntilRenewal <= 5 ? "border-destructive/30 bg-destructive/5" : tracking.daysUntilRenewal <= 10 ? "border-warning/30 bg-warning/5" : "bg-muted/30"}`}>
                  <p className="text-xs text-foreground">📅 <span className="font-semibold">{tracking.daysUntilRenewal} dias</span> até renovação ({tracking.renewalDate})</p>
                </div>
              )}

              {socialMembers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Equipe</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {socialMembers.map(member => {
                      const memberAllTasks = tasks.filter(t => t.assignee === member.memberName && t.status !== "done" && t.status !== "completed");
                      const capacity = team.find(m => m.id === member.memberId)?.capacity || 10;
                      const loadPercent = Math.round((memberAllTasks.length / capacity) * 100);
                      return (
                        <div key={member.memberId} className="p-2 rounded-md border bg-muted/30">
                          <p className="text-xs font-medium text-foreground">{member.memberName}</p>
                          <p className="text-[10px] text-muted-foreground">{member.role}</p>
                          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${loadPercent > 80 ? "bg-destructive" : loadPercent > 50 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(loadPercent, 100)}%` }} />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{loadPercent}% · {memberAllTasks.length} tarefas</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {clientReqs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-foreground mb-2">Requisições</h4>
                  {clientReqs.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-2 rounded-md border text-xs mb-1">
                      <span className="text-foreground">{req.title}</span>
                      <StatusBadge status={req.status} />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">Tarefas ({clientTasks.length})</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {clientTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-md border text-xs">
                      <div>
                        <p className="text-foreground font-medium">{t.title}</p>
                        <p className="text-muted-foreground">{t.assignee} · {t.deadline}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                  {clientTasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tarefa</p>}
                </div>
              </div>

              {/* Uploaded Posts */}
              {(() => {
                const posts = clientPosts.filter(p => p.client_id === selectedClientId);
                if (posts.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-2">Posts Enviados ({posts.length})</h4>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {posts.map((post: any) => {
                        const approvalLabel = post.approval_status === 'approved' ? 'Aprovado' : post.approval_status === 'rejected' ? 'Rejeitado' : 'Pendente';
                        const approvalColor = post.approval_status === 'approved' ? 'bg-green-500/90 text-white' : post.approval_status === 'rejected' ? 'bg-destructive/90 text-destructive-foreground' : 'bg-yellow-500/90 text-white';
                        return (
                        <div key={post.id} className="relative group rounded-md border overflow-hidden bg-muted/30">
                          {post.file_type === 'image' ? (
                            <img src={post.file_url} alt={post.file_name} className="w-full h-20 object-cover" />
                          ) : (
                            <div className="w-full h-20 flex items-center justify-center bg-muted">
                              <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-semibold ${approvalColor}`}>{approvalLabel}</span>
                          <div className="px-1.5 py-1">
                            <p className="text-[9px] text-foreground truncate">{post.file_name}</p>
                            <p className="text-[8px] text-muted-foreground">{post.uploaded_by}</p>
                            {post.approval_status === 'rejected' && post.rejection_reason && (
                              <p className="text-[8px] text-destructive truncate" title={post.rejection_reason}>⚠ {post.rejection_reason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeletePost(post.id, post.file_url)}
                            className="absolute top-1 right-1 p-0.5 rounded bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {isCoordinator && (
                <div className="space-y-2">
                  <button
                    onClick={() => generateApprovalLink(selectedClientId!)}
                    disabled={generatingLink === selectedClientId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium"
                  >
                    {generatingLink === selectedClientId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Gerar Link de Aprovação
                  </button>
                  {approvalLinks[selectedClientId!] && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                      <input
                        readOnly
                        value={approvalLinks[selectedClientId!]}
                        className="flex-1 text-xs bg-transparent text-foreground outline-none truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(approvalLinks[selectedClientId!]);
                          toast.success("Link copiado!");
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <a
                        href={approvalLinks[selectedClientId!]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Upload Modal */}
      <Modal open={showUploadModal} onClose={() => { setShowUploadModal(false); setUploadClientId(null); }} title="Enviar Post para Aprovação">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
            <select value={uploadClientId || ""} onChange={(e) => setUploadClientId(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {socialClients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Arquivo</label>
            <div className="border-2 border-dashed rounded-md p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Clique ou arraste para enviar</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowUploadModal(false); setUploadClientId(null); }} className="px-4 py-2 text-sm rounded-md border text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={() => { toast.success("Post enviado!"); setShowUploadModal(false); setUploadClientId(null); }} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Enviar</button>
          </div>
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal open={showHelpModal} onClose={() => setShowHelpModal(false)} title="Pedir Ajuda - Redistribuição">
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Solicite ajuda para redistribuir tarefas quando a demanda estiver alta.</p>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
            <select value={helpRequest.clientId} onChange={(e) => setHelpRequest(p => ({ ...p, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {socialClients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Mensagem</label>
            <textarea value={helpRequest.message} onChange={(e) => setHelpRequest(p => ({ ...p, message: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground min-h-[80px]" placeholder="Descreva a situação..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowHelpModal(false)} className="px-4 py-2 text-sm rounded-md border text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={() => { toast.success("Solicitação enviada!"); setShowHelpModal(false); setHelpRequest({ clientId: "", message: "" }); }} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Enviar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
