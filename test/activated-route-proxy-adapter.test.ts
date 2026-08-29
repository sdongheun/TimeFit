import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivatedCourseV1RouteAdapter, createRouteProxyCatalogScopeResolver, RouteProxyUnavailableError } from '../src/services/routeProxyActivatedCourseAdapter';
import type { RouteProxyEdgeInvoker } from '../src/services/routeProxyClientAdapter';

const representativeA = { id: 'representative-a', lat: 35.1, lon: 129.0 };
const representativeB = { id: 'representative-b', lat: 35.2, lon: 129.1 };
const outside = { id: 'origin', lat: 35.11, lon: 129.01 };
const snapshot = { version: 'representative-fixture', points: { 'representative-a': { lat: 35.1, lon: 129.0 }, 'representative-b': { lat: 35.2, lon: 129.1 } } };

function authFixture(session: string | null, onSignIn: (token: string) => Promise<string | null> = async () => null) {
  return { async getSession() { return session ? { accessToken: session } : null; }, async signInAnonymously(token: string) { const accessToken = await onSignIn(token); return accessToken ? { accessToken } : null; } };
}

function edgeFixture(onInvoke: (body: unknown) => Promise<unknown> = async () => ({ mode: 'walk', status: 'ok', totalMin: 8, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } })) {
  const requests: unknown[] = [];
  const edge: RouteProxyEdgeInvoker = { async invoke(_name, options) { requests.push(options); return { data: await onInvoke(options.body) as never, error: null }; } };
  return { edge, requests };
}

async function expectUnavailable(action: () => Promise<unknown>, reason: string) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof RouteProxyUnavailableError);
    assert.equal(error.reason, reason);
    assert.equal(error.message, 'route_proxy_unavailable');
    assert.equal(error.cause, undefined);
    return true;
  });
}

test('API4ACT04BR-01: existing session은 one-shot token/sign-in 없이 JWT Proxy adapter만 조립한다', async () => {
  let signedIn = 0;
  const { edge, requests } = edgeFixture();
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, captchaToken: undefined, auth: authFixture('fixture-jwt', async () => { signedIn += 1; return 'unexpected'; }), edge, snapshot });
  assert.deepEqual(await adapter.getRoute(representativeA, representativeB), { mode: 'walk', min: 8, exact: true });
  assert.equal(signedIn, 0);
  assert.deepEqual(requests, [{ body: { mode: 'walk', scope: { kind: 'public_segment', catalogVersion: 'representative-fixture', fromPoiId: 'representative-a', toPoiId: 'representative-b' } }, headers: { Authorization: 'Bearer fixture-jwt' } }]);
});

test('API4ACT04BR-02: session이 없으면 유효 one-shot token만 Auth에 한 번 전달한 뒤 Proxy를 호출한다', async () => {
  const tokens: string[] = [];
  const { edge, requests } = edgeFixture();
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, captchaToken: 'captcha-once', auth: authFixture(null, async (token) => { tokens.push(token); return 'new-jwt'; }), edge, snapshot });
  await adapter.getRoute(representativeA, representativeB);
  assert.deepEqual(tokens, ['captcha-once']);
  assert.equal(requests.length, 1);
});

test('API4ACT04B-01: disabled/token 없음/anonymous Auth 실패는 고정 reason으로만 끝난다', async () => {
  for (const [input, reason] of [
    [{ enabled: false, captchaToken: 'unused', auth: authFixture('existing') }, 'route_proxy_unconfigured'],
    [{ enabled: true, captchaToken: undefined, auth: authFixture(null) }, 'captcha_token_missing'],
    [{ enabled: true, captchaToken: '   ', auth: authFixture(null) }, 'captcha_token_missing'],
    [{ enabled: true, captchaToken: 'valid', auth: authFixture(null, async () => null) }, 'anonymous_auth_failed'],
    [{ enabled: true, captchaToken: 'valid', auth: authFixture(null, async () => { throw new Error('private auth error'); }) }, 'anonymous_auth_failed'],
  ] as const) {
    const { edge, requests } = edgeFixture();
    await expectUnavailable(() => createActivatedCourseV1RouteAdapter({ ...input, edge, snapshot }), reason);
    assert.deepEqual(requests, []);
  }
});

test('API4ACT04B-02: Edge transport·typed 상태·malformed ok는 provider fallback 없이 reason을 분리한다', async () => {
  for (const [response, reason] of [
    [{ status: 'limited' }, 'route_proxy_limited'],
    [{ status: 'in_flight' }, 'route_proxy_in_flight'],
    [{ status: 'route_proxy_unavailable' }, 'route_proxy_unconfigured'],
    [{ status: 'store_unavailable' }, 'route_proxy_store_unavailable'],
    [{ status: 'unconfigured' }, 'route_proxy_unconfigured'],
    [{ status: 'http_error' }, 'route_proxy_provider_failed'],
    [{ status: 'network_error' }, 'route_proxy_provider_failed'],
    [{ status: 'invalid_response' }, 'route_proxy_invalid_response'],
    [{ status: 'rejected' }, 'route_proxy_rejected'],
    [{ status: 'ok', mode: 'walk', totalMin: 0 }, 'route_proxy_invalid_response'],
    [null, 'route_proxy_transport_failed'],
  ] as const) {
    const { edge } = edgeFixture(async () => response && typeof response === 'object'
      ? { ...response, ...(response.status === 'ok' ? { receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } } : {}) }
      : response);
    const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: authFixture('jwt'), edge, snapshot });
    await expectUnavailable(() => adapter.getRoute(representativeA, representativeB), reason);
  }
  const { edge } = edgeFixture(async () => { throw new Error('private edge error'); });
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: authFixture('jwt'), edge, snapshot });
  await expectUnavailable(() => adapter.getRoute(representativeA, representativeB), 'route_proxy_transport_failed');
});

