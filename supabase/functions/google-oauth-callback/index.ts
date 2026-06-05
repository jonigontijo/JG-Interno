// Recebe o redirect do Google OAuth com ?code=... e ?state=...
// Troca code -> tokens (access + refresh), busca o e-mail conectado e salva no banco.
// No final faz 302 redirect para <origin>/oauth-callback.html (extraido do state)
// porque o gateway do Supabase reescreve Content-Type para text/plain em respostas HTML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CAL_API = "https://www.googleapis.com/calendar/v3";

function decodeState(state: string | null): { origin: string } {
  if (!state) return { origin: "" };
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((state.length + 3) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json);
    const o = typeof parsed?.o === "string" && parsed.o.startsWith("http") ? parsed.o : "";
    return { origin: o };
  } catch {
    return { origin: "" };
  }
}

function buildRedirect(origin: string, ok: boolean, params: Record<string, string>): Response {
  // Fallback: se nao temos origin (ex: state corrompido), usa um data URL com HTML minimo.
  const targetBase = origin || "";
  const sp = new URLSearchParams({ ok: ok ? "1" : "0", ...params });
  if (targetBase) {
    const url = `${targetBase.replace(/\/+$/, "")}/oauth-callback.html?${sp.toString()}`;
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  }
  // Sem origin: devolve JSON (porque o gateway aceita JSON corretamente).
  return new Response(JSON.stringify({ ok, ...params, note: "origin_ausente_no_state" }), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const { origin } = decodeState(state);

  if (error) return buildRedirect(origin, false, { reason: `Google retornou: ${error}` });
  if (!code) return buildRedirect(origin, false, { reason: "Codigo de autorizacao ausente." });

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const tokenBody = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tr = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });
    if (!tr.ok) {
      const txt = await tr.text();
      return buildRedirect(origin, false, { reason: `Token exchange falhou: ${txt.slice(0, 200)}` });
    }
    const tok = await tr.json();
    const accessToken: string = tok.access_token;
    const refreshToken: string | undefined = tok.refresh_token;
    const expiresIn: number = tok.expires_in;

    const uir = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userinfo = uir.ok ? await uir.json() : {};
    const googleEmail: string | null = userinfo.email || null;

    let syncToken: string | null = null;
    try {
      let pageToken: string | undefined = undefined;
      do {
        const listUrl = new URL(`${GOOGLE_CAL_API}/calendars/primary/events`);
        listUrl.searchParams.set("singleEvents", "true");
        listUrl.searchParams.set("maxResults", "2500");
        listUrl.searchParams.set("timeMin", new Date().toISOString());
        if (pageToken) listUrl.searchParams.set("pageToken", pageToken);
        const r = await fetch(listUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!r.ok) break;
        const j = await r.json();
        pageToken = j.nextPageToken;
        if (j.nextSyncToken) syncToken = j.nextSyncToken;
      } while (pageToken);
    } catch { /* ignore */ }

    const { data: existing } = await db.from("google_calendar_connection").select("*").eq("id", 1).maybeSingle();
    const finalRefreshToken = refreshToken || existing?.refresh_token || null;

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const upsertPayload = {
      id: 1,
      google_email: googleEmail,
      access_token: accessToken,
      refresh_token: finalRefreshToken,
      expires_at: expiresAt,
      calendar_id: "primary",
      sync_token: syncToken,
      connected_at: new Date().toISOString(),
    };
    const { error: upsertErr } = await db.from("google_calendar_connection").upsert(upsertPayload, { onConflict: "id" });
    if (upsertErr) return buildRedirect(origin, false, { reason: `Falha ao salvar: ${upsertErr.message}` });

    return buildRedirect(origin, true, { email: googleEmail || "" });
  } catch (e) {
    return buildRedirect(origin, false, { reason: String(e?.message || e).slice(0, 200) });
  }
});
