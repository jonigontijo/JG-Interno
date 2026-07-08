import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, ThumbsUp, Lightbulb, AlertTriangle, Check } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore, type InternalRequest } from "@/store/useAppStore";
import { toast } from "sonner";

const FEEDBACK_DEPARTMENT = "Feedback do Cliente";

type FeedbackTipo = "elogio" | "sugestao" | "reclamacao" | "outro";

function inferTipo(title: string): FeedbackTipo {
  const t = title.toLowerCase();
  if (t.startsWith("elogio")) return "elogio";
  if (t.startsWith("sugest")) return "sugestao";
  if (t.startsWith("reclama")) return "reclamacao";
  return "outro";
}

const TIPO_CONFIG: Record<FeedbackTipo, { label: string; icon: React.ElementType; className: string }> = {
  elogio: { label: "Elogio", icon: ThumbsUp, className: "bg-green-500/15 text-green-600 border-green-500/30" },
  sugestao: { label: "Sugestão", icon: Lightbulb, className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  reclamacao: { label: "Reclamação", icon: AlertTriangle, className: "bg-red-500/15 text-red-600 border-red-500/30" },
  outro: { label: "Feedback", icon: MessageSquare, className: "bg-muted text-muted-foreground border-border" },
};

export default function FeedbacksPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const { requests, updateRequest } = useAppStore();
  const [filter, setFilter] = useState<"unread" | "read" | "all">("unread");

  const isAdmin = currentUser?.isAdmin || false;
  const isGerente = currentUser?.roles?.some((r) => r.includes("Gerente Operacional")) || false;
  const canSeeAll = isAdmin || isGerente;

  const myFeedbacks = requests.filter((r) => {
    if (r.department !== FEEDBACK_DEPARTMENT) return false;
    if (canSeeAll) return true;
    return r.assignedToName === currentUser?.name;
  });

  const sorted = [...myFeedbacks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const unreadCount = sorted.filter((r) => !r.lido).length;
  const readCount = sorted.filter((r) => r.lido).length;

  const filtered = sorted.filter((r) => {
    if (filter === "unread") return !r.lido;
    if (filter === "read") return !!r.lido;
    return true;
  });

  const handleMarcarLido = (r: InternalRequest) => {
    updateRequest(r.id, { lido: true, lidoEm: new Date().toISOString() });
    toast.success("Marcado como lido");
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Feedbacks"
        description="Elogios, sugestões e reclamações enviadas pelos clientes"
      />

      <div className="flex gap-2">
        <Button variant={filter === "unread" ? "default" : "outline"} size="sm" onClick={() => setFilter("unread")}>
          Não lidos {unreadCount > 0 && <Badge variant="secondary" className="ml-1.5">{unreadCount}</Badge>}
        </Button>
        <Button variant={filter === "read" ? "default" : "outline"} size="sm" onClick={() => setFilter("read")}>
          Lidos {readCount > 0 && <Badge variant="secondary" className="ml-1.5">{readCount}</Badge>}
        </Button>
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          Todos
        </Button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhum feedback {filter === "unread" ? "não lido" : filter === "read" ? "lido" : ""} no momento.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r) => {
          const tipo = inferTipo(r.title);
          const config = TIPO_CONFIG[tipo];
          const Icon = config.icon;
          return (
            <div
              key={r.id}
              className={`rounded-lg border p-4 space-y-2 ${r.lido ? "opacity-70" : "border-primary/40"}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${config.className}`}>
                  <Icon className="w-3 h-3" /> {config.label}
                </span>
                {r.clientName && <Badge variant="outline">{r.clientName}</Badge>}
                {!r.lido && <Badge className="bg-destructive text-destructive-foreground">Novo</Badge>}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(r.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm text-foreground">{r.description}</p>
              {!r.lido && (
                <div className="pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleMarcarLido(r)}>
                    <Check className="w-3.5 h-3.5 mr-1.5" /> Marcar como lido
                  </Button>
                </div>
              )}
              {r.lido && r.lidoEm && (
                <p className="text-[11px] text-muted-foreground">
                  Lido em {new Date(r.lidoEm).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
