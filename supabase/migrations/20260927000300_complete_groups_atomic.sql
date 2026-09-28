-- Narrow atomic transition at the integration boundary; other pipeline steps stay unchanged.
create function public.jg_sm_complete_groups(p_client text,p_minutes integer default 0) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare p client_pipelines; c clients; assignee_name text;
begin
 if not exists(select 1 from profiles where id=auth.uid() and active and
 (is_admin or role in ('Financeiro','Diretoria') or roles && array['Financeiro','Diretoria'])) then raise exception 'forbidden'; end if;
 -- Match client-update lock order before pipeline/state locks.
 select * into c from clients where id=p_client for update;
 if not found then raise exception 'unknown_client'; end if;
 select * into p from client_pipelines where client_id=p_client for update;
 if not found then raise exception 'missing_pipeline'; end if;
 if 5=any(p.completed_steps) then return false; end if;
 if p.current_step_order<>5 then raise exception 'wrong_step'; end if;
 update tasks set status='done',completed_at=now()::text,time_spent_minutes=greatest(p_minutes,0)
 where id='t-pipe-'||p_client||'-5' and client_id=p_client and type='pipeline';
 if not found then raise exception 'missing_task'; end if;
 select name into assignee_name from team_members where role ilike '%Gerente Operacional%' or exists(select 1 from unnest(roles) r where r ilike '%Gerente Operacional%') order by id limit 1;
 insert into tasks(id,title,client,client_id,module,sector,type,assignee,deadline,urgency,status,weight,estimated_hours)
 values('t-pipe-'||p_client||'-6','[Onboarding] Kickoff - Reunião de alinhamento',c.company,p_client,'Onboarding','Onboarding','pipeline',coalesce(assignee_name,'Não atribuído'),to_char(now()+interval '5 days','YYYY-MM-DD'),'priority','pending',3,2)
 on conflict(id) do nothing;
 update client_pipelines set completed_steps=array_append(completed_steps,5),current_step_order=6 where client_id=p_client;
 update clients set status='Onboarding' where id=p_client;
 return true;
end $$;
revoke all on function public.jg_sm_complete_groups(text,integer) from public,anon;
grant execute on function public.jg_sm_complete_groups(text,integer) to authenticated;
