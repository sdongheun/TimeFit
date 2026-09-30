-- DB-LIVE-PROVIDER-BUDGET-DEPLOY-03: conservative development-account rolling caps.
-- Provider daily allowances confirmed 2026-09-23: TourAPI 1,000;
-- Busan attraction/food/shopping 10,000 each. The Busan Edge intentionally
-- shares one credential scope, so its combined cap remains below every
-- individual provider allowance.
insert into public.live_provider_budget_config(scope, rolling_24h_cap)
values
  ('tourapi', 800),
  ('busan_public_data', 8000)
on conflict (scope) do update
set rolling_24h_cap = excluded.rolling_24h_cap;
