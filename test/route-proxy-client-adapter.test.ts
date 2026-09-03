import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRouteProxyInvoker, createCourseV1ProxyRouteAdapter, type RouteProxyFunctionRequest } from '../src/services/routeProxyClientAdapter';
import { ensureRouteProxyAnonymousSession } from '../src/services/routeProxyAnonymousAuth';

const a = { id: 'a', lat: 35.1, lon: 129.0 }; const b = { id: 'b', lat: 35.2, lon: 129.1 };

test('API4AR-01: public scope는 좌표 없이 Edge Function에 전달하고 ok exact route만 엔진 계약으로 바꾼다', async () => {
  const requests: RouteProxyFunctionRequest[] = [];
  const adapter = createCourseV1ProxyRouteAdapter({
    resolveScope: () => ({ kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' }),
    invoker: { async invoke(request) { requests.push(request); return { provider: 'kakao', mode: 'walk', status: 'ok', totalMin: 8 }; } },
  });
  assert.deepEqual([await adapter.getRoute(a, b), requests], [{ mode: 'walk', min: 8, exact: true }, [{ mode: 'walk', scope: { kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' } }]]);
});

test('API4AR-02: private scope만 request 수명 좌표를 보내고 non-ok/근사/차량은 null이다', async () => {
  const requests: RouteProxyFunctionRequest[] = [];
  const adapter = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'private_request' }), invoker: { async invoke(request) { requests.push(request); return { mode: request.mode, status: request.mode === 'walk' ? 'network_error' : 'limited' }; } } });
  assert.equal(await adapter.getRoute(a, b), null);
  assert.deepEqual(requests.map(request => [request.mode, !!request.origin, !!request.destination]), [['walk', true, true], ['transit', true, true]]);
});

test('API4C-02: walk/transit receipt는 새 provider attempt만 0~2 합산하고 ExactRoute 소비를 유지한다', async () => {
  const responses = [
    { mode: 'walk' as const, status: 'ok' as const, totalMin: 20, receipt: { result: 'exact' as const, newProviderAttemptCount: 0 as const, reuse: 'server_cache_hit' as const } },
    { mode: 'transit' as const, status: 'ok' as const, totalMin: 8, receipt: { result: 'exact' as const, newProviderAttemptCount: 1 as const, reuse: 'provider_attempt' as const } },
  ];
  const adapter = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' }), invoker: { async invoke() { return responses.shift()!; } } });
  assert.deepEqual(await adapter.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 2 }), { result: 'exact', route: { mode: 'transit', min: 8, exact: true }, newProviderAttemptCount: 1, reused: false });
});

test('API-MULTISTOP-RECEIPT-02: typed unavailable은 원문 없이 engine safe reason으로만 전달한다', async () => {
  const cases = [
    ['limited', 'limited', 'limited'],
    ['store_unavailable', 'store', 'store'],
    ['http_error', 'provider', 'provider'],
    ['network_error', 'transport', 'transport'],
    ['invalid_response', 'invalid_response', 'invalid_response'],
    ['rejected', 'rejected', 'rejected'],
    ['in_flight', 'transport', 'in_flight'],
  ] as const;
  for (const [status, unavailableReason, expected] of cases) {
    const adapter = createCourseV1ProxyRouteAdapter({
      resolveScope: () => ({ kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' }),
      invoker: { async invoke(request) { return { mode: request.mode, status, receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: status === 'in_flight' ? 'in_flight_reuse' : 'provider_attempt', unavailableReason } }; } },
    });
    assert.deepEqual(await adapter.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 1 }), { result: 'unavailable', reason: expected, newProviderAttemptCount: 0, reused: status === 'in_flight' });
  }
});

test('API-MULTISTOP-RECEIPT-02: receipt 누락·오염과 local budget unavailable은 API 원인을 만들지 않고 unknown이다', async () => {
  let invocations = 0;
  const adapter = createCourseV1ProxyRouteAdapter({
    resolveScope: () => ({ kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' }),
    invoker: { async invoke(request) { invocations += 1; return invocations === 1
      ? { mode: request.mode, status: 'limited', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'not-safe' } as never }
      : { mode: request.mode, status: 'limited' }; } },
  });
  assert.deepEqual(await adapter.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 1 }), { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false });
  assert.deepEqual(await adapter.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 1 }), { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false });
  assert.deepEqual(await adapter.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 0 }), { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false });
  assert.equal(invocations, 3);
});

