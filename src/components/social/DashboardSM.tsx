// ============================================================================
// Dashboard de Social Media — clientes críticos a partir da planilha de postagens.
//
// A última coluna da planilha (TOTAL) = nº de posts que faltam para fechar o mês.
// A frequência (3x ou 5x por semana) vem do cadastro do cliente (socialMediaPosts).
//
// Regras de criticidade (definidas pela operação):
//   > 25            → ATRASADO (crítico), qualquer frequência
//   20–25           → 5x: OK · 3x: ATRASADO (crítico)
//   12–20           → 5x: OK · 3x: ATENÇÃO (entre ok e crítico)
//   < 12            → OK (todos)
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { useAIPageContext } from "@/store/useAIContextStore";
import { resolveClient, norm } from "@/lib/aiActions";
import { Loader2, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, TrendingDown, HelpCircle } from "lucide-react";

interface SheetTab { id: string; title: string; position: number; }
interface SheetDataRow { id: string; row_index: number; cells: string[]; }

type Severity = "atrasado" | "atencao" | "ok" | "sem_dado";

interface ClientAnalysis {
  nome: string;
  total: number | null;     // posts faltando no mês
  freq: number | null;      // posts/semana do cadastro
  tier: "5x" | "3x" | "?";  // faixa de frequência
  matchedCompany: string | null;
  severity: Severity;
}

const MONTHS_PT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function classify(total: number | null, tier: "5x" | "3x" | "?"): Severity {
  if (total == null || !Number.isFinite(total)) return "sem_dado";
  if (total > 25) return "atrasado";
  // tier "?" (frequência não encontrada) usa a regra mais conservadora (3x)
  const high = tier === "5x";
  if (total >= 20) return high ? "ok" : "atrasado";
  if (total >= 12) return high ? "ok" : "atencao";
  return "ok";
}

