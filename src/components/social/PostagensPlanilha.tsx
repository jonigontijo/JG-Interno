import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Table2, Plus, Trash2 } from "lucide-react";
import { useAIPageContext } from "@/store/useAIContextStore";

interface SheetTab {
  id: string;
  gid: number | null;
  title: string;
  position: number;
  last_synced_at: string;
  col_validations: Record<string, string[]>;
}
interface SheetDataRow {
  id: string;
  row_index: number;
  cells: string[];
}

// Cores por status (aproxima o visual da planilha)
function statusClass(v: string): string {
  const t = (v || "").trim().toUpperCase();
  if (!t) return "";
  const map: Record<string, string> = {
    "OK": "bg-green-400/80 text-green-950",
    "POSTOU 2X": "bg-green-700 text-white",
    "ACABOU": "bg-red-300 text-red-950",
    "EM APROVAÇÃO": "bg-green-200 text-green-900",
    "TEM POST": "bg-purple-200 text-purple-900",
    "ELES POSTAM": "bg-teal-700 text-white",
    "AGUARDANDO APROVAÇÃO": "bg-yellow-900 text-yellow-100",
    "ALTERAÇÃO": "bg-orange-200 text-orange-900",
    "PRECISA PROGRAMAR": "bg-purple-700 text-white",
    "PRECISA DESENVOLVER": "bg-pink-600 text-white",
    "PROGRAMADO": "bg-blue-500 text-white",
    "PROGRMADO": "bg-blue-500 text-white",
    "NÃO POSTOU": "bg-red-700 text-white",
    "ESPERANDO INFORMAÇÕES": "bg-sky-300 text-sky-950",
    "VIDEO INTERCALADO": "bg-yellow-200 text-yellow-900",
    "PRECISA": "bg-yellow-100 text-yellow-900",
    "NÃO PRECISA": "bg-red-900 text-red-100",
    "3X": "bg-purple-700 text-white",
    "5X": "bg-amber-600 text-white",
    "2X": "bg-fuchsia-600 text-white",
    "7X": "bg-indigo-700 text-white",
  };
  if (map[t]) return map[t];
  if (t.includes("PROGRAM") && t.includes("PRECISA")) return "bg-purple-700 text-white";
  if (t.includes("PROGRAM")) return "bg-blue-500 text-white";
  if (t.includes("APROVA")) return "bg-yellow-900 text-yellow-100";
  if (t.includes("DESENVOLVER")) return "bg-pink-600 text-white";
  return "";
}

