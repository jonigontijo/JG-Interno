import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import { CheckCircle, ExternalLink, Clock, MessageSquare } from "lucide-react";

export default function ApprovalsPage() {
  const { tasks, updateTask } = useAppStore();
  const approvalTasks = tasks.filter(t => t.status === "approval" || t.status === "waiting_client");

  const [adjustModal, setAdjustModal] = useState<string | null>(null);
  const [adjustReason, setAdjustReason] = useState("");

  const handleApprove = (taskId: string) => {
    updateTask(taskId, { status: "done", completedAt: new Date().toISOString() });
    toast.success("Material aprovado com sucesso!");
  };

  const handleRequestAdjust = () => {
    if (!adjustModal) return;
    if (!adjustReason.trim()) {
      toast.error("Descreva o ajuste necessário");
      return;
    }
    updateTask(adjustModal, { status: "pending", hasRework: true });
    toast.info("Ajuste solicitado. Tarefa retornou para execução.");
    setAdjustModal(null);
    setAdjustReason("");
  };

  const handleViewMaterial = (task: any) => {
    toast.info(`Visualização de material para "${task.title}" — funcionalidade de anexos em desenvolvimento.`);
  };

  return (
    <div>
      <PageHeader title="Aprovações" description="Materiais aguardando aprovação do cliente" />

      <div className="grid gap-4">
        {approvalTasks.map(task => (
          <div key={task.id} className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
                <p className="text-xs text-muted-foreground">{task.client} · {task.module} · {task.assignee}</p>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Enviado em {task.createdAt}</span>
              <span>Prazo: {task.deadline}</span>
              {task.hasRework && <span className="text-destructive">⟲ Retrabalho</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprove(task.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/20 text-success text-xs font-medium hover:bg-success/30 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Aprovar
              </button>
              <button
                onClick={() => { setAdjustModal(task.id); setAdjustReason(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Solicitar Ajuste
              </button>
              <button
                onClick={() => handleViewMaterial(task)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver Material
              </button>
            </div>
          </div>
        ))}
        {approvalTasks.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma aprovação pendente</div>
        )}
      </div>

      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title="Solicitar Ajuste">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Descreva o ajuste necessário *</label>
            <textarea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Ex: Alterar cores do banner, corrigir texto..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdjustModal(null)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleRequestAdjust} className="px-4 py-2 rounded-md bg-warning text-warning-foreground text-sm font-medium hover:bg-warning/90">Solicitar Ajuste</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
