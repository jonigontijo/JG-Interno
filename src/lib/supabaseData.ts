import { supabase } from "@/integrations/supabase/client";
import type { Client, Task, Lead, TeamMember } from "@/data/mockData";

export function db(table: string) {
  return (supabase as any).from(table);
}

// ============ TEAM MEMBERS ============
export function mapTeamFromDB(row: any): TeamMember {
  return {
    id: row.id, name: row.name, role: row.role || '', roles: row.roles || [],
    avatar: row.avatar || '', currentLoad: row.current_load || 0, capacity: row.capacity || 40,
    tasksActive: row.tasks_active || 0, specialty: row.specialty || [],
    salary: Number(row.salary) || 0, company: row.company || 'JG',
    hireDate: row.hire_date || '', totalCost: Number(row.total_cost) || 0,
    salaryBreakdown: {
      base: Number(row.salary_base) || 0, bonus: Number(row.salary_bonus) || 0,
      vt: Number(row.salary_vt) || 0, comTrafego: Number(row.salary_com_trafego) || 0,
      comGoogle: Number(row.salary_com_google) || 0, comSite: Number(row.salary_com_site) || 0,
      comIdVis: Number(row.salary_com_id_vis) || 0, mensIA: Number(row.salary_mens_ia) || 0,
    },
  };
}

export function mapTeamToDB(m: TeamMember): any {
  return {
    id: m.id, name: m.name, role: m.role, roles: m.roles, avatar: m.avatar,
    current_load: m.currentLoad, capacity: m.capacity, tasks_active: m.tasksActive,
    specialty: m.specialty, salary: m.salary, company: m.company,
    hire_date: m.hireDate, total_cost: m.totalCost,
    salary_base: m.salaryBreakdown?.base || 0, salary_bonus: m.salaryBreakdown?.bonus || 0,
    salary_vt: m.salaryBreakdown?.vt || 0, salary_com_trafego: m.salaryBreakdown?.comTrafego || 0,
    salary_com_google: m.salaryBreakdown?.comGoogle || 0, salary_com_site: m.salaryBreakdown?.comSite || 0,
    salary_com_id_vis: m.salaryBreakdown?.comIdVis || 0, salary_mens_ia: m.salaryBreakdown?.mensIA || 0,
  };
}

// ============ CLIENTS ============
export function mapClientFromDB(row: any, assignments: any[] = [], services: any[] = []): Client {
  const clientAssignments = assignments.filter(a => a.client_id === row.id);
  const clientServices = services.filter(s => s.client_id === row.id);
  return {
    id: row.id, name: row.name || '', company: row.company, services: row.services || [],
    status: row.status || 'Operação', substatus: row.substatus || 'Ativo',
    monthlyValue: Number(row.monthly_value) || 0, setupValue: Number(row.setup_value) || 0,
    riskLevel: row.risk_level || 'low', trafficManager: row.traffic_manager,
    socialManager: row.social_manager, accountManager: row.account_manager || 'Joni',
    pendingTasks: row.pending_tasks || 0, overdueTasks: row.overdue_tasks || 0,
    lastApproval: row.last_approval, nextRecording: row.next_recording,
    paymentStatus: row.payment_status, paymentDueDate: row.payment_due_date,
    paymentDueDay: row.payment_due_day, socialMediaPosts: row.social_media_posts || 0,
    postsReadyThisWeek: row.posts_ready_this_week || 0, postsReadyNextWeek: row.posts_ready_next_week || 0,
    isPaid: row.is_paid || false, paidDate: row.paid_date, daysOverdue: row.days_overdue || 0,
    isBarter: row.is_barter || false,
    barterDetails: row.is_barter ? {
      description: row.barter_description || '', agreedValue: Number(row.barter_agreed_value) || 0,
      startDate: row.barter_start_date || '', endDate: row.barter_end_date || '', notes: row.barter_notes || '',
    } : undefined,
    assignedTeam: clientAssignments.map(a => ({ memberId: a.member_id, memberName: a.member_name, role: a.role, designation: a.designation || 'titular' })),
    recurringServices: clientServices.map(s => ({
      id: s.id, name: s.name, assigneeId: s.assignee_id, assigneeName: s.assignee_name,
      frequency: s.frequency, quantityPerCycle: s.quantity_per_cycle, description: s.description, active: s.active,
    })),
  };
}

