import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouteProxyHandler, type RouteProxyHandlerDependencies } from '../supabase/functions/route-proxy/handler';

type Store = ReturnType<typeof fakeStore>;

type BudgetReply = { granted: boolean; reason?: 'soft_limit' | 'daily_limit' | 'rate_limit' };

function fakeStore(options: { cachedTotal?: number; reserveGranted?: boolean; reserveResults?: Partial<Record<'walk' | 'transit', BudgetReply[]>>; leaseInFlight?: boolean; failRpc?: string } = {}) {
  let next = 0;
  const active = new Map<string, string>();
  const claims: string[] = []; const releases: string[] = []; const completes: string[] = []; const calls: string[] = []; const reservations: Record<string, unknown>[] = [];
  const rpc: RouteProxyHandlerDependencies['rpc'] = async (name, args) => {
    calls.push(name);
    if (name === options.failRpc) throw new Error('fixture store failure');
    const provider = String(args.p_provider ?? ''); const key = `${provider}|${args.p_mode ?? ''}|${args.p_from_poi_id ?? ''}|${args.p_to_poi_id ?? ''}`;
    if (name === 'route_proxy_get_route') return { data: options.cachedTotal ? [{ total_min: options.cachedTotal, steps: [] }] : [] };
    if (name === 'route_proxy_read_budget') throw new Error('provider-only budget read must not be used');
    if (name === 'route_proxy_reserve_budget') {
      reservations.push(args);
      const mode = String(args.p_mode) as 'walk' | 'transit';
      const reply = options.reserveResults?.[mode]?.shift() ?? { granted: options.reserveGranted ?? true, ...(options.reserveGranted === false ? { reason: 'daily_limit' as const } : {}) };
      return { data: [reply] };
    }
    if (name === 'route_proxy_claim_fetch_lease') {
      if (options.leaseInFlight) return { data: [{ state: 'in_flight', retry_after_ms: 0 }] };
      if (active.has(key)) return { data: [{ state: 'in_flight', retry_after_ms: 0 }] };
      const token = `lease-${++next}`; active.set(key, token); claims.push(token); return { data: [{ state: 'claimed', lease_id: token }] };
    }
    if (name === 'route_proxy_release_fetch_lease') { const token = String(args.p_lease_id); if (active.get(key) === token) active.delete(key); releases.push(token); return { data: 'released' }; }
    if (name === 'route_proxy_complete_fetch_lease') { const token = String(args.p_lease_id); if (active.get(key) === token) active.delete(key); completes.push(token); return { data: 'completed' }; }
    throw new Error(`unexpected rpc ${name}`);
  };
  return { rpc, claims, releases, completes, calls, reservations };
}

function scheduler() {
  let timeout: (() => void) | undefined;
  return {
    setTimeout(callback: () => void) { timeout = callback; return 1; },
    clearTimeout() { timeout = undefined; },
    ready() { return timeout !== undefined; },
    fire() { const callback = timeout; timeout = undefined; callback?.(); },
  };
}

async function fireDeadline(clock: ReturnType<typeof scheduler>) {
  for (let index = 0; index < 20 && !clock.ready(); index += 1) await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(clock.ready(), true, 'provider deadline scheduler가 등록되어야 한다');
  clock.fire();
}

function response(raw: unknown) { return new Response(JSON.stringify(raw), { status: 200 }); }

