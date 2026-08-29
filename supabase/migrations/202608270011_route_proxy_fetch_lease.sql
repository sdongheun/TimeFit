-- DB-RP-2: cross-instance coordination for one public provider segment fetch.
-- lease_id is a DB-generated, short-lived capability, never a user/session/device identifier.

create table public.route_proxy_fetch_lease (
  provider text not null check (provider in ('kakao', 'tmap')),
  mode text not null check (mode in ('walk', 'transit')),
  from_poi_id text not null check (char_length(from_poi_id) between 1 and 160),
  to_poi_id text not null check (char_length(to_poi_id) between 1 and 160),
  catalog_version text not null check (char_length(catalog_version) between 1 and 120),
  lease_id uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (provider, mode, from_poi_id, to_poi_id, catalog_version)
);

create index route_proxy_fetch_lease_expires_at_idx on public.route_proxy_fetch_lease (lease_expires_at);

alter table public.route_proxy_fetch_lease enable row level security;
revoke all on table public.route_proxy_fetch_lease from public, anon, authenticated;
grant select, insert, update, delete on table public.route_proxy_fetch_lease to service_role;

create or replace function public.route_proxy_claim_fetch_lease(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text,
  p_lease_ttl_ms integer
)
returns table (state text, lease_id uuid, lease_expires_at timestamptz, retry_after_ms integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_lease_id uuid;
  v_expires_at timestamptz;
  v_remaining_ms integer;
begin
  if p_provider is null or p_provider not in ('kakao', 'tmap')
    or p_mode is null or p_mode not in ('walk', 'transit')
    or p_from_poi_id is null or char_length(p_from_poi_id) not between 1 and 160
    or p_to_poi_id is null or char_length(p_to_poi_id) not between 1 and 160
    or p_catalog_version is null or char_length(p_catalog_version) not between 1 and 120
    or p_lease_ttl_ms is null or p_lease_ttl_ms not between 1000 and 30000 then
    raise exception 'invalid_fetch_lease_request';
  end if;

  insert into public.route_proxy_fetch_lease as lease (
    provider, mode, from_poi_id, to_poi_id, catalog_version, lease_id, lease_expires_at
  ) values (
    p_provider, p_mode, p_from_poi_id, p_to_poi_id, p_catalog_version, gen_random_uuid(),
    v_now + (p_lease_ttl_ms * interval '1 millisecond')
  )
  on conflict (provider, mode, from_poi_id, to_poi_id, catalog_version) do update
  set lease_id = gen_random_uuid(),
      lease_expires_at = v_now + (p_lease_ttl_ms * interval '1 millisecond'),
      updated_at = v_now
  where lease.lease_expires_at <= v_now
  returning lease.lease_id, lease.lease_expires_at into v_lease_id, v_expires_at;

  if found then
    return query select 'claimed'::text, v_lease_id, v_expires_at, 0;
    return;
  end if;

  select lease.lease_expires_at into v_expires_at
  from public.route_proxy_fetch_lease as lease
  where lease.provider = p_provider
    and lease.mode = p_mode
    and lease.from_poi_id = p_from_poi_id
    and lease.to_poi_id = p_to_poi_id
    and lease.catalog_version = p_catalog_version;
  if not found or v_expires_at <= v_now then
    return query select 'idle'::text, null::uuid, null::timestamptz, 0;
    return;
  end if;

  v_remaining_ms := greatest(1, least(2000, floor(extract(epoch from (v_expires_at - v_now)) * 1000)::integer));
  return query select 'in_flight'::text, null::uuid, v_expires_at, v_remaining_ms;
end;
$$;

create or replace function public.route_proxy_read_fetch_lease(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text
)
returns table (state text, retry_after_ms integer)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_expires_at timestamptz;
begin
  select lease.lease_expires_at into v_expires_at
  from public.route_proxy_fetch_lease as lease
  where lease.provider = p_provider
    and lease.mode = p_mode
    and lease.from_poi_id = p_from_poi_id
    and lease.to_poi_id = p_to_poi_id
    and lease.catalog_version = p_catalog_version;

  if not found or v_expires_at <= v_now then
    return query select 'idle'::text, 0;
    return;
  end if;

  return query select
    'in_flight'::text,
    greatest(1, least(2000, floor(extract(epoch from (v_expires_at - v_now)) * 1000)::integer));
end;
$$;

create or replace function public.route_proxy_complete_fetch_lease(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text,
  p_lease_id uuid,
  p_total_min integer,
  p_steps jsonb,
  p_cache_expires_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_current_lease_id uuid;
  v_current_expires_at timestamptz;
begin
  select lease.lease_id, lease.lease_expires_at into v_current_lease_id, v_current_expires_at
  from public.route_proxy_fetch_lease as lease
  where lease.provider = p_provider
    and lease.mode = p_mode
    and lease.from_poi_id = p_from_poi_id
    and lease.to_poi_id = p_to_poi_id
    and lease.catalog_version = p_catalog_version
  for update;

  if not found or v_current_lease_id <> p_lease_id or v_current_expires_at <= v_now then
    return 'lost';
  end if;

  perform public.route_proxy_put_route(
    p_provider, p_mode, p_from_poi_id, p_to_poi_id, p_catalog_version,
    p_total_min, p_steps, p_cache_expires_at
  );
  delete from public.route_proxy_fetch_lease as lease
  where lease.provider = p_provider
    and lease.mode = p_mode
    and lease.from_poi_id = p_from_poi_id
    and lease.to_poi_id = p_to_poi_id
    and lease.catalog_version = p_catalog_version
    and lease.lease_id = p_lease_id;
  return 'completed';
end;
$$;

create or replace function public.route_proxy_release_fetch_lease(
  p_provider text,
  p_mode text,
  p_from_poi_id text,
  p_to_poi_id text,
  p_catalog_version text,
  p_lease_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.route_proxy_fetch_lease as lease
  where lease.provider = p_provider
    and lease.mode = p_mode
    and lease.from_poi_id = p_from_poi_id
    and lease.to_poi_id = p_to_poi_id
    and lease.catalog_version = p_catalog_version
    and lease.lease_id = p_lease_id;
  return case when found then 'released' else 'lost' end;
end;
$$;

create or replace function public.route_proxy_purge_expired_fetch_leases(
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
  delete from public.route_proxy_fetch_lease where lease_expires_at <= p_before;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.route_proxy_purge_expired_fetch_leases(timestamptz) is
  'Service-role cleanup candidate. Expiry is already reclaimable by route_proxy_claim_fetch_lease.';

revoke all on function public.route_proxy_claim_fetch_lease(text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.route_proxy_read_fetch_lease(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.route_proxy_complete_fetch_lease(text, text, text, text, text, uuid, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.route_proxy_release_fetch_lease(text, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.route_proxy_purge_expired_fetch_leases(timestamptz) from public, anon, authenticated;
grant execute on function public.route_proxy_claim_fetch_lease(text, text, text, text, text, integer) to service_role;
grant execute on function public.route_proxy_read_fetch_lease(text, text, text, text, text) to service_role;
grant execute on function public.route_proxy_complete_fetch_lease(text, text, text, text, text, uuid, integer, jsonb, timestamptz) to service_role;
grant execute on function public.route_proxy_release_fetch_lease(text, text, text, text, text, uuid) to service_role;
grant execute on function public.route_proxy_purge_expired_fetch_leases(timestamptz) to service_role;
