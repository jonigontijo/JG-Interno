import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import { useAppStore } from "@/store/useAppStore";
import { Activity, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function DashboardOpsPage() {
  const { tasks, team } = useAppStore();
  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const overdue = tasks.filter(t => t.status === "overdue").length;
  const approvals = tasks.filter(t => t.status === "approval").length;
  const rework = tasks.filter(t => t.hasRework).length;

  return (
    <div>
      <PageHeader title="Dashboard Operacional" description="Métricas de produtividade e entrega" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total de Tarefas" value={total} icon={<Activity className="w-4 h-4" />} />
        <MetricCard label="Concluídas" value={done} icon={<CheckCircle className="w-4 h-4" />} changeType="positive" />
        <MetricCard label="Atrasadas" value={overdue} icon={<Clock className="w-4 h-4" />} changeType="negative" />
        <MetricCard label="Retrabalho" value={rework} icon={<AlertTriangle className="w-4 h-4" />} changeType={rework > 0 ? "negative" : "neutral"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Aprovações Pendentes" value={approvals} />
        <MetricCard label="Taxa no Prazo" value={total > 0 ? `${Math.round(((total - overdue) / total) * 100)}%` : "0%"} changeType="positive" />
        <MetricCard label="Tarefas por Pessoa" value={team.length > 0 ? (total / team.length).toFixed(1) : "0"} />
        <MetricCard label="Urgentes" value={tasks.filter(t => t.urgency === "urgent" || t.urgency === "critical").length} changeType="negative" />
      </div>
    </div>
  );
}
