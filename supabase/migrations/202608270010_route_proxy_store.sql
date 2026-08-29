-- DB-RP-1: server-only public POI route cache and provider-call budget store.
-- This schema deliberately has no user, device, coordinate, query, or provider raw-response fields.

create table public.route_proxy_cache (
  provider text not null check (provider in ('kakao', 'tmap')),
  mode text not null check (mode in ('walk', 'transit')),
  from_poi_id text not null check (char_length(from_poi_id) between 1 and 160),
  to_poi_id text not null check (char_length(to_poi_id) between 1 and 160),
  catalog_version text not null check (char_length(catalog_version) between 1 and 120),
  total_min integer not null check (total_min between 1 and 1440),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (provider, mode, from_poi_id, to_poi_id, catalog_version)
);

create index route_proxy_cache_expires_at_idx on public.route_proxy_cache (expires_at);

create table public.route_proxy_daily_budget (
  provider text not null check (provider in ('kakao', 'tmap')),
  date_bucket date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (provider, date_bucket)
);

create table public.route_proxy_second_budget (
  provider text not null check (provider in ('kakao', 'tmap')),
  date_bucket date not null,
  second_bucket bigint not null check (second_bucket >= 0),
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (provider, date_bucket, second_bucket)
);

create index route_proxy_second_budget_date_idx on public.route_proxy_second_budget (date_bucket);

alter table public.route_proxy_cache enable row level security;
alter table public.route_proxy_daily_budget enable row level security;
alter table public.route_proxy_second_budget enable row level security;

revoke all on table public.route_proxy_cache from public, anon, authenticated;
revoke all on table public.route_proxy_daily_budget from public, anon, authenticated;
revoke all on table public.route_proxy_second_budget from public, anon, authenticated;
grant select, insert, update, delete on table public.route_proxy_cache to service_role;
grant select, insert, update, delete on table public.route_proxy_daily_budget to service_role;
grant select, insert, update, delete on table public.route_proxy_second_budget to service_role;

create or replace function public.route_proxy_get_route(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text,
  p_now timestamptz default timezone('utc', now())
)
returns table (total_min integer, steps jsonb, expires_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select cache.total_min, cache.steps, cache.expires_at
  from public.route_proxy_cache as cache
  where cache.provider = p_provider
    and cache.mode = p_mode
    and cache.from_poi_id = p_from_poi_id
    and cache.to_poi_id = p_to_poi_id
    and cache.catalog_version = p_catalog_version
    and cache.expires_at > p_now;
$$;

create or replace function public.route_proxy_put_route(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text,
  p_total_min integer,
  p_steps jsonb,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_steps jsonb;
  v_now timestamptz := timezone('utc', now());
begin
  if p_provider is null or p_provider not in ('kakao', 'tmap')
    or p_mode is null or p_mode not in ('walk', 'transit')
    or p_from_poi_id is null or char_length(p_from_poi_id) not between 1 and 160
    or p_to_poi_id is null or char_length(p_to_poi_id) not between 1 and 160
    or p_catalog_version is null or char_length(p_catalog_version) not between 1 and 120
    or p_total_min not between 1 and 1440
    or p_expires_at is null or p_expires_at <= v_now or p_expires_at > v_now + interval '24 hours'
    or jsonb_typeof(coalesce(p_steps, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_steps, '[]'::jsonb)) > 32 then
    raise exception 'invalid_route_result';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) as element(value)
    where jsonb_typeof(value) <> 'object'
      or not (value ? 'min')
      or jsonb_typeof(value -> 'min') <> 'number'
      or (value ->> 'min') !~ '^[0-9]+$'
      or (value ->> 'min')::integer not between 1 and 1440
      or (value ? 'distanceM' and (jsonb_typeof(value -> 'distanceM') <> 'number' or (value ->> 'distanceM') !~ '^[0-9]+$'))
      or (value ? 'instruction' and jsonb_typeof(value -> 'instruction') <> 'string')
  ) then
    raise exception 'invalid_route_result';
  end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'min', (value ->> 'min')::integer,
    'distanceM', case when value ? 'distanceM' then (value ->> 'distanceM')::integer end,
    'instruction', case when value ? 'instruction' then left(value ->> 'instruction', 240) end
  ))), '[]'::jsonb)
  into v_steps
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) as element(value);

  insert into public.route_proxy_cache (
    provider, mode, from_poi_id, to_poi_id, catalog_version, total_min, steps, expires_at
  ) values (
    p_provider, p_mode, p_from_poi_id, p_to_poi_id, p_catalog_version, p_total_min, v_steps, p_expires_at
  )
  on conflict (provider, mode, from_poi_id, to_poi_id, catalog_version) do update
  set total_min = excluded.total_min,
      steps = excluded.steps,
      expires_at = excluded.expires_at,
      updated_at = v_now;