test('API-MULTISTOP-RECEIPT-02: exact/no_route에는 unavailable reason을 붙이지 않는다', async () => {
  const exact = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'private_request' }), invoker: { async invoke() { return { mode: 'walk', status: 'ok', totalMin: 8, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }; } } });
  const noRoute = createCourseV1ProxyRouteAdapter({ resolveScope: () => ({ kind: 'private_request' }), invoker: { async invoke(request) { return { mode: request.mode, status: 'no_route', receipt: { result: 'no_route', newProviderAttemptCount: 0, reuse: 'server_cache_hit' } }; } } });
  assert.deepEqual(await exact.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 1 }), { result: 'exact', route: { mode: 'walk', min: 8, exact: true }, newProviderAttemptCount: 1, reused: false });
  assert.deepEqual(await noRoute.getRouteReceipt(a, b, { maxNewProviderAttemptCount: 1 }), { result: 'no_route', newProviderAttemptCount: 0, reused: true });
});

test('API4AR2-01: session은 재사용하고, 익명 Auth가 비활성/실패하면 route proxy unavailable로 끝낸다', async () => {
  let created = 0;
  const captcha = { async requestToken() { return 'fixture-captcha'; } };
  const reused = await ensureRouteProxyAnonymousSession({ anonymousAuthEnabled: false, captcha, auth: { async getSession() { return { accessToken: 'fixture-token' }; }, async signInAnonymously() { created += 1; return null; } } });
  const disabled = await ensureRouteProxyAnonymousSession({ anonymousAuthEnabled: false, captcha, auth: { async getSession() { return null; }, async signInAnonymously() { created += 1; return { accessToken: 'new' }; } } });
  const failed = await ensureRouteProxyAnonymousSession({ anonymousAuthEnabled: true, captcha, auth: { async getSession() { return null; }, async signInAnonymously() { created += 1; return null; } } });
  assert.deepEqual([reused.status, disabled.status, failed.status, created], ['ready', 'route_proxy_unavailable', 'route_proxy_unavailable', 1]);
});

test('API4AR2-02: Edge invoker는 Auth JWT만 route-proxy header로 보내며 provider key를 받지 않는다', async () => {
  let captured: unknown;
  const invoker = createAuthenticatedRouteProxyInvoker({ accessToken: 'fixture-jwt', edge: { async invoke(_name, options) { captured = options; return { data: { status: 'limited' }, error: null }; } } });
  const result = await invoker.invoke({ mode: 'walk', scope: { kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' } });
  assert.deepEqual([result.status, captured], ['limited', { body: { mode: 'walk', scope: { kind: 'public_segment', catalogVersion: 'v1', fromPoiId: 'a', toPoiId: 'b' } }, headers: { Authorization: 'Bearer fixture-jwt' } }]);
});

test('API4ACT04A-01: 기존 session은 CAPTCHA/sign-in 0회, 새 anonymous session은 유효 token을 Auth에 한 번만 전달한다', async () => {
  let tokens = 0; let signIns: string[] = [];
  const existing = await ensureRouteProxyAnonymousSession({ anonymousAuthEnabled: true, captcha: { async requestToken() { tokens += 1; return 'unused'; } }, auth: { async getSession() { return { accessToken: 'existing' }; }, async signInAnonymously(token) { signIns.push(token); return null; } } });
  const created = await ensureRouteProxyAnonymousSession({ anonymousAuthEnabled: true, captcha: { async requestToken() { tokens += 1; return 'turnstile-token'; } }, auth: { async getSession() { return null; }, async signInAnonymously(token) { signIns.push(token); return { accessToken: 'new' }; } } });
  assert.deepEqual([existing, created, tokens, signIns], [{ status: 'ready', accessToken: 'existing' }, { status: 'ready', accessToken: 'new' }, 1, ['turnstile-token']]);
});

test('API4ACT04A-02: 취소·오류·공백 CAPTCHA token은 sign-in·provider fallback 없이 fail-closed한다', async () => {
  for (const requestToken of [async () => null, async () => '', async () => '   ', async () => { throw new Error('challenge failed'); }]) {
    let signIns = 0;
    const result = await ensureRouteProxyAnonymousSession({ anonymousAuthEnabled: true, captcha: { requestToken }, auth: { async getSession() { return null; }, async signInAnonymously() { signIns += 1; return { accessToken: 'must-not-create' }; } } });
    assert.deepEqual(result, { status: 'route_proxy_unavailable' });
    assert.equal(signIns, 0);
  }
});
