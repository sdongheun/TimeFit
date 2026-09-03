import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouteProxyHandler, type RouteProxyHandlerDependencies } from '../supabase/functions/route-proxy/handler';
import { createRouteProxyCatalogScopeResolver } from '../src/services/routeProxyActivatedCourseAdapter';
import {
  createCourseV1ProxyRouteAdapter,
  type RouteProxyFunctionInvoker,
  type RouteProxyFunctionRequest,
  type RouteProxyFunctionResponse,
} from '../src/services/routeProxyClientAdapter';
import { createPrivateWalkConnectorPort } from '../src/services/privateWalkConnector';

const A = { id: 'a', lat: 35.1, lon: 129.0 };
const B = { id: 'b', lat: 35.2, lon: 129.1 };
const O = { id: 'origin', lat: 35.05, lon: 128.95 };
const D = { id: 'destination', lat: 35.25, lon: 129.15 };
const snapshot = { version: 'two-stop-v1', points: { a: A, b: B } };
const exact = (mode: 'walk' | 'transit', totalMin = 5, attempts: 0 | 1 = 1, reuse: 'provider_attempt' | 'server_cache_hit' | 'in_flight_reuse' = attempts ? 'provider_attempt' : 'server_cache_hit'): RouteProxyFunctionResponse => ({
  mode,
  status: 'ok',
  totalMin,
  receipt: { result: 'exact', newProviderAttemptCount: attempts, reuse },
});

function edgeFixture(options: { noRoute?: boolean; failComplete?: boolean; failRelease?: boolean; failGet?: boolean } = {}) {
  const rows = new Map<string, { total_min: number; steps: unknown[] }>();
  const rpcNames: string[] = [];
  let providerCalls = 0;
  const key = (args: Record<string, unknown>) => `${args.p_mode}:${args.p_catalog_version}:${args.p_from_poi_id}>${args.p_to_poi_id}`;
  const deps: RouteProxyHandlerDependencies = {
    env(name) {
      const values: Record<string, string> = {
        ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED: 'true', ROUTE_PROXY_ABUSE_GUARD_APPROVED: 'true',
        ROUTE_PROXY_FETCH_LEASE_TTL_MS: '5000', ROUTE_PROXY_PROVIDER_DEADLINE_MS: '4750', ROUTE_PROXY_CACHE_TTL_MS: '900000',
        ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT: '100', ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT: '90', ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT: '5',
        ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT: '100', ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT: '90', ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT: '5',
        KAKAO_ROUTE_REST_API_KEY: 'fixture-only', ROUTE_PROXY_CATALOG_SNAPSHOT_JSON: JSON.stringify(snapshot),
      };
      return values[name] ?? '';
    },
    async fetch() {
      providerCalls += 1;
      return new Response(JSON.stringify(options.noRoute
        ? { status: 'OK', routes: [{ properties: { totalTime: 'invalid' }, steps: [] }] }
        : { status: 'OK', routes: [{ properties: { totalTime: 300 }, steps: [{ path: { points: [[129, 35.1], [129.1, 35.2]] } }] }] }), { status: 200 });
    },
    async authenticate() { return { user: { aud: 'authenticated', is_anonymous: true } }; },
    async rpc(name, args) {
      rpcNames.push(name);
      if (name === 'route_proxy_get_route') {
        if (options.failGet) return { error: new Error('fixture cache failure') };
        const row = rows.get(key(args));
        return { data: row ? [row] : [] };
      }
      if (name === 'route_proxy_reserve_budget') return { data: [{ granted: true }] };
      if (name === 'route_proxy_claim_fetch_lease') return { data: [{ state: 'claimed', lease_id: 'fixture-lease' }] };
      if (name === 'route_proxy_release_fetch_lease') return options.failRelease ? { error: new Error('fixture release failure') } : { data: 'released' };
      if (name === 'route_proxy_complete_fetch_lease') {
        if (options.failComplete) return { error: new Error('fixture store failure') };
        rows.set(key(args), { total_min: args.p_total_min as number, steps: args.p_steps as unknown[] });
        return { data: 'completed' };
      }
      throw new Error('unexpected fixture RPC');
    },
    now: () => Date.UTC(2026, 8, 3), wait: async () => undefined, consumeRate: async () => true, storeAvailable: () => true,
  };
  const handler = createRouteProxyHandler(deps);
  const invoke = async (fromPoiId: 'a' | 'b', toPoiId: 'a' | 'b', maxNewProviderAttemptCount?: 0 | 1) => {
    const response = await handler(new Request('https://fixture.invalid/route-proxy', {
      method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'transit', scope: { kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId, toPoiId }, ...(maxNewProviderAttemptCount === undefined ? {} : { maxNewProviderAttemptCount }) }),
    }));
    return response.json() as Promise<RouteProxyFunctionResponse>;
  };
  return { invoke, handler, rpcNames, providerCalls: () => providerCalls };
}

