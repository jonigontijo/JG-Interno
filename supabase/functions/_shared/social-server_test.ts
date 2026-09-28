import { endpoint, readBody, receive, remote } from "./social-server.ts";
import { verify } from "./social-contract.ts";

function assert(value: unknown) {
  if (!value) throw new Error("assertion_failed");
}
Deno.test("outbound signs exact body and rejects HTTP failures and non-JSON acknowledgements", async () => {
  const original = globalThis.fetch;
  const oldSecret = Deno.env.get("JG_INTERNO_WEBHOOK_SECRET");
  const oldBase = Deno.env.get("JG_SOCIAL_BASE_URL");
  const key = "test-only-secret-with-more-than-32-characters";
  Deno.env.set("JG_INTERNO_WEBHOOK_SECRET", key);
  Deno.env.set("JG_SOCIAL_BASE_URL", "https://example.invalid");
  try {
    globalThis.fetch = async (_url, init) => {
      const h = new Headers(init?.headers);
      assert(h.get("X-JG-Event-ID") === "evt1");
      assert(
        await verify(
          key,
          h.get("X-JG-Timestamp")!,
          String(init?.body),
          h.get("X-JG-Signature")!,
        ),
      );
      assert(init?.redirect === "error");
      return new Response('{"success":true,"event_id":"evt1"}');
    };
    assert(
      (await remote("/webhook", "POST", '{"a":1}', "evt1")).event_id === "evt1",
    );
    for (
      const response of [
        new Response("unavailable", { status: 503 }),
        new Response("<html>login</html>"),
      ]
    ) {
      globalThis.fetch = async () => response;
      let rejected = false;
      try {
        await remote("/webhook", "POST", "{}");
      } catch {
        rejected = true;
      }
      assert(rejected);
    }
  } finally {
    globalThis.fetch = original;
    if (oldSecret === undefined) Deno.env.delete("JG_INTERNO_WEBHOOK_SECRET");
    else Deno.env.set("JG_INTERNO_WEBHOOK_SECRET", oldSecret);
    if (oldBase === undefined) Deno.env.delete("JG_SOCIAL_BASE_URL");
    else Deno.env.set("JG_SOCIAL_BASE_URL", oldBase);
  }
});
Deno.test("receiver rejects unsigned requests before touching storage; bounded body and method checks", async () => {
  const oldSecret = Deno.env.get("JG_INTERNO_WEBHOOK_SECRET");
  Deno.env.set(
    "JG_INTERNO_WEBHOOK_SECRET",
    "test-only-secret-with-more-than-32-characters",
  );
  try {
    const result = await receive(
      new Request("https://example.invalid", { method: "POST", body: "{}" }),
    );
    assert(result.status === 401);
    assert(
      (await endpoint(new Request("https://example.invalid"), receive))
        .status === 405,
    );
    let rejected = false;
    try {
      await readBody(new Response("12345"), 4);
    } catch {
      rejected = true;
    }
    assert(rejected);
  } finally {
    if (oldSecret === undefined) Deno.env.delete("JG_INTERNO_WEBHOOK_SECRET");
    else Deno.env.set("JG_INTERNO_WEBHOOK_SECRET", oldSecret);
  }
});
