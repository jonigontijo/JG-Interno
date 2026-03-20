import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import OperationTaskList from "@/components/OperationTaskList";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Task } from "@/data/mockData";
import { DatePicker } from "@/components/ui/date-picker";
import { RecurrencePicker } from "@/components/ui/recurrence-picker";

export default function TrafficPage() {
  const { tasks, clients, team, addTask, logAudit } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const trafficTasks = tasks.filter(t => t.module === "Tráfego");
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", clientId: "", assignee: "", deadline: "", urgency: "normal" as Task["urgency"], type: "Otimização", description: "", recurType: undefined as Task["recurType"], recurUntil: "", recurDaysInterval: undefined as Task["recurDaysInterval"] });

  const handleCreate = () => {
    if (!newTask.title || !newTask.clientId || !newTask.assignee || !newTask.deadline) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const client = clients.find(c => c.id === newTask.clientId);
    addTask({
      id: `t-${Date.now()}`,
      title: newTask.title,
      client: client?.company || "",
      clientId: newTask.clientId,
      module: "Tráfego",
      sector: "Tráfego",
      type: newTask.type,
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
    });
    logAudit(currentUser?.name || 'Desconhecido', 'Criou tarefa', newTask.title);
    toast.success("Tarefa criada!");
    setShowModal(false);
    setNewTask({ title: "", clientId: "", assignee: "", deadline: "", urgency: "normal", type: "Otimização", description: "", recurType: undefined as Task["recurType"], recurUntil: "", recurDaysInterval: undefined as Task["recurDaysInterval"] });
  };

  return (
    <div>
      <PageHeader title="Tráfego Pago" description="Campanhas e otimizações">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </button>
      </PageHeader>

      <OperationTaskList moduleName="Tráfego" tasks={trafficTasks} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Tarefa de Tráfego">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
            <input type="text" value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="Ex: Otimização Meta Ads" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente *</label>
              <select value={newTask.clientId} onChange={(e) => setNewTask(t => ({ ...t, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {clients.filter(c => c.services.some(s => s.toLowerCase().includes("tráfego") || s.toLowerCase().includes("trafego"))).sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Tipo</label>
              <select value={newTask.type} onChange={(e) => setNewTask(t => ({ ...t, type: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {["Otimização", "Setup", "Campanha", "Criativo", "Relatório", "Ajuste", "Solicitação Cliente"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável *</label>
              <select value={newTask.assignee} onChange={(e) => setNewTask(t => ({ ...t, assignee: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {team.map(m => <option key={m.id} value={m.name}>{m.name} ({m.role})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Prazo *</label>
              <DatePicker value={newTask.deadline} onChange={(v) => setNewTask(t => ({ ...t, deadline: v }))} placeholder="Selecionar prazo" />
            </div>
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