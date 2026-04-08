import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore, ALL_MODULES } from "@/store/useAuthStore";
import {
  LayoutDashboard, Users, Target, FileText, DollarSign, Rocket,
  Briefcase, Megaphone, Palette, Monitor, Phone, CheckCircle,
  Wrench, RefreshCw, Bot, BarChart3, Activity, TrendingUp,
  Shield, ClipboardList, ChevronDown, ChevronRight, Zap, Calendar,
  Settings, Menu, X, LogOut, Send, HelpCircle, KeyRound, Eye, EyeOff, Mail,
  Sun, Moon, Laptop
} from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import logoJG from "@/assets/logo-jg.png";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  moduleKey: string;
  badgeKey?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/", moduleKey: "dashboard" },
      { label: "Dashboard Ops", icon: Activity, path: "/dashboard-ops", moduleKey: "dashboard-ops" },
      { label: "Dashboard Financeiro", icon: TrendingUp, path: "/dashboard-financial", moduleKey: "dashboard-financial" },
      { label: "Workload", icon: Zap, path: "/dashboard-workload", moduleKey: "workload" },
      { label: "Clientes", icon: Users, path: "/clients", badgeKey: "clients", moduleKey: "clients" },
      { label: "Tarefas", icon: ClipboardList, path: "/tasks", badgeKey: "tasks", moduleKey: "tasks" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Prospecção", icon: Target, path: "/prospection", moduleKey: "prospection" },
      { label: "Propostas", icon: FileText, path: "/proposals", moduleKey: "proposals" },
      { label: "Orçamentos", icon: FileText, path: "/quote-requests", badgeKey: "quotes", moduleKey: "quote-requests" },
      { label: "Financeiro", icon: DollarSign, path: "/financial", moduleKey: "financial" },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Onboarding", icon: Rocket, path: "/onboarding", moduleKey: "onboarding" },
      { label: "Tráfego Pago", icon: Megaphone, path: "/traffic", moduleKey: "traffic" },
      { label: "Social Media", icon: Briefcase, path: "/social", moduleKey: "social" },
      { label: "Painel Social", icon: BarChart3, path: "/social-dashboard", moduleKey: "social" },
      { label: "Produção", icon: Palette, path: "/production", moduleKey: "production" },
      { label: "Tech / Sites", icon: Monitor, path: "/tech", moduleKey: "tech" },
      { label: "Inside Sales", icon: Phone, path: "/inside-sales", moduleKey: "inside-sales" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Aprovações", icon: CheckCircle, path: "/approvals", badgeKey: "approvals", moduleKey: "approvals" },
      { label: "Requisições", icon: Send, path: "/requests", badgeKey: "requests", moduleKey: "requests" },
      { label: "Demandas Avulsas", icon: Wrench, path: "/ad-hoc", moduleKey: "ad-hoc" },
      { label: "Recorrências", icon: RefreshCw, path: "/recurrences", moduleKey: "recurrences" },
      { label: "IA Campanhas", icon: Bot, path: "/ai-alerts", moduleKey: "ai-alerts" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Usuários", icon: Shield, path: "/admin", moduleKey: "admin" },
      { label: "Auditoria", icon: ClipboardList, path: "/audit", moduleKey: "audit" },
      { label: "Configurações", icon: Settings, path: "/settings", moduleKey: "settings" },
      { label: "Central de Ajuda", icon: HelpCircle, path: "/help", moduleKey: "dashboard" },
    ],
  },
];

function userHasModule(moduleKey: string, moduleAccess?: string[], isAdmin?: boolean): boolean {
  if (isAdmin) return true;
  if (!moduleAccess) return ["dashboard", "clients", "tasks", "requests", "ad-hoc", "recurrences"].includes(moduleKey);
  return moduleAccess.includes(moduleKey);
}

