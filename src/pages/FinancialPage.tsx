import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency } from "@/data/mockData";
import { useAppStore } from "@/store/useAppStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Modal from "@/components/Modal";
import {
  DollarSign, AlertTriangle, CreditCard, Users, TrendingDown, TrendingUp,
  CheckCircle2, XCircle, Clock, Calendar, Handshake, Filter, FileText, Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TeamSalary {
  memberId: string;
  name: string;
  roles: string[];
  salary: number;
  hireDate?: string;
  company: string;
}

export default function FinancialPage() {
  const { clients, team, updateClient, updateTeamMember } = useAppStore();
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, string>>({});

  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;
  const selectedYearMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthLabel = new Date(selectedYear, selectedMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  useEffect(() => {
    (supabase as any).from('payment_history').select('client_id, paid_date').eq('year_month', selectedYearMonth).then(({ data, error }: any) => {
      if (error) { console.error('Load payment history:', error); return; }
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => { map[row.client_id] = row.paid_date; });
      setPaymentHistory(map);
    });
  }, [selectedYearMonth]);

  const isPaidInSelectedMonth = (clientId: string) => !!paymentHistory[clientId];

  // Financial metrics
  const mrr = clients.reduce((s, c) => s + c.monthlyValue, 0);
  const totalSetup = clients.reduce((s, c) => s + c.setupValue, 0);
  const grossRevenue = mrr + totalSetup;

  // Payment tracking - calculate days overdue dynamically for selected month
  const clientsWithPaymentInfo = useMemo(() => {
    return clients.map(c => {
      if (!c.paymentDueDay || c.monthlyValue === 0) return { ...c, paidThisMonth: false, daysOverdue: 0 };
      const paidThisMonth = isPaidInSelectedMonth(c.id);
      if (paidThisMonth) return { ...c, paidThisMonth, daysOverdue: 0 };

      const dueDate = new Date(selectedYear, selectedMonth, c.paymentDueDay);
      const referenceDate = isCurrentMonth ? today : new Date(selectedYear, selectedMonth + 1, 0);
      if (dueDate > referenceDate) return { ...c, paidThisMonth, daysOverdue: 0 };

      const diffDays = Math.floor((referenceDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return { ...c, paidThisMonth, daysOverdue: diffDays };
    });
  }, [clients, currentDay, selectedMonth, selectedYear, paymentHistory]);

  const paidClients = clientsWithPaymentInfo.filter(c => c.paidThisMonth && c.monthlyValue > 0);
  const unpaidClients = clientsWithPaymentInfo.filter(c => !c.paidThisMonth && c.monthlyValue > 0);
  const overdueClients = clientsWithPaymentInfo.filter(c => !c.paidThisMonth && (c.daysOverdue ?? 0) > 0 && c.monthlyValue > 0);
  const barterClients = clients.filter(c => c.isBarter);

  const totalReceived = paidClients.reduce((s, c) => s + c.monthlyValue, 0);
  const totalPending = unpaidClients.reduce((s, c) => s + c.monthlyValue, 0);
  const totalOverdue = overdueClients.reduce((s, c) => s + c.monthlyValue, 0);

  // Week filter for forecast
  const [forecastFilter, setForecastFilter] = useState<string>("all");

  const forecastClients = useMemo(() => {
    if (forecastFilter === "all") return unpaidClients;
    const daysAhead = parseInt(forecastFilter);
    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + daysAhead);
    return unpaidClients.filter(c => {
      if (!c.paymentDueDay) return false;
      const dueDate = new Date(currentYear, currentMonth, c.paymentDueDay);
      return dueDate <= limitDate;
    });
  }, [unpaidClients, forecastFilter, currentDay]);

  const forecastTotal = forecastClients.reduce((s, c) => s + c.monthlyValue, 0);

  // Salary section - derived from persisted store
  const salaries: TeamSalary[] = useMemo(() =>
    team.map(m => ({ memberId: m.id, name: m.name, roles: m.roles || [m.role], salary: m.salary || 0, hireDate: m.hireDate, company: m.company || "JG" })),
    [team]
  );
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [projectedSalaries, setProjectedSalaries] = useState<Record<string, number>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load projections from DB on mount
  useEffect(() => {
    (supabase as any).from('salary_projections').select('*').then(({ data, error }: any) => {
      if (error) { console.error('Load projections:', error); return; }
      if (data && data.length > 0) {
        const map: Record<string, number> = {};
        data.forEach((row: any) => { map[row.member_id] = Number(row.projected_salary); });
        setProjectedSalaries(map);
      }
    });
  }, []);

  // Debounced save to DB
  const saveProjections = useCallback((projections: Record<string, number>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const rows = Object.entries(projections).map(([memberId, salary]) => ({
        member_id: memberId,
        projected_salary: salary,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length === 0) {
        await (supabase as any).from('salary_projections').delete().neq('member_id', '');
        return;
      }
      const { error } = await (supabase as any).from('salary_projections').upsert(rows);
      if (error) console.error('Save projections:', error);
    }, 800);
  }, []);

  const updateProjectedSalary = useCallback((memberId: string, value: number) => {
    setProjectedSalaries(prev => {
      const next = { ...prev, [memberId]: value };
      saveProjections(next);
      return next;
    });
  }, [saveProjections]);

  const resetProjections = useCallback(() => {
    setProjectedSalaries({});
    saveProjections({});
  }, [saveProjections]);

  const companies = ["JG", "Prime", "JG Tech"];
  const salariesByCompany = companies.map(comp => ({
    company: comp,
    members: salaries.filter(s => s.company === comp),
    total: salaries.filter(s => s.company === comp).reduce((sum, s) => sum + s.salary, 0),
  }));

  const totalSalaries = salaries.reduce((s, m) => s + m.salary, 0);
  const jgOnlySalaries = salariesByCompany.find(c => c.company === "JG")?.total || 0;
  const salaryPercentage = grossRevenue > 0 ? (jgOnlySalaries / grossRevenue) * 100 : 0;
  const isCritical = salaryPercentage > 40;
  const isWarning = salaryPercentage > 30 && salaryPercentage <= 40;
  const isHealthy = salaryPercentage <= 30;

  const handleUpdateSalary = (memberId: string, newSalary: number) => {
    updateTeamMember(memberId, { salary: newSalary, totalCost: newSalary });
  };

  // Barter modal
  const [barterModal, setBarterModal] = useState<string | null>(null);
  const [barterForm, setBarterForm] = useState({
    description: "",
    agreedValue: 0,
    startDate: "",
    endDate: "",
    notes: ""
  });

  const handleTogglePaid = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const currentlyPaid = isPaidInSelectedMonth(clientId);
    const newIsPaid = !currentlyPaid;
    const paidDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (newIsPaid) {
      setPaymentHistory(prev => ({ ...prev, [clientId]: paidDateStr }));
      try {
        const { error } = await (supabase as any).from('payment_history').upsert({
          client_id: clientId,
          year_month: selectedYearMonth,
          paid_date: paidDateStr,
          amount: client.monthlyValue,
        }, { onConflict: 'client_id,year_month' });
        if (error) { console.error('Erro ao salvar pagamento:', error); toast.error('Erro ao salvar.'); }
        else toast.success('Marcado como pago!');
      } catch (err) { console.error(err); toast.error('Erro ao salvar.'); }
    } else {
      setPaymentHistory(prev => { const next = { ...prev }; delete next[clientId]; return next; });
      try {
        const { error } = await (supabase as any).from('payment_history').delete().eq('client_id', clientId).eq('year_month', selectedYearMonth);
        if (error) { console.error('Erro ao remover pagamento:', error); toast.error('Erro ao remover.'); }
        else toast.success('Pagamento desmarcado.');
      } catch (err) { console.error(err); toast.error('Erro ao remover.'); }
    }

    if (isCurrentMonth) {
      updateClient(clientId, { isPaid: newIsPaid, paidDate: newIsPaid ? paidDateStr : undefined });
      await (supabase as any).from('clients').update({ is_paid: newIsPaid, paid_date: newIsPaid ? paidDateStr : null }).eq('id', clientId);
    }
  };

  const handleSaveBarter = (clientId: string) => {
    updateClient(clientId, {
      isBarter: true,
      barterDetails: { ...barterForm },
    });
    setBarterModal(null);
    setBarterForm({ description: "", agreedValue: 0, startDate: "", endDate: "", notes: "" });
  };

  const handleRemoveBarter = (clientId: string) => {
    updateClient(clientId, {
      isBarter: false,
      barterDetails: undefined,
    });
  };


  return (
    <div>
      <PageHeader title="Financeiro" description="Controle financeiro, cobranças e faturamento" />

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="MRR" value={formatCurrency(mrr)} icon={<DollarSign className="w-4 h-4" />} changeType="positive" />
        <MetricCard label="Recebido (mês)" value={formatCurrency(totalReceived)} icon={<CheckCircle2 className="w-4 h-4" />} changeType="positive" change={`${paidClients.length} clientes`} />
        <MetricCard label="A Receber" value={formatCurrency(totalPending)} icon={<Clock className="w-4 h-4" />} change={`${unpaidClients.length} clientes`} />
        <MetricCard label="Inadimplência" value={formatCurrency(totalOverdue)} icon={<AlertTriangle className="w-4 h-4" />} changeType={overdueClients.length > 0 ? "negative" : "positive"} change={overdueClients.length > 0 ? `${overdueClients.length} atrasado(s)` : "Sem atrasos"} />
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="overdue">Inadimplência</TabsTrigger>
          <TabsTrigger value="barter">Permutas</TabsTrigger>
          <TabsTrigger value="payroll">Folha Salarial</TabsTrigger>
          <TabsTrigger value="projection">Projeção</TabsTrigger>
          <TabsTrigger value="regulation">Regulação 40%</TabsTrigger>
        </TabsList>

        {/* ===== PAYMENTS TAB ===== */}
        <TabsContent value="payments" className="space-y-4">
          {/* Forecast filter */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Previsão de Recebimento
              </h2>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={forecastFilter} onValueChange={setForecastFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos pendentes</SelectItem>
                    <SelectItem value="3">Próximos 3 dias</SelectItem>
                    <SelectItem value="7">Próximos 7 dias</SelectItem>
                    <SelectItem value="14">Próximos 14 dias</SelectItem>
                    <SelectItem value="30">Próximos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Clientes no filtro</p>
                <p className="text-xl font-bold text-foreground">{forecastClients.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Total previsto</p>
                <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(forecastTotal)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">% do MRR</p>
                <p className="text-xl font-bold font-mono text-foreground">{mrr > 0 ? ((forecastTotal / mrr) * 100).toFixed(0) : 0}%</p>
              </div>
            </div>
          </div>

          {/* Month selector */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Período de Visualização
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const prev = selectedMonth === 0 ? 11 : selectedMonth - 1;
                    const yr = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
                    setSelectedMonth(prev);
                    setSelectedYear(yr);
                  }}
                  className="px-2 py-1 rounded border text-xs hover:bg-muted transition-colors"
                >
                  ←
                </button>
                <span className="text-sm font-medium text-foreground min-w-[140px] text-center capitalize">{monthLabel}</span>
                <button
                  onClick={() => {
                    const next = selectedMonth === 11 ? 0 : selectedMonth + 1;
                    const yr = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
                    setSelectedMonth(next);
                    setSelectedYear(yr);
                  }}
                  className="px-2 py-1 rounded border text-xs hover:bg-muted transition-colors"
                >
                  →
                </button>
                {!isCurrentMonth && (
                  <button
                    onClick={() => { setSelectedMonth(currentMonth); setSelectedYear(currentYear); }}
                    className="ml-2 text-[10px] px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors"
                  >
                    Mês atual
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Payment status table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground capitalize">Status de Pagamento – {monthLabel}</h2>
              <span className="text-xs text-muted-foreground">{paidClients.length}/{clients.filter(c => c.monthlyValue > 0).length} pagos</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                    <th className="text-center py-3 px-3 font-medium w-12">Pago</th>
                    <th className="text-left py-3 px-4 font-medium">Empresa</th>
                    <th className="text-left py-3 px-4 font-medium">Vencimento</th>
                    <th className="text-right py-3 px-4 font-medium">Mensalidade</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-center py-3 px-4 font-medium">Dias</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsWithPaymentInfo
                    .filter(c => c.monthlyValue > 0)
                    .sort((a, b) => (a.paymentDueDay || 99) - (b.paymentDueDay || 99))
                    .map(client => {
                      const paid = client.paidThisMonth;
                      const overdue = !paid && (client.daysOverdue ?? 0) > 0;
                      return (
                        <tr key={client.id} className={`border-b border-border/50 transition-colors ${overdue ? "bg-destructive/5" : paid ? "bg-success/5" : "hover:bg-muted/20"}`}>
                          <td className="py-3 px-3 text-center">
                            <Checkbox
                              checked={!!paid}
                              onCheckedChange={() => handleTogglePaid(client.id)}
                              className="mx-auto"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${paid ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                {client.company}
                              </p>
                              {client.isBarter && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Permuta</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {client.paymentDueDay ? (
                              <span className="text-xs font-mono text-muted-foreground">Dia {String(client.paymentDueDay).padStart(2, '0')}</span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-4 text-sm font-mono text-foreground text-right">{formatCurrency(client.monthlyValue)}</td>
                          <td className="py-3 px-4 text-center">
                            {paid ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                              </span>
                            ) : overdue ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                <XCircle className="w-3.5 h-3.5" /> Atrasado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" /> Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {paid ? (
                              <span className="text-xs text-success">✓</span>
                            ) : overdue ? (
                              <span className="text-xs font-bold text-destructive">{client.daysOverdue}d</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {isCurrentMonth && client.paymentDueDay ? `${client.paymentDueDay - currentDay}d` : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ===== OVERDUE / DELINQUENCY TAB ===== */}
        <TabsContent value="overdue" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Atrasado" value={formatCurrency(totalOverdue)} icon={<AlertTriangle className="w-4 h-4" />} changeType="negative" />
            <MetricCard label="Clientes Atrasados" value={overdueClients.length} icon={<XCircle className="w-4 h-4" />} changeType="negative" />
            <MetricCard label="Taxa Inadimplência" value={mrr > 0 ? `${((totalOverdue / mrr) * 100).toFixed(1)}%` : "0%"} changeType={overdueClients.length > 0 ? "negative" : "positive"} />
            <MetricCard label="Média Dias Atraso" value={overdueClients.length > 0 ? `${Math.round(overdueClients.reduce((s, c) => s + (c.daysOverdue ?? 0), 0) / overdueClients.length)}d` : "0d"} />
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-destructive/10">
              <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Clientes Inadimplentes – Facilita Cobrança
              </h2>
            </div>
            {overdueClients.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                    <th className="text-left py-3 px-4 font-medium">Empresa</th>
                    <th className="text-left py-3 px-4 font-medium">Vencimento</th>
                    <th className="text-right py-3 px-4 font-medium">Valor</th>
                    <th className="text-center py-3 px-4 font-medium">Dias em Aberto</th>
                    <th className="text-center py-3 px-4 font-medium">Gravidade</th>
                    <th className="text-center py-3 px-4 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueClients
                    .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0))
                    .map(client => {
                      const days = client.daysOverdue ?? 0;
                      const severity = days > 30 ? "critical" : days > 15 ? "high" : days > 7 ? "medium" : "low";
                      const severityLabel = days > 30 ? "Crítico" : days > 15 ? "Alto" : days > 7 ? "Médio" : "Baixo";
                      const severityColor = days > 30 ? "text-destructive" : days > 15 ? "text-warning" : days > 7 ? "text-yellow-500" : "text-muted-foreground";
                      return (
                        <tr key={client.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-3 px-4">
                            <p className="text-sm font-medium text-foreground">{client.company}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-mono text-muted-foreground">Dia {String(client.paymentDueDay).padStart(2, '0')}</span>
                          </td>
                          <td className="py-3 px-4 text-sm font-mono text-foreground text-right">{formatCurrency(client.monthlyValue)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-lg font-bold ${severityColor}`}>{days}</span>
                            <span className="text-xs text-muted-foreground ml-1">dias</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              days > 30 ? "bg-destructive/10 text-destructive" : 
                              days > 15 ? "bg-warning/10 text-warning" : 
                              "bg-muted text-muted-foreground"
                            }`}>
                              {severityLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button size="sm" variant="outline" onClick={() => handleTogglePaid(client.id)}>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar Pago
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Nenhum cliente inadimplente! 🎉</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== BARTER TAB ===== */}
        <TabsContent value="barter" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Permutas Ativas" value={barterClients.length} icon={<Handshake className="w-4 h-4" />} />
            <MetricCard label="Valor Total Permutado" value={formatCurrency(barterClients.reduce((s, c) => s + (c.barterDetails?.agreedValue || 0), 0))} />
            <MetricCard label="Clientes com Permuta" value={`${barterClients.length}/${clients.length}`} />
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Handshake className="w-4 h-4" /> Permutas Ativas
              </h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Handshake className="w-3 h-3 mr-1" /> Nova Permuta
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Permuta</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Cliente</Label>
                      <Select onValueChange={(v) => setBarterModal(v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.filter(c => !c.isBarter).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.company}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Descrição da Permuta</Label>
                      <Textarea
                        value={barterForm.description}
                        onChange={(e) => setBarterForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Sobre o que foi a permuta..."
                      />
                    </div>
                    <div>
                      <Label>Valor Acordado</Label>
                      <Input
                        type="number"
                        value={barterForm.agreedValue}
                        onChange={(e) => setBarterForm(f => ({ ...f, agreedValue: Number(e.target.value) }))}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Início</Label>
                        <DatePicker value={barterForm.startDate} onChange={(v) => setBarterForm(f => ({ ...f, startDate: v }))} placeholder="Data início" />
                      </div>
                      <div>
                        <Label>Fim</Label>
                        <DatePicker value={barterForm.endDate} onChange={(v) => setBarterForm(f => ({ ...f, endDate: v }))} placeholder="Data fim" />
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={barterForm.notes}
                        onChange={(e) => setBarterForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Observações adicionais..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => barterModal && handleSaveBarter(barterModal)}
                        disabled={!barterModal || !barterForm.description}
                      >
                        Salvar Permuta
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {barterClients.length > 0 ? (
              <div className="divide-y">
                {barterClients.map(client => {
                  const bd = client.barterDetails;
                  const endDate = bd?.endDate ? new Date(bd.endDate) : null;
                  const daysLeft = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const isExpiring = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;
                  const isExpired = daysLeft !== null && daysLeft <= 0;

                  return (
                    <div key={client.id} className={`p-4 ${isExpired ? "bg-destructive/5" : isExpiring ? "bg-warning/5" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{client.company}</p>
                            {isExpired && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Expirada</span>}
                            {isExpiring && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-medium">Expirando</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{bd?.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span>Valor: <strong className="text-foreground">{formatCurrency(bd?.agreedValue || 0)}</strong></span>
                            {bd?.startDate && <span>Início: <strong>{new Date(bd.startDate).toLocaleDateString('pt-BR')}</strong></span>}
                            {bd?.endDate && <span>Fim: <strong>{new Date(bd.endDate).toLocaleDateString('pt-BR')}</strong></span>}
                            {daysLeft !== null && daysLeft > 0 && <span>{daysLeft} dias restantes</span>}
                          </div>
                          {bd?.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{bd.notes}"</p>}
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemoveBarter(client.id)}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Handshake className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">Nenhuma permuta cadastrada.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== PAYROLL TAB ===== */}
        <TabsContent value="payroll" className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {salariesByCompany.map(comp => (
              <div key={comp.company} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{comp.company}</p>
                </div>
                <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(comp.total)}</p>
                <p className="text-[10px] text-muted-foreground">{comp.members.length} colaborador(es)</p>
              </div>
            ))}
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground mb-1">Total Geral</p>
              <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(totalSalaries)}</p>
            </div>
            <div className={`p-3 rounded-lg border ${isCritical ? "bg-destructive/10 border-destructive/30" : isWarning ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/30"}`}>
              <p className="text-xs text-muted-foreground mb-1">Folha JG vs Faturamento</p>
              <p className={`text-lg font-bold font-mono ${isCritical ? "text-destructive" : isWarning ? "text-warning" : "text-success"}`}>
                {salaryPercentage.toFixed(1)}%
              </p>
              <p className={`text-[10px] ${isHealthy ? "text-success" : isCritical ? "text-destructive" : "text-warning"}`}>
                {isCritical ? "⚠️ Acima do limite" : isWarning ? "⚡ Limite próximo" : "✅ Saudável"}
              </p>
            </div>
          </div>

          <div className="mb-4 px-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Folha JG vs Faturamento (limite saudável: 40%)</span>
              <span className={`text-xs font-bold ${isCritical ? "text-destructive" : isWarning ? "text-warning" : "text-success"}`}>
                {salaryPercentage.toFixed(1)}% / 40%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden relative">
              <div className={`h-full rounded-full transition-all ${isCritical ? "bg-destructive" : isWarning ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(salaryPercentage, 100)}%` }} />
              <div className="absolute top-0 left-[40%] w-0.5 h-full bg-foreground/30" title="Limite 40%" />
            </div>
          </div>

          {/* Grouped tables by company with progress bars */}
          {salariesByCompany.map(comp => {
            const compPct = grossRevenue > 0 ? (comp.total / grossRevenue) * 100 : 0;
            const compCritical = compPct > 40;
            const compWarning = compPct > 20 && compPct <= 40;
            return (
              <div key={comp.company} className="rounded-lg border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> {comp.company}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{comp.members.length} colaborador(es)</span>
                    <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(comp.total)}</span>
                  </div>
                </div>

                {/* Company-level progress bar */}
                <div className="px-4 py-3 border-b bg-muted/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Folha {comp.company} vs Faturamento</span>
                    <span className={`text-[10px] font-bold ${compCritical ? "text-destructive" : compWarning ? "text-warning" : "text-success"}`}>
                      {compPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${compCritical ? "bg-destructive" : compWarning ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(compPct, 100)}%` }} />
                  </div>
                </div>

                {comp.members.length > 0 ? (
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-2 px-3 font-medium">Colaborador</th>
                        <th className="text-left py-2 px-3 font-medium">Empresa</th>
                        <th className="text-left py-2 px-3 font-medium">Funções</th>
                        <th className="text-right py-2 px-3 font-medium">Salário</th>
                        <th className="text-right py-2 px-3 font-medium">% da Empresa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comp.members.map(s => (
                        <tr key={s.memberId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2 px-3 text-sm font-medium text-foreground">{s.name}</td>
                          <td className="py-2 px-3">
                            <Select value={s.company} onValueChange={(val) => updateTeamMember(s.memberId, { company: val })}>
                              <SelectTrigger className="h-7 w-28 text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {companies.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {s.roles.map(r => (
                                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{r}</span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm font-mono text-foreground text-right">{formatCurrency(s.salary)}</td>
                          <td className="py-2 px-3 text-sm font-mono text-muted-foreground text-right">
                            {comp.total > 0 ? ((s.salary / comp.total) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum colaborador nesta empresa</p>
                )}
              </div>
            );
          })}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowSalaryModal(true)}>
              Editar Salários
            </Button>
          </div>
        </TabsContent>

        {/* ===== SALARY PROJECTION TAB ===== */}
        <TabsContent value="projection" className="space-y-4">
          {(() => {
            const totalProjected = salaries.reduce((sum, s) => sum + (projectedSalaries[s.memberId] ?? s.salary), 0);
            const totalCurrent = salaries.reduce((sum, s) => sum + s.salary, 0);
            const totalIncrease = totalProjected - totalCurrent;
            const totalIncreasePct = totalCurrent > 0 ? ((totalProjected - totalCurrent) / totalCurrent) * 100 : 0;

            const projectedJG = salaries
              .filter(s => s.company === "JG")
              .reduce((sum, s) => sum + (projectedSalaries[s.memberId] ?? s.salary), 0);
            const projectedPctRevenue = grossRevenue > 0 ? (projectedJG / grossRevenue) * 100 : 0;
            const projCritical = projectedPctRevenue > 40;
            const projWarning = projectedPctRevenue > 30 && projectedPctRevenue <= 40;

            const revenueNeededProj = projectedJG > 0 ? (projectedJG / 40) * 100 : 0;
            const revenueGapProj = revenueNeededProj - grossRevenue;

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Folha Atual</p>
                    <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(totalCurrent)}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Folha Projetada</p>
                    <p className="text-lg font-bold font-mono text-primary">{formatCurrency(totalProjected)}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${totalIncrease > 0 ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/30"}`}>
                    <p className="text-xs text-muted-foreground mb-1">Aumento Total</p>
                    <p className={`text-lg font-bold font-mono ${totalIncrease > 0 ? "text-warning" : "text-success"}`}>
                      {totalIncrease > 0 ? "+" : ""}{formatCurrency(totalIncrease)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{totalIncreasePct > 0 ? "+" : ""}{totalIncreasePct.toFixed(1)}%</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${projCritical ? "bg-destructive/10 border-destructive/30" : projWarning ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/30"}`}>
                    <p className="text-xs text-muted-foreground mb-1">Folha JG Projetada vs Fat.</p>
                    <p className={`text-lg font-bold font-mono ${projCritical ? "text-destructive" : projWarning ? "text-warning" : "text-success"}`}>
                      {projectedPctRevenue.toFixed(1)}%
                    </p>
                    <p className={`text-[10px] ${projCritical ? "text-destructive" : projWarning ? "text-warning" : "text-success"}`}>
                      {projCritical ? "⚠️ Acima do limite" : projWarning ? "⚡ Limite próximo" : "✅ Saudável"}
                    </p>
                  </div>
                </div>

                {revenueGapProj > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Impacto no Faturamento</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Com a folha projetada, você precisaria faturar <strong className="text-primary font-mono">{formatCurrency(revenueNeededProj)}</strong> para manter nos 40%.
                      {revenueGapProj > 0 && (
                        <span> Gap de <strong className="text-destructive font-mono">{formatCurrency(revenueGapProj)}</strong> em relação ao faturamento atual.</span>
                      )}
                    </p>
                  </div>
                )}

                {companies.map(comp => {
                  const compMembers = salaries.filter(s => s.company === comp);
                  if (compMembers.length === 0) return null;
                  const compCurrentTotal = compMembers.reduce((sum, s) => sum + s.salary, 0);
                  const compProjectedTotal = compMembers.reduce((sum, s) => sum + (projectedSalaries[s.memberId] ?? s.salary), 0);
                  const compDiff = compProjectedTotal - compCurrentTotal;

                  return (
                    <div key={comp} className="rounded-lg border bg-card overflow-hidden">
                      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> {comp}
                        </h2>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{formatCurrency(compCurrentTotal)} → </span>
                          <span className="text-sm font-bold font-mono text-primary">{formatCurrency(compProjectedTotal)}</span>
                          {compDiff !== 0 && (
                            <span className={`text-xs font-mono ${compDiff > 0 ? "text-warning" : "text-success"}`}>
                              ({compDiff > 0 ? "+" : ""}{formatCurrency(compDiff)})
                            </span>
                          )}
                        </div>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                            <th className="text-left py-2 px-3 font-medium">Colaborador</th>
                            <th className="text-left py-2 px-3 font-medium">Funções</th>
                            <th className="text-right py-2 px-3 font-medium">Atual</th>
                            <th className="text-right py-2 px-3 font-medium w-36">Projetado</th>
                            <th className="text-right py-2 px-3 font-medium">% Aumento</th>
                            <th className="text-right py-2 px-3 font-medium">Diferença</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compMembers.map(s => {
                            const projected = projectedSalaries[s.memberId] ?? s.salary;
                            const diff = projected - s.salary;
                            const pct = s.salary > 0 ? ((projected - s.salary) / s.salary) * 100 : 0;
                            return (
                              <tr key={s.memberId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                <td className="py-2 px-3 text-sm font-medium text-foreground">{s.name}</td>
                                <td className="py-2 px-3">
                                  <div className="flex flex-wrap gap-1">
                                    {s.roles.map(r => (
                                      <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{r}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-sm font-mono text-muted-foreground text-right">{formatCurrency(s.salary)}</td>
                                <td className="py-2 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs text-muted-foreground">R$</span>
                                    <input
                                      type="number"
                                      value={projected}
                                      onChange={(e) => updateProjectedSalary(s.memberId, Number(e.target.value))}
                                      className="w-28 px-2 py-1.5 rounded-md border bg-background text-sm font-mono text-foreground text-right"
                                    />
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span className={`text-sm font-bold font-mono ${pct > 0 ? "text-primary" : pct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                    {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span className={`text-sm font-mono ${diff > 0 ? "text-warning" : diff < 0 ? "text-success" : "text-muted-foreground"}`}>
                                    {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={resetProjections}>
                    Resetar Projeção
                  </Button>
                </div>
              </>
            );
          })()}
        </TabsContent>

        {/* ===== REGULATION TAB ===== */}
        <TabsContent value="regulation" className="space-y-4">
          {(() => {
            const targetPercentage = 40;
            const revenueNeededForJG = jgOnlySalaries > 0 ? (jgOnlySalaries / targetPercentage) * 100 : 0;
            const revenueGap = revenueNeededForJG - grossRevenue;
            const avgTicket = clients.filter(c => c.status === "Operação" && c.monthlyValue > 0).length > 0
              ? mrr / clients.filter(c => c.status === "Operação" && c.monthlyValue > 0).length
              : 2000;
            const clientsNeeded = revenueGap > 0 ? Math.ceil(revenueGap / avgTicket) : 0;
            const currentOperationalClients = clients.filter(c => c.status === "Operação" && c.monthlyValue > 0).length;

            return (
              <>
                <div className="rounded-lg border bg-card p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Simulador de Regulação da Folha Salarial (JG)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Para manter a folha salarial da JG dentro do limite saudável de {targetPercentage}% do faturamento bruto.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Folha JG Atual</p>
                      <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(jgOnlySalaries)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Faturamento Atual</p>
                      <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(grossRevenue)}</p>
                    </div>
                    <div className={`p-4 rounded-lg ${isCritical ? "bg-destructive/10" : isWarning ? "bg-warning/10" : "bg-success/10"}`}>
                      <p className="text-xs text-muted-foreground mb-1">% Atual</p>
                      <p className={`text-xl font-bold font-mono ${isCritical ? "text-destructive" : isWarning ? "text-warning" : "text-success"}`}>
                        {salaryPercentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/10">
                      <p className="text-xs text-muted-foreground mb-1">Faturamento Necessário</p>
                      <p className="text-xl font-bold font-mono text-primary">{formatCurrency(revenueNeededForJG)}</p>
                    </div>
                  </div>
                </div>

                {revenueGap > 0 ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <h3 className="text-sm font-semibold text-destructive">Ação Necessária</h3>
                    </div>
                    <p className="text-sm text-foreground">
                      Você precisa aumentar o faturamento em <strong className="text-destructive font-mono">{formatCurrency(revenueGap)}</strong> para regularizar a folha nos 40%.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-card border">
                        <p className="text-xs text-muted-foreground mb-1">Gap de Faturamento</p>
                        <p className="text-2xl font-bold font-mono text-destructive">{formatCurrency(revenueGap)}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-card border">
                        <p className="text-xs text-muted-foreground mb-1">Ticket Médio Atual</p>
                        <p className="text-2xl font-bold font-mono text-foreground">{formatCurrency(avgTicket)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Base: {currentOperationalClients} clientes ativos</p>
                      </div>
                      <div className="p-4 rounded-lg bg-card border border-primary/30">
                        <p className="text-xs text-muted-foreground mb-1">Clientes Necessários</p>
                        <p className="text-2xl font-bold font-mono text-primary">{clientsNeeded}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">no ticket médio atual</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-card border p-4">
                      <h4 className="text-xs font-semibold text-foreground mb-3">Cenários de Regulação</h4>
                      <div className="space-y-2">
                        {[1500, 2000, 3000, 5000].map(ticket => {
                          const needed = Math.ceil(revenueGap / ticket);
                          return (
                            <div key={ticket} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                              <span className="text-muted-foreground">Ticket {formatCurrency(ticket)}/mês</span>
                              <span className="text-foreground font-medium">{needed} cliente(s) = {formatCurrency(needed * ticket)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-success/30 bg-success/5 p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-success mb-1">Folha Regulada! ✅</h3>
                    <p className="text-xs text-muted-foreground">
                      O faturamento atual ({formatCurrency(grossRevenue)}) mantém a folha JG dentro dos {targetPercentage}%.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Margem disponível: <strong className="text-success">{formatCurrency(Math.abs(revenueGap))}</strong>
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      <Modal open={showSalaryModal} onClose={() => setShowSalaryModal(false)} title="Editar Salários da Equipe">
        <div className="space-y-3">
          {salaries.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Adicione colaboradores na aba Administração</p>}
          {salaries.map(s => (
            <div key={s.memberId} className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.name}</p>
              </div>
              <Select value={s.company} onValueChange={(val) => updateTeamMember(s.memberId, { company: val })}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">R$</span>
                <input type="number" value={s.salary} onChange={(e) => handleUpdateSalary(s.memberId, Number(e.target.value))} className="w-28 px-2 py-1.5 rounded-md border bg-background text-sm font-mono text-foreground text-right" />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm font-medium text-foreground">Total</span>
            <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(totalSalaries)}</span>
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setShowSalaryModal(false)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Fechar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
