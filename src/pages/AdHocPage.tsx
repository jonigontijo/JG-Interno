import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/data/mockData";

export default function AdHocPage() {
  const { tasks, clients, addTask, deleteTask, startTask, completeTask, logAudit } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const allUsers = useAuthStore((s) => s.users);

  const adHocTasks = tasks.filter(t => t.module === "Demandas Avulsas");

  const [showModal, setShowModal] = useState(false);
  const [newDemand, setNewDemand] = useState({
    title: "",
    clientId: "",
    type: "Ajuste",
    assignee: "",
    deadline: "",
    urgency: "normal" as Task["urgency"],
    description: "",
  });

  const handleCreate = () => {
    if (!newDemand.title) {
      toast.error("Preencha o título da demanda");
      return;
    }
    const client = clients.find(c => c.id === newDemand.clientId);
    const task: Task = {
      id: `t-${Date.now()}`,
      title: newDemand.title,
      client: client?.company || "Interno",
      clientId: newDemand.clientId || "",
      module: "Demandas Avulsas",
      sector: "Avulso",
      type: newDemand.type,
      assignee: newDemand.assignee || currentUser?.name || "",
      deadline: newDemand.deadline || new Date().toISOString().slice(0, 10),
      urgency: newDemand.urgency,
      status: "backlog",
      weight: 1,
      estimatedHours: 1,
      hasRework: false,
      createdAt: new Date().toISOString().slice(0, 10),
      description: newDemand.description || undefined,
    };
    addTask(task);
    logAudit(currentUser?.name || 'Desconhecido', 'Criou demanda avulsa', task.title, task.id);
    toast.success("Demanda avulsa criada!");
    setShowModal(false);
    setNewDemand({ title: "", clientId: "", type: "Ajuste", assignee: "", deadline: "", urgency: "normal", description: "" });
  };

  const handleDelete = (id: string) => {
    const demand = adHocTasks.find(d => d.id === id);
    if (window.confirm(`Excluir demanda "${demand?.title}"?`)) {
      deleteTask(id);
      logAudit(currentUser?.name || 'Desconhecido', 'Apagou demanda avulsa', demand?.title || '', id);
      toast.success("Demanda excluída");
    }
  };

  return (
    <div>
      <PageHeader title="Demandas Avulsas" description="Ajustes, correções e solicitações pontuais">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Nova Demanda
        </button>
      </PageHeader>
      <div className="grid gap-3">
        {adHocTasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma demanda avulsa</p>
        )}
        {adHocTasks.map(d => (
          <div key={d.id} className="rounded-lg border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div>
              <p className="text-sm font-medium text-foreground">{d.title}</p>
              <p className="text-xs text-muted-foreground">
                {d.client || "Interno"} · {d.type} · {d.assignee}
              </p>
              {d.description && <p className="text-xs text-muted-foreground/70 mt-0.5">{d.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={d.status} />
              <StatusBadge status={d.urgency} />
              <button
                onClick={() => handleDelete(d.id)}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Excluir demanda"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nova Demanda Avulsa">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Título *</label>
            <input type="text" value={newDemand.title} onChange={(e) => setNewDemand(d => ({ ...d, title: e.target.value }))} placeholder="Ex: Ajuste copy anúncio" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Descrição</label>
            <textarea value={newDemand.description} onChange={(e) => setNewDemand(d => ({ ...d, description: e.target.value }))} placeholder="Descreva a demanda..." rows={3} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Cliente</label>
              <select value={newDemand.clientId} onChange={(e) => setNewDemand(d => ({ ...d, clientId: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Interno / Sem cliente</option>
                {[...clients].sort((a, b) => a.company.localeCompare(b.company)).map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Tipo</label>
              <select value={newDemand.type} onChange={(e) => setNewDemand(d => ({ ...d, type: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                {["Ajuste", "Nova arte", "Correção", "Solicitação", "Campanha", "Outro"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Responsável</label>
              <select value={newDemand.assignee} onChange={(e) => setNewDemand(d => ({ ...d, assignee: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="">Eu mesmo</option>
                {allUsers.filter(u => u.active).map(u => <option key={u.id} value={u.name}>{u.name}{u.role ? ` (${u.role})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Urgência</label>
              <select value={newDemand.urgency} onChange={(e) => setNewDemand(d => ({ ...d, urgency: e.target.value as Task["urgency"] }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground">
                <option value="normal">Normal</option>
                <option value="priority">Prioridade</option>
                <option value="urgent">Urgente</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Prazo</label>
            <input type="date" value={newDemand.deadline} onChange={(e) => setNewDemand(d => ({ ...d, deadline: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleCreate} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Criar Demanda</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
