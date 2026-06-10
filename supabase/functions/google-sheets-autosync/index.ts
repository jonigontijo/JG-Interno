// Sync inteligente Sheets → App.
// 1) Consulta o modifiedTime do arquivo no Drive (chamada barata).
// 2) Se mudou desde o último sync, dispara o mirror (lê todas as abas).
// Pensado para rodar via cron a cada 1 min e via polling do frontend.
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

    const { data: conn } = await db.from("sm_sheets_connection").select("spreadsheet_id, last_modified_time").eq("id", 1).maybeSingle();
    const spreadsheetId = conn?.spreadsheet_id;
    if (!spreadsheetId) return json({ ok: false, reason: "no_spreadsheet_id" }, 400);

    const token = await getToken(db);
    if (!token) return json({ ok: false, reason: "oauth_nao_conectado" }, 400);

    const force = (await req.json().catch(() => ({})))?.force === true;

    // 1) Tenta detectar mudança via Drive (barato). Se Drive API estiver desabilitada,
    //    cai no fallback: roda o mirror mesmo assim.
    let modifiedTime: string | null = null;
    let driveOk = false;
    try {
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=modifiedTime&supportsAllDrives=true`;
      const dr = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (dr.ok) { modifiedTime = (await dr.json()).modifiedTime; driveOk = true; }
    } catch { /* fallback abaixo */ }

    // Se o Drive funcionou e nada mudou → no-op rápido
    if (driveOk && !force && modifiedTime && modifiedTime === conn.last_modified_time) {
      return json({ ok: true, changed: false, modifiedTime });
    }

    // 2) Dispara o mirror (verify_jwt=false, chamada interna)
    const mirrorResp = await fetch(`${supabaseUrl}/functions/v1/google-sheets-mirror`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const mirror = await mirrorResp.json().catch(() => ({}));

    if (modifiedTime) await db.from("sm_sheets_connection").update({ last_modified_time: modifiedTime }).eq("id", 1);

    return json({ ok: true, changed: true, drive_enabled: driveOk, modifiedTime, mirror });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