export function mapClientToDB(c: Client): any {
  return {
    id: c.id, name: c.name, company: c.company, services: c.services,
    status: c.status, substatus: c.substatus, monthly_value: c.monthlyValue,
    setup_value: c.setupValue, risk_level: c.riskLevel, traffic_manager: c.trafficManager,
    social_manager: c.socialManager, account_manager: c.accountManager,
    pending_tasks: c.pendingTasks, overdue_tasks: c.overdueTasks,
    last_approval: c.lastApproval, next_recording: c.nextRecording,
    payment_status: c.paymentStatus, payment_due_date: c.paymentDueDate,
    payment_due_day: c.paymentDueDay, social_media_posts: c.socialMediaPosts,
    posts_ready_this_week: c.postsReadyThisWeek, posts_ready_next_week: c.postsReadyNextWeek,
    is_paid: c.isPaid, paid_date: c.paidDate, days_overdue: c.daysOverdue,
    is_barter: c.isBarter, barter_description: c.barterDetails?.description,
    barter_agreed_value: c.barterDetails?.agreedValue, barter_start_date: c.barterDetails?.startDate,
    barter_end_date: c.barterDetails?.endDate, barter_notes: c.barterDetails?.notes,
  };
}

// ============ TASKS ============
export function mapTaskFromDB(row: any): Task {
  return {
    id: row.id, title: row.title, client: row.client || '', clientId: row.client_id || '',
    module: row.module || '', sector: row.sector || '', type: row.type || '',
    assignee: row.assignee || '', reviewer: row.reviewer, deadline: row.deadline,
    urgency: row.urgency || 'normal', status: row.status || 'pending',
    weight: row.weight || 1, estimatedHours: Number(row.estimated_hours) || 1,
    actualHours: row.actual_hours ? Number(row.actual_hours) : undefined,
    hasRework: row.has_rework || false, createdAt: row.created_at,
    startedAt: row.started_at, completedAt: row.completed_at,
    timeSpentMinutes: row.time_spent_minutes || 0,
    pausedAt: row.paused_at || undefined,
    accumulatedMinutes: row.accumulated_minutes || 0,
    description: row.description || undefined,
    recurUntil: row.recur_until || undefined,
    recurType: row.recur_type || undefined,
    recurDaysInterval: row.recur_days_interval || undefined,
    createdBy: row.created_by || undefined,
  } as any;
}

export function mapTaskToDB(t: Task): any {
  return {
    id: t.id, title: t.title, client: t.client, client_id: t.clientId,
    module: t.module, sector: t.sector, type: t.type, assignee: t.assignee,
    reviewer: t.reviewer, deadline: t.deadline, urgency: t.urgency, status: t.status,
    weight: t.weight, estimated_hours: t.estimatedHours, actual_hours: t.actualHours,
    has_rework: t.hasRework, created_at: t.createdAt, started_at: t.startedAt,
    completed_at: t.completedAt, time_spent_minutes: t.timeSpentMinutes,
    paused_at: (t as any).pausedAt ?? null,
    accumulated_minutes: (t as any).accumulatedMinutes ?? 0,
    description: (t as any).description ?? null,
    recur_until: (t as any).recurUntil ?? null,
    recur_type: (t as any).recurType ?? null,
    recur_days_interval: (t as any).recurDaysInterval ?? null,
    created_by: (t as any).createdBy ?? null,
  };
}

// ============ LEADS ============
export function mapLeadFromDB(row: any): Lead {
  return {
    id: row.id, name: row.name, company: row.company, responsible: row.responsible || '',
    meetingDate: row.meeting_date || '', origin: row.origin || '', stage: row.stage || '',
    potentialValue: Number(row.potential_value) || 0, nextFollowUp: row.next_follow_up || '',
    notes: row.notes || '', services: row.services, discount: row.discount, finalValue: row.final_value,
  };
}

