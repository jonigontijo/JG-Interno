import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { Bot, AlertTriangle } from "lucide-react";

const aiAlerts = [
  { id: "ai1", client: "Lima Tech", campaign: "Conversão - Leads B2B", type: "CPA acima da meta", status: "pending", date: "2026-03-09 08:30", severity: "high" },
  { id: "ai2", client: "Clínica Almeida", campaign: "Reconhecimento - Marca", type: "Orçamento esgotando", status: "in_progress", date: "2026-03-09 07:15", severity: "medium" },
  { id: "ai3", client: "JB Engenharia", campaign: "Tráfego - Site", type: "CTR abaixo do benchmark", status: "done", date: "2026-03-08 16:00", severity: "low" },
];

export default function AIAlertsPage() {
  return (
    <div>
      <PageHeader title="IA de Campanhas" description="Alertas e monitoramento automático" />
      <div className="grid gap-3">
        {aiAlerts.map(alert => (
          <div key={alert.id} className="rounded-lg border bg-card p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium text-foreground">{alert.type}</h3>
              </div>
              <StatusBadge status={alert.status} />
            </div>
            <p className="text-xs text-muted-foreground">{alert.client} · {alert.campaign}</p>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span>{alert.date}</span>
              <span className={`flex items-center gap-1 ${alert.severity === "high" ? "text-destructive" : alert.severity === "medium" ? "text-warning" : "text-muted-foreground"}`}>
                <AlertTriangle className="w-3 h-3" /> {alert.severity === "high" ? "Alta" : alert.severity === "medium" ? "Média" : "Baixa"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
