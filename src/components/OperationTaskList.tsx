import { useState, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import StatusBadge from "@/components/StatusBadge";
import { formatTime } from "@/data/mockData";
import { toast } from "sonner";
import {
  Play, Square, Clock, Trash2, HandHelping, AlertTriangle,
  User, Users as UsersIcon, Pause, List, LayoutGrid, Calendar, Filter
} from "lucide-react";
import type { Task } from "@/data/mockData";

interface OperationTaskListProps {
  moduleName: string;
  tasks: Task[];
}

export default function OperationTaskList({ moduleName, tasks }: OperationTaskListProps) {
  const { startTask, completeTask, pauseTask, resumeTask, deleteTask, updateTask, clients, logAudit } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdminOrGerente = currentUser?.isAdmin || currentUser?.roles?.some(r => r.includes("Gerente Operacional"));

  const [activeView, setActiveView] = useState<"mine" | "general">("mine");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const myName = currentUser?.name || "";

  // My tasks: assigned to me
  const myTasks = tasks.filter(t => t.assignee === myName);
  // General tasks: tasks on clients where I'm part of the team OR where I have tasks
  const myTaskClientIds = new Set(tasks.filter(t => t.assignee === myName).map(t => t.clientId));
  const myTeamClientIds = new Set(
    clients
      .filter(c => c.assignedTeam?.some(a => a.memberName === myName))
      .map(c => c.id)
  );
  const myClientIds = new Set([...myTaskClientIds, ...myTeamClientIds]);
  const generalTasks = tasks.filter(t => t.assignee !== myName && myClientIds.has(t.clientId));

  // Admins/Gerente see all
  const baseTasks = isAdminOrGerente
    ? (activeView === "mine" ? myTasks : tasks.filter(t => t.assignee !== myName))
    : (activeView === "mine" ? myTasks : generalTasks);

  const displayTasks = useMemo(() => {
    if (periodFilter === "all") return baseTasks;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (periodFilter === "today") {
      return baseTasks.filter(t => t.deadline === todayStr || t.createdAt === todayStr);
    }
    if (periodFilter === "week") {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const start = monday.toISOString().slice(0, 10);
      const end = sunday.toISOString().slice(0, 10);
      return baseTasks.filter(t => (t.deadline >= start && t.deadline <= end) || (t.createdAt >= start && t.createdAt <= end));
    }
    if (periodFilter === "custom" && customStart && customEnd) {
      return baseTasks.filter(t => (t.deadline >= customStart && t.deadline <= customEnd) || (t.createdAt >= customStart && t.createdAt <= customEnd));
    }
    return baseTasks;
  }, [baseTasks, periodFilter, customStart, customEnd]);

  const getElapsedTime = (task: Task): string | null => {
    if (!task.startedAt && !task.accumulatedMinutes) return null;
    if (task.completedAt && task.timeSpentMinutes !== undefined) return formatTime(task.timeSpentMinutes);
    if (task.status === "paused" && task.accumulatedMinutes) return formatTime(task.accumulatedMinutes);
    const accumulated = task.accumulatedMinutes || 0;
    if (!task.startedAt) return formatTime(accumulated);
    return formatTime(accumulated + Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000));
  };

  // Find backup for "Pedir Ajuda"
  const findBackupForTask = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    if (!client?.assignedTeam) return null;
    // Find another member with same role who is "reserva"
    const myAssignment = client.assignedTeam.find(a => a.memberName === task.assignee);
    if (!myAssignment) return null;
    const backup = client.assignedTeam.find(
      a => a.memberId !== myAssignment.memberId &&
        a.role === myAssignment.role &&
        a.designation === "reserva"
    );
    return backup;
  };

  const handleAskForHelp = (task: Task) => {
    const backup = findBackupForTask(task);
    if (!backup) {
      toast.error("Nenhum reserva disponível para esta função");
      return;
    }
    updateTask(task.id, {
      assignee: backup.memberName,
      status: "pending",
      urgency: "priority",
    });
    toast.success(`Tarefa transferida para ${backup.memberName} (Reserva)`);
  };

  // Escalate to Gerente Operacional
  const handleEscalateToGerente = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    const gerente = client?.assignedTeam?.find(a => a.role.includes("Gerente Operacional"));
    if (!gerente) {
      toast.error("Gerente Operacional não encontrado na equipe");
      return;
    }
    updateTask(task.id, {
      assignee: gerente.memberName,
      status: "blocked",
      urgency: "critical",
    });
    toast.warning(`⚠️ Tarefa escalada para ${gerente.memberName} com alerta crítico!`);
  };

  const handleDelete = (task: Task) => {
    if (window.confirm(`Excluir tarefa "${task.title}"?`)) {
      deleteTask(task.id);
      logAudit(currentUser?.name || 'Desconhecido', 'Apagou tarefa', task.title, task.id);
      toast.success("Tarefa excluída");
    }
  };

  // Check if current user is backup (can escalate)
  const isBackupForTask = (task: Task) => {
    const client = clients.find(c => c.id === task.clientId);
    if (!client?.assignedTeam) return false;
    const myAssignment = client.assignedTeam.find(a => a.memberName === myName);
    return myAssignment?.designation === "reserva";
  };

  // Check if task has a backup available
  const hasBackup = (task: Task) => !!findBackupForTask(task);

  const kanbanColumns = [
    { key: "todo", label: "A fazer", statuses: ["pending", "backlog"], color: "border-warning/40" },
    { key: "doing", label: "Em andamento", statuses: ["in_progress"], color: "border-primary/40" },
    { key: "waiting", label: "Aguardando", statuses: ["paused", "blocked"], color: "border-muted-foreground/40" },
    { key: "done", label: "Concluído", statuses: ["done"], color: "border-success/40" },
  ];

  const renderTaskCard = (t: Task, compact?: boolean) => {
    const elapsed = getElapsedTime(t);
    const canAskHelp = activeView === "mine" && t.assignee === myName && t.status !== "done" && hasBackup(t);
    const canEscalate = activeView === "mine" && t.assignee === myName && t.status !== "done" && isBackupForTask(t);
    const isBlocked = t.status === "blocked";

    return (
      <div
        key={t.id}
        className={`rounded-lg border bg-card ${compact ? "p-3" : "p-4"} hover:border-primary/30 transition-colors ${
          isBlocked ? "border-destructive/30 bg-destructive/5" : ""
        }`}
      >
        <div className={compact ? "space-y-2" : "flex items-center justify-between gap-3"}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`${compact ? "text-xs" : "text-sm"} font-medium text-foreground`}>{t.title}</p>
              {t.type === "recurring" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-info/10 text-info">Recorrente</span>
              )}
              {isBlocked && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> Bloqueada
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t.client} · {t.assignee} · {t.deadline}
            </p>
            {elapsed && (
              <div className="flex items-center gap-1 text-[10px] mt-1">
                <Clock className="w-3 h-3" />
                <span className={t.status === "in_progress" ? "text-primary font-mono animate-pulse" : "text-muted-foreground font-mono"}>
                  {elapsed}
                </span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1.5 ${compact ? "" : "flex-shrink-0"}`}>
            <StatusBadge status={t.status} />
            {!compact && <StatusBadge status={t.urgency} />}

            {(t.status === "pending" || t.status === "backlog") && (activeView === "mine" || isAdminOrGerente) && (
              <button onClick={async () => { await startTask(t.id); toast.success("Tarefa iniciada!"); }} className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors" title="Iniciar">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            {t.status === "in_progress" && (activeView === "mine" || isAdminOrGerente) && (
              <button onClick={async () => { await pauseTask(t.id); toast.info("Tarefa pausada"); }} className="p-1.5 rounded-md bg-warning/20 text-warning hover:bg-warning/30 transition-colors" title="Pausar">
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {t.status === "paused" && (activeView === "mine" || isAdminOrGerente) && (
              <button onClick={async () => { await resumeTask(t.id); toast.success("Tarefa retomada!"); }} className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors" title="Retomar">
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            {(t.status === "in_progress" || t.status === "paused") && (activeView === "mine" || isAdminOrGerente) && (
              <button onClick={async () => { await completeTask(t.id); toast.success("Tarefa concluída!"); }} className="p-1.5 rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors" title="Concluir">
                <Square className="w-3.5 h-3.5" />
              </button>
            )}
            {canAskHelp && !canEscalate && (
              <button onClick={() => handleAskForHelp(t)} className="p-1.5 rounded-md bg-warning/20 text-warning hover:bg-warning/30 transition-colors" title="Pedir Ajuda ao Reserva">
                <HandHelping className="w-3.5 h-3.5" />
              </button>
            )}
            {canEscalate && (
              <button onClick={() => handleEscalateToGerente(t)} className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors" title="Escalar para Gerente Operacional">
                <AlertTriangle className="w-3.5 h-3.5" />
              </button>
            )}
            {!compact && (
              <button onClick={() => handleDelete(t)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir demanda">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tabs + View toggle */}
      <div className="flex items-center justify-between border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveView("mine")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeView === "mine" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Minhas Tarefas
            {myTasks.filter(t => t.status !== "done").length > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold">
                {myTasks.filter(t => t.status !== "done").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView("general")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeView === "general" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UsersIcon className="w-3.5 h-3.5" /> Tarefas Gerais
            {(isAdminOrGerente ? tasks.filter(t => t.assignee !== myName) : generalTasks).filter(t => t.status !== "done").length > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center font-bold">
                {(isAdminOrGerente ? tasks.filter(t => t.assignee !== myName) : generalTasks).filter(t => t.status !== "done").length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1 pb-1">
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`} title="Lista">
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("kanban")} className={`p-1.5 rounded-md transition-colors ${viewMode === "kanban" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`} title="Kanban">
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {(["all", "today", "week", "custom"] as const).map(p => {
          const label = p === "all" ? "Todas" : p === "today" ? "Hoje" : p === "week" ? "Esta semana" : "Personalizado";
          return (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                periodFilter === p ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
        {periodFilter === "custom" && (
          <div className="flex items-center gap-1.5 ml-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 rounded-md border bg-background text-[11px] text-foreground" />
            <span className="text-[10px] text-muted-foreground">até</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 rounded-md border bg-background text-[11px] text-foreground" />
          </div>
        )}
        {periodFilter !== "all" && (
          <span className="text-[10px] text-muted-foreground ml-1">({displayTasks.length} tarefas)</span>
        )}
      </div>

      {/* List view */}
      {viewMode === "list" && (
        <div className="grid gap-3">
          {displayTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {activeView === "mine" ? "Nenhuma tarefa atribuída a você" : "Nenhuma tarefa de outros colaboradores"}
            </p>
          )}
          {displayTasks.map(t => renderTaskCard(t))}
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-4 gap-3">
          {kanbanColumns.map(col => {
            const colTasks = displayTasks.filter(t => col.statuses.includes(t.status));
            return (
              <div key={col.key} className={`rounded-lg border-t-2 ${col.color} bg-muted/20 p-2 min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-xs font-semibold text-foreground">{col.label}</h4>
                  <span className="text-[10px] w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-4 italic">Nenhuma tarefa</p>
                  )}
                  {colTasks.map(t => renderTaskCard(t, true))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}