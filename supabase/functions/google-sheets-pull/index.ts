// Puxa a planilha de clientes do Google Sheets e espelha em sm_sheet_clients.
// Estratégia de leitura:
//   1) Se houver OAuth conectado (refresh_token) → usa Sheets API (planilha privada).
//   2) Senão → tenta o export CSV público (planilha compartilhada por link).
// Reconcilia por row_index: upsert das linhas existentes, remove as que sumiram.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Parser CSV simples com suporte a aspas e quebras de linha dentro de células
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignora */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Usa a MESMA conexão OAuth do Google Agenda (google_calendar_connection).
// O token precisa ter o scope spreadsheets (concedido ao reconectar o Calendar).
async function getValidAccessToken(db: any): Promise<string | null> {
  const { data: cal } = await db.from("google_calendar_connection")
    .select("access_token, refresh_token, expires_at").eq("id", 1).maybeSingle();
  if (!cal?.refresh_token) return null;
  if (cal.access_token && cal.expires_at && new Date(cal.expires_at).getTime() > Date.now() + 60000) {
    return cal.access_token;
  }
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return cal.access_token || null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: cal.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!r.ok) return cal.access_token || null;
  const tok = await r.json();
  const access = tok.access_token;
  const expiresAt = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  await db.from("google_calendar_connection").update({ access_token: access, expires_at: expiresAt }).eq("id", 1);
  return access;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: conn } = await db.from("sm_sheets_connection").select("*").eq("id", 1).maybeSingle();
    const spreadsheetId = conn?.spreadsheet_id;
    if (!spreadsheetId) return json({ ok: false, reason: "no_spreadsheet_id" }, 400);

    // ── 1) Lê os valores ──
    let values: string[][] = [];
    const accessToken = await getValidAccessToken(db);

    let usedSource = "csv_public";
    let sheetsApiTried = false;
    if (accessToken) {
      sheetsApiTried = true;
      const range = conn?.sheet_name ? `${conn.sheet_name}!${conn.sheet_range || "A:E"}` : (conn?.sheet_range || "A:E");
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const r = await fetch(apiUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (r.ok) {
        const j = await r.json();
        values = j.values || [];
        usedSource = "sheets_api";
      }
      // se falhou (ex: 403 sem scope spreadsheets) → cai no CSV público abaixo
    }
    if (usedSource !== "sheets_api") {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
      const r = await fetch(csvUrl, { redirect: "follow" });
      if (!r.ok) return json({ ok: false, reason: `csv_export_error_${r.status}`, sheets_api_tried: sheetsApiTried, hint: "reconecte o Google Agenda para conceder o scope de Sheets" }, 502);
      values = parseCsv(await r.text());
    }

    if (values.length < 2) return json({ ok: true, upserts: 0, deletes: 0, total: 0, note: "planilha vazia ou só cabeçalho" });

    // ── 2) Mapeia colunas (ignora cabeçalho) ──
    // CLIENTE, QUANTIDADE DE POST, SEGMENTO, INSTAGRAM, Senhas
    const dataRows = values.slice(1);
    let upserts = 0;
    const seenRowIndexes: number[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const cliente = (r[0] || "").trim();
      if (!cliente) continue; // pula linhas vazias
      const rowIndex = i + 1;
      seenRowIndexes.push(rowIndex);

      const record = {
        cliente,
        quantidade_post: (r[1] || "").trim() || null,
        segmento: (r[2] || "").trim() || null,
        instagram: (r[3] || "").trim() || null,
        senhas: (r[4] || "").trim() || null,
      };
      const sourceHash = btoa(unescape(encodeURIComponent(JSON.stringify(record)))).slice(0, 64);

      const { data: existing } = await db.from("sm_sheet_clients").select("id, source_hash").eq("row_index", rowIndex).maybeSingle();
      if (existing && existing.source_hash === sourceHash) continue; // sem mudança

      await db.from("sm_sheet_clients").upsert({
        row_index: rowIndex,
        ...record,
        source_hash: sourceHash,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "row_index" });
      upserts++;
    }

    // ── 3) Remove linhas que sumiram da planilha ──
    let deletes = 0;
    const { data: allRows } = await db.from("sm_sheet_clients").select("row_index");
    const toDelete = (allRows || []).map((x: any) => x.row_index).filter((ri: number) => !seenRowIndexes.includes(ri));
    if (toDelete.length > 0) {
      await db.from("sm_sheet_clients").delete().in("row_index", toDelete);
      deletes = toDelete.length;
    }

    await db.from("sm_sheets_connection").update({ last_synced_at: new Date().toISOString() }).eq("id", 1);

    return json({ ok: true, upserts, deletes, total: seenRowIndexes.length, source: usedSource });
  } catch (e) {
    return json({ ok: false, reason: String((e as Error)?.message || e) }, 500);
  }
});
