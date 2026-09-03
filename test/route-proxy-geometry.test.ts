import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouteProxyHandler, sanitizeKakaoRouteGeometry, type RouteProxyHandlerDependencies } from '../supabase/functions/route-proxy/handler';
import { createCourseV1ProxyRouteAdapter } from '../src/services/routeProxyClientAdapter';

const response = (raw: unknown) => new Response(JSON.stringify(raw), { status: 200 });
const geometry = {
  paths: [
    { points: [{ lat: 10, lon: 20 }, { lat: 10.1, lon: 20.1 }] },
    { points: [{ lat: 10.2, lon: 20.2 }, { lat: 10.3, lon: 20.3 }] },
  ],
};

function handlerFixture(input: { mode: 'walk' | 'transit'; private?: boolean; cachedSteps?: unknown[]; providerBody: unknown }) {
  let cachedSteps = input.cachedSteps;
  let providerCalls = 0;
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const deps: RouteProxyHandlerDependencies = {
    env(name) {
      const values: Record<string, string> = {
        ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED: 'true',
        ROUTE_PROXY_ABUSE_GUARD_APPROVED: 'true',
        ROUTE_PROXY_FETCH_LEASE_TTL_MS: '5000',
        ROUTE_PROXY_PROVIDER_DEADLINE_MS: '4750',
        ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT: '10',
        ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT: '9',
        ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT: '3',
        ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT: '10',
        ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT: '9',
        ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT: '3',
        ROUTE_PROXY_CACHE_TTL_MS: '900000',
        KAKAO_ROUTE_REST_API_KEY: 'fixture',
        ROUTE_PROXY_CATALOG_SNAPSHOT_JSON: JSON.stringify({ version: 'fixture-v1', points: { from: { lat: 10, lon: 20 }, to: { lat: 11, lon: 21 } } }),
      };
      return values[name] ?? '';
    },
    async fetch() { providerCalls += 1; return response(input.providerBody); },
    async authenticate() { return { user: { aud: 'authenticated', is_anonymous: true } }; },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'route_proxy_get_route') return { data: cachedSteps ? [{ total_min: 5, steps: cachedSteps }] : [] };
      if (name === 'route_proxy_reserve_budget') return { data: [{ granted: true }] };
      if (name === 'route_proxy_claim_fetch_lease') return { data: [{ state: 'claimed', lease_id: 'lease-fixture' }] };
      if (name === 'route_proxy_complete_fetch_lease') { cachedSteps = args.p_steps as unknown[]; return { data: 'completed' }; }
      if (name === 'route_proxy_release_fetch_lease') return { data: 'released' };
      throw new Error(`unexpected rpc ${name}`);
    },
    now: () => 0,
    wait: async () => undefined,
    consumeRate: async () => true,
    storeAvailable: () => true,
  };
  const handler = createRouteProxyHandler(deps);
  const request = () => new Request('https://fixture.invalid/route-proxy', {
    method: 'POST',
    headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
    body: JSON.stringify(input.private
      ? { mode: input.mode, scope: { kind: 'private_request' }, origin: { lat: 10, lon: 20 }, destination: { lat: 11, lon: 21 } }
      : { mode: input.mode, scope: { kind: 'public_segment', catalogVersion: 'fixture-v1', fromPoiId: 'from', toPoiId: 'to' } }),
  });
  return { handler, request, calls, providerCalls: () => providerCalls };
}

test('API-ROUTE-GEOMETRY-01: 공식 walk legs/steps와 transit steps를 WGS84 provider-neutral geometry로 정제한다', () => {
  const walk = sanitizeKakaoRouteGeometry('walk', {
    legs: [{ steps: [
      { path: { points: [[20, 10], [20, 10], ['20.05', 10.05], [20.1, 10.1]] } },
      { path: { points: [[20.2, 10.2], [20.3, 10.3]] } },
    ] }],
  });
  const transit = sanitizeKakaoRouteGeometry('transit', { steps: [
    { path: { points: [[20, 10], [20.1, 10.1]] } },
    { path: { points: [[20.2, 10.2], [20.3, 10.3]] } },
  ] });
  assert.deepEqual(walk, geometry);
  assert.deepEqual(transit, geometry);
});

test('API-ROUTE-GEOMETRY-01: 513점은 실제 점·양 끝을 보존해 제한하고 33 paths와 유효점 부족은 geometry만 생략한다', () => {
  const points = Array.from({ length: 513 }, (_, index) => [20 + index / 10_000, 10 + index / 10_000]);
  const bounded = sanitizeKakaoRouteGeometry('transit', { steps: [{ path: { points } }] });
  assert.equal(bounded?.paths[0]?.points.length, 512);
  assert.deepEqual(bounded?.paths[0]?.points[0], { lat: 10, lon: 20 });
  assert.deepEqual(bounded?.paths[0]?.points.at(-1), { lat: 10.0512, lon: 20.0512 });
  const maximumPaths = Array.from({ length: 32 }, (_, index) => ({ path: { points: [[20 + index / 100, 10], [20 + index / 100, 10.1]] } }));
  const tooManyPaths = Array.from({ length: 33 }, (_, index) => ({ path: { points: [[20 + index / 100, 10], [20 + index / 100, 10.1]] } }));
  assert.equal(sanitizeKakaoRouteGeometry('transit', { steps: maximumPaths })?.paths.length, 32);
  assert.equal(sanitizeKakaoRouteGeometry('transit', { steps: tooManyPaths }), undefined);
  assert.equal(sanitizeKakaoRouteGeometry('transit', { steps: [{ path: { points: [[181, 10], [20, '10']] } }] }), undefined);
});

