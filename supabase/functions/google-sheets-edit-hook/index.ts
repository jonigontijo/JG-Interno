// Recebe edições EM TEMPO REAL da planilha via Google Apps Script (onEdit).
// O Apps Script dispara no instante que uma célula é editada e chama este endpoint.
// Body: { secret, tab, startRow (1-based), startCol (1-based), values: string[][] }
// Atualiza sm_sheet_data → Realtime atualiza a grade no app na hora.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-jg-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function hashRow(cells: string[]): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(cells)))).slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const providedSecret = body.secret || req.headers.get("x-jg-secret") || "";

    const { data: settings } = await db.from("sm_integration_settings").select("callback_secret").eq("id", 1).maybeSingle();
    if (!settings?.callback_secret || providedSecret !== settings.callback_secret) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const tab = String(body.tab || "");
    const startRow = Number(body.startRow);   // 1-based (linha do Sheets)
    const startCol = Number(body.startCol);   // 1-based (coluna do Sheets)
    const values = body.values as any[][];
    if (!tab || !startRow || !startCol || !Array.isArray(values)) {
      return json({ ok: false, error: "missing_fields", required: ["tab", "startRow", "startCol", "values"] }, 400);
    }

    // localiza a aba
    const { data: tabRow } = await db.from("sm_sheet_tabs").select("id").eq("title", tab).maybeSingle();
    if (!tabRow) return json({ ok: false, error: "tab_not_found", tab }, 404);

    let updated = 0;
    for (let i = 0; i < values.length; i++) {
      const rowIndex = (startRow - 1) + i; // 0-based no nosso modelo
      const rowVals = values[i] || [];

      // busca a linha atual (se existir)
      const { data: existing } = await db.from("sm_sheet_data").select("cells").eq("tab_id", tabRow.id).eq("row_index", rowIndex).maybeSingle();
      const cells: string[] = existing?.cells ? [...existing.cells] : [];

      for (let j = 0; j < rowVals.length; j++) {
        const colIndex = (startCol - 1) + j; // 0-based
        while (cells.length <= colIndex) cells.push("");
        cells[colIndex] = (rowVals[j] ?? "").toString();
      }

      await db.from("sm_sheet_data").upsert({
        tab_id: tabRow.id,
        row_index: rowIndex,
        cells,
        source_hash: hashRow(cells),
      }, { onConflict: "tab_id,row_index" });
      updated++;
    }

    return json({ ok: true, tab, updated });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
