-- DB-LIVE-PROVIDER-BUDGET-01: fail-closed, credential-scope-wide rolling 24h HTTP-attempt reservations.
-- No live limits are installed here. An operator must separately configure a positive cap.
create table public.live_provider_budget_config (
  scope text primary key check (scope in ('tourapi', 'busan_public_data')),
  rolling_24h_cap integer not null check (rolling_24h_cap >= 0)
);

create table public.live_provider_attempt_reservations (
  id bigint generated always as identity primary key,
  scope text not null references public.live_provider_budget_config(scope),
  operation text not null check (operation in (
    'catalog_page', 'detail_intro', 'detail_common', 'detail_image',
    'attractions_page', 'food_page', 'shopping_page'
  )),
  reserved_at timestamptz not null default clock_timestamp()
);
create index live_provider_attempt_reservations_window_idx
  on public.live_provider_attempt_reservations(scope, reserved_at);

alter table public.live_provider_budget_config enable row level security;
alter table public.live_provider_attempt_reservations enable row level security;
revoke all on table public.live_provider_budget_config from public, anon, authenticated, service_role;
revoke all on table public.live_provider_attempt_reservations from public, anon, authenticated, service_role;
revoke all on sequence public.live_provider_attempt_reservations_id_seq from public, anon, authenticated, service_role;

create function public.reserve_live_provider_attempt(p_credential_scope text, p_operation text)
returns table(granted boolean, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cap integer;
  v_now timestamptz;
  v_used bigint;
begin
  if p_credential_scope is null or p_operation is null
     or not (
       (p_credential_scope = 'tourapi' and p_operation in ('catalog_page', 'detail_intro', 'detail_common', 'detail_image'))
       or (p_credential_scope = 'busan_public_data' and p_operation in ('attractions_page', 'food_page', 'shopping_page'))
     ) then
    return query select false, 'invalid_input'::text;
    return;
  end if;

  -- The config row is a scope-wide mutex, including the first reservation.
  -- Take the clock reading only after acquiring the lock.
  select c.rolling_24h_cap into v_cap
  from public.live_provider_budget_config c
  where c.scope = p_credential_scope
  for update;
  if v_cap is null or v_cap = 0 then
    return query select false, 'unconfigured'::text;
    return;
  end if;

  v_now := clock_timestamp();
  -- Keep no expired aggregate rows; never erase a slot inside the rolling window.
  delete from public.live_provider_attempt_reservations r
  where r.scope = p_credential_scope and r.reserved_at <= v_now - interval '24 hours';
  select count(*) into v_used
  from public.live_provider_attempt_reservations r
  where r.scope = p_credential_scope and r.reserved_at > v_now - interval '24 hours';
  if v_used >= v_cap then
    return query select false, 'limit'::text;
    return;
  end if;

  insert into public.live_provider_attempt_reservations(scope, operation, reserved_at)
  values (p_credential_scope, p_operation, v_now);
  return query select true, 'granted'::text;
end;
$$;

revoke all on function public.reserve_live_provider_attempt(text,text) from public, anon, authenticated;
grant execute on function public.reserve_live_provider_attempt(text,text) to service_role;
