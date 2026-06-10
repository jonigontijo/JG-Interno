// Recebe o redirect do Google OAuth (Sheets), troca code -> tokens e salva em sm_sheets_connection.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function decodeState(state: string | null): { origin: string } {
  if (!state) return { origin: "" };
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((state.length + 3) % 4);
    const parsed = JSON.parse(atob(padded));
    const o = typeof parsed?.o === "string" && parsed.o.startsWith("http") ? parsed.o : "";
    return { origin: o };
  } catch { return { origin: "" }; }
}

function buildRedirect(origin: string, ok: boolean, params: Record<string, string>): Response {
  const sp = new URLSearchParams({ ok: ok ? "1" : "0", ...params });
  if (origin) {
    return new Response(null, { status: 302, headers: { Location: `${origin.replace(/\/+$/, "")}/oauth-callback.html?${sp.toString()}`, "Cache-Control": "no-store" } });
  }
  return new Response(JSON.stringify({ ok, ...params }), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const { origin } = decodeState(url.searchParams.get("state"));

  if (error) return buildRedirect(origin, false, { reason: `Google: ${error}` });
  if (!code) return buildRedirect(origin, false, { reason: "código ausente" });

  try {
    const clientId = Deno.env.get("GOOGLE_SHEETS_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_SHEETS_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_SHEETS_REDIRECT_URI")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const tr = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    if (!tr.ok) return buildRedirect(origin, false, { reason: `token: ${(await tr.text()).slice(0, 150)}` });
    const tok = await tr.json();

    const uir = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const userinfo = uir.ok ? await uir.json() : {};

    const { data: existing } = await db.from("sm_sheets_connection").select("refresh_token").eq("id", 1).maybeSingle();
    const finalRefresh = tok.refresh_token || existing?.refresh_token || null;

    const { error: upErr } = await db.from("sm_sheets_connection").upsert({
      id: 1,
      google_email: userinfo.email || null,
      access_token: tok.access_token,
      refresh_token: finalRefresh,
      expires_at: new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (upErr) return buildRedirect(origin, false, { reason: `save: ${upErr.message}` });

    return buildRedirect(origin, true, { email: userinfo.email || "" });
  } catch (e) {
    return buildRedirect(origin, false, { reason: String((e as Error)?.message || e).slice(0, 150) });
  }
});
