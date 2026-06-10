-- ============================================================
-- Sync automático da planilha (planilha → app) via pg_cron + pg_net
-- Chama a Edge Function google-sheets-pull a cada 1 minuto.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('sm_sheets_pull_every_min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

-- Agenda o pull a cada minuto
SELECT cron.schedule(
  'sm_sheets_pull_every_min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url    := 'https://igmwcdeuqoudrwsmwgpl.supabase.co/functions/v1/google-sheets-pull',
    headers:= '{"Content-Type": "application/json"}'::jsonb,
    body   := '{}'::jsonb
  );
  $$
);
