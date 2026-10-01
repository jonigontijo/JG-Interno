-- Optional null fields and false flags are equivalent to omission.
-- Existing stored rows remain untouched; substantive version conflicts still fail.
create or replace function public.jg_sm_apply(p_event jsonb) returns jsonb
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
 if found and old.version=v and jsonb_strip_nulls('{"is_deleted":false,"is_cancelled":false}'::jsonb || old.data) <> jsonb_strip_nulls('{"is_deleted":false,"is_cancelled":false}'::jsonb || d) then raise exception 'version_conflict'; end if;
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

