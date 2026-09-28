-- Run only on hosted Supabase, after provisioning pg_cron, pg_net and Vault.
-- Vault names required: jg_social_project_url, jg_social_cron_secret.
-- Cron secret must match the Edge Function JG_SOCIAL_CRON_SECRET (32+ random chars).
-- No secret values are embedded in job SQL. Jobs are installed PAUSED.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.alter_job(cron.schedule('jg-social-dispatch','* * * * *', $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='jg_social_project_url') || '/functions/v1/jg-social-dispatch',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='jg_social_cron_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 60000
 );
$job$), active := false);
select cron.alter_job(cron.schedule('jg-social-reconcile','*/5 * * * *', $job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='jg_social_project_url') || '/functions/v1/jg-social-reconcile',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='jg_social_cron_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 60000
 );
$job$), active := false);
commit;
-- After the documented E2E acceptance checks, activate these two jobs in Cron UI.
-- Inspect net._http_response as well as cron.job_run_details: job success alone
-- confirms enqueueing, not a successful HTTP response or remote acknowledgement.
