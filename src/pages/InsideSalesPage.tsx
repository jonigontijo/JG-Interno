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

export default function InsideSalesPage() {
  const { tasks, clients, team, addTask, logAudit } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const insideSalesTasks = tasks.filter(t => t.module === "Inside Sales");
  const insideSalesClients = clients.filter(c => c.services.some(s => s.toLowerCase().includes("inside sales")));
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", clientId: "", assignee: "", deadline: "", urgency: "normal" as Task["urgency"], type: "Atendimento" });

  const handleCreate = () => {
    if (!newTask.title || !newTask.clientId || !newTask.assignee || !newTask.deadline) {
      toast.error("Preencha todos os campos");
      return;
    }
    const client = clients.find(c => c.id === newTask.clientId);
    if (!client?.services.some(s => s.toLowerCase().includes("tráfego") || s.toLowerCase().includes("trafego"))) {
      toast.error("Inside Sales só pode ser ativado para clientes com tráfego ativo!");
      return;
    }
    addTask({
      id: `t-${Date.now()}`,
      title: newTask.title,
      client: client?.company || "",
      clientId: newTask.clientId,
      module: "Inside Sales",
      sector: "Inside Sales",
      type: newTask.type,
      assignee: newTask.assignee,
      deadline: newTask.deadline,
      urgency: newTask.urgency,
      status: "backlog",
      weight: 2,
      estimatedHours: 1,
      hasRework: false,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    logAudit(currentUser?.name || 'Desconhecido', 'Criou tarefa', newTask.title);
    toast.success("Tarefa criada!");
    setShowModal(false);
    setNewTask({ title: "", clientId: "", assignee: "", deadline: "", urgency: "normal", type: "Atendimento" });
  };

  return (
    <div>
      <PageHeader title="Inside Sales" description="Gestão de leads e atendimento comercial">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </button>
      </PageHeader>

      <div className="rounded-lg border bg-card p-5 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Clientes com Inside Sales ativo</p>
        <div className="space-y-2">
          {insideSalesClients.map(c => (
            <div key={c.id} className="p-3 rounded-md bg-muted/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{c.company}</p>
                <p className="text-xs text-muted-foreground">{c.services.join(" · ")}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success">Ativo</span>
            </div>
          ))}
          {insideSalesClients.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente com Inside Sales</p>}
        </div>
      </div>

      <OperationTaskList moduleName="Inside Sales" tasks={insideSalesTasks} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Tarefa Inside Sales">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
            <input type="text" value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="Ex: Follow-up leads" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente * (requer tráfego ativo)</label>
              <select value={newTask.clientId} onChange={(e) => setNewTask(t => ({ ...t, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Selecione...</option>
                {clients.filter(c => c.services.some(s => s.toLowerCase().includes("tráfego") || s.toLowerCase().includes("trafego"))).sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Tipo</label>
              <select value={newTask.type} onChange={(e) => setNewTask(t => ({ ...t, type: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {["Atendimento", "Follow-up", "Qualificação", "Agendamento", "Relatório"].map(t => <option key={t} value={t}>{t}</option>)}
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
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Criar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
