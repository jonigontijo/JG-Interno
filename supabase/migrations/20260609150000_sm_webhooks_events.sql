-- ============================================================
-- Sistema de Webhooks por EVENTO — Social Media
-- Cada webhook se inscreve em eventos específicos. Ao ocorrer
-- um evento, o sistema dispara POST para todas as URLs inscritas.
-- ============================================================

CREATE TABLE IF NOT EXISTS sm_webhooks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                       -- nome amigável
  url           text NOT NULL,                       -- destino do POST
  events        text[] NOT NULL DEFAULT '{}',        -- eventos inscritos (ex: {'approval.created'})
  secret        text,                                 -- enviado no header x-jg-event-secret (opcional)
  is_active     boolean NOT NULL DEFAULT true,

  -- Estatísticas de disparo
  last_fired_at      timestamptz,
  last_status        integer,                          -- último HTTP status retornado
  last_error         text,
  fire_count         integer NOT NULL DEFAULT 0,

  created_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_webhooks_active ON sm_webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_sm_webhooks_events ON sm_webhooks USING gin(events);

-- Trigger updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sm_webhooks_updated_at') THEN
    CREATE TRIGGER trg_sm_webhooks_updated_at
      BEFORE UPDATE ON sm_webhooks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- RLS aberta a todos autenticados (mesma regra do restante do módulo)
ALTER TABLE sm_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated sm_webhooks"
  ON sm_webhooks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- Migra o webhook de aprovação existente para o novo modelo,
-- inscrito SOMENTE no evento "Post enviado para aprovação".
-- ────────────────────────────────────────────────────────────
INSERT INTO sm_webhooks (name, url, events, is_active)
SELECT
  'Aprovação de Conteúdo (cliente)',
  COALESCE(approval_webhook_url, 'https://webhooks.techjg.com.br/webhook/aprovacao'),
  ARRAY['approval.created'],
  true
FROM sm_integration_settings
WHERE id = 1
ON CONFLICT DO NOTHING;