const SEV = {
  atrasado: { label: "Atrasado", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30", ring: "ring-destructive", dot: "bg-destructive", Icon: AlertTriangle },
  atencao: { label: "Atenção", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", ring: "ring-warning", dot: "bg-warning", Icon: AlertCircle },
  ok: { label: "Ok", color: "text-success", bg: "bg-success/10", border: "border-success/30", ring: "ring-success", dot: "bg-success", Icon: CheckCircle2 },
  sem_dado: { label: "Sem dado", color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", ring: "ring-muted-foreground", dot: "bg-muted-foreground", Icon: HelpCircle },
} as const;

export default function DashboardSM() {
  const clients = useAppStore((s) => s.clients);
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [rows, setRows] = useState<SheetDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Severity | "all">("all"); // filtro pelos balões

  // só abas de mês (têm "/" no título, ex.: "JUNHO/26")
  const monthTabs = useMemo(() => tabs.filter((t) => t.title.includes("/")), [tabs]);

  const loadTabs = useCallback(async () => {
    const { data } = await supabase.from("sm_sheet_tabs").select("id, title, position").order("position");
    const t = (data as SheetTab[]) || [];
    setTabs(t);
    setSelectedTab((prev) => {
      if (prev && t.some((x) => x.id === prev)) return prev;
      const months = t.filter((x) => x.title.includes("/"));
      const cur = MONTHS_PT[new Date().getMonth()];
      return (months.find((x) => norm(x.title).startsWith(cur))?.id) || months[months.length - 1]?.id || t[0]?.id || null;
    });
  }, []);

  const loadRows = useCallback(async (tabId: string) => {
    const { data } = await supabase.from("sm_sheet_data").select("id, row_index, cells").eq("tab_id", tabId).order("row_index");
    setRows((data as SheetDataRow[]) || []);
  }, []);

  useEffect(() => { (async () => { setLoading(true); await loadTabs(); setLoading(false); })(); }, [loadTabs]);
  useEffect(() => { if (selectedTab) loadRows(selectedTab); }, [selectedTab, loadRows]);

  // realtime: reflete edições da planilha ao vivo
  useEffect(() => {
    if (!selectedTab) return;
    const ch = supabase.channel(`dash_sheet_${selectedTab}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_sheet_data", filter: `tab_id=eq.${selectedTab}` }, () => loadRows(selectedTab))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedTab, loadRows]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("google-sheets-autosync", { body: {} }).catch(() => {});
      await loadTabs();
      if (selectedTab) await loadRows(selectedTab);
    } finally { setRefreshing(false); }
  };

  // localiza as colunas CLIENTES e TOTAL nas linhas de cabeçalho (índices 0 e 1)
  const { clientesCol, totalCol, maxCols } = useMemo(() => {
    const maxCols = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
    const headerRows = rows.filter((r) => r.row_index <= 1);
    let clientesCol = -1, totalCol = -1;
    for (const hr of headerRows) {
      hr.cells.forEach((c, i) => {
        const n = norm(c);
        if (clientesCol < 0 && n === "clientes") clientesCol = i;
        if (totalCol < 0 && n === "total") totalCol = i;
      });
    }
    if (clientesCol < 0) clientesCol = 1;          // fallback: 2ª coluna
    if (totalCol < 0) totalCol = Math.max(0, maxCols - 1); // fallback: última coluna
    return { clientesCol, totalCol, maxCols };
  }, [rows]);

  const analysis = useMemo<ClientAnalysis[]>(() => {
    const dataRows = rows.filter((r) => r.row_index >= 2 && (r.cells[clientesCol] || "").trim());
    return dataRows.map((r) => {
      const nome = (r.cells[clientesCol] || "").trim();
      const raw = (r.cells[totalCol] || "").replace(/[^\d-]/g, "");
      const total = raw === "" ? null : parseInt(raw, 10);
      const client = resolveClient(clients as any, nome);
      const freq = client?.socialMediaPosts ?? null;
      const tier: "5x" | "3x" | "?" = freq == null || freq === 0 ? "?" : (freq >= 5 ? "5x" : "3x");
      return { nome, total, freq, tier, matchedCompany: client?.company ?? null, severity: classify(total, tier) };
    });
  }, [rows, clientesCol, totalCol, clients]);

  const atrasados = analysis.filter((a) => a.severity === "atrasado").sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const atencao = analysis.filter((a) => a.severity === "atencao").sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  const oks = analysis.filter((a) => a.severity === "ok");
  const semDado = analysis.filter((a) => a.severity === "sem_dado");

  const activeTabTitle = tabs.find((t) => t.id === selectedTab)?.title?.trim();

  useAIPageContext(
    `Dashboard Social Media — clientes críticos (aba ${activeTabTitle || "?"})`,
    {
      aba: activeTabTitle,
      criticos_atrasados: atrasados.map((a) => ({ cliente: a.nome, posts_faltando: a.total, frequencia: a.tier })),
      atencao: atencao.map((a) => ({ cliente: a.nome, posts_faltando: a.total, frequencia: a.tier })),
      total_clientes: analysis.length,
    },
    [selectedTab, analysis.length, atrasados.length],
  );

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando planilha...</div>;
  }
  if (monthTabs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhuma aba de mês encontrada na planilha. Vá em <span className="font-medium text-foreground">Planilha</span> e clique em "Sincronizar".
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho: seletor de mês + refresh + legenda */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedTab || ""}
          onChange={(e) => setSelectedTab(e.target.value)}
          className="h-9 px-3 rounded-md border bg-background text-sm text-foreground"
        >
          {monthTabs.map((t) => <option key={t.id} value={t.id}>{t.title.trim()}</option>)}
        </select>
        <button onClick={refresh} disabled={refreshing}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-muted disabled:opacity-50">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Atualizar
        </button>
        <span className="text-[11px] text-muted-foreground ml-auto">
          Posts faltando no mês · &gt;25 atrasado · 20–25 (3x atrasado / 5x ok) · 12–20 (3x atenção / 5x ok) · &lt;12 ok
        </span>
      </div>

      {/* Cards de resumo — clicáveis, funcionam como filtro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard sev="atrasado" count={atrasados.length} caption="Atrasados / críticos" active={filter === "atrasado"} onClick={() => setFilter((f) => f === "atrasado" ? "all" : "atrasado")} />
        <SummaryCard sev="atencao" count={atencao.length} caption="Em atenção" active={filter === "atencao"} onClick={() => setFilter((f) => f === "atencao" ? "all" : "atencao")} />
        <SummaryCard sev="ok" count={oks.length} caption="Em dia" active={filter === "ok"} onClick={() => setFilter((f) => f === "ok" ? "all" : "ok")} />
        <button onClick={() => setFilter("all")}
          className={`text-left rounded-lg border bg-card p-3 transition-all hover:brightness-110 ${filter === "all" ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/40" : ""}`}>
          <div className="flex items-center gap-1.5 text-muted-foreground"><TrendingDown className="w-4 h-4" /><span className="text-2xl font-bold text-foreground">{analysis.length}</span></div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{filter === "all" ? "Todos os clientes" : "Ver todos"}</p>
        </button>
      </div>

      {/* Seções conforme o filtro selecionado nos balões */}
      {(filter === "all" || filter === "atrasado") && (
        <Section title="Atrasados / críticos" sev="atrasado" items={atrasados} empty="Nenhum cliente atrasado 🎉" />
      )}
      {(filter === "all" || filter === "atencao") && (
        <Section title="Em atenção" sev="atencao" items={atencao} empty="Nenhum cliente em atenção." />
      )}
      {filter === "ok" && (
        <Section title="Em dia" sev="ok" items={oks} empty="Nenhum cliente em dia." />
      )}
      {semDado.length > 0 && (filter === "all" || filter === "sem_dado") && (
        <Section title="Sem dado de posts" sev="sem_dado" items={semDado} empty="" />
      )}

      {/* Frequência não identificada (aviso de matching) */}
      {analysis.some((a) => a.tier === "?") && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" /> Alguns clientes não foram encontrados no cadastro (frequência "?"). Para esses, assumimos a regra de 3x/semana (mais conservadora).
        </p>
      )}

      {/* Tabela completa (todos) */}
      <details className="rounded-lg border bg-card overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-foreground bg-muted/30 select-none">
          Ver todos os clientes ({analysis.length})
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b bg-muted/20">
                <th className="text-left py-2 px-4 font-medium">Cliente</th>
                <th className="text-left py-2 px-4 font-medium">Posts faltando</th>
                <th className="text-left py-2 px-4 font-medium">Frequência</th>
                <th className="text-left py-2 px-4 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {[...atrasados, ...atencao, ...oks, ...semDado].map((a, i) => {
                const s = SEV[a.severity];
                return (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-4 text-foreground">
                      {a.nome}
                      {a.matchedCompany && norm(a.matchedCompany) !== norm(a.nome) && (
                        <span className="text-[10px] text-muted-foreground ml-1">({a.matchedCompany})</span>
                      )}
                    </td>
                    <td className="py-2 px-4 font-mono text-foreground">{a.total ?? "—"}</td>
                    <td className="py-2 px-4">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.tier === "?" ? "?" : `${a.tier}/sem`}</span>
                    </td>
                    <td className="py-2 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function SummaryCard({ sev, count, caption, active, onClick }: { sev: Severity; count: number; caption: string; active: boolean; onClick: () => void }) {
  const s = SEV[sev];
  return (
    <button onClick={onClick}
      className={`text-left rounded-lg border ${s.border} ${s.bg} p-3 transition-all hover:brightness-110 ${active ? `ring-2 ring-offset-1 ring-offset-background ${s.ring}` : ""}`}>
      <div className="flex items-center gap-1.5">
        <s.Icon className={`w-4 h-4 ${s.color}`} />
        <span className={`text-2xl font-bold ${s.color}`}>{count}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{caption}{active ? " · filtrando" : ""}</p>
    </button>
  );
}

function Section({ title, sev, items, empty }: { title: string; sev: Severity; items: ClientAnalysis[]; empty: string }) {
  const s = SEV[sev];
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${s.color}`}>
        <s.Icon className="w-4 h-4" /> {title} <span className="text-muted-foreground font-normal">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map((a, i) => (
            <div key={i} className={`rounded-lg border ${s.border} ${s.bg} p-3`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-tight">{a.nome}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 text-muted-foreground shrink-0">{a.tier === "?" ? "freq ?" : `${a.tier}/sem`}</span>
              </div>
              <div className="flex items-end gap-1 mt-2">
                <span className={`text-2xl font-bold ${s.color}`}>{a.total ?? "—"}</span>
                <span className="text-[11px] text-muted-foreground mb-1">posts faltando</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