export default function PostagensPlanilha() {
  const [tabs, setTabs] = useState<SheetTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [rows, setRows] = useState<SheetDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [edit, setEdit] = useState<{ rowId: string; col: number } | null>(null);
  const [editVal, setEditVal] = useState("");
  const editingRef = useRef(false);
  useEffect(() => { editingRef.current = edit !== null; }, [edit]);

  const loadTabs = useCallback(async () => {
    const { data } = await supabase.from("sm_sheet_tabs").select("*").order("position");
    const t = (data as SheetTab[]) || [];
    setTabs(t);
    setActiveTab((prev) => prev || (t.find(x => x.title.includes("/"))?.id ?? t[0]?.id ?? null));
  }, []);

  const loadRows = useCallback(async (tabId: string) => {
    const { data } = await supabase.from("sm_sheet_data").select("id, row_index, cells").eq("tab_id", tabId).order("row_index");
    setRows((data as SheetDataRow[]) || []);
  }, []);

  useEffect(() => { (async () => { setLoading(true); await loadTabs(); setLoading(false); })(); }, [loadTabs]);
  useEffect(() => { if (activeTab) loadRows(activeTab); }, [activeTab, loadRows]);

  // Carrega as listas suspensas (validações) da aba ativa, se ainda não tiver
  useEffect(() => {
    const t = tabs.find(x => x.id === activeTab);
    if (!t) return;
    const has = t.col_validations && Object.keys(t.col_validations).length > 0;
    if (has) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("google-sheets-validations", { body: { tab: t.title } });
        if ((data as any)?.ok) {
          setTabs(prev => prev.map(x => x.id === t.id ? { ...x, col_validations: (data as any).col_validations || {} } : x));
        }
      } catch { /* silencioso */ }
    })();
  }, [activeTab, tabs]);

  // Realtime: reflete mudanças ao vivo
  useEffect(() => {
    if (!activeTab) return;
    const ch = supabase.channel(`sheet_data_${activeTab}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_sheet_data", filter: `tab_id=eq.${activeTab}` }, () => {
        if (!editingRef.current) loadRows(activeTab); // não recarrega enquanto edita
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTab, loadRows]);

  // Polling: puxa mudanças da planilha (Sheets → App) a cada 20s enquanto a aba está aberta.
  // O autosync só roda o sync pesado se a planilha realmente mudou (quando a Drive API está ativa).
  // Se detectar mudança, recarrega a grade na hora (não depende só do Realtime).
  useEffect(() => {
    const tick = async () => {
      if (editingRef.current || document.hidden) return;
      try {
        const { data } = await supabase.functions.invoke("google-sheets-autosync", { body: {} });
        if ((data as any)?.changed && activeTab && !editingRef.current) {
          await loadRows(activeTab);
        }
      } catch { /* silencioso */ }
    };
    const interval = setInterval(tick, 20000);
    return () => clearInterval(interval);
  }, [activeTab, loadRows]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-sheets-mirror", { body: {} });
      if (error) throw error;
      const r = data as { ok: boolean; tabs?: number; reason?: string };
      if (!r.ok) toast.error(`Sync falhou: ${r.reason}`);
      else toast.success(`Planilha sincronizada (${r.tabs} abas)`);
      await loadTabs();
      if (activeTab) await loadRows(activeTab);
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setSyncing(false); }
  };

  const startEdit = (rowId: string, col: number, current: string) => {
    setEdit({ rowId, col }); setEditVal(current ?? "");
  };

  // Salva em segundo plano (não bloqueia a navegação)
  const persistCell = (rowId: string, col: number, value: string) => {
    const tab = tabs.find(t => t.id === activeTab);
    const row = rows.find(r => r.id === rowId);
    if (!tab || !row) return;
    if ((row.cells[col] ?? "") === value) return; // sem mudança
    const newCells = [...row.cells];
    while (newCells.length <= col) newCells.push("");
    newCells[col] = value;
    const rowIndex = row.row_index;
    // atualização otimista na tela
    setRows(rs => rs.map(r => r.id === rowId ? { ...r, cells: newCells } : r));
    // persiste: PRIMEIRO na planilha (fonte da verdade), depois no banco (por row_index, estável)
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("google-sheets-cell-push", {
          body: { tab_title: tab.title, row_index: rowIndex, col_index: col, value },
        });
        if (!(data as any)?.ok) toast.warning(`Não refletiu na planilha: ${(data as any)?.reason || "verifique a conexão Google"}`);
        await supabase.from("sm_sheet_data").update({ cells: newCells, updated_in_app_at: new Date().toISOString() })
          .eq("tab_id", activeTab).eq("row_index", rowIndex);
      } catch (e: any) { toast.error(`Falha ao salvar: ${e?.message || e}`); }
    })();
  };

  // Confirma a edição atual e, opcionalmente, move para a próxima célula
  const commitEdit = (move?: "down" | "right" | "up" | "left") => {
    if (!edit) return;
    const { rowId, col } = edit;
    persistCell(rowId, col, editVal);
    if (!move) { setEdit(null); return; }
    const curRow = rows.find(r => r.id === rowId);
    if (!curRow) { setEdit(null); return; }
    if (move === "right" || move === "left") {
      const nextCol = move === "right" ? col + 1 : Math.max(0, col - 1);
      if (nextCol < maxCols) { startEdit(rowId, nextCol, (curRow.cells[nextCol] ?? "")); return; }
    } else {
      const nextIdx = move === "down" ? curRow.row_index + 1 : curRow.row_index - 1;
      const nextRow = rows.find(r => r.row_index === nextIdx);
      if (nextRow) { startEdit(nextRow.id, col, (nextRow.cells[col] ?? "")); return; }
    }
    setEdit(null);
  };

  const activeTabObj = tabs.find(t => t.id === activeTab);

  // Publica o conteúdo da aba ativa para a IA enxergar
  useAIPageContext(
    `Planilha de Postagens — aba "${activeTabObj?.title?.trim() || "?"}"`,
    {
      aba: activeTabObj?.title?.trim(),
      cabecalho: rows[1]?.cells || rows[0]?.cells || [],
      linhas: rows.slice(2, 60).map(r => r.cells),
    },
    [activeTab, rows.length],
  );

  const handleAddRow = async () => {
    if (!activeTabObj) return;
    setSyncing(true);
    try {
      const { data } = await supabase.functions.invoke("google-sheets-row-op", { body: { tab_title: activeTabObj.title, action: "append" } });
      if ((data as any)?.ok) { toast.success("Linha adicionada"); await loadRows(activeTabObj.id); }
      else toast.error(`Falha: ${(data as any)?.reason || "erro"}`);
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setSyncing(false); }
  };

  const handleDeleteRow = async (rowIndex: number) => {
    if (!activeTabObj) return;
    if (!confirm(`Excluir a linha ${rowIndex + 1} da planilha? Isso remove no Google Sheets também.`)) return;
    setSyncing(true);
    try {
      const { data } = await supabase.functions.invoke("google-sheets-row-op", { body: { tab_title: activeTabObj.title, action: "delete", row_index: rowIndex } });
      if ((data as any)?.ok) { toast.success("Linha excluída"); await loadRows(activeTabObj.id); }
      else toast.error(`Falha: ${(data as any)?.reason || "erro"}`);
    } catch (e: any) { toast.error(`Falha: ${e?.message || e}`); }
    finally { setSyncing(false); }
  };

  const maxCols = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);
  const headerRowIdx = rows.length > 1 ? 1 : 0; // 2ª linha costuma ter os títulos das colunas
  const activeColVals = tabs.find(t => t.id === activeTab)?.col_validations || {};

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <Table2 className="w-4 h-4 text-success" />
        <h2 className="text-sm font-semibold text-foreground">Planilha de Postagens</h2>
        <span className="text-[10px] text-muted-foreground">espelho do Google Sheets · clique numa célula para editar</span>
        <button onClick={handleAddRow} disabled={syncing || !activeTabObj}
          className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50">
          <Plus className="w-3 h-3" /> Adicionar linha
        </button>
        <button onClick={handleSync} disabled={syncing}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold hover:bg-muted disabled:opacity-50">
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sincronizar
        </button>
      </div>

      {loading ? (
        <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</div>
      ) : tabs.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma aba sincronizada. Clique em "Sincronizar".
        </div>
      ) : (
        <>
          {/* Grade */}
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-xs border-collapse">
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={row.id} className={ri <= headerRowIdx ? "sticky top-0 z-10" : ""}>
                    {/* número da linha + excluir */}
                    <td className="px-1 py-1 bg-muted/40 text-muted-foreground text-[10px] font-mono border border-border/40 sticky left-0 z-10 text-center select-none group/row">
                      <span className="group-hover/row:hidden">{row.row_index + 1}</span>
                      {ri > headerRowIdx ? (
                        <button onClick={() => handleDeleteRow(row.row_index)} title="Excluir linha"
                          className="hidden group-hover/row:inline-flex items-center justify-center text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="hidden group-hover/row:inline">{row.row_index + 1}</span>
                      )}
                    </td>
                    {Array.from({ length: maxCols }).map((_, ci) => {
                      const val = row.cells[ci] ?? "";
                      const isHeader = ri <= headerRowIdx;
                      const isEditing = edit?.rowId === row.id && edit?.col === ci;
                      const options = !isHeader ? activeColVals[String(ci)] : undefined;
                      const hasDropdown = Array.isArray(options) && options.length > 0;
                      return (
                        <td key={ci}
                          onClick={() => !isEditing && startEdit(row.id, ci, val)}
                          className={`px-2 py-1 border border-border/40 whitespace-nowrap cursor-pointer min-w-[80px] max-w-[260px] overflow-hidden text-ellipsis relative
                            ${isHeader ? "bg-primary/10 font-semibold text-foreground sticky" : statusClass(val)}`}
                          title={val}
                        >
                          {isEditing && hasDropdown ? (
                            <select autoFocus value={options!.includes(val) ? val : ""}
                              onChange={(e) => { persistCell(row.id, ci, e.target.value); setEdit(null); }}
                              onBlur={() => setEdit(null)}
                              onKeyDown={(e) => { if (e.key === "Escape") setEdit(null); }}
                              className="w-full min-w-[140px] px-1 py-0.5 rounded-sm border border-primary ring-1 ring-primary bg-background text-foreground text-xs outline-none">
                              <option value="">— vazio —</option>
                              {!options!.includes(val) && val && <option value={val}>{val}</option>}
                              {options!.map(o => <option key={o} value={o}>{o.trim()}</option>)}
                            </select>
                          ) : isEditing ? (
                            <input autoFocus value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => commitEdit()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commitEdit(e.shiftKey ? "up" : "down"); }
                                else if (e.key === "Tab") { e.preventDefault(); commitEdit(e.shiftKey ? "left" : "right"); }
                                else if (e.key === "Escape") { e.preventDefault(); setEdit(null); }
                              }}
                              className="w-full min-w-[120px] px-1 py-0.5 rounded-sm border border-primary ring-1 ring-primary bg-background text-foreground text-xs outline-none" />
                          ) : (
                            <span className="flex items-center justify-between gap-1">
                              <span className="truncate">{val}</span>
                              {hasDropdown && <span className="text-[8px] opacity-50 shrink-0">▼</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Abas (igual ao rodapé do Google Sheets) */}
          <div className="flex items-center gap-1 px-2 py-2 border-t bg-muted/20 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                {t.title.trim()}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
