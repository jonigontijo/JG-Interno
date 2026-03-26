import type { Client, Task, Lead, TeamMember, RecurringService, ClientTeamAssignment } from "@/data/mockData";

export type { Client, Task, Lead, TeamMember, RecurringService, ClientTeamAssignment };

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

export interface ClientDnaLink { label: string; url: string; }
export interface ClientDnaCredential { label: string; value: string; }
export interface ClientDnaDate { label: string; date: string; }
export interface ClientDna {
  clientId: string;
  links: ClientDnaLink[];
  notes: Record<string, string>;
  credentials: ClientDnaCredential[];
  importantDates: ClientDnaDate[];
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
  clientDna: ClientDna[];
  clientPipelines: ClientPipelineState[];
  requests: InternalRequest[];
  productivity: ProductivityRecord[];
  notifications: { module: string; count: number }[];
  settings: SettingItem[];

  loadFromDB: () => Promise<void>;
  reloadClients: () => Promise<void>;
  reloadTasks: () => Promise<void>;
  reloadTeam: () => Promise<void>;
  reloadLeads: () => Promise<void>;
  reloadQuotes: () => Promise<void>;
  reloadRequests: () => Promise<void>;
  reset: () => void;

  updateSetting: (id: string, value: string) => void;
  addSetting: (setting: SettingItem) => void;
  removeSetting: (id: string) => void;

  addClient: (client: Client) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  removeClient: (id: string) => void;
  startClientPipeline: (clientId: string) => void;
  forceAdvancePipeline: (clientId: string) => void;

  assignTeamMemberToClient: (clientId: string, assignment: ClientTeamAssignment) => void;
  removeTeamMemberFromClient: (clientId: string, memberId: string) => void;
  addRecurringService: (clientId: string, service: RecurringService) => void;
  updateRecurringService: (clientId: string, serviceId: string, data: Partial<RecurringService>) => void;
  removeRecurringService: (clientId: string, serviceId: string) => void;
  generateRecurringTasks: (clientId: string) => void;

  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => Promise<void>;
  pauseTask: (id: string) => Promise<void>;
  resumeTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;

  addLead: (lead: Lead) => void;
  updateLead: (id: string, data: Partial<Lead>) => void;

  addTeamMember: (member: TeamMember) => void;
  updateTeamMember: (id: string, data: Partial<TeamMember>) => void;
  removeTeamMember: (id: string) => void;

  addQuoteRequest: (qr: QuoteRequest) => void;
  updateQuoteRequest: (id: string, data: Partial<QuoteRequest>) => void;
  completeQuoteRequest: (id: string) => void;

  addRequest: (req: InternalRequest) => void;
  updateRequest: (id: string, data: Partial<InternalRequest>) => void;
  deleteRequest: (id: string) => void;
  redistributeRequest: (id: string, newAssigneeId: string, newAssigneeName: string, redistributedBy: string) => void;
  getRequestsForUser: (userName: string) => InternalRequest[];
  getPendingRequestsCount: (userName: string) => number;

  getProductivity: (userName: string) => ProductivityRecord;
  getWorkloadSuggestion: (department: string) => { name: string; load: number; avgPerDay: number; pendingTasks: number }[];

  updateOnboardingChecklist: (clientId: string, item: string, checked: boolean) => void;
  updateOnboardingAccess: (clientId: string, key: string, value: string) => void;
  getOnboardingData: (clientId: string) => OnboardingData;

  getClientDna: (clientId: string) => ClientDna;
  updateClientDna: (clientId: string, data: Partial<Omit<ClientDna, "clientId">>) => void;

  logAudit: (userName: string, action: string, entity: string, entityId?: string) => void;
  getNotifications: () => { module: string; count: number }[];
}
