import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAppStore, QuoteRequest, type ClientDnaLink, type ClientDnaCredential, type ClientDnaDate } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { formatCurrency, RecurringService } from "@/data/mockData";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { toast } from "sonner";
import {
  ArrowLeft, FileText, DollarSign, CheckCircle, Clock,
  Plus, Send, CreditCard, AlertTriangle, Briefcase, Trash2, Edit2, X,
  Users, Play, Square, RefreshCw, Zap, Star, Shield,
  Link, Paperclip, Key, CalendarDays, MessageSquare, Eye, EyeOff
} from "lucide-react";

const availableServices = [
  "Tráfego Meta", "Tráfego Google",
  "Social Media - 3 Posts", "Social Media - 5 Posts", "Social Media - 7 Posts",
  "Inside Sales", "Landing Page", "Site Institucional",
  "Branding", "SEO", "Email Marketing", "Suporte IA", "Comercial",
];

const recurringServiceTemplates = [
  { name: "Otimizar Campanhas", defaultFreq: "diario" as const, module: "Tráfego" },
  { name: "Criar Posts", defaultFreq: "semanal" as const, module: "Social Media" },
  { name: "Criar Reels/Vídeos", defaultFreq: "semanal" as const, module: "Social Media" },
  { name: "Criar Stories", defaultFreq: "diario" as const, module: "Social Media" },
  { name: "Análise de Métricas", defaultFreq: "semanal" as const, module: "Tráfego" },
  { name: "Relatório Mensal", defaultFreq: "mensal" as const, module: "Relatórios" },
  { name: "Revisão de Criativos", defaultFreq: "semanal" as const, module: "Social Media" },
  { name: "Atualização de Site", defaultFreq: "por_demanda" as const, module: "Tech" },
  { name: "Gravação de Conteúdo", defaultFreq: "quinzenal" as const, module: "Social Media" },
  { name: "Roteiro de Vídeo", defaultFreq: "quinzenal" as const, module: "Social Media" },
  { name: "Suporte Bom Dia (Grupo)", defaultFreq: "diario" as const, module: "Suporte" },
];

const frequencyLabels: Record<string, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  por_demanda: "Por demanda",
};

const frequencyColors: Record<string, string> = {
  diario: "bg-destructive/10 text-destructive",
  semanal: "bg-warning/10 text-warning",
  quinzenal: "bg-info/10 text-info",
  mensal: "bg-success/10 text-success",
  por_demanda: "bg-muted text-muted-foreground",
};

const tabs = [
  { key: "overview", label: "Visão Geral", icon: Briefcase },
  { key: "dna", label: "DNA do Cliente", icon: Zap },
  { key: "team", label: "Equipe", icon: Users },
  { key: "tasks", label: "Tarefas", icon: CheckCircle },
  { key: "quotes", label: "Orçamentos", icon: FileText },
  { key: "financial", label: "Financeiro", icon: DollarSign },
];

