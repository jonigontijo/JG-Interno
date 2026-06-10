-- ============================================================
-- INTEGRAÇÕES IA + CALLBACK — Módulo Social Media
-- Criado em: 2026-06-09
-- - sm_ai_api_keys: tokens de APIs de IA (OpenAI, Anthropic, etc.)
-- - sm_integration_settings: webhook + segredo do callback
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Tokens de API de IA
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sm_ai_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL,          -- 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'custom'
  label         text,                   -- nome amigável (ex: "OpenAI Produção")
  api_key       text NOT NULL,          -- token (lido apenas por service_role nas edge functions)
  model         text,                   -- modelo padrão (ex: 'gpt-4o', 'claude-sonnet-4')
  base_url      text,                   -- para provedores custom / self-hosted
  is_active     boolean NOT NULL DEFAULT true,

  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Configurações de integração (linha única)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sm_integration_settings (
  id                    integer PRIMARY KEY DEFAULT 1,

  -- Webhook de saída (disparado ao criar aprovação)
  approval_webhook_url  text NOT NULL DEFAULT 'https://webhooks.techjg.com.br/webhook/aprovacao',

  -- Segredo compartilhado: o n8n / app do cliente envia este valor no header
  -- "x-jg-secret" ao chamar a edge function de callback. Protege o endpoint.
  callback_secret       text NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),

  -- Webhook opcional para a IA agendadora (n8n) receber comandos
  ai_command_webhook_url text,

  updated_by            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sm_integration_settings_singleton CHECK (id = 1)
);

-- Garante que a linha única exista
INSERT INTO sm_integration_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- Triggers updated_at
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_ai_api_keys_updated_at') THEN
    CREATE TRIGGER trg_sm_ai_api_keys_updated_at
      BEFORE UPDATE ON sm_ai_api_keys
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_integration_settings_updated_at') THEN
    CREATE TRIGGER trg_sm_integration_settings_updated_at
      BEFORE UPDATE ON sm_integration_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- RLS — somente admin / social_media
-- ────────────────────────────────────────────────────────────

ALTER TABLE sm_ai_api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage sm_ai_api_keys"
  ON sm_ai_api_keys FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'admin' = ANY(roles))
  ));

CREATE POLICY "Admin manage sm_integration_settings"
  ON sm_integration_settings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR 'admin' = ANY(roles))
  ));
