// ============================================================
// sm-send-approval — Envia uma aprovação para os webhooks inscritos
// ------------------------------------------------------------
// Monta o payload EXATO esperado pelo n8n / app do cliente:
//   {
//     "aprovacao": {
//       "id", "cliente_name", "social_media_responsavel", "tipo_conteudo",
//       "plataforma", "data_publicacao_prevista", "descricao_post",
//       "conteudo", "legenda_sugerida", "observacoes_internas", "prazo_resposta"
//     },
//     "callback": { "url_resposta", "token" }
//   }
// e faz POST para todos os webhooks ativos inscritos em "approval.created".
//
// O token (callback_secret) fica SOMENTE no servidor — não é exposto ao front.
// Autenticação: JWT do usuário (verify_jwt = true).
// Body: { approval_id }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const approval_id = String(body.approval_id || "");
    if (!approval_id) return json({ error: "missing_approval_id" }, 400);

    // 1) Lê a aprovação
    const { data: appr, error: aerr } = await db
      .from("sm_approvals").select("*").eq("id", approval_id).maybeSingle();
    if (aerr) return json({ error: "db_error", detail: aerr.message }, 500);
    if (!appr) return json({ error: "approval_not_found", approval_id }, 404);

    // 2) Token de callback (fica no servidor)
    const { data: settings } = await db
      .from("sm_integration_settings").select("callback_secret").eq("id", 1).maybeSingle();
    const token = settings?.callback_secret || null;

    // 3) Webhooks inscritos no evento approval.created
    const { data: hooks } = await db
      .from("sm_webhooks")
      .select("id, name, url, secret, events")
      .eq("is_active", true)
      .contains("events", ["approval.created"]);

    // 4) Payload EXATO
    const payload = {
      aprovacao: {
        id: appr.id,
        cliente_id: appr.client_id ?? null,
        cliente_name: appr.client_name ?? null,
        social_media_responsavel: appr.social_media_responsavel ?? null,
        tipo_conteudo: appr.piece_type ?? null,
        plataforma: appr.plataforma ?? null,
        data_publicacao_prevista: appr.data_publicacao_prevista ?? null,
        descricao_post: appr.description ?? null,
        conteudo: appr.piece_url ?? null,
        legenda_sugerida: appr.legenda_sugerida ?? null,
        observacoes_internas: appr.observacoes_internas ?? null,
        prazo_resposta: appr.prazo_resposta ?? null,
      },
      callback: {
        url_resposta: `${supabaseUrl}/functions/v1/sm-callback`,
        token,
      },
    };

    if (!hooks || hooks.length === 0) {
      await db.from("sm_approvals").update({
        webhook_sent_at: new Date().toISOString(),
        webhook_response: { delivered: 0, message: "nenhum webhook inscrito em approval.created" },
      }).eq("id", approval_id);
      return json({ ok: true, delivered: 0, total: 0, message: "nenhum webhook inscrito em approval.created" });
    }

    // 5) Dispara para cada webhook
    const results = await Promise.all(hooks.map(async (h) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-jg-event": "approval.created" };
      if (h.secret) headers["x-jg-event-secret"] = h.secret;
      let status = 0;
      let errText: string | null = null;
      let respText: string | null = null;
      try {
        const resp = await fetch(h.url, { method: "POST", headers, body: JSON.stringify(payload) });
        status = resp.status;
        respText = (await resp.text().catch(() => "")).slice(0, 500);
        if (!resp.ok) errText = `HTTP ${resp.status}`;
      } catch (e) {
        errText = String((e as Error)?.message || e);
      }
      const { data: cur } = await db.from("sm_webhooks").select("fire_count").eq("id", h.id).maybeSingle();
      await db.from("sm_webhooks").update({
        last_fired_at: new Date().toISOString(),
        last_status: status || null,
        last_error: errText,
        fire_count: ((cur?.fire_count as number) || 0) + 1,
      }).eq("id", h.id);
      return { webhook: h.name, url: h.url, status, error: errText, response: respText };
    }));

    const delivered = results.filter(r => r.status >= 200 && r.status < 300).length;
    await db.from("sm_approvals").update({
      webhook_sent_at: new Date().toISOString(),
      webhook_response: { delivered, total: hooks.length, results },
    }).eq("id", approval_id);

    return json({ ok: true, delivered, total: hooks.length, results });
  } catch (e) {
    return json({ error: "internal_error", detail: String((e as Error)?.message || e) }, 500);
  }
});
