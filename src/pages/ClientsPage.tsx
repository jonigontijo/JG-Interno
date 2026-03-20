import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";
import { formatCurrency } from "@/data/mockData";
import { Search, Filter, Plus, AlertCircle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Users, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Client } from "@/data/mockData";

const getDemandStatus = (client: Client, tasks: any[]) => {
  const team = client.assignedTeam || [];
  const nonGerente = team.filter(a => !a.role.includes("Gerente Operacional"));
  if (nonGerente.length === 0) return { label: "Sem equipe", color: "text-muted-foreground", bg: "bg-muted" };
  const today = new Date().toISOString().slice(0, 10);
  const hasToday = tasks.some(t => t.clientId === client.id && t.type === "recurring" && t.createdAt === today);
  if (hasToday) return { label: "Espalhadas", color: "text-success", bg: "bg-success/10" };
  return { label: "Pendente", color: "text-warning", bg: "bg-warning/10" };
};

type SortField = "company" | "services" | "dueDay" | "monthlyValue" | null;
type SortOrder = "asc" | "desc";

const serviceOptions = ["Tráfego", "Social Media", "Sites", "Branding", "Consultoria"];

export default function ClientsPage() {
  const { clients, tasks, addClient } = useAppStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterSM, setFilterSM] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    company: "",
    name: "",
    services: [] as string[],
    monthlyValue: "",
    paymentDueDay: "",
    socialMediaPosts: "0",
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const resetForm = () => {
    setForm({ company: "", name: "", services: [], monthlyValue: "", paymentDueDay: "", socialMediaPosts: "0" });
  };

  const toggleService = (s: string) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(s) ? f.services.filter(x => x !== s) : [...f.services, s],
    }));
  };

  const handleSaveClient = () => {
    if (!form.company.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    const newClient: Client = {
      id: `c-${Date.now()}`,
      company: form.company.trim(),
      name: form.name.trim(),
      services: form.services,
      monthlyValue: parseFloat(form.monthlyValue) || 0,
      setupValue: 0,
      accountManager: "",
      paymentDueDay: parseInt(form.paymentDueDay) || undefined,
      status: "Operação",
      substatus: "Ativo",
      riskLevel: "low",
      pendingTasks: 0,
      overdueTasks: 0,
      socialMediaPosts: parseInt(form.socialMediaPosts) || 0,
      postsReadyNextWeek: 0,
    };
    addClient(newClient);
    toast.success(`Cliente "${form.company}" adicionado! Pipeline de onboarding iniciado — primeira tarefa criada para o Financeiro.`);
    setShowModal(false);
    resetForm();
  };

  const filtered = useMemo(() => {
    let result = clients.filter(c => {
      const matchSearch = c.company.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filterSM ? ((c.socialMediaPosts ?? 0) > 0) : true;
      return matchSearch && matchFilter;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        switch (sortField) {
          case "company": comparison = a.company.localeCompare(b.company); break;
          case "services": comparison = (a.services[0] || "").localeCompare(b.services[0] || ""); break;
          case "dueDay": comparison = (a.paymentDueDay ?? 999) - (b.paymentDueDay ?? 999); break;
          case "monthlyValue": comparison = a.monthlyValue - b.monthlyValue; break;
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [clients, search, filterSM, sortField, sortOrder]);

  const riskColor = (risk: string) => {
    switch (risk) {
      case "critical": return "text-destructive";
      case "high": return "text-warning";
      case "medium": return "text-info";
      default: return "text-success";
    }
  };

  const getPostStatus = (client: typeof clients[0]) => {
    if (!client.socialMediaPosts) return null;
    const required = client.socialMediaPosts;
    const ready = (client.postsReadyNextWeek ?? 0);
    const pct = Math.min((ready / required) * 100, 100);
    const ok = ready >= required;
    return { required, ready, pct, ok };
  };

  const hasFinancialAccess = currentUser?.isAdmin || currentUser?.roles?.includes("Financeiro");
  const isAdminOrGerente = currentUser?.isAdmin || currentUser?.roles?.some(r => r.includes("Gerente Operacional"));
  const clientsWithoutTeam = clients.filter(c => c.status === "Operação" && (!c.assignedTeam || c.assignedTeam.filter(a => a.role !== "Gerente Operacional").length === 0));

  return (
    <div>
      <PageHeader title="Clientes" description={`${clients.length} clientes cadastrados`}>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </PageHeader>

      {/* Alert: clients without assigned team */}
      {isAdminOrGerente && clientsWithoutTeam.length > 0 && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {clientsWithoutTeam.length} cliente(s) sem equipe designada
              </p>
              <p className="text-xs text-muted-foreground">
                Clique em cada cliente abaixo e vá na aba "Equipe" para designar os colaboradores responsáveis.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {clientsWithoutTeam.slice(0, 15).map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors font-medium"
              >
                {c.company}
              </button>
            ))}
            {clientsWithoutTeam.length > 15 && (
              <span className="text-[10px] px-2.5 py-1 text-muted-foreground">+{clientsWithoutTeam.length - 15} mais</span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-muted rounded-md px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1" />
        </div>
        <button onClick={() => setFilterSM(!filterSM)} className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${filterSM ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground hover:text-foreground"}`}>
          <Filter className="w-4 h-4" /> {filterSM ? "Social Media" : "Filtros"}
        </button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                <th className="text-left py-3 px-4 font-medium">
                  <button onClick={() => handleSort("company")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Empresa
                    {sortField === "company" ? (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium">
                  <button onClick={() => handleSort("services")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Serviços
                    {sortField === "services" ? (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium">
                  <button onClick={() => handleSort("dueDay")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Vencimento
                    {sortField === "dueDay" ? (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </button>
                </th>
                {hasFinancialAccess && (
                  <th className="text-left py-3 px-4 font-medium">
                    <button onClick={() => handleSort("monthlyValue")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Mensalidade
                      {sortField === "monthlyValue" ? (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </button>
                  </th>
                )}
                <th className="text-left py-3 px-4 font-medium">Social Media</th>
                {isAdminOrGerente && <th className="text-left py-3 px-4 font-medium">Demandas</th>}
                <th className="text-left py-3 px-4 font-medium">Risco</th>
                <th className="text-right py-3 px-4 font-medium">Tarefas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => {
                const smStatus = getPostStatus(client);
                return (
                  <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-foreground">{client.company}</p>
                      {client.name && <p className="text-xs text-muted-foreground">{client.name}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {client.services.length > 0 ? client.services.map(s => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>
                        )) : (
                          <span className="text-[10px] text-muted-foreground italic">Sem serviços</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {client.paymentDueDay ? (
                        <span className="text-xs font-mono text-muted-foreground">Dia {String(client.paymentDueDay).padStart(2, '0')}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {hasFinancialAccess && (
                      <td className="py-3 px-4 text-sm font-mono text-foreground">{formatCurrency(client.monthlyValue)}</td>
                    )}
                    <td className="py-3 px-4">
                      {smStatus ? (
                        <div className="min-w-[120px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            {smStatus.ok ? <CheckCircle2 className="w-3 h-3 text-success" /> : <AlertCircle className="w-3 h-3 text-warning" />}
                            <span className={`text-[10px] font-medium ${smStatus.ok ? "text-success" : "text-warning"}`}>
                              {smStatus.ready}/{smStatus.required} posts
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${smStatus.ok ? "bg-success" : smStatus.pct > 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${smStatus.pct}%` }} />
                          </div>
                          <span className="text-[9px] text-muted-foreground">{client.socialMediaPosts} posts/semana</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    {isAdminOrGerente && (() => {
                      const ds = getDemandStatus(client, tasks);
                      return (
                        <td className="py-3 px-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ds.bg} ${ds.color}`}>
                            {ds.label === "Espalhadas" && <Zap className="w-3 h-3 inline mr-0.5" />}
                            {ds.label}
                          </span>
                        </td>
                      );
                    })()}
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium capitalize ${riskColor(client.riskLevel)}`}>
                        ● {client.riskLevel === "low" ? "Baixo" : client.riskLevel === "medium" ? "Médio" : client.riskLevel === "high" ? "Alto" : "Crítico"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-mono text-foreground">{client.pendingTasks}</span>
                      {client.overdueTasks > 0 && (
                        <span className="text-xs text-destructive ml-1">({client.overdueTasks} atrasadas)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Cliente */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Cliente">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Empresa *</label>
            <input
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
              placeholder="Nome da empresa"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Contato</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
              placeholder="Nome do contato"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Serviços</label>
            <div className="flex flex-wrap gap-1.5">
              {serviceOptions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    form.services.includes(s)
                      ? "bg-primary/15 text-primary border-primary/30 font-medium"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
                  }`}
                >
                  {form.services.includes(s) ? "✓ " : ""}{s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Mensalidade (R$)</label>
              <input
                type="number"
                value={form.monthlyValue}
                onChange={e => setForm(f => ({ ...f, monthlyValue: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Dia Vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={form.paymentDueDay}
                onChange={e => setForm(f => ({ ...f, paymentDueDay: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
                placeholder="10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Posts/semana</label>
              <input
                type="number"
                min="0"
                value={form.socialMediaPosts}
                onChange={e => setForm(f => ({ ...f, socialMediaPosts: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground"
                placeholder="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleSaveClient} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}