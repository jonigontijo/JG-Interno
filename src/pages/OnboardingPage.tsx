import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ONBOARDING_PIPELINE } from "@/data/onboardingPipeline";
import { toast } from "sonner";
import { CheckCircle, Circle, ChevronDown, ChevronRight, Play, Clock, User, Rocket, Lock, Filter, RotateCcw } from "lucide-react";
import type { Task } from "@/data/mockData";

const checklistItems = [
  "Briefing preenchido",
  "Acessos Meta",
  "Acessos Google",
  "Site / Landing / Domínio",
  "Pixel / Tag / GTM",
  "WhatsApp / CRM",
  "Oferta / Produto",
  "Objetivo principal",
  "Públicos",
  "Referências",
  "Cronograma inicial",
  "Responsáveis internos definidos",
];

const accessFields = [
  { key: "meta_login", label: "Login Meta (BM)" },
  { key: "meta_password", label: "Senha Meta" },
  { key: "google_login", label: "Login Google Ads" },
  { key: "google_password", label: "Senha Google Ads" },
  { key: "analytics_id", label: "ID Analytics" },
  { key: "gtm_id", label: "ID GTM" },
  { key: "pixel_id", label: "ID Pixel" },
  { key: "site_url", label: "URL do Site" },
  { key: "site_login", label: "Login Site/WordPress" },
  { key: "site_password", label: "Senha Site" },
  { key: "whatsapp", label: "WhatsApp do cliente" },
  { key: "crm_url", label: "URL CRM" },
  { key: "crm_login", label: "Login CRM" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook_page", label: "Página Facebook" },
  { key: "briefing_link", label: "Link do Briefing" },
  { key: "drive_folder", label: "Pasta Google Drive" },
  { key: "notes", label: "Observações gerais" },
];

export default function OnboardingPage() {
  const { clients, tasks, clientPipelines, startClientPipeline, forceAdvancePipeline, completeTask, startTask, updateOnboardingChecklist, updateOnboardingAccess, getOnboardingData, addTask, updateClient } = useAppStore();
  const { currentUser } = useAuthStore();
  const currentUserRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const isAdmin = currentUser?.isAdmin || false;
  const onboardingClients = clients.filter(c => c.status === "Onboarding" || c.status === "Financeiro" || c.status === "Devolvido Comercial");
  const operationClients = clients.filter(c => c.status === "Operação" && !clientPipelines.some(p => p.clientId === c.id));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"pipeline" | "all">("pipeline");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [returnModal, setReturnModal] = useState<{ clientId: string; stepTitle: string } | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const uniqueRoles = Array.from(new Set(ONBOARDING_PIPELINE.map(s => s.assignRole)));

  const matchesRoleFilter = (step: (typeof ONBOARDING_PIPELINE)[number]) => {
    if (roleFilter === "all") return true;
    if (roleFilter === "mine") {
      const myRoles = new Set(currentUserRoles.map(r => r.trim().toLowerCase()));
      return myRoles.has(step.assignRole.trim().toLowerCase());
    }
    return step.assignRole === roleFilter;
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCheckToggle = (clientId: string, item: string, currentlyChecked: boolean) => {
    updateOnboardingChecklist(clientId, item, !currentlyChecked);
    toast.success(!currentlyChecked ? `✓ ${item}` : `Desmarcado: ${item}`);
  };

  const handleAccessChange = (clientId: string, key: string, value: string) => {
    updateOnboardingAccess(clientId, key, value);
  };

  const handleStartPipeline = (clientId: string, company: string) => {
    startClientPipeline(clientId);
    toast.success(`Pipeline de onboarding iniciado para ${company}! Primeira tarefa criada.`);
  };

  const handleCompleteStep = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status === "pending") {
      startTask(taskId);
    }
    completeTask(taskId);
    toast.success("Etapa concluída! Próxima tarefa criada automaticamente.");
  };

  const handleReturnToSales = () => {
    if (!returnModal) return;
    const client = clients.find(c => c.id === returnModal.clientId);
    if (!client) return;

    const now = new Date();
    const returnTask: Task = {
      id: `t-return-${returnModal.clientId}-${Date.now()}`,
      title: `[Devolvido] Recontactar cliente - ${client.company}`,
      client: client.company,
      clientId: returnModal.clientId,
      module: "Comercial",
      sector: "Comercial",
      type: "manual",
      assignee: client.accountManager || "Joni",
      deadline: new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10),
      urgency: "priority",
      status: "pending",
      weight: 3,
      estimatedHours: 1,
      hasRework: false,
      createdAt: now.toISOString().slice(0, 10),
      description: `Cliente devolvido pelo Financeiro na etapa "${returnModal.stepTitle}". Motivo: ${returnReason || "Não informado"}. Necessário nova abordagem/negociação.`,
    };

    addTask(returnTask);
    updateClient(returnModal.clientId, { status: "Devolvido Comercial" });
    toast.success(`Cliente devolvido para ${client.accountManager || "Joni"}! Tarefa criada.`);
    setReturnModal(null);
    setReturnReason("");
  };

  const getPipelineForClient = (clientId: string) => {
    return clientPipelines.find(p => p.clientId === clientId);
  };

  const getTaskForStep = (clientId: string, stepOrder: number) => {
    return tasks.find(t => t.id === `t-pipe-${clientId}-${stepOrder}`);
  };

  return (
    <div>
      <PageHeader title="Onboarding" description="Pipeline sequencial e checklist de novos clientes" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("pipeline")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "pipeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted/30"}`}
        >
          Em Onboarding ({onboardingClients.length})
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground bg-muted/30"}`}
        >
          Iniciar Pipeline ({operationClients.length})
        </button>
      </div>

      {tab === "all" && (
        <div className="grid gap-3 mb-6">
          <p className="text-xs text-muted-foreground mb-2">Clientes sem pipeline de onboarding. Clique para iniciar o fluxo.</p>
          {operationClients.map(client => (
            <div key={client.id} className="rounded-lg border bg-card p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{client.company}</h3>
                <p className="text-xs text-muted-foreground">{client.services.join(" · ")}</p>
              </div>
              <button
                onClick={() => handleStartPipeline(client.id, client.company)}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Rocket className="w-3.5 h-3.5" /> Iniciar Onboarding
              </button>
            </div>
          ))}
          {operationClients.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Todos os clientes já possuem pipeline ativo</div>
          )}
        </div>
      )}

      {tab === "pipeline" && (
        <div className="grid gap-4">
          {/* Filtro por responsável */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mr-1">Responsável:</span>
            <button
              onClick={() => setRoleFilter("all")}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${roleFilter === "all" ? "bg-primary/15 text-primary border-primary/30 font-semibold" : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"}`}
            >
              Todas
            </button>
            {currentUserRoles.length > 0 && (
              <button
                onClick={() => setRoleFilter("mine")}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${roleFilter === "mine" ? "bg-primary/15 text-primary border-primary/30 font-semibold" : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"}`}
              >
                Minhas tarefas
              </button>
            )}
            {uniqueRoles.map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${roleFilter === role ? "bg-primary/15 text-primary border-primary/30 font-semibold" : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"}`}
              >
                {role}
              </button>
            ))}
          </div>

          {onboardingClients.filter(client => {
            if (roleFilter === "all") return true;
            const pipeline = getPipelineForClient(client.id);
            const filteredSteps = ONBOARDING_PIPELINE.filter(matchesRoleFilter);
            if (filteredSteps.length === 0) return false;
            const hasRelevantPending = filteredSteps.some(step => {
              const completed = pipeline?.completedSteps.includes(step.order);
              return !completed;
            });
            return hasRelevantPending;
          }).map(client => {
            const ob = getOnboardingData(client.id);
            const pipeline = getPipelineForClient(client.id);
            const checkedCount = checklistItems.filter(item => ob.checklist[item]).length;
            const isExpanded = expanded[client.id];
            const filteredPipelineSteps = ONBOARDING_PIPELINE.filter(matchesRoleFilter);
            const completedSteps = pipeline?.completedSteps.length || 0;
            const totalSteps = ONBOARDING_PIPELINE.length;
            const filteredCompleted = filteredPipelineSteps.filter(s => pipeline?.completedSteps.includes(s.order)).length;

            return (
              <div key={client.id} className="rounded-lg border bg-card">
                <button
                  onClick={() => toggleExpand(client.id)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{client.company}</h3>
                    <p className="text-xs text-muted-foreground">{client.services.join(" · ")} · Gerente: {client.accountManager}</p>
                    {pipeline && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${roleFilter === "all" ? (completedSteps / totalSteps) * 100 : (filteredPipelineSteps.length > 0 ? (filteredCompleted / filteredPipelineSteps.length) * 100 : 0)}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {roleFilter === "all" ? `${completedSteps}/${totalSteps}` : `${filteredCompleted}/${filteredPipelineSteps.length}`} etapas
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={client.status === "Devolvido Comercial" ? "returned_to_sales" : client.status === "Onboarding" ? "kickoff_in_progress" : "kickoff_pending"} />
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-6">
                    {/* Pipeline Steps */}
                    {pipeline && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline de Onboarding</h4>
                        <div className="space-y-2">
                          {ONBOARDING_PIPELINE.filter(matchesRoleFilter).map((step) => {
                            const isCompleted = pipeline.completedSteps.includes(step.order);
                            const isCurrent = pipeline.currentStepOrder === step.order && !pipeline.completedAt;
                            const isLocked = step.order > pipeline.currentStepOrder && !isCompleted;
                            const task = getTaskForStep(client.id, step.order);

                            return (
                              <div
                                key={step.id}
                                className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                                  isCompleted
                                    ? "bg-success/5 border-success/20"
                                    : isCurrent
                                    ? "bg-primary/5 border-primary/30"
                                    : "bg-muted/10 border-border/50 opacity-50"
                                }`}
                              >
                                <div className="flex-shrink-0">
                                  {isCompleted ? (
                                    <CheckCircle className="w-5 h-5 text-success" />
                                  ) : isCurrent ? (
                                    <Clock className="w-5 h-5 text-primary animate-pulse" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground/40" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-muted-foreground">#{step.order}</span>
                                    <span className={`text-xs font-medium ${isCompleted ? "text-success" : isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                                      {step.title}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground truncate">{step.description}</p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                                      <User className="w-3 h-3" /> {step.assignRole}
                                    </span>
                                    {task && (
                                      <span className="text-[9px] text-muted-foreground">
                                        → {task.assignee}
                                      </span>
                                    )}
                                    <span className="text-[9px] text-muted-foreground">{step.estimatedHours}h</span>
                                  </div>
                                </div>
                                {isCurrent && (() => {
                                  const normalizedCurrentRoles = new Set(
                                    (currentUserRoles || [])
                                      .map(r => (r || "").toString().trim().toLowerCase())
                                      .filter(Boolean)
                                  );
                                  const canComplete = isAdmin || step.allowedRoles.some(r => normalizedCurrentRoles.has(r.trim().toLowerCase()));
                                  const isStuck = !task || task.status === "done";

                                  const isFinanceiroStep = step.assignRole === "Financeiro";

                                  if (!canComplete) return (
                                    <span className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium cursor-not-allowed" title={`Apenas: ${step.allowedRoles.join(", ")}`}>
                                      <Lock className="w-3 h-3" /> Sem permissão
                                    </span>
                                  );

                                  if (isStuck) return (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {isFinanceiroStep && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setReturnModal({ clientId: client.id, stepTitle: step.title }); }}
                                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors"
                                          title="Devolver cliente para o comercial"
                                        >
                                          <RotateCcw className="w-3 h-3" /> Devolver
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); forceAdvancePipeline(client.id); toast.success("Etapa concluída! Pipeline avançado."); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-warning text-warning-foreground text-[10px] font-medium hover:bg-warning/90 transition-colors"
                                      >
                                        <CheckCircle className="w-3 h-3" /> Concluir Etapa
                                      </button>
                                    </div>
                                  );

                                  return (
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {isFinanceiroStep && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setReturnModal({ clientId: client.id, stepTitle: step.title }); }}
                                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors"
                                          title="Devolver cliente para o comercial"
                                        >
                                          <RotateCcw className="w-3 h-3" /> Devolver
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCompleteStep(task.id); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors"
                                      >
                                        <CheckCircle className="w-3 h-3" /> Concluir
                                      </button>
                                    </div>
                                  );
                                })()}
                                {isCompleted && task?.completedAt && (
                                  <span className="text-[9px] text-success font-mono flex-shrink-0">
                                    ✓ {new Date(task.completedAt).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Checklist */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Checklist do Kickoff ({checkedCount}/{checklistItems.length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {checklistItems.map((item) => {
                          const checked = ob.checklist[item] || false;
                          return (
                            <button
                              key={item}
                              onClick={() => handleCheckToggle(client.id, item, checked)}
                              className={`flex items-center gap-2 p-2.5 rounded-md text-xs text-left transition-colors ${checked ? "text-success bg-success/5 hover:bg-success/10" : "text-muted-foreground bg-muted/30 hover:bg-muted/50"}`}
                            >
                              {checked ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <Circle className="w-4 h-4 flex-shrink-0" />}
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Access Data */}
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados de Acesso e Informações</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {accessFields.map(field => (
                          <div key={field.key}>
                            <label className="text-[10px] font-medium text-muted-foreground block mb-1">{field.label}</label>
                            {field.key === "notes" ? (
                              <textarea
                                value={ob.accessData[field.key] || ""}
                                onChange={(e) => handleAccessChange(client.id, field.key, e.target.value)}
                                placeholder={`Inserir ${field.label.toLowerCase()}...`}
                                className="w-full px-2.5 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground h-16 resize-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={ob.accessData[field.key] || ""}
                                onChange={(e) => handleAccessChange(client.id, field.key, e.target.value)}
                                placeholder={`Inserir ${field.label.toLowerCase()}...`}
                                className="w-full px-2.5 py-1.5 rounded-md border bg-background text-xs text-foreground placeholder:text-muted-foreground"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {onboardingClients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum cliente em onboarding. Vá na aba "Iniciar Pipeline" para começar.</div>
          )}
        </div>
      )}
      {/* Modal Devolver para Comercial */}
      {returnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReturnModal(null)}>
          <div className="bg-card border rounded-lg shadow-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Devolver para Comercial</h3>
                <p className="text-xs text-muted-foreground">
                  {clients.find(c => c.id === returnModal.clientId)?.company} — Etapa: {returnModal.stepTitle}
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Motivo da devolução</label>
              <textarea
                autoFocus
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="Ex: Cliente quer renegociar valores, não respondeu sobre assinatura..."
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground h-24 resize-none"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Uma tarefa será criada para <strong>{clients.find(c => c.id === returnModal.clientId)?.accountManager || "Joni"}</strong> recontactar o cliente. O pipeline ficará pausado até a situação ser resolvida.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setReturnModal(null); setReturnReason(""); }} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleReturnToSales}
                className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
              >
                Devolver para Comercial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
