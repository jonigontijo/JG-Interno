import PageHeader from "@/components/PageHeader";
import { FileText, Plus, Trash2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const initialProposals = [
  { id: "p1", client: "Ferreira & Associados", value: "R$ 5.000/mês", status: "pending", date: "2026-03-08", version: "v1" },
  { id: "p2", client: "SO Beauty", value: "R$ 3.500/mês", status: "approval", date: "2026-03-07", version: "v2" },
  { id: "p3", client: "MV Construtora", value: "R$ 8.000/mês", status: "in_progress", date: "2026-03-09", version: "v1" },
];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState(initialProposals);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setProposals(proposals.filter(p => p.id !== id));
    setDeleteId(null);
  };

  return (
    <div>
      <PageHeader title="Propostas" description="Gestão de propostas comerciais">
        <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Nova Proposta
        </button>
      </PageHeader>
      <div className="grid gap-4">
        {proposals.map(p => (
          <div key={p.id} className="rounded-lg border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3 cursor-pointer flex-1">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{p.client}</p>
                <p className="text-xs text-muted-foreground">{p.value} · {p.version} · {p.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={p.status} />
              <button
                onClick={() => setDeleteId(p.id)}
                className="p-2 rounded hover:bg-destructive/10 transition-colors"
                title="Excluir proposta"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A proposta será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
