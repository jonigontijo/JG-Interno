// Catálogo de eventos disponíveis para inscrição de webhooks.
// Cada webhook cadastrado escolhe um ou mais destes eventos.
// Quando o evento ocorre, o sistema dispara POST para as URLs inscritas
// via a Edge Function `sm-fire-event`.

export interface WebhookEventDef {
  key: string;
  label: string;
  description: string;
  group: string;
}

export const WEBHOOK_EVENTS: WebhookEventDef[] = [
  // ── Aprovação ──
  {
    key: "approval.created",
    label: "Post enviado para aprovação",
    description: "Disparado quando o social media envia uma peça para aprovação do cliente.",
    group: "Aprovação",
  },
  {
    key: "approval.responded",
    label: "Cliente respondeu a aprovação",
    description: "Disparado quando o cliente aprova, reprova ou solicita revisão.",
    group: "Aprovação",
  },

  // ── Posts ──
  {
    key: "post.scheduled",
    label: "Post agendado",
    description: "Disparado quando um post é agendado (na planilha ou via Google Agenda).",
    group: "Postagens",
  },
  {
    key: "post.published",
    label: "Post publicado",
    description: "Disparado quando um post é marcado como publicado.",
    group: "Postagens",
  },
  {
    key: "post.late",
    label: "Post atrasado",
    description: "Disparado quando um post passa da data sem ser publicado.",
    group: "Postagens",
  },

  // ── Relatórios ──
  {
    key: "report.generated",
    label: "Relatório mensal gerado",
    description: "Disparado quando a IA gera o relatório mensal de um cliente.",
    group: "Relatórios",
  },
];

export const EVENT_GROUPS = [...new Set(WEBHOOK_EVENTS.map((e) => e.group))];

export function eventLabel(key: string): string {
  return WEBHOOK_EVENTS.find((e) => e.key === key)?.label || key;
}