export function mapLeadToDB(l: Lead): any {
  return {
    id: l.id, name: l.name, company: l.company, responsible: l.responsible,
    meeting_date: l.meetingDate, origin: l.origin, stage: l.stage,
    potential_value: l.potentialValue, next_follow_up: l.nextFollowUp,
    notes: l.notes, services: l.services, discount: l.discount, final_value: l.finalValue,
  };
}

// ============ QUOTE REQUESTS ============
export function mapQuoteFromDB(row: any): any {
  return {
    id: row.id, clientId: row.client_id, clientName: row.client_name,
    service: row.service, requestedBy: row.requested_by, requestedAt: row.requested_at,
    notes: row.notes, status: row.status, proposalValue: row.proposal_value,
    proposalSentAt: row.proposal_sent_at, approvedAt: row.approved_at, paidAt: row.paid_at,
  };
}

export function mapQuoteToDB(q: any): any {
  return {
    id: q.id, client_id: q.clientId, client_name: q.clientName,
    service: q.service, requested_by: q.requestedBy, requested_at: q.requestedAt,
    notes: q.notes, status: q.status, proposal_value: q.proposalValue,
    proposal_sent_at: q.proposalSentAt, approved_at: q.approvedAt, paid_at: q.paidAt,
  };
}

// ============ INTERNAL REQUESTS ============
export function mapRequestFromDB(row: any): any {
  return {
    id: row.id, title: row.title, description: row.description,
    requesterId: row.requester_id, requesterName: row.requester_name,
    assignedToName: row.assigned_to_name, assignedToId: row.assigned_to_id,
    clientId: row.client_id, clientName: row.client_name, department: row.department,
    priority: row.priority, status: row.status, createdAt: row.created_at,
    dueDate: row.due_date, taskId: row.task_id,
    redistributedTo: row.redistributed_to, redistributedBy: row.redistributed_by,
    attachments: row.attachments || [],
    deliveryLinks: row.delivery_links || [],
  };
}

export function mapRequestToDB(r: any): any {
  return {
    id: r.id, title: r.title, description: r.description,
    requester_id: r.requesterId, requester_name: r.requesterName,
    assigned_to_name: r.assignedToName, assigned_to_id: r.assignedToId,
    client_id: r.clientId, client_name: r.clientName, department: r.department,
    priority: r.priority, status: r.status, created_at: r.createdAt,
    due_date: r.dueDate, task_id: r.taskId,
    redistributed_to: r.redistributedTo, redistributed_by: r.redistributedBy,
    attachments: r.attachments || [],
    delivery_links: r.deliveryLinks || [],
  };
}

// ============ OTHER ENTITY MAPPERS ============
export function mapPipelineFromDB(row: any): any {
  return {
    clientId: row.client_id, currentStepOrder: row.current_step_order,
    completedSteps: row.completed_steps || [], startedAt: row.started_at, completedAt: row.completed_at,
  };
}

export function mapSettingFromDB(row: any): any {
  return {
    id: row.id, category: row.category, label: row.label,
    value: row.value, type: row.type, options: row.options,
  };
}

export function mapProductivityFromDB(row: any): any {
  return {
    userId: row.user_id, userName: row.user_name,
    tasksCompletedToday: row.tasks_completed_today, avgTasksPerDay: Number(row.avg_tasks_per_day),
    totalTasksCompleted: row.total_tasks_completed, totalDaysWorked: row.total_days_worked,
    lastUpdated: row.last_updated,
  };
}

export function mapProductivityToDB(p: any): any {
  return {
    user_id: p.userId, user_name: p.userName,
    tasks_completed_today: p.tasksCompletedToday, avg_tasks_per_day: p.avgTasksPerDay,
    total_tasks_completed: p.totalTasksCompleted, total_days_worked: p.totalDaysWorked,
    last_updated: p.lastUpdated,
  };
}

// ============ GRANULAR LOADERS ============

export async function loadClients() {
  const [clientsRes, assignmentsRes, servicesRes] = await Promise.all([
    db('clients').select('*'),
    db('client_team_assignments').select('*'),
    db('client_recurring_services').select('*'),
  ]);
  if (clientsRes.error) throw clientsRes.error;
  const assignments = assignmentsRes.data || [];
  const services = servicesRes.data || [];
  return (clientsRes.data || []).map((row: any) => mapClientFromDB(row, assignments, services));
}