test('API4ACT04B-03: reason 없는 기존 unavailable 생성도 안전한 기본값을 사용한다', () => {
  assert.equal(new RouteProxyUnavailableError().reason, 'route_proxy_unconfigured');
});

test('API4ACT04BR-05: current snapshot representative pair만 public ID scope이고, 그 밖은 request 수명 좌표만 보낸다', async () => {
  const resolver = createRouteProxyCatalogScopeResolver({ snapshot });
  assert.deepEqual(resolver(representativeA, representativeB), { kind: 'public_segment', catalogVersion: 'representative-fixture', fromPoiId: 'representative-a', toPoiId: 'representative-b' });
  assert.deepEqual(resolver(outside, representativeA), { kind: 'private_request' });
  const { edge, requests } = edgeFixture();
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: authFixture('jwt'), edge, snapshot });
  await adapter.getRoute(outside, representativeA);
  assert.deepEqual(requests[0], { body: { mode: 'walk', scope: { kind: 'private_request' }, origin: { lat: 35.11, lon: 129.01 }, destination: { lat: 35.1, lon: 129 } }, headers: { Authorization: 'Bearer jwt' } });
  assert.doesNotMatch(JSON.stringify(requests[0]?.body ?? ''), /catalogVersion|fromPoiId|toPoiId/);
});

test('API4ACT04BR-06: service는 public build/Worker URL 설정을 읽거나 추측하지 않는다', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/services/routeProxyActivatedCourseAdapter.ts', 'utf8'));
  assert.doesNotMatch(source, /EXPO_PUBLIC_ROUTE_PROXY_ENABLED|CAPTCHA_CHALLENGE_URL|workers\.dev|TMAP|ODsay|KAKAO/i);
});

test('API4D-01: 활성 진입점 receipt port는 budget 전에 다음 mode 시작을 멈추고 실제 Edge 호출을 센다', async () => {
  const modes: string[] = [];
  const { edge } = edgeFixture(async (body) => {
    const mode = (body as { mode: 'walk' | 'transit' }).mode; modes.push(mode);
    return mode === 'walk'
      ? { status: 'ok', mode, totalMin: 20, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }
      : { status: 'ok', mode, totalMin: 7, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } };
  });
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: authFixture('jwt'), edge, snapshot });
  assert.deepEqual(await adapter.getRouteReceipt(representativeA, representativeB, { maxNewProviderAttemptCount: 0 }), { result: 'unavailable', newProviderAttemptCount: 0, reused: false });
  assert.deepEqual(modes, []);
  assert.deepEqual(await adapter.getRouteReceipt(representativeA, representativeB, { maxNewProviderAttemptCount: 1 }), { result: 'unavailable', newProviderAttemptCount: 1, reused: false });
  assert.deepEqual(modes, ['walk']);
  assert.deepEqual(await adapter.getRouteReceipt(representativeA, representativeB, { maxNewProviderAttemptCount: 2 }), { result: 'exact', route: { mode: 'transit', min: 7, exact: true }, newProviderAttemptCount: 2, reused: false });
  assert.deepEqual(modes, ['walk', 'walk', 'transit']);
});

test('API4D-02: 활성 receipt port는 cache/in-flight 재사용, no_route 및 fail-closed receipt를 engine 계약으로 보존한다', async () => {
  const modes: string[] = [];
  const responses = [
    { status: 'ok', mode: 'walk', totalMin: 20, receipt: { result: 'exact', newProviderAttemptCount: 0, reuse: 'server_cache_hit' } },
    { status: 'ok', mode: 'transit', totalMin: 7, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } },
    { status: 'no_route', mode: 'walk', receipt: { result: 'no_route', newProviderAttemptCount: 0, reuse: 'in_flight_reuse' } },
    { status: 'no_route', mode: 'transit', receipt: { result: 'no_route', newProviderAttemptCount: 0, reuse: 'server_cache_hit' } },
    { status: 'limited', mode: 'walk', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' } },
  ];
  const { edge } = edgeFixture(async (body) => { modes.push((body as { mode: string }).mode); return responses.shift()!; });
  const adapter = await createActivatedCourseV1RouteAdapter({ enabled: true, auth: authFixture('jwt'), edge, snapshot });
  assert.deepEqual(await adapter.getRouteReceipt(representativeA, representativeB, { maxNewProviderAttemptCount: 1 }), { result: 'exact', route: { mode: 'transit', min: 7, exact: true }, newProviderAttemptCount: 1, reused: false });
  assert.deepEqual(await adapter.getRouteReceipt(representativeA, representativeB, { maxNewProviderAttemptCount: 2 }), { result: 'no_route', newProviderAttemptCount: 0, reused: true });
  assert.deepEqual(await adapter.getRouteReceipt(representativeA, representativeB, { maxNewProviderAttemptCount: 2 }), { result: 'unavailable', newProviderAttemptCount: 0, reused: false });
  assert.deepEqual(modes, ['walk', 'transit', 'walk', 'transit', 'walk']);
});
