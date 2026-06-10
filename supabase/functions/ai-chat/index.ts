// Chat com IA — relay multi-provedor.
// Lê o token de sm_ai_api_keys (service role) e chama o provedor escolhido.
// Body: { key_id, messages: [{role,content}], system?, context? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const DEFAULTS: Record<string, { base?: string; model: string }> = {
  openai:     { base: "https://api.openai.com/v1",        model: "gpt-4o-mini" },
  groq:       { base: "https://api.groq.com/openai/v1",   model: "llama-3.3-70b-versatile" },
  openrouter: { base: "https://openrouter.ai/api/v1",     model: "openai/gpt-4o-mini" },
  anthropic:  { model: "claude-3-5-sonnet-latest" },
  google:     { model: "gemini-1.5-flash" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // exige usuário autenticado
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const { key_id, messages, system, context, model: reqModel } = body;
    if (!key_id || !Array.isArray(messages)) return json({ error: "missing_fields", required: ["key_id", "messages"] }, 400);

    const { data: key } = await db.from("sm_ai_api_keys").select("*").eq("id", key_id).eq("is_active", true).maybeSingle();
    if (!key) return json({ error: "key_not_found_or_inactive" }, 404);

    const provider = key.provider as string;
    const def = DEFAULTS[provider] || DEFAULTS.openai;
    const model = (typeof reqModel === "string" && reqModel.trim()) ? reqModel.trim() : (key.model || def.model);
    const apiKey = key.api_key as string;

    // monta o system prompt com o contexto da página
    const systemPrompt = [
      system || "Você é um assistente do sistema interno da JG (agência de marketing). Responda em português do Brasil, de forma objetiva e útil.",
      context ? `\n\n## Contexto da tela que o usuário está vendo agora:\n${typeof context === "string" ? context : JSON.stringify(context).slice(0, 12000)}` : "",
    ].join("");

    let reply = "";

    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: 2048, system: systemPrompt,
          messages: messages.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
        }),
      });
      if (!r.ok) return json({ error: "provider_error", detail: (await r.text()).slice(0, 400) }, 502);
      const j = await r.json();
      reply = (j.content || []).map((c: any) => c.text).filter(Boolean).join("\n");
    } else if (provider === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = messages.map((m: any) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const r = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents }),
      });
      if (!r.ok) return json({ error: "provider_error", detail: (await r.text()).slice(0, 400) }, 502);
      const j = await r.json();
      reply = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).filter(Boolean).join("\n");
    } else {
      // OpenAI-compatível (openai, groq, openrouter, custom)
      const base = (provider === "custom" ? key.base_url : def.base) || "https://api.openai.com/v1";
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages.map((m: any) => ({ role: m.role, content: m.content }))],
          temperature: 0.4,
        }),
      });
      if (!r.ok) return json({ error: "provider_error", detail: (await r.text()).slice(0, 400) }, 502);
      const j = await r.json();
      reply = j.choices?.[0]?.message?.content || "";
    }

    // log da ação
    await db.from("sm_ai_logs").insert({
      command: messages[messages.length - 1]?.content?.slice(0, 2000) || "",
      action_type: "custom_command",
      result: reply.slice(0, 4000),
      success: true,
    });

    return json({ ok: true, reply, model, provider });
  } catch (e) {
    return json({ error: "internal_error", detail: String((e as Error)?.message || e) }, 500);
  }
});
