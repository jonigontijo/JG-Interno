import { create } from "zustand";
import { Client, Task, Lead, TeamMember, RecurringService, ClientTeamAssignment, mockClients, mockTasks, mockLeads, mockTeam } from "@/data/mockData";
import { ONBOARDING_PIPELINE, PipelineStep } from "@/data/onboardingPipeline";
import { loadAllData, setSyncingFlag, mapTaskToDB, mapClientToDB, mapLeadToDB, mapTeamToDB, mapQuoteToDB, mapRequestToDB, mapProductivityToDB } from "@/lib/supabaseData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function db(table: string) {
  return (supabase as any).from(table);
}

export interface QuoteRequest {
  id: string;
  clientId: string;
  clientName: string;
  service: string;
  requestedBy: string;
  requestedAt: string;
  notes: string;
  status: "pending" | "proposal_sent" | "approved" | "paid" | "cancelled";
  proposalValue?: number;
  proposalSentAt?: string;
  approvedAt?: string;
  paidAt?: string;
}

export interface InternalRequest {
  id: string;
  title: string;
  description: string;
  requesterId: string;
  requesterName: string;
  assignedToName: string;
  assignedToId: string;
  clientId?: string;
  clientName?: string;
  department: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled" | "redistributed";
  createdAt: string;
  dueDate?: string;
  taskId?: string;
  redistributedTo?: string;
  redistributedBy?: string;
  attachments?: string[];
}

export interface ProductivityRecord {
  userId: string;
  userName: string;
  tasksCompletedToday: number;
  avgTasksPerDay: number;
  totalTasksCompleted: number;
  totalDaysWorked: number;
  lastUpdated: string;
}

export interface SettingItem {
  id: string;
  category: string;
  label: string;
  value: string;
  type: "text" | "select" | "number";
  options?: string[];
}

export interface OnboardingData {
  clientId: string;
  checklist: Record<string, boolean>;
  accessData: Record<string, string>;
}

export interface ClientPipelineState {
  clientId: string;
  currentStepOrder: number;
  completedSteps: number[];
  startedAt: string;
  completedAt?: string;
}

export interface AppState {
  clients: Client[];
  tasks: Task[];
  leads: Lead[];
  team: TeamMember[];
  quoteRequests: QuoteRequest[];
  onboardingData: OnboardingData[];
  clientPipelines: ClientPipelineState[];
  requests: InternalRequest[];
  productivity: ProductivityRecord[];
  notifications: { module: string; count: number }[];
  settings: SettingItem[];

  // Load from DB & reset
  loadFromDB: () => Promise<void>;
  reset: () => void;

  // Settings actions
  updateSetting: (id: string, value: string) => void;
  addSetting: (setting: SettingItem) => void;
  removeSetting: (id: string) => void;

  // Client actions
  addClient: (client: Client) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  removeClient: (id: string) => void;
  startClientPipeline: (clientId: string) => void;
  forceAdvancePipeline: (clientId: string) => void;

  // Client team & recurring services
  assignTeamMemberToClient: (clientId: string, assignment: ClientTeamAssignment) => void;
  removeTeamMemberFromClient: (clientId: string, memberId: string) => void;
  addRecurringService: (clientId: string, service: RecurringService) => void;
  updateRecurringService: (clientId: string, serviceId: string, data: Partial<RecurringService>) => void;
  removeRecurringService: (clientId: string, serviceId: string) => void;
  generateRecurringTasks: (clientId: string) => void;

  // Task actions
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => Promise<void>;
  pauseTask: (id: string) => Promise<void>;
  resumeTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;

  // Lead actions
  addLead: (lead: Lead) => void;
  updateLead: (id: string, data: Partial<Lead>) => void;

  // Team actions
  addTeamMember: (member: TeamMember) => void;
  updateTeamMember: (id: string, data: Partial<TeamMember>) => void;
  removeTeamMember: (id: string) => void;

  // Quote request actions
  addQuoteRequest: (qr: QuoteRequest) => void;
  updateQuoteRequest: (id: string, data: Partial<QuoteRequest>) => void;
  completeQuoteRequest: (id: string) => void;

  // Internal request actions
  addRequest: (req: InternalRequest) => void;
  updateRequest: (id: string, data: Partial<InternalRequest>) => void;
  deleteRequest: (id: string) => void;
  redistributeRequest: (id: string, newAssigneeId: string, newAssigneeName: string, redistributedBy: string) => void;
  getRequestsForUser: (userName: string) => InternalRequest[];
  getPendingRequestsCount: (userName: string) => number;

  // Productivity
  getProductivity: (userName: string) => ProductivityRecord;
  getWorkloadSuggestion: (department: string) => { name: string; load: number; avgPerDay: number; pendingTasks: number }[];

  // Onboarding actions
  updateOnboardingChecklist: (clientId: string, item: string, checked: boolean) => void;
  updateOnboardingAccess: (clientId: string, key: string, value: string) => void;
  getOnboardingData: (clientId: string) => OnboardingData;

  // Audit
  logAudit: (userName: string, action: string, entity: string, entityId?: string) => void;

