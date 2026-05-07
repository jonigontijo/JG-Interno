import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import Modal from "@/components/Modal";
import { DatePicker } from "@/components/ui/date-picker";
import { RecurrencePicker } from "@/components/ui/recurrence-picker";
import { toast } from "sonner";
import { formatTime } from "@/data/mockData";
import { LayoutGrid, List, Plus, Play, Square, Clock, GripVertical, Pause, Trash2, Pencil, Repeat, Filter } from "lucide-react";
import { useTimeTick } from "@/hooks/useTimeTick";
import { useDragToScroll } from "@/hooks/useDragToScroll";
import type { Task } from "@/data/mockData";
import { formatDeadline, deadlineColor } from "@/lib/formatDeadline";

const kanbanColumns = [
  { key: "urgent", label: "Urgente" },
  { key: "backlog", label: "Não Iniciada" },
  { key: "in_progress", label: "Fazendo / Em Andamento" },
  { key: "paused", label: "Pausado" },
  { key: "approval", label: "Acompanhando Tarefa" },
  { key: "done", label: "Feito" },
  { key: "completed", label: "Tarefas Concluídas" },
];

export default function TasksPage() {
  const { tasks, clients, addTask, updateTask, deleteTask, startTask, pauseTask, resumeTask, completeTask, logAudit } = useAppStore();
  const allUsers = useAuthStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", clientId: "", module: "Tráfego", assignee: "", deadline: "", urgency: "normal" as Task["urgency"], description: "", recurType: undefined as any, recurUntil: "", recurDaysInterval: undefined as any });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"above" | "below">("above");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "overdue" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({});

  // Force re-render every 30s so elapsed time updates live
  useTimeTick(30000);

  const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const SECTOR_TO_TASK_MODULE: Record<string, string[]> = {
    "traffic": ["Tráfego"],
    "social": ["Social Media"],
    "production": ["Produção"],
    "tech": ["Tech", "Suporte"],
    "inside-sales": ["Inside Sales"],
    "onboarding": ["Onboarding"],
    "financial": ["Financeiro"],
  };

  // Admin sees all; others see tasks assigned to them, tasks they created, or tasks from sectors they have visibility permission for
  const myTasks = currentUser?.isAdmin
    ? tasks
    : tasks.filter(t => {
        if (t.assignee === currentUser?.name) return true;
        if (t.createdBy && t.createdBy === currentUser?.name) return true;
        const sectorAccess = currentUser?.sectorVisibility || [];
        for (const sector of sectorAccess) {
          const taskModules = SECTOR_TO_TASK_MODULE[sector];
          if (taskModules && taskModules.includes(t.module)) return true;
        }
        return false;
      });

  const filteredTasks = React.useMemo(() => {
    if (periodFilter === "all") return myTasks;
    const now = new Date();
    const todayStr = toYmd(now);

    const matchesToday = (t: Task) => {
      if (t.status === "done" || t.status === "completed") {
        if (t.completedAt) {
          const completed = new Date(t.completedAt);
          if (!Number.isNaN(completed.getTime())) return toYmd(completed) === todayStr;
        }
        return t.deadline?.slice(0, 10) === todayStr;
      }
      return t.deadline?.slice(0, 10) === todayStr;
    };

    if (periodFilter === "today") return myTasks.filter(matchesToday);
    if (periodFilter === "overdue") {
      return myTasks.filter(t => {
        if (t.status === "done" || t.status === "completed") return false;
        const dl = t.deadline?.slice(0, 10) || "";
        return dl && dl < todayStr;
      });
    }
    if (periodFilter === "week") {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const start = toYmd(monday);
      const end = toYmd(sunday);
      return myTasks.filter(t => {
        const dl = t.deadline?.slice(0, 10) || "";
        return dl >= start && dl <= end;
      });
    }
    if (periodFilter === "custom" && customStart && customEnd) {
      return myTasks.filter(t => {
        const dl = t.deadline?.slice(0, 10) || "";
        return dl >= customStart && dl <= customEnd;
      });
    }
    return myTasks;
  }, [myTasks, periodFilter, customStart, customEnd]);

  const isUrgent = (t: Task) => t.urgency === "urgent" || t.urgency === "critical" || t.status === "urgent" || t.status === "critical";
  const terminalStatuses = ["done", "completed", "paused", "in_progress", "approval", "waiting_client"];

  const getColumnTasks = (colKey: string) => {
    let result: Task[];
    switch (colKey) {
      case "urgent":
        result = filteredTasks.filter(t => isUrgent(t) && t.status !== "done" && t.status !== "completed" && t.status !== "paused"); break;
      case "backlog":
        result = filteredTasks.filter(t => !isUrgent(t) && !terminalStatuses.includes(t.status)); break;
      case "in_progress":
        result = filteredTasks.filter(t => t.status === "in_progress" && !isUrgent(t)); break;
      case "paused":
        result = filteredTasks.filter(t => t.status === "paused"); break;
      case "approval":
        result = filteredTasks.filter(t => (t.status === "approval" || t.status === "waiting_client") && !isUrgent(t)); break;
      case "done":
        result = filteredTasks.filter(t => t.status === "done"); break;
      case "completed":
        result = filteredTasks.filter(t => t.status === "completed"); break;
      default:
        result = [];
    }
    const order = columnOrders[colKey];
    if (order) {
      const orderMap = new Map(order.map((id, i) => [id, i]));
      result.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
    }
    return result;
  };

  const urgencyDot = (u: string) => {
    switch (u) {
      case "critical": return "bg-destructive";
      case "urgent": return "bg-destructive/70";
      case "priority": return "bg-warning";
      default: return "bg-muted-foreground/40";
    }
  };

  const getElapsedTime = (task: Task): string | null => {
    if (!task.startedAt && !task.accumulatedMinutes) return null;
    if (task.completedAt && task.timeSpentMinutes !== undefined) return formatTime(task.timeSpentMinutes);
    if (task.status === "paused" && task.accumulatedMinutes) return formatTime(task.accumulatedMinutes);
    const accumulated = task.accumulatedMinutes || 0;
    if (!task.startedAt) return formatTime(accumulated);
    const elapsed = Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000);
    return formatTime(accumulated + elapsed);
  };

  const handleCreate = () => {
    if (!newTask.title || !newTask.assignee || !newTask.deadline) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const client = newTask.clientId ? clients.find(c => c.id === newTask.clientId) : null;
    const task: Task = {
      id: `t-${Date.now()}`,
      title: newTask.title,
      client: client?.company || "",
      clientId: newTask.clientId,
      module: newTask.module,
      sector: newTask.module,
      type: "Tarefa",
      assignee: newTask.assignee,
      deadline: newTask.deadline,
      urgency: newTask.urgency,
      status: "backlog",
      weight: 2,
      estimatedHours: 2,
      hasRework: false,
      createdAt: new Date().toISOString().slice(0, 10),
      description: newTask.description || undefined,
      recurUntil: newTask.recurUntil || undefined,
      recurType: newTask.recurType,
      recurDaysInterval: newTask.recurDaysInterval,
    };
    addTask(task);
    logAudit(currentUser?.name || 'Desconhecido', 'Criou tarefa', task.title, task.id);
    toast.success("Tarefa criada!");
    setShowModal(false);
    setNewTask({ title: "", clientId: "", module: "Tráfego", assignee: "", deadline: "", urgency: "normal", description: "", recurType: undefined as any, recurUntil: "", recurDaysInterval: undefined as any });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCardDragOver = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetTaskId === draggedTaskId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropPosition(e.clientY < midY ? "above" : "below");
    setDropTargetId(targetTaskId);
  };

  const handleCardDrop = (e: React.DragEvent, targetTaskId: string, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDropTargetId(null);
      return;
    }

    const draggedTask = filteredTasks.find(t => t.id === draggedTaskId);
    const targetTask = filteredTasks.find(t => t.id === targetTaskId);
    if (!draggedTask || !targetTask) { setDraggedTaskId(null); setDropTargetId(null); return; }

    const colTasks = getColumnTasks(colKey);
    const isSameColumn = colTasks.some(t => t.id === draggedTaskId);

    if (!isSameColumn) {
      void handleDrop(e, colKey);
    }

    const currentIds = colTasks.map(t => t.id).filter(id => id !== draggedTaskId);
    if (!isSameColumn) currentIds.push(draggedTaskId);
    const targetIdx = currentIds.indexOf(targetTaskId);
    const insertIdx = dropPosition === "above" ? targetIdx : targetIdx + 1;
    const withoutDragged = currentIds.filter(id => id !== draggedTaskId);
    withoutDragged.splice(insertIdx > withoutDragged.length ? withoutDragged.length : insertIdx, 0, draggedTaskId);

    setColumnOrders(prev => ({ ...prev, [colKey]: withoutDragged }));
    setDraggedTaskId(null);
    setDropTargetId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDropTargetId(null);
  };

  const dragScrollRef = useDragToScroll<HTMLDivElement>();
  const kanbanContainerRef = dragScrollRef;
  const autoScrollRef = React.useRef<number | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const container = kanbanContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const edgeZone = 80;
    const speed = 12;

    if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);

    const scrollStep = () => {
      if (!kanbanContainerRef.current) return;
      if (e.clientX - rect.left < edgeZone) {
        kanbanContainerRef.current.scrollLeft -= speed;
        autoScrollRef.current = requestAnimationFrame(scrollStep);
      } else if (rect.right - e.clientX < edgeZone) {
        kanbanContainerRef.current.scrollLeft += speed;
        autoScrollRef.current = requestAnimationFrame(scrollStep);
      }
    };
    scrollStep();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    
    if (targetStatus === "in_progress") {
      await startTask(draggedTaskId);
      toast.success("Tarefa iniciada! Tempo sendo contabilizado.");
    } else if (targetStatus === "paused") {
      const task = myTasks.find(t => t.id === draggedTaskId);
      if (task?.startedAt) {
        await pauseTask(draggedTaskId);
      } else {
        // Fallback: still allow marking as paused without a started session
        updateTask(draggedTaskId, { status: "paused", pausedAt: new Date().toISOString(), accumulatedMinutes: task?.accumulatedMinutes ?? 0 } as any);
      }
      toast.info("Tarefa pausada");
    } else if (targetStatus === "done") {
      await completeTask(draggedTaskId);
      toast.success("Tarefa concluída! Tempo registrado.");
    } else {
      updateTask(draggedTaskId, { status: targetStatus });
      toast.success("Status atualizado");
    }
    setDraggedTaskId(null);
    if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }
  };

  return (
    <div>
      <PageHeader title="Tarefas" description={`${filteredTasks.length} tarefa${filteredTasks.length !== 1 ? "s" : ""}${currentUser?.isAdmin ? " no sistema" : (currentUser?.sectorVisibility?.length ? " (suas + setores liberados)" : " atribuídas a você")}`}>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={() => setView("kanban")} className={`p-2 transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView("list")} className={`p-2 transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </button>
        </div>
      </PageHeader>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {(["all", "today", "week", "overdue", "custom"] as const).map(p => {
          const label = p === "all" ? "Todas" : p === "today" ? "Hoje" : p === "week" ? "Esta semana" : p === "overdue" ? "Em atraso" : "Personalizado";
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
          <span className="text-[10px] text-muted-foreground ml-1">({filteredTasks.length} tarefas)</span>
        )}
      </div>

      {view === "kanban" ? (
        <div ref={kanbanContainerRef} className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map(col => {
            const colTasks = getColumnTasks(col.key);
            return (
              <div
                key={col.key}
                className="kanban-column flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => { void handleDrop(e, col.key); }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={col.key} />
                    <span className="text-xs font-mono text-muted-foreground">{colTasks.length}</span>
                  </div>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {colTasks.map(task => {
                    const elapsed = getElapsedTime(task);
                    const isDropTarget = dropTargetId === task.id && draggedTaskId !== task.id;
                    return (
                      <div
                        key={task.id}
                        className={`kanban-card group relative ${
                          isDropTarget && dropPosition === "above" ? "border-t-2 border-t-primary mt-1" : ""
                        } ${isDropTarget && dropPosition === "below" ? "border-b-2 border-b-primary mb-1" : ""
                        } ${draggedTaskId === task.id ? "opacity-40" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragOver={(e) => handleCardDragOver(e, task.id)}
                        onDrop={(e) => handleCardDrop(e, task.id, col.key)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1 min-w-0">
                            <GripVertical
                              className="drag-handle w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab active:cursor-grabbing"
                            />
                            <h3
                              className="text-sm font-medium text-foreground leading-snug cursor-pointer hover:text-primary transition-colors truncate"
                              onClick={(e) => { e.stopPropagation(); setEditTask({ ...task }); }}
                            >
                              {task.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditTask({ ...task }); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                              title="Editar tarefa"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                            </button>
                            <span className={`w-2 h-2 rounded-full mt-0.5 ${urgencyDot(task.urgency)}`} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{task.client}</p>
                        
                        {elapsed && (
                          <div className="flex items-center gap-1 text-[10px] mb-2">
                            <Clock className="w-3 h-3" />
                            <span className={task.status === "in_progress" ? "text-primary font-mono animate-pulse" : "text-muted-foreground font-mono"}>
                              {elapsed}
                            </span>
                            {task.status === "done" && <span className="text-success">✓</span>}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{task.module}</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                              {task.assignee.slice(0, 2).toUpperCase()}
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              deadlineColor(task.deadline) === "text-destructive" ? "bg-destructive/15 text-destructive" :
                              deadlineColor(task.deadline) === "text-warning" ? "bg-warning/15 text-warning" :
                              deadlineColor(task.deadline) === "text-info" ? "bg-info/15 text-info" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              📅 {formatDeadline(task.deadline)}
                            </span>
                          </div>
                        </div>
                        {task.hasRework && <span className="text-[9px] text-destructive mt-1 block">⟲ Retrabalho</span>}
                        
                        <div className="hidden group-hover:flex gap-1 mt-2 flex-wrap">
                          {(col.key !== "in_progress" && col.key !== "done" && task.status !== "paused") && (
                            <button onClick={async (e) => { e.stopPropagation(); await startTask(task.id); toast.success("Tarefa iniciada!"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-0.5">
                              <Play className="w-2.5 h-2.5" /> Iniciar
                            </button>
                          )}
                          {task.status === "paused" && (
                            <button onClick={async (e) => { e.stopPropagation(); await resumeTask(task.id); toast.success("Tarefa retomada!"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-0.5">
                              <Play className="w-2.5 h-2.5" /> Retomar
                            </button>
                          )}
                          {col.key === "in_progress" && (
                            <>
                              <button onClick={async (e) => { e.stopPropagation(); await pauseTask(task.id); toast.info("Tarefa pausada"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-warning/20 text-warning hover:bg-warning/30 transition-colors flex items-center gap-0.5">
                                <Pause className="w-2.5 h-2.5" /> Pausar
                              </button>
                              <button onClick={async (e) => { e.stopPropagation(); await completeTask(task.id); toast.success("Tarefa concluída!"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success hover:bg-success/30 transition-colors flex items-center gap-0.5">
                                <Square className="w-2.5 h-2.5" /> Finalizar
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Apagar tarefa "${task.title}"?`)) {
                                deleteTask(task.id);
                                logAudit(currentUser?.name || 'Desconhecido', 'Apagou tarefa', task.title, task.id);
                                toast.success("Tarefa apagada!");
                              }
                            }}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors flex items-center gap-0.5 ml-auto"
                          >
                            <Trash2 className="w-2.5 h-2.5" /> Apagar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                <th className="text-left py-3 px-4 font-medium">Tarefa</th>
                <th className="text-left py-3 px-4 font-medium">Cliente</th>
                <th className="text-left py-3 px-4 font-medium">Módulo</th>
                <th className="text-left py-3 px-4 font-medium">Responsável</th>
                <th className="text-left py-3 px-4 font-medium">Prazo</th>
                <th className="text-left py-3 px-4 font-medium">Tempo</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-right py-3 px-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => {
                const elapsed = getElapsedTime(task);
                return (
                  <tr key={task.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">
                      <span>{task.title}</span>
                      {task.recurUntil && <span title={`Recorrente até ${task.recurUntil}`}><Repeat size={10} className="inline ml-1.5 text-primary opacity-60" /></span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{task.client}</td>
                    <td className="py-3 px-4"><span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{task.module}</span></td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{task.assignee}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                        deadlineColor(task.deadline) === "text-destructive" ? "bg-destructive/15 text-destructive" :
                        deadlineColor(task.deadline) === "text-warning" ? "bg-warning/15 text-warning" :
                        deadlineColor(task.deadline) === "text-info" ? "bg-info/15 text-info" :
                        "bg-muted text-muted-foreground"
                      }`}>📅 {formatDeadline(task.deadline)}</span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{elapsed || "—"}</td>
                    <td className="py-3 px-4"><StatusBadge status={task.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1 items-center justify-end">
                        {task.status !== "in_progress" && task.status !== "done" && task.status !== "paused" && (
                          <button onClick={async () => { await startTask(task.id); toast.success("Iniciada!"); }} className="text-[9px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30">▶ Iniciar</button>
                        )}
                        {task.status === "paused" && (
                          <button onClick={async () => { await resumeTask(task.id); toast.success("Retomada!"); }} className="text-[9px] px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30">▶ Retomar</button>
                        )}
                        {task.status === "in_progress" && (
                          <>
                            <button onClick={async () => { await pauseTask(task.id); toast.info("Pausada"); }} className="text-[9px] px-2 py-1 rounded bg-warning/20 text-warning hover:bg-warning/30">⏸ Pausar</button>
                            <button onClick={async () => { await completeTask(task.id); toast.success("Concluída!"); }} className="text-[9px] px-2 py-1 rounded bg-success/20 text-success hover:bg-success/30">■ Finalizar</button>
                          </>
                        )}
                        <button
                          onClick={() => setEditTask({ ...task })}
                          className="text-[9px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 ml-1"
                          title="Editar tarefa"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Apagar tarefa "${task.title}"?`)) {
                              deleteTask(task.id);
                              logAudit(currentUser?.name || 'Desconhecido', 'Apagou tarefa', task.title, task.id);
                              toast.success("Tarefa apagada!");
                            }
                          }}
                          className="text-[9px] px-2 py-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 ml-1"
                          title="Apagar tarefa"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Tarefa">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
            <input type="text" value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="Título da tarefa" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
            <select value={newTask.clientId} onChange={(e) => setNewTask(t => ({ ...t, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
              <option value="">Selecione...</option>
              {[...clients].sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Módulo</label>
              <select value={newTask.module} onChange={(e) => setNewTask(t => ({ ...t, module: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {["Tráfego", "Social Media", "Produção", "Tech", "Inside Sales", "Administrativo"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Urgência</label>
              <select value={newTask.urgency} onChange={(e) => setNewTask(t => ({ ...t, urgency: e.target.value as Task["urgency"] }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="normal">Normal</option>
                <option value="priority">Prioridade</option>
                <option value="urgent">Urgente</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável *</label>
              <select value={newTask.assignee} onChange={(e) => setNewTask(t => ({ ...t, assignee: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {allUsers.filter(u => u.active).map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Prazo *</label>
              <DatePicker value={newTask.deadline} onChange={(v) => setNewTask(t => ({ ...t, deadline: v }))} placeholder="Selecionar prazo" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Descrição</label>
            <textarea value={newTask.description} onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))} placeholder="Descreva a tarefa..." rows={2} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <RecurrencePicker
            value={{ recurType: newTask.recurType, recurUntil: newTask.recurUntil, recurDaysInterval: newTask.recurDaysInterval }}
            onChange={({ recurType, recurUntil, recurDaysInterval }) => setNewTask(t => ({ ...t, recurType, recurUntil: recurUntil ?? '', recurDaysInterval }))}
          />
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Criar Tarefa</button>
          </div>
        </div>
      </Modal>

      {editTask && (
        <Modal open={!!editTask} onClose={() => setEditTask(null)} title="Editar Tarefa">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
              <input type="text" value={editTask.title} onChange={(e) => setEditTask(t => t ? { ...t, title: e.target.value } : t)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
              <select value={editTask.clientId} onChange={(e) => { const c = clients.find(cl => cl.id === e.target.value); setEditTask(t => t ? { ...t, clientId: e.target.value, client: c?.company || t.client } : t); }} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {[...clients].sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Módulo</label>
                <select value={editTask.module} onChange={(e) => setEditTask(t => t ? { ...t, module: e.target.value } : t)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                  {["Tráfego", "Social Media", "Produção", "Tech", "Inside Sales", "Administrativo"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Urgência</label>
                <select value={editTask.urgency} onChange={(e) => setEditTask(t => t ? { ...t, urgency: e.target.value as Task["urgency"] } : t)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                  <option value="normal">Normal</option>
                  <option value="priority">Prioridade</option>
                  <option value="urgent">Urgente</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Responsável</label>
                <select value={editTask.assignee} onChange={(e) => setEditTask(t => t ? { ...t, assignee: e.target.value } : t)} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                  <option value="">Selecione...</option>
                  {allUsers.filter(u => u.active).map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Prazo</label>
                <DatePicker value={editTask.deadline} onChange={(v) => setEditTask(t => t ? { ...t, deadline: v } : t)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Descrição</label>
              <textarea value={editTask.description || ""} onChange={(e) => setEditTask(t => t ? { ...t, description: e.target.value } : t)} rows={2} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
            </div>
            <RecurrencePicker
              value={{ recurType: editTask.recurType, recurUntil: editTask.recurUntil, recurDaysInterval: editTask.recurDaysInterval }}
              onChange={({ recurType, recurUntil, recurDaysInterval }) => setEditTask(t => t ? { ...t, recurType, recurUntil, recurDaysInterval } : t)}
            />
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditTask(null)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
              <button onClick={() => {
                if (!editTask.title) { toast.error("Título é obrigatório"); return; }
                updateTask(editTask.id, {
                  title: editTask.title, client: editTask.client, clientId: editTask.clientId,
                  module: editTask.module, urgency: editTask.urgency, assignee: editTask.assignee,
                  deadline: editTask.deadline, description: editTask.description, recurUntil: editTask.recurUntil,
                  recurType: editTask.recurType, recurDaysInterval: editTask.recurDaysInterval,
                });
                logAudit(currentUser?.name || 'Desconhecido', 'Editou tarefa', editTask.title, editTask.id);
                toast.success("Tarefa atualizada!");
                setEditTask(null);
              }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
