import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import { useAuthStore, AppUser, ALL_MODULES } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";
import { formatCurrency } from "@/data/mockData";
import { toast } from "sonner";
import { Shield, Users, Plus, Trash2, Eye, EyeOff, Edit2, Calendar, ChevronDown, ChevronUp, Lock, UserPlus, Check, X, Clock } from "lucide-react";

const roleOptions = [
  "Diretoria",
  "Gerente Operacional",
  "Comercial",
  "Gestor de Tráfego",
  "Social Media - Coordenação",
  "Social Media - Designer",
  "Social Media - Videomaker",
  "Social Media - Editor",
  "Sites",
  "Tecnologia",
  "Inside Sales",
  "Financeiro",
  "Organização",
];

const roleColors: Record<string, string> = {
  "Diretoria": "bg-primary/15 text-primary",
  "Gerente Operacional": "bg-primary/15 text-primary",
  "Comercial": "bg-info/15 text-info",
  "Gestor de Tráfego": "bg-warning/15 text-warning",
  "Social Media - Coordenação": "bg-success/15 text-success",
  "Social Media - Designer": "bg-success/15 text-success",
  "Social Media - Videomaker": "bg-success/15 text-success",
  "Social Media - Editor": "bg-success/15 text-success",
  "Sites": "bg-info/15 text-info",
  "Tecnologia": "bg-destructive/15 text-destructive",
  "Inside Sales": "bg-warning/15 text-warning",
  "Financeiro": "bg-primary/15 text-primary",
  "Organização": "bg-accent/15 text-accent-foreground",
};

const moduleGroups = [
  {
    label: "Principal",
    modules: ["dashboard", "dashboard-ops", "dashboard-financial", "workload", "clients", "tasks"],
  },
  {
    label: "Comercial",
    modules: ["prospection", "proposals", "quote-requests", "financial"],
  },
  {
    label: "Operação",
    modules: ["onboarding", "traffic", "social", "production", "tech", "inside-sales"],
  },
  {
    label: "Gestão",
    modules: ["approvals", "requests", "ad-hoc", "recurrences", "ai-alerts"],
  },
  {
    label: "Sistema",
    modules: ["admin", "audit", "settings"],
  },
];

function getModuleLabel(key: string): string {
  return ALL_MODULES.find(m => m.key === key)?.label || key;
}

