// Lê as regras de validação de dados (listas suspensas) de uma aba e
// guarda, por coluna, as opções disponíveis em sm_sheet_tabs.col_validations.
// Body: { tab } (título da aba). Usa OAuth do Google Agenda.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getToken(db: any): Promise<string | null> {
  const { data: cal } = await db.from("google_calendar_connection").select("access_token, refresh_token, expires_at").eq("id", 1).maybeSingle();
  if (!cal?.refresh_token) return null;
  if (cal.access_token && cal.expires_at && new Date(cal.expires_at).getTime() > Date.now() + 60000) return cal.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: Deno.env.get("GOOGLE_CLIENT_ID")!, client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!, refresh_token: cal.refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) return null;
  const tok = await r.json();
  await db.from("google_calendar_connection").update({ access_token: tok.access_token, expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString() }).eq("id", 1);
  return tok.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { tab } = await req.json().catch(() => ({}));
    if (!tab) return json({ ok: false, reason: "missing_tab" }, 400);

    const { data: conn } = await db.from("sm_sheets_connection").select("spreadsheet_id").eq("id", 1).maybeSingle();
    const token = await getToken(db);
    if (!token) return json({ ok: false, reason: "oauth_nao_conectado" }, 400);

    const range = `'${String(tab).replace(/'/g, "''")}'`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${conn.spreadsheet_id}?ranges=${encodeURIComponent(range)}&includeGridData=true&fields=${encodeURIComponent("sheets(properties(title,sheetId),data(rowData(values(dataValidation))))")}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return json({ ok: false, reason: `api_error: ${(await r.text()).slice(0, 200)}` }, 502);
    const j = await r.json();

    const sheet = (j.sheets || [])[0];
    const rowData = sheet?.data?.[0]?.rowData || [];

    const colOptions: Record<number, string[]> = {};
    const colRange: Record<number, string> = {}; // colunas com lista por intervalo (ONE_OF_RANGE)

    for (const row of rowData) {
      const values = row.values || [];
      for (let c = 0; c < values.length; c++) {
        const cond = values[c]?.dataValidation?.condition;
        if (!cond) continue;
        if (cond.type === "ONE_OF_LIST" && Array.isArray(cond.values)) {
          const opts = cond.values.map((v: any) => v.userEnteredValue).filter((x: any) => typeof x === "string");
          if (opts.length > (colOptions[c]?.length || 0)) colOptions[c] = opts;
        } else if (cond.type === "ONE_OF_RANGE" && Array.isArray(cond.values) && cond.values[0]?.userEnteredValue) {
          colRange[c] = cond.values[0].userEnteredValue; // ex: "='CAPA REELS'!$A$2:$A$20"
        }
      }
    }

    // Resolve as listas por intervalo (busca os valores do range referenciado)
    const rangeCache: Record<string, string[]> = {};
    for (const cStr of Object.keys(colRange)) {
      const c = Number(cStr);
      if (colOptions[c]?.length) continue; // já tem lista inline
      const ref = colRange[c].replace(/^=/, "").replace(/\$/g, "");
      if (!(ref in rangeCache)) {
        try {
          const vUrl = `https://sheets.googleapis.com/v4/spreadsheets/${conn.spreadsheet_id}/values/${encodeURIComponent(ref)}?majorDimension=COLUMNS`;
          const vr = await fetch(vUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (vr.ok) {
            const vj = await vr.json();
            const flat = (vj.values || []).flat().map((x: any) => (x ?? "").toString().trim()).filter((x: string) => x);
            rangeCache[ref] = [...new Set(flat)];
          } else rangeCache[ref] = [];
        } catch { rangeCache[ref] = []; }
      }
      if (rangeCache[ref].length) colOptions[c] = rangeCache[ref];
    }

    // ── Augmentação por cabeçalho ──
    // Algumas colunas (CAPA REELS, QUANTIDADE DE POST) têm dropdown na planilha,
    // mas a API não expõe a validação. Aplicamos a lista-mestre de status + extras
    // identificando a coluna pelo nome do cabeçalho.
    let statusList: string[] = [];
    for (const k of Object.keys(colOptions)) if (colOptions[Number(k)].length > statusList.length) statusList = colOptions[Number(k)];

    if (statusList.length > 0) {
      const { data: tabRow } = await db.from("sm_sheet_tabs").select("id").eq("title", tab).maybeSingle();
      if (tabRow) {
        // procura a linha de cabeçalho (que contém "CAPA REELS")
        const { data: rowsHdr } = await db.from("sm_sheet_data").select("cells, row_index").eq("tab_id", tabRow.id).order("row_index").limit(5);
        const headerRow = (rowsHdr || []).find((r: any) => (r.cells || []).some((c: string) => /CAPA\s*REELS/i.test(c || "")))
          || (rowsHdr || [])[1] || (rowsHdr || [])[0];
        const headers: string[] = headerRow?.cells || [];
        const uniq = (arr: string[]) => [...new Set(arr)];
        headers.forEach((h, c) => {
          const H = (h || "").trim().toUpperCase();
          if (colOptions[c]?.length) return; // já tem
          if (/CAPA\s*REELS/.test(H)) {
            colOptions[c] = uniq([...statusList, "Postou 2x", "PRECISA", "NÃO PRECISA"]);
          } else if (/QUANTIDADE/.test(H)) {
            colOptions[c] = uniq(["3X", "5X", "2X", "7X", ...statusList]);
          }
        });
      }
    }

    // Salva em sm_sheet_tabs.col_validations
    const { error } = await db.from("sm_sheet_tabs").update({ col_validations: colOptions }).eq("title", tab);
    if (error) return json({ ok: false, reason: `db: ${error.message}` }, 500);

    return json({ ok: true, tab, columns_with_dropdown: Object.keys(colOptions).length, col_validations: colOptions });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
