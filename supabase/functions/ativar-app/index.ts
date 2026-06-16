// Supabase Edge Function (JG Interno) — POST /functions/v1/ativar-app
// ============================================================
// "Ativar acesso ao app" para um client: provisiona a conta no JG App e
// guarda o vínculo (jg_app_cliente_id) no client. Idempotente.
//
// Deploy: supabase functions deploy ativar-app   (verify_jwt = true)
// Secrets: JG_APP_PROVISION_URL, JG_APP_EVENTS_SECRET (segredo compartilhado)
//
// Body: { client_id, email? }   // email sobrescreve/preenche clients.email
// Retorna: { ok, cliente_id, criou_login, senha_temporaria? }
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return j({ erro: 'method_not_allowed' }, 405);

  const provisionUrl = Deno.env.get('JG_APP_PROVISION_URL') ?? '';
  const secret = Deno.env.get('JG_APP_EVENTS_SECRET') ?? '';
  if (!provisionUrl || !secret) return j({ erro: 'integracao_nao_configurada' }, 500);

  let body: any;
  try { body = await req.json(); } catch { return j({ erro: 'json_invalido' }, 400); }
  const clientId = String(body.client_id ?? '');
  if (!clientId) return j({ erro: 'client_id_obrigatorio' }, 400);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // ── Gate: só admin (is_admin) pode provisionar ──────────────────────────────
  // verify_jwt=true garante token válido; aqui exigimos o papel.
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const uid = userData?.user?.id;
  if (userErr || !uid) return j({ erro: 'nao_autenticado' }, 401);
  const { data: perfil } = await db.from('profiles').select('is_admin').eq('id', uid).maybeSingle();
  if (!perfil?.is_admin) return j({ erro: 'apenas_admin' }, 403);

  // 1) lê o client
  const { data: client, error: cErr } = await db
    .from('clients').select('id, name, email, whatsapp, jg_app_cliente_id').eq('id', clientId).maybeSingle();
  if (cErr) return j({ erro: 'db_error', detail: cErr.message }, 500);
  if (!client) return j({ erro: 'client_nao_encontrado', client_id: clientId }, 404);

  const email = String(body.email ?? client.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return j({ erro: 'email_obrigatorio' }, 400);

  // 2) provisiona no JG App
  const resp = await fetch(provisionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${secret}` },
    body: JSON.stringify({ nome: client.name, email, whatsapp: client.whatsapp ?? null }),
  });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok || !out?.cliente_id) {
    return j({ ok: false, erro: 'provisionamento_falhou', status: resp.status, detail: out }, 502);
  }

  // 3) grava vínculo + email no client
  await db.from('clients').update({ jg_app_cliente_id: out.cliente_id, email }).eq('id', clientId);

  return j({
    ok: true,
    cliente_id: out.cliente_id,
    criou_login: out.criou_login ?? false,
    ...(out.senha_temporaria ? { senha_temporaria: out.senha_temporaria } : {}),
  });
});
