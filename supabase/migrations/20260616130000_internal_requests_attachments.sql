-- internal_requests: colunas que o app já escrevia (mapRequestToDB) mas não existiam.
-- Sem elas, todo upsert de criar requisição falhava (PostgREST PGRST204:
-- column "attachments"/"delivery_links" does not exist) → requisição não persistia.
alter table public.internal_requests add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.internal_requests add column if not exists delivery_links jsonb not null default '[]'::jsonb;
