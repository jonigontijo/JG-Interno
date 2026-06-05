// Puxa eventos novos/alterados/deletados do Google Calendar (primary) e aplica
// na tabela recordings. Usa incremental sync via syncToken.
// Chamado pelo frontend quando a aba do calendario abre e periodicamente.
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

function parseEventToRecording(ev: any) {
  // Aceita apenas eventos com dateTime (eventos "all day" ficam fora do escopo de gravacoes).
  const startDt = ev.start?.dateTime;
  const endDt = ev.end?.dateTime;
  if (!startDt) return null;
  const startISO = new Date(startDt);
  const endISO = endDt ? new Date(endDt) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${startISO.getFullYear()}-${pad(startISO.getMonth() + 1)}-${pad(startISO.getDate())}`;
  const start_time = `${pad(startISO.getHours())}:${pad(startISO.getMinutes())}:00`;
  const end_time = endISO ? `${pad(endISO.getHours())}:${pad(endISO.getMinutes())}:00` : null;
  const title = ev.summary || "(Sem t\u00edtulo)";
  const description = ev.description || "";
  const location = ev.location || "";
  return { title, description, location, date, start_time, end_time };
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
    const { data: conn } = await db.from("google_calendar_connection").select("*").eq("id", 1).maybeSingle();
    if (!conn || !conn.refresh_token) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "not_connected" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = await ensureFreshToken(db, conn);
    const calendarId = encodeURIComponent(conn.calendar_id || "primary");

    let pageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = undefined;
    const events: any[] = [];
    let usedSyncToken = !!conn.sync_token;
    do {
      const u = new URL(`${GOOGLE_CAL_API}/calendars/${calendarId}/events`);
      u.searchParams.set("singleEvents", "true");
      u.searchParams.set("maxResults", "2500");
      if (conn.sync_token && !pageToken) u.searchParams.set("syncToken", conn.sync_token);
      else if (!conn.sync_token && !pageToken) u.searchParams.set("timeMin", new Date().toISOString());
      if (pageToken) u.searchParams.set("pageToken", pageToken);
      const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        if (r.status === 410 && usedSyncToken) {
          await db.from("google_calendar_connection").update({ sync_token: null }).eq("id", 1);
          return new Response(JSON.stringify({ ok: false, reset: true, reason: "sync_token_invalido_reaplicar" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: false, error: await r.text() }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const j = await r.json();
      if (Array.isArray(j.items)) events.push(...j.items);
      pageToken = j.nextPageToken;
      if (j.nextSyncToken) nextSyncToken = j.nextSyncToken;
    } while (pageToken);

    let upserts = 0, deletes = 0, skipped = 0;
    for (const ev of events) {
      const jgIdHint: string | undefined = ev.extendedProperties?.private?.jg_recording_id;
      const evId: string = ev.id;
      if (ev.status === "cancelled") {
        const { data: matched } = await db.from("recordings")
          .select("id")
          .or(`google_event_id.eq.${evId}${jgIdHint ? `,id.eq.${jgIdHint}` : ""}`)
          .maybeSingle();
        if (matched?.id) {
          await db.from("recordings").update({ status: "cancelado", google_synced_at: new Date().toISOString() }).eq("id", matched.id);
          deletes++;
        } else { skipped++; }
        continue;
      }
      const parsed = parseEventToRecording(ev);
      if (!parsed) { skipped++; continue; }

      let targetId: string | null = null;
      const { data: byEventId } = await db.from("recordings").select("id").eq("google_event_id", evId).maybeSingle();
      if (byEventId?.id) targetId = byEventId.id;
      else if (jgIdHint) {
        const { data: byHint } = await db.from("recordings").select("id").eq("id", jgIdHint).maybeSingle();
        if (byHint?.id) targetId = byHint.id;
      }

      if (targetId) {
        await db.from("recordings").update({
          ...parsed,
          google_event_id: evId,
          google_synced_at: new Date().toISOString(),
        }).eq("id", targetId);
        upserts++;
      } else {
        await db.from("recordings").insert({
          ...parsed,
          status: "agendado",
          color: "#FBBF24",
          participants: [],
          responsible_name: null,
          client_id: null,
          client_name: null,
          roteiro: "",
          roteiro_sent: false,
          notes: "Importado da Google Agenda",
          created_by: conn.google_email || "Google",
          google_event_id: evId,
          google_synced_at: new Date().toISOString(),
        });
        upserts++;
      }
    }

    if (nextSyncToken) {
      await db.from("google_calendar_connection").update({ sync_token: nextSyncToken }).eq("id", 1);
    }

    return new Response(JSON.stringify({ ok: true, upserts, deletes, skipped, total: events.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
