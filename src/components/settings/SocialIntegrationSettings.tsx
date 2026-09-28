import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import {
  socialAction,
  socialDeliveries,
  socialOverview,
  socialRuns,
} from "@/lib/socialIntegration";
import { toast } from "sonner";

export default function SocialIntegrationSettings() {
  const admin = useAuthStore((s) => s.currentUser?.isAdmin),
    [busy, setBusy] = useState(false),
    [remoteIds, setRemoteIds] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["social-integration-admin"],
    enabled: !!admin,
    queryFn: async () => ({
      clients: await socialOverview(),
      events: await socialDeliveries(),
      runs: await socialRuns(),
    }),
    refetchInterval: 30000,
  });
  if (!admin) return null;
  async function act(body: Record<string, unknown>, endpoint?: string) {
    setBusy(true);
    try {
      const result = await socialAction(body, endpoint);
      toast.success(
        result?.enabled === false
          ? "Envios estão desligados no servidor."
          : "Ação registrada. Confira o estado atualizado.",
      );
      await query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na integração");
    } finally {
      setBusy(false);
    }
  }
  const names = Object.fromEntries(
    (query.data?.clients || []).map((c) => [c.client_id, c.name]),
  );
  return (
    <section className="border rounded-lg bg-card p-5 space-y-4">
      <h2 className="font-semibold">Integração com JG Social Media</h2>
      <p className="text-sm text-muted-foreground">
        A fila permanece no banco até a confirmação do outro sistema.
        Credenciais e ativação são configuradas no servidor.
      </p>
      {query.error && (
        <p role="alert">
          Não foi possível carregar a integração. Verifique implantação e
          permissões.
        </p>
      )}
      <div className="flex gap-3">
        <button
          className="border rounded p-2 text-sm"
          disabled={busy}
          onClick={() => act({}, "jg-social-dispatch")}
        >
          Processar pendências
        </button>
        <button
          className="border rounded p-2 text-sm"
          disabled={busy}
          onClick={() => act({}, "jg-social-reconcile")}
        >
          Conferir entregas
        </button>
      </div>
      {(query.data?.clients || []).filter((c) =>
        (c.version > 0 && !c.reviewed) || c.issue
      ).map((c) => (
        <div key={c.client_id} className="border rounded p-3 space-y-2">
          <strong>{c.name || c.client_id}</strong>
          <p className="text-sm">
            {c.issue || "Revisar vínculo no sistema externo"}
          </p>
          {!c.reviewed && (
            <>
              <input
                aria-label={`Identificador externo de ${c.name}`}
                placeholder="ID do cliente já existente no Social Media"
                value={remoteIds[c.client_id] || ""}
                onChange={(e) =>
                  setRemoteIds({ ...remoteIds, [c.client_id]: e.target.value })}
                className="w-full border rounded p-2 bg-background"
              />
              <button
                className="border rounded p-2 text-sm mr-2"
                disabled={busy || !remoteIds[c.client_id]}
                onClick={() =>
                  act({
                    action: "link_existing",
                    client_id: c.client_id,
                    remote_id: remoteIds[c.client_id],
                  })}
              >
                Vincular existente
              </button>
              <button
                className="border rounded p-2 text-sm"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Confirma que ${c.name} ainda NÃO existe no sistema de Social Media? Isso libera a criação externa.`,
                    )
                  ) {
                    void act({ action: "approve_new", client_id: c.client_id });
                  }
                }}
              >
                Confirmar que ainda não existe
              </button>
            </>
          )}
        </div>
      ))}
      <h3 className="font-medium text-sm">Últimas conferências automáticas</h3>
      <div className="max-h-40 overflow-auto text-sm">
        {(query.data?.runs || []).map((r) => (
          <p key={r.id} className={r.success ? "" : "text-destructive"}>
            {names[r.client_id] || r.client_id} ·{" "}
            {new Date(r.created_at).toLocaleString("pt-BR")} ·{" "}
            {r.success ? "Conferido" : r.detail}
          </p>
        ))}
      </div>
      <h3 className="font-medium text-sm">Últimos 200 envios</h3>
      <div className="max-h-80 overflow-auto text-sm">
        {(query.data?.events || []).map((e) => (
          <div key={e.id} className="border-t py-2">
            <strong>{names[e.client_id] || e.client_id}</strong> · v{e.version}
            {" "}
            · {({
              pending: "Pendente",
              sending: "Enviando",
              delivered: "Confirmado",
              needs_attention: "Precisa de atenção",
            } as Record<string, string>)[e.status]} · {e.attempts} tentativa(s)
            {e.last_error && (
              <p className="text-destructive">
                Falha registrada: {e.last_error}
              </p>
            )}
            {e.status === "needs_attention" && (
              <button
                disabled={busy}
                onClick={() =>
                  act({
                    action: "retry_event",
                    client_id: e.client_id,
                    event_id: e.id,
                  })}
                className="underline"
              >
                Reenviar
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