export default function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const tasks = useAppStore((s) => s.tasks);
  const clients = useAppStore((s) => s.clients);
  const quoteRequests = useAppStore((s) => s.quoteRequests);
  const requests = useAppStore((s) => s.requests);
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(currentUser?.recoveryEmail || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleChangePassword = async () => {
    if (!pwForm.newPw || pwForm.newPw.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast.error("As senhas não coincidem"); return; }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
      if (error) { toast.error("Erro ao alterar senha: " + error.message); return; }
      toast.success("Senha alterada com sucesso!");
      setShowPasswordModal(false);
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const myPendingRequests = requests.filter(
    (r) => r.assignedToName === currentUser?.name && r.status === "pending"
  ).length;

  const isAdminOrGerente = currentUser?.isAdmin || currentUser?.roles?.some(r => r.includes("Gerente Operacional"));
  // Count clients without team (excluding auto-assigned gerente operacional)
  const clientsWithoutTeam = isAdminOrGerente
    ? clients.filter(c => c.status === "Operação" && (!c.assignedTeam || c.assignedTeam.filter(a => a.role !== "Gerente Operacional").length === 0)).length
    : 0;

  const notificationCounts: Record<string, number> = {
    tasks: tasks.filter((t) => t.status === "overdue").length,
    approvals: tasks.filter((t) => t.status === "approval").length,
    quotes: quoteRequests.filter((q) => q.status === "pending").length,
    requests: myPendingRequests,
    clients: clientsWithoutTeam,
  };

  const toggleSection = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const getBadgeCount = (badgeKey?: string): number => {
    if (!badgeKey) return 0;
    return notificationCounts[badgeKey] || 0;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
        <img src={logoJG} alt="JG" className="w-8 h-8 object-contain" />
        <div>
          <h1 className="text-sm font-bold text-primary">JG Gestão Interna</h1>
          <p className="text-[9px] text-muted-foreground tracking-wider">Gestão & Tráfego Pago</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(item =>
            userHasModule(item.moduleKey, currentUser?.moduleAccess, currentUser?.isAdmin)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <button
                onClick={() => toggleSection(section.label)}
                className="section-header w-full flex items-center justify-between hover:text-foreground transition-colors"
              >
                {section.label}
                {collapsed[section.label] ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              {!collapsed[section.label] && (
                <div className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const badge = getBadgeCount(item.badgeKey);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`nav-item ${isActive ? "nav-item-active" : ""} relative`}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold animate-pulse">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-2">
        <div className="flex items-center justify-center gap-1 p-0.5 rounded-lg bg-muted/50">
          {([
            { value: "light" as Theme, icon: Sun, label: "Claro" },
            { value: "dark" as Theme, icon: Moon, label: "Escuro" },
            { value: "system" as Theme, icon: Laptop, label: "Sistema" },
          ]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors flex-1 justify-center ${
                theme === opt.value
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={opt.label}
            >
              <opt.icon className="w-3 h-3" />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
            {currentUser?.name.slice(0, 2).toUpperCase() || "AD"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{currentUser?.name || "Admin"}</p>
            <p className="text-[10px] text-muted-foreground">{currentUser?.role || "Diretoria"}</p>
          </div>
          <button onClick={() => setShowPasswordModal(true)} className="p-1 rounded hover:bg-muted transition-colors" title="Alterar senha">
            <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={logout} className="p-1 rounded hover:bg-muted transition-colors" title="Sair">
            <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <Modal open={showPasswordModal} onClose={() => { setShowPasswordModal(false); setPwForm({ current: "", newPw: "", confirm: "" }); }} title="Minha Conta">
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email de recuperação</h3>
            <p className="text-[10px] text-muted-foreground -mt-1">Usado para redefinir sua senha caso esqueça</p>
            <div className="flex gap-2">
              <input type="email" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="seu@email.com" className="flex-1 px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" disabled={savingEmail} />
              <button
                onClick={async () => {
                  if (!currentUser) return;
                  setSavingEmail(true);
                  try {
                    updateUser(currentUser.id, { recoveryEmail });
                    toast.success("Email de recuperação salvo!");
                  } catch { toast.error("Erro ao salvar"); }
                  finally { setSavingEmail(false); }
                }}
                disabled={savingEmail}
                className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingEmail ? "..." : "Salvar"}
              </button>
            </div>
          </div>
          <hr className="border-border" />
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Alterar senha</h3>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Nova senha</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} value={pwForm.newPw} onChange={(e) => setPwForm(f => ({ ...f, newPw: e.target.value }))} placeholder="Mínimo 6 caracteres" className="w-full px-3 py-2 pr-9 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" disabled={pwLoading} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Confirmar nova senha</label>
            <input type={showPw ? "text" : "password"} value={pwForm.confirm} onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repita a nova senha" className="w-full px-3 py-2 rounded-md border bg-background text-sm text-foreground placeholder:text-muted-foreground" disabled={pwLoading} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setShowPasswordModal(false); setPwForm({ current: "", newPw: "", confirm: "" }); }} className="px-4 py-2 rounded-md border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
            <button onClick={handleChangePassword} disabled={pwLoading} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">{pwLoading ? "Salvando..." : "Alterar Senha"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 p-2 rounded-md bg-card border lg:hidden"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-60 bg-sidebar border-r border-sidebar-border transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}