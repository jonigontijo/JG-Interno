import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, CheckCircle2, LinkIcon, Loader2, RefreshCw, ExternalLink } from "lucide-react";

interface SheetsStatus {
  connected_oauth: boolean;
  google_email: string | null;
  spreadsheet_id: string | null;
  last_synced_at: string | null;
}

export default function GoogleSheetsIntegration() {
  const [status, setStatus] = useState<SheetsStatus | null>(null);
  const [tabCount, setTabCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const popupRef = useRef<Window | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [{ data }, { count }] = await Promise.all([
        supabase.functions.invoke("google-sheets-status"),
        supabase.from("sm_sheet_tabs").select("*", { count: "exact", head: true }),
      ]);
      setStatus(data as SheetsStatus);
      setTabCount(count || 0);
    } catch {
      toast.error("Falha ao consultar status do Sheets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev?.data?.type === "google-oauth-callback") {
        if (ev.data.ok) { toast.success("Google conectado (Sheets + Agenda)!"); loadStatus(); }
        else toast.error("Falha ao conectar Google");
        setBusy(null);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [loadStatus]);

  const handleConnect = async () => {
    setBusy("connect");
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { origin: window.location.origin } });
      if (error) throw error;
      const url = (data as { url?: string }).url;
      if (!url) throw new Error("URL de autorização não recebida");
      const w = 520, h = 640;
      const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
      popupRef.current = window.open(url, "google-oauth", `width=${w},height=${h},left=${left},top=${top}`);
      if (!popupRef.current) { toast.error("Permita pop-ups e tente novamente"); setBusy(null); }
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); setBusy(null); }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      const { data, error } = await supabase.functions.invoke("google-sheets-mirror", { body: {} });
      if (error) throw error;
      const r = data as { ok: boolean; tabs?: number; reason?: string };
      if (!r.ok) toast.error(`Sync falhou: ${r.reason}`);
      else toast.success(`Planilha sincronizada: ${r.tabs} abas`);
      await loadStatus();
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setBusy(null); }
  };

  const sheetUrl = status?.spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${status.spreadsheet_id}/edit` : null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center border bg-success/10 text-success border-success/20">
          <Sheet className="w-3.5 h-3.5" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Google Sheets — Planilha de Postagens</h2>
        <div className="ml-auto">
          {status?.connected_oauth ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
              <CheckCircle2 className="w-3 h-3" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
              Somente leitura (CSV)
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</div>
        ) : (
          <>
            <div className="text-xs space-y-1">
              {status?.google_email && <p><span className="text-muted-foreground">Conta: </span><span className="font-mono">{status.google_email}</span></p>}
              <p className="text-muted-foreground">Abas espelhadas: <span className="text-foreground font-semibold">{tabCount}</span></p>
              {status?.last_synced_at && <p className="text-muted-foreground">Último sync: {new Date(status.last_synced_at).toLocaleString("pt-BR")}</p>}
              {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">Abrir planilha <ExternalLink className="w-3 h-3" /></a>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={handleSync} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50">
                {busy === "sync" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sincronizar todas as abas
              </button>
              <button onClick={handleConnect} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50">
                {busy === "connect" ? <Loader2 className="w-3 h-3 animate-spin" /> : <LinkIcon className="w-3 h-3" />}
                {status?.connected_oauth ? "Reconectar Google" : "Conectar via Google (Sheets + Agenda)"}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              A grade editável fica na aba <strong>Planilha</strong>. O sync automático roda a cada 2 minutos; edições no app são escritas de volta na planilha em tempo real.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
