import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, TrendingUp, Users, ArrowRight, Trash2, Film, Paperclip, Link, X, Pencil, Eye } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore, type InternalRequest } from "@/store/useAppStore";
import { toast } from "sonner";

const departmentLabels: Record<string, string> = {
  social_media: "Social Media",
  gestao_trafego: "Gestão de Tráfego",
  producao: "Produção",
  financeiro: "Financeiro",
  operacional: "Operacional",
  tech: "Tecnologia",
  geral: "Geral",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em Andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  redistributed: "Redistribuída",
};

export default function RequestsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const users = useAuthStore((s) => s.users);
  const { requests, clients, addRequest, updateRequest, deleteRequest, redistributeRequest, getProductivity, getWorkloadSuggestion, tasks, team } = useAppStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRecordingDialogOpen, setIsRecordingDialogOpen] = useState(false);
  const [redistributeDialog, setRedistributeDialog] = useState<string | null>(null);
  const [redistributeTo, setRedistributeTo] = useState("");
  const [recordingForm, setRecordingForm] = useState({
    clientId: "", date: "", time: "", videomaker: "", notes: "", roteiro: "", roteiroSent: false,
  });
  const [filter, setFilter] = useState<"all" | "mine" | "sent" | "completed">("all");
  const [viewingRequest, setViewingRequest] = useState<InternalRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<InternalRequest | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", description: "", assignedTo: "", department: "", priority: "normal" as InternalRequest["priority"],
    dueDate: "", attachments: [] as string[], newAttachment: "",
    deliveryLinks: [] as string[], newDeliveryLink: "",
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedTo: "",
    clientId: "",
    department: "",
    priority: "normal" as InternalRequest["priority"],
    dueDate: "",
    attachments: [] as string[],
    newAttachment: "",
  });

  const isAdmin = currentUser?.isAdmin || false;
  const isGerente = currentUser?.roles?.some(r => r.includes("Gerente Operacional")) || false;
  const hasSectorVisibility = (currentUser?.sectorVisibility || []).length > 0;
  const canSeeAll = isAdmin || isGerente;

  const myClientIds = canSeeAll
    ? clients.map(c => c.id)
    : clients.filter(c => c.assignedTeam?.some(a => a.memberName === currentUser?.name)).map(c => c.id);

  // Selected client's assigned team
  const selectedClient = formData.clientId ? clients.find(c => c.id === formData.clientId) : null;
  const gerenteUsers = users.filter(u => u.roles?.some(r => r.includes("Gerente Operacional")));
  const manualClientTeam = selectedClient?.assignedTeam || [];
  const autoGerentes = gerenteUsers
    .filter(g => !manualClientTeam.some(a => a.memberId === g.id))
    .map(g => ({ memberId: g.id, memberName: g.name, role: "Gerente Operacional" }));
  const clientTeam = [...autoGerentes, ...manualClientTeam];

  const handleCreateRequest = () => {
    const assignedUser = users.find((u) => u.name === formData.assignedTo);
    if (!assignedUser) return;

    const client = clients.find(c => c.id === formData.clientId);
    const newRequest: InternalRequest = {
      id: `req-${Date.now()}`,
      title: formData.title,
      description: formData.description,
      requesterId: currentUser?.id || "",
      requesterName: currentUser?.name || "",
      assignedToName: formData.assignedTo,
      assignedToId: assignedUser.id,
      clientId: formData.clientId || undefined,
      clientName: client?.company || undefined,
      department: formData.department,
      priority: formData.priority,
      status: "pending",
      createdAt: new Date().toISOString(),
      dueDate: formData.dueDate || undefined,
      attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
    };

    addRequest(newRequest);
    toast.success(`Requisição criada e tarefa enviada para ${formData.assignedTo}`);
    setIsDialogOpen(false);
    setFormData({ title: "", description: "", assignedTo: "", clientId: "", department: "", priority: "normal", dueDate: "", attachments: [], newAttachment: "" });
  };

  const handleStatusChange = (requestId: string, newStatus: InternalRequest["status"]) => {
    updateRequest(requestId, { status: newStatus });
    toast.success("Status atualizado");
  };

  const handleRedistribute = () => {
    if (!redistributeDialog || !redistributeTo) return;
    const targetUser = users.find((u) => u.name === redistributeTo);
    if (!targetUser) return;
    redistributeRequest(redistributeDialog, targetUser.id, targetUser.name, currentUser?.name || "");
    toast.success(`Requisição redistribuída para ${redistributeTo}`);
    setRedistributeDialog(null);
    setRedistributeTo("");
  };

  const SECTOR_DEPARTMENTS: Record<string, string[]> = {
    "traffic": ["Tráfego", "Tráfego Pago"],
    "social": ["Social Media"],
    "production": ["Produção"],
    "tech": ["Tech", "Suporte", "Tech / Sites"],
    "inside-sales": ["Inside Sales"],
    "onboarding": ["Onboarding"],
    "financial": ["Financeiro"],
  };

  const visibleRequests = requests.filter((r) => {
    if (!canSeeAll) {
      const isMyRequest = r.assignedToName === currentUser?.name || r.requesterName === currentUser?.name;
      const isMyClientRequest = r.clientId ? myClientIds.includes(r.clientId) : false;
      const isMySectorRequest = hasSectorVisibility && (currentUser?.sectorVisibility || []).some(sector => {
        const depts = SECTOR_DEPARTMENTS[sector] || [];
        return depts.some(d => r.department?.toLowerCase().includes(d.toLowerCase()));
      });
      if (!isMyRequest && !isMyClientRequest && !isMySectorRequest) return false;
    }
    return true;
  });

  const filteredRequests = visibleRequests.filter((r) => {
    if (filter === "completed") return r.status === "completed";
    if (r.status === "completed") return false;
    if (filter === "mine") return r.assignedToName === currentUser?.name;
    if (filter === "sent") return r.requesterName === currentUser?.name;
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-4 h-4 text-warning" />;
      case "in_progress": return <AlertCircle className="w-4 h-4 text-primary" />;
      case "completed": return <CheckCircle className="w-4 h-4 text-success" />;
      case "cancelled": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <ArrowRight className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case "low": return "bg-success/10 text-success border-success/20";
      case "normal": return "bg-primary/10 text-primary border-primary/20";
      case "high": return "bg-warning/10 text-warning border-warning/20";
      case "urgent": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  // Workload suggestion for selected department
  const suggestions = formData.department ? getWorkloadSuggestion(formData.department) : [];

  // Selected user workload info
  const selectedUserProd = formData.assignedTo ? getProductivity(formData.assignedTo) : null;
  const selectedUserPendingTasks = formData.assignedTo
    ? tasks.filter((t) => t.assignee === formData.assignedTo && t.status !== "done").length
    : 0;

  return (
    <div>
      <PageHeader title="Requisições" description="Solicite demandas para qualquer colaborador ou setor">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsRecordingDialogOpen(true)}>
            <Film className="w-4 h-4" /> Solicitar Gravação
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4" /> Nova Requisição</Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Nova Requisição</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Descreva brevemente a solicitação" />
              </div>
              {/* Client selector */}
              <div>
                <Label>Cliente</Label>
                <Select value={formData.clientId} onValueChange={(v) => setFormData({ ...formData, clientId: v, assignedTo: "" })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.filter(c => canSeeAll || myClientIds.includes(c.id)).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company} {c.assignedTeam && c.assignedTeam.length > 0 ? `(${c.assignedTeam.length} membros)` : "(sem equipe)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show client team when client is selected */}
              {selectedClient && clientTeam.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <Users className="w-3.5 h-3.5" />
                    Equipe designada para {selectedClient.company}
                  </div>
                  <div className="space-y-1">
                    {clientTeam.map((member) => {
                      const pendingCount = tasks.filter((t) => t.assignee === member.memberName && t.status !== "done").length;
                      return (
                        <button
                          key={member.memberId}
                          type="button"
                          onClick={() => setFormData({ ...formData, assignedTo: member.memberName })}
                          className={`w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${formData.assignedTo === member.memberName ? "bg-primary/20 text-primary" : "hover:bg-muted text-foreground"}`}
                        >
                          <span className="font-medium">{member.memberName}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{member.role}</span>
                            <span className="text-muted-foreground">{pendingCount} pendentes</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedClient && clientTeam.length === 0 && (
                <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  Este cliente não tem equipe designada. Peça ao Gerente Operacional para designar.
                </div>
              )}

              <div>
                <Label>Departamento</Label>
                <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(departmentLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Atribuir para</Label>
                <Select value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                  <SelectTrigger><SelectValue placeholder={formData.clientId ? "Selecione da equipe ou outro" : "Selecione um colaborador"} /></SelectTrigger>
                  <SelectContent>
                    {/* If client selected, show client team first */}
                    {clientTeam.length > 0 && (
                      <>
                        {clientTeam.map((member) => {
                          const pendingCount = tasks.filter((t) => t.assignee === member.memberName && t.status !== "done").length;
                          return (
                            <SelectItem key={`team-${member.memberId}`} value={member.memberName}>
                              ★ {member.memberName} ({member.role}) — {pendingCount} tarefas
                            </SelectItem>
                          );
                        })}
                      </>
                    )}
                    {/* Then show all other users */}
                    {users.filter((u) => u.active && u.id !== currentUser?.id && !clientTeam.some(ct => ct.memberName === u.name)).map((user) => {
                      const pendingCount = tasks.filter((t) => t.assignee === user.name && t.status !== "done").length;
                      return (
                        <SelectItem key={user.id} value={user.name}>
                          {user.name} {user.role ? `(${user.role})` : ""} — {pendingCount} tarefas
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected user workload warning */}
              {formData.assignedTo && selectedUserPendingTasks > 8 && (
                <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{formData.assignedTo}</strong> tem {selectedUserPendingTasks} tarefas pendentes
                    {selectedUserProd && selectedUserProd.avgTasksPerDay > 0 && (
                      <> (média: {selectedUserProd.avgTasksPerDay} tarefas/dia, previsão: ~{Math.ceil(selectedUserPendingTasks / selectedUserProd.avgTasksPerDay)} dias para limpar fila)</>
                    )}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as InternalRequest["priority"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo</Label>
                  <DatePicker value={formData.dueDate} onChange={(v) => setFormData({ ...formData, dueDate: v })} placeholder="Selecionar prazo" />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Links / Documentos</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={formData.newAttachment}
                    onChange={(e) => setFormData({ ...formData, newAttachment: e.target.value })}
                    placeholder="Cole um link (URL, Google Drive, etc.)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && formData.newAttachment.trim()) {
                        e.preventDefault();
                        setFormData(f => ({ ...f, attachments: [...f.attachments, f.newAttachment.trim()], newAttachment: "" }));
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (formData.newAttachment.trim()) {
                        setFormData(f => ({ ...f, attachments: [...f.attachments, f.newAttachment.trim()], newAttachment: "" }));
                      }
                    }}
                    disabled={!formData.newAttachment.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {formData.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.attachments.map((link, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary max-w-[250px]">
                        <Link className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{link}</span>
                        <button onClick={() => setFormData(f => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))} className="hover:text-destructive flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateRequest} disabled={!formData.title || !formData.assignedTo || !formData.department}>
                  Criar Requisição
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(["all", "mine", "sent", "completed"] as const).map((f) => {
          const active = visibleRequests.filter(r => r.status !== "completed");
          const label = f === "all" ? "Todas" : f === "mine" ? "Para mim" : f === "sent" ? "Enviadas por mim" : "Concluídas";
          const count = f === "completed"
            ? visibleRequests.filter(r => r.status === "completed").length
            : f === "mine"
            ? active.filter(r => r.assignedToName === currentUser?.name).length
            : f === "sent"
            ? active.filter(r => r.requesterName === currentUser?.name).length
            : active.length;
          const hasPending = f === "mine" && active.filter(r => r.assignedToName === currentUser?.name && r.status === "pending").length > 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? (f === "completed" ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground") : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${filter === f ? "bg-primary-foreground/20" : hasPending ? "bg-destructive text-destructive-foreground" : "bg-muted-foreground/20"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma requisição encontrada.</p>
            <p className="text-sm text-muted-foreground mt-1">Crie uma nova para solicitar demandas.</p>
          </div>
        )}

        {filteredRequests.map((request) => {
          const isAssignedToMe = request.assignedToName === currentUser?.name;
          const isCoordinator = currentUser?.roles?.some((r) => r.includes("Coordenação")) || currentUser?.isAdmin;

          const canEdit = (request.requesterName === currentUser?.name || currentUser?.isAdmin) && request.status !== "completed";

          return (
            <div
              key={request.id}
              className={`rounded-lg border bg-card p-5 transition-colors cursor-pointer ${request.status === "pending" && isAssignedToMe ? "border-warning/40 bg-warning/5" : "hover:border-primary/30"}`}
              onClick={() => setViewingRequest(request)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusIcon(request.status)}
                    <h3 className="font-medium text-foreground">{request.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getPriorityClasses(request.priority)}`}>
                      {priorityLabels[request.priority]}
                    </span>
                    {request.status === "pending" && isAssignedToMe && (
                      <Badge variant="destructive" className="text-[10px] animate-pulse">Nova!</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>De: <strong>{request.requesterName}</strong></span>
                    <span>Para: <strong>{request.assignedToName}</strong></span>
                    {request.clientName && (
                      <span className="text-primary font-medium">📋 {request.clientName}</span>
                    )}
                    <span>{departmentLabels[request.department] || request.department}</span>
                    <span>{new Date(request.createdAt).toLocaleDateString("pt-BR")} {new Date(request.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {request.dueDate && (
                      <span>Prazo: <strong>{new Date(request.dueDate).toLocaleDateString("pt-BR")}</strong></span>
                    )}
                    {request.redistributedBy && (
                      <span className="text-primary">Redistribuída por {request.redistributedBy}</span>
                    )}
                  </div>
                  {request.attachments && request.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {request.attachments.map((link, i) => (
                        <a key={i} href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors max-w-[300px]">
                          <Link className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{link}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => {
                      deleteRequest(request.id);
                      toast.success("Requisição excluída");
                    }}>
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                      setEditingRequest(request);
                      setEditForm({
                        title: request.title,
                        description: request.description || "",
                        assignedTo: request.assignedToName,
                        department: request.department,
                        priority: request.priority,
                        dueDate: request.dueDate ? request.dueDate.slice(0, 10) : "",
                        attachments: request.attachments || [],
                        newAttachment: "",
                        deliveryLinks: request.deliveryLinks || [],
                        newDeliveryLink: "",
                      });
                    }}>
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                  )}
                  {((isCoordinator && request.status === "pending") || (isAssignedToMe && (request.status === "pending" || request.status === "in_progress"))) && (
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setRedistributeDialog(request.id); setRedistributeTo(""); }}>
                      <Users className="w-3 h-3 mr-1" /> Redistribuir
                    </Button>
                  )}
                  {isAssignedToMe && request.status === "pending" && (
                    <Button size="sm" className="text-xs" onClick={() => handleStatusChange(request.id, "in_progress")}>
                      Aceitar
                    </Button>
                  )}
                  {isAssignedToMe && request.status === "in_progress" && (
                    <Button size="sm" className="text-xs" variant="outline" onClick={() => handleStatusChange(request.id, "completed")}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Concluir
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Redistribute dialog */}
      <Dialog open={!!redistributeDialog} onOpenChange={(open) => !open && setRedistributeDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redistribuir Requisição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">O sistema sugere colaboradores com menor carga de trabalho:</p>
            {(() => {
              const req = requests.find((r) => r.id === redistributeDialog);
              const dept = req?.department || "";
              const sugg = getWorkloadSuggestion(dept);
              return (
                <div className="space-y-1">
                  {sugg.slice(0, 5).map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setRedistributeTo(s.name)}
                      className={`w-full flex items-center justify-between text-sm px-3 py-2 rounded-lg transition-colors ${redistributeTo === s.name ? "bg-primary/20 text-primary border border-primary/30" : "hover:bg-muted border border-transparent"}`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{s.pendingTasks} pendentes</span>
                        <span>{s.avgPerDay || "—"}/dia</span>
                        {s.pendingTasks > 10 && <AlertTriangle className="w-3 h-3 text-destructive" />}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
            <div>
              <Label>Ou selecione manualmente</Label>
              <Select value={redistributeTo} onValueChange={setRedistributeTo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {users.filter((u) => u.active).map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRedistributeDialog(null)}>Cancelar</Button>
              <Button onClick={handleRedistribute} disabled={!redistributeTo}>Redistribuir</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recording Request Dialog */}
      <Dialog open={isRecordingDialogOpen} onOpenChange={setIsRecordingDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar Gravação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
              ⚠️ Solicitações de gravação serão enviadas para <strong>Karen (Coordenação)</strong> para aprovação antes de serem agendadas.
            </p>
            <div>
              <Label>Cliente *</Label>
              <Select value={recordingForm.clientId} onValueChange={(v) => setRecordingForm(f => ({ ...f, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.filter(c => canSeeAll || myClientIds.includes(c.id)).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <DatePicker value={recordingForm.date} onChange={(v) => setRecordingForm(f => ({ ...f, date: v }))} placeholder="Selecionar data" />
              </div>
              <div>
                <Label>Horário</Label>
                <Select value={recordingForm.time} onValueChange={(v) => setRecordingForm(f => ({ ...f, time: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00"].map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Videomaker (sugestão)</Label>
              <Select value={recordingForm.videomaker} onValueChange={(v) => setRecordingForm(f => ({ ...f, videomaker: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {team.filter(m => m.roles.includes("Social Media - Videomaker")).map(m => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Roteiro / Script *</Label>
              <Textarea
                value={recordingForm.roteiro}
                onChange={(e) => setRecordingForm(f => ({ ...f, roteiro: e.target.value }))}
                placeholder="Cole ou escreva o roteiro aqui..."
                rows={4}
              />
              {!recordingForm.roteiro && <p className="text-[10px] text-warning mt-1">O roteiro é obrigatório</p>}
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={recordingForm.notes} onChange={(e) => setRecordingForm(f => ({ ...f, notes: e.target.value }))} placeholder="Tipo de conteúdo..." />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
              <input
                type="checkbox"
                id="rec-roteiro-check"
                checked={recordingForm.roteiroSent}
                onChange={(e) => setRecordingForm(f => ({ ...f, roteiroSent: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="rec-roteiro-check" className="text-xs text-foreground cursor-pointer">
                Roteiro enviado ao cliente
              </label>
              {!recordingForm.roteiroSent && <span className="text-[10px] text-warning ml-auto">Obrigatório</span>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRecordingDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (!recordingForm.clientId || !recordingForm.date || !recordingForm.roteiro.trim() || !recordingForm.roteiroSent) {
                    toast.error("Preencha todos os campos obrigatórios e confirme o roteiro");
                    return;
                  }
                  const client = clients.find(c => c.id === recordingForm.clientId);
                  const dateFormatted = new Date(recordingForm.date).toLocaleDateString("pt-BR");
                  const newRequest: InternalRequest = {
                    id: `req-rec-${Date.now()}`,
                    title: `📹 Solicitação de Gravação - ${client?.company || ""} (${dateFormatted}${recordingForm.time ? ` às ${recordingForm.time}` : ""})`,
                    description: `Videomaker sugerido: ${recordingForm.videomaker || "A definir"}\nData: ${dateFormatted}${recordingForm.time ? ` - ${recordingForm.time}` : ""}\nRoteiro: ${recordingForm.roteiro}\n${recordingForm.notes ? `Obs: ${recordingForm.notes}` : ""}`,
                    requesterId: currentUser?.id || "",
                    requesterName: currentUser?.name || "",
                    assignedToName: "Karen",
                    assignedToId: "e21",
                    clientId: recordingForm.clientId,
                    clientName: client?.company || "",
                    department: "social_media",
                    priority: "high",
                    status: "pending",
                    createdAt: new Date().toISOString(),
                    dueDate: new Date(recordingForm.date).toISOString(),
                  };
                  addRequest(newRequest);
                  toast.success("Solicitação de gravação enviada para aprovação da Karen!");
                  setIsRecordingDialogOpen(false);
                  setRecordingForm({ clientId: "", date: "", time: "", videomaker: "", notes: "", roteiro: "", roteiroSent: false });
                }}
                disabled={!recordingForm.clientId || !recordingForm.date || !recordingForm.roteiro.trim() || !recordingForm.roteiroSent}
              >
                Enviar para Aprovação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      <Dialog open={!!viewingRequest} onOpenChange={(open) => !open && setViewingRequest(null)}>
        <DialogContent className="sm:max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-6">
              {viewingRequest && getStatusIcon(viewingRequest.status)}
              <span className="truncate">{viewingRequest?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {viewingRequest && (
            <div className="space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${getPriorityClasses(viewingRequest.priority)}`}>
                  {priorityLabels[viewingRequest.priority]}
                </span>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  {statusLabels[viewingRequest.status] || viewingRequest.status}
                </span>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  {departmentLabels[viewingRequest.department] || viewingRequest.department}
                </span>
              </div>

              {viewingRequest.description && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Descrição</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 break-words">{viewingRequest.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Solicitante</p>
                  <p className="font-medium">{viewingRequest.requesterName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Atribuído para</p>
                  <p className="font-medium">{viewingRequest.assignedToName}</p>
                </div>
                {viewingRequest.clientName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium text-primary">{viewingRequest.clientName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Criada em</p>
                  <p className="font-medium">{new Date(viewingRequest.createdAt).toLocaleDateString("pt-BR")} {new Date(viewingRequest.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {viewingRequest.dueDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Prazo</p>
                    <p className="font-medium">{new Date(viewingRequest.dueDate).toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
                {viewingRequest.redistributedBy && (
                  <div>
                    <p className="text-xs text-muted-foreground">Redistribuída por</p>
                    <p className="font-medium text-primary">{viewingRequest.redistributedBy}</p>
                  </div>
                )}
              </div>

              {viewingRequest.attachments && viewingRequest.attachments.length > 0 && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Links / Documentos</p>
                  <div className="space-y-1.5">
                    {viewingRequest.attachments.map((link, i) => (
                      <a
                        key={i}
                        href={link.startsWith("http") ? link : `https://${link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors overflow-hidden min-w-0"
                      >
                        <Link className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate min-w-0">{link}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos Concluídos */}
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-success" /> Documentos Concluídos</p>
                {viewingRequest.deliveryLinks && viewingRequest.deliveryLinks.length > 0 ? (
                  <div className="space-y-1.5">
                    {viewingRequest.deliveryLinks.map((link: string, i: number) => (
                      <a
                        key={i}
                        href={link.startsWith("http") ? link : `https://${link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-success/5 border border-success/20 text-success hover:bg-success/10 transition-colors overflow-hidden min-w-0"
                      >
                        <Link className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate min-w-0">{link}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum documento concluído adicionado ainda</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                {(viewingRequest.requesterName === currentUser?.name || currentUser?.isAdmin) && viewingRequest.status !== "completed" && (
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditingRequest(viewingRequest);
                    setEditForm({
                      title: viewingRequest.title,
                      description: viewingRequest.description || "",
                      assignedTo: viewingRequest.assignedToName,
                      department: viewingRequest.department,
                      priority: viewingRequest.priority,
                      dueDate: viewingRequest.dueDate ? viewingRequest.dueDate.slice(0, 10) : "",
                      attachments: viewingRequest.attachments || [],
                      newAttachment: "",
                      deliveryLinks: viewingRequest.deliveryLinks || [],
                      newDeliveryLink: "",
                    });
                    setViewingRequest(null);
                  }}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewingRequest(null)}>Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Request Modal */}
      <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Requisição</DialogTitle>
          </DialogHeader>
          {editingRequest && (
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={editForm.department} onValueChange={(v) => setEditForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(departmentLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Atribuir para</Label>
                <Select value={editForm.assignedTo} onValueChange={(v) => setEditForm(f => ({ ...f, assignedTo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.active).map(u => (
                      <SelectItem key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Select value={editForm.priority} onValueChange={(v) => setEditForm(f => ({ ...f, priority: v as InternalRequest["priority"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prazo</Label>
                  <DatePicker value={editForm.dueDate} onChange={(v) => setEditForm(f => ({ ...f, dueDate: v }))} placeholder="Selecionar prazo" />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Links / Documentos</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={editForm.newAttachment}
                    onChange={(e) => setEditForm(f => ({ ...f, newAttachment: e.target.value }))}
                    placeholder="Cole um link (URL, Google Drive, etc.)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editForm.newAttachment.trim()) {
                        e.preventDefault();
                        setEditForm(f => ({ ...f, attachments: [...f.attachments, f.newAttachment.trim()], newAttachment: "" }));
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (editForm.newAttachment.trim()) {
                      setEditForm(f => ({ ...f, attachments: [...f.attachments, f.newAttachment.trim()], newAttachment: "" }));
                    }
                  }} disabled={!editForm.newAttachment.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {editForm.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editForm.attachments.map((link, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary max-w-[250px]">
                        <Link className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{link}</span>
                        <button onClick={() => setEditForm(f => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))} className="hover:text-destructive flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-success" /> Documentos Concluídos</Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">Links dos arquivos finalizados / editados</p>
                <div className="flex gap-2">
                  <Input
                    value={editForm.newDeliveryLink}
                    onChange={(e) => setEditForm(f => ({ ...f, newDeliveryLink: e.target.value }))}
                    placeholder="Cole o link do documento concluído"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editForm.newDeliveryLink.trim()) {
                        e.preventDefault();
                        setEditForm(f => ({ ...f, deliveryLinks: [...f.deliveryLinks, f.newDeliveryLink.trim()], newDeliveryLink: "" }));
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (editForm.newDeliveryLink.trim()) {
                      setEditForm(f => ({ ...f, deliveryLinks: [...f.deliveryLinks, f.newDeliveryLink.trim()], newDeliveryLink: "" }));
                    }
                  }} disabled={!editForm.newDeliveryLink.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {editForm.deliveryLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editForm.deliveryLinks.map((link, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-success/10 text-success max-w-[250px]">
                        <Link className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{link}</span>
                        <button onClick={() => setEditForm(f => ({ ...f, deliveryLinks: f.deliveryLinks.filter((_, idx) => idx !== i) }))} className="hover:text-destructive flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingRequest(null)}>Cancelar</Button>
                <Button onClick={() => {
                  if (!editForm.title) { toast.error("Título é obrigatório"); return; }
                  const assignedUser = users.find(u => u.name === editForm.assignedTo);
                  updateRequest(editingRequest.id, {
                    title: editForm.title,
                    description: editForm.description,
                    assignedToName: editForm.assignedTo,
                    assignedToId: assignedUser?.id || editingRequest.assignedToId,
                    department: editForm.department,
                    priority: editForm.priority,
                    dueDate: editForm.dueDate || undefined,
                    attachments: editForm.attachments.length > 0 ? editForm.attachments : undefined,
                    deliveryLinks: editForm.deliveryLinks.length > 0 ? editForm.deliveryLinks : [],
                  });
                  toast.success("Requisição atualizada!");
                  setEditingRequest(null);
                }} disabled={!editForm.title}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
