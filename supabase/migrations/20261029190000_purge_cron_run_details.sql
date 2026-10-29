-- ============================================================
-- Limpeza diaria do historico do pg_cron.
--
-- cron.job_run_details nunca era limpa: em 29/10/2026 tinha 204 mil linhas
-- (73 MB, ~70% do banco) desde 03/06, alimentada pelo autosync a cada minuto.
-- Na instancia free isso pesava junto na exaustao que derrubou o banco.
-- O expurgo inicial (>7 dias) e este agendamento ja foram aplicados em
-- producao manualmente em 29/10; esta migration so registra o estado.
-- ============================================================

DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days';

DO $$
BEGIN PERFORM cron.unschedule('purge_cron_run_details_daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 06:15 UTC = 03:15 BRT
SELECT cron.schedule(
  'purge_cron_run_details_daily',
  '15 6 * * *',
  $$delete from cron.job_run_details where start_time < now() - interval '7 days'$$
);
