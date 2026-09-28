export type Publication = {
  jg_interno_client_id: string;
  post_id: string;
  title: string;
  format: string;
  social_network: string;
  social_networks?: string[];
  status: string;
  due_date: string;
  previous_due_date?: string | null;
  published_at?: string | null;
  updated_at: string;
  period: string;
  content_units: number;
  version: number;
  is_deleted?: boolean;
  is_cancelled?: boolean;
  post_url?: string | null;
};
export type PublicationEvent = {
  event_id: string;
  event_type: string;
  timestamp: string;
  version: number;
  data: Publication;
};
const encoder = new TextEncoder();
const iso = (v: unknown) =>
  typeof v === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
  Number.isFinite(Date.parse(v));
const text = (v: unknown) =>
  typeof v === "string" && v.length > 0 && v.length <= 1000;
export function parseEvent(value: unknown): PublicationEvent {
  const e = value as PublicationEvent, d = e?.data;
  if (
    !e || !text(e.event_id) ||
    ![
      "created",
      "updated",
      "rescheduled",
      "approved",
      "rejected",
      "published",
      "cancelled",
    ].some((t) => e.event_type === `publication.${t}`) || !iso(e.timestamp) ||
    !d
  ) throw new Error("invalid_event");
  if (
    ![d.jg_interno_client_id, d.post_id, d.title, d.format, d.social_network]
      .every(text) ||
    !["producing", "approval", "scheduled", "published", "cancelled"].includes(
      d.status,
    )
  ) throw new Error("invalid_publication");
  if (
    !Number.isSafeInteger(d.version) || d.version < 1 ||
    e.version !== d.version || d.content_units !== 1
  ) throw new Error("invalid_version_or_units");
  if (
    !iso(d.due_date) || !iso(d.updated_at) ||
    (d.previous_due_date != null && !iso(d.previous_due_date)) ||
    (d.published_at != null && !iso(d.published_at)) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.period)
  ) throw new Error("invalid_dates");
  if (d.status === "published" && !d.published_at) {
    throw new Error("missing_publication_date");
  }
  if (
    d.social_networks !== undefined &&
    (!Array.isArray(d.social_networks) || d.social_networks.length > 30 ||
      !d.social_networks.every(text))
  ) throw new Error("invalid_networks");
  for (const flag of [d.is_deleted, d.is_cancelled]) {
    if (flag !== undefined && typeof flag !== "boolean") {
      throw new Error("invalid_flag");
    }
  }
  if (d.post_url && !/^https?:\/\//i.test(d.post_url)) {
    throw new Error("invalid_url");
  }
  return e;
}
export async function sign(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  return "sha256=" +
    Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0"))
      .join("");
}
export async function verify(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
  now = Date.now(),
): Promise<boolean> {
  if (
    !secret || !iso(timestamp) ||
    Math.abs(now - Date.parse(timestamp)) > 300000 ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  ) return false;
  const expected = await sign(secret, timestamp, body);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
export function deliveryConfirmed(value: unknown, eventId: string): boolean {
  const v = value as { success?: unknown; event_id?: unknown };
  return v?.success === true && v.event_id === eventId;
}
export function retryDelay(attempt: number): number | null {
  return [60, 300, 900, 3600, 14400, 86400][attempt - 1] ?? null;
}
export function summarize(rows: Publication[], now: number) {
  const unique = new Map<string, Publication>();
  for (const row of rows) {
    const id = `${row.jg_interno_client_id}:${row.post_id}`,
      old = unique.get(id);
    if (!old || row.version > old.version) unique.set(id, row);
  }
  const result = {
    published: 0,
    producing: 0,
    approval: 0,
    scheduled: 0,
    overdue: 0,
    latePublished: 0,
  };
  for (const p of unique.values()) {
    if (p.is_deleted || p.is_cancelled || p.status === "cancelled") continue;
    const deadline = Date.parse(p.previous_due_date || p.due_date);
    if (p.status in result) {
      result[
        p.status as "published" | "producing" | "approval" | "scheduled"
      ]++;
    }
    if (p.status === "published") {
      if (Date.parse(p.published_at!) > deadline) result.latePublished++;
    } else if (deadline < now) result.overdue++;
  }
  return result;
}
