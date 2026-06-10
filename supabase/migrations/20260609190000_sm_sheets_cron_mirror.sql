-- ============================================================
-- Atualiza o cron para espelhar TODAS as abas (mirror) a cada 2 min.
-- ============================================================

-- Remove o job antigo (pull de aba única)
DO $$
BEGIN
  PERFORM cron.unschedule('sm_sheets_pull_every_min');
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('sm_sheets_mirror_every_2min');
EXCEPTION WHEN OTHERS THEN NULL;
END
$$;

-- Espelha todas as abas a cada 2 minutos
SELECT cron.schedule(
  'sm_sheets_mirror_every_2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url    := 'https://igmwcdeuqoudrwsmwgpl.supabase.co/functions/v1/google-sheets-mirror',
    headers:= '{"Content-Type": "application/json"}'::jsonb,
    body   := '{}'::jsonb
  );
  $$
);
