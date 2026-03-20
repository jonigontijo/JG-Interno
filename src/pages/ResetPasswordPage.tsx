import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import logoJG from "@/assets/logo-jg.png";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Token inválido ou ausente.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        toast.error(data.error || "Erro ao redefinir senha.");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <img src={logoJG} alt="JG" className="w-16 h-16 object-contain mx-auto" />
          <h1 className="text-lg font-bold text-primary">JG Gestão Interna</h1>
          <p className="text-sm text-muted-foreground">Link inválido ou expirado.</p>
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 mx-auto px-4 py-2.5 rounded-md border border-primary/30 text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center justify-center gap-3 mb-8">
            <img src={logoJG} alt="JG" className="w-16 h-16 object-contain" />
            <h1 className="text-lg font-bold text-primary">JG Gestão Interna</h1>
          </div>
          <div className="rounded-lg border border-success/30 bg-card p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <h2 className="text-sm font-semibold text-foreground text-center">Senha redefinida!</h2>
              <p className="text-xs text-muted-foreground text-center">
                Sua senha foi alterada com sucesso. Agora você pode fazer login com a nova senha.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Ir para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center justify-center gap-3 mb-8">
          <img src={logoJG} alt="JG" className="w-16 h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-lg font-bold text-primary">JG Gestão Interna</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Joni Gontijo &bull; Gestão &amp; Tráfego Pago</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-primary/20 bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground text-center mb-2">Criar nova senha</h2>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Nova senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                className="w-full px-3 py-2 pr-10 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
                disabled={loading}
                autoFocus
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
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Confirmar nova senha</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full px-3 py-2 rounded-md border border-primary/20 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 focus:outline-none"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
