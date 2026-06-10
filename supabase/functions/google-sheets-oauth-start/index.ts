// Gera a URL de autorização OAuth para conectar a conta Google com acesso a Sheets + Drive.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",       // ler + escrever planilhas
  "https://www.googleapis.com/auth/drive.metadata.readonly", // files.watch (realtime)
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization") || "";
    const sb = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const clientId = Deno.env.get("GOOGLE_SHEETS_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_SHEETS_REDIRECT_URI");
    if (!clientId || !redirectUri) return new Response(JSON.stringify({ error: "missing_google_sheets_env" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const origin = (body && typeof body.origin === "string" && body.origin.startsWith("http")) ? body.origin : "";
    const statePayload = JSON.stringify({ n: crypto.randomUUID(), o: origin });
    const state = btoa(statePayload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    });
    return new Response(JSON.stringify({ url: `${GOOGLE_AUTH_URL}?${params.toString()}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
