import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { socialAction } from "@/lib/socialIntegration";

interface Health {
  local_attention: number;
  remote: { failed: number; pending: number } | null;
  checked_at: string;
}

export default function SocialIntegrationAlert() {
  const user = useAuthStore((s) => s.currentUser);
  const query = useQuery<Health>({
    queryKey: ["social-integration-health", user?.id],
    enabled: !!user?.isAdmin,
    queryFn: () => socialAction({ action: "health" }),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });
  if (!user?.isAdmin) return null;
  const health = query.data;
  const unknown = query.isError || (!!health && !health.remote);
  if (!unknown && (!health || (!health.local_attention && !health.remote?.failed && !health.remote?.pending))) return null;
  return (
    <aside role="alert" className="mb-4 rounded-lg border border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
      <strong>Integração Social Media precisa de atenção</strong>
      {unknown && <p>Não foi possível conferir todas as filas. O recebimento das atualizações não está confirmado.</p>}
      {!!health?.local_attention && <p>{health.local_attention} envio(s) do JG Interno precisam de revisão e reenvio em Configurações → Integração Social Media.</p>}
      {!query.isError && health?.remote && (health.remote.failed > 0 || health.remote.pending > 0) && (
        <p>O Social Media informa {health.remote.failed} envio(s) com falha e {health.remote.pending} pendente(s). Peça ao responsável para conferir a fila e reenviar os que exigirem ação manual. Esse total pode incluir outros clientes e testes antigos.</p>
      )}
      <p className="mt-2 text-sm">Este aviso é atualizado a cada minuto enquanto o sistema está aberto e permanece enquanto houver pendências informadas.</p>
      <Link to="/settings" className="mt-2 inline-block underline">Abrir configurações</Link>
    </aside>
  );
}
