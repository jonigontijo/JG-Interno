// Escreve uma linha (ou todas) do banco de volta na planilha (app -> Sheets).
// Body: { row_index?: number }  — se ausente, sincroniza todas as linhas com updated_in_app_at.
// Requer OAuth conectado (sm_sheets_connection.refresh_token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Usa a MESMA conexão OAuth do Google Agenda (google_calendar_connection).
async function getAccessToken(db: any): Promise<string | null> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: conn } = await db.from("sm_sheets_connection").select("*").eq("id", 1).maybeSingle();
    const token = await getAccessToken(db);
    if (!token) return json({ ok: false, reason: "oauth_nao_conectado", hint: "reconecte o Google Agenda para conceder acesso ao Sheets" }, 400);

    const body = await req.json().catch(() => ({}));
    const spreadsheetId = conn.spreadsheet_id;
    const sheetPrefix = conn.sheet_name ? `${conn.sheet_name}!` : "";

    // Seleciona linhas a escrever
    let query = db.from("sm_sheet_clients").select("*");
    if (body.row_index) query = query.eq("row_index", body.row_index);
    const { data: rows } = await query;
    if (!rows || rows.length === 0) return json({ ok: true, written: 0, note: "nada para escrever" });

    let written = 0;
    for (const row of rows) {
      // linha na planilha = row_index + 1 (cabeçalho na linha 1)
      const sheetRow = row.row_index + 1;
      const range = `${sheetPrefix}A${sheetRow}:E${sheetRow}`;
      const values = [[row.cliente || "", row.quantidade_post || "", row.segmento || "", row.instagram || "", row.senhas || ""]];
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
      const r = await fetch(apiUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (r.ok) {
        written++;
        await db.from("sm_sheet_clients").update({ updated_in_app_at: null }).eq("id", row.id);
      }
    }
    return json({ ok: true, written });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
