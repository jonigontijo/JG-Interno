// Avisa o app do cliente (JG App) sobre uma ação que aconteceu aqui no JG Interno.
// Chama a Edge Function `notify-app` (server-side guarda o segredo do JG App).
// Contrato dos eventos: docs/EVENTOS_INTEGRACAO_APP.md.
//
// Uso após uma mutação de domínio, fire-and-forget (não bloqueia a UI):
//   await notifyApp("producao.criada", clienteId, { id, titulo, tipo, status });
// ou via atalho tipado:
//   notifyApp.producaoCriada(clienteId, { id, titulo, tipo });

import { supabase } from "@/integrations/supabase/client";

export type EventoApp =
  | "aprovacao.criada"
  | "producao.criada" | "producao.status"
  | "trafego.atualizado" | "trafego.criativo"
  | "agenda.evento"
  | "meta.definida" | "meta.atingida"
  | "nps.solicitado"
  | "marca.atualizada"
  | "networking.novo"
  | "onboarding.etapa"
  | "feedback.novo";

interface Override { titulo?: string; mensagem?: string }

/**
 * Dispara um evento para o app do cliente. Nunca lança — loga e retorna false
 * em falha, para não derrubar o fluxo da tela que chamou.
 */
export async function notifyApp(
  evento: EventoApp,
  clienteIdExterno: string,
  data: Record<string, unknown>,
  notificacao?: Override,
): Promise<boolean> {
  try {
    const { data: res, error } = await supabase.functions.invoke("notify-app", {
      body: {
        evento,
        cliente_id_externo: clienteIdExterno,
        data,
        ...(notificacao ? { notificacao } : {}),
      },
    });
    if (error) {
      console.warn(`[notifyApp] ${evento} falhou:`, error.message);
      return false;
    }
    return Boolean((res as { ok?: boolean })?.ok);
  } catch (e) {
    console.warn(`[notifyApp] ${evento} exceção:`, (e as Error)?.message);
    return false;
  }
}

// ── Atalhos tipados (opcional; deixam o call site curto e legível) ──
notifyApp.producaoCriada = (clienteId: string, p: { id: string; titulo: string; tipo: string; status?: string }, n?: Override) =>
  notifyApp("producao.criada", clienteId, p, n);

notifyApp.producaoStatus = (clienteId: string, p: { id: string; titulo?: string; status: string }, n?: Override) =>
  notifyApp("producao.status", clienteId, p, n);

notifyApp.agendaEvento = (clienteId: string, e: { funcionario_id: string; data_hora: string; descricao: string; plataformas?: string[] }, n?: Override) =>
  notifyApp("agenda.evento", clienteId, e, n);

notifyApp.metaDefinida = (clienteId: string, m: { mes: string; valor_meta: number; descricao?: string }, n?: Override) =>
  notifyApp("meta.definida", clienteId, m, n);

notifyApp.npsSolicitado = (clienteId: string, m: { mes: string }, n?: Override) =>
  notifyApp("nps.solicitado", clienteId, m, n);

notifyApp.networkingNovo = (clienteId: string, w: { setor: string; descricao?: string }, n?: Override) =>
  notifyApp("networking.novo", clienteId, w, n);

notifyApp.feedbackNovo = (clienteId: string, f: { tipo?: string; mensagem: string }, n?: Override) =>
  notifyApp("feedback.novo", clienteId, f, n);
