// Empurra uma recording (insert/update/delete) para o Google Calendar.
// Chamado pelo frontend (com JWT do usuario) apos cada save/delete.
// Body: { action: "upsert" | "delete", recording_id: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CAL_API = "https://www.googleapis.com/calendar/v3";

async function ensureFreshToken(db: any, conn: any): Promise<string> {
  const now = Date.now();
  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (conn.access_token && expiresAt - now > 60_000) return conn.access_token;
  if (!conn.refresh_token) throw new Error("Sem refresh_token. Reconecte a conta Google.");
  const body = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
    client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
    refresh_token: conn.refresh_token,
    grant_type: "refresh_token",
  });
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`refresh falhou: ${await r.text()}`);
  const data = await r.json();
  const newAccessToken: string = data.access_token;
  const expIn: number = data.expires_in;
  const newExpiresAt = new Date(Date.now() + expIn * 1000).toISOString();
  await db.from("google_calendar_connection").update({ access_token: newAccessToken, expires_at: newExpiresAt }).eq("id", 1);
  return newAccessToken;
}

function recordingToGoogleEvent(rec: any) {
  const tz = "America/Sao_Paulo";
  const startDateTime = `${rec.date}T${rec.start_time}`;
  const endDateTime = rec.end_time ? `${rec.date}T${rec.end_time}` : startDateTime;
  return {
    summary: rec.title,
    description: [
      rec.description || "",
      rec.responsible_name ? `Responsavel: ${rec.responsible_name}` : "",
      rec.participants && rec.participants.length ? `Participantes: ${rec.participants.join(", ")}` : "",
      rec.client_name ? `Cliente: ${rec.client_name}` : "",
      rec.location ? `Local: ${rec.location}` : "",
      `Status JG: ${rec.status}`,
      `[JG-recording:${rec.id}]`,
    ].filter(Boolean).join("\n"),
    location: rec.location || undefined,
    start: { dateTime: startDateTime, timeZone: tz },
    end: { dateTime: endDateTime, timeZone: tz },
    status: rec.status === "cancelado" ? "cancelled" : "confirmed",
    extendedProperties: { private: { jg_recording_id: rec.id } },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body.action as "upsert" | "delete";
    const recordingId = body.recording_id as string;
    if (!action || !recordingId) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: conn } = await db.from("google_calendar_connection").select("*").eq("id", 1).maybeSingle();
    if (!conn || !conn.refresh_token) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "not_connected" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = await ensureFreshToken(db, conn);
    const calendarId = encodeURIComponent(conn.calendar_id || "primary");

    if (action === "delete") {
      const { data: rec } = await db.from("recordings").select("google_event_id").eq("id", recordingId).maybeSingle();
      const evId = rec?.google_event_id || body.google_event_id;
      if (!evId) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const r = await fetch(`${GOOGLE_CAL_API}/calendars/${calendarId}/events/${encodeURIComponent(evId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok && r.status !== 410 && r.status !== 404) {
        const txt = await r.text();
        return new Response(JSON.stringify({ ok: false, error: txt }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: rec, error } = await db.from("recordings").select("*").eq("id", recordingId).maybeSingle();
    if (error || !rec) return new Response(JSON.stringify({ ok: false, error: "recording_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const eventPayload = recordingToGoogleEvent(rec);

    if (rec.google_event_id) {
      const r = await fetch(`${GOOGLE_CAL_API}/calendars/${calendarId}/events/${encodeURIComponent(rec.google_event_id)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      });
      if (!r.ok) {
        if (r.status === 404 || r.status === 410) {
          const ins = await fetch(`${GOOGLE_CAL_API}/calendars/${calendarId}/events`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventPayload),
          });
          if (!ins.ok) return new Response(JSON.stringify({ ok: false, error: await ins.text() }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const created = await ins.json();
          await db.from("recordings").update({ google_event_id: created.id, google_synced_at: new Date().toISOString() }).eq("id", rec.id);
          return new Response(JSON.stringify({ ok: true, google_event_id: created.id, created: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: false, error: await r.text() }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await db.from("recordings").update({ google_synced_at: new Date().toISOString() }).eq("id", rec.id);
      return new Response(JSON.stringify({ ok: true, google_event_id: rec.google_event_id, updated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const ins = await fetch(`${GOOGLE_CAL_API}/calendars/${calendarId}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      });
      if (!ins.ok) return new Response(JSON.stringify({ ok: false, error: await ins.text() }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const created = await ins.json();
      await db.from("recordings").update({ google_event_id: created.id, google_synced_at: new Date().toISOString() }).eq("id", rec.id);
      return new Response(JSON.stringify({ ok: true, google_event_id: created.id, created: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
