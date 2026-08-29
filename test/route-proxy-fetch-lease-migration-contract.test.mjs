import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/202608270011_route_proxy_fetch_lease.sql';
const migration = () => fs.readFileSync(migrationPath, 'utf-8');

test('DBRP2-01: 공개 segment key별 lease와 방향·mode·version 분리가 있다', () => {
  assert.ok(fs.existsSync(migrationPath), `missing ${migrationPath}`);
  const sql = migration();
  assert.match(sql, /create table public\.route_proxy_fetch_lease/);
  assert.match(sql, /primary key \(provider, mode, from_poi_id, to_poi_id, catalog_version\)/);
  assert.match(sql, /lease_id uuid not null default gen_random_uuid\(\)/);
  assert.match(sql, /lease_expires_at timestamptz not null/);
  assert.doesNotMatch(sql, /\b(user_id|profile_id|ip_address|origin_lat|origin_lon|destination_lat|destination_lon|raw_response|api_key)\b/i);
});

test('DBRP2-02: claim은 원자적으로 하나만 승인하고 wait에는 bounded in_flight만 반환한다', () => {
  const sql = migration();
  assert.match(sql, /create or replace function public\.route_proxy_claim_fetch_lease/);
  assert.match(sql, /on conflict \(provider, mode, from_poi_id, to_poi_id, catalog_version\) do update/);
  assert.match(sql, /where lease\.lease_expires_at <= v_now/);
  assert.match(sql, /'claimed'::text/);
  assert.match(sql, /'in_flight'::text/);
  assert.match(sql, /least\(2000,/);
  assert.match(sql, /create or replace function public\.route_proxy_read_fetch_lease/);
});

test('DBRP2-03: 완료·실패·TTL은 소유 token을 확인하고 다음 claim을 복구시킨다', () => {
  const sql = migration();
  assert.match(sql, /create or replace function public\.route_proxy_complete_fetch_lease/);
  assert.match(sql, /v_current_lease_id <> p_lease_id/);
  assert.match(sql, /perform public\.route_proxy_put_route/);
  assert.match(sql, /return 'completed'/);
  assert.match(sql, /create or replace function public\.route_proxy_release_fetch_lease/);
  assert.match(sql, /return case when found then 'released' else 'lost' end/);
  assert.match(sql, /create or replace function public\.route_proxy_purge_expired_fetch_leases/);
});

test('DBRP2-04: anon/authenticated 직접 lease 접근과 RPC 실행은 막는다', () => {
  const sql = migration();
  assert.match(sql, /alter table public\.route_proxy_fetch_lease enable row level security/);
  assert.match(sql, /revoke all on table public\.route_proxy_fetch_lease from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on table public\.route_proxy_fetch_lease to service_role/);
  for (const rpc of ['route_proxy_claim_fetch_lease', 'route_proxy_read_fetch_lease', 'route_proxy_complete_fetch_lease', 'route_proxy_release_fetch_lease', 'route_proxy_purge_expired_fetch_leases']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}`));
  }
});