test('API-TWO-STOP-01: public A→B provider exact 1 뒤 cache hit 0이며 B→A는 별도 directed key다', async () => {
  const fixture = edgeFixture();
  const abMiss = await fixture.invoke('a', 'b');
  const abHit = await fixture.invoke('a', 'b');
  const baMiss = await fixture.invoke('b', 'a');
  assert.deepEqual([abMiss.receipt, abHit.receipt, baMiss.receipt], [
    { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' },
    { result: 'exact', newProviderAttemptCount: 0, reuse: 'server_cache_hit' },
    { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' },
  ]);
  assert.equal(fixture.providerCalls(), 2);
});

test('API-TWO-STOP-02: public no_route와 provider 이후 complete/release 실패는 실제 attempt 1을 보존한다', async () => {
  const noRoute = edgeFixture({ noRoute: true });
  assert.deepEqual((await noRoute.invoke('a', 'b')).receipt, { result: 'no_route', newProviderAttemptCount: 1, reuse: 'provider_attempt' });
  const store = edgeFixture({ failComplete: true });
  const failed = await store.invoke('a', 'b');
  assert.deepEqual(failed.receipt, { result: 'unavailable', newProviderAttemptCount: 1, reuse: 'provider_attempt', unavailableReason: 'store' });
  assert.equal(store.providerCalls(), 1);
  const release = edgeFixture({ noRoute: true, failRelease: true });
  assert.deepEqual((await release.invoke('a', 'b')).receipt, { result: 'unavailable', newProviderAttemptCount: 1, reuse: 'provider_attempt', unavailableReason: 'store' });
  assert.equal(release.providerCalls(), 1);
});

test('API-TWO-STOP-01: snapshot 일치 A↔B만 public이고 private endpoint는 좌표 request로 분리된다', async () => {
  const requests: RouteProxyFunctionRequest[] = [];
  const adapter = createCourseV1ProxyRouteAdapter({
    resolveScope: createRouteProxyCatalogScopeResolver({ snapshot }),
    invoker: { async invoke(request) { requests.push(request); return exact('walk'); } },
  });
  for (const [from, to] of [[O, A], [A, B], [B, A], [B, D]] as const) void await adapter.getRouteReceipt(from, to, { maxNewProviderAttemptCount: 1 });
  assert.deepEqual(requests.map((request) => ({ scope: request.scope.kind, hasCoordinates: !!request.origin && !!request.destination })), [
    { scope: 'private_request', hasCoordinates: true }, { scope: 'public_segment', hasCoordinates: false },
    { scope: 'public_segment', hasCoordinates: false }, { scope: 'private_request', hasCoordinates: true },
  ]);
});

test('API-TWO-STOP-02: 한 leg는 remaining 1/2/0에 따라 신규 attempt를 1/2/0으로 제한하고 0은 cache-only HTTP만 허용한다', async () => {
  const make = () => {
    let calls = 0;
    const adapter = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke(request) { calls += 1; return request.maxNewProviderAttemptCount === 0
      ? { mode: request.mode, status: 'limited', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' } }
      : request.mode === 'walk' ? exact('walk', 20) : exact('transit'); } } });
    return { adapter, calls: () => calls };
  };
  const one = make(); const oneReceipt = await one.adapter.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 1 });
  const two = make(); const twoReceipt = await two.adapter.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 2 });
  const zero = make(); const zeroReceipt = await zero.adapter.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 0 });
  assert.deepEqual([oneReceipt.newProviderAttemptCount, one.calls(), twoReceipt.newProviderAttemptCount, two.calls(), zeroReceipt.newProviderAttemptCount, zero.calls()], [1, 1, 2, 2, 0, 2]);
});