const NOTE_AREAS = [
  { key: "gestor_trafego", label: "Gestor de Tráfego" },
  { key: "gestor_social", label: "Social Media" },
  { key: "designer", label: "Designer" },
  { key: "videomaker", label: "Videomaker" },
  { key: "inside_sales", label: "Inside Sales" },
  { key: "coordenacao", label: "Coordenação" },
  { key: "geral", label: "Observações Gerais" },
];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    clients, tasks, quoteRequests, team,
    addQuoteRequest, updateQuoteRequest, completeQuoteRequest,
    removeClient, updateClient,
    assignTeamMemberToClient, removeTeamMemberFromClient,
    addRecurringService, removeRecurringService, updateRecurringService,
    generateRecurringTasks, startTask, completeTask, addTask, deleteTask, logAudit,
    getClientDna, updateClientDna,
  } = useAppStore();
  const { users } = useAuthStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const client = clients.find((c) => c.id === id);
  const [activeTab, setActiveTab] = useState("overview");

  // DNA state
  const [dnaNewLink, setDnaNewLink] = useState({ label: "", url: "" });
  const [dnaNewCred, setDnaNewCred] = useState({ label: "", value: "" });
  const [dnaNewDate, setDnaNewDate] = useState({ label: "", date: "" });
  const [dnaShowPasswords, setDnaShowPasswords] = useState<Record<number, boolean>>({});
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditValueModal, setShowEditValueModal] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showAddRecurringModal, setShowAddRecurringModal] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [editMonthlyValue, setEditMonthlyValue] = useState(0);
  const [newService, setNewService] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newRequestedBy, setNewRequestedBy] = useState("");

  // Multi-select team assignment
  const [selectedMembers, setSelectedMembers] = useState<{ id: string; name: string; role: string; designation: "titular" | "reserva" }[]>([]);

  // Recurring service form
  const [recServiceName, setRecServiceName] = useState("");
  const [recServiceCustomName, setRecServiceCustomName] = useState("");
  const [recServiceAssignee, setRecServiceAssignee] = useState("");
  const [recServiceFreq, setRecServiceFreq] = useState<RecurringService["frequency"]>("diario");
  const [recServiceQty, setRecServiceQty] = useState<number>(0);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <button onClick={() => navigate("/clients")} className="text-sm text-primary hover:underline">Voltar para clientes</button>
      </div>
    );
  }

  const clientTasks = tasks.filter((t) => t.clientId === id);
  const clientQuotes = quoteRequests.filter((q) => q.clientId === id);
  const recurringServices = client.recurringServices || [];

  // Auto-include Gerente Operacional in every client's team
  const gerenteUsers = users.filter(u => u.roles?.some(r => r.includes("Gerente Operacional")));
  const manualTeam = client.assignedTeam || [];
  const autoGerenteAssignments = gerenteUsers
    .filter(g => !manualTeam.some(a => a.memberId === g.id))
    .map(g => ({ memberId: g.id, memberName: g.name, role: "Gerente Operacional", designation: "titular" as const }));
  const assignedTeam = [...autoGerenteAssignments, ...manualTeam];

  const handleRequestQuote = () => {
    if (!newService || !newRequestedBy) { toast.error("Preencha o serviço e quem solicitou"); return; }
    const qr: QuoteRequest = {
      id: `qr-${Date.now()}`, clientId: client.id, clientName: client.company,
      service: newService, requestedBy: newRequestedBy,
      requestedAt: new Date().toISOString().slice(0, 10), notes: newNotes, status: "pending",
    };
    addQuoteRequest(qr);
    toast.success("Solicitação de orçamento registrada!");
    setShowRequestModal(false);
    setNewService(""); setNewNotes(""); setNewRequestedBy("");
    setActiveTab("quotes");
  };

  const handleSendProposal = (qrId: string) => {
    const value = prompt("Valor mensal da proposta (R$):");
    if (!value || isNaN(Number(value))) return;
    updateQuoteRequest(qrId, { status: "proposal_sent", proposalValue: Number(value), proposalSentAt: new Date().toISOString().slice(0, 10) });
    toast.success("Proposta enviada ao cliente!");
  };
  const handleClientApproved = (qrId: string) => {
    updateQuoteRequest(qrId, { status: "approved", approvedAt: new Date().toISOString().slice(0, 10) });
    toast.success("Cliente aprovou!");
  };
  const handlePaymentConfirmed = (qrId: string) => { completeQuoteRequest(qrId); toast.success("Pagamento confirmado!"); };
  const handleCancelQuote = (qrId: string) => { updateQuoteRequest(qrId, { status: "cancelled" }); toast("Solicitação cancelada"); };

  // Multi-select: add all selected members at once
  const handleAddSelectedMembers = () => {
    if (selectedMembers.length === 0) { toast.error("Selecione ao menos um colaborador"); return; }
    // Check for duplicates before adding
    const duplicates = selectedMembers.filter(m => assignedTeam.some(a => a.memberId === m.id));
    if (duplicates.length > 0) {
      toast.error(`${duplicates.map(d => d.name).join(", ")} já está(ão) na equipe`);
      return;
    }
    for (const m of selectedMembers) {
      assignTeamMemberToClient(client.id, { memberId: m.id, memberName: m.name, role: m.role, designation: m.designation });
    }
    toast.success(`${selectedMembers.length} colaborador(es) adicionado(s)!`);
    setShowAddTeamModal(false);
    setSelectedMembers([]);
  };

  const toggleMemberSelection = (user: { id: string; name: string }, autoRole: string) => {
    const existing = selectedMembers.find(m => m.id === user.id);
    if (existing) {
      setSelectedMembers(prev => prev.filter(m => m.id !== user.id));
    } else {
      // Check if already in the team (prevent duplicates)
      if (assignedTeam.some(a => a.memberId === user.id)) {
        toast.error(`${user.name} já está na equipe deste cliente`);
        return;
      }
      setSelectedMembers(prev => [...prev, { id: user.id, name: user.name, role: autoRole, designation: "reserva" }]);
    }
  };

  const updateSelectedDesignation = (userId: string, designation: "titular" | "reserva") => {
    setSelectedMembers(prev => prev.map(m => m.id === userId ? { ...m, designation } : m));
  };

  const handleToggleDesignation = (memberId: string) => {
    const current = manualTeam.find(a => a.memberId === memberId);
    if (!current) return;
    const newDesignation = current.designation === "titular" ? "reserva" : "titular";
    // Update via re-assigning with new designation
    assignTeamMemberToClient(client.id, { ...current, designation: newDesignation });
    toast.success(`${current.memberName} agora é ${newDesignation === "titular" ? "Titular" : "Reserva"}`);
  };

  const handleAddRecurringService = () => {
    const name = recServiceName === "__custom__" ? recServiceCustomName : recServiceName;
    if (!name || !recServiceAssignee) { toast.error("Preencha o serviço e o responsável"); return; }
    const assignee = users.find(u => u.id === recServiceAssignee);
    if (!assignee) return;
    const svc: RecurringService = {
      id: `rs-${Date.now()}`, name, assigneeId: assignee.id, assigneeName: assignee.name,
      frequency: recServiceFreq, quantityPerCycle: recServiceQty || undefined, active: true,
    };
    addRecurringService(client.id, svc);
    toast.success(`Serviço recorrente "${name}" criado!`);
    setShowAddRecurringModal(false);
    setRecServiceName(""); setRecServiceCustomName(""); setRecServiceAssignee(""); setRecServiceFreq("diario"); setRecServiceQty(0);
  };

  const handleGenerateTasks = () => {
    generateRecurringTasks(client.id);
    toast.success("Tarefas recorrentes geradas para hoje!");
  };

  // "Espalhar Demandas" — generate all operational tasks for assigned team
  const handleSpreadDemands = () => {
    const today = new Date().toISOString().slice(0, 10);
    const svc = client.services;
    let count = 0;

    for (const member of manualTeam) {
      const isTitular = member.designation !== "reserva";
      if (!isTitular) continue; // Only titular generates tasks

      const role = member.role.toLowerCase();

      // Traffic managers: daily campaign optimization
      if (role.includes("gestor de tráfego") || role.includes("tráfego")) {
        if (svc.some(s => s.toLowerCase().includes("tráfego"))) {
          const exists = tasks.some(t => t.clientId === client.id && t.assignee === member.memberName && t.title.includes("Otimizar Campanhas") && t.createdAt === today);
          if (!exists) {
            addTask({
              id: `t-spread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: "Otimizar Campanhas",
              client: client.company, clientId: client.id,
              module: "Tráfego", sector: "Operação", type: "recurring",
              assignee: member.memberName, deadline: today, urgency: "normal",
              status: "pending", weight: 2, estimatedHours: 1, hasRework: false, createdAt: today,
            });
            count++;
          }
        }
      }

      // Designers: create posts
      if (role.includes("designer")) {
        if (svc.some(s => s.toLowerCase().includes("social media"))) {
          const postsMatch = svc.find(s => s.match(/\d+ Posts/));
          const qty = postsMatch ? parseInt(postsMatch.match(/(\d+)/)?.[1] || "3") : 3;
          const exists = tasks.some(t => t.clientId === client.id && t.assignee === member.memberName && t.title.includes("Criar Posts") && t.createdAt === today);
          if (!exists) {
            addTask({
              id: `t-spread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: `Criar Posts (${qty}x/semana)`,
              client: client.company, clientId: client.id,
              module: "Social Media", sector: "Operação", type: "recurring",
              assignee: member.memberName, deadline: today, urgency: "normal",
              status: "pending", weight: 2, estimatedHours: 2, hasRework: false, createdAt: today,
            });
            count++;
          }
        }
      }

      // Videomakers: recording + editing
      if (role.includes("videomaker")) {
        if (svc.some(s => s.toLowerCase().includes("social media"))) {
          const exists = tasks.some(t => t.clientId === client.id && t.assignee === member.memberName && t.title.includes("Gravação") && t.createdAt === today);
          if (!exists) {
            // First: script task
            addTask({
              id: `t-spread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: "Roteiro de Vídeo",
              client: client.company, clientId: client.id,
              module: "Social Media", sector: "Produção", type: "recurring",
              assignee: member.memberName, deadline: today, urgency: "normal",
              status: "pending", weight: 2, estimatedHours: 1, hasRework: false, createdAt: today,
            });
            // Then: recording
            const recordingDeadline = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
            addTask({
              id: `t-spread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              title: "Gravação de Conteúdo",
              client: client.company, clientId: client.id,
              module: "Social Media", sector: "Produção", type: "recurring",
              assignee: member.memberName, deadline: recordingDeadline, urgency: "normal",
              status: "pending", weight: 3, estimatedHours: 3, hasRework: false, createdAt: today,
            });
            count += 2;
          }
        }
      }

      // Editors
      if (role.includes("editor")) {
        if (svc.some(s => s.toLowerCase().includes("social media"))) {
          const exists = tasks.some(t => t.clientId === client.id && t.assignee === member.memberName && t.title.includes("Edição") && t.createdAt === today);
          if (!exists) {
            const editDeadline = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
            addTask({
              id: `t-spread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: "Edição de Vídeo (72h)",
              client: client.company, clientId: client.id,
              module: "Social Media", sector: "Produção", type: "recurring",
              assignee: member.memberName, deadline: editDeadline, urgency: "priority",
              status: "pending", weight: 3, estimatedHours: 3, hasRework: false, createdAt: today,
            });
            count++;
          }
        }
      }

      // Support: good morning messages (weekdays)
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const exists = tasks.some(t => t.clientId === client.id && t.title.includes("Bom dia") && t.createdAt === today);
        if (!exists) {
          // Rotate support among non-manager team members
          const nonManagers = manualTeam.filter(m => !m.role.includes("Gerente"));
          if (nonManagers.length > 0) {
            const dayIndex = Math.floor(Date.now() / 86400000) % nonManagers.length;
            const supporter = nonManagers[dayIndex];
            addTask({
              id: `t-spread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: `Bom dia - ${client.company}`,
              client: client.company, clientId: client.id,
              module: "Suporte", sector: "Operação", type: "recurring",
              assignee: supporter.memberName, deadline: today, urgency: "normal",
              status: "pending", weight: 1, estimatedHours: 0.25, hasRework: false, createdAt: today,
            });
            count++;
          }
        }
      }
    }

    if (count > 0) {
      toast.success(`${count} tarefa(s) espalhada(s) para a equipe!`);
    } else {
      toast.info("Todas as demandas já foram geradas para hoje.");
    }
  };

  const riskColor = (risk: string) => {
    switch (risk) { case "critical": return "text-destructive"; case "high": return "text-warning"; case "medium": return "text-info"; default: return "text-success"; }
  };

  const statusLabel: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    pending: { label: "Aguardando proposta", icon: Clock, color: "text-warning" },
    proposal_sent: { label: "Proposta enviada", icon: Send, color: "text-info" },
    approved: { label: "Aprovado · Aguardando pagamento", icon: CheckCircle, color: "text-primary" },
    paid: { label: "Pago · Serviço ativado", icon: CreditCard, color: "text-success" },
    cancelled: { label: "Cancelado", icon: AlertTriangle, color: "text-muted-foreground" },
  };

  // Only admin/financeiro can see financial tab
  const isAdminOrFinanceiro = currentUser?.isAdmin || currentUser?.roles?.includes("Financeiro");
  const visibleTabs = tabs.filter(t => t.key !== "financial" || isAdminOrFinanceiro);

  // Smart role suggestions
  const getSmartSuggestions = () => {
    const svc = client.services;
    const relevantRoles: string[] = [];
    if (svc.some(s => s.includes("Tráfego"))) relevantRoles.push("Gestor de Tráfego");
    if (svc.some(s => s.includes("Social Media"))) relevantRoles.push("Social Media - Coordenação", "Social Media - Designer", "Social Media - Videomaker", "Social Media - Editor");
    if (svc.some(s => s.includes("Inside Sales"))) relevantRoles.push("Inside Sales");
    if (svc.some(s => s.includes("Site") || s.includes("Landing"))) relevantRoles.push("Sites", "Tecnologia");
    if (svc.some(s => s.includes("Branding") || s.includes("SEO"))) relevantRoles.push("Social Media - Designer");
    return relevantRoles;
  };

  const relevantRoles = getSmartSuggestions();

  const getAutoRole = (user: { roles?: string[]; role?: string }) => {
    const userRoles = user.roles || (user.role ? [user.role] : []);
    for (const rr of relevantRoles) {
      if (userRoles.some(r => r.includes(rr))) return rr;
    }
    return userRoles[0] || "";
  };

  // Has demands been spread today?
  const today = new Date().toISOString().slice(0, 10);
  const hasTodaySpreadTasks = manualTeam.length > 0 && tasks.some(t => t.clientId === client.id && t.type === "recurring" && t.createdAt === today);
  const hasTeamBeyondGerente = manualTeam.filter(a => !a.role.includes("Gerente Operacional")).length > 0;

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => navigate("/clients")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>

      <PageHeader title={client.company} description={`${client.name} · ${client.status} · ${client.substatus}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (window.confirm(`Tem certeza que deseja excluir "${client.company}"?`)) {
                removeClient(client.id); navigate("/clients"); toast.success("Cliente excluído!");
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
          <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Solicitar Orçamento
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.key === "team" && assignedTeam.length > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold">{assignedTeam.length}</span>
            )}
            {tab.key === "quotes" && clientQuotes.filter(q => q.status !== "paid" && q.status !== "cancelled").length > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                {clientQuotes.filter(q => q.status !== "paid" && q.status !== "cancelled").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dados Gerais</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Empresa:</span> <span className="text-foreground font-medium">{client.company}</span></div>
              <div><span className="text-muted-foreground">Contato:</span> <span className="text-foreground">{client.name}</span></div>
              <div><span className="text-muted-foreground">Gerente:</span> <span className="text-foreground">{client.accountManager}</span></div>
              <div><span className="text-muted-foreground">Risco:</span> <span className={`font-medium capitalize ${riskColor(client.riskLevel)}`}>● {client.riskLevel}</span></div>
              {isAdminOrFinanceiro && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Mensalidade:</span>
                    <span className="text-foreground font-mono">{formatCurrency(client.monthlyValue)}</span>
                    <button onClick={() => { setEditMonthlyValue(client.monthlyValue); setShowEditValueModal(true); }} className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div><span className="text-muted-foreground">Setup:</span> <span className="text-foreground font-mono">{formatCurrency(client.setupValue)}</span></div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Serviços Contratados</h3>
              <button onClick={() => setShowAddServiceModal(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {client.services.length > 0 ? client.services.map(s => (
                <span key={s} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1.5">
                  {s}
                  <button onClick={() => {
                    const base = s.split(" - ")[0].toLowerCase();
                    const remaining = client.services.filter(sv => sv !== s && !sv.toLowerCase().startsWith(base + " - "));
                    updateClient(client.id, { services: remaining });
                    toast.success(`Serviço "${s}" removido`);
                  }} className="hover:text-destructive transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )) : <span className="text-xs text-muted-foreground italic">Nenhum serviço vinculado</span>}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Equipe Resumo</h3>
            {assignedTeam.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {assignedTeam.map(a => (
                  <div key={a.memberId} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                      {a.memberName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-foreground">{a.memberName}</span>
                    <span className="text-muted-foreground">· {a.role}</span>
                    {a.designation === "titular" && <Star className="w-3 h-3 text-warning" />}
                    {a.designation === "reserva" && <Shield className="w-3 h-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum colaborador designado. <button onClick={() => setActiveTab("team")} className="text-primary hover:underline">Configurar equipe →</button></p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Resumo Operacional</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-lg font-bold text-foreground">{client.pendingTasks}</p>
                <p className="text-[10px] text-muted-foreground">Pendentes</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-lg font-bold text-destructive">{client.overdueTasks}</p>
                <p className="text-[10px] text-muted-foreground">Atrasadas</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-lg font-bold text-foreground">{recurringServices.filter(s => s.active).length}</p>
                <p className="text-[10px] text-muted-foreground">Serv. Recorrentes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DNA Tab */}
      {activeTab === "dna" && (() => {
        const dna = getClientDna(client.id);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Links / Documentos */}
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Paperclip className="w-4 h-4 text-primary" /> Links / Documentos</h3>
              </div>
              <p className="text-[10px] text-muted-foreground">Formulários, identidade visual, Google Drive, briefings, etc.</p>
              <div className="space-y-2">
                {dna.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <a href={link.url.startsWith("http") ? link.url : `https://${link.url}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors overflow-hidden min-w-0">
                      <Link className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-medium flex-shrink-0">{link.label}:</span>
                      <span className="truncate min-w-0 text-primary/70">{link.url}</span>
                    </a>
                    <button onClick={() => { const newLinks = dna.links.filter((_, idx) => idx !== i); updateClientDna(client.id, { links: newLinks }); }} className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-1 transition-all"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={dnaNewLink.label} onChange={(e) => setDnaNewLink(f => ({ ...f, label: e.target.value }))} placeholder="Nome (ex: Formulário)" className="w-32 px-2 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground" />
                <input value={dnaNewLink.url} onChange={(e) => setDnaNewLink(f => ({ ...f, url: e.target.value }))} placeholder="URL do link" className="flex-1 px-2 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground" onKeyDown={(e) => { if (e.key === "Enter" && dnaNewLink.label && dnaNewLink.url) { updateClientDna(client.id, { links: [...dna.links, { ...dnaNewLink }] }); setDnaNewLink({ label: "", url: "" }); } }} />
                <button onClick={() => { if (dnaNewLink.label && dnaNewLink.url) { updateClientDna(client.id, { links: [...dna.links, { ...dnaNewLink }] }); setDnaNewLink({ label: "", url: "" }); } }} disabled={!dnaNewLink.label || !dnaNewLink.url} className="px-2 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            {/* Credenciais */}
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Key className="w-4 h-4 text-warning" /> Credenciais / Acessos</h3>
              </div>
              <p className="text-[10px] text-muted-foreground">Login Instagram, senhas de plataformas, acessos BM, etc.</p>
              <div className="space-y-2">
                {dna.credentials.map((cred, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <div className="flex-1 flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-warning/5 border border-warning/20 min-w-0">
                      <Key className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                      <span className="font-medium text-foreground flex-shrink-0">{cred.label}:</span>
                      <span className="truncate min-w-0 text-muted-foreground font-mono text-xs">{dnaShowPasswords[i] ? cred.value : "••••••••"}</span>
                      <button onClick={() => setDnaShowPasswords(p => ({ ...p, [i]: !p[i] }))} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                        {dnaShowPasswords[i] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                    <button onClick={() => { const newCreds = dna.credentials.filter((_, idx) => idx !== i); updateClientDna(client.id, { credentials: newCreds }); }} className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-1 transition-all"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={dnaNewCred.label} onChange={(e) => setDnaNewCred(f => ({ ...f, label: e.target.value }))} placeholder="Nome (ex: Instagram)" className="w-32 px-2 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground" />
                <input value={dnaNewCred.value} onChange={(e) => setDnaNewCred(f => ({ ...f, value: e.target.value }))} placeholder="Login / Senha / Valor" className="flex-1 px-2 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground" onKeyDown={(e) => { if (e.key === "Enter" && dnaNewCred.label && dnaNewCred.value) { updateClientDna(client.id, { credentials: [...dna.credentials, { ...dnaNewCred }] }); setDnaNewCred({ label: "", value: "" }); } }} />
                <button onClick={() => { if (dnaNewCred.label && dnaNewCred.value) { updateClientDna(client.id, { credentials: [...dna.credentials, { ...dnaNewCred }] }); setDnaNewCred({ label: "", value: "" }); } }} disabled={!dnaNewCred.label || !dnaNewCred.value} className="px-2 py-1.5 rounded-md bg-warning text-warning-foreground text-xs font-medium hover:bg-warning/90 disabled:opacity-50 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            {/* Datas Importantes */}
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><CalendarDays className="w-4 h-4 text-success" /> Datas Importantes</h3>
              </div>
              <p className="text-[10px] text-muted-foreground">Aniversários, datas de renovação, eventos, etc.</p>
              <div className="space-y-2">
                {dna.importantDates.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <div className="flex-1 flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-success/5 border border-success/20">
                      <CalendarDays className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      <span className="font-medium text-foreground">{d.label}:</span>
                      <span className="text-muted-foreground">{new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    </div>
                    <button onClick={() => { const newDates = dna.importantDates.filter((_, idx) => idx !== i); updateClientDna(client.id, { importantDates: newDates }); }} className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded p-1 transition-all"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={dnaNewDate.label} onChange={(e) => setDnaNewDate(f => ({ ...f, label: e.target.value }))} placeholder="Nome (ex: Aniversário)" className="w-40 px-2 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground" />
                <input type="date" value={dnaNewDate.date} onChange={(e) => setDnaNewDate(f => ({ ...f, date: e.target.value }))} className="flex-1 px-2 py-1.5 rounded-md border bg-background text-xs text-foreground" />
                <button onClick={() => { if (dnaNewDate.label && dnaNewDate.date) { updateClientDna(client.id, { importantDates: [...dna.importantDates, { ...dnaNewDate }] }); setDnaNewDate({ label: "", date: "" }); } }} disabled={!dnaNewDate.label || !dnaNewDate.date} className="px-2 py-1.5 rounded-md bg-success text-success-foreground text-xs font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            {/* Observações por Área */}
            <div className="rounded-lg border bg-card p-5 space-y-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Observações por Área</h3>
              <p className="text-[10px] text-muted-foreground">Notas dos gestores, designers, videomakers, etc. sobre este cliente</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {NOTE_AREAS.map(area => (
                  <div key={area.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">{area.label}</label>
                    <textarea
                      value={dna.notes[area.key] || ""}
                      onChange={(e) => {
                        updateClientDna(client.id, { notes: { ...dna.notes, [area.key]: e.target.value } });
                      }}
                      placeholder={`Observações do ${area.label}...`}
                      rows={3}
                      className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Team Tab */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Assigned Team */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Equipe Responsável ({assignedTeam.length})</h3>
              <div className="flex items-center gap-2">
                {hasTeamBeyondGerente && (
                  <button onClick={handleSpreadDemands} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${hasTodaySpreadTasks ? "bg-success/10 text-success border border-success/30" : "bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20"}`}>
                    <Zap className="w-3.5 h-3.5" />
                    {hasTodaySpreadTasks ? "✓ Demandas Espalhadas" : "Espalhar Demandas"}
                  </button>
                )}
                <button onClick={() => { setSelectedMembers([]); setShowAddTeamModal(true); }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
            </div>
            {/* Warning: no titular */}
            {manualTeam.length > 0 && !manualTeam.some(a => a.designation === "titular") && (
              <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <p className="text-xs text-warning font-medium">⚠️ Este cliente não tem um Titular designado. Defina ao menos um titular para receber tarefas automáticas.</p>
              </div>
            )}
            {assignedTeam.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum colaborador designado</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione os colaboradores que trabalham neste cliente</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {assignedTeam.map(a => {
                  const memberTasks = clientTasks.filter(t => t.assignee === a.memberName);
                  const pendingCount = memberTasks.filter(t => t.status === "pending").length;
                  const inProgressCount = memberTasks.filter(t => t.status === "in_progress").length;
                  const doneCount = memberTasks.filter(t => t.status === "done").length;
                  const totalTime = memberTasks.reduce((sum, t) => sum + (t.timeSpentMinutes || 0), 0);
                  const isGerente = a.role.includes("Gerente Operacional");

                  return (
                    <div key={a.memberId} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {a.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{a.memberName}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{a.role}</span>
                          {!isGerente && (
                            <button
                              onClick={() => handleToggleDesignation(a.memberId)}
                              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                                a.designation === "titular"
                                  ? "bg-warning/15 text-warning"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {a.designation === "titular" ? <><Star className="w-3 h-3" /> Titular</> : <><Shield className="w-3 h-3" /> Reserva</>}
                            </button>
                          )}
                          {isGerente && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">Auto</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>⏳ {pendingCount} pendentes</span>
                          <span>🔄 {inProgressCount} em andamento</span>
                          <span>✅ {doneCount} concluídas</span>
                          {totalTime > 0 && <span>⏱ {Math.round(totalTime / 60)}h trabalhadas</span>}
                        </div>
                      </div>
                      {!isGerente && (
                        <button onClick={() => { removeTeamMemberFromClient(client.id, a.memberId); toast.success("Membro removido da equipe"); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recurring Services */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Serviços Recorrentes ({recurringServices.length})</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleGenerateTasks} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border text-foreground hover:bg-muted transition-colors" title="Gerar tarefas de hoje">
                  <Zap className="w-3 h-3" /> Gerar Tarefas
                </button>
                <button onClick={() => setShowAddRecurringModal(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-3 h-3" /> Novo Serviço
                </button>
              </div>
            </div>
            {recurringServices.length === 0 ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum serviço recorrente configurado</p>
                <p className="text-xs text-muted-foreground mt-1">Configure serviços como "Otimizar Campanhas" (diário) ou "Criar Posts" (semanal)</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {recurringServices.map(svc => (
                  <div key={svc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${svc.active ? "bg-success" : "bg-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{svc.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${frequencyColors[svc.frequency]}`}>
                          {frequencyLabels[svc.frequency]}
                        </span>
                        {svc.quantityPerCycle && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{svc.quantityPerCycle}x por ciclo</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Responsável: <span className="text-foreground">{svc.assigneeName}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { updateRecurringService(client.id, svc.id, { active: !svc.active }); toast.success(svc.active ? "Serviço pausado" : "Serviço ativado"); }}
                        className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors ${svc.active ? "text-success border-success/30 hover:bg-success/10" : "text-muted-foreground border-border hover:bg-muted"}`}
                      >
                        {svc.active ? "Ativo" : "Pausado"}
                      </button>
                      <button onClick={() => { removeRecurringService(client.id, svc.id); toast.success("Serviço removido"); }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Task performance for team members */}
          {assignedTeam.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Zap className="w-4 h-4" /> Performance da Equipe</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {assignedTeam.map(a => {
                    const memberTasks = clientTasks.filter(t => t.assignee === a.memberName);
                    const completed = memberTasks.filter(t => t.status === "done");
                    const totalMinutes = completed.reduce((s, t) => s + (t.timeSpentMinutes || 0), 0);
                    const avgMinutes = completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0;
                    const pending = memberTasks.filter(t => t.status === "pending").length;

                    return (
                      <div key={a.memberId} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {a.memberName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{a.memberName}</p>
                            <p className="text-[10px] text-muted-foreground">{a.role}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded bg-muted/50 p-1.5">
                            <p className="text-sm font-bold text-foreground">{completed.length}</p>
                            <p className="text-[9px] text-muted-foreground">Concluídas</p>
                          </div>
                          <div className="rounded bg-muted/50 p-1.5">
                            <p className="text-sm font-bold text-foreground">{pending}</p>
                            <p className="text-[9px] text-muted-foreground">Pendentes</p>
                          </div>
                          <div className="rounded bg-muted/50 p-1.5">
                            <p className="text-sm font-bold text-foreground">{avgMinutes > 0 ? `${avgMinutes}m` : "—"}</p>
                            <p className="text-[9px] text-muted-foreground">Tempo médio</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          {clientTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Nenhuma tarefa para este cliente</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium">Tarefa</th>
                  <th className="text-left py-3 px-4 font-medium">Responsável</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Tempo</th>
                  <th className="text-left py-3 px-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientTasks.map(task => (
                  <tr key={task.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-sm text-foreground">{task.title}</span>
                      {task.type === "recurring" && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-info/10 text-info">Recorrente</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{task.assignee}</td>
                    <td className="py-3 px-4"><StatusBadge status={task.status} /></td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {task.timeSpentMinutes ? `${task.timeSpentMinutes}min` : task.startedAt ? "Em andamento..." : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {task.status === "pending" && (
                          <button onClick={() => { startTask(task.id); toast.success("Tarefa iniciada!"); }} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                            <Play className="w-3 h-3" /> Iniciar
                          </button>
                        )}
                        {task.status === "in_progress" && (
                          <button onClick={() => { completeTask(task.id); toast.success("Tarefa concluída!"); }} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-success text-success-foreground hover:bg-success/90">
                            <Square className="w-3 h-3" /> Concluir
                          </button>
                        )}
                        <button onClick={() => {
                          if (window.confirm(`Excluir "${task.title}"?`)) {
                            deleteTask(task.id);
                            logAudit(currentUser?.name || 'Desconhecido', 'Apagou tarefa', task.title, task.id);
                            toast.success("Tarefa excluída");
                          }
                        }} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Quotes Tab */}
      {activeTab === "quotes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Solicitações de Orçamento</h3>
            <button onClick={() => setShowRequestModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
              <Plus className="w-3 h-3" /> Nova Solicitação
            </button>
          </div>
          {clientQuotes.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação de orçamento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clientQuotes.map(qr => {
                const st = statusLabel[qr.status];
                const StIcon = st.icon;
                return (
                  <div key={qr.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-foreground">{qr.service}</span>
                          <span className={`flex items-center gap-1 text-xs ${st.color}`}><StIcon className="w-3 h-3" /> {st.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Solicitado por <span className="text-foreground">{qr.requestedBy}</span> em {qr.requestedAt}</p>
                        {qr.notes && <p className="text-xs text-muted-foreground mt-1">{qr.notes}</p>}
                        {qr.proposalValue && <p className="text-xs text-muted-foreground mt-1">Valor: <span className="text-foreground font-mono">{formatCurrency(qr.proposalValue)}/mês</span></p>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {qr.status === "pending" && (
                        <>
                          <button onClick={() => handleSendProposal(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"><Send className="w-3 h-3" /> Enviar Proposta</button>
                          <button onClick={() => handleCancelQuote(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                        </>
                      )}
                      {qr.status === "proposal_sent" && (
                        <>
                          <button onClick={() => handleClientApproved(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-medium hover:bg-success/90"><CheckCircle className="w-3 h-3" /> Cliente Aprovou</button>
                          <button onClick={() => handleCancelQuote(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                        </>
                      )}
                      {qr.status === "approved" && (
                        <button onClick={() => handlePaymentConfirmed(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-medium hover:bg-success/90"><CreditCard className="w-3 h-3" /> Confirmar Pagamento</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === "financial" && isAdminOrFinanceiro && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Resumo Financeiro</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Mensalidade:</span><span className="text-foreground font-mono">{formatCurrency(client.monthlyValue)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Setup:</span><span className="text-foreground font-mono">{formatCurrency(client.setupValue)}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground font-medium">Status:</span><span className="text-foreground">{client.substatus}</span></div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Serviços Ativos</h3>
            {client.services.map(s => (
              <div key={s} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground">{s}</span>
                <StatusBadge status="done" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Select Add Team Modal */}
      <Modal open={showAddTeamModal} onClose={() => setShowAddTeamModal(false)} title="Adicionar à Equipe">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Selected count */}
          {selectedMembers.length > 0 && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-xs font-medium text-success mb-2">{selectedMembers.length} selecionado(s)</p>
              <div className="space-y-1.5">
                {selectedMembers.map(m => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{m.name}</span>
                      <span className="text-muted-foreground">({m.role})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateSelectedDesignation(m.id, "titular")}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${m.designation === "titular" ? "bg-warning/20 text-warning font-medium" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        ★ Titular
                      </button>
                      <button
                        onClick={() => updateSelectedDesignation(m.id, "reserva")}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${m.designation === "reserva" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Reserva
                      </button>
                      <button onClick={() => setSelectedMembers(prev => prev.filter(p => p.id !== m.id))} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Smart role suggestions grouped */}
          {(() => {
            const svc = client.services;
            const relevantUsers = users.filter(u => {
              if (!u.active) return false;
              if (assignedTeam.some(a => a.memberId === u.id)) return false;
              if (relevantRoles.length === 0) return true;
              const userRoles = u.roles || (u.role ? [u.role] : []);
              return userRoles.some(r => relevantRoles.some(rr => r.includes(rr)));
            });

            const otherUsers = users.filter(u => {
              if (!u.active) return false;
              if (assignedTeam.some(a => a.memberId === u.id)) return false;
              if (relevantUsers.some(ru => ru.id === u.id)) return false;
              return true;
            });

            // Group relevant users by role
            const roleGroups: Record<string, typeof relevantUsers> = {};
            for (const u of relevantUsers) {
              const userRoles = u.roles || (u.role ? [u.role] : []);
              const matchedRole = relevantRoles.find(rr => userRoles.some(r => r.includes(rr))) || userRoles[0] || "Outro";
              if (!roleGroups[matchedRole]) roleGroups[matchedRole] = [];
              roleGroups[matchedRole].push(u);
            }

            return (
              <>
                {Object.entries(roleGroups).map(([role, groupUsers]) => (
                  <div key={role} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] text-primary font-medium">★ {role} ({groupUsers.length})</p>
                      <button
                        onClick={() => {
                          const toAdd = groupUsers.filter(u => !selectedMembers.some(m => m.id === u.id));
                          setSelectedMembers(prev => [...prev, ...toAdd.map(u => ({ id: u.id, name: u.name, role: getAutoRole(u), designation: "reserva" as const }))]);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        Selecionar todos
                      </button>
                    </div>
                    <div className="space-y-1">
                      {groupUsers.map(u => {
                        const isSelected = selectedMembers.some(m => m.id === u.id);
                        const userRolesStr = u.roles?.join(", ") || u.role || "";
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleMemberSelection(u, getAutoRole(u))}
                            className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded transition-colors ${
                              isSelected ? "bg-primary/20 text-primary font-medium" : "hover:bg-muted text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                              <span>{u.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{userRolesStr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {otherUsers.length > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground font-medium mb-2">Outros colaboradores</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {otherUsers.map(u => {
                        const isSelected = selectedMembers.some(m => m.id === u.id);
                        const autoRole = u.roles?.[0] || u.role || "";
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleMemberSelection(u, autoRole)}
                            className={`w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded transition-colors ${
                              isSelected ? "bg-primary/20 text-primary font-medium" : "hover:bg-muted text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-primary" />}
                              <span>{u.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{u.role}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
          <div className="flex gap-2 justify-end pt-2 sticky bottom-0 bg-card">
            <button onClick={() => setShowAddTeamModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleAddSelectedMembers} disabled={selectedMembers.length === 0} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              Adicionar {selectedMembers.length > 0 ? `(${selectedMembers.length})` : ""}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Recurring Service Modal */}
      <Modal open={showAddRecurringModal} onClose={() => setShowAddRecurringModal(false)} title="Novo Serviço Recorrente">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Serviço *</label>
            <select value={recServiceName} onChange={e => setRecServiceName(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {recurringServiceTemplates.map(t => (
                <option key={t.name} value={t.name}>{t.name} ({frequencyLabels[t.defaultFreq]})</option>
              ))}
              <option value="__custom__">+ Personalizado</option>
            </select>
          </div>
          {recServiceName === "__custom__" && (
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Nome do serviço *</label>
              <input value={recServiceCustomName} onChange={e => setRecServiceCustomName(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" placeholder="Ex: Revisar anúncios" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Responsável *</label>
            <select value={recServiceAssignee} onChange={e => setRecServiceAssignee(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {assignedTeam.length > 0 ? (
                assignedTeam.map(a => (
                  <option key={a.memberId} value={a.memberId}>{a.memberName} ({a.role})</option>
                ))
              ) : (
                users.filter(u => u.active).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Frequência</label>
              <select value={recServiceFreq} onChange={e => setRecServiceFreq(e.target.value as RecurringService["frequency"])} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="por_demanda">Por demanda</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Qtd por ciclo (opcional)</label>
              <input type="number" value={recServiceQty} onChange={e => setRecServiceQty(Number(e.target.value))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" placeholder="Ex: 5" min={0} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowAddRecurringModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleAddRecurringService} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Criar Serviço</button>
          </div>
        </div>
      </Modal>

      {/* Request Quote Modal */}
      <Modal open={showRequestModal} onClose={() => setShowRequestModal(false)} title="Solicitar Orçamento de Serviço">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Serviço Solicitado *</label>
            <select value={newService} onChange={e => setNewService(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {availableServices.filter(s => !client.services.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Solicitado por *</label>
            <input type="text" value={newRequestedBy} onChange={e => setNewRequestedBy(e.target.value)} placeholder="Nome do colaborador" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Observações</label>
            <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Contexto..." rows={3} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowRequestModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleRequestQuote} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Registrar Solicitação</button>
          </div>
        </div>
      </Modal>

      {/* Add Service Modal */}
      <Modal open={showAddServiceModal} onClose={() => setShowAddServiceModal(false)} title="Adicionar Serviço">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Selecione o serviço</label>
            <div className="grid grid-cols-2 gap-2">
              {availableServices.filter(s => !client.services.includes(s)).map(s => (
                <button key={s} onClick={() => setSelectedService(s)} className={`text-left text-xs px-3 py-2 rounded-md border transition-colors ${selectedService === s ? "bg-primary/10 border-primary text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowAddServiceModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={() => {
              if (!selectedService) { toast.error("Selecione um serviço"); return; }
              updateClient(client.id, { services: [...client.services, selectedService] });
              toast.success(`Serviço "${selectedService}" adicionado!`);
              setSelectedService(""); setShowAddServiceModal(false);
            }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Adicionar</button>
          </div>
        </div>
      </Modal>

      {/* Edit Monthly Value Modal */}
      <Modal open={showEditValueModal} onClose={() => setShowEditValueModal(false)} title="Alterar Valor do Contrato">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Valor mensal atual</label>
            <p className="text-sm font-mono text-muted-foreground mb-3">{formatCurrency(client.monthlyValue)}</p>
            <label className="text-xs font-medium text-foreground block mb-1.5">Novo valor mensal (R$)</label>
            <input type="number" value={editMonthlyValue} onChange={e => setEditMonthlyValue(Number(e.target.value))} className="w-full px-3 py-2 rounded-md border bg-background text-sm font-mono text-foreground" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowEditValueModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={() => {
              updateClient(client.id, { monthlyValue: editMonthlyValue });
              toast.success("Valor atualizado!"); setShowEditValueModal(false);
            }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
