// Supabase Edge Function (JG Interno) — POST /functions/v1/notify-app
// ============================================================
// Emite um evento DIRETO para o app do cliente (JG App), sem n8n.
// Mantém o segredo do JG App no servidor (env), nunca no front.
// Frontend (logado) chama após uma ação de domínio. Contrato:
// docs EVENTOS_INTEGRACAO_APP.md.
//
// Deploy: supabase functions deploy notify-app   (verify_jwt = true, ver config.toml)
// Secrets (setar uma vez):
//   supabase secrets set \
//     JG_APP_EVENTS_URL=https://ieekdxxmhkbslskgxbdg.supabase.co/functions/v1/eventos-receber \
//     JG_APP_EVENTS_SECRET=<EVENTOS_API_SECRET do JG App>
//
// Body: { evento, cliente_id_externo, data, notificacao? }
//   evento            ex: "producao.criada"
//   cliente_id_externo id do cliente como o JG App resolve (X-Client-ID)
//   data              payload do evento (campos do contrato)
//   notificacao?      { titulo, mensagem } — sobrescreve o default do JG App
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// POST com retry (rede / 5xx). 4xx não retenta (erro de contrato).
async function postComRetry(url: string, headers: Record<string, string>, body: string, tentativas = 3) {
  let ultimoErro = "";
  for (let i = 1; i <= tentativas; i++) {
    try {
      const resp = await fetch(url, { method: "POST", headers, body });
      const texto = (await resp.text().catch(() => "")).slice(0, 500);
      if (resp.ok) return { ok: true, status: resp.status, body: texto };
      if (resp.status >= 400 && resp.status < 500) {
        return { ok: false, status: resp.status, body: texto }; // contrato: não retenta
      }
      ultimoErro = `HTTP ${resp.status} ${texto}`;
    } catch (e) {
      ultimoErro = String((e as Error)?.message || e);
    }
    if (i < tentativas) await new Promise((r) => setTimeout(r, 300 * i)); // backoff linear
  }
  return { ok: false, status: 0, body: ultimoErro };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const targetUrl = Deno.env.get("JG_APP_EVENTS_URL") ?? "";
  const secret = Deno.env.get("JG_APP_EVENTS_SECRET") ?? "";
  if (!targetUrl || !secret) return json({ error: "integracao_nao_configurada" }, 500);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "json_invalido" }, 400); }

  const evento = String(body.evento || "");
  const clienteIdExterno = String(body.cliente_id_externo || "");
  if (!evento) return json({ error: "evento_obrigatorio" }, 400);
  if (!clienteIdExterno) return json({ error: "cliente_id_externo_obrigatorio" }, 400);

  let data = body.data ?? {};

  // Eventos de aprovação são bidirecionais: injeta o callback (server-side)
  // para o JG App devolver a resposta do cliente ao sm-callback.
  // Requer que data.id = sm_approvals.id (p/ o callback achar o registro).
  if (evento.startsWith("aprovacao")) {
    try {
      const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      const { data: s } = await db.from("sm_integration_settings").select("callback_secret").eq("id", 1).maybeSingle();
      if (s?.callback_secret) {
        data = {
          ...data,
          callback: {
            url_resposta: `${Deno.env.get("SUPABASE_URL")}/functions/v1/sm-callback`,
            token: s.callback_secret,
          },
        };
      }
    } catch { /* sem callback: ida funciona, volta não */ }
  }

  const envelope = JSON.stringify({
    evento,
    versao: "1.0",
    timestamp: new Date().toISOString(),
    data,
    notificacao: body.notificacao ?? undefined,
  });

  const resultado = await postComRetry(targetUrl, {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${secret}`,
    "X-Client-ID": clienteIdExterno,
  }, envelope);

  // Log opcional de entrega (best-effort; não bloqueia a resposta)
  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    await db.from("sm_webhooks").update({
      last_fired_at: new Date().toISOString(),
      last_status: resultado.status || null,
      last_error: resultado.ok ? null : resultado.body,
    }).eq("name", "jg-app");
  } catch { /* tabela/registro pode não existir; ignora */ }

  return json({ ok: resultado.ok, evento, entrega: resultado }, resultado.ok ? 200 : 502);
});
