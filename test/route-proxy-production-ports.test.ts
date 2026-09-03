import assert from 'node:assert/strict';
import test from 'node:test';
import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/functions-js';
import { createRouteProxyHandler } from '../supabase/functions/route-proxy/handler';
import { restoreRouteProxyHttpError } from '../src/services/routeProxyProductionReceipt';
import { createActivatedCourseV1RouteAdapter } from '../src/services/routeProxyActivatedCourseAdapter';
import type { RouteProxyEdgeInvoker } from '../src/services/routeProxyClientAdapter';

const receipt = (result: 'exact' | 'no_route' | 'unavailable', newProviderAttemptCount: 0 | 1 = 0) => ({ result, newProviderAttemptCount, reuse: newProviderAttemptCount ? 'provider_attempt' as const : 'server_cache_hit' as const });
const httpError = (body: unknown) => new FunctionsHttpError({ json: async () => body });

test('API4F-01: FunctionsHttpError의 safe non-2xx receipt만 복원한다', async () => {
  const cases = [
    [{ mode: 'walk', status: 'rejected', receipt: { ...receipt('unavailable'), unavailableReason: 'rejected' } }, 'rejected'],
    [{ mode: 'transit', status: 'limited', receipt: { ...receipt('unavailable'), unavailableReason: 'limited' } }, 'limited'],
    [{ mode: 'walk', status: 'store_unavailable', receipt: { ...receipt('unavailable'), unavailableReason: 'store' } }, 'store_unavailable'],
    [{ mode: 'walk', status: 'in_flight', receipt: { ...receipt('unavailable'), reuse: 'in_flight_reuse', unavailableReason: 'in_flight' } }, 'in_flight'],
  ] as const;
  for (const [body] of cases) assert.deepEqual(await restoreRouteProxyHttpError(httpError(body)), body);
});

test('API4F-02: context 없음·손상 body·relay/network은 receipt로 추측하지 않고 transport 경계에 남긴다', async () => {
  const malformed = [
    new FunctionsHttpError(undefined),
    new FunctionsHttpError({ json: async () => { throw new Error('fixture parse failure'); } }),
    httpError({ mode: 'walk', status: 'unknown', receipt: receipt('unavailable') }),
    httpError({ mode: 'walk', status: 'limited' }),
    httpError({ mode: 'walk', status: 'ok', totalMin: 0, receipt: receipt('exact') }),
    new FunctionsRelayError({}),
    new FunctionsFetchError({}),
  ];
  for (const error of malformed) assert.equal(await restoreRouteProxyHttpError(error), null);
});

test('API4F-03: production port source는 error 원문을 로그·오류 문자열로 노출하지 않는다', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/services/routeProxyProductionPorts.ts', 'utf8'));
  assert.doesNotMatch(source, /console\.|JSON\.stringify\(error|throw new Error\([^)]*error/);
});

test('API4F-04: 유효 request 처리의 최종 store catch는 mode가 있는 store_unavailable receipt를 반환한다', async () => {
  const handler = createRouteProxyHandler({
    env: (name) => ({ ROUTE_PROXY_CATALOG_SNAPSHOT_JSON: JSON.stringify({ version: 'v1', points: { from: { lat: 35.1, lon: 129 }, to: { lat: 35.2, lon: 129.1 } } }), ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED: 'true', ROUTE_PROXY_ABUSE_GUARD_APPROVED: 'true', KAKAO_ROUTE_REST_API_KEY: 'fixture', ROUTE_PROXY_FETCH_LEASE_TTL_MS: '5000', ROUTE_PROXY_PROVIDER_DEADLINE_MS: '4750' }[name] ?? ''),
    fetch: async () => { throw new Error('provider must not run'); }, authenticate: async () => ({ user: { aud: 'authenticated' } }), rpc: async () => { throw new Error('store failure'); }, now: () => 0, wait: async () => undefined, consumeRate: async () => true, storeAvailable: () => true,
  });
  const request = new Request('https://fixture.invalid', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'walk', scope: { kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'from', toPoiId: 'to' } }) });
  const response = await handler(request);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { mode: 'walk', status: 'store_unavailable', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'store' } });
});

test('API-SNAPSHOT-SYNC-01: stale public snapshot은 provider/auth 호출 없이 typed rejected receipt로 끝난다', async () => {
  let authenticated = 0;
  let fetched = 0;
  const handler = createRouteProxyHandler({
    env: (name) => ({ ROUTE_PROXY_CATALOG_SNAPSHOT_JSON: JSON.stringify({ version: 'representative-current', points: { from: { lat: 35.1, lon: 129 }, to: { lat: 35.2, lon: 129.1 } } }) }[name] ?? ''),
    fetch: async () => { fetched += 1; throw new Error('provider must not run'); },
    authenticate: async () => { authenticated += 1; return { user: { aud: 'authenticated' } }; },
    rpc: async () => { throw new Error('store must not run'); }, now: () => 0, wait: async () => undefined, consumeRate: async () => true, storeAvailable: () => true,
  });
  const request = new Request('https://fixture.invalid', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'walk', scope: { kind: 'public_segment', catalogVersion: 'representative-stale', fromPoiId: 'from', toPoiId: 'to' } }) });
  const response = await handler(request);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.deepEqual(body, { mode: 'walk', status: 'rejected', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'session_hit', unavailableReason: 'rejected' } });
  assert.equal(authenticated, 0);
  assert.equal(fetched, 0);
  const restored = await restoreRouteProxyHttpError(httpError(body));
  const edge: RouteProxyEdgeInvoker = { async invoke() { return { data: restored, error: null }; } };
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: { async getSession() { return { accessToken: 'fixture' }; }, async signInAnonymously() { return null; } }, edge, snapshot: { version: 'representative-stale', points: { from: { lat: 35.1, lon: 129 }, to: { lat: 35.2, lon: 129.1 } } } });
  await assert.rejects(() => adapter.getRoute({ id: 'from', lat: 35.1, lon: 129 }, { id: 'to', lat: 35.2, lon: 129.1 }), (error: unknown) => error instanceof Error && error.name === 'RouteProxyUnavailableError' && (error as { reason?: unknown }).reason === 'route_proxy_rejected');
  assert.deepEqual(await adapter.getRouteReceipt({ id: 'from', lat: 35.1, lon: 129 }, { id: 'to', lat: 35.2, lon: 129.1 }, { maxNewProviderAttemptCount: 1 }), { result: 'unavailable', reason: 'rejected', newProviderAttemptCount: 0, reused: true });
});

test('API4F-05: 복원한 non-2xx receipt는 activated engine port의 unavailable 결과로 보존된다', async () => {
  const restored = await restoreRouteProxyHttpError(httpError({ mode: 'walk', status: 'limited', receipt: { ...receipt('unavailable'), reuse: 'provider_attempt', unavailableReason: 'limited' } }));
  const edge: RouteProxyEdgeInvoker = { async invoke() { return { data: restored, error: null }; } };
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: { async getSession() { return { accessToken: 'fixture' }; }, async signInAnonymously() { return null; } }, edge });
  assert.deepEqual(await adapter.getRouteReceipt({ id: 'from', lat: 35.1, lon: 129 }, { id: 'to', lat: 35.2, lon: 129.1 }, { maxNewProviderAttemptCount: 1 }), { result: 'unavailable', reason: 'limited', newProviderAttemptCount: 0, reused: false });
});
