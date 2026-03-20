import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { formatCurrency } from "@/data/mockData";
import { DollarSign, TrendingUp, AlertTriangle, CreditCard, ShieldAlert } from "lucide-react";

export default function DashboardFinancialPage() {
  const { currentUser } = useAuthStore();
  const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const canSeeFinancial = currentUser?.isAdmin || userRoles.some(r => r === "Financeiro" || r === "Diretoria");

  const { clients } = useAppStore();

  if (!canSeeFinancial) {
    return (
      <div>
        <PageHeader title="Dashboard Financeiro" description="Acesso restrito" />
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mb-4 text-destructive/50" />
          <p className="text-sm font-medium">Acesso restrito a Financeiro e Diretoria</p>
          <p className="text-xs mt-1">Você não tem permissão para visualizar dados financeiros.</p>
        </div>
      </div>
    );
  }

  const mrr = clients.filter(c => c.status === "Operação").reduce((s, c) => s + c.monthlyValue, 0);
  const totalSetup = clients.reduce((s, c) => s + c.setupValue, 0);
  const clientsAtrasados = clients.filter(c => c.paymentStatus === "atrasado").length;
  const valorAtrasado = clients.filter(c => c.paymentStatus === "atrasado").reduce((s, c) => s + c.monthlyValue, 0);

  return (
    <div>
      <PageHeader title="Dashboard Financeiro" description="Receitas, MRR e previsões" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="MRR" value={formatCurrency(mrr)} icon={<DollarSign className="w-4 h-4" />} changeType="positive" />
        <MetricCard label="Setup Acumulado" value={formatCurrency(totalSetup)} icon={<CreditCard className="w-4 h-4" />} />
        <MetricCard label="Previsão Caixa" value={formatCurrency(mrr + totalSetup)} icon={<TrendingUp className="w-4 h-4" />} />
        <MetricCard label="Pagtos Atrasados" value={formatCurrency(valorAtrasado)} icon={<AlertTriangle className="w-4 h-4" />} changeType={clientsAtrasados > 0 ? "negative" : "positive"} change={clientsAtrasados > 0 ? `${clientsAtrasados} cliente(s)` : "Sem atrasos"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Clientes Pagantes" value={clients.filter(c => c.status === "Operação").length} />
        <MetricCard label="Ticket Médio" value={formatCurrency(mrr / Math.max(clients.filter(c => c.status === "Operação").length, 1))} />
        <MetricCard label="Inadimplência" value={mrr > 0 ? `${((valorAtrasado / mrr) * 100).toFixed(1)}%` : "0%"} changeType={clientsAtrasados > 0 ? "negative" : "positive"} />
        <MetricCard label="Comissões" value={formatCurrency(mrr * 0.1)} />
      </div>
    </div>
  );
}
