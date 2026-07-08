import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Star, MessageSquare } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";

function notaColor(nota: number): string {
  if (nota >= 9) return "text-green-600";
  if (nota >= 7) return "text-yellow-600";
  return "text-red-600";
}

function classifyNota(nota: number): string {
  if (nota >= 9) return "Promotor";
  if (nota >= 7) return "Neutro";
  return "Detrator";
}

export default function NPSPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const npsVotes = useAppStore((s) => s.npsVotes);

  const isAdmin = currentUser?.isAdmin || false;
  const isGerente = currentUser?.roles?.some((r) => r.includes("Gerente Operacional")) || false;
  const canSeeAll = isAdmin || isGerente;

  const [selectedGestor, setSelectedGestor] = useState<string | null>(null);

  const myVotes = useMemo(() => {
    if (canSeeAll) return npsVotes;
    return npsVotes.filter((v) => v.jginternoUsername === currentUser?.username);
  }, [npsVotes, canSeeAll, currentUser]);

  const sorted = useMemo(
    () => [...myVotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [myVotes]
  );

  const average = sorted.length ? sorted.reduce((sum, v) => sum + v.nota, 0) / sorted.length : null;

  const byGestor = useMemo(() => {
    if (!canSeeAll) return [];
    const map = new Map<string, { username: string; nome: string; votes: typeof npsVotes }>();
    for (const v of npsVotes) {
      const key = v.jginternoUsername || "sem-gestor";
      if (!map.has(key)) map.set(key, { username: key, nome: v.gestorNome || key, votes: [] });
      map.get(key)!.votes.push(v);
    }
    return Array.from(map.values())
      .map((g) => ({
        ...g,
        average: g.votes.reduce((s, v) => s + v.nota, 0) / g.votes.length,
      }))
      .sort((a, b) => b.average - a.average);
  }, [npsVotes, canSeeAll]);

  const listToShow = canSeeAll && selectedGestor
    ? sorted.filter((v) => v.jginternoUsername === selectedGestor)
    : sorted;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="NPS"
        description="Notas e comentários enviados pelos clientes sobre o atendimento"
      />

      {canSeeAll && byGestor.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byGestor.map((g) => (
            <button
              key={g.username}
              type="button"
              onClick={() => setSelectedGestor(selectedGestor === g.username ? null : g.username)}
              className={`text-left rounded-lg border p-4 space-y-1 transition-colors ${
                selectedGestor === g.username ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-sm text-muted-foreground">{g.nome}</div>
              <div className={`text-2xl font-bold ${notaColor(g.average)}`}>{g.average.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">
                {g.votes.length} avaliaç{g.votes.length !== 1 ? "ões" : "ão"}
              </div>
            </button>
          ))}
        </div>
      )}

      {!canSeeAll && (
        <div className="rounded-lg border p-6 flex items-center gap-4">
          <Star className="w-8 h-8 text-yellow-500" />
          <div>
            <div className="text-3xl font-bold">{average !== null ? average.toFixed(1) : "—"}</div>
            <div className="text-sm text-muted-foreground">
              Sua média de NPS {sorted.length ? `(${sorted.length} avaliaç${sorted.length !== 1 ? "ões" : "ão"})` : "(nenhuma avaliação ainda)"}
            </div>
          </div>
        </div>
      )}

      {listToShow.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhuma avaliação de NPS no momento.
        </div>
      )}

      <div className="space-y-3">
        {listToShow.map((v) => (
          <div key={v.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-lg font-bold ${notaColor(v.nota)}`}>{v.nota}</span>
              <Badge variant="outline">{classifyNota(v.nota)}</Badge>
              {v.clientName && <Badge variant="outline">{v.clientName}</Badge>}
              {canSeeAll && <Badge variant="outline">{v.gestorNome}</Badge>}
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(v.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {v.comentario && (
              <p className="text-sm text-foreground flex items-start gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                {v.comentario}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
