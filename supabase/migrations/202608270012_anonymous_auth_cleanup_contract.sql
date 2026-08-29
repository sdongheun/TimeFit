-- DB-PRIV-01: anonymous Auth accounts are authorization-only and may be selected
-- for a server-side Admin API cleanup after 30 days of Auth-observed inactivity.
-- No application activity, location, route, query, or per-user audit data is stored here.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Anonymous route-proxy authorization must not create a planning/profile record.
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  insert into public.profiles (
    id, birth_year, age_band, email_verified_at, terms_agreed_at, privacy_agreed_at
  ) values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'birth_year', '')::smallint,
    nullif(new.raw_user_meta_data ->> 'age_band', ''),
    new.email_confirmed_at,
    coalesce(nullif(new.raw_user_meta_data ->> 'terms_agreed_at', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(new.raw_user_meta_data ->> 'privacy_agreed_at', '')::timestamptz, timezone('utc', now()))
  );
  return new;
end;
$$;

create table public.anonymous_auth_cleanup_run (
  run_date date primary key,
  run_token uuid not null default gen_random_uuid(),
  state text not null check (state in ('running', 'completed')),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table public.anonymous_auth_cleanup_audit (
  run_date date not null references public.anonymous_auth_cleanup_run(run_date) on delete cascade,
  outcome text not null check (outcome in ('candidate', 'deleted', 'skipped', 'failed')),
  reason_code text not null check (reason_code in (
    'eligible', 'linked_data', 'identity_changed', 'recent_session',
    'admin_delete_failed', 'candidate_query_failed', 'run_abandoned'
  )),
  count integer not null check (count >= 0),
  primary key (run_date, outcome, reason_code)
);

alter table public.anonymous_auth_cleanup_run enable row level security;
alter table public.anonymous_auth_cleanup_audit enable row level security;
revoke all on table public.anonymous_auth_cleanup_run from public, anon, authenticated;
revoke all on table public.anonymous_auth_cleanup_audit from public, anon, authenticated;
grant select, insert, update, delete on table public.anonymous_auth_cleanup_run to service_role;
grant select, insert, update, delete on table public.anonymous_auth_cleanup_audit to service_role;

create or replace function public.claim_anonymous_auth_cleanup_run(
  p_run_date date default (timezone('utc', now()))::date
)
returns table (state text, run_token uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_token uuid;
begin
  if p_run_date is null or p_run_date <> (timezone('utc', now()))::date then
    raise exception 'invalid_cleanup_run_date';
  end if;

  insert into public.anonymous_auth_cleanup_run (run_date, state)
  values (p_run_date, 'running')
  on conflict (run_date) do nothing
  returning anonymous_auth_cleanup_run.run_token into v_token;
  if found then
    return query select 'claimed'::text, v_token;
    return;
  end if;
  return query select 'already_claimed'::text, null::uuid;
end;
$$;

create or replace function public.list_anonymous_auth_cleanup_candidates(
  p_run_date date,
  p_run_token uuid,
  p_inactive_before timestamptz,
  p_limit integer default 100
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if p_limit is null or p_limit not between 1 and 1000
    or p_inactive_before is null or p_inactive_before > v_now - interval '30 days' then
    raise exception 'invalid_cleanup_candidate_request';
  end if;
  if not exists (
    select 1 from public.anonymous_auth_cleanup_run as run
    where run.run_date = p_run_date and run.run_token = p_run_token and run.state = 'running'
  ) then
    raise exception 'cleanup_run_not_owned';
  end if;

  return query
  select auth_user.id
  from auth.users as auth_user
  where auth_user.is_anonymous is true
    and coalesce(auth_user.last_sign_in_at, auth_user.created_at) <= p_inactive_before
    and not exists (select 1 from public.profiles as profile where profile.id = auth_user.id)
    and not exists (select 1 from public.courses as course where course.user_id = auth_user.id)
    and not exists (select 1 from public.course_feedback as feedback where feedback.user_id = auth_user.id)
    and not exists (select 1 from public.recommendation_events as event where event.user_id = auth_user.id)
  order by coalesce(auth_user.last_sign_in_at, auth_user.created_at), auth_user.id
  limit p_limit;
end;
$$;

create or replace function public.recheck_anonymous_auth_cleanup_candidate(
  p_run_date date,
  p_run_token uuid,
  p_user_id uuid,
  p_inactive_before timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not exists (
    select 1 from public.anonymous_auth_cleanup_run as run
    where run.run_date = p_run_date and run.run_token = p_run_token and run.state = 'running'
  ) then
    raise exception 'cleanup_run_not_owned';
  end if;

  return exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = p_user_id
      and auth_user.is_anonymous is true
      and coalesce(auth_user.last_sign_in_at, auth_user.created_at) <= p_inactive_before
      and not exists (select 1 from public.profiles as profile where profile.id = auth_user.id)
      and not exists (select 1 from public.courses as course where course.user_id = auth_user.id)
      and not exists (select 1 from public.course_feedback as feedback where feedback.user_id = auth_user.id)
      and not exists (select 1 from public.recommendation_events as event where event.user_id = auth_user.id)
  );
end;
$$;

create or replace function public.record_anonymous_auth_cleanup_audit(
  p_run_date date,
  p_run_token uuid,
  p_outcome text,
  p_reason_code text,
  p_count integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_count is null or p_count < 0
    or p_outcome not in ('candidate', 'deleted', 'skipped', 'failed')
    or p_reason_code not in ('eligible', 'linked_data', 'identity_changed', 'recent_session', 'admin_delete_failed', 'candidate_query_failed', 'run_abandoned') then
    raise exception 'invalid_cleanup_audit';
  end if;
  if not exists (
    select 1 from public.anonymous_auth_cleanup_run as run
    where run.run_date = p_run_date and run.run_token = p_run_token and run.state = 'running'
  ) then
    raise exception 'cleanup_run_not_owned';
  end if;

  insert into public.anonymous_auth_cleanup_audit as audit (run_date, outcome, reason_code, count)
  values (p_run_date, p_outcome, p_reason_code, p_count)
  on conflict (run_date, outcome, reason_code) do update
  set count = audit.count + excluded.count;
end;
$$;

create or replace function public.complete_anonymous_auth_cleanup_run(
  p_run_date date,
  p_run_token uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.anonymous_auth_cleanup_run as run
  set state = 'completed', completed_at = timezone('utc', now())
  where run.run_date = p_run_date and run.run_token = p_run_token and run.state = 'running';
  return case when found then 'completed' else 'lost' end;
end;
$$;

revoke all on function public.claim_anonymous_auth_cleanup_run(date) from public, anon, authenticated;
revoke all on function public.list_anonymous_auth_cleanup_candidates(date, uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.recheck_anonymous_auth_cleanup_candidate(date, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.record_anonymous_auth_cleanup_audit(date, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.complete_anonymous_auth_cleanup_run(date, uuid) from public, anon, authenticated;
grant execute on function public.claim_anonymous_auth_cleanup_run(date) to service_role;
grant execute on function public.list_anonymous_auth_cleanup_candidates(date, uuid, timestamptz, integer) to service_role;
grant execute on function public.recheck_anonymous_auth_cleanup_candidate(date, uuid, uuid, timestamptz) to service_role;
grant execute on function public.record_anonymous_auth_cleanup_audit(date, uuid, text, text, integer) to service_role;
grant execute on function public.complete_anonymous_auth_cleanup_run(date, uuid) to service_role;
