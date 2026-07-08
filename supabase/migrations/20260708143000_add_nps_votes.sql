create table if not exists nps_votes (
  id uuid primary key,
  jginterno_username text,
  gestor_nome text,
  jginterno_member_id text,
  client_name text,
  jg_app_cliente_id uuid,
  nota integer not null,
  comentario text,
  created_at timestamptz not null default now()
);

alter table nps_votes enable row level security;

drop policy if exists nps_votes_full_access on nps_votes;
create policy nps_votes_full_access on nps_votes for all to authenticated using (true) with check (true);
