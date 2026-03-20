import { Checkbox } from "@/components/ui/checkbox";
import { useAppStore } from "@/store/useAppStore";
import { useMemo } from "react";

// Maps common roles to sector groups
const ROLE_SECTOR_MAP: Record<string, string> = {
  "gestor de tráfego": "Tráfego",
  "tráfego": "Tráfego",
  "social media": "Social Media",
  "gestora de social media": "Social Media",
  "coordenadora de social media": "Social Media",
  "designer": "Design",
  "designer gráfico": "Design",
  "videomaker": "Produção / Videomaker",
  "editor de vídeo": "Produção / Videomaker",
  "inside sales": "Comercial",
  "closer": "Comercial",
  "gerente operacional": "Operação",
  "ceo": "Diretoria",
  "assistente": "Operação",
};

function getSector(member: { role: string; roles: string[] }): string {
  const allRoles = [member.role, ...member.roles].map(r => r.toLowerCase().trim());
  for (const r of allRoles) {
    for (const [key, sector] of Object.entries(ROLE_SECTOR_MAP)) {
      if (r.includes(key)) return sector;
    }
  }
  return "Outros";
}

interface TeamMemberSelectorProps {
  selectedIds: string[];
  onToggle: (memberId: string) => void;
  allSelected?: boolean;
  onToggleAll?: () => void;
  showAllToggle?: boolean;
  maxHeight?: string;
}

export default function TeamMemberSelector({
  selectedIds,
  onToggle,
  allSelected = false,
  onToggleAll,
  showAllToggle = true,
  maxHeight = "max-h-64",
}: TeamMemberSelectorProps) {
  const { team } = useAppStore();

  const grouped = useMemo(() => {
    const groups: Record<string, typeof team> = {};
    for (const m of team) {
      const sector = getSector(m);
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(m);
    }
    // Sort sectors alphabetically, but "Outros" last
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "Outros") return 1;
      if (b === "Outros") return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({ sector: key, members: groups[key] }));
  }, [team]);

  return (
    <div className="space-y-2">
      {showAllToggle && onToggleAll && (
        <button
          type="button"
          onClick={onToggleAll}
          className={`w-full px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
            allSelected
              ? "bg-primary/10 border-primary text-primary"
              : "bg-background border-border text-foreground hover:bg-muted"
          }`}
        >
          {allSelected ? "✓ Todos os colaboradores selecionados" : "Selecionar todos os colaboradores"}
        </button>
      )}

      {!allSelected && (
        <div className={`border rounded-md ${maxHeight} overflow-y-auto`}>
          {grouped.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum colaborador encontrado.</p>
          ) : (
            grouped.map(({ sector, members }) => (
              <div key={sector}>
                <div className="sticky top-0 z-10 bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b">
                  {sector}
                </div>
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.includes(member.id)}
                      onCheckedChange={() => onToggle(member.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground">{member.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{member.role}</span>
                    </div>
                  </label>
                ))}
              </div>
            ))
          )}
          {selectedIds.length > 0 && (
            <div className="sticky bottom-0 px-3 py-2 bg-muted/50 text-xs text-muted-foreground border-t">
              {selectedIds.length} colaborador(es) selecionado(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