test('API-TWO-STOP-02: client remaining 0은 public walk cache hit을 쓰고 private은 invoker를 호출하지 않는다', async () => {
  const requests: RouteProxyFunctionRequest[] = [];
  const adapter = createCourseV1ProxyRouteAdapter({ resolveScope: createRouteProxyCatalogScopeResolver({ snapshot }), invoker: { async invoke(request) { requests.push(request); return exact(request.mode, 5, 0); } } });
  const result = await adapter.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 0 });
  const privateResult = await adapter.getRouteReceipt(O, A, { maxNewProviderAttemptCount: 0 });
  assert.deepEqual([result.result, result.newProviderAttemptCount, result.reused, privateResult.result, requests], ['exact', 0, true, 'unavailable', [{ mode: 'walk', scope: { kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }, maxNewProviderAttemptCount: 0 }]]);
});

test('API-TWO-STOP-02: client remaining 0은 walk miss 뒤 transit cache hit만 조회하고 두 miss는 exact가 아니다', async () => {
  const requests: RouteProxyFunctionRequest[] = [];
  const adapter = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke(request) {
    requests.push(request);
    return request.mode === 'walk'
      ? { mode: 'walk', status: 'limited', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' } }
      : exact('transit', 5, 0);
  } } });
  assert.equal((await adapter.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 0 })).result, 'exact');
  assert.deepEqual(requests.map((request) => [request.mode, request.maxNewProviderAttemptCount]), [['walk', 0], ['transit', 0]]);
  const misses = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke(request) { return { mode: request.mode, status: 'limited', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' } }; } } });
  assert.equal((await misses.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 0 })).result, 'unavailable');
  const poisoned = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke(request) { return { ...exact(request.mode, 5, 0), receipt: { result: 'exact', newProviderAttemptCount: 0, reuse: 'provider_attempt' } }; } } });
  const malformed = await poisoned.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 0 });
  assert.equal(malformed.result, 'unavailable');
  if (malformed.result === 'unavailable') assert.equal(malformed.reason, 'invalid_response');
});