  // Notifications
  getNotifications: () => { module: string; count: number }[];
}

const DEFAULT_SETTINGS: SettingItem[] = [
  { id: "s1", category: "Empresa", label: "Nome da Empresa", value: "JG - Joni Gontijo Gestão & Tráfego Pago", type: "text" },
  { id: "s2", category: "Empresa", label: "Fuso Horário", value: "America/Sao_Paulo (GMT-3)", type: "text" },
  { id: "s3", category: "SLAs", label: "SLA Padrão - Contrato", value: "24 horas", type: "text" },
  { id: "s4", category: "SLAs", label: "SLA Padrão - NF", value: "24 horas", type: "text" },
  { id: "s5", category: "SLAs", label: "SLA Padrão - Kickoff", value: "24 horas após liberação", type: "text" },
  { id: "s6", category: "Social Media", label: "Frequência de Postagem", value: "3x, 5x ou 7x por semana (conforme contrato)", type: "text" },
  { id: "s7", category: "Social Media", label: "Opções de Postagem", value: "3x, 5x, 7x", type: "text" },
  { id: "s8", category: "Social Media", label: "Frequência de Gravação", value: "A cada 15 dias", type: "text" },
  { id: "s9", category: "Tráfego", label: "Gravação de Tráfego", value: "Por demanda (sem padrão fixo)", type: "text" },
  { id: "s10", category: "Operação", label: "Capacidade Máxima por Colaborador", value: "40 horas/semana", type: "text" },
];

