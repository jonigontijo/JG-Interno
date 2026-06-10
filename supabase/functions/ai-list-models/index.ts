// ============================================================
// ai-list-models — Lista os modelos disponíveis de um provedor de IA
// ------------------------------------------------------------
// Chama a API do provedor server-side (evita CORS) usando o token.
// Body: { provider, api_key, base_url? }
// Resposta: { ok, count, models: string[] }
// Exige usuário autenticado (JWT).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // exige usuário autenticado
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const provider = String(body.provider || "").trim();
    const apiKey = String(body.api_key || "").trim();
    const baseUrl = body.base_url ? String(body.base_url).trim() : "";
    if (!provider || !apiKey) return json({ error: "missing_fields", required: ["provider", "api_key"] }, 400);

    // helper p/ APIs OpenAI-compatíveis ({ data: [{ id }] })
    const readOpenAIList = async (url: string, headers: Record<string, string>): Promise<string[]> => {
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      return (j.data || []).map((m: any) => m.id).filter(Boolean);
    };

    let models: string[] = [];

    if (provider === "openai") {
      const all = await readOpenAIList("https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` });
      // só modelos de chat
      models = all.filter((id) => /^(gpt|o1|o3|o4|chatgpt)/i.test(id));
    } else if (provider === "groq") {
      models = await readOpenAIList("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${apiKey}` });
    } else if (provider === "openrouter") {
      models = await readOpenAIList("https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${apiKey}` });
    } else if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=100", {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      models = (j.data || []).map((m: any) => m.id).filter(Boolean);
    } else if (provider === "google") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = await r.json();
      models = (j.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m: any) => String(m.name || "").replace(/^models\//, ""))
        .filter(Boolean);
    } else {
      // custom (OpenAI-compatível)
      const base = (baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
      models = await readOpenAIList(`${base}/models`, { Authorization: `Bearer ${apiKey}` });
    }

    models = [...new Set(models)].sort();
    return json({ ok: true, count: models.length, models });
  } catch (e) {
    return json({ error: "fetch_failed", detail: String((e as Error)?.message || e) }, 502);
  }
});
