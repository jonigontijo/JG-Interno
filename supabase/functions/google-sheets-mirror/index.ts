// Espelha TODAS as abas da planilha (POSTAGENS JG) em sm_sheet_tabs + sm_sheet_data.
// Usa a conexão OAuth do Google Agenda (google_calendar_connection) com scope spreadsheets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getToken(db: any): Promise<string | null> {
  const { data: cal } = await db.from("google_calendar_connection")
    .select("access_token, refresh_token, expires_at").eq("id", 1).maybeSingle();
  if (!cal?.refresh_token) return null;
  if (cal.access_token && cal.expires_at && new Date(cal.expires_at).getTime() > Date.now() + 60000) return cal.access_token;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, refresh_token: cal.refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) return null;
  const tok = await r.json();
  await db.from("google_calendar_connection").update({ access_token: tok.access_token, expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString() }).eq("id", 1);
  return tok.access_token;
}

function hashRow(cells: string[]): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(cells)))).slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: conn } = await db.from("sm_sheets_connection").select("spreadsheet_id").eq("id", 1).maybeSingle();
    const spreadsheetId = conn?.spreadsheet_id;
    if (!spreadsheetId) return json({ ok: false, reason: "no_spreadsheet_id" }, 400);

    const token = await getToken(db);
    if (!token) return json({ ok: false, reason: "oauth_nao_conectado", hint: "reconecte o Google Agenda" }, 400);

    // 1) Lista as abas
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))`;
    const metaR = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaR.ok) return json({ ok: false, reason: `meta_error: ${(await metaR.text()).slice(0, 200)}` }, 502);
    const meta = await metaR.json();
    const sheets = (meta.sheets || []).map((s: any) => s.properties);

    const body = await req.json().catch(() => ({}));
    const onlyTab: string | null = body.tab || null; // opcional: espelhar só uma aba

    const tabResults: any[] = [];
    const seenTitles: string[] = [];

    for (const sp of sheets) {
      const title = sp.title;
      if (onlyTab && title !== onlyTab) continue;
      seenTitles.push(title);

      // 2) Lê os valores da aba
      const range = `'${title.replace(/'/g, "''")}'`;
      const valUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
      const valR = await fetch(valUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!valR.ok) { tabResults.push({ tab: title, error: `${valR.status}` }); continue; }
      const valJ = await valR.json();
      const rows: string[][] = valJ.values || [];

      // 3) Upsert da aba
      const { data: tab } = await db.from("sm_sheet_tabs").upsert({
        gid: sp.sheetId,
        title,
        position: sp.index ?? 0,
        col_count: sp.gridProperties?.columnCount ?? 0,
        row_count: rows.length,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "title" }).select("id").maybeSingle();
      if (!tab) { tabResults.push({ tab: title, error: "tab_upsert_failed" }); continue; }

      // 4) Diff-based (não-destrutivo): só atualiza linhas que mudaram.
      //    Mantém os IDs estáveis (não quebra edições em andamento no app).
      const { data: existing } = await db.from("sm_sheet_data").select("row_index, source_hash").eq("tab_id", tab.id);
      const exMap = new Map((existing || []).map((e: any) => [e.row_index, e.source_hash]));

      const toUpsert: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].map((c) => (c ?? "").toString());
        const h = hashRow(cells);
        if (exMap.get(i) === h) continue; // sem mudança
        toUpsert.push({ tab_id: tab.id, row_index: i, cells, source_hash: h });
      }

      let insErr: string | null = null;
      for (let i = 0; i < toUpsert.length; i += 500) {
        const { error: e } = await db.from("sm_sheet_data").upsert(toUpsert.slice(i, i + 500), { onConflict: "tab_id,row_index" });
        if (e) { insErr = e.message; break; }
      }

      // remove linhas que sumiram da planilha
      const toDelete = (existing || []).map((e: any) => e.row_index).filter((ri: number) => ri >= rows.length);
      if (toDelete.length > 0) await db.from("sm_sheet_data").delete().eq("tab_id", tab.id).in("row_index", toDelete);

      tabResults.push({ tab: title, rows: rows.length, changed: toUpsert.length, deleted: toDelete.length, error: insErr });
    }

    // remove abas que sumiram (só em sync completo)
    if (!onlyTab) {
      const { data: allTabs } = await db.from("sm_sheet_tabs").select("id, title");
      const gone = (allTabs || []).filter((t: any) => !seenTitles.includes(t.title));
      for (const g of gone) await db.from("sm_sheet_tabs").delete().eq("id", g.id);
    }

    await db.from("sm_sheets_connection").update({ last_synced_at: new Date().toISOString() }).eq("id", 1);
    return json({ ok: true, tabs: tabResults.length, details: tabResults });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
