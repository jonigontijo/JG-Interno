-- Additive integration. No HTTP requests or production transmission on migration.
create table public.jg_sm_clients (
  client_id text primary key, name text not null default '', remote_id text unique,
  reviewed boolean not null default false, version bigint not null default 0,
  desired_status text, fingerprint jsonb, issue text, last_received_at timestamptz,
  reconciled_at timestamptz, reconcile_attempted_at timestamptz, updated_at timestamptz not null default now()
);
create table public.jg_sm_outbox (
  id uuid primary key default gen_random_uuid(), client_id text not null references public.jg_sm_clients(client_id),
  version bigint not null, event_type text not null, payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','sending','delivered','needs_attention')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_id uuid, lease_until timestamptz, last_error text, delivered_at timestamptz,
  created_at timestamptz not null default now(), unique(client_id,version)
);
create index jg_sm_outbox_due on public.jg_sm_outbox(status,next_attempt_at);
create table public.jg_sm_inbox (
  event_id text primary key, content jsonb not null, received_at timestamptz not null default now()
);
create table public.jg_sm_publications (
  client_id text not null references public.jg_sm_clients(client_id), post_id text not null,
  version bigint not null, data jsonb not null, first_due_date timestamptz not null,
  updated_at timestamptz not null default now(), primary key(client_id,post_id)
);
create table public.jg_sm_publication_history (
  client_id text not null, post_id text not null, version bigint not null, data jsonb not null,
  received_at timestamptz not null default now(), primary key(client_id,post_id,version)
);
create table public.jg_sm_runs (
  id uuid primary key default gen_random_uuid(), kind text not null, client_id text,
  success boolean not null, detail text, created_at timestamptz not null default now()
);

create function public.jg_sm_can_read(p_admin boolean default false) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from profiles where id=auth.uid() and active and
 (is_admin or (not p_admin and ('social' = any(module_access) or 'social-media' = any(module_access) or 'social-dashboard' = any(module_access)))))
$$;
revoke all on function public.jg_sm_can_read(boolean) from public;
grant execute on function public.jg_sm_can_read(boolean) to authenticated;
do $$ declare t text; begin
 foreach t in array array['jg_sm_clients','jg_sm_outbox','jg_sm_inbox','jg_sm_publications','jg_sm_publication_history','jg_sm_runs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t <> 'jg_sm_inbox' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy read_integration on public.%I for select to authenticated using (public.jg_sm_can_read(%L))',t,t in ('jg_sm_outbox','jg_sm_runs','jg_sm_publication_history'));
 end if;
 end loop;
end $$;

create function public.jg_sm_refresh_client(p_id text, p_new boolean default false, p_deleted boolean default false) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c clients; s jg_sm_clients; has_sm boolean; ready boolean; target text; body jsonb; ev text; eid uuid; qty integer;
begin
 insert into jg_sm_clients(client_id,reviewed) values(p_id,p_new) on conflict do nothing;
 select * into s from jg_sm_clients where client_id=p_id for update;
 select * into c from clients where id=p_id;
 if not found or p_deleted then
   if s.version=0 then return; end if;
   target:='cancelled'; body:=s.fingerprint || jsonb_build_object('service_status',target);
 else
   has_sm:=exists(select 1 from unnest(c.services) x where x ilike 'Social Media%');
   ready:=c.status='Operação' or exists(select 1 from client_pipelines where client_id=p_id and (5=any(completed_steps) or current_step_order>5))
     or exists(select 1 from tasks where client_id=p_id and id='t-pipe-'||p_id||'-5' and type='pipeline' and status='done');
   if not has_sm and s.version=0 then
     update jg_sm_clients set name=c.company,issue=case when coalesce(c.social_media_posts,0)>0 then 'Quantidade de posts sem serviço Social Media cadastrado' else null end where client_id=p_id;
     return;
   end if;
   if s.version=0 and not ready then return; end if;
   target:=case when not has_sm or c.substatus='Cancelado' then 'cancelled' when c.substatus in ('Inativo','Pausado','Suspenso') then 'suspended' when c.substatus='Ativo' then 'active' else null end;
   if target is null then update jg_sm_clients set issue='Situação do cliente não reconhecida: '||c.substatus where client_id=p_id; return; end if;
   if s.version=0 and target<>'active' then return; end if;
   qty:=c.social_media_posts;
   if target='active' and (qty is null or qty<=0) then
     update jg_sm_clients set name=c.company,issue='Preencher quantidade semanal de posts' where client_id=p_id; return;
   end if;
   body:=jsonb_build_object('jg_interno_client_id',p_id,'name',c.company,
     'plan_name',(select string_agg(x,', ' order by x) from unnest(c.services) x where x ilike 'Social Media%'),
     'quantities',case when target<>'active' and s.fingerprint is not null then s.fingerprint->'quantities' else jsonb_build_object('posts',qty) end,
     'periodicity','weekly','service_status',target);
 end if;
 if body is not distinct from s.fingerprint then
   update jg_sm_clients set issue=case when reviewed then null else 'Revisar vínculo do cliente existente' end where client_id=p_id; return;
 end if;
 ev:=case when s.version=0 then 'client.activated' when target='cancelled' then 'client.service_cancelled'
   when target='suspended' then 'client.service_suspended' when s.desired_status in ('suspended','cancelled') then 'client.service_reactivated' else 'client.plan_updated' end;
 eid:=gen_random_uuid();
 insert into jg_sm_outbox(id,client_id,version,event_type,payload) values(eid,p_id,s.version+1,ev,
   jsonb_build_object('event_id',eid,'event_type',ev,'timestamp',now(),'version',s.version+1,'data',body||jsonb_build_object('effective_date',now())));
 update jg_sm_clients set name=body->>'name',version=s.version+1,desired_status=target,fingerprint=body,
   issue=case when reviewed then null else 'Revisar vínculo do cliente existente' end,updated_at=now() where client_id=p_id;
