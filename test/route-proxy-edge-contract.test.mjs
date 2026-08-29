import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = `${fs.readFileSync('supabase/functions/route-proxy/index.ts', 'utf8')}\n${fs.readFileSync('supabase/functions/route-proxy/handler.ts', 'utf8')}`;

test('API4ACT02KR-03: Edge Function은 Kakao server secret과 mode-aware reserve RPC만 사용하며 EXPO_PUBLIC 값을 읽지 않는다', () => {
  assert.doesNotMatch(source, /EXPO_PUBLIC_/);
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'KAKAO_ROUTE_REST_API_KEY', 'ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT', 'ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT', 'ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT', 'ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT', 'ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT', 'ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT', 'route_proxy_get_route', 'route_proxy_complete_fetch_lease', 'route_proxy_reserve_budget', 'p_mode: input.mode', 'p_soft_limit']) assert.match(source, new RegExp(name));
  assert.doesNotMatch(source, /route_proxy_read_budget|ROUTE_PROXY_KAKAO_(?:DAILY|PER_SECOND)_LIMIT/);
  assert.doesNotMatch(source, /TMAP|tmap|ODsay|odsay/);
  assert.match(source, /store_unavailable/);
});

test('API4AR-04: public scope는 server catalog snapshot으로만 좌표를 해석하고 private만 body 좌표를 사용한다', () => {
  assert.match(source, /ROUTE_PROXY_CATALOG_SNAPSHOT_JSON/);
  assert.match(source, /input\.scope\.kind === 'public_segment'/);
  assert.match(source, /const origin = point\(body\.origin\)/);
  assert.doesNotMatch(source, /p_(?:origin|destination|lat|lon|coordinate)/);
});

test('API4ACT02K-02: walk·transit은 Kakao만 호출하고 mode별 endpoint/cache/budget/lease 계약을 유지한다', () => {
  assert.match(source, /input\.mode === 'walk' \? 'walk' : 'publictraffic'/);
  assert.match(source, /cached\('kakao'\)/);
  assert.match(source, /callWithLease\('kakao'\)/);
  assert.doesNotMatch(source, /TMAP|tmap|ODsay|odsay|stableWalkProvider|transit_fallback/);
});
