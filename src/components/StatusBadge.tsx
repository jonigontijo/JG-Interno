import React from "react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusMap: Record<string, { class: string; label: string }> = {
  backlog: { class: "status-backlog", label: "Backlog" },
  pending: { class: "status-pending", label: "Pendente" },
  in_progress: { class: "status-in-progress", label: "Em andamento" },
  approval: { class: "status-approval", label: "Aprovação" },
  waiting_client: { class: "status-waiting", label: "Aguardando cliente" },
  waiting_area: { class: "status-waiting", label: "Aguardando área" },
  priority: { class: "status-priority", label: "Prioridade" },
  urgent: { class: "status-urgent", label: "Urgente" },
  critical: { class: "status-critical", label: "Crítico" },
  done: { class: "status-done", label: "Feito" },
  completed: { class: "status-done", label: "Concluída" },
  overdue: { class: "status-overdue", label: "Atrasado" },
  blocked: { class: "status-blocked", label: "Bloqueado" },
  paused: { class: "status-waiting", label: "Pausado" },
  normal: { class: "status-backlog", label: "Normal" },
  meeting_scheduled: { class: "status-in-progress", label: "Reunião agendada" },
  meeting_done: { class: "status-done", label: "Reunião realizada" },
  proposal_sent: { class: "status-approval", label: "Proposta enviada" },
  negotiation: { class: "status-priority", label: "Negociação" },
  closed: { class: "status-done", label: "Fechado" },
  lost: { class: "status-overdue", label: "Perdido" },
  awaiting_contract: { class: "status-pending", label: "Aguardando contrato" },
  contract_sent: { class: "status-in-progress", label: "Contrato enviado" },
  contract_signed: { class: "status-done", label: "Contrato assinado" },
  awaiting_nf: { class: "status-pending", label: "Aguardando NF" },
  nf_issued: { class: "status-in-progress", label: "NF emitida" },
  awaiting_payment: { class: "status-approval", label: "Aguardando pagamento" },
  paid: { class: "status-done", label: "Pago" },
  released: { class: "status-done", label: "Liberado" },
  kickoff_pending: { class: "status-pending", label: "Kickoff pendente" },
  kickoff_scheduled: { class: "status-in-progress", label: "Kickoff agendado" },
  kickoff_in_progress: { class: "status-in-progress", label: "Kickoff em andamento" },
  awaiting_access: { class: "status-waiting", label: "Aguardando acessos" },
  awaiting_info: { class: "status-waiting", label: "Aguardando informações" },
  onboarding_done: { class: "status-done", label: "Onboarding concluído" },
  sent_for_approval: { class: "status-approval", label: "Enviado para aprovação" },
  approved: { class: "status-done", label: "Aprovado" },
  adjustment_requested: { class: "status-urgent", label: "Ajuste solicitado" },
  em_dia: { class: "status-done", label: "Em dia" },
  atrasado: { class: "status-overdue", label: "Atrasado" },
  returned_to_sales: { class: "status-urgent", label: "Devolvido Comercial" },
};

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, size = "sm" }, ref) => {
    const config = statusMap[status] || { class: "status-backlog", label: status };
    return (
      <span ref={ref} className={`status-badge ${config.class} ${size === "sm" ? "text-[11px]" : "text-xs"}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {config.label}
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export default StatusBadge;