end $$;

create function public.jg_sm_capture() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='clients' then
   perform jg_sm_refresh_client(case when tg_op='DELETE' then old.id else new.id end,tg_op='INSERT',tg_op='DELETE');
 elsif tg_table_name='tasks' then
   if new.type='pipeline' and new.status='done' and new.id='t-pipe-'||new.client_id||'-5' then perform jg_sm_refresh_client(new.client_id); end if;
 else perform jg_sm_refresh_client(new.client_id);
 end if;
 return null;
end $$;
create trigger jg_sm_client_capture after insert or update or delete on public.clients for each row execute function public.jg_sm_capture();
create trigger jg_sm_pipeline_capture after insert or update on public.client_pipelines for each row execute function public.jg_sm_capture();
create trigger jg_sm_task_capture after insert or update on public.tasks for each row execute function public.jg_sm_capture();

create function public.jg_sm_claim(p_limit integer default 20) returns setof public.jg_sm_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 return query with picked as (
 select o.id from jg_sm_outbox o join jg_sm_clients c on c.client_id=o.client_id
 where c.reviewed and (c.issue is null) and ((o.status='pending' and o.next_attempt_at<=now()) or (o.status='sending' and o.lease_until<now()))
 and not exists(select 1 from jg_sm_outbox older where older.client_id=o.client_id and older.version<o.version and older.status<>'delivered')
 order by o.created_at limit least(greatest(p_limit,1),20) for update of o skip locked
 ) update jg_sm_outbox o set status='sending',lease_id=gen_random_uuid(),lease_until=now()+interval '120 seconds',attempts=attempts+1
 from picked where o.id=picked.id returning o.*;
end $$;
create function public.jg_sm_finish(p_id uuid,p_lease uuid,p_ok boolean,p_error text default null,p_remote text default null) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare o jg_sm_outbox; delay integer;
begin
 select * into o from jg_sm_outbox where id=p_id and lease_id=p_lease and status='sending' for update;
 if not found then return false; end if;
 delay:=(array[60,300,900,3600,14400,86400])[o.attempts];
 if p_ok and p_remote is not null then
   if exists(select 1 from jg_sm_clients where client_id=o.client_id and remote_id is not null and remote_id<>p_remote) then raise exception 'remote_id_conflict'; end if;
   update jg_sm_clients set remote_id=p_remote where client_id=o.client_id;
 end if;
 update jg_sm_outbox set status=case when p_ok then 'delivered' when delay is null then 'needs_attention' else 'pending' end,
   delivered_at=case when p_ok then now() end,last_error=case when p_ok then null else left(p_error,300) end,
   next_attempt_at=now()+make_interval(secs=>coalesce(delay,86400)),lease_id=null,lease_until=null where id=p_id;
 return true;
end $$;

create function public.jg_sm_apply(p_event jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare d jsonb:=p_event->'data'; cid text:=d->>'jg_interno_client_id'; pid text:=d->>'post_id';
 eid text:=p_event->>'event_id'; v bigint:=(d->>'version')::bigint; old jg_sm_publications; prior jsonb; due timestamptz;
begin
 -- Serialize client publications and inbox decisions. No untrusted SQL identifiers.
 perform 1 from jg_sm_clients where client_id=cid and remote_id is not null for update;
 if not found then raise exception 'unknown_client'; end if;
 if d->>'social_media_client_id' is not null and not exists(select 1 from jg_sm_clients where client_id=cid and remote_id=d->>'social_media_client_id') then raise exception 'client_link_conflict'; end if;
 -- An event ID reused across clients must not race.
 perform pg_advisory_xact_lock(hashtextextended(eid,0));
 select content into prior from jg_sm_inbox where event_id=eid;
 if found then
   if prior<>p_event then raise exception 'event_conflict'; end if;
   return jsonb_build_object('success',true,'event_id',eid,'is_duplicate',true);
 end if;
 select * into old from jg_sm_publications where client_id=cid and post_id=pid;
 if found and old.version=v and old.data<>d then raise exception 'version_conflict'; end if;
 insert into jg_sm_inbox(event_id,content) values(eid,p_event);
 if old.version is null or v>old.version then
   due:=least(old.first_due_date,coalesce((d->>'previous_due_date')::timestamptz,(d->>'due_date')::timestamptz),(d->>'due_date')::timestamptz);
   insert into jg_sm_publications(client_id,post_id,version,data,first_due_date) values(cid,pid,v,d,due)
   on conflict(client_id,post_id) do update set version=excluded.version,data=excluded.data,first_due_date=excluded.first_due_date,updated_at=now();
   insert into jg_sm_publication_history(client_id,post_id,version,data) values(cid,pid,v,d);
 end if;
 update jg_sm_clients set last_received_at=now() where client_id=cid;
 return jsonb_build_object('success',true,'event_id',eid,'is_duplicate',false);
end $$;

-- All mutation entry points are server-only, including trigger helpers.
revoke all on function public.jg_sm_refresh_client(text,boolean,boolean), public.jg_sm_capture(), public.jg_sm_claim(integer), public.jg_sm_finish(uuid,uuid,boolean,text,text), public.jg_sm_apply(jsonb) from public,anon,authenticated;
grant execute on function public.jg_sm_refresh_client(text,boolean,boolean), public.jg_sm_claim(integer), public.jg_sm_finish(uuid,uuid,boolean,text,text), public.jg_sm_apply(jsonb) to service_role;
