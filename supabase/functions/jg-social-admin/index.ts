import {
  db,
  enabled,
  endpoint,
  json,
  readBody,
  remote,
  requireAdmin,
} from "../_shared/social-server.ts";
Deno.serve((req) =>
  endpoint(req, async (req) => {
    const actor = await requireAdmin(req),
      body = JSON.parse(await readBody(req)),
      client = db();
    if (body.action === "health") {
      const local = await client.from("jg_sm_outbox").select("id", { count: "exact", head: true }).eq("status", "needs_attention");
      if (local.error) return json({ error: "health_unavailable" }, 503);
      let remoteStatus = null;
      try {
        const result = await remote("/api/jg-interno/status", "GET");
        const stats = result.outbox_stats;
        if (!stats || ![stats.failed, stats.pending].every((n) => Number.isSafeInteger(n) && n >= 0)) {
          throw new Error("invalid_status");
        }
        remoteStatus = { failed: stats.failed, pending: stats.pending };
      } catch { /* Unknown is surfaced as an alert, never as a healthy queue. */ }
      return json({ local_attention: local.count || 0, remote: remoteStatus, checked_at: new Date().toISOString() });
    }
    if (
      typeof body.client_id !== "string" || body.client_id.length > 1000
    ) return json({ error: "invalid_client" }, 400);
    const { data: state, error } = await client.from("jg_sm_clients").select(
      "client_id,name,remote_id",
    ).eq("client_id", body.client_id).single();
    if (error || !state) return json({ error: "unknown_client" }, 404);
    if (body.action === "link_existing") {
      if (!enabled()) return json({ error: "integration_disabled" }, 409);
      if (
        typeof body.remote_id !== "string" || !body.remote_id.trim()
      ) return json({ error: "invalid_remote_id" }, 400);
      if (state.remote_id && state.remote_id !== body.remote_id) {
        return json({ error: "already_linked" }, 409);
      }
      const response = await remote(
        "/api/jg-interno/link-client",
        "POST",
        JSON.stringify({
          jg_interno_client_id: body.client_id,
          existing_social_media_client_id: body.remote_id,
          name: state.name,
        }),
      );
      if (
        response.success !== true ||
        response.client?.jg_interno_client_id !== body.client_id ||
        response.client?.social_media_client_id !== body.remote_id
      ) return json({ error: "link_not_confirmed" }, 502);
    } else if (
      !["approve_new", "retry_event"].includes(body.action)
    ) return json({ error: "invalid_action" }, 400);
    const result = await client.rpc("jg_sm_admin_action", {
      p_client: body.client_id,
      p_action: body.action,
      p_remote: body.remote_id || null,
      p_event: body.event_id || null,
      p_actor: actor,
    });
    if (result.error) return json({ error: "action_failed" }, 409);
    return json({ success: true });
  })
);