export async function loadTasks() {
  const { data, error } = await db('tasks').select('*');
  if (error) throw error;
  return (data || []).map(mapTaskFromDB);
}

export async function loadTeamMembers() {
  const [teamRes, profilesRes] = await Promise.all([
    db('team_members').select('*'),
    db('profiles').select('name, active'),
  ]);
  if (teamRes.error) throw teamRes.error;
  const activeProfileNames = new Set(
    (profilesRes.data || [])
      .filter((p: any) => p.active)
      .map((p: any) => (p.name || '').toLowerCase())
  );
  return (teamRes.data || []).map(mapTeamFromDB).filter((m: TeamMember) => activeProfileNames.has(m.name.toLowerCase()));
}

export async function loadLeads() {
  const { data, error } = await db('leads').select('*');
  if (error) throw error;
  return (data || []).map(mapLeadFromDB);
}

export async function loadQuoteRequests() {
  const { data, error } = await db('quote_requests').select('*');
  if (error) throw error;
  return (data || []).map(mapQuoteFromDB);
}

export async function loadInternalRequests() {
  const { data, error } = await db('internal_requests').select('*');
  if (error) throw error;
  return (data || []).map(mapRequestFromDB);
}

export async function loadClientPipelines() {
  const { data, error } = await db('client_pipelines').select('*');
  if (error) throw error;
  return (data || []).map(mapPipelineFromDB);
}

// ============ LOAD ALL DATA ============
export async function loadAllData() {
  const results = await Promise.all([
    db('team_members').select('*'),
    db('clients').select('*'),
    db('tasks').select('*'),
    db('leads').select('*'),
    db('client_team_assignments').select('*'),
    db('client_recurring_services').select('*'),
    db('quote_requests').select('*'),
    db('internal_requests').select('*'),
    db('client_pipelines').select('*'),
    db('onboarding_data').select('*'),
    db('settings').select('*'),
    db('productivity').select('*'),
    db('profiles').select('name, active'),
    db('client_dna').select('*'),
  ]);

  const [teamRes, clientsRes, tasksRes, leadsRes, assignmentsRes, servicesRes,
    quotesRes, requestsRes, pipelinesRes, onboardingRes, settingsRes, prodRes, profilesRes, dnaRes] = results;

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('DB load errors:', errors.map(e => e.error));
    if (errors.length > 6) {
      throw new Error(`Falha ao conectar ao banco de dados (${errors.length}/14 queries falharam)`);
    }
  }

  const assignments = assignmentsRes.data || [];
  const services = servicesRes.data || [];

  const activeProfileNames = new Set(
    (profilesRes.data || [])
      .filter((p: any) => p.active)
      .map((p: any) => (p.name || '').toLowerCase())
  );

  const allTeam = (teamRes.data || []).map(mapTeamFromDB);
  const activeTeam = allTeam.filter((m: TeamMember) => activeProfileNames.has(m.name.toLowerCase()));

  return {
    team: activeTeam,
    clients: (clientsRes.data || []).map((row: any) => mapClientFromDB(row, assignments, services)),
    tasks: (tasksRes.data || []).map(mapTaskFromDB),
    leads: (leadsRes.data || []).map(mapLeadFromDB),
    quoteRequests: (quotesRes.data || []).map(mapQuoteFromDB),
    requests: (requestsRes.data || []).map(mapRequestFromDB),
    clientPipelines: (pipelinesRes.data || []).map(mapPipelineFromDB),
    onboardingData: (onboardingRes.data || []).map((row: any) => ({
      clientId: row.client_id, checklist: row.checklist || {}, accessData: row.access_data || {},
    })),
    settings: (settingsRes.data || []).map(mapSettingFromDB),
    productivity: (prodRes.data || []).map(mapProductivityFromDB),
    clientDna: (dnaRes.data || []).map((row: any) => ({
      clientId: row.client_id,
      links: row.links || [],
      notes: row.notes || {},
      credentials: row.credentials || [],
      importantDates: row.important_dates || [],
    })),
    _dbConnected: true,
  };
}
