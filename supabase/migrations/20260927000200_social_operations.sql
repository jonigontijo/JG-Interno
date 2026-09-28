create function public.jg_sm_recheck() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare c record; n integer:=0;
begin
 for c in select id from clients where exists(select 1 from unnest(services) s where s ilike 'Social Media%') or coalesce(social_media_posts,0)>0 or id in(select client_id from jg_sm_clients where version>0) loop
   perform jg_sm_refresh_client(c.id);n:=n+1;
 end loop;
 return n;
end $$;
create function public.jg_sm_admin_action(p_client text,p_action text,p_remote text,p_event uuid,p_actor uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from profiles where id=p_actor and active and is_admin) then raise exception 'forbidden'; end if;
 perform 1 from jg_sm_clients where client_id=p_client for update;
 if not found then raise exception 'unknown_client'; end if;
 if p_action='link_existing' then
   if p_remote is null or p_remote='' or exists(select 1 from jg_sm_clients where client_id=p_client and remote_id is not null and remote_id<>p_remote) then raise exception 'invalid_link'; end if;
   update jg_sm_clients set reviewed=true,remote_id=p_remote where client_id=p_client;
 elsif p_action='approve_new' then
   update jg_sm_clients set reviewed=true where client_id=p_client;
 elsif p_action='retry_event' then
   update jg_sm_outbox set status='pending',attempts=0,next_attempt_at=now(),last_error=null where id=p_event and client_id=p_client and status in ('pending','needs_attention');
   if not found then raise exception 'event_not_retryable'; end if;
 else raise exception 'invalid_action'; end if;
 perform jg_sm_refresh_client(p_client);
 insert into jg_sm_runs(kind,client_id,success,detail) values(p_action,p_client,true,'actor='||p_actor::text);
end $$;
revoke all on function public.jg_sm_recheck(), public.jg_sm_admin_action(text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.jg_sm_recheck(), public.jg_sm_admin_action(text,text,text,uuid,uuid) to service_role;

-- Backfill captures eligible legacy clients, but all require association review.
select public.jg_sm_recheck();
