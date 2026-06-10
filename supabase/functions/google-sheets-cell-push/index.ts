// Escreve uma célula editada no app de volta na planilha (app -> Sheets).
// Body: { tab_title, row_index (0-based), col_index (0-based), value }
// Usa a conexão OAuth do Google Agenda (scope spreadsheets).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function colLetter(n: number): string {
  let s = "";
  n = n + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
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

    const { tab_title, row_index, col_index, value } = await req.json().catch(() => ({}));
    if (!tab_title || row_index == null || col_index == null) {
      return json({ ok: false, reason: "missing_fields", required: ["tab_title", "row_index", "col_index"] }, 400);
    }

    const { data: conn } = await db.from("sm_sheets_connection").select("spreadsheet_id").eq("id", 1).maybeSingle();
    const token = await getToken(db);
    if (!token) return json({ ok: false, reason: "oauth_nao_conectado", hint: "reconecte o Google Agenda" }, 400);

    const a1 = `'${String(tab_title).replace(/'/g, "''")}'!${colLetter(col_index)}${row_index + 1}`;
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${conn.spreadsheet_id}/values/${encodeURIComponent(a1)}?valueInputOption=USER_ENTERED`;
    const r = await fetch(apiUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [[value ?? ""]] }),
    });
    if (!r.ok) return json({ ok: false, reason: `sheets_write_error: ${(await r.text()).slice(0, 200)}` }, 502);
    return json({ ok: true, cell: a1 });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
