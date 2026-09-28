import {
  db,
  enabled,
  endpoint,
  json,
  remote,
  requireWorker,
} from "../_shared/social-server.ts";
import { parseEvent } from "../_shared/social-contract.ts";

Deno.serve((req) =>
  endpoint(req, async (req) => {
    await requireWorker(req);
    if (!enabled()) return json({ enabled: false });
    const client = db();
    const check = await client.rpc("jg_sm_recheck");
    if (check.error) throw new Error("eligibility_scan_failed");
    // Oldest attempted client first. At most 5 per tick, persistent progress between runs.
    const { data: clients, error } = await client.from("jg_sm_clients").select(
      "client_id,reconciled_at",
    ).not("remote_id", "is", null).order("reconcile_attempted_at", {
      ascending: true,
      nullsFirst: true,
    }).limit(5);
    if (error) throw new Error("client_scan_failed");
    const results = [];
    for (const c of clients || []) {
      const started = new Date().toISOString();
      let ok = false;
      const attempted = await client.from("jg_sm_clients").update({
        reconcile_attempted_at: started,
      }).eq("client_id", c.client_id);
      if (attempted.error) throw new Error("attempt_checkpoint_failed");
      try {
        let pages = 1;
        for (let page = 1; page <= pages; page++) {
          const query = new URLSearchParams({
            jg_interno_client_id: c.client_id,
            page: String(page),
            limit: "100",
          });
          if (c.reconciled_at) {
            query.set(
              "since",
              new Date(Date.parse(c.reconciled_at) - 300000).toISOString(),
            );
          }
          const result = await remote(
            "/api/jg-interno/reconcile",
            "GET",
            "",
            crypto.randomUUID(),
            query,
          );
          if (
            result.client?.jg_interno_client_id !== c.client_id ||
            !Array.isArray(result.publications) ||
            result.pagination?.page !== page ||
            !Number.isInteger(result.pagination?.total_pages) ||
            result.pagination.total_pages < 0
          ) throw new Error("invalid_reconciliation");
          pages = Math.max(1, result.pagination.total_pages);
          // Fail visibly instead of silently skipping a large client. Increase via documented operational change.
          if (pages > 20 || result.publications.length > 200) {
            throw new Error("reconciliation_page_limit");
          }
          for (const row of result.publications) {
            if (row.jg_interno_client_id !== c.client_id) {
              throw new Error("wrong_client");
            }
            const key = JSON.stringify([c.client_id, row.post_id, row.version]);
            const digest = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(key),
            );
            const id = "reconcile-" + Array.from(new Uint8Array(digest), (b) =>
              b.toString(16).padStart(2, "0")).join("");
            const event = parseEvent({
              event_id: id,
              event_type: "publication.updated",
              timestamp: row.updated_at,
              version: row.version,
              data: row,
            });
            const saved = await client.rpc("jg_sm_apply", { p_event: event });
            if (saved.error) {
              throw new Error("publication_storage_conflict");
            }
          }
        }
        const updated = await client.from("jg_sm_clients").update({
          reconciled_at: started,
        }).eq("client_id", c.client_id);
        if (updated.error) {
          throw new Error("checkpoint_failed");
        }
        ok = true;
      } catch {
        // Never advance the checkpoint on partial/error responses. Persist a visible alert.
      }
      const log = await client.from("jg_sm_runs").insert({
        kind: "reconcile",
        client_id: c.client_id,
        success: ok,
        detail: ok
          ? null
          : "Falha de conferência; checkpoint preservado. Verificar contrato, autenticação ou limite de páginas.",
      });
      if (log.error) {
        throw new Error("audit_failed");
      }
      results.push({ client_id: c.client_id, success: ok });
    }
    return json({ results });
  })
);
