// Devolve o status da conexao Google Calendar para a UI.
// Nao expoe tokens, apenas informacoes seguras: email conectado, ultima sync, configurado ou nao.
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: conn } = await db.from("google_calendar_connection").select("google_email, connected_at, calendar_id, updated_at, refresh_token, sync_token").eq("id", 1).maybeSingle();

    const connected = !!conn?.refresh_token;
    return new Response(JSON.stringify({
      connected,
      google_email: conn?.google_email || null,
      calendar_id: conn?.calendar_id || null,
      connected_at: conn?.connected_at || null,
      last_sync_token_at: conn?.updated_at || null,
      has_sync_token: !!conn?.sync_token,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
