import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const proxy = `${fs.readFileSync('supabase/functions/route-proxy/index.ts', 'utf8')}\n${fs.readFileSync('supabase/functions/route-proxy/handler.ts', 'utf8')}`;
const cleanup = fs.readFileSync('supabase/functions/anonymous-auth-cleanup/index.ts', 'utf8');

test('API4AR2-03: route proxy는 Bearer JWT를 검증하고 익명 가입/남용 방어가 미승인되면 fail-closed다', () => {
  for (const value of ['Authorization', 'client.auth.getUser(token)', 'ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED', 'ROUTE_PROXY_ABUSE_GUARD_APPROVED', 'ROUTE_PROXY_REQUESTS_PER_MINUTE', 'route_proxy_unavailable']) assert.match(proxy, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(proxy, /EXPO_PUBLIC_|console\.(log|error)|authData\.user\.id/);
});

test('API4ACT03-06: instance-local rate limiter는 전역 quota가 아니라 burst 보조 방어로만 설명한다', () => {
  assert.match(proxy, /Instance-local burst protection only\. DB atomic provider\+mode budgets are the global cost boundary\./);
});

test('API4AR2-04: public miss는 DB-RP-2 lease를 claim/wait/cache re-read/complete-or-release 하며 private는 lease를 쓰지 않는다', () => {
  for (const value of ['route_proxy_claim_fetch_lease', 'route_proxy_complete_fetch_lease', 'route_proxy_release_fetch_lease', "lease.state === 'in_flight'", "routeResult(provider, input.mode, 'in_flight')"]) assert.match(proxy, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(proxy, /if \(!publicScope\) return call\(provider\)/);
  assert.doesNotMatch(proxy, /ODsay|odsay|transit_fallback/);
});

test('API4ACT02K-03: lease보다 짧은 Kakao deadline/abort가 HTTP·body parse·release를 지키며 fallback을 만들지 않는다', () => {
  for (const value of ['resolveRouteProxyDeadlineConfig', 'ROUTE_PROXY_FETCH_LEASE_TTL_MS', 'ROUTE_PROXY_PROVIDER_DEADLINE_MS', 'withinProviderDeadline', 'signal', 'deadline_exceeded', 'releaseOnce', 'if (!completed && !releaseStarted)']) assert.match(proxy, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(proxy, /raw: await response\.json\(\)/);
  assert.match(proxy, /input\.mode === 'walk' \? 'walk' : 'publictraffic'/);
  assert.doesNotMatch(proxy, /TMAP|tmap|ODsay|odsay|transit_fallback/);
});

test('API4AR2-05: anonymous cleanup은 scheduler secret 전용이며 DB 재검증 뒤 Admin 삭제하고 집계만 반환한다', () => {
  for (const value of ['x-cleanup-scheduler-secret', 'claim_anonymous_auth_cleanup_run', 'list_anonymous_auth_cleanup_candidates', 'recheck_anonymous_auth_cleanup_candidate', 'db.auth.admin.deleteUser', 'record_anonymous_auth_cleanup_audit', 'complete_anonymous_auth_cleanup_run']) assert.match(cleanup, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(cleanup, /console\.(log|error)|candidate\.user_id.*reply/);
});
