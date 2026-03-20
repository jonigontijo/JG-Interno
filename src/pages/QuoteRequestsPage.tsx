import { useAppStore } from "@/store/useAppStore";
import { formatCurrency } from "@/data/mockData";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Clock, Send, CheckCircle, CreditCard, AlertTriangle,
  FileText, ExternalLink
} from "lucide-react";

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending: { label: "Aguardando proposta", icon: Clock, color: "text-warning", bg: "bg-warning/10" },
  proposal_sent: { label: "Proposta enviada", icon: Send, color: "text-info", bg: "bg-info/10" },
  approved: { label: "Aprovado · Aguardando pagamento", icon: CheckCircle, color: "text-primary", bg: "bg-primary/10" },
  paid: { label: "Pago · Serviço ativado", icon: CreditCard, color: "text-success", bg: "bg-success/10" },
  cancelled: { label: "Cancelado", icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function QuoteRequestsPage() {
  const navigate = useNavigate();
  const { quoteRequests, updateQuoteRequest, completeQuoteRequest } = useAppStore();

  const active = quoteRequests.filter((q) => q.status !== "paid" && q.status !== "cancelled");
  const completed = quoteRequests.filter((q) => q.status === "paid" || q.status === "cancelled");

  const handleSendProposal = (qrId: string) => {
    const value = prompt("Valor mensal da proposta (R$):");
    if (!value || isNaN(Number(value))) return;
    updateQuoteRequest(qrId, {
      status: "proposal_sent",
      proposalValue: Number(value),
      proposalSentAt: new Date().toISOString().slice(0, 10),
    });
    toast.success("Proposta enviada!");
  };

  const handleApproved = (qrId: string) => {
    updateQuoteRequest(qrId, {
      status: "approved",
      approvedAt: new Date().toISOString().slice(0, 10),
    });
    toast.success("Cliente aprovou!");
  };

  const handlePaid = (qrId: string) => {
    completeQuoteRequest(qrId);
    toast.success("Pagamento confirmado! Serviço ativado.");
  };

  const handleCancel = (qrId: string) => {
    updateQuoteRequest(qrId, { status: "cancelled" });
    toast("Solicitação cancelada");
  };

  return (
    <div>
      <PageHeader
        title="Solicitações de Orçamento"
        description={`${active.length} solicitações ativas`}
      />

      {quoteRequests.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-foreground font-medium mb-1">Nenhuma solicitação ainda</p>
          <p className="text-xs text-muted-foreground">Acesse a ficha de um cliente e clique em "Solicitar Orçamento" para registrar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ativas</h3>
              <div className="space-y-3">
                {active.map((qr) => {
                  const st = statusConfig[qr.status];
                  const StIcon = st.icon;
                  return (
                    <div key={qr.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => navigate(`/clients/${qr.clientId}`)}
                              className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                              {qr.clientName} <ExternalLink className="w-3 h-3" />
                            </button>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{qr.service}</span>
                          </div>
                          <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${st.bg} ${st.color} mb-2`}>
                            <StIcon className="w-3 h-3" /> {st.label}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Solicitado por <span className="text-foreground">{qr.requestedBy}</span> em {qr.requestedAt}
                          </p>
                          {qr.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{qr.notes}"</p>}
                          {qr.proposalValue && (
                            <p className="text-xs text-muted-foreground mt-1">Valor proposto: <span className="text-foreground font-mono">{formatCurrency(qr.proposalValue)}/mês</span></p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {qr.status === "pending" && (
                          <>
                            <button onClick={() => handleSendProposal(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                              <Send className="w-3 h-3" /> Enviar Proposta
                            </button>
                            <button onClick={() => handleCancel(qr.id)} className="px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                          </>
                        )}
                        {qr.status === "proposal_sent" && (
                          <>
                            <button onClick={() => handleApproved(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-medium hover:bg-success/90 transition-colors">
                              <CheckCircle className="w-3 h-3" /> Cliente Aprovou
                            </button>
                            <button onClick={() => handleCancel(qr.id)} className="px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                          </>
                        )}
                        {qr.status === "approved" && (
                          <button onClick={() => handlePaid(qr.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success text-success-foreground text-xs font-medium hover:bg-success/90 transition-colors">
                            <CreditCard className="w-3 h-3" /> Confirmar Pagamento
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico</h3>
              <div className="space-y-2">
                {completed.map((qr) => {
                  const st = statusConfig[qr.status];
                  const StIcon = st.icon;
                  return (
                    <div key={qr.id} className="rounded-lg border bg-card/50 p-3 opacity-70">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{qr.clientName}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{qr.service}</span>
                        <span className={`flex items-center gap-1 text-xs ${st.color}`}>
                          <StIcon className="w-3 h-3" /> {st.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
