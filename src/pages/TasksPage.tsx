import React, { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import Modal from "@/components/Modal";
import { toast } from "sonner";
import { formatTime } from "@/data/mockData";
import { LayoutGrid, List, Plus, Play, Square, Clock, GripVertical, Pause, Trash2 } from "lucide-react";
import { useTimeTick } from "@/hooks/useTimeTick";
import type { Task } from "@/data/mockData";

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
  const [newTask, setNewTask] = useState({ title: "", clientId: "", module: "Tráfego", assignee: "", deadline: "", urgency: "normal" as Task["urgency"], description: "", recurUntil: "" });
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Force re-render every 30s so elapsed time updates live
  useTimeTick(30000);

  // Filter: admins see all, others see only their own tasks
  const myTasks = currentUser?.isAdmin
    ? tasks
    : tasks.filter(t => t.assignee === currentUser?.name);

  const getColumnTasks = (colKey: string) => {
    switch (colKey) {
      case "urgent":
        return myTasks.filter(t => (t.urgency === "urgent" || t.urgency === "critical") && t.status !== "done" && t.status !== "completed" && t.status !== "paused");
      case "backlog":
        return myTasks.filter(t => (t.status === "backlog" || t.status === "pending") && !(t.urgency === "urgent" || t.urgency === "critical") && t.status !== "paused");
      case "in_progress":
        return myTasks.filter(t => t.status === "in_progress");
      case "paused":
        return myTasks.filter(t => t.status === "paused");
      case "approval":
        return myTasks.filter(t => t.status === "approval" || t.status === "waiting_client");
      case "done":
        return myTasks.filter(t => t.status === "done");
      case "completed":
        return myTasks.filter(t => t.status === "completed");
      default:
        return [];
    }
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
    if (!newTask.title || !newTask.clientId || !newTask.assignee || !newTask.deadline) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const client = clients.find(c => c.id === newTask.clientId);
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
    };
    addTask(task);
    logAudit(currentUser?.name || 'Desconhecido', 'Criou tarefa', task.title, task.id);
    toast.success("Tarefa criada!");
    setShowModal(false);
    setNewTask({ title: "", clientId: "", module: "Tráfego", assignee: "", deadline: "", urgency: "normal", description: "", recurUntil: "" });
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const kanbanContainerRef = React.useRef<HTMLDivElement>(null);
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
      <PageHeader title="Tarefas" description={`${myTasks.length} tarefa${myTasks.length !== 1 ? "s" : ""}${currentUser?.isAdmin ? " no sistema" : " atribuídas a você"}`}>
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
                    return (
                      <div
                        key={task.id}
                        className="kanban-card group cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <h3 className="text-sm font-medium text-foreground leading-snug">{task.title}</h3>
                          </div>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${urgencyDot(task.urgency)}`} />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{task.client}</p>
                        
                        {/* Time tracking display */}
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
                            <span className="text-[10px] font-mono text-muted-foreground">{task.deadline.slice(5)}</span>
                          </div>
                        </div>
                        {task.hasRework && <span className="text-[9px] text-destructive mt-1 block">⟲ Retrabalho</span>}
                        
                        {/* Action buttons */}
                        <div className="hidden group-hover:flex gap-1 mt-2 flex-wrap">
                          {(col.key !== "in_progress" && col.key !== "done" && task.status !== "paused") && (
                            <button onClick={async () => { await startTask(task.id); toast.success("Tarefa iniciada!"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-0.5">
                              <Play className="w-2.5 h-2.5" /> Iniciar
                            </button>
                          )}
                          {task.status === "paused" && (
                            <button onClick={async () => { await resumeTask(task.id); toast.success("Tarefa retomada!"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-0.5">
                              <Play className="w-2.5 h-2.5" /> Retomar
                            </button>
                          )}
                          {col.key === "in_progress" && (
                            <>
                              <button onClick={async () => { await pauseTask(task.id); toast.info("Tarefa pausada"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-warning/20 text-warning hover:bg-warning/30 transition-colors flex items-center gap-0.5">
                                <Pause className="w-2.5 h-2.5" /> Pausar
                              </button>
                              <button onClick={async () => { await completeTask(task.id); toast.success("Tarefa concluída!"); }} className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success hover:bg-success/30 transition-colors flex items-center gap-0.5">
                                <Square className="w-2.5 h-2.5" /> Finalizar
                              </button>
                            </>
                          )}
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
              {myTasks.map(task => {
                const elapsed = getElapsedTime(task);
                return (
                  <tr key={task.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-sm text-foreground">{task.title}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{task.client}</td>
                    <td className="py-3 px-4"><span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{task.module}</span></td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{task.assignee}</td>
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">{task.deadline}</td>
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
                          onClick={() => {
                            if (confirm(`Apagar tarefa "${task.title}"?`)) {
                              // #region agent log
                              fetch('http://127.0.0.1:7457/ingest/0c49ec12-84fe-49c1-b002-28f07f1904a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'df0f50'},body:JSON.stringify({sessionId:'df0f50',location:'TasksPage.tsx:deleteClick',message:'delete task clicked',data:{taskId:task.id,taskTitle:task.title,user:currentUser?.name},timestamp:Date.now()})}).catch(()=>{});
                              // #endregion
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
            <label className="text-xs font-medium text-foreground block mb-1.5">Cliente *</label>
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
              <input type="date" value={newTask.deadline} onChange={(e) => setNewTask(t => ({ ...t, deadline: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Descrição</label>
            <textarea value={newTask.description} onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))} placeholder="Descreva a tarefa..." rows={2} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Recorrência até</label>
            <input type="date" value={newTask.recurUntil} onChange={(e) => setNewTask(t => ({ ...t, recurUntil: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Criar Tarefa</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
