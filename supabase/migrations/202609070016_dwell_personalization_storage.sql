-- DB-DWELL-01: optional account-only dwell samples. No coordinates, raw arrival/departure,
-- polyline, title, provider URL, guest import, or anonymous Auth data is stored.

-- Per-file transaction limits, reapplied after the CLI's RESET ALL.
set local lock_timeout = '3s';
set local statement_timeout = '60s';

create table public.dwell_personalization_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consent_epoch uuid,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((enabled and consent_epoch is not null) or (not enabled and consent_epoch is null))
);
create table public.dwell_consent_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 200),
  mutation_kind text not null check (mutation_kind in ('set','reset')),
  requested_enabled boolean,
  result_revision bigint not null,
  result_epoch uuid,
  deleted_sample_count integer not null default 0 check (deleted_sample_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key(user_id,request_id,mutation_kind)
);
create table public.dwell_completion_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completion_event_id text not null check (char_length(completion_event_id) between 1 and 200),
  course_run_id text not null check (char_length(course_run_id) between 1 and 200),
  stop_ordinal smallint not null check (stop_ordinal in (1,2)),
  content_id text not null check (char_length(content_id) between 1 and 160),
  category text not null check (char_length(category) between 1 and 120),
  sub_category text not null check (char_length(sub_category) between 1 and 120 and btrim(sub_category) = sub_category),
  actual_dwell_min integer not null check (actual_dwell_min between 1 and 1440),
  arrival_source text not null default 'user_confirmed' check (arrival_source = 'user_confirmed'),
  evidence_schema_version smallint not null default 1 check (evidence_schema_version = 1),
  completed_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  consent_epoch uuid not null,
  consent_revision bigint not null check (consent_revision > 0),
  payload_hash bytea not null,
  unique(user_id,completion_event_id)
);
create index dwell_samples_user_key_completed_idx on public.dwell_completion_samples(user_id,category,sub_category,completed_at,completion_event_id);
create index dwell_samples_completed_idx on public.dwell_completion_samples(completed_at);
create table public.dwell_personalization_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  sub_category text not null,
  sample_count integer not null check (sample_count > 0),
  window_sample_count integer not null check (window_sample_count between 1 and 5),
  median_dwell_min numeric not null check (median_dwell_min > 0),
  newest_completed_at timestamptz not null,
  profile_version bigint not null default 1 check (profile_version > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key(user_id,category,sub_category)
);

alter table public.dwell_personalization_consents enable row level security;
alter table public.dwell_consent_mutations enable row level security;
alter table public.dwell_completion_samples enable row level security;
alter table public.dwell_personalization_profiles enable row level security;
create policy dwell_consents_select_own on public.dwell_personalization_consents for select to authenticated using (public.is_account_user() and user_id=auth.uid());
create policy dwell_samples_select_enabled_own on public.dwell_completion_samples for select to authenticated using (
  public.is_account_user() and user_id=auth.uid() and exists(select 1 from public.dwell_personalization_consents c where c.user_id=auth.uid() and c.enabled)
);
create policy dwell_profiles_select_enabled_own on public.dwell_personalization_profiles for select to authenticated using (
  public.is_account_user() and user_id=auth.uid() and exists(select 1 from public.dwell_personalization_consents c where c.user_id=auth.uid() and c.enabled)
);
revoke all on table public.dwell_personalization_consents,public.dwell_consent_mutations,public.dwell_completion_samples,public.dwell_personalization_profiles from public,anon,authenticated;
grant select on table public.dwell_personalization_consents,public.dwell_completion_samples,public.dwell_personalization_profiles to authenticated;
grant select,insert,update,delete on table public.dwell_personalization_consents,public.dwell_consent_mutations,public.dwell_completion_samples,public.dwell_personalization_profiles to service_role;

