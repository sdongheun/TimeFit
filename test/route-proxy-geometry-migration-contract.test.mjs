import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/202609030014_route_proxy_geometry_cache.sql';
const migration = () => fs.readFileSync(migrationPath, 'utf-8');

test('DBROUTEGEOMETRY01-01: 기존 put RPC signature와 cache schema를 유지한다', () => {
  assert.ok(fs.existsSync(migrationPath), `missing ${migrationPath}`);
  const sql = migration();
  assert.match(sql, /create or replace function public\.route_proxy_put_route\(\s*p_provider text,\s*p_mode text,\s*p_from_poi_id text,\s*p_to_poi_id text,\s*p_catalog_version text,\s*p_total_min integer,\s*p_steps jsonb,\s*p_expires_at timestamptz\s*\)/);
  assert.doesNotMatch(sql, /create table|alter table|drop table/i);
  assert.match(sql, /on conflict \(provider, mode, from_poi_id, to_poi_id, catalog_version\) do update/);
});

test('DBROUTEGEOMETRY01-02: WGS84 paths는 32개·전체 512점·path당 최소 2점으로 제한한다', () => {
  const sql = migration();
  assert.match(sql, /v_path_count > 32/);
  assert.match(sql, /v_point_count > 512/);
  assert.match(sql, /jsonb_array_length\(v_path\) < 2/);
  assert.match(sql, /jsonb_array_length\(v_point\) <> 2/);
  assert.match(sql, /v_lon not between -180 and 180/);
  assert.match(sql, /v_lat not between -90 and 90/);
});

test('DBROUTEGEOMETRY01-03: 숫자 좌표와 허용 step 필드만 검증 후 새 JSON으로 재구성한다', () => {
  const sql = migration();
  assert.match(sql, /jsonb_typeof\(v_point -> 0\) <> 'number'/);
  assert.match(sql, /jsonb_typeof\(v_point -> 1\) <> 'number'/);
  assert.match(sql, /jsonb_object_keys\(v_step\)/);
  assert.match(sql, /step_key not in \('min', 'distanceM', 'instruction', 'paths'\)/);
  assert.match(sql, /jsonb_build_object\([\s\S]*'paths'/);
  assert.match(sql, /raise exception 'invalid_route_result'/);
  assert.doesNotMatch(sql, /raw_response|provider_body|request_url|access_token|api_key/i);
});

test('DBROUTEGEOMETRY01-04: path 없는 기존 row와 빈 steps를 유지하고 service role 경계를 보존한다', () => {
  const sql = migration();
  assert.match(sql, /coalesce\(p_steps, '\[\]'::jsonb\)/);
  assert.match(sql, /case when v_step \? 'paths' then v_clean_paths end/);
  assert.match(sql, /revoke all on function public\.route_proxy_put_route\(text, text, text, text, text, integer, jsonb, timestamptz\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.route_proxy_put_route\(text, text, text, text, text, integer, jsonb, timestamptz\) to service_role/);
  assert.doesNotMatch(sql, /\b(user_id|profile_id|ip_address|origin_lat|origin_lon|destination_lat|destination_lon|search_query)\b/i);
});
