// Recebe o redirect do Google OAuth com ?code=... e ?state=...
// Troca code -> tokens (access + refresh), busca o e-mail conectado e salva no banco.
// Tambem dispara o "watch" (webhook do Google -> google-calendar-webhook) e captura sync_token.
// Renderiza HTML que fecha a janela e avisa a janela pai via postMessage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CAL_API = "https://www.googleapis.com/calendar/v3";

function htmlPage(ok: boolean, message: string) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"/><title>Conex\u00e3o Google</title><style>body{font-family:system-ui;background:#0A0A0A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{max-width:480px;text-align:center;padding:32px;border:1px solid #1F1F1F;border-radius:12px;background:#0F0F0F}h1{margin:0 0 8px;font-size:18px;color:${ok ? "#FBBF24" : "#EF4444"}}p{margin:8px 0;color:#aaa;font-size:13px}</style></head><body><div class="box"><h1>${ok ? "Conta Google conectada" : "Falha ao conectar"}</h1><p>${message}</p><p style="font-size:11px;color:#666">Voc\u00ea pode fechar esta janela.</p></div><script>try{window.opener&&window.opener.postMessage({type:"google-oauth-callback",ok:${ok}},"*");setTimeout(function(){window.close()},1200);}catch(e){}</script></body></html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return new Response(htmlPage(false, `Google retornou: ${error}`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (!code) return new Response(htmlPage(false, "Codigo de autorizacao ausente."), { headers: { "Content-Type": "text/html; charset=utf-8" } });

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
      return new Response(htmlPage(false, `Token exchange falhou: ${txt}`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
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

    // sync_token inicial via events.list (com nextSyncToken vindo no final).
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

    // Le conexao atual para preservar refresh_token caso o Google nao reenvie.
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
    if (upsertErr) {
      return new Response(htmlPage(false, `Falha ao salvar: ${upsertErr.message}`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response(htmlPage(true, `Conta ${googleEmail || ""} conectada com sucesso. Sincroniza\u00e7\u00e3o ativa.`), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    return new Response(htmlPage(false, `Erro: ${String(e?.message || e)}`), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});