end;
$$;

create or replace function public.route_proxy_read_budget(
  p_provider text,
  p_date_bucket date
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select budget.used
    from public.route_proxy_daily_budget as budget
    where budget.provider = p_provider and budget.date_bucket = p_date_bucket
  ), 0);
$$;

create or replace function public.route_proxy_reserve_budget(
  p_provider text,
  p_date_bucket date,
  p_second_bucket bigint,
  p_hard_limit integer,
  p_per_second_limit integer
)
returns table (granted boolean, used integer, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_daily_used integer;
  v_second_used integer;
begin
  if p_provider not in ('kakao', 'tmap')
    or p_date_bucket is null
    or p_second_bucket is null or p_second_bucket < 0
    or p_hard_limit is null or p_hard_limit < 0
    or p_per_second_limit is null or p_per_second_limit < 0 then
    raise exception 'invalid_budget_request';
  end if;

  -- The daily lock makes the check-and-increment one serializable critical section per provider/day.
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_date_bucket::text, 0));

  select daily_budget.used into v_daily_used
  from public.route_proxy_daily_budget as daily_budget
  where daily_budget.provider = p_provider and daily_budget.date_bucket = p_date_bucket
  for update;
  v_daily_used := coalesce(v_daily_used, 0);
  if v_daily_used >= p_hard_limit then
    return query select false, v_daily_used, 'daily_limit'::text;
    return;
  end if;

  select second_budget.used into v_second_used
  from public.route_proxy_second_budget as second_budget
  where second_budget.provider = p_provider and second_budget.date_bucket = p_date_bucket and second_budget.second_bucket = p_second_bucket
  for update;
  v_second_used := coalesce(v_second_used, 0);
  if v_second_used >= p_per_second_limit then
    return query select false, v_daily_used, 'rate_limit'::text;
    return;
  end if;

  insert into public.route_proxy_daily_budget as daily (provider, date_bucket, used)
  values (p_provider, p_date_bucket, v_daily_used + 1)
  on conflict (provider, date_bucket) do update
  set used = excluded.used, updated_at = timezone('utc', now());

  insert into public.route_proxy_second_budget as second (provider, date_bucket, second_bucket, used)
  values (p_provider, p_date_bucket, p_second_bucket, v_second_used + 1)
  on conflict (provider, date_bucket, second_bucket) do update
  set used = excluded.used, updated_at = timezone('utc', now());

  return query select true, v_daily_used + 1, null::text;
end;
$$;

create or replace function public.route_proxy_purge_expired_routes(
  p_before timestamptz default timezone('utc', now())
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted bigint;
begin
  delete from public.route_proxy_cache where expires_at <= p_before;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.route_proxy_purge_expired_routes(timestamptz) is
  'Service-role cleanup candidate: call from a scheduled server job; expired rows are already cache misses before deletion.';

revoke all on function public.route_proxy_get_route(text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.route_proxy_put_route(text, text, text, text, text, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.route_proxy_read_budget(text, date) from public, anon, authenticated;
revoke all on function public.route_proxy_reserve_budget(text, date, bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.route_proxy_purge_expired_routes(timestamptz) from public, anon, authenticated;
grant execute on function public.route_proxy_get_route(text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.route_proxy_put_route(text, text, text, text, text, integer, jsonb, timestamptz) to service_role;
grant execute on function public.route_proxy_read_budget(text, date) to service_role;
grant execute on function public.route_proxy_reserve_budget(text, date, bigint, integer, integer) to service_role;
grant execute on function public.route_proxy_purge_expired_routes(timestamptz) to service_role;
