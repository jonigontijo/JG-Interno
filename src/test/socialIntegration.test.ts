// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  deliveryConfirmed,
  parseEvent,
  retryDelay,
  sign,
  summarize,
  verify,
} from "../../supabase/functions/_shared/social-contract";

const data = {
  jg_interno_client_id: "c1",
  post_id: "p1",
  title: "Post",
  format: "posts",
  social_network: "instagram",
  social_networks: ["instagram", "facebook"],
  status: "published",
  due_date: "2026-09-24T12:00:00Z",
  previous_due_date: "2026-09-20T12:00:00Z",
  published_at: "2026-09-24T13:00:00Z",
  updated_at: "2026-09-24T13:01:00Z",
  period: "2026-09",
  content_units: 1,
  version: 4,
};
const event = {
  event_id: "evt-textual-1",
  event_type: "publication.published",
  timestamp: data.updated_at,
  version: 4,
  data,
};
describe("social integration contract", () => {
  it("authenticates original bytes and rejects tampering, stale timestamps and malformed signatures", async () => {
    const stamp = data.updated_at,
      body = JSON.stringify(event),
      now = Date.parse(stamp);
    const signature = await sign("test-secret", stamp, body);
    expect(await verify("test-secret", stamp, body, signature, now)).toBe(true);
    expect(await verify("test-secret", stamp, body + " ", signature, now)).toBe(
      false,
    );
    expect(await verify("test-secret", stamp, body, signature, now + 301000))
      .toBe(false);
    expect(await verify("test-secret", stamp, body, "sha256=no", now)).toBe(
      false,
    );
  });
  it("accepts textual event IDs, but validates versions, units, dates and publication evidence", () => {
    expect(parseEvent(event).event_id).toBe(event.event_id);
    for (
      const patch of [
        { version: 0 },
        { content_units: 2 },
        { due_date: "2026-09-24" },
        { published_at: null },
        { status: "ok" },
      ]
    ) {
      expect(() => parseEvent({ ...event, data: { ...data, ...patch } }))
        .toThrow();
    }
    expect(() => parseEvent({ ...event, version: 5 })).toThrow();
  });
  it("does not acknowledge unrelated or malformed 200 responses", () => {
    expect(deliveryConfirmed({ success: true, event_id: "x" }, "x")).toBe(true);
    expect(
      deliveryConfirmed(
        { success: true, event_id: "x", is_duplicate: true },
        "x",
      ),
    ).toBe(true);
    expect(deliveryConfirmed({ success: true, event_id: "y" }, "x")).toBe(
      false,
    );
    expect(deliveryConfirmed({ message: "ok" }, "x")).toBe(false);
    expect(deliveryConfirmed("<html>ok</html>", "x")).toBe(false);
  });
  it("retains failed deliveries with bounded progressive retries", () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelay)).toEqual([
      60,
      300,
      900,
      3600,
      14400,
      86400,
    ]);
    expect(retryDelay(7)).toBeNull();
  });
  it("counts one piece across networks, preserves original deadline and excludes approval/cancellation", () => {
    const result = summarize(
      [data, { ...data, social_network: "facebook" }, {
        ...data,
        post_id: "p2",
        status: "approval",
        published_at: null,
      }, { ...data, post_id: "p3", status: "cancelled", published_at: null }],
      Date.parse("2026-09-27T00:00:00Z"),
    );
    expect(result.published).toBe(1);
    expect(result.latePublished).toBe(1);
    expect(result.overdue).toBe(1);
    expect(result.approval).toBe(1);
  });
});
