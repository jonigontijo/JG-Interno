import { useEffect, useState, Fragment } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useAuthStore";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}

interface ChangeLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_by: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  description: string | null;
}

const ACOES: Record<string, { label: string; cor: string }> = {
  INSERT: { label: "Criou", cor: "text-success" },
  UPDATE: { label: "Alterou", cor: "text-warning" },
  DELETE: { label: "Excluiu", cor: "text-destructive" },
};

const ENTIDADES: Record<string, string> = {
  clients: "Cliente",
  tasks: "Tarefa",
  profiles: "Usuário",
  team_members: "Membro da equipe",
  salary_projections: "Projeção salarial",
  leads: "Lead",
  quote_requests: "Orçamento",
  internal_requests: "Requisição interna",
  client_team_assignments: "Alocação de equipe",
  client_recurring_services: "Serviço recorrente",
  client_pipelines: "Pipeline",
  payment_history: "Pagamento",
  settings: "Configuração",
  app_settings: "Configuração do app",
  registration_requests: "Solicitação de cadastro",
  client_briefings: "Briefing",
  client_dna: "DNA do cliente",
  onboarding_data: "Onboarding",
  weekly_reports: "Relatório semanal",
};

// Procura um rótulo legível dentro da linha; cai no id quando não encontra.
function rotulo(l: ChangeLog): string {
  const d = (l.new_data || l.old_data || {}) as Record<string, unknown>;
  for (const k of ["company", "title", "name", "username", "description"]) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return l.entity_id;
}

function valor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.trim() === "" ? "—" : s;
}

export default function AuditPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [aba, setAba] = useState<"atividade" | "tarefas">("atividade");
  const [changes, setChanges] = useState<ChangeLog[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q =
      aba === "atividade"
        ? (supabase as any)
            .from("change_log")
            .select("*")
            .order("changed_at", { ascending: false })
            .limit(300)
        : (supabase as any)
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(300);

    q.then(({ data, error }: any) => {
      if (error) console.error("Erro ao carregar auditoria:", error);
      if (aba === "atividade") setChanges(data || []);
      else setLogs(data || []);
      setLoading(false);
    });
  }, [aba]);

  // change_log guarda a linha inteira, incluindo salário e permissões.
  // A RLS libera só para admin; sem este aviso a aba pareceria vazia por bug.
  const aviso =
    aba === "atividade" && !currentUser?.isAdmin
      ? "A aba Atividade guarda a linha completa de cada registro, incluindo salários e permissões, por isso é restrita a administradores."
      : null;

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Toda escrita no banco — pela interface, por integração ou por rotina automática"
      />

      <div className="flex gap-1 mb-4 border-b">
        {(
          [
            ["atividade", "Atividade (completa)"],
            ["tarefas", "Histórico de tarefas"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              aba === k
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aviso && (
        <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted-foreground">
          {aviso}
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : aba === "tarefas" ? (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                <th className="text-left py-3 px-4 font-medium">Data/Hora</th>
                <th className="text-left py-3 px-4 font-medium">Usuário</th>
                <th className="text-left py-3 px-4 font-medium">Ação</th>
                <th className="text-left py-3 px-4 font-medium">Entidade</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum registro
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                      {format(new Date(log.created_at), "yyyy-MM-dd HH:mm", { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4 text-sm text-foreground">{log.user_name}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{log.action}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{log.entity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-muted/30">
                <th className="w-8" />
                <th className="text-left py-3 px-4 font-medium">Data/Hora</th>
                <th className="text-left py-3 px-4 font-medium">Quem</th>
                <th className="text-left py-3 px-4 font-medium">Ação</th>
                <th className="text-left py-3 px-4 font-medium">Registro</th>
                <th className="text-left py-3 px-4 font-medium">Campos alterados</th>
              </tr>
            </thead>
            <tbody>
              {changes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum registro
                  </td>
                </tr>
              ) : (
                changes.map((c) => {
                  const acao = ACOES[c.action] || { label: c.action, cor: "text-muted-foreground" };
                  const expandido = aberto === c.id;
                  const campos = (c.description || "").split(", ").filter(Boolean);
                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => setAberto(expandido ? null : c.id)}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="pl-3 text-muted-foreground">
                          {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {format(new Date(c.changed_at), "yyyy-MM-dd HH:mm", { locale: ptBR })}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground whitespace-nowrap">{c.changed_by}</td>
                        <td className={`py-3 px-4 text-sm font-medium whitespace-nowrap ${acao.cor}`}>
                          {acao.label}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          <span className="text-muted-foreground">
                            {ENTIDADES[c.entity_type] || c.entity_type}:{" "}
                          </span>
                          {rotulo(c)}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">{c.description || "—"}</td>
                      </tr>
                      {expandido && (
                        <tr className="bg-muted/20 border-b border-border/50">
                          <td colSpan={6} className="px-12 py-3">
                            {c.action === "UPDATE" && campos.length > 0 ? (
                              <table className="text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left pr-6 pb-1 font-medium">Campo</th>
                                    <th className="text-left pr-6 pb-1 font-medium">Antes</th>
                                    <th className="text-left pb-1 font-medium">Depois</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {campos.map((f) => (
                                    <tr key={f}>
                                      <td className="pr-6 py-0.5 font-mono text-foreground">{f}</td>
                                      <td className="pr-6 py-0.5 text-destructive">{valor(c.old_data?.[f])}</td>
                                      <td className="py-0.5 text-success">{valor(c.new_data?.[f])}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {JSON.stringify(c.new_data ?? c.old_data, null, 2)}
                              </pre>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