test('API-TWO-STOP-02: handler cache-only hit/miss와 private 0은 provider·reserve·lease·complete를 시작하지 않는다', async () => {
  const hit = edgeFixture();
  void await hit.invoke('a', 'b');
  const beforeHit = hit.rpcNames.length;
  const cached = await hit.invoke('a', 'b', 0);
  assert.deepEqual(cached.receipt, { result: 'exact', newProviderAttemptCount: 0, reuse: 'server_cache_hit' });
  assert.deepEqual(hit.rpcNames.slice(beforeHit), ['route_proxy_get_route']);
  assert.equal(hit.providerCalls(), 1);

  const miss = edgeFixture();
  const unavailable = await miss.invoke('a', 'b', 0);
  assert.deepEqual(unavailable.receipt, { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' });
  assert.deepEqual(miss.rpcNames, ['route_proxy_get_route']);
  assert.equal(miss.providerCalls(), 0);

  let privateProvider = 0; const privateRpcs: string[] = [];
  const privateHandler = createRouteProxyHandler({
    env: (name) => ({ ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED: 'true', ROUTE_PROXY_ABUSE_GUARD_APPROVED: 'true', ROUTE_PROXY_FETCH_LEASE_TTL_MS: '5000', ROUTE_PROXY_PROVIDER_DEADLINE_MS: '4750', KAKAO_ROUTE_REST_API_KEY: 'fixture-only' } as Record<string, string>)[name] ?? '',
    fetch: async () => { privateProvider += 1; throw new Error('must not fetch'); }, authenticate: async () => ({ user: { aud: 'authenticated', is_anonymous: true } }),
    rpc: async (name) => { privateRpcs.push(name); throw new Error('must not rpc'); }, now: () => 0, wait: async () => undefined, consumeRate: async () => true, storeAvailable: () => true,
  });
  const privateResponse = await privateHandler(new Request('https://fixture.invalid', { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'walk', scope: { kind: 'private_request' }, origin: O, destination: A, maxNewProviderAttemptCount: 0 }) }));
  assert.deepEqual([(await privateResponse.json()).receipt, privateProvider, privateRpcs], [{ result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' }, 0, []]);
});

test('API-TWO-STOP-02: provider 전 store 실패는 attempt 0이고 손상 allowance는 rejected/provider 0이다', async () => {
  const store = edgeFixture({ failGet: true });
  assert.deepEqual((await store.invoke('a', 'b')).receipt, { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'store' });
  assert.equal(store.providerCalls(), 0);
  const fixture = edgeFixture();
  const response = await fixture.handler(new Request('https://fixture.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'transit', scope: { kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }, maxNewProviderAttemptCount: '0' }),
  }));
  assert.deepEqual((await response.json()).receipt, { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'rejected' });
  assert.equal(fixture.providerCalls(), 0);
});

test('API-TWO-STOP-01: in-flight reuse는 attempt 0이고 malformed receipt는 exact로 승격하지 않는다', async () => {
  const reused = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke(request) { return exact(request.mode, 5, 0, 'in_flight_reuse'); } } });
  assert.deepEqual(await reused.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 1 }), { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true });
  const malformed = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke(request) { return { ...exact(request.mode), receipt: { result: 'no_route', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }; } } });
  const result = await malformed.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 1 });
  assert.equal(result.result, 'unavailable');
  if (result.result === 'unavailable') assert.equal(result.reason, 'invalid_response');
});

test('API-TWO-STOP-01: consumer가 응답을 버려도 시작된 attempt receipt는 환불되지 않고 retry도 없다', async () => {
  let resolve!: (value: RouteProxyFunctionResponse) => void;
  let calls = 0;
  const pending = new Promise<RouteProxyFunctionResponse>((done) => { resolve = done; });
  const adapter = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke() { calls += 1; return pending; } } });
  const ignoredByStaleConsumer = adapter.getRouteReceipt(A, B, { maxNewProviderAttemptCount: 1 });
  resolve(exact('walk'));
  const receipt = await ignoredByStaleConsumer;
  assert.deepEqual([receipt.newProviderAttemptCount, calls], [1, 1]);
});

test('API-TWO-STOP-01: 상세 connector는 API 최대값을 만들지 않고 소비자가 6개에서 차단할 receipt를 유지한다', async () => {
  let edgeCalls = 0;
  const connector = createPrivateWalkConnectorPort({
    auth: { async getSession() { return { accessToken: 'fixture-session' }; } },
    edge: { async invoke() { edgeCalls += 1; return { data: { ...exact('walk'), geometry: { paths: [{ points: [{ lat: 35.1, lon: 129 }, { lat: 35.11, lon: 129.01 }] }] } }, error: null }; } },
  });
  const receipts = [];
  for (let index = 0; index < 7; index += 1) {
    if (index >= 6) break;
    receipts.push((await connector.getConnector({ lat: 35 + index / 100, lon: 129 }, { lat: 35.005 + index / 100, lon: 129.005 })).receipt);
  }
  assert.equal(edgeCalls, 6);
  assert.equal(receipts.every((item) => item.newRequestStarted && item.reuse === 'new_request'), true);
});