create or replace function public.refresh_dwell_profiles_for_user(p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  delete from public.dwell_personalization_profiles where user_id=p_user_id;
  insert into public.dwell_personalization_profiles(user_id,category,sub_category,sample_count,window_sample_count,median_dwell_min,newest_completed_at)
  select grouped.user_id,grouped.category,grouped.sub_category,grouped.sample_count,
    least(grouped.sample_count,5),
    (select percentile_cont(0.5) within group(order by recent.actual_dwell_min)
      from (select s2.actual_dwell_min from public.dwell_completion_samples s2
        where s2.user_id=grouped.user_id and s2.category=grouped.category and s2.sub_category=grouped.sub_category
          and s2.completed_at >= timezone('utc',now())-interval '180 days'
        order by s2.completed_at desc,s2.completion_event_id desc limit 5) recent),
    grouped.newest_completed_at
  from (
    select s.user_id,s.category,s.sub_category,count(*)::integer sample_count,max(s.completed_at) newest_completed_at
    from public.dwell_completion_samples s
    where s.user_id=p_user_id and s.completed_at >= timezone('utc',now())-interval '180 days'
    group by s.user_id,s.category,s.sub_category
    having count(*) >= 3
  ) grouped;
end;
$$;
revoke all on function public.refresh_dwell_profiles_for_user(uuid) from public,anon,authenticated;
grant execute on function public.refresh_dwell_profiles_for_user(uuid) to service_role;

create or replace function public.get_dwell_personalization_consent()
returns table(enabled boolean,consent_epoch uuid,revision bigint,updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  insert into public.dwell_personalization_consents(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  return query select c.enabled,c.consent_epoch,c.revision,c.updated_at from public.dwell_personalization_consents c where c.user_id=auth.uid();
end;
$$;

create or replace function public.set_dwell_personalization_consent(p_request_id text,p_enabled boolean,p_expected_revision bigint)
returns table(status text,enabled boolean,consent_epoch uuid,revision bigint,updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_current public.dwell_personalization_consents%rowtype; v_mutation public.dwell_consent_mutations%rowtype;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_request_id is null or char_length(p_request_id) not between 1 and 200 or p_enabled is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid_input'; end if;
  select * into v_mutation from public.dwell_consent_mutations where user_id=auth.uid() and request_id=p_request_id and mutation_kind='set';
  if found then
    if v_mutation.requested_enabled is distinct from p_enabled then raise exception 'idempotency_conflict'; end if;
    return query select 'unchanged',c.enabled,c.consent_epoch,c.revision,c.updated_at from public.dwell_personalization_consents c where c.user_id=auth.uid(); return;
  end if;
  insert into public.dwell_personalization_consents(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select * into v_current from public.dwell_personalization_consents where user_id=auth.uid() for update;
  if v_current.revision<>p_expected_revision then return query select 'conflict',v_current.enabled,v_current.consent_epoch,v_current.revision,v_current.updated_at; return; end if;
  if v_current.enabled=p_enabled then
    insert into public.dwell_consent_mutations(user_id,request_id,mutation_kind,requested_enabled,result_revision,result_epoch) values(auth.uid(),p_request_id,'set',p_enabled,v_current.revision,v_current.consent_epoch);
    return query select 'unchanged',v_current.enabled,v_current.consent_epoch,v_current.revision,v_current.updated_at; return;
  end if;
  update public.dwell_personalization_consents as c set enabled=p_enabled,consent_epoch=case when p_enabled then gen_random_uuid() else null end,revision=c.revision+1,updated_at=timezone('utc',now()) where c.user_id=auth.uid() returning c.* into v_current;
  insert into public.dwell_consent_mutations(user_id,request_id,mutation_kind,requested_enabled,result_revision,result_epoch) values(auth.uid(),p_request_id,'set',p_enabled,v_current.revision,v_current.consent_epoch);
  return query select 'updated',v_current.enabled,v_current.consent_epoch,v_current.revision,v_current.updated_at;
end;
$$;

create or replace function public.reset_dwell_personalization(p_request_id text,p_expected_revision bigint)
returns table(status text,enabled boolean,consent_epoch uuid,revision bigint,updated_at timestamptz,deleted_sample_count integer)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_current public.dwell_personalization_consents%rowtype; v_mutation public.dwell_consent_mutations%rowtype; v_deleted integer;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_request_id is null or char_length(p_request_id) not between 1 and 200 or p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid_input'; end if;
  select * into v_mutation from public.dwell_consent_mutations where user_id=auth.uid() and request_id=p_request_id and mutation_kind='reset';
  if found then return query select 'reset',c.enabled,c.consent_epoch,c.revision,c.updated_at,v_mutation.deleted_sample_count from public.dwell_personalization_consents c where c.user_id=auth.uid(); return; end if;
  insert into public.dwell_personalization_consents(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select * into v_current from public.dwell_personalization_consents where user_id=auth.uid() for update;
  if v_current.revision<>p_expected_revision then return query select 'conflict',v_current.enabled,v_current.consent_epoch,v_current.revision,v_current.updated_at,0; return; end if;
  delete from public.dwell_completion_samples where user_id=auth.uid(); get diagnostics v_deleted=row_count;
  delete from public.dwell_personalization_profiles where user_id=auth.uid();
  update public.dwell_personalization_consents as c set enabled=false,consent_epoch=null,revision=c.revision+1,updated_at=timezone('utc',now()) where c.user_id=auth.uid() returning c.* into v_current;
  insert into public.dwell_consent_mutations(user_id,request_id,mutation_kind,requested_enabled,result_revision,result_epoch,deleted_sample_count) values(auth.uid(),p_request_id,'reset',false,v_current.revision,null,v_deleted);
  return query select 'reset',v_current.enabled,v_current.consent_epoch,v_current.revision,v_current.updated_at,v_deleted;
end;
$$;

create or replace function public.submit_dwell_completion_sample(
  p_completion_event_id text,p_course_run_id text,p_stop_ordinal smallint,p_content_id text,p_category text,p_sub_category text,
  p_actual_dwell_min integer,p_completed_at_minute bigint,p_owner_subject uuid,p_consent_epoch uuid,p_consent_revision bigint
) returns text language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_consent public.dwell_personalization_consents%rowtype; v_hash bytea; v_existing bytea; v_completed timestamptz;
begin
  if not public.is_account_user() or p_owner_subject is distinct from auth.uid() then return 'owner_changed'; end if;
  if p_completion_event_id is null or char_length(p_completion_event_id) not between 1 and 200 or p_course_run_id is null or char_length(p_course_run_id) not between 1 and 200
    or p_stop_ordinal is null or p_stop_ordinal not in(1,2)
    or p_content_id is null or char_length(p_content_id) not between 1 and 160 or btrim(p_content_id)<>p_content_id
    or p_category is null or char_length(p_category) not between 1 and 120 or btrim(p_category)<>p_category
    or p_sub_category is null or char_length(p_sub_category) not between 1 and 120 or btrim(p_sub_category)<>p_sub_category
    or p_actual_dwell_min is null or p_actual_dwell_min not between 1 and 1440
    or p_completed_at_minute is null or p_completed_at_minute<=0
    or p_consent_epoch is null or p_consent_revision is null or p_consent_revision<=0 then return 'invalid_input'; end if;
  v_completed:=to_timestamp(p_completed_at_minute*60);
  if v_completed>timezone('utc',now())+interval '5 minutes' then return 'invalid_input'; end if;
  if v_completed<timezone('utc',now())-interval '180 days' then return 'expired'; end if;
  select * into v_consent from public.dwell_personalization_consents where user_id=auth.uid() for update;
  if not found or not v_consent.enabled or v_consent.consent_epoch is distinct from p_consent_epoch or v_consent.revision<>p_consent_revision then return 'consent_changed'; end if;
  if not exists(
    select 1 from public.account_course_completions c join public.account_course_completion_places p on p.completion_id=c.id
    where c.user_id=auth.uid() and c.course_run_id=p_course_run_id and c.provenance='account_completed'
      and date_trunc('minute',c.completed_at)=v_completed and p.stop_ordinal=p_stop_ordinal and p.content_id=p_content_id and p.category=p_category and p.sub_category=p_sub_category
  ) then return 'catalog_mismatch'; end if;
  v_hash:=digest(convert_to(p_course_run_id||E'\n'||p_stop_ordinal||E'\n'||p_content_id||E'\n'||p_category||E'\n'||p_sub_category||E'\n'||p_actual_dwell_min||E'\n'||p_completed_at_minute||E'\n'||p_consent_epoch||E'\n'||p_consent_revision,'utf8'),'sha256');
  select payload_hash into v_existing from public.dwell_completion_samples where user_id=auth.uid() and completion_event_id=p_completion_event_id;
  if found then return case when v_existing=v_hash then 'already_accepted' else 'idempotency_conflict' end; end if;
  insert into public.dwell_completion_samples(user_id,completion_event_id,course_run_id,stop_ordinal,content_id,category,sub_category,actual_dwell_min,completed_at,consent_epoch,consent_revision,payload_hash)
  values(auth.uid(),p_completion_event_id,p_course_run_id,p_stop_ordinal,p_content_id,p_category,p_sub_category,p_actual_dwell_min,v_completed,p_consent_epoch,p_consent_revision,v_hash);
  perform public.refresh_dwell_profiles_for_user(auth.uid());
  return 'accepted';
end;
$$;

create or replace function public.read_dwell_personalization_samples()
returns table(category text,sub_category text,dwell_min integer)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  delete from public.dwell_completion_samples where user_id=auth.uid() and completed_at<timezone('utc',now())-interval '180 days';
  if found then perform public.refresh_dwell_profiles_for_user(auth.uid()); end if;
  if not exists(select 1 from public.dwell_personalization_consents c where c.user_id=auth.uid() and c.enabled) then return; end if;
  return query select s.category,s.sub_category,s.actual_dwell_min from public.dwell_completion_samples s
    where s.user_id=auth.uid() and s.completed_at>=timezone('utc',now())-interval '180 days'
    order by s.completed_at asc,s.completion_event_id asc;
end;
$$;

create or replace function public.purge_expired_dwell_samples()
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_deleted integer; v_user uuid;
begin
  delete from public.dwell_completion_samples where completed_at<timezone('utc',now())-interval '180 days'; get diagnostics v_deleted=row_count;
  delete from public.dwell_personalization_profiles;
  for v_user in select distinct user_id from public.dwell_completion_samples loop perform public.refresh_dwell_profiles_for_user(v_user); end loop;
  return v_deleted;
end;
$$;

revoke all on function public.get_dwell_personalization_consent(),
  public.set_dwell_personalization_consent(text,boolean,bigint),
  public.reset_dwell_personalization(text,bigint),
  public.submit_dwell_completion_sample(text,text,smallint,text,text,text,integer,bigint,uuid,uuid,bigint),
  public.read_dwell_personalization_samples(),public.purge_expired_dwell_samples() from public,anon;
grant execute on function public.get_dwell_personalization_consent(),
  public.set_dwell_personalization_consent(text,boolean,bigint),
  public.reset_dwell_personalization(text,bigint),
  public.submit_dwell_completion_sample(text,text,smallint,text,text,text,integer,bigint,uuid,uuid,bigint),
  public.read_dwell_personalization_samples() to authenticated;
revoke execute on function public.purge_expired_dwell_samples() from authenticated;
grant execute on function public.purge_expired_dwell_samples() to service_role;

create or replace function public.count_account_owned_rows(p_user_id uuid)
returns bigint language sql stable security definer set search_path=pg_catalog,public as $$
  select
    (select count(*) from public.profiles where id=p_user_id)
    +(select count(*) from public.courses where user_id=p_user_id)
    +(select count(*) from public.course_feedback where user_id=p_user_id)
    +(select count(*) from public.recommendation_events where user_id=p_user_id)
    +(select count(*) from public.account_consent_records where user_id=p_user_id)
    +(select count(*) from public.account_course_completions where user_id=p_user_id)
    +(select count(*) from public.dwell_personalization_consents where user_id=p_user_id)
    +(select count(*) from public.dwell_completion_samples where user_id=p_user_id)
    +(select count(*) from public.dwell_personalization_profiles where user_id=p_user_id)
$$;
revoke all on function public.count_account_owned_rows(uuid) from public,anon,authenticated;
grant execute on function public.count_account_owned_rows(uuid) to service_role;
