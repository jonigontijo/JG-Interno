// ============================================================
// sm-callback — Endpoint de callback do módulo Social Media
// ------------------------------------------------------------
// URL pública (callback) que o n8n / app do cliente chama para
// devolver respostas ao JG Interno SEM precisar de login Supabase.
//
// Autenticação: header "x-jg-secret" deve bater com
// sm_integration_settings.callback_secret.
//
// Ações suportadas (campo "action" no body):
//   - "approval_response": atualiza status de uma aprovação
//       { action, approval_id, status, feedback? }
//       status ∈ aprovado | reprovado | revisao_solicitada | aguardando
//   - "post_status":       atualiza status de um post
//       { action, post_id, status }
//       status ∈ rascunho | agendado | publicado | pendente | atrasado | cancelado
//   - "calendar_event":    cria/atualiza vínculo de evento do Google Agenda
//       { action, post_id, google_event_id, google_calendar_id,
//         event_title?, event_start?, event_end?, event_url? }
//   - "ai_log":            registra ação executada pela IA
//       { action, command, action_type?, result?, client_id?, post_id?, success? }
//
// verify_jwt = false (ver config.toml) — protegido pelo segredo.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-jg-secret",
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

    // 1) Lê o body
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // 2) Valida o segredo — aceita no header "x-jg-secret" OU no campo "token" do corpo
    //    (o webhook de aprovação envia callback.token; o n8n pode devolver { token, ... }).
    const provided = req.headers.get("x-jg-secret") || body.token || "";
    const { data: settings } = await db
      .from("sm_integration_settings")
      .select("callback_secret")
      .eq("id", 1)
      .maybeSingle();

    if (!settings?.callback_secret || provided !== settings.callback_secret) {
      return json({ error: "unauthorized", message: "segredo inválido ou ausente (header x-jg-secret ou campo token no corpo)" }, 401);
    }

    switch (action) {
      // ─────────────────────────────────────────────
      case "approval_response": {
        const { approval_id, status, feedback } = body;
        if (!approval_id || !status) return json({ error: "missing_fields", required: ["approval_id", "status"] }, 400);

        const allowed = ["aprovado", "reprovado", "revisao_solicitada", "aguardando"];
        if (!allowed.includes(status)) return json({ error: "invalid_status", allowed }, 400);

        const { data, error } = await db
          .from("sm_approvals")
          .update({
            status,
            client_feedback: feedback ?? null,
            client_responded_at: new Date().toISOString(),
          })
          .eq("id", approval_id)
          .select("id, post_id, status")
          .maybeSingle();

        if (error) return json({ error: "db_error", detail: error.message }, 500);
        if (!data) return json({ error: "approval_not_found", approval_id }, 404);

        // O trigger no banco já sincroniza o status do post e cria notificação interna.
        return json({ ok: true, approval: data });
      }

      // ─────────────────────────────────────────────
      case "post_status": {
        const { post_id, status } = body;
        if (!post_id || !status) return json({ error: "missing_fields", required: ["post_id", "status"] }, 400);

        const allowed = ["rascunho", "agendado", "publicado", "pendente", "atrasado", "cancelado"];
        if (!allowed.includes(status)) return json({ error: "invalid_status", allowed }, 400);

        const patch: Record<string, unknown> = { status };
        if (status === "publicado") patch.published_at = new Date().toISOString();

        const { data, error } = await db
          .from("sm_posts")
          .update(patch)
          .eq("id", post_id)
          .select("id, status, published_at")
          .maybeSingle();

        if (error) return json({ error: "db_error", detail: error.message }, 500);
        if (!data) return json({ error: "post_not_found", post_id }, 404);
        return json({ ok: true, post: data });
      }

      // ─────────────────────────────────────────────
      case "calendar_event": {
        const { post_id, client_id, google_event_id, google_calendar_id,
                event_title, event_start, event_end, event_description, event_url } = body;
        if (!google_event_id || !google_calendar_id || !client_id) {
          return json({ error: "missing_fields", required: ["client_id", "google_event_id", "google_calendar_id"] }, 400);
        }

        const { data, error } = await db
          .from("sm_calendar_events")
          .upsert({
            post_id: post_id ?? null,
            client_id,
            google_event_id,
            google_calendar_id,
            event_title: event_title ?? null,
            event_start: event_start ?? null,
            event_end: event_end ?? null,
            event_description: event_description ?? null,
            event_url: event_url ?? null,
            last_synced_at: new Date().toISOString(),
          }, { onConflict: "google_event_id,google_calendar_id" })
          .select("id, post_id, google_event_id")
          .maybeSingle();

        if (error) return json({ error: "db_error", detail: error.message }, 500);
        // O trigger sincroniza scheduled_at no post automaticamente.
        return json({ ok: true, event: data });
      }

      // ─────────────────────────────────────────────
      case "ai_log": {
        const { command, action_type, result, result_data, client_id, post_id, approval_id, success, error_message, user_id } = body;
        if (!command) return json({ error: "missing_fields", required: ["command"] }, 400);

        const { data, error } = await db
          .from("sm_ai_logs")
          .insert({
            command,
            action_type: action_type ?? null,
            result: result ?? null,
            result_data: result_data ?? null,
            client_id: client_id ?? null,
            post_id: post_id ?? null,
            approval_id: approval_id ?? null,
            user_id: user_id ?? null,
            success: success ?? true,
            error_message: error_message ?? null,
          })
          .select("id")
          .maybeSingle();

        if (error) return json({ error: "db_error", detail: error.message }, 500);
        return json({ ok: true, log: data });
      }

      // ─────────────────────────────────────────────
      case "ping":
        return json({ ok: true, message: "pong", ts: new Date().toISOString() });

      default:
        return json({
          error: "unknown_action",
          received: action,
          supported: ["approval_response", "post_status", "calendar_event", "ai_log", "ping"],
        }, 400);
    }
  } catch (e) {
    return json({ error: "internal_error", detail: String((e as Error)?.message || e) }, 500);
  }
});
