-- DB-RP-3: Kakao walk/transit budgets are independent.
-- Historical provider-only usage has no recoverable mode. Copying it to both modes is
-- intentionally conservative: neither new mode can receive more quota than the legacy total allowed.

alter table public.route_proxy_daily_budget add column mode text;
alter table public.route_proxy_second_budget add column mode text;

update public.route_proxy_daily_budget set mode = 'walk' where mode is null;
update public.route_proxy_second_budget set mode = 'walk' where mode is null;

alter table public.route_proxy_daily_budget drop constraint if exists route_proxy_daily_budget_pkey;
alter table public.route_proxy_second_budget drop constraint if exists route_proxy_second_budget_pkey;

insert into public.route_proxy_daily_budget (provider, mode, date_bucket, used, updated_at)
select provider, 'transit', date_bucket, used, updated_at
from public.route_proxy_daily_budget
where mode = 'walk';

insert into public.route_proxy_second_budget (provider, mode, date_bucket, second_bucket, used, updated_at)
select provider, 'transit', date_bucket, second_bucket, used, updated_at
from public.route_proxy_second_budget
where mode = 'walk';

alter table public.route_proxy_daily_budget alter column mode set not null;
alter table public.route_proxy_second_budget alter column mode set not null;
alter table public.route_proxy_daily_budget add constraint route_proxy_daily_budget_mode_check check (mode in ('walk', 'transit'));
alter table public.route_proxy_second_budget add constraint route_proxy_second_budget_mode_check check (mode in ('walk', 'transit'));
alter table public.route_proxy_daily_budget add primary key (provider, mode, date_bucket);
alter table public.route_proxy_second_budget add primary key (provider, mode, date_bucket, second_bucket);

revoke all on function public.route_proxy_read_budget(text, date) from public, anon, authenticated, service_role;
revoke all on function public.route_proxy_reserve_budget(text, date, bigint, integer, integer) from public, anon, authenticated, service_role;
drop function public.route_proxy_read_budget(text, date);
drop function public.route_proxy_reserve_budget(text, date, bigint, integer, integer);

create or replace function public.route_proxy_read_budget(
  p_provider text,
  p_mode text,
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
    where budget.provider = p_provider
      and budget.mode = p_mode
      and budget.date_bucket = p_date_bucket
  ), 0);
$$;

create or replace function public.route_proxy_reserve_budget(
  p_provider text,
  p_mode text,
  p_date_bucket date,
  p_second_bucket bigint,
  p_soft_limit integer,
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
  if p_provider is null or p_provider not in ('kakao', 'tmap')
    or p_mode is null or p_mode not in ('walk', 'transit')
    or p_date_bucket is null
    or p_second_bucket is null or p_second_bucket < 0
    or p_soft_limit is null or p_soft_limit < 1
    or p_hard_limit is null or p_hard_limit < p_soft_limit
    or p_per_second_limit is null or p_per_second_limit < 1 then
    raise exception 'invalid_budget_request';
  end if;

  -- This is one critical section per provider/mode/day; no read-then-update race is possible.
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_mode || ':' || p_date_bucket::text, 0));

  select daily_budget.used into v_daily_used
  from public.route_proxy_daily_budget as daily_budget
  where daily_budget.provider = p_provider
    and daily_budget.mode = p_mode
    and daily_budget.date_bucket = p_date_bucket
  for update;
  v_daily_used := coalesce(v_daily_used, 0);
  if v_daily_used >= p_hard_limit then
    return query select false, v_daily_used, 'daily_limit'::text;
    return;
  end if;
  if v_daily_used >= p_soft_limit then
    return query select false, v_daily_used, 'soft_limit'::text;
    return;
  end if;

  select second_budget.used into v_second_used
  from public.route_proxy_second_budget as second_budget
  where second_budget.provider = p_provider
    and second_budget.mode = p_mode
    and second_budget.date_bucket = p_date_bucket
    and second_budget.second_bucket = p_second_bucket
  for update;
  v_second_used := coalesce(v_second_used, 0);
  if v_second_used >= p_per_second_limit then
    return query select false, v_daily_used, 'rate_limit'::text;
    return;
  end if;

  insert into public.route_proxy_daily_budget as daily_budget (provider, mode, date_bucket, used)
  values (p_provider, p_mode, p_date_bucket, v_daily_used + 1)
  on conflict (provider, mode, date_bucket) do update
  set used = excluded.used, updated_at = timezone('utc', now());

  insert into public.route_proxy_second_budget as second_budget (provider, mode, date_bucket, second_bucket, used)
  values (p_provider, p_mode, p_date_bucket, p_second_bucket, v_second_used + 1)
  on conflict (provider, mode, date_bucket, second_bucket) do update
  set used = excluded.used, updated_at = timezone('utc', now());

  return query select true, v_daily_used + 1, null::text;
end;
$$;

revoke all on function public.route_proxy_read_budget(text, text, date) from public, anon, authenticated;
revoke all on function public.route_proxy_reserve_budget(text, text, date, bigint, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.route_proxy_read_budget(text, text, date) to service_role;
grant execute on function public.route_proxy_reserve_budget(text, text, date, bigint, integer, integer, integer) to service_role;
