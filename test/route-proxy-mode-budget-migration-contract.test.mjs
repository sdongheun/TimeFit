import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/202608280013_route_proxy_mode_budget.sql';
const migration = () => fs.readFileSync(migrationPath, 'utf-8');

test('DBRP3-01: budget key와 RPC는 provider+mode를 포함한다', () => {
  assert.ok(fs.existsSync(migrationPath), `missing ${migrationPath}`);
  const sql = migration();
  assert.match(sql, /add column mode text/);
  assert.match(sql, /add primary key \(provider, mode, date_bucket\)/);
  assert.match(sql, /add primary key \(provider, mode, date_bucket, second_bucket\)/);
  assert.match(sql, /create or replace function public\.route_proxy_read_budget\(\s+p_provider text,\s+p_mode text,/);
  assert.match(sql, /create or replace function public\.route_proxy_reserve_budget\(\s+p_provider text,\s+p_mode text,/);
  assert.match(sql, /p_soft_limit integer/);
});

test('DBRP3-02: legacy provider-only used는 두 mode에 보수적으로 이관된다', () => {
  const sql = migration();
  assert.match(sql, /Historical provider-only usage has no recoverable mode/);
  assert.match(sql, /update public\.route_proxy_daily_budget set mode = 'walk' where mode is null/);
  assert.match(sql, /select provider, 'transit', date_bucket, used, updated_at/);
  assert.match(sql, /select provider, 'transit', date_bucket, second_bucket, used, updated_at/);
  assert.doesNotMatch(sql, /delete from public\.route_proxy_(?:daily|second)_budget/);
});

test('DBRP3-03: mode별 reserve는 advisory lock 아래 soft/hard/rate를 typed reason으로 제한한다', () => {
  const sql = migration();
  assert.match(sql, /hashtextextended\(p_provider \|\| ':' \|\| p_mode \|\| ':'/);
  assert.match(sql, /if v_daily_used >= p_hard_limit then[\s\S]*'daily_limit'/);
  assert.match(sql, /if v_daily_used >= p_soft_limit then[\s\S]*'soft_limit'/);
  assert.match(sql, /if v_second_used >= p_per_second_limit then[\s\S]*'rate_limit'/);
  assert.match(sql, /on conflict \(provider, mode, date_bucket\) do update/);
  assert.match(sql, /on conflict \(provider, mode, date_bucket, second_bucket\) do update/);
});

test('DBRP3-04: 이전 provider-only RPC 권한을 회수·제거하고 새 RPC는 service_role만 실행한다', () => {
  const sql = migration();
  assert.match(sql, /drop function public\.route_proxy_read_budget\(text, date\)/);
  assert.match(sql, /drop function public\.route_proxy_reserve_budget\(text, date, bigint, integer, integer\)/);
  assert.match(sql, /grant execute on function public\.route_proxy_read_budget\(text, text, date\) to service_role/);
  assert.match(sql, /grant execute on function public\.route_proxy_reserve_budget\(text, text, date, bigint, integer, integer, integer\) to service_role/);
  assert.doesNotMatch(sql, /\b(user_id|anonymous_jwt|origin_lat|origin_lon|destination_lat|destination_lon|search_query|raw_response|api_key)\b/i);
});
