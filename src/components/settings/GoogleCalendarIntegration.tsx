import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { Calendar, CheckCircle2, LinkIcon, Loader2, LogOut, RefreshCw } from "lucide-react";

interface GcalStatus {
  connected: boolean;
  google_email: string | null;
  calendar_id: string | null;
  connected_at: string | null;
  last_sync_token_at: string | null;
  has_sync_token: boolean;
}

interface GoogleCalendarIntegrationProps {
  /** Quando true, oculta o card para usuarios sem permissao de admin. Default: false (qualquer um pode conectar). */
  adminOnly?: boolean;
}

export default function GoogleCalendarIntegration({ adminOnly = false }: GoogleCalendarIntegrationProps = {}) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = !!currentUser?.isAdmin;
  const [status, setStatus] = useState<GcalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "sync" | null>(null);
  const popupRef = useRef<Window | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-status");
      if (error) throw error;
      setStatus(data as GcalStatus);
    } catch (e) {
      console.error("status error:", e);
      toast.error("Falha ao consultar status da integração");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev?.data?.type === "google-oauth-callback") {
        if (ev.data.ok) {
          toast.success("Conta Google conectada!");
          loadStatus();
        } else {
          toast.error("Falha ao conectar conta Google");
        }
        setBusy(null);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [loadStatus]);

  const handleConnect = async () => {
    setBusy("connect");
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      const url = (data as { url?: string }).url;
      if (!url) throw new Error("URL de autorização não recebida");
      const w = 520, h = 640;
      const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
      popupRef.current = window.open(
        url,
        "google-oauth",
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
      if (!popupRef.current) {
        toast.error("Permita pop-ups e tente novamente");
        setBusy(null);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao iniciar conexão: ${e?.message || e}`);
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a Google Agenda? Eventos já criados no Google não serão removidos.")) return;
    setBusy("disconnect");
    try {
      const { error } = await supabase.functions.invoke("google-calendar-disconnect");
      if (error) throw error;
      toast.success("Conta desconectada");
      await loadStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao desconectar: ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-pull");
      if (error) throw error;
      const r = data as { ok: boolean; upserts?: number; deletes?: number; total?: number; reason?: string };
      if (!r.ok) {
        toast.error(`Sync falhou: ${r.reason || "erro"}`);
      } else {
        toast.success(`Sync ok: ${r.upserts || 0} alteraç${(r.upserts || 0) === 1 ? "ão" : "ões"}, ${r.deletes || 0} cancelad${(r.deletes || 0) === 1 ? "a" : "as"}`);
      }
      await loadStatus();
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha no sync: ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  if (adminOnly && !isAdmin) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center border bg-primary/10 text-primary border-primary/20">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Google Agenda</h2>
        <span className="text-[10px] text-muted-foreground ml-1">Integração</span>
        <div className="ml-auto flex items-center gap-2">
          {status?.connected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
              <CheckCircle2 className="w-3 h-3" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
              Desconectado
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando status...
          </div>
        ) : status?.connected ? (
          <>
            <div className="text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">Conta conectada: </span>
                <span className="font-mono font-medium text-foreground">{status.google_email}</span>
              </p>
              <p className="text-muted-foreground">
                Calendário: <span className="text-foreground">{status.calendar_id}</span>
              </p>
              {status.connected_at && (
                <p className="text-muted-foreground">
                  Conectado em {new Date(status.connected_at).toLocaleString("pt-BR")}
                </p>
              )}
              <p className="text-muted-foreground">
                Estado do sync incremental: {status.has_sync_token ? "ativo" : "será inicializado no próximo sync"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleSync}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busy === "sync" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Sincronizar agora
              </button>
              <button
                onClick={handleDisconnect}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 disabled:opacity-50"
              >
                {busy === "disconnect" ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                Desconectar
              </button>
              <button
                onClick={handleConnect}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50"
              >
                {busy === "connect" ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                Reconectar (outra conta)
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Conecte a conta Google (ex: <span className="font-mono">agendajoaojg@gmail.com</span>) para sincronizar
              as gravações da aba Social Media → Calendário de Gravações com a Google Agenda. A sincronização é
              bidirecional: o que for criado/editado/excluído em um lado reflete no outro.
            </p>
            <button
              onClick={handleConnect}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              Conectar Google Agenda
            </button>
          </>
        )}
      </div>
    </div>
  );
}
