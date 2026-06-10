// Operações de linha na planilha (app -> Sheets):
//   - "insert": insere uma linha em branco no índice (0-based)
//   - "delete": exclui a linha no índice
//   - "append": adiciona uma linha no fim da aba (com valores opcionais)
// Após a operação, re-espelha a aba para atualizar os índices no banco.
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

    const { tab_title, action, row_index, values } = await req.json().catch(() => ({}));
    if (!tab_title || !action) return json({ ok: false, reason: "missing_fields", required: ["tab_title", "action"] }, 400);

    const { data: conn } = await db.from("sm_sheets_connection").select("spreadsheet_id").eq("id", 1).maybeSingle();
    const token = await getToken(db);
    if (!token) return json({ ok: false, reason: "oauth_nao_conectado" }, 400);
    const spreadsheetId = conn.spreadsheet_id;

    const { data: tab } = await db.from("sm_sheet_tabs").select("gid").eq("title", tab_title).maybeSingle();

    if (action === "append") {
      const range = `'${String(tab_title).replace(/'/g, "''")}'`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const r = await fetch(url, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [Array.isArray(values) ? values : [""]] }),
      });
      if (!r.ok) return json({ ok: false, reason: `append_error: ${(await r.text()).slice(0, 200)}` }, 502);
    } else if (action === "insert" || action === "delete") {
      if (tab?.gid == null) return json({ ok: false, reason: "gid_nao_encontrado" }, 400);
      if (row_index == null) return json({ ok: false, reason: "row_index_required" }, 400);
      const dim = {
        sheetId: tab.gid, dimension: "ROWS",
        startIndex: row_index, endIndex: row_index + 1,
      };
      const request = action === "insert"
        ? { insertDimension: { range: dim, inheritFromBefore: row_index > 0 } }
        : { deleteDimension: { range: dim } };
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const r = await fetch(url, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [request] }),
      });
      if (!r.ok) return json({ ok: false, reason: `batchupdate_error: ${(await r.text()).slice(0, 200)}` }, 502);
    } else {
      return json({ ok: false, reason: "invalid_action", allowed: ["insert", "delete", "append"] }, 400);
    }

    // Re-espelha a aba para atualizar índices/linhas no banco
    const mResp = await fetch(`${supabaseUrl}/functions/v1/google-sheets-mirror`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tab: tab_title }),
    });
    const mirror = await mResp.json().catch(() => ({}));

    return json({ ok: true, action, mirror });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
