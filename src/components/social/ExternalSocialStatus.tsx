import { useQuery } from "@tanstack/react-query";
import { socialOverview, socialPublications } from "@/lib/socialIntegration";
import { summarize } from "../../../supabase/functions/_shared/social-contract";
import { useState } from "react";

const labels: Record<string, string> = {
  producing: "Em produção",
  approval: "Aguardando aprovação",
  scheduled: "Agendado",
  published: "Publicado",
  cancelled: "Cancelado",
};
export default function ExternalSocialStatus(
  { clientId, weeklyPosts }: { clientId: string; weeklyPosts: number },
) {
  const [period, setPeriod] = useState(
    new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
      .slice(0, 7),
  );
  const query = useQuery({
    queryKey: ["external-social", clientId],
    queryFn: async () => ({
      state: (await socialOverview(clientId))[0],
      posts: await socialPublications(clientId),
    }),
    refetchInterval: 60000,
  });
  if (query.isLoading) {
    return <p className="p-4 text-sm">Carregando acompanhamento…</p>;
  }
  if (query.error) {
    return (
      <div className="p-4 border rounded-lg">
        <p>Integração indisponível ou sem permissão de acesso.</p>
        <button onClick={() => query.refetch()} className="underline text-sm">
          Tentar novamente
        </button>
      </div>
    );
  }
  const rows = (query.data?.posts || []).filter((p) => p.period === period),
    counts = summarize(rows, Date.now()),
    state = query.data?.state;
  return (
    <section className="border rounded-lg p-5 space-y-4 bg-card">
      <h2 className="font-semibold">Entregas do sistema de Social Media</h2>
      <p className="text-sm">
        Contrato cadastrado:{" "}
        <strong>{weeklyPosts} posts por semana</strong>. Os totais abaixo são do
        mês selecionado; não representam uma cota mensal.
      </p>
      <label className="block text-sm">
        Mês de referência{" "}
        <input
          aria-label="Mês de referência"
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="ml-2 border rounded p-1 bg-background"
        />
      </label>
      {state?.issue && (
        <p role="status" className="text-amber-700">{state.issue}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Último recebimento: {state?.last_received_at
          ? new Date(state.last_received_at).toLocaleString("pt-BR")
          : "Nenhum confirmado"}. Última conferência: {state?.reconciled_at
          ? new Date(state.reconciled_at).toLocaleString("pt-BR")
          : "Ainda não realizada"}.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ["Publicados", counts.published],
          ["Em produção", counts.producing],
          ["Em aprovação", counts.approval],
          ["Agendados", counts.scheduled],
          ["Pendentes em atraso", counts.overdue],
          ["Publicados após o prazo", counts.latePublished],
        ].map(([label, value]) => (
          <div key={label} className="border rounded p-3">
            <p className="text-xs">{label}</p>
            <strong className="text-xl">{value}</strong>
          </div>
        ))}
      </div>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          Nenhuma publicação recebida neste período. Isso não confirma ausência
          de postagem.
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Conteúdo</th>
              <th>Status</th>
              <th>Prazo original</th>
              <th>Publicado em</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.post_id} className="border-t">
                <td className="py-2">
                  {p.title}
                  <small className="block text-muted-foreground">
                    {p.format} ·{" "}
                    {(p.social_networks || [p.social_network]).join(", ")}
                  </small>
                </td>
                <td className="text-center">
                  {p.is_deleted ? "Removido" : labels[p.status] || p.status}
                </td>
                <td className="text-center">
                  {new Date(p.previous_due_date || p.due_date)
                    .toLocaleDateString("pt-BR")}
                </td>
                <td className="text-center">
                  {p.published_at
                    ? new Date(p.published_at).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Um conteúdo em várias redes conta uma vez. A distribuição da cota entre
        posts, reels e stories permanece conforme o contrato, sem estimativa
        automática.
      </p>
    </section>
  );
}