function getTenure(hireDate?: string): string {
  if (!hireDate) return "—";
  const hire = new Date(hireDate);
  const now = new Date();
  const diffMs = now.getTime() - hire.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return "Início em breve";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}a ${months}m`;
  if (months > 0) return `${months} meses`;
  return `${days} dias`;
}

export default function AdminPage() {
  const { users, addUser, updateUser, removeUser, currentUser, registrationRequests, loadRegistrationRequests, approveRegistration, rejectRegistration } = useAuthStore();
  const { team, updateTeamMember } = useAppStore();

  useEffect(() => {
    loadRegistrationRequests();
  }, [loadRegistrationRequests]);

  const pendingRequests = registrationRequests.filter(r => r.status === 'pending');
  const recentReviewed = registrationRequests.filter(r => r.status !== 'pending').slice(0, 5);

  const handleApprove = async (id: string) => {
    const req = registrationRequests.find(r => r.id === id);
    if (!req) return;
    if (!window.confirm(`Aprovar o acesso de "${req.name}" (${req.username})?`)) return;
    const ok = await approveRegistration(id);
    if (!ok) return;
    toast.success(`Acesso aprovado para ${req.name}!`);
  };

  const handleReject = async (id: string) => {
    const req = registrationRequests.find(r => r.id === id);
    if (!req) return;
    if (!window.confirm(`Rejeitar a solicitação de "${req.name}"?`)) return;
    await rejectRegistration(id);
    toast.info(`Solicitação de ${req.name} rejeitada`);
  };
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<"roles" | "modules">("modules");
  const [form, setForm] = useState({
    name: "", username: "", password: "", roles: [] as string[], isAdmin: false, hireDate: "", moduleAccess: [] as string[], recoveryEmail: "",
  });
  const [isNewUser, setIsNewUser] = useState(false);

  const isAdminOrFinanceiro = currentUser?.isAdmin || currentUser?.roles?.includes("Financeiro");

  const handleOpenNew = () => {
    setEditingUser(null);
    setIsNewUser(true);
    setForm({ name: "", username: "", password: "", roles: [], isAdmin: false, hireDate: "", moduleAccess: ["dashboard", "clients", "tasks", "requests", "ad-hoc"], recoveryEmail: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setIsNewUser(false);
    setForm({
      name: user.name, username: user.username, password: "",
      roles: user.roles || [user.role],
      isAdmin: user.isAdmin, hireDate: user.hireDate || "",
      moduleAccess: user.moduleAccess || ["dashboard", "clients", "tasks", "requests", "ad-hoc"],
      recoveryEmail: user.recoveryEmail || "",
    });
    setShowModal(true);
  };

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  };

  const toggleFormModule = (key: string) => {
    setForm(f => ({
      ...f,
      moduleAccess: f.moduleAccess.includes(key) ? f.moduleAccess.filter(m => m !== key) : [...f.moduleAccess, key],
    }));
  };

  // Quick inline module toggle
  const quickToggleModule = (userId: string, moduleKey: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const current = user.moduleAccess || ["dashboard", "clients", "tasks", "requests", "ad-hoc"];
    const isRemoving = current.includes(moduleKey);
    const newAccess = isRemoving
      ? current.filter(m => m !== moduleKey)
      : [...current, moduleKey];
    updateUser(userId, { moduleAccess: newAccess });
    const label = getModuleLabel(moduleKey);
    toast.success(isRemoving ? `"${label}" removido de ${user.name}` : `"${label}" liberado para ${user.name}`);
  };

  // Quick inline role toggle
  const quickToggleRole = (userId: string, role: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const currentRoles = user.roles || [user.role];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    const displayRole = newRoles.join(", ");
    updateUser(userId, { roles: newRoles, role: displayRole });
    const teamMember = team.find(m => m.id === userId || m.name === user.name);
    if (teamMember) {
      updateTeamMember(teamMember.id, { roles: newRoles, role: displayRole, specialty: newRoles });
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.username) {
      toast.error("Preencha nome e usuário");
      return;
    }
    if (isNewUser && !form.password) {
      toast.error("Defina uma senha para o novo colaborador");
      return;
    }
    const displayRole = form.roles.join(", ");
    const moduleAccess = form.isAdmin ? ALL_MODULES.map(m => m.key) : form.moduleAccess;
    if (editingUser) {
      updateUser(editingUser.id, {
        name: form.name, username: form.username,
        ...(form.password ? { password: form.password } : {}),
        role: displayRole, roles: form.roles, isAdmin: form.isAdmin, hireDate: form.hireDate,
        moduleAccess, recoveryEmail: form.recoveryEmail,
      });
      const teamMember = team.find(m => m.name === editingUser.name || m.id === editingUser.id);
      if (teamMember) {
        updateTeamMember(teamMember.id, { name: form.name, role: displayRole, roles: form.roles, specialty: form.roles });
      }
      toast.success("Colaborador atualizado!");
    } else {
      const id = `u-${Date.now()}`;
      await addUser({
        id, username: form.username, password: form.password,
        name: form.name, role: displayRole, roles: form.roles,
        isAdmin: form.isAdmin, active: true, hireDate: form.hireDate,
        moduleAccess, recoveryEmail: form.recoveryEmail,
      });
    }
    setShowModal(false);
  };

  const handleRemove = (user: AppUser) => {
    if (user.id === "admin") {
      toast.error("Não é possível remover o administrador principal");
      return;
    }
    removeUser(user.id);
    toast.success("Colaborador removido!");
  };

  const roleCounts: Record<string, number> = {};
  users.forEach(u => {
    const userRoles = u.roles || [u.role];
    userRoles.forEach(r => { if (r) roleCounts[r] = (roleCounts[r] || 0) + 1; });
  });

  return (
    <div>
      <PageHeader title="Administração" description="Gestão de colaboradores, funções e permissões de acesso">
        <button onClick={handleOpenNew} className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Colaborador
        </button>
      </PageHeader>

      {/* Pending Registration Requests */}
      {pendingRequests.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-warning/20 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Solicitações de acesso pendentes ({pendingRequests.length})</h2>
          </div>
          <div className="divide-y divide-border/50">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center text-[10px] font-bold text-warning shrink-0">
                  {req.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{req.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">@{req.username}</span>
                  </div>
                  {req.desired_roles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {req.desired_roles.map(r => (
                        <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded-full ${roleColors[r] || "bg-muted text-muted-foreground"}`}>{r}</span>
                      ))}
                    </div>
                  )}
                  {req.message && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{req.message}"</p>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(req.created_at).toLocaleDateString("pt-BR")} às {new Date(req.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-success/15 text-success hover:bg-success/25 transition-colors text-xs font-medium"
                  >
                    <Check className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors text-xs font-medium"
                  >
                    <X className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently reviewed requests */}
      {recentReviewed.length > 0 && pendingRequests.length === 0 && (
        <div className="rounded-lg border bg-card mb-6 overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-medium text-muted-foreground">Últimas solicitações analisadas</h3>
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {recentReviewed.map(req => (
              <span
                key={req.id}
                className={`text-[10px] px-2.5 py-1 rounded-full ${
                  req.status === 'approved'
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {req.status === 'approved' ? '✓' : '✕'} {req.name} ({req.username})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Colaboradores ({users.length})</h2>
            <div className="flex items-center gap-2">
              {currentUser?.isAdmin && (
                <button onClick={() => setShowPasswords(!showPasswords)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPasswords ? "Ocultar" : "Senhas"}
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {users.map(user => {
              const userRoles = (user.roles && user.roles.length > 0) ? user.roles : (user.role ? [user.role] : []);
              const userModules = user.moduleAccess || ["dashboard", "clients", "tasks", "requests", "ad-hoc"];
              const isExpanded = expandedUser === user.id;
              const member = team.find(m => m.id === user.id || m.name === user.name);
              return (
                <div key={user.id} className="hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{user.name}</span>
                        {user.isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">Admin</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {userRoles.length > 0 && userRoles[0] !== "" ? (
                          <div className="flex flex-wrap gap-1">
                            {userRoles.map(r => (
                              <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded-full ${roleColors[r] || "bg-muted text-muted-foreground"}`}>{r}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-warning italic">⚠ Sem função definida</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground">
                          {user.isAdmin ? "Acesso total" : `${userModules.length} módulos`}
                        </span>
                      </div>
                    </div>
                    {isAdminOrFinanceiro && user.hireDate && (
                      <div className="text-right shrink-0 hidden md:block">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(user.hireDate).toLocaleDateString("pt-BR")}</p>
                        <p className="text-[10px] font-medium text-foreground">{getTenure(user.hireDate)}</p>
                      </div>
                    )}
                    {isAdminOrFinanceiro && member && (
                      <div className="text-right shrink-0 hidden md:block">
                        <p className="text-[10px] text-muted-foreground">Custo total</p>
                        <p className="text-xs font-mono font-medium text-foreground">{formatCurrency(member.salary || 0)}</p>
                      </div>
                    )}
                    {showPasswords && (
                      <div className="text-right shrink-0 hidden md:block">
                        <p className="text-[10px] text-muted-foreground">Login: {user.username}</p>
                        <p className="text-[10px] font-mono text-muted-foreground italic">Senha no Supabase Auth</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setExpandedUser(isExpanded ? null : user.id); setExpandedTab("modules"); }} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Gerenciar acessos">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleOpenEdit(user)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {user.id !== "admin" && (
                        <button onClick={() => handleRemove(user)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Expanded panel with tabs */}
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setExpandedTab("modules")}
                          className={`text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors ${
                            expandedTab === "modules" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Lock className="w-3 h-3 inline mr-1" />
                          Acessos ({user.isAdmin ? "Todos" : userModules.length})
                        </button>
                        <button
                          onClick={() => setExpandedTab("roles")}
                          className={`text-[11px] px-3 py-1.5 rounded-md font-medium transition-colors ${
                            expandedTab === "roles" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Shield className="w-3 h-3 inline mr-1" />
                          Funções ({userRoles.filter(r => r).length})
                        </button>
                      </div>

                      {expandedTab === "modules" && (
                        <div className="space-y-3">
                          {user.isAdmin ? (
                            <p className="text-[11px] text-primary font-medium">✓ Administrador — acesso total a todos os módulos</p>
                          ) : (
                            <>
                              <p className="text-[10px] text-muted-foreground">Clique para liberar/retirar acesso aos módulos da barra lateral:</p>
                              {moduleGroups.map(group => (
                                <div key={group.label}>
                                  <p className="text-[10px] font-semibold text-foreground mb-1.5">{group.label}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {group.modules.map(modKey => {
                                      const active = userModules.includes(modKey);
                                      return (
                                        <button
                                          key={modKey}
                                          onClick={() => quickToggleModule(user.id, modKey)}
                                          className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                                            active
                                              ? "bg-primary/15 text-primary border-primary/30 font-medium"
                                              : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                                          }`}
                                        >
                                          {active ? "✓ " : ""}{getModuleLabel(modKey)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {expandedTab === "roles" && (
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-2">Clique para ativar/desativar funções:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {roleOptions.map(role => {
                              const active = userRoles.includes(role);
                              return (
                                <button
                                  key={role}
                                  onClick={() => quickToggleRole(user.id, role)}
                                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                                    active
                                      ? `${roleColors[role] || "bg-primary/15 text-primary"} border-transparent font-medium`
                                      : "bg-transparent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                                  }`}
                                >
                                  {active ? "✓ " : ""}{role}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {isAdminOrFinanceiro && member?.salaryBreakdown && (
                        <div className="mt-3 p-2.5 rounded-md bg-muted/30 grid grid-cols-4 md:grid-cols-8 gap-2 text-[10px]">
                          <div><span className="text-muted-foreground block">Base</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.base)}</span></div>
                          <div><span className="text-muted-foreground block">Bonificação</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.bonus)}</span></div>
                          <div><span className="text-muted-foreground block">VT</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.vt)}</span></div>
                          {member.salaryBreakdown.comTrafego > 0 && <div><span className="text-muted-foreground block">Com. Tráfego</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.comTrafego)}</span></div>}
                          {member.salaryBreakdown.comGoogle > 0 && <div><span className="text-muted-foreground block">Com. Google</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.comGoogle)}</span></div>}
                          {member.salaryBreakdown.comSite > 0 && <div><span className="text-muted-foreground block">Com. Site</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.comSite)}</span></div>}
                          {member.salaryBreakdown.comIdVis > 0 && <div><span className="text-muted-foreground block">Com. ID Vis</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.comIdVis)}</span></div>}
                          {member.salaryBreakdown.mensIA > 0 && <div><span className="text-muted-foreground block">Mens. IA</span><span className="font-mono text-foreground">{formatCurrency(member.salaryBreakdown.mensIA)}</span></div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Funções Disponíveis</h3>
            <div className="space-y-1">
              {roleOptions.map(role => {
                const count = roleCounts[role] || 0;
                return (
                  <div key={role} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30 text-sm text-muted-foreground transition-colors">
                    <span>{role}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {isAdminOrFinanceiro && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Resumo Folha</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total colaboradores</span>
                  <span className="font-medium text-foreground">{team.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo total</span>
                  <span className="font-mono font-medium text-foreground">{formatCurrency(team.reduce((s, m) => s + (m.salary || 0), 0))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sem função</span>
                  <span className={`font-medium ${users.filter(u => !u.roles || u.roles.length === 0 || (u.roles.length === 1 && u.roles[0] === "")).length > 0 ? "text-warning" : "text-success"}`}>
                    {users.filter(u => !u.roles || u.roles.length === 0 || (u.roles.length === 1 && u.roles[0] === "")).length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingUser ? "Editar Colaborador" : "Novo Colaborador"}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Nome completo *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: João Silva" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Data de entrada</label>
            <input type="date" value={form.hireDate} onChange={(e) => setForm(f => ({ ...f, hireDate: e.target.value }))} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Funções</label>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-md border bg-muted/20 max-h-36 overflow-y-auto">
              {roleOptions.map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer text-sm text-foreground hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                  <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} className="rounded border-muted-foreground" />
                  <span className="text-xs">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              <Lock className="w-3 h-3 inline mr-1" />
              Acesso aos Módulos
            </label>
            {form.isAdmin ? (
              <p className="text-[11px] text-primary p-3 rounded-md border bg-primary/5">✓ Admin tem acesso a todos os módulos automaticamente</p>
            ) : (
              <div className="p-3 rounded-md border bg-muted/20 space-y-3 max-h-48 overflow-y-auto">
                {moduleGroups.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold text-foreground mb-1">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.modules.map(modKey => {
                        const active = form.moduleAccess.includes(modKey);
                        return (
                          <button
                            key={modKey}
                            type="button"
                            onClick={() => toggleFormModule(modKey)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                              active
                                ? "bg-primary/15 text-primary border-primary/30 font-medium"
                                : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
                            }`}
                          >
                            {active ? "✓ " : ""}{getModuleLabel(modKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Usuário (login) *</label>
              <input type="text" value={form.username} onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Ex: joaosilva" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">{editingUser ? "Nova senha (deixe vazio para manter)" : "Senha *"}</label>
              <input type="text" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? "Manter atual" : "Senha do colaborador"} className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Email de recuperação de senha</label>
            <input type="email" value={form.recoveryEmail} onChange={(e) => setForm(f => ({ ...f, recoveryEmail: e.target.value }))} placeholder="email@exemplo.com" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground mt-1">Usado para o "Esqueci minha senha" na tela de login</p>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
            <input type="checkbox" id="admin-check" checked={form.isAdmin} onChange={(e) => setForm(f => ({ ...f, isAdmin: e.target.checked }))} className="rounded" />
            <label htmlFor="admin-check" className="text-xs text-foreground cursor-pointer">Acesso de Administrador (todos os módulos)</label>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              {editingUser ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}