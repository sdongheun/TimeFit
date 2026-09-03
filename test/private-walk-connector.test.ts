import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPrivateWalkConnectorPort,
  type PrivateWalkConnectorResult,
} from '../src/services/privateWalkConnector';
import type { RouteProxyEdgeInvoker, RouteProxyFunctionResponse } from '../src/services/routeProxyClientAdapter';

const from = { lat: 35.157, lon: 129.059 };
const to = { lat: 35.158, lon: 129.061 };
const geometry = { paths: [{ points: [from, to] }] };
const exactResponse = (): RouteProxyFunctionResponse => ({
  mode: 'walk',
  status: 'ok',
  totalMin: 3,
  geometry,
  receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' },
});

function harness(response: RouteProxyFunctionResponse | (() => Promise<RouteProxyFunctionResponse>) = exactResponse()) {
  let now = 1_000_000;
  let sessions = 0;
  let signIns = 0;
  const requests: Array<{ name: string; options: unknown }> = [];
  const edge: RouteProxyEdgeInvoker = {
    async invoke(name, options) {
      requests.push({ name, options });
      const data = typeof response === 'function' ? await response() : response;
      return { data, error: null };
    },
  };
  const auth = {
    async getSession() { sessions += 1; return { accessToken: 'fixture-session', expiresAt: Math.floor(now / 1_000) + 3_600 }; },
    async signInAnonymously() { signIns += 1; return null; },
  };
  const port = createPrivateWalkConnectorPort({ auth, edge, clock: { now: () => now } });
  return { port, requests, auth, counts: () => ({ sessions, signIns }), advance: (ms: number) => { now += ms; } };
}

test('API-ROUTE-GEOMETRY-03: 현재 session으로 private walk를 정확히 한 번 호출하고 시간은 결과 계약에서 제외한다', async () => {
  const h = harness();
  const result = await h.port.getConnector(from, to);
  assert.deepEqual(result, { status: 'exact_geometry', geometry, receipt: { newRequestStarted: true, reuse: 'new_request' } });
  assert.equal('totalMin' in result, false);
  assert.deepEqual(h.requests, [{
    name: 'route-proxy',
    options: {
      body: { mode: 'walk', scope: { kind: 'private_request' }, origin: from, destination: to },
      headers: { Authorization: 'Bearer fixture-session' },
    },
  }]);
});

test('API-ROUTE-GEOMETRY-03: session 부재·만료는 sign-in/CAPTCHA/Edge 없이 unavailable이다', async () => {
  for (const session of [null, { accessToken: 'expired', expiresAt: 999 }]) {
    let edgeCalls = 0;
    let signIns = 0;
    const auth = {
      async getSession() { return session; },
      async signInAnonymously() { signIns += 1; return { accessToken: 'must-not-use' }; },
    };
    const result = await createPrivateWalkConnectorPort({
      auth,
      edge: { async invoke() { edgeCalls += 1; return { data: exactResponse(), error: null }; } },
      clock: { now: () => 1_000_000 },
    }).getConnector(from, to);
    assert.deepEqual(result, { status: 'unavailable', reason: 'session_unavailable', receipt: { newRequestStarted: false, reuse: 'none' } });
    assert.deepEqual({ edgeCalls, signIns }, { edgeCalls: 0, signIns: 0 });
  }
});

test('API-ROUTE-GEOMETRY-03: no-route와 malformed/transport는 재시도·transit 없이 안전 결과로 닫힌다', async () => {
  const cases: Array<[RouteProxyFunctionResponse | (() => Promise<RouteProxyFunctionResponse>), PrivateWalkConnectorResult['status']]> = [
    [{ mode: 'walk', status: 'no_route', receipt: { result: 'no_route', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }, 'no_route'],
    [{ mode: 'walk', status: 'limited', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'limited' } }, 'unavailable'],
    [{ mode: 'transit', status: 'ok', totalMin: 3, geometry, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }, 'unavailable'],
    [{ mode: 'walk', status: 'ok', totalMin: 0, geometry, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }, 'unavailable'],
    [{ mode: 'walk', status: 'ok', totalMin: 3, geometry }, 'unavailable'],
    [{ mode: 'walk', status: 'ok', totalMin: 3, geometry: { paths: [{ points: [from] }] }, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }, 'unavailable'],
    [async () => { throw new Error('fixture transport detail'); }, 'unavailable'],
  ];
  for (const [response, status] of cases) {
    const h = harness(response);
    const result = await h.port.getConnector(from, to);
    assert.equal(result.status, status);
    assert.equal(h.requests.length, 1);
    assert.equal((h.requests[0].options as { body: { mode: string } }).body.mode, 'walk');
  }
});

test('API-ROUTE-GEOMETRY-03: 동일 in-flight·10분 cache를 재사용하고 만료/reset 뒤에만 새 호출한다', async () => {
  let resolve!: (value: RouteProxyFunctionResponse) => void;
  const deferred = new Promise<RouteProxyFunctionResponse>((done) => { resolve = done; });
  const h = harness(() => deferred);
  const first = h.port.getConnector(from, to);
  const second = h.port.getConnector(from, to);
  await new Promise<void>((done) => setImmediate(done));
  assert.equal(h.requests.length, 1);
  resolve(exactResponse());
  assert.deepEqual((await first).receipt, { newRequestStarted: true, reuse: 'new_request' });
  assert.deepEqual((await second).receipt, { newRequestStarted: false, reuse: 'in_flight' });
  assert.deepEqual((await h.port.getConnector(from, to)).receipt, { newRequestStarted: false, reuse: 'memory' });
  assert.equal(h.requests.length, 1);
  h.advance(600_001);
  void await h.port.getConnector(from, to);
  assert.equal(h.requests.length, 2);
  h.port.reset();
  void await h.port.getConnector(from, to);
  assert.equal(h.requests.length, 3);
});

test('API-ROUTE-GEOMETRY-03: process cache는 64개 상한에서 오래된 완료 항목을 제거한다', async () => {
  let calls = 0;
  const memoryCache = new Map<string, unknown>();
  const port = createPrivateWalkConnectorPort({
    auth: { async getSession() { return { accessToken: 'fixture-session' }; } },
    edge: { async invoke() { calls += 1; return { data: exactResponse(), error: null }; } },
    memoryCache,
  });
  for (let index = 0; index < 65; index += 1) {
    void await port.getConnector({ lat: 35 + index / 10_000, lon: 129 }, to);
  }
  assert.equal(calls, 65);
  assert.equal(memoryCache.size, 64);
  void await port.getConnector({ lat: 35, lon: 129 }, to);
  assert.equal(calls, 66);
  port.reset();
  assert.equal(memoryCache.size, 0);
});

test('API-ROUTE-GEOMETRY-03: 어댑터 구현은 좌표·식별자를 console로 기록하지 않는다', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('src/services/privateWalkConnector.ts', 'utf8'));
  assert.doesNotMatch(source, /console\.|JSON\.stringify|localStorage|AsyncStorage/);
  let logs = 0;
  const originals = { log: console.log, warn: console.warn, error: console.error, debug: console.debug };
  console.log = () => { logs += 1; };
  console.warn = () => { logs += 1; };
  console.error = () => { logs += 1; };
  console.debug = () => { logs += 1; };
  try {
    void await harness().port.getConnector(from, to);
  } finally {
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
    console.debug = originals.debug;
  }
  assert.equal(logs, 0);
});
