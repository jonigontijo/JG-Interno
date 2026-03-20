import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import StatusBadge from "@/components/StatusBadge";
import { formatTime } from "@/data/mockData";
import { toast } from "sonner";
import {
  Play, Square, Clock, Trash2, HandHelping, AlertTriangle,
  User, Users as UsersIcon, Pause
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
  const displayTasks = isAdminOrGerente
    ? (activeView === "mine" ? myTasks : tasks.filter(t => t.assignee !== myName))
    : (activeView === "mine" ? myTasks : generalTasks);

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

  return (
    <div className="space-y-4">
      {/* Dual Tab */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveView("mine")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeView === "mine"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Minhas Tarefas
          {myTasks.length > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-bold">
              {myTasks.filter(t => t.status !== "done").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView("general")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeView === "general"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Tarefas Gerais
          {(isAdminOrGerente ? tasks.filter(t => t.assignee !== myName) : generalTasks).filter(t => t.status !== "done").length > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] flex items-center justify-center font-bold">
              {(isAdminOrGerente ? tasks.filter(t => t.assignee !== myName) : generalTasks).filter(t => t.status !== "done").length}
            </span>
          )}
        </button>
      </div>

      {/* Task List */}
      <div className="grid gap-3">
        {displayTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {activeView === "mine" ? "Nenhuma tarefa atribuída a você" : "Nenhuma tarefa de outros colaboradores"}
          </p>
        )}
        {displayTasks.map(t => {
          const elapsed = getElapsedTime(t);
          const canAskHelp = activeView === "mine" && t.assignee === myName && t.status !== "done" && hasBackup(t);
          const canEscalate = activeView === "mine" && t.assignee === myName && t.status !== "done" && isBackupForTask(t);
          const isBlocked = t.status === "blocked";

          return (
            <div
              key={t.id}
              className={`rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors ${
                isBlocked ? "border-destructive/30 bg-destructive/5" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    {t.type === "recurring" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-info/10 text-info">Recorrente</span>
                    )}
                    {isBlocked && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Bloqueada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.client} · {t.assignee} · Prazo: {t.deadline}
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

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusBadge status={t.status} />
                  <StatusBadge status={t.urgency} />

                  {/* Start button */}
                  {(t.status === "pending" || t.status === "backlog") && (activeView === "mine" || isAdminOrGerente) && (
                    <button
                      onClick={async () => { await startTask(t.id); toast.success("Tarefa iniciada!"); }}
                      className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      title="Iniciar"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Pause button */}
                  {t.status === "in_progress" && (activeView === "mine" || isAdminOrGerente) && (
                    <button
                      onClick={async () => { await pauseTask(t.id); toast.info("Tarefa pausada"); }}
                      className="p-1.5 rounded-md bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
                      title="Pausar"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Resume button */}
                  {t.status === "paused" && (activeView === "mine" || isAdminOrGerente) && (
                    <button
                      onClick={async () => { await resumeTask(t.id); toast.success("Tarefa retomada!"); }}
                      className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      title="Retomar"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Complete button */}
                  {(t.status === "in_progress" || t.status === "paused") && (activeView === "mine" || isAdminOrGerente) && (
                    <button
                      onClick={async () => { await completeTask(t.id); toast.success("Tarefa concluída!"); }}
                      className="p-1.5 rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors"
                      title="Concluir"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Ask for help (titular → reserva) */}
                  {canAskHelp && !canEscalate && (
                    <button
                      onClick={() => handleAskForHelp(t)}
                      className="p-1.5 rounded-md bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
                      title="Pedir Ajuda ao Reserva"
                    >
                      <HandHelping className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Escalate (reserva → gerente) */}
                  {canEscalate && (
                    <button
                      onClick={() => handleEscalateToGerente(t)}
                      className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                      title="Escalar para Gerente Operacional"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(t)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Excluir demanda"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}