export const useAppStore = create<AppState>()((set, get) => ({
  clients: [],
  tasks: [],
  leads: [],
  team: [],
  quoteRequests: [],
  onboardingData: [],
  clientPipelines: [],
  requests: [],
  productivity: [],
  notifications: [],
  settings: [],

  loadFromDB: async () => {
    setSyncingFlag(true);
    try {
      const data = await loadAllData();

      // Only use mock data if DB is connected but genuinely empty (first-time setup)
      const isFirstSetup = data._dbConnected &&
        data.clients.length === 0 && data.tasks.length === 0 &&
        data.team.length === 0 && data.leads.length === 0;

      if (isFirstSetup) {
        console.log('First-time setup: seeding with default data');
        set({
          clients: [...mockClients],
          tasks: [...mockTasks],
          leads: [...mockLeads],
          team: [...mockTeam],
          quoteRequests: [],
          requests: [],
          clientPipelines: [],
          onboardingData: [],
          settings: DEFAULT_SETTINGS,
          productivity: [],
        });
        // Allow sync to write seed data to DB
        setSyncingFlag(false);
        return;
      }

      set({
        clients: data.clients,
        tasks: data.tasks,
        leads: data.leads,
        team: data.team,
        quoteRequests: data.quoteRequests,
        requests: data.requests,
        clientPipelines: data.clientPipelines,
        onboardingData: data.onboardingData,
        settings: data.settings.length > 0 ? data.settings : DEFAULT_SETTINGS,
        productivity: data.productivity,
      });
    } catch (err) {
      console.error('Error loading data from DB:', err);
      toast.error('Erro ao carregar dados do banco. Verifique sua conexão.');
      // Do NOT fall back to mock data - keep whatever is in the store
      // This prevents overwriting real data with fake data
    } finally {
      setSyncingFlag(false);
    }
  },

  reset: () => {
    set({
      clients: [],
      tasks: [],
      leads: [],
      team: [],
      quoteRequests: [],
      onboardingData: [],
      clientPipelines: [],
      requests: [],
      productivity: [],
      notifications: [],
      settings: [],
    });
  },

  addClient: (client) => {
    const team = get().team;
    const firstStep = ONBOARDING_PIPELINE[0];
    
    const findByRole = (role: string) => {
      return team.find(m => 
        m.role.toLowerCase().includes(role.toLowerCase()) ||
        m.roles.some(r => r.toLowerCase().includes(role.toLowerCase()))
      );
    };

    const assignee = findByRole(firstStep.assignRole);
    const now = new Date();
    const deadline = new Date(now.getTime() + firstStep.deadlineDays * 86400000);

    const pipelineTask: Task = {
      id: `t-pipe-${client.id}-${firstStep.order}`,
      title: `[Onboarding] ${firstStep.title}`,
      client: client.company,
      clientId: client.id,
      module: firstStep.module,
      sector: "Onboarding",
      type: "pipeline",
      assignee: assignee?.name || "Não atribuído",
      deadline: deadline.toISOString().slice(0, 10),
      urgency: "priority",
      status: "pending",
      weight: 3,
      estimatedHours: firstStep.estimatedHours,
      hasRework: false,
      createdAt: now.toISOString().slice(0, 10),
    };

    const pipeline: ClientPipelineState = {
      clientId: client.id,
      currentStepOrder: 1,
      completedSteps: [],
      startedAt: now.toISOString(),
    };

    const newClient = { ...client, status: firstStep.clientStatus };
    set((s) => ({
      clients: [...s.clients, newClient],
      tasks: [...s.tasks, pipelineTask],
      clientPipelines: [...s.clientPipelines, pipeline],
    }));
    // Direct DB writes for client, task, and pipeline
    db('clients').upsert(mapClientToDB(newClient)).then(({ error }: any) => {
      if (error) console.error('Direct addClient DB write failed:', error);
    });
    db('tasks').upsert(mapTaskToDB(pipelineTask)).then(({ error }: any) => {
      if (error) console.error('Direct addClient pipeline task DB write failed:', error);
    });
    db('client_pipelines').upsert({
      client_id: pipeline.clientId, current_step_order: pipeline.currentStepOrder,
      completed_steps: pipeline.completedSteps, started_at: pipeline.startedAt,
    }).then(({ error }: any) => {
      if (error) console.error('Direct addClient pipeline DB write failed:', error);
    });
  },
  startClientPipeline: (clientId) => {
    const state = get();
    if (state.clientPipelines.some(p => p.clientId === clientId)) {
      console.warn("Pipeline já iniciado para este cliente.");
      return;
    }
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const firstStep = ONBOARDING_PIPELINE[0];
    const team = state.team;
    const findByRole = (role: string) => {
      return team.find(m =>
        m.role.toLowerCase().includes(role.toLowerCase()) ||
        m.roles.some(r => r.toLowerCase().includes(role.toLowerCase()))
      );
    };
    const assignee = findByRole(firstStep.assignRole);
    const now = new Date();
    const deadline = new Date(now.getTime() + firstStep.deadlineDays * 86400000);

    const pipelineTask: Task = {
      id: `t-pipe-${clientId}-${firstStep.order}`,
      title: `[Onboarding] ${firstStep.title}`,
      client: client.company,
      clientId: clientId,
      module: firstStep.module,
      sector: "Onboarding",
      type: "pipeline",
      assignee: assignee?.name || "Não atribuído",
      deadline: deadline.toISOString().slice(0, 10),
      urgency: "priority",
      status: "pending",
      weight: 3,
      estimatedHours: firstStep.estimatedHours,
      hasRework: false,
      createdAt: now.toISOString().slice(0, 10),
    };

    const pipeline: ClientPipelineState = {
      clientId,
      currentStepOrder: 1,
      completedSteps: [],
      startedAt: now.toISOString(),
    };

    set((s) => ({
      clients: s.clients.map(c => c.id === clientId ? { ...c, status: firstStep.clientStatus } : c),
      tasks: [...s.tasks, pipelineTask],
      clientPipelines: [...s.clientPipelines, pipeline],
    }));
  },
  forceAdvancePipeline: (clientId) => {
    const state = get();
    const pipeline = state.clientPipelines.find(p => p.clientId === clientId);
    if (!pipeline || pipeline.completedAt) return;
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const currentStep = ONBOARDING_PIPELINE.find(s => s.order === pipeline.currentStepOrder);
    const nextStep = ONBOARDING_PIPELINE.find(s => s.order === pipeline.currentStepOrder + 1);
    const now = new Date();

    const currentTaskId = `t-pipe-${clientId}-${pipeline.currentStepOrder}`;
    const currentTask = state.tasks.find(t => t.id === currentTaskId);
    const needsMarkDone = currentTask && currentTask.status !== "done";

    if (nextStep) {
      const team = state.team;
      const findByRole = (role: string) => team.find(m =>
        m.role.toLowerCase().includes(role.toLowerCase()) ||
        m.roles.some(r => r.toLowerCase().includes(role.toLowerCase()))
      );
      const assignee = findByRole(nextStep.assignRole);
      const deadline = new Date(now.getTime() + nextStep.deadlineDays * 86400000);

      const existingNextTask = state.tasks.find(t => t.id === `t-pipe-${clientId}-${nextStep.order}`);
      const nextTask: Task = {
        id: `t-pipe-${clientId}-${nextStep.order}`,
        title: `[Onboarding] ${nextStep.title}`,
        client: client.company,
        clientId,
        module: nextStep.module,
        sector: "Onboarding",
        type: "pipeline",
        assignee: assignee?.name || "Não atribuído",
        deadline: deadline.toISOString().slice(0, 10),
        urgency: "priority",
        status: "pending",
        weight: 3,
        estimatedHours: nextStep.estimatedHours,
        hasRework: false,
        createdAt: now.toISOString().slice(0, 10),
      };

      set((s) => ({
        tasks: [
          ...s.tasks.map(t => {
            if (t.id === currentTaskId && needsMarkDone) return { ...t, status: "done" as const, completedAt: now.toISOString() };
            return t;
          }),
          ...(existingNextTask ? [] : [nextTask]),
        ],
        clientPipelines: s.clientPipelines.map(p =>
          p.clientId === clientId
            ? { ...p, currentStepOrder: nextStep.order, completedSteps: [...new Set([...p.completedSteps, pipeline.currentStepOrder])] }
            : p
        ),
        clients: s.clients.map(c =>
          c.id === clientId ? { ...c, status: nextStep.clientStatus } : c
        ),
      }));
    } else {
      set((s) => ({
        tasks: s.tasks.map(t => {
          if (t.id === currentTaskId && needsMarkDone) return { ...t, status: "done" as const, completedAt: now.toISOString() };
          return t;
        }),
        clientPipelines: s.clientPipelines.map(p =>
          p.clientId === clientId
            ? { ...p, completedSteps: [...new Set([...p.completedSteps, pipeline.currentStepOrder])], completedAt: now.toISOString() }
            : p
        ),
        clients: s.clients.map(c =>
          c.id === clientId ? { ...c, status: "Operação", substatus: "Ativo" } : c
        ),
      }));
    }
  },
  updateClient: (id, data) => {
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...data } : c)) }));
    // Direct DB write
    const client = get().clients.find(c => c.id === id);
    if (client) {
      db('clients').upsert(mapClientToDB(client)).then(({ error }: any) => {
        if (error) console.error('Direct updateClient DB write failed:', error);
      });
    }
  },
  removeClient: (id) => {
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
    db('clients').delete().eq('id', id).then(({ error }: any) => {
      if (error) console.error('Direct removeClient DB write failed:', error);
    });
  },

  assignTeamMemberToClient: (clientId, assignment) => {
    set((s) => ({
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, assignedTeam: [...(c.assignedTeam || []).filter(a => a.memberId !== assignment.memberId), assignment] }
        : c
      ),
    }));
    // Direct DB write - delete existing then insert
    db('client_team_assignments').delete()
      .eq('client_id', clientId)
      .eq('member_id', assignment.memberId)
      .then(() => {
        db('client_team_assignments').insert({
          client_id: clientId,
          member_id: assignment.memberId,
          member_name: assignment.memberName,
          role: assignment.role,
          designation: assignment.designation || 'titular',
        }).then(({ error }: any) => {
          if (error) {
            console.error('Direct assignTeam DB write failed:', error);
            toast.error('Erro ao salvar atribuição no banco');
          }
        });
      });
  },
  removeTeamMemberFromClient: (clientId, memberId) => {
    set((s) => ({
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, assignedTeam: (c.assignedTeam || []).filter(a => a.memberId !== memberId) }
        : c
      ),
    }));
    // Direct DB delete
    db('client_team_assignments').delete()
      .eq('client_id', clientId)
      .eq('member_id', memberId)
      .then(({ error }: any) => {
        if (error) console.error('Direct removeTeamMember DB write failed:', error);
      });
  },
  addRecurringService: (clientId, service) => {
    set((s) => ({
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, recurringServices: [...(c.recurringServices || []), service] }
        : c
      ),
    }));
    // Direct DB write
    db('client_recurring_services').upsert({
      id: service.id, client_id: clientId, name: service.name,
      assignee_id: service.assigneeId, assignee_name: service.assigneeName,
      frequency: service.frequency, quantity_per_cycle: service.quantityPerCycle,
      description: service.description, active: service.active,
    }).then(({ error }: any) => {
      if (error) console.error('Direct addRecurringService DB write failed:', error);
    });
  },
  updateRecurringService: (clientId, serviceId, data) => {
    set((s) => ({
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, recurringServices: (c.recurringServices || []).map(rs => rs.id === serviceId ? { ...rs, ...data } : rs) }
        : c
      ),
    }));
    // Direct DB update
    const client = get().clients.find(c => c.id === clientId);
    const svc = client?.recurringServices?.find(s => s.id === serviceId);
    if (svc) {
      db('client_recurring_services').upsert({
        id: svc.id, client_id: clientId, name: svc.name,
        assignee_id: svc.assigneeId, assignee_name: svc.assigneeName,
        frequency: svc.frequency, quantity_per_cycle: svc.quantityPerCycle,
        description: svc.description, active: svc.active,
      }).then(({ error }: any) => {
        if (error) console.error('Direct updateRecurringService DB write failed:', error);
      });
    }
  },
  removeRecurringService: (clientId, serviceId) => {
    set((s) => ({
      clients: s.clients.map(c => c.id === clientId
        ? { ...c, recurringServices: (c.recurringServices || []).filter(rs => rs.id !== serviceId) }
        : c
      ),
    }));
    // Direct DB delete
    db('client_recurring_services').delete().eq('id', serviceId).then(({ error }: any) => {
      if (error) console.error('Direct removeRecurringService DB write failed:', error);
    });
  },
  generateRecurringTasks: (clientId) => {
    const client = get().clients.find(c => c.id === clientId);
    if (!client) return;
    const services = (client.recurringServices || []).filter(s => s.active);
    const today = new Date().toISOString().slice(0, 10);
    const existingTasks = get().tasks;
    const newTasks: Task[] = [];
    for (const svc of services) {
      const alreadyExists = existingTasks.some(
        t => t.clientId === clientId && t.title.includes(svc.name) && t.createdAt === today && t.assignee === svc.assigneeName
      );
      if (alreadyExists) continue;
      newTasks.push({
        id: `t-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${svc.name}${svc.quantityPerCycle ? ` (${svc.quantityPerCycle}x)` : ""}`,
        client: client.company,
        clientId: client.id,
        module: svc.name.toLowerCase().includes("campanha") || svc.name.toLowerCase().includes("otimiz") ? "Tráfego" : "Produção",
        sector: "Operação",
        type: "recurring",
        assignee: svc.assigneeName,
        deadline: today,
        urgency: "normal",
        status: "pending",
        weight: 1,
        estimatedHours: 1,
        hasRework: false,
        createdAt: today,
      });
    }
    if (newTasks.length > 0) {
      set((s) => ({ tasks: [...s.tasks, ...newTasks] }));
      // Direct DB writes for all generated tasks
      for (const t of newTasks) {
        db('tasks').upsert(mapTaskToDB(t)).then(({ error }: any) => {
          if (error) console.error('Direct generateRecurringTasks DB write failed:', error);
        });
      }
    }
  },

  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }));
    // Direct DB write for reliability
    const mapped = mapTaskToDB(task);
    db('tasks').upsert(mapped).then(({ error }: any) => {
      if (error) {
        console.error('Direct addTask DB write failed:', error);
        toast.error('Erro ao salvar tarefa no banco');
      }
    });
  },
  updateTask: (id, data) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)) }));
    // Direct DB update
    const task = get().tasks.find(t => t.id === id);
    if (task) {
      const mapped = mapTaskToDB(task);
      db('tasks').upsert(mapped).then(({ error }: any) => {
        if (error) console.error('Direct updateTask DB write failed:', error);
      });
    }
  },
  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    db('tasks').delete().eq('id', id).then(({ error }: any) => {
      if (error) console.error('Direct deleteTask DB write failed:', error);
    });
  },

  startTask: async (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: "in_progress", startedAt: new Date().toISOString(), pausedAt: undefined } : t
      ),
    }));
    const task = get().tasks.find(t => t.id === id);
    if (task) {
      const { error } = await db('tasks').upsert(mapTaskToDB(task));
      if (error) console.error('Direct startTask DB write failed:', error);
    }
  },

  pauseTask: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (!task || !task.startedAt) return;
    const now = new Date();
    const sessionMinutes = Math.round((now.getTime() - new Date(task.startedAt).getTime()) / 60000);
    const accumulated = (task.accumulatedMinutes || 0) + sessionMinutes;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: "paused", pausedAt: now.toISOString(), accumulatedMinutes: accumulated } : t
      ),
    }));
    const updated = get().tasks.find(t => t.id === id);
    if (updated) {
      const { error } = await db('tasks').upsert(mapTaskToDB(updated));
      if (error) console.error('pauseTask DB:', error);
    }
  },

  resumeTask: async (id) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: "in_progress", startedAt: new Date().toISOString(), pausedAt: undefined } : t
      ),
    }));
    const updated = get().tasks.find(t => t.id === id);
    if (updated) {
      const { error } = await db('tasks').upsert(mapTaskToDB(updated));
      if (error) console.error('resumeTask DB:', error);
    }
  },

  completeTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const now = new Date();
    let timeSpent = task.accumulatedMinutes || 0;
    if (task.startedAt && task.status === "in_progress") {
      timeSpent += Math.round((now.getTime() - new Date(task.startedAt).getTime()) / 60000);
    }
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: "done", completedAt: now.toISOString(), timeSpentMinutes: timeSpent } : t
      ),
    }));
    // Direct DB write for completed task
    const completedTask = get().tasks.find(t => t.id === id);
    if (completedTask) {
      const { error } = await db('tasks').upsert(mapTaskToDB(completedTask));
      if (error) console.error('completeTask DB:', error);
    }

    // === Recurrence: recreate task based on frequency type ===
    if (task.recurUntil) {
      const calcNextDate = (from: Date): string => {
        const rtype = task.recurType || "daily";
        const d = new Date(from);
        if (rtype === "daily") d.setDate(d.getDate() + 1);
        else if (rtype === "weekly") d.setDate(d.getDate() + 7);
        else if (rtype === "monthly") d.setMonth(d.getMonth() + 1);
        else if (rtype === "yearly") d.setFullYear(d.getFullYear() + 1);
        else if (rtype === "custom") d.setDate(d.getDate() + (task.recurDaysInterval || 1));
        return d.toISOString().slice(0, 10);
      };
      const nextDate = calcNextDate(now);
      if (nextDate <= task.recurUntil) {
        const recurTask: Task = {
          id: `t-${Date.now()}-recur`,
          title: task.title,
          client: task.client,
          clientId: task.clientId,
          module: task.module,
          sector: task.sector,
          type: task.type,
          assignee: task.assignee,
          deadline: nextDate,
          urgency: task.urgency,
          status: "backlog",
          weight: task.weight,
          estimatedHours: task.estimatedHours,
          hasRework: false,
          createdAt: now.toISOString().slice(0, 10),
          description: task.description,
          recurUntil: task.recurUntil,
          recurType: task.recurType,
          recurDaysInterval: task.recurDaysInterval,
        };
        set((s) => ({ tasks: [...s.tasks, recurTask] }));
        const mapped = mapTaskToDB(recurTask);
        db('tasks').upsert(mapped).then(({ error: e }: any) => {
          if (e) console.error('Recurrence task DB write failed:', e);
        });
      }
    }

    // === Pipeline advancement ===
    if (task.type === "pipeline" && task.clientId) {
      const pipeline = get().clientPipelines.find(p => p.clientId === task.clientId);
      if (pipeline) {
        const currentStep = ONBOARDING_PIPELINE.find(s => s.order === pipeline.currentStepOrder);
        const nextStep = ONBOARDING_PIPELINE.find(s => s.order === pipeline.currentStepOrder + 1);
        
        if (nextStep) {
          const team = get().team;
          const findByRole = (role: string) => {
            return team.find(m => 
              m.role.toLowerCase().includes(role.toLowerCase()) ||
              m.roles.some(r => r.toLowerCase().includes(role.toLowerCase()))
            );
          };
          const assignee = findByRole(nextStep.assignRole);
          const deadline = new Date(now.getTime() + nextStep.deadlineDays * 86400000);

          const nextTask: Task = {
            id: `t-pipe-${task.clientId}-${nextStep.order}`,
            title: `[Onboarding] ${nextStep.title}`,
            client: task.client,
            clientId: task.clientId,
            module: nextStep.module,
            sector: "Onboarding",
            type: "pipeline",
            assignee: assignee?.name || "Não atribuído",
            deadline: deadline.toISOString().slice(0, 10),
            urgency: "priority",
            status: "pending",
            weight: 3,
            estimatedHours: nextStep.estimatedHours,
            hasRework: false,
            createdAt: now.toISOString().slice(0, 10),
          };

          set((s) => ({
            tasks: [...s.tasks, nextTask],
            clientPipelines: s.clientPipelines.map(p => 
              p.clientId === task.clientId
                ? { ...p, currentStepOrder: nextStep.order, completedSteps: [...p.completedSteps, pipeline.currentStepOrder] }
                : p
            ),
            clients: s.clients.map(c => 
              c.id === task.clientId ? { ...c, status: nextStep.clientStatus } : c
            ),
          }));
        } else {
          set((s) => ({
            clientPipelines: s.clientPipelines.map(p =>
              p.clientId === task.clientId
                ? { ...p, completedSteps: [...p.completedSteps, pipeline.currentStepOrder], completedAt: now.toISOString() }
                : p
            ),
            clients: s.clients.map(c =>
              c.id === task.clientId ? { ...c, status: "Operação", substatus: "Ativo" } : c
            ),
          }));
        }
      }
    }

    // Update productivity for the assignee
    const assignee = task.assignee;
    const today = now.toISOString().slice(0, 10);
    set((s) => {
      const existing = s.productivity.find((p) => p.userName === assignee);
      if (existing) {
        const isToday = existing.lastUpdated === today;
        const newCompleted = isToday ? existing.tasksCompletedToday + 1 : 1;
        const newTotal = existing.totalTasksCompleted + 1;
        const newDays = isToday ? existing.totalDaysWorked : existing.totalDaysWorked + 1;
        return {
          productivity: s.productivity.map((p) =>
            p.userName === assignee
              ? {
                  ...p,
                  tasksCompletedToday: newCompleted,
                  totalTasksCompleted: newTotal,
                  totalDaysWorked: newDays,
                  avgTasksPerDay: Math.round((newTotal / newDays) * 10) / 10,
                  lastUpdated: today,
                }
              : p
          ),
        };
      }
      return {
        productivity: [
          ...s.productivity,
          {
            userId: "",
            userName: assignee,
            tasksCompletedToday: 1,
            avgTasksPerDay: 1,
            totalTasksCompleted: 1,
            totalDaysWorked: 1,
            lastUpdated: today,
          },
        ],
      };
    });
  },

  addLead: (lead) => {
    set((s) => ({ leads: [...s.leads, lead] }));
    db('leads').upsert(mapLeadToDB(lead)).then(({ error }: any) => {
      if (error) console.error('Direct addLead DB write failed:', error);
    });
  },
  updateLead: (id, data) => {
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...data } : l)) }));
    const lead = get().leads.find(l => l.id === id);
    if (lead) {
      db('leads').upsert(mapLeadToDB(lead)).then(({ error }: any) => {
        if (error) console.error('Direct updateLead DB write failed:', error);
      });
    }
  },

  addTeamMember: (member) => {
    set((s) => ({ team: [...s.team, member] }));
    db('team_members').upsert(mapTeamToDB(member)).then(({ error }: any) => {
      if (error) console.error('Direct addTeamMember DB write failed:', error);
    });
  },
  updateTeamMember: (id, data) => {
    set((s) => ({ team: s.team.map((m) => (m.id === id ? { ...m, ...data } : m)) }));
    const member = get().team.find(m => m.id === id);
    if (member) {
      db('team_members').upsert(mapTeamToDB(member)).then(({ error }: any) => {
        if (error) console.error('Direct updateTeamMember DB write failed:', error);
      });
    }
  },
  removeTeamMember: (id) => {
    set((s) => ({ team: s.team.filter((m) => m.id !== id) }));
    // Delete from database
    db('team_members').delete().eq('id', id).then(({ error }: any) => {
      if (error) console.error('Error deleting team member from DB:', error);
      else console.log('Team member deleted from DB:', id);
    });
  },

  addQuoteRequest: (qr) => {
    set((s) => ({ quoteRequests: [...s.quoteRequests, qr] }));
    db('quote_requests').upsert(mapQuoteToDB(qr)).then(({ error }: any) => {
      if (error) console.error('Direct addQuoteRequest DB write failed:', error);
    });
  },
  updateQuoteRequest: (id, data) => {
    set((s) => ({ quoteRequests: s.quoteRequests.map((q) => (q.id === id ? { ...q, ...data } : q)) }));
    const qr = get().quoteRequests.find(q => q.id === id);
    if (qr) {
      db('quote_requests').upsert(mapQuoteToDB(qr)).then(({ error }: any) => {
        if (error) console.error('Direct updateQuoteRequest DB write failed:', error);
      });
    }
  },
  completeQuoteRequest: (id) => {
    const state = get();
    const qr = state.quoteRequests.find((q) => q.id === id);
    if (!qr) return;
    const client = state.clients.find((c) => c.id === qr.clientId);
    if (client && !client.services.includes(qr.service)) {
      set((s) => ({
        clients: s.clients.map((c) =>
          c.id === qr.clientId
            ? { ...c, services: [...c.services, qr.service], monthlyValue: c.monthlyValue + (qr.proposalValue || 0) }
            : c
        ),
        quoteRequests: s.quoteRequests.map((q) =>
          q.id === id ? { ...q, status: "paid" as const, paidAt: new Date().toISOString().slice(0, 10) } : q
        ),
      }));
      // Direct DB writes
      const updatedClient = get().clients.find(c => c.id === qr.clientId);
      if (updatedClient) db('clients').upsert(mapClientToDB(updatedClient)).then(({ error }: any) => { if (error) console.error('completeQuote client DB:', error); });
      const updatedQr = get().quoteRequests.find(q => q.id === id);
      if (updatedQr) db('quote_requests').upsert(mapQuoteToDB(updatedQr)).then(({ error }: any) => { if (error) console.error('completeQuote qr DB:', error); });
    }
  },

  // Internal Requests
  addRequest: (req) => {
    const taskId = `t-req-${Date.now()}`;
    const task: Task = {
      id: taskId,
      title: `[Requisição] ${req.title}`,
      client: "",
      clientId: "",
      module: req.department === "social_media" ? "Social Media" : req.department === "gestao_trafego" ? "Tráfego" : req.department === "financeiro" ? "Financeiro" : req.department === "producao" ? "Produção" : "Geral",
      sector: req.department,
      type: "Requisição",
      assignee: req.assignedToName,
      deadline: req.dueDate ? req.dueDate.slice(0, 10) : new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      urgency: req.priority === "urgent" ? "urgent" : req.priority === "high" ? "priority" : "normal",
      status: "pending",
      weight: req.priority === "urgent" ? 5 : req.priority === "high" ? 4 : 2,
      estimatedHours: 2,
      hasRework: false,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const fullReq = { ...req, taskId };
    set((s) => ({
      requests: [...s.requests, fullReq],
      tasks: [...s.tasks, task],
    }));
    // Direct DB writes
    db('internal_requests').upsert(mapRequestToDB(fullReq)).then(({ error }: any) => {
      if (error) console.error('Direct addRequest DB write failed:', error);
    });
    db('tasks').upsert(mapTaskToDB(task)).then(({ error }: any) => {
      if (error) console.error('Direct addRequest task DB write failed:', error);
    });
  },

  updateRequest: (id, data) => {
    set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
    const req = get().requests.find(r => r.id === id);
    if (req) {
      db('internal_requests').upsert(mapRequestToDB(req)).then(({ error }: any) => {
        if (error) console.error('Direct updateRequest DB write failed:', error);
      });
    }
  },

  deleteRequest: (id) => {
    const req = get().requests.find((r) => r.id === id);
    set((s) => ({
      requests: s.requests.filter((r) => r.id !== id),
      tasks: req?.taskId ? s.tasks.filter((t) => t.id !== req.taskId) : s.tasks,
    }));
    // Direct DB deletes
    db('internal_requests').delete().eq('id', id).then(({ error }: any) => {
      if (error) console.error('Direct deleteRequest DB write failed:', error);
    });
    if (req?.taskId) {
      db('tasks').delete().eq('id', req.taskId).then(({ error }: any) => {
        if (error) console.error('Direct deleteRequest task DB write failed:', error);
      });
    }
  },

  redistributeRequest: (id, newAssigneeId, newAssigneeName, redistributedBy) => {
    const req = get().requests.find((r) => r.id === id);
    if (!req) return;
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, assignedToId: newAssigneeId, assignedToName: newAssigneeName, redistributedBy, status: "pending" as const } : r
      ),
      tasks: req.taskId
        ? s.tasks.map((t) => (t.id === req.taskId ? { ...t, assignee: newAssigneeName } : t))
        : s.tasks,
    }));
    // Direct DB writes
    const updatedReq = get().requests.find(r => r.id === id);
    if (updatedReq) {
      db('internal_requests').upsert(mapRequestToDB(updatedReq)).then(({ error }: any) => {
        if (error) console.error('Direct redistributeRequest DB write failed:', error);
      });
    }
    if (req.taskId) {
      const updatedTask = get().tasks.find(t => t.id === req.taskId);
      if (updatedTask) {
        db('tasks').upsert(mapTaskToDB(updatedTask)).then(({ error }: any) => {
          if (error) console.error('Direct redistributeRequest task DB write failed:', error);
        });
      }
    }
  },

  getRequestsForUser: (userName) => {
    return get().requests.filter((r) => r.assignedToName === userName || r.requesterName === userName);
  },

  getPendingRequestsCount: (userName) => {
    return get().requests.filter((r) => r.assignedToName === userName && r.status === "pending").length;
  },

  // Productivity
  getProductivity: (userName) => {
    return get().productivity.find((p) => p.userName === userName) || {
      userId: "",
      userName,
      tasksCompletedToday: 0,
      avgTasksPerDay: 0,
      totalTasksCompleted: 0,
      totalDaysWorked: 0,
      lastUpdated: "",
    };
  },

  getWorkloadSuggestion: (department) => {
    const s = get();
    const moduleName = department === "social_media" ? "Social Media" : department === "gestao_trafego" ? "Tráfego" : department === "producao" ? "Produção" : department === "financeiro" ? "Financeiro" : "";

    return s.team
      .filter((m) => {
        if (!moduleName) return true;
        return m.specialty.some((sp) => sp.toLowerCase().includes(moduleName.toLowerCase())) || m.role.toLowerCase().includes(moduleName.toLowerCase());
      })
      .map((m) => {
        const pendingTasks = s.tasks.filter((t) => t.assignee === m.name && t.status !== "done").length;
        const prod = s.productivity.find((p) => p.userName === m.name);
        return {
          name: m.name,
          load: m.currentLoad,
          avgPerDay: prod?.avgTasksPerDay || 0,
          pendingTasks,
        };
      })
      .sort((a, b) => a.pendingTasks - b.pendingTasks);
  },

  updateOnboardingChecklist: (clientId, item, checked) => {
    set((s) => {
      const existing = s.onboardingData.find((o) => o.clientId === clientId);
      if (existing) {
        return { onboardingData: s.onboardingData.map((o) => o.clientId === clientId ? { ...o, checklist: { ...o.checklist, [item]: checked } } : o) };
      }
      return { onboardingData: [...s.onboardingData, { clientId, checklist: { [item]: checked }, accessData: {} }] };
    });
  },

  updateOnboardingAccess: (clientId, key, value) => {
    set((s) => {
      const existing = s.onboardingData.find((o) => o.clientId === clientId);
      if (existing) {
        return { onboardingData: s.onboardingData.map((o) => o.clientId === clientId ? { ...o, accessData: { ...o.accessData, [key]: value } } : o) };
      }
      return { onboardingData: [...s.onboardingData, { clientId, checklist: {}, accessData: { [key]: value } }] };
    });
  },

  getOnboardingData: (clientId) => {
    return get().onboardingData.find((o) => o.clientId === clientId) || { clientId, checklist: {}, accessData: {} };
  },

  getNotifications: () => {
    const s = get();
    const overdue = s.tasks.filter((t) => t.status === "overdue").length;
    const pendingApprovals = s.tasks.filter((t) => t.status === "approval").length;
    const pendingQuotes = s.quoteRequests.filter((q) => q.status === "pending").length;
    const waitingClient = s.tasks.filter((t) => t.status === "waiting_client").length;
    const blocked = s.tasks.filter((t) => t.status === "blocked").length;
    const pendingRequests = s.requests.filter((r) => r.status === "pending").length;
    return [
      { module: "tasks", count: overdue },
      { module: "approvals", count: pendingApprovals },
      { module: "quotes", count: pendingQuotes },
      { module: "waiting", count: waitingClient },
      { module: "blocked", count: blocked },
      { module: "requests", count: pendingRequests },
    ].filter((n) => n.count > 0);
  },

  logAudit: (userName, action, entity, entityId) => {
    db('audit_logs').insert({ user_name: userName, action, entity, entity_id: entityId || null }).then(({ error }: any) => {
      if (error) console.error('Audit log write failed:', error);
    });
  },

  // Settings actions
  updateSetting: (id, value) => set((s) => ({
    settings: s.settings.map(st => st.id === id ? { ...st, value } : st),
  })),
  addSetting: (setting) => set((s) => ({
    settings: [...s.settings, setting],
  })),
  removeSetting: (id) => set((s) => ({
    settings: s.settings.filter(st => st.id !== id),
  })),
}));
