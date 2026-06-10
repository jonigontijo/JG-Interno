// Status da integração Google Sheets para a UI (sem expor tokens).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: conn } = await db.from("sm_sheets_connection")
      .select("spreadsheet_id, sheet_range, last_synced_at, channel_expires_at")
      .eq("id", 1).maybeSingle();

    // O OAuth é o mesmo do Google Agenda
    const { data: cal } = await db.from("google_calendar_connection")
      .select("google_email, refresh_token, connected_at").eq("id", 1).maybeSingle();

    const { count } = await db.from("sm_sheet_clients").select("*", { count: "exact", head: true });

    return new Response(JSON.stringify({
      connected_oauth: !!cal?.refresh_token,
      google_email: cal?.google_email || null,
      spreadsheet_id: conn?.spreadsheet_id || null,
      sheet_range: conn?.sheet_range || null,
      connected_at: cal?.connected_at || null,
      last_synced_at: conn?.last_synced_at || null,
      realtime_watch_active: !!conn?.channel_expires_at && new Date(conn.channel_expires_at).getTime() > Date.now(),
      rows_count: count || 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