function fixture(options: { mode: 'walk' | 'transit'; private?: boolean; invalidDeadline?: boolean; missingSecret?: boolean; anonymousDisabled?: boolean; abuseDenied?: boolean; authDenied?: boolean; storeUnavailable?: boolean; cachedTotal?: number; reserveGranted?: boolean; reserveResults?: Partial<Record<'walk' | 'transit', BudgetReply[]>>; leaseInFlight?: boolean; failRpc?: string; fetch: RouteProxyHandlerDependencies['fetch'] }) {
  const store = fakeStore(options); const clock = scheduler();
  const values: Record<string, string> = {
    ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED: options.anonymousDisabled ? 'false' : 'true', ROUTE_PROXY_ABUSE_GUARD_APPROVED: options.abuseDenied ? 'false' : 'true', ROUTE_PROXY_FETCH_LEASE_TTL_MS: options.invalidDeadline ? '' : '5000', ROUTE_PROXY_PROVIDER_DEADLINE_MS: options.invalidDeadline ? '' : '4750', ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT: '10', ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT: '9', ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT: '3', ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT: '20', ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT: '18', ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT: '4', KAKAO_ROUTE_REST_API_KEY: options.missingSecret ? '' : 'fixture', ROUTE_PROXY_CATALOG_SNAPSHOT_JSON: JSON.stringify({ version: 'fixture-v1', points: { from: { lat: 35.1, lon: 129.0 }, to: { lat: 35.2, lon: 129.1 } } }),
  };
  const rawHandler = createRouteProxyHandler({ env: (name) => values[name] ?? '', fetch: options.fetch, authenticate: async () => options.authDenied ? ({ user: null }) : ({ user: { aud: 'authenticated', is_anonymous: options.anonymousDisabled } }), rpc: store.rpc, now: () => 0, wait: async () => undefined, consumeRate: async () => !options.abuseDenied, storeAvailable: () => !options.storeUnavailable, deadlineScheduler: clock });
  // Legacy assertions consume only ExactRoute-era fields; receipt assertions use rawHandler below.
  const handler = async (request: Request) => { const value = await (await rawHandler(request)).json(); const { receipt: _receipt, ...legacy } = value as Record<string, unknown>; return response(legacy.mode ? { provider: 'kakao', ...legacy } : legacy); };
  const request = (mode = options.mode) => {
    const body = options.private ? { mode, scope: { kind: 'private_request' }, origin: { lat: 35.1, lon: 129.0 }, destination: { lat: 35.2, lon: 129.1 } } : { mode, scope: { kind: 'public_segment', catalogVersion: 'fixture-v1', fromPoiId: 'from', toPoiId: 'to' } };
    return new Request('https://fixture.invalid/route-proxy', { method: 'POST', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  };
  return { handler, rawHandler, request, store, clock };
}

async function timeoutThenLate(signal: AbortSignal, observed: { aborts: number }) {
  return new Promise<Response>((resolve) => signal.addEventListener('abort', () => { observed.aborts += 1; resolve(response({ status: 'OK', routes: [{ properties: { totalTime: 60 } }] })); }, { once: true }));
}

test('API4AR2RB-01/02: public transit timeout은 abort·release 1회 뒤 새 owner claim을 허용하고 늦은 성공을 complete하지 않는다', async () => {
  const observed = { aborts: 0, fetches: 0 };
  const setup = fixture({ mode: 'transit', fetch: async (_url, init) => { observed.fetches += 1; return timeoutThenLate(init.signal as AbortSignal, observed); } });
  const first = setup.handler(setup.request()); await fireDeadline(setup.clock);
  assert.deepEqual(await (await first).json(), { provider: 'kakao', mode: 'transit', status: 'deadline_exceeded' });
  assert.deepEqual([observed.aborts, observed.fetches, setup.store.claims, setup.store.releases, setup.store.completes], [1, 1, ['lease-1'], ['lease-1'], []]);

  const second = setup.handler(setup.request()); await fireDeadline(setup.clock); await second;
  assert.deepEqual(setup.store.claims, ['lease-1', 'lease-2']);
  assert.deepEqual(setup.store.completes, []);
});

test('API4ACT02K-03: Kakao-only walk timeout은 TMAP fallback 없이 한 번만 호출하고 lease를 release한다', async () => {
  const providers: string[] = []; const observed = { aborts: 0 };
  const setup = fixture({ mode: 'walk', fetch: async (url, init) => {
    providers.push(url.includes('kakao') ? 'kakao' : 'tmap');
    return timeoutThenLate(init.signal as AbortSignal, observed);
  } });
  const pending = setup.handler(setup.request()); await fireDeadline(setup.clock);
  assert.deepEqual(await (await pending).json(), { provider: 'kakao', mode: 'walk', status: 'deadline_exceeded' });
  assert.deepEqual([providers, observed.aborts, setup.store.claims, setup.store.releases, setup.store.completes], [['kakao'], 1, ['lease-1'], ['lease-1'], []]);
});

test('API4AR2RB-04: transit timeout은 Kakao 한 번만 호출하고 fallback provider를 시작하지 않는다', async () => {
  const providers: string[] = []; const observed = { aborts: 0 };
  const setup = fixture({ mode: 'transit', fetch: async (url, init) => { providers.push(url.includes('kakao') ? 'kakao' : 'tmap'); return timeoutThenLate(init.signal as AbortSignal, observed); } });
  const pending = setup.handler(setup.request()); await fireDeadline(setup.clock); await pending;
  assert.deepEqual([providers, observed.aborts, setup.store.releases, setup.store.completes], [['kakao'], 1, ['lease-1'], []]);
});

test('API4AR2RB-05: private timeout은 같은 abort 결과지만 lease RPC를 호출하지 않는다', async () => {
  const observed = { aborts: 0 };
  const setup = fixture({ mode: 'transit', private: true, fetch: async (_url, init) => timeoutThenLate(init.signal as AbortSignal, observed) });
  const pending = setup.handler(setup.request()); await fireDeadline(setup.clock);
  assert.deepEqual(await (await pending).json(), { provider: 'kakao', mode: 'transit', status: 'deadline_exceeded' });
  assert.equal(observed.aborts, 1);
  assert.deepEqual(setup.store.calls.filter((name) => name.includes('lease')), []);
});

test('API4AR2RB-06: deadline 설정이 없으면 provider·budget·lease RPC 전에 fail-closed한다', async () => {
  let fetches = 0;
  const setup = fixture({ mode: 'transit', invalidDeadline: true, fetch: async () => { fetches += 1; return response({}); } });
  assert.deepEqual(await (await setup.handler(setup.request())).json(), { provider: 'kakao', mode: 'transit', status: 'network_error' });
  assert.equal(fetches, 0);
  assert.deepEqual(setup.store.calls, []);
});

test('API4ACT02K-04: walk·transit 성공은 mode별 Kakao HTTP 한 번과 독립 cache/budget/lease를 사용한다', async () => {
  for (const mode of ['walk', 'transit'] as const) {
    const urls: string[] = [];
    const setup = fixture({ mode, fetch: async (url) => { urls.push(url); return response(mode === 'walk' ? { status: 'OK', route: { properties: { totalTime: 60 } } } : { status: 'OK', routes: [{ properties: { totalTime: 120 } }] }); } });
    const result = await (await setup.handler(setup.request())).json();
    assert.deepEqual(result, { provider: 'kakao', mode, status: 'ok', totalMin: mode === 'walk' ? 1 : 2 });
    assert.equal(urls.length, 1);
    assert.match(urls[0], new RegExp(`/v2/routing/${mode === 'walk' ? 'walk' : 'publictraffic'}\\?`));
    assert.deepEqual([setup.store.claims, setup.store.completes, setup.store.releases], [['lease-1'], ['lease-1'], []]);
  }
});

test('API4ACT02K-05: Kakao HTTP 실패·한도 초과는 mode별 fallback 없이 lease를 한 번만 정리한다', async () => {
  for (const mode of ['walk', 'transit'] as const) {
    const failed = fixture({ mode, fetch: async () => new Response('{}', { status: 500 }) });
    assert.deepEqual(await (await failed.handler(failed.request())).json(), { provider: 'kakao', mode, status: 'http_error' });
    assert.deepEqual([failed.store.claims, failed.store.releases, failed.store.completes], [['lease-1'], ['lease-1'], []]);
    const limited = fixture({ mode, reserveGranted: false, fetch: async () => { throw new Error('provider must not be called'); } });
    assert.deepEqual(await (await limited.handler(limited.request())).json(), { provider: 'kakao', mode, status: 'limited' });
    assert.deepEqual([limited.store.claims, limited.store.releases, limited.store.completes], [['lease-1'], ['lease-1'], []]);
  }
});

test('API4ACT02K-06: Kakao secret 누락과 auth/abuse gate는 provider·budget·lease 전에 차단한다', async () => {
  const cases = [
    { missingSecret: true, expected: { provider: 'kakao', mode: 'walk', status: 'unconfigured' } },
    { authDenied: true, expected: { provider: 'kakao', mode: 'walk', status: 'rejected' } },
    { anonymousDisabled: true, expected: { provider: 'kakao', mode: 'walk', status: 'rejected' } },
    { abuseDenied: true, expected: { provider: 'kakao', mode: 'walk', status: 'limited' } },
  ];
  for (const item of cases) {
    let fetches = 0;
    const setup = fixture({ mode: 'walk', ...item, fetch: async () => { fetches += 1; return response({}); } });
    assert.deepEqual(await (await setup.handler(setup.request())).json(), item.expected);
    assert.equal(fetches, 0);
    assert.deepEqual(setup.store.calls, []);
  }
});

test('API4ACT02K-07: public same segment+mode cache hit은 provider HTTP·budget·lease 없이 Kakao 결과를 반환한다', async () => {
  let fetches = 0;
  const setup = fixture({ mode: 'walk', cachedTotal: 7, fetch: async () => { fetches += 1; return response({}); } });
  assert.deepEqual(await (await setup.handler(setup.request())).json(), { provider: 'kakao', mode: 'walk', status: 'ok', totalMin: 7 });
  assert.equal(fetches, 0);
  assert.deepEqual(setup.store.calls, ['route_proxy_get_route']);
});

test('API4ACT02KR-01: walk soft-limit은 transit quota를 막지 않고, mode별 soft/hard/rate를 새 RPC에 전달한다', async () => {
  const fetchModes: string[] = [];
  const setup = fixture({ mode: 'walk', reserveResults: { walk: [{ granted: false, reason: 'soft_limit' }], transit: [{ granted: true }] }, fetch: async (url) => { fetchModes.push(url.includes('/walk?') ? 'walk' : 'transit'); return response(url.includes('/walk?') ? { status: 'OK', route: { properties: { totalTime: 60 } } } : { status: 'OK', routes: [{ properties: { totalTime: 60 } }] }); } });
  assert.deepEqual(await (await setup.handler(setup.request('walk'))).json(), { provider: 'kakao', mode: 'walk', status: 'limited' });
  assert.deepEqual(await (await setup.handler(setup.request('transit'))).json(), { provider: 'kakao', mode: 'transit', status: 'ok', totalMin: 1 });
  assert.deepEqual(fetchModes, ['transit']);
  assert.deepEqual(setup.store.reservations.map((args) => [args.p_mode, args.p_soft_limit, args.p_hard_limit, args.p_per_second_limit]), [['walk', 9, 10, 3], ['transit', 18, 20, 4]]);
  assert.deepEqual([setup.store.releases, setup.store.completes], [['lease-1'], ['lease-2']]);
});

test('API4ACT02KR-02: DB typed hard/rate reason은 mode별 limited로 fail-closed하고 provider 재시도·lease 누수가 없다', async () => {
  for (const [mode, reason] of [['walk', 'daily_limit'], ['transit', 'rate_limit']] as const) {
    let fetches = 0;
    const setup = fixture({ mode, reserveResults: { [mode]: [{ granted: false, reason }] }, fetch: async () => { fetches += 1; return response({}); } });
    assert.deepEqual(await (await setup.handler(setup.request())).json(), { provider: 'kakao', mode, status: 'limited' });
    assert.equal(fetches, 0);
    assert.deepEqual([setup.store.claims, setup.store.releases, setup.store.completes], [['lease-1'], ['lease-1'], []]);
  }
});

test('API4ACT03-01: private walk·transit도 provider HTTP 직전 mode별 reserve를 정확히 한 번 소비하고 cache/lease를 쓰지 않는다', async () => {
  for (const mode of ['walk', 'transit'] as const) {
    let fetches = 0;
    const setup = fixture({ mode, private: true, fetch: async () => { fetches += 1; return response(mode === 'walk' ? { status: 'OK', route: { properties: { totalTime: 60 } } } : { status: 'OK', routes: [{ properties: { totalTime: 60 } }] }); } });
    assert.deepEqual(await (await setup.handler(setup.request())).json(), { provider: 'kakao', mode, status: 'ok', totalMin: 1 });
    assert.equal(fetches, 1);
    assert.deepEqual(setup.store.reservations.map((args) => args.p_mode), [mode]);
    assert.deepEqual(setup.store.calls.filter((name) => name.includes('route') || name.includes('lease')), ['route_proxy_reserve_budget']);
  }
});

test('API-PUBLIC-STORE-01: private 구간은 public cache lookup 없이 budget RPC 뒤 provider 경계로 진행한다', async () => {
  let fetches = 0;
  const setup = fixture({ mode: 'walk', private: true, fetch: async () => { fetches += 1; return response({ status: 'OK', route: { properties: { totalTime: 60 } } }); } });
  const body = await (await setup.rawHandler(setup.request())).json();
  assert.deepEqual(body.receipt, { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' });
  assert.equal(fetches, 1);
  assert.deepEqual(setup.store.calls, ['route_proxy_reserve_budget']);
});

test('API-PUBLIC-STORE-01: public cache RPC 하나의 실패는 provider 0회 store_unavailable receipt로 끝난다', async () => {
  let fetches = 0;
  const setup = fixture({ mode: 'walk', failRpc: 'route_proxy_get_route', fetch: async () => { fetches += 1; return response({ status: 'OK', route: { properties: { totalTime: 60 } } }); } });
  const responseBody = await (await setup.rawHandler(setup.request())).json();
  assert.deepEqual(responseBody, { mode: 'walk', status: 'store_unavailable', receipt: { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: 'store' } });
  assert.equal(fetches, 0);
  assert.deepEqual(setup.store.calls, ['route_proxy_get_route']);
});

test('API4ACT03-02: private typed soft/daily/rate 제한은 Kakao HTTP·cache·lease 없이 limited로 끝난다', async () => {
  for (const [mode, reason] of [['walk', 'soft_limit'], ['walk', 'daily_limit'], ['transit', 'rate_limit']] as const) {
    let fetches = 0;
    const setup = fixture({ mode, private: true, reserveResults: { [mode]: [{ granted: false, reason }] }, fetch: async () => { fetches += 1; return response({}); } });
    assert.deepEqual(await (await setup.handler(setup.request())).json(), { provider: 'kakao', mode, status: 'limited' });
    assert.equal(fetches, 0);
    assert.deepEqual(setup.store.calls, ['route_proxy_reserve_budget']);
  }
});

test('API4ACT03-03: public cache hit과 in-flight 비소유자는 reserve를 소비하지 않는다', async () => {
  const cached = fixture({ mode: 'walk', cachedTotal: 7, fetch: async () => response({}) });
  assert.equal((await (await cached.handler(cached.request())).json()).status, 'ok');
  assert.deepEqual(cached.store.reservations, []);
  const inFlight = fixture({ mode: 'transit', leaseInFlight: true, fetch: async () => response({}) });
  assert.deepEqual(await (await inFlight.handler(inFlight.request())).json(), { provider: 'kakao', mode: 'transit', status: 'in_flight' });
  assert.deepEqual(inFlight.store.reservations, []);
});

test('API4C-01: raw Edge response는 provider 없이 cache/in-flight/provider attempt receipt만 노출한다', async () => {
  const hit = fixture({ mode: 'walk', cachedTotal: 7, fetch: async () => response({}) });
  const hitBody = await (await hit.rawHandler(hit.request())).json();
  assert.deepEqual(hitBody.receipt, { result: 'exact', newProviderAttemptCount: 0, reuse: 'server_cache_hit' });
  assert.equal('provider' in hitBody, false);
  const inFlight = fixture({ mode: 'walk', leaseInFlight: true, fetch: async () => response({}) });
  const inFlightBody = await (await inFlight.rawHandler(inFlight.request())).json();
  assert.deepEqual(inFlightBody.receipt, { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'in_flight_reuse', unavailableReason: 'transport' });
});

test('API4C-03: 정상 provider no-route는 unavailable과 분리되고 attempt 1을 기록한다', async () => {
  const setup = fixture({ mode: 'walk', fetch: async () => response({ status: 'OK', route: null }) });
  const body = await (await setup.rawHandler(setup.request())).json();
  assert.deepEqual(body.receipt, { result: 'no_route', newProviderAttemptCount: 1, reuse: 'provider_attempt' });
});

test('API4C-04: valid request의 fail-closed 응답은 HTTP 0회와 안전 receipt를 항상 함께 반환한다', async () => {
  for (const [options, reason] of [
    [{ storeUnavailable: true }, 'store'], [{ authDenied: true }, 'rejected'], [{ anonymousDisabled: true }, 'rejected'], [{ abuseDenied: true }, 'limited'], [{ invalidDeadline: true }, 'transport'], [{ missingSecret: true }, 'provider'],
  ] as const) {
    let fetches = 0; const setup = fixture({ mode: 'walk', ...options, fetch: async () => { fetches += 1; return response({}); } });
    const body = await (await setup.rawHandler(setup.request())).json();
    assert.deepEqual(body.receipt, { result: 'unavailable', newProviderAttemptCount: 0, reuse: 'provider_attempt', unavailableReason: reason });
    assert.equal(fetches, 0);
  }
});
