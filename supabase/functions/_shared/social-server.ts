import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  deliveryConfirmed,
  parseEvent,
  sign,
  verify,
} from "./social-contract.ts";
export const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
export const enabled = () => Deno.env.get("JG_SOCIAL_ENABLED") === "true";
export const secret = () => {
  const s = Deno.env.get("JG_INTERNO_WEBHOOK_SECRET");
  if (!s || s.length < 32) throw new Error("integration_secret_not_configured");
  return s;
};
export async function requireAdmin(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("unauthorized");
  const client = db(), { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("unauthorized");
  const profile = await client.from("profiles").select("active,is_admin").eq(
    "id",
    data.user.id,
  ).single();
  if (profile.error || !profile.data?.active || !profile.data.is_admin) {
    throw new Error("unauthorized");
  }
  return data.user.id;
}
export async function requireWorker(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, ""),
    cron = Deno.env.get("JG_SOCIAL_CRON_SECRET");
  if (cron && cron.length >= 32 && token === cron) return;
  await requireAdmin(req);
}
export async function readBody(
  req: Request | Response,
  limit = 262144,
): Promise<string> {
  if (!req.body) throw new Error("empty_body");
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export async function remote(
  path: string,
  method: "GET" | "POST",
  body = "",
  eventId: string = crypto.randomUUID(),
  query?: URLSearchParams,
) {
  const base = new URL(
    Deno.env.get("JG_SOCIAL_BASE_URL") || "https://jgsocialmedia.lovable.app",
  );
  if (base.protocol !== "https:" || base.username || base.password) {
    throw new Error("invalid_remote_url");
  }
  const url = new URL(path, base);
  if (query) url.search = query.toString();
  const timestamp = new Date().toISOString();
  const response = await fetch(url, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-JG-Timestamp": timestamp,
      "X-JG-Event-ID": eventId,
      "X-JG-Signature": await sign(secret(), timestamp, body),
    },
    ...(method === "POST" ? { body } : {}),
  });
  if (!response.ok) throw new Error(`remote_http_${response.status}`);
  // Do not log or return upstream bodies: they may contain customer data.
  const raw = await readBody(response, 2000000);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("remote_invalid_json");
  }
}
export async function receive(req: Request) {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const raw = await readBody(req);
  if (
    !await verify(
      secret(),
      req.headers.get("X-JG-Timestamp") || "",
      raw,
      req.headers.get("X-JG-Signature") || "",
    )
  ) return json({ error: "invalid_signature" }, 401);
  const event = parseEvent(JSON.parse(raw));
  if (req.headers.get("X-JG-Event-ID") !== event.event_id) {
    return json({ error: "event_id_mismatch" }, 400);
  }
  const { data, error } = await db().rpc("jg_sm_apply", { p_event: event });
  if (error) {
    return json(
      {
        error:
          ["unknown_client", "event_conflict", "version_conflict"].find((x) =>
            error.message.includes(x)
          ) || "storage_error",
      },
      error.message.includes("conflict") ||
        error.message.includes("unknown_client")
        ? 409
        : 503,
    );
  }
  return json(data);
}
export async function dispatch(req: Request) {
  await requireWorker(req);
  if (!enabled()) return json({ enabled: false, delivered: 0 });
  secret();
  const client = db(),
    { data: events, error } = await client.rpc("jg_sm_claim", { p_limit: 10 });
  if (error) throw new Error("claim_failed");
  const results = await Promise.all(
    (events || []).map(
      async (
        event: {
          id: string;
          lease_id: string;
          client_id: string;
          payload: Record<string, unknown>;
        },
      ) => {
        let ok = false,
          reason: string | null = null,
          remoteId: string | null = null;
        try {
          const result = await remote(
            "/api/jg-interno/webhook",
            "POST",
            JSON.stringify(event.payload),
            event.id,
          );
          if (!deliveryConfirmed(result, event.id)) {
            throw new Error("unconfirmed_delivery");
          }
          if (
            result.client?.jg_interno_client_id !== event.client_id ||
            typeof result.client?.social_media_client_id !== "string" ||
            !result.client.social_media_client_id.trim()
          ) throw new Error("unconfirmed_client");
          remoteId = result.client.social_media_client_id;
          ok = true;
        } catch (e) {
          reason = e instanceof Error ? e.message : "delivery_failed";
        }
        const finished = await client.rpc("jg_sm_finish", {
          p_id: event.id,
          p_lease: event.lease_id,
          p_ok: ok,
          p_error: reason,
          p_remote: remoteId,
        });
        return {
          id: event.id,
          delivered: ok && !finished.error && finished.data === true,
        };
      },
    ),
  );
  return json({ enabled: true, results });
}
export async function endpoint(
  req: Request,
  handler: (req: Request) => Promise<Response>,
) {
  if (req.method === "OPTIONS") return json({});
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    return await handler(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "unauthorized") return json({ error: msg }, 403);
    if (msg.includes("not_configured")) {
      return json({ error: "not_configured" }, 503);
    }
    return json({ error: "request_failed" }, 400);
  }
}
