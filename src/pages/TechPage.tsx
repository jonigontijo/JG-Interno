import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { Plus, Play, Square, Clock } from "lucide-react";
import { formatTime } from "@/data/mockData";
import type { Task } from "@/data/mockData";
import { DatePicker } from "@/components/ui/date-picker";
import { RecurrencePicker } from "@/components/ui/recurrence-picker";

export default function TechPage() {
  const { tasks, clients, team, addTask, startTask, completeTask, logAudit } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const techTasks = tasks.filter(t => t.module === "Tech");
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", clientId: "", assignee: "", deadline: "", urgency: "normal" as Task["urgency"], type: "Desenvolvimento", description: "", recurType: undefined as Task["recurType"], recurUntil: "", recurDaysInterval: undefined as Task["recurDaysInterval"] });

  const getElapsedTime = (task: Task): string | null => {
    if (!task.startedAt) return null;
    if (task.completedAt && task.timeSpentMinutes !== undefined) return formatTime(task.timeSpentMinutes);
    return formatTime(Math.round((Date.now() - new Date(task.startedAt).getTime()) / 60000));
  };

  const handleCreate = () => {
    if (!newTask.title || !newTask.clientId || !newTask.assignee || !newTask.deadline) {
      toast.error("Preencha todos os campos");
      return;
    }
    const client = clients.find(c => c.id === newTask.clientId);
    addTask({
      id: `t-${Date.now()}`,
      title: newTask.title,
      client: client?.company || "",
      clientId: newTask.clientId,
      module: "Tech",
      sector: "Dev",
      type: newTask.type,
      assignee: newTask.assignee,
      deadline: newTask.deadline,
      urgency: newTask.urgency,
      status: "backlog",
      weight: 3,
      estimatedHours: 4,
      hasRework: false,
      createdAt: new Date().toISOString().slice(0, 10),
      description: newTask.description || undefined,
      recurUntil: newTask.recurUntil || undefined,
      recurType: newTask.recurType,
      recurDaysInterval: newTask.recurDaysInterval,
    });
    logAudit(currentUser?.name || 'Desconhecido', 'Criou tarefa', newTask.title);
    toast.success("Tarefa criada!");
    setShowModal(false);
    setNewTask({ title: "", clientId: "", assignee: "", deadline: "", urgency: "normal", type: "Desenvolvimento", description: "", recurType: undefined as Task["recurType"], recurUntil: "", recurDaysInterval: undefined as Task["recurDaysInterval"] });
  };

  return (
    <div>
      <PageHeader title="Tech / Sites" description="Landing pages, sites e integrações">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </button>
      </PageHeader>
      <div className="grid gap-3">
        {techTasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma tarefa técnica</p>}
        {techTasks.map(t => {
          const elapsed = getElapsedTime(t);
          return (
            <div key={t.id} className="rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.client} · {t.assignee} · Prazo: {t.deadline}</p>
                  {elapsed && (
                    <div className="flex items-center gap-1 text-[10px] mt-1">
                      <Clock className="w-3 h-3" />
                      <span className={t.status === "in_progress" ? "text-primary font-mono animate-pulse" : "text-muted-foreground font-mono"}>{elapsed}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.type}</span>
                  <StatusBadge status={t.status} />
                  {t.status !== "in_progress" && t.status !== "done" && (
                    <button onClick={() => { startTask(t.id); toast.success("Iniciada!"); }} className="p-1 rounded bg-primary/20 text-primary hover:bg-primary/30"><Play className="w-3.5 h-3.5" /></button>
                  )}
                  {t.status === "in_progress" && (
                    <button onClick={() => { completeTask(t.id); toast.success("Concluída!"); }} className="p-1 rounded bg-success/20 text-success hover:bg-success/30"><Square className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Tarefa Tech">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
            <input type="text" value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="Ex: Ajuste landing page" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente *</label>
              <select value={newTask.clientId} onChange={(e) => setNewTask(t => ({ ...t, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {[...clients].sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Tipo</label>
              <select value={newTask.type} onChange={(e) => setNewTask(t => ({ ...t, type: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {["Desenvolvimento", "Landing Page", "Ajuste", "Integração", "Bug Fix", "Hospedagem"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável *</label>
              <select value={newTask.assignee} onChange={(e) => setNewTask(t => ({ ...t, assignee: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
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
            onChange={({ recurType, recurUntil, recurDaysInterval }) => setNewTask(t => ({ ...t, recurType, recurUntil, recurDaysInterval }))}
          />
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Criar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
