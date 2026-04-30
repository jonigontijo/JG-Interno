import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { LogIn, Loader2, Eye, EyeOff, ArrowLeft, UserPlus, CheckCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import logoJG from "@/assets/logo-jg.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const roleOptions = [
  "Gestor de Tráfego",
  "Social Media - Coordenação",
  "Social Media - Designer",
  "Social Media - Videomaker",
  "Social Media - Editor",
  "Comercial",
  "Inside Sales",
  "Financeiro",
  "Sites",
  "Tecnologia",
  "Organização",
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"login" | "reset" | "register" | "register-success">("login");
  const login = useAuthStore((s) => s.login);
  const submitRegistration = useAuthStore((s) => s.submitRegistration);

  const [regForm, setRegForm] = useState({
    name: "", username: "", password: "", confirmPassword: "",
    desiredRoles: [] as string[], message: "",
  });
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetNoEmail, setResetNoEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Preencha usuário e senha");
      return;
    }
    setLoading(true);
    try {
      const ok = await login(username, password);
      if (!ok) {
        toast.error("Usuário ou senha inválidos");
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.username || !regForm.password) {
      toast.error("Preencha nome, usuário e senha");
      return;
    }
    if (regForm.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setRegLoading(true);
    try {
      const ok = await submitRegistration({
        name: regForm.name,
        username: regForm.username,
        password: regForm.password,
        desiredRoles: regForm.desiredRoles,
        message: regForm.message,
      });
      if (ok) {
        setView("register-success");
      } else {
        toast.error("Erro ao enviar solicitação. Tente novamente.");
      }
    } catch {
      toast.error("Erro ao enviar solicitação.");
    } finally {
      setRegLoading(false);
    }
  };

  const toggleRegRole = (role: string) => {
    // #region agent log
    // eslint-disable-next-line no-console
    console.log('[DBG H1] LoginPage.toggleRegRole click', { role, currentDesiredRoles: regForm.desiredRoles });
    try {
      fetch('http://127.0.0.1:7766/ingest/0c49ec12-84fe-49c1-b002-28f07f1904a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ca3c2f' },
        body: JSON.stringify({ sessionId: 'ca3c2f', location: 'LoginPage.tsx:toggleRegRole', message: 'role click', data: { role, currentDesiredRoles: regForm.desiredRoles }, hypothesisId: 'H1', timestamp: Date.now() }),
      }).catch(() => {});
    } catch {}
    // #endregion
    setRegForm(f => ({
      ...f,
      desiredRoles: f.desiredRoles.includes(role)
        ? f.desiredRoles.filter(r => r !== role)
        : [...f.desiredRoles, role],
    }));
  };

  const Header = () => (
    <div className="flex flex-col items-center justify-center gap-3 mb-8">
      <img src={logoJG} alt="JG Gestão Interna" className="w-16 h-16 object-contain" />
      <div className="text-center">
        <h1 className="text-lg font-bold text-primary">JG Gestão Interna</h1>
        <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Joni Gontijo • Gestão & Tráfego Pago</p>
      </div>
    </div>
  );

  if (view === "register-success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Header />
          <div className="rounded-lg border border-success/30 bg-card p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <h2 className="text-sm font-semibold text-foreground text-center">Solicitação enviada!</h2>
              <p className="text-xs text-muted-foreground text-center">
                Sua solicitação de acesso foi enviada para o administrador. Você receberá acesso assim que for aprovada.
              </p>
              <p className="text-[10px] text-muted-foreground text-center">
                Usuário solicitado: <span className="font-mono font-medium text-foreground">{regForm.username}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setView("login"); setRegForm({ name: "", username: "", password: "", confirmPassword: "", desiredRoles: [], message: "" }); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-primary/30 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "register") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Header />
          <form onSubmit={handleRegister} className="rounded-lg border border-primary/20 bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground text-center mb-2">Solicitar acesso</h2>
            <p className="text-[10px] text-muted-foreground text-center -mt-2">
              Preencha os dados abaixo. Um administrador irá analisar sua solicitação.
            </p>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Nome completo *</label>
              <input
                type="text"
                value={regForm.name}
                onChange={(e) => setRegForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Seu nome completo"
                className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                autoFocus
                disabled={regLoading}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Usuário desejado *</label>
              <input
                type="text"
                value={regForm.username}
                onChange={(e) => setRegForm(f => ({ ...f, username: e.target.value.replace(/\s/g, '').toLowerCase() }))}
                placeholder="Ex: joaosilva"
                className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                disabled={regLoading}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Senha *</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    value={regForm.password}
                    onChange={(e) => setRegForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mín. 6 caracteres"
                    className="w-full px-3 py-2 pr-9 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                    disabled={regLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">Confirmar senha *</label>
                <input
                  type={showRegPassword ? "text" : "password"}
                  value={regForm.confirmPassword}
                  onChange={(e) => setRegForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repita a senha"
                  className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                  disabled={regLoading}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Sua função na empresa</label>
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-md border border-primary/10 bg-muted/20 max-h-28 overflow-y-auto">
                {roleOptions.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRegRole(role)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                      regForm.desiredRoles.includes(role)
                        ? "bg-primary/15 text-primary border-primary/30 font-medium"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
                    }`}
                    disabled={regLoading}
                  >
                    {regForm.desiredRoles.includes(role) ? "✓ " : ""}{role}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Mensagem (opcional)</label>
              <textarea
                value={regForm.message}
                onChange={(e) => setRegForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Algo que queira informar ao admin..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                disabled={regLoading}
              />
            </div>
            <button
              type="submit"
              disabled={regLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {regLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {regLoading ? "Enviando..." : "Solicitar acesso"}
            </button>
            <button
              type="button"
              onClick={() => setView("login")}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao login
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUsername.trim()) {
      toast.error("Informe seu nome de usuário.");
      return;
    }
    setResetLoading(true);
    setResetNoEmail(false);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resetUsername.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (data.no_email) {
        setResetNoEmail(true);
      } else {
        setResetSent(true);
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setResetLoading(false);
    }
  };

  if (view === "reset") {
    if (resetSent) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <Header />
            <div className="rounded-lg border border-success/30 bg-card p-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-success" />
                </div>
                <h2 className="text-sm font-semibold text-foreground text-center">Email enviado!</h2>
                <p className="text-xs text-muted-foreground text-center">
                  Se o usuário <span className="font-mono font-medium text-foreground">{resetUsername}</span> possuir um email de recuperação cadastrado, um link de redefinição foi enviado.
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Verifique sua caixa de entrada e spam.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setView("login"); setResetSent(false); setResetUsername(""); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-primary/30 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Header />
          <form onSubmit={handleResetRequest} className="rounded-lg border border-primary/20 bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground text-center mb-2">Recuperar senha</h2>
            <p className="text-xs text-muted-foreground text-center">
              Informe seu nome de usuário. Enviaremos um link de redefinição para o email de recuperação cadastrado.
            </p>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Usuário</label>
              <input
                type="text"
                value={resetUsername}
                onChange={(e) => { setResetUsername(e.target.value); setResetNoEmail(false); }}
                placeholder="Seu nome de usuário"
                className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                autoFocus
                disabled={resetLoading}
              />
            </div>
            {resetNoEmail && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-destructive">
                  Este usuário não possui email de recuperação cadastrado. Entre em contato com o administrador.
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {resetLoading ? "Enviando..." : "Enviar link de redefinição"}
            </button>
            <button
              type="button"
              onClick={() => { setView("login"); setResetNoEmail(false); setResetUsername(""); }}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Header />

        <form onSubmit={handleSubmit} className="rounded-lg border border-primary/20 bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground text-center mb-2">Entrar no sistema</h2>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Seu usuário"
              className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
              autoFocus
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3 py-2 pr-10 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView("reset")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Esqueci minha senha
            </button>
            <button
              type="button"
              onClick={() => setView("register")}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Solicitar acesso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}