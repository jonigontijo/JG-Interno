// ============================================================
// sm-fire-event — Dispara um evento para os webhooks inscritos
// ------------------------------------------------------------
// Body: { event: string, payload: object }
// 1) Busca em sm_webhooks todos os ativos inscritos no evento
// 2) Faz POST do payload para cada URL (header x-jg-event + secret)
// 3) Atualiza estatísticas (last_fired_at, last_status, fire_count)
//
// Autenticação: header "x-jg-secret" = sm_integration_settings.callback_secret
// verify_jwt = false (ver config.toml)
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

    // valida segredo
    const provided = req.headers.get("x-jg-secret") || "";
    const { data: settings } = await db
      .from("sm_integration_settings")
      .select("callback_secret")
      .eq("id", 1)
      .maybeSingle();
    if (!settings?.callback_secret || provided !== settings.callback_secret) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const event = String(body.event || "");
    const payload = body.payload ?? {};
    if (!event) return json({ error: "missing_event" }, 400);

    // busca webhooks ativos inscritos neste evento
    const { data: hooks, error } = await db
      .from("sm_webhooks")
      .select("id, name, url, secret, events")
      .eq("is_active", true)
      .contains("events", [event]);

    if (error) return json({ error: "db_error", detail: error.message }, 500);
    if (!hooks || hooks.length === 0) {
      return json({ ok: true, event, delivered: 0, message: "nenhum webhook inscrito neste evento" });
    }

    const envelope = {
      event,
      fired_at: new Date().toISOString(),
      data: payload,
    };

    const results = await Promise.all(hooks.map(async (h) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-jg-event": event };
      if (h.secret) headers["x-jg-event-secret"] = h.secret;
      let status = 0;
      let errText: string | null = null;
      try {
        const resp = await fetch(h.url, { method: "POST", headers, body: JSON.stringify(envelope) });
        status = resp.status;
        if (!resp.ok) errText = `HTTP ${resp.status}`;
      } catch (e) {
        errText = String((e as Error)?.message || e);
      }
      // atualiza estatísticas (incremento via leitura+escrita simples)
      const { data: cur } = await db.from("sm_webhooks").select("fire_count").eq("id", h.id).maybeSingle();
      await db.from("sm_webhooks").update({
        last_fired_at: new Date().toISOString(),
        last_status: status || null,
        last_error: errText,
        fire_count: ((cur?.fire_count as number) || 0) + 1,
      }).eq("id", h.id);

      return { webhook: h.name, url: h.url, status, error: errText };
    }));

    const delivered = results.filter(r => r.status >= 200 && r.status < 300).length;
    return json({ ok: true, event, delivered, total: hooks.length, results });
  } catch (e) {
    return json({ error: "internal_error", detail: String((e as Error)?.message || e) }, 500);
  }
});
