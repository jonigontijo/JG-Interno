// Revoga o refresh_token no Google e limpa a conexao no banco.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: conn } = await db.from("google_calendar_connection").select("refresh_token").eq("id", 1).maybeSingle();
    if (conn?.refresh_token) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(conn.refresh_token), { method: "POST" });
      } catch { /* ignore */ }
    }
    await db.from("google_calendar_connection").update({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      sync_token: null,
      google_email: null,
    }).eq("id", 1);
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