test('API-ROUTE-GEOMETRY-01: public provider miss 저장값과 다음 cache hit geometry가 같고 추가 provider 호출이 없다', async () => {
  const setup = handlerFixture({ mode: 'walk', providerBody: { status: 'OK', route: { properties: { totalTime: 300 }, legs: [{ steps: [
    { path: { points: [[20, 10], [20.1, 10.1]] } },
    { path: { points: [[20.2, 10.2], [20.3, 10.3]] } },
  ] }] } } });
  const miss = await (await setup.handler(setup.request())).json();
  const put = setup.calls.find((call) => call.name === 'route_proxy_complete_fetch_lease');
  assert.deepEqual(miss.geometry, geometry);
  assert.deepEqual(put?.args.p_steps, [{ min: 5, paths: [[[20, 10], [20.1, 10.1]], [[20.2, 10.2], [20.3, 10.3]]] }]);
  const hit = await (await setup.handler(setup.request())).json();
  assert.deepEqual(hit.geometry, miss.geometry);
  assert.deepEqual(hit.receipt, { result: 'exact', newProviderAttemptCount: 0, reuse: 'server_cache_hit' });
  assert.equal(setup.providerCalls(), 1);
  assert.equal('steps' in hit, false);
});

test('API-ROUTE-GEOMETRY-01: private 성공은 geometry만 응답하고 cache/lease/get/put RPC를 호출하지 않는다', async () => {
  const setup = handlerFixture({ mode: 'transit', private: true, providerBody: { status: 'OK', routes: [{ properties: { totalTime: 300 }, steps: [
    { path: { points: [[20, 10], [20.1, 10.1]] } },
    { path: { points: [[20.2, 10.2], [20.3, 10.3]] } },
  ] }] } });
  const body = await (await setup.handler(setup.request())).json();
  assert.deepEqual(body.geometry, geometry);
  assert.deepEqual(setup.calls.map((call) => call.name), ['route_proxy_reserve_budget']);
  assert.equal(setup.providerCalls(), 1);
});

test('API-ROUTE-GEOMETRY-01: malformed geometry는 정확 시간과 receipt를 유지하고 malformed totalTime은 기존 no_route다', async () => {
  const validTime = handlerFixture({ mode: 'walk', private: true, providerBody: { status: 'OK', route: { properties: { totalTime: 300 }, legs: [{ steps: [{ path: { points: [['20', 10], [181, 10]] } }] }] } } });
  const exact = await (await validTime.handler(validTime.request())).json();
  assert.equal(exact.totalMin, 5);
  assert.equal('geometry' in exact, false);
  assert.equal(exact.receipt.result, 'exact');
  const invalidTime = handlerFixture({ mode: 'walk', private: true, providerBody: { status: 'OK', route: { properties: { totalTime: 'bad' }, legs: [] } } });
  const noRoute = await (await invalidTime.handler(invalidTime.request())).json();
  assert.deepEqual(noRoute.receipt, { result: 'no_route', newProviderAttemptCount: 1, reuse: 'provider_attempt' });
  assert.equal('geometry' in noRoute, false);
});

test('API-ROUTE-GEOMETRY-01: client adapter는 bounded response geometry를 ExactRoute에 투영한다', async () => {
  const adapter = createCourseV1ProxyRouteAdapter({
    resolveScope: () => ({ kind: 'private_request' }),
    invoker: { async invoke() { return { mode: 'walk', status: 'ok', totalMin: 5, geometry, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }; } },
  });
  assert.deepEqual(await adapter.getRoute({ id: 'a', lat: 10, lon: 20 }, { id: 'b', lat: 11, lon: 21 }), { mode: 'walk', min: 5, exact: true, geometry });

  const invalidGeometry = { paths: [{ points: Array.from({ length: 513 }, (_, index) => ({ lat: 10, lon: 20 + index / 10_000 })) }] };
  const safeAdapter = createCourseV1ProxyRouteAdapter({
    resolveScope: () => ({ kind: 'private_request' }),
    invoker: { async invoke() { return { mode: 'walk', status: 'ok', totalMin: 5, geometry: invalidGeometry, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }; } },
  });
  assert.deepEqual(await safeAdapter.getRoute({ id: 'a', lat: 10, lon: 20 }, { id: 'b', lat: 11, lon: 21 }), { mode: 'walk', min: 5, exact: true });
});
