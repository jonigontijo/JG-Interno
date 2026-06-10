-- ============================================================
-- Troca o cron pesado (mirror a cada 2min) pelo autosync inteligente
-- (checa modifiedTime a cada 1min; só roda o mirror quando muda).
-- ============================================================

DO $$
BEGIN PERFORM cron.unschedule('sm_sheets_mirror_every_2min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN PERFORM cron.unschedule('sm_sheets_autosync_every_min'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'sm_sheets_autosync_every_min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url    := 'https://igmwcdeuqoudrwsmwgpl.supabase.co/functions/v1/google-sheets-autosync',
    headers:= '{"Content-Type": "application/json"}'::jsonb,
    body   := '{}'::jsonb
  );
  $$
);
