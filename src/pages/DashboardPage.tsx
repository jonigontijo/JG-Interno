import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { formatCurrency } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { Users, DollarSign, AlertTriangle, CheckCircle, Clock, TrendingUp, Target, Zap, FileText } from "lucide-react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const canSeeFinancial = currentUser?.isAdmin || userRoles.some(r => r === "Financeiro" || r === "Diretoria");

  const { clients, tasks, team, quoteRequests } = useAppStore();

  const activeClients = clients.filter(c => c.status === "Operação").length;
  const prospecting = clients.filter(c => c.status === "Prospecção").length;
  const onboarding = clients.filter(c => c.status === "Onboarding").length;
  const awaitingPayment = clients.filter(c => c.substatus === "Aguardando pagamento").length;
  const mrr = canSeeFinancial ? clients.filter(c => c.status === "Operação").reduce((sum, c) => sum + c.monthlyValue, 0) : 0;
  const overdueTasks = tasks.filter(t => t.status === "overdue").length;
  const pendingApprovals = tasks.filter(t => t.status === "approval").length;
  const criticalTasks = tasks.filter(t => t.urgency === "critical" || t.urgency === "urgent").length;
  const riskClients = clients.filter(c => c.riskLevel === "high" || c.riskLevel === "critical");
  const pendingQuotes = quoteRequests.filter(q => q.status !== "paid" && q.status !== "cancelled");

  return (
    <div>
      <PageHeader title="Dashboard Executivo" description="Visão geral da operação" />

      {/* Pending quotes alert */}
      {pendingQuotes.length > 0 && (
        <button
          onClick={() => navigate("/quote-requests")}
          className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning/5 hover:bg-warning/10 transition-colors text-left"
        >
          <FileText className="w-5 h-5 text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{pendingQuotes.length} solicitação(ões) de orçamento pendente(s)</p>
            <p className="text-xs text-muted-foreground">Clique para revisar e enviar propostas</p>
          </div>
        </button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Clientes Ativos" value={activeClients} change="+2 este mês" changeType="positive" icon={<Users className="w-4 h-4" />} />
        {canSeeFinancial ? (
          <MetricCard label="MRR" value={formatCurrency(mrr)} change="+12% vs mês anterior" changeType="positive" icon={<DollarSign className="w-4 h-4" />} />
        ) : (
          <MetricCard label="Tarefas Ativas" value={tasks.filter(t => t.status !== "done").length} icon={<CheckCircle className="w-4 h-4" />} />
        )}
        <MetricCard label="Em Prospecção" value={prospecting} icon={<Target className="w-4 h-4" />} />
        <MetricCard label="Em Onboarding" value={onboarding} icon={<Zap className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Aguardando Pagamento" value={awaitingPayment} changeType={awaitingPayment > 0 ? "negative" : "neutral"} icon={<Clock className="w-4 h-4" />} />
        <MetricCard label="Tarefas Atrasadas" value={overdueTasks} change={overdueTasks > 0 ? "Atenção necessária" : ""} changeType="negative" icon={<AlertTriangle className="w-4 h-4" />} />
        <MetricCard label="Aprovações Pendentes" value={pendingApprovals} icon={<CheckCircle className="w-4 h-4" />} />
        <MetricCard label="Urgentes/Críticas" value={criticalTasks} changeType={criticalTasks > 0 ? "negative" : "neutral"} icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Clients */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Clientes em Risco
          </h2>
          {riskClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente em risco</p>
          ) : (
            <div className="space-y-3">
              {riskClients.map(client => (
                <div
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{client.company}</p>
                    <p className="text-xs text-muted-foreground">{client.services.join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{client.overdueTasks} atrasadas</span>
                    <StatusBadge status={client.riskLevel === "critical" ? "critical" : "urgent"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workload */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Carga do Time
          </h2>
          <div className="space-y-3">
            {team.slice(0, 6).map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                  {member.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{member.name}</span>
                    <span className={`text-xs font-mono ${member.currentLoad > 85 ? "text-destructive" : member.currentLoad > 70 ? "text-warning" : "text-success"}`}>
                      {member.currentLoad}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${member.currentLoad > 85 ? "bg-destructive" : member.currentLoad > 70 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${Math.min(member.currentLoad, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tarefas Recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 font-medium">Tarefa</th>
                  <th className="text-left py-2 font-medium">Cliente</th>
                  <th className="text-left py-2 font-medium">Responsável</th>
                  <th className="text-left py-2 font-medium">Prazo</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Urgência</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 8).map(task => (
                  <tr key={task.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 text-sm text-foreground">{task.title}</td>
                    <td className="py-2.5 text-sm text-muted-foreground">{task.client}</td>
                    <td className="py-2.5 text-sm text-muted-foreground">{task.assignee}</td>
                    <td className="py-2.5 text-xs font-mono text-muted-foreground">{task.deadline}</td>
                    <td className="py-2.5"><StatusBadge status={task.status} /></td>
                    <td className="py-2.5"><StatusBadge status={task.urgency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
