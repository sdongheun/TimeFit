import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/202608270010_route_proxy_store.sql';
const migration = () => fs.readFileSync(migrationPath, 'utf-8');

test('DBRP1-01: 공개 POI route cache는 방향·mode·catalog version을 key로 쓰고 최소 결과만 보관한다', () => {
  assert.ok(fs.existsSync(migrationPath), `missing ${migrationPath}`);
  const sql = migration();
  assert.match(sql, /create table public\.route_proxy_cache/);
  assert.match(sql, /primary key \(provider, mode, from_poi_id, to_poi_id, catalog_version\)/);
  assert.match(sql, /total_min integer not null/);
  assert.match(sql, /steps jsonb not null/);
  assert.match(sql, /expires_at timestamptz not null/);
  assert.match(sql, /and cache\.expires_at > p_now/);
  assert.match(sql, /create or replace function public\.route_proxy_put_route/);
  assert.match(sql, /jsonb_strip_nulls\(jsonb_build_object/);
  assert.doesNotMatch(sql, /\b(user_id|profile_id|ip_address|origin_lat|origin_lon|destination_lat|destination_lon|raw_response|api_key)\b/i);
});

test('DBRP1-02: 만료 cache 정리와 실패 route write 거절 경계가 있다', () => {
  const sql = migration();
  assert.match(sql, /p_total_min not between 1 and 1440/);
  assert.match(sql, /raise exception 'invalid_route_result'/);
  assert.match(sql, /create or replace function public\.route_proxy_purge_expired_routes/);
  assert.match(sql, /delete from public\.route_proxy_cache where expires_at <= p_before/);
  assert.match(sql, /expired rows are already cache misses before deletion/);
});

test('DBRP1-03: daily/second 예산 예약은 lock 안에서 한도 검사와 증가를 수행한다', () => {
  const sql = migration();
  assert.match(sql, /create table public\.route_proxy_daily_budget/);
  assert.match(sql, /create table public\.route_proxy_second_budget/);
  assert.match(sql, /create or replace function public\.route_proxy_reserve_budget/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /if v_daily_used >= p_hard_limit then[\s\S]*'daily_limit'/);
  assert.match(sql, /if v_second_used >= p_per_second_limit then[\s\S]*'rate_limit'/);
  assert.match(sql, /insert into public\.route_proxy_daily_budget[\s\S]*on conflict \(provider, date_bucket\) do update/);
  assert.match(sql, /insert into public\.route_proxy_second_budget[\s\S]*on conflict \(provider, date_bucket, second_bucket\) do update/);
});

test('DBRP1-04: anon/authenticated 직접 접근은 막고 service_role RPC만 허용한다', () => {
  const sql = migration();
  for (const table of ['route_proxy_cache', 'route_proxy_daily_budget', 'route_proxy_second_budget']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`));
  }
  for (const rpc of ['route_proxy_get_route', 'route_proxy_put_route', 'route_proxy_read_budget', 'route_proxy_reserve_budget', 'route_proxy_purge_expired_routes']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}`));
  }
});
