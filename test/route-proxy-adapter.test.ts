import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryRouteProxyStore, createServerRouteProxy } from '../src/services/routeProxyAdapter';
import type { RouteProxyClients } from '../src/services/routeProxyAdapter';
import type { ProviderRouteRequest, ProviderRouteResult } from '../src/services/routeProviderAdapter';

const route: ProviderRouteRequest = { origin: { id: 'poi-a', lat: 35.1, lon: 129.0 }, destination: { id: 'poi-b', lat: 35.2, lon: 129.1 }, mode: 'walk', routeVersion: 'catalog-v1' };
const ok = (provider: 'kakao' | 'tmap', request: ProviderRouteRequest): ProviderRouteResult => ({ provider, mode: request.mode, fromId: request.origin.id, toId: request.destination.id, status: 'ok', totalMin: 7 });
const make = (now: () => number, clients?: Partial<RouteProxyClients>, limits = { hardLimit: 3, perSecondLimit: 3 }) => createServerRouteProxy({
  now, store: createMemoryRouteProxyStore(),
  policy: { cacheTtlMs: 1_000, budgets: { kakao: { used: 0, ...limits }, tmap: { used: 0, ...limits } } },
  clients: { kakaoWalk: async request => ok('kakao', request), kakaoTransit: async request => ok('kakao', request), tmapWalk: async request => ok('tmap', request), ...clients },
});
const publicScope = { kind: 'public_segment' as const, catalogVersion: 'catalog-v1', fromPoiId: 'poi-a', toPoiId: 'poi-b' };

test('API4A-01: 동일한 공개 POI 구간은 provider/mode/direction/version cache hit로 재사용한다', async () => {
  let clock = 10_000; let calls = 0;
  const proxy = make(() => clock, { kakaoWalk: async request => { calls += 1; return ok('kakao', request); }, tmapWalk: async request => { calls += 1; return ok('tmap', request); } });
  const first = await proxy.resolve({ route, cacheScope: publicScope });
  const hit = await proxy.resolve({ route, cacheScope: publicScope });
  const reverse = await proxy.resolve({ route: { ...route, origin: route.destination, destination: route.origin }, cacheScope: { ...publicScope, fromPoiId: 'poi-b', toPoiId: 'poi-a' } });
  assert.deepEqual([first.diagnostics.cache, hit.diagnostics.cache, reverse.diagnostics.cache, calls], ['miss', 'hit', 'miss', 2]);
});

test('API4A-02: TTL 만료와 version 변경은 재호출하며 성공 route만 공용 cache에 쓴다', async () => {
  let clock = 10_000; let calls = 0;
  const proxy = make(() => clock, { kakaoWalk: async request => { calls += 1; return ok('kakao', request); }, tmapWalk: async request => { calls += 1; return ok('tmap', request); } });
  await proxy.resolve({ route, cacheScope: publicScope });
  clock += 1_001;
  const expired = await proxy.resolve({ route, cacheScope: publicScope });
  const version = await proxy.resolve({ route: { ...route, routeVersion: 'catalog-v2' }, cacheScope: { ...publicScope, catalogVersion: 'catalog-v2' } });
  assert.deepEqual([expired.diagnostics.cache, version.diagnostics.cache, calls], ['miss', 'miss', 3]);
});

test('API4A-03: 같은 공개 cache miss의 동시 요청은 provider 실제 호출 하나를 공유한다', async () => {
  let calls = 0; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const proxy = make(() => 10_000, { kakaoWalk: async request => { calls += 1; await gate; return ok('kakao', request); }, tmapWalk: async request => { calls += 1; await gate; return ok('tmap', request); } });
  const one = proxy.resolve({ route, cacheScope: publicScope });
  const two = proxy.resolve({ route, cacheScope: publicScope });
  release();
  const [first, second] = await Promise.all([one, two]);
  assert.deepEqual([first.result.status, second.result.status, calls], ['ok', 'ok', 1]);
});

test('API4A-04: hard/rate 예산은 원자 reservation으로 제한하고 transit은 Kakao 외 fallback이 없다', async () => {
  let calls = 0;
  const proxy = make(() => 10_000, { kakaoTransit: async request => { calls += 1; return ok('kakao', request); } });
  const transit = { ...route, mode: 'transit' as const };
  const results = await Promise.all([1, 2, 3, 4].map(() => proxy.resolve({ route: transit, cacheScope: { kind: 'private_request' } })));
  const rateProxy = make(() => 10_000, undefined, { hardLimit: 5, perSecondLimit: 2 });
  const rate = await Promise.all([1, 2, 3].map(() => rateProxy.resolve({ route: transit, cacheScope: { kind: 'private_request' } })));
  assert.deepEqual([results.map(value => value.result.status), calls, rate.map(value => value.result.status)], [['ok', 'ok', 'ok', 'limited'], 3, ['ok', 'ok', 'limited']]);
});

test('API4A-05: private GPS scope는 장기 공유 cache에 쓰지 않고 public identity 불일치는 거절한다', async () => {
  let calls = 0;
  const proxy = make(() => 10_000, { kakaoWalk: async request => { calls += 1; return ok('kakao', request); }, tmapWalk: async request => { calls += 1; return ok('tmap', request); } });
  const one = await proxy.resolve({ route, cacheScope: { kind: 'private_request' } });
  const two = await proxy.resolve({ route, cacheScope: { kind: 'private_request' } });
  const rejected = await proxy.resolve({ route, cacheScope: { ...publicScope, fromPoiId: 'wrong-id' } });
  assert.deepEqual([one.diagnostics.cache, two.diagnostics.cache, rejected.result.status, calls], ['private', 'private', 'invalid_response', 2]);
});

test('API4A-06: provider 실패는 cache하지 않고 도보만 한 번 fallback하며 근사 route로 바꾸지 않는다', async () => {
  let kakao = 0; let tmap = 0;
  const proxy = make(() => 10_000, {
    kakaoWalk: async request => { kakao += 1; return { ...ok('kakao', request), status: 'network_error' }; },
    tmapWalk: async request => { tmap += 1; return { ...ok('tmap', request), status: 'network_error' }; },
  });
  const first = await proxy.resolve({ route, cacheScope: publicScope });
  const second = await proxy.resolve({ route, cacheScope: publicScope });
  assert.deepEqual([first.result.status, first.diagnostics.providerAttempts.length, second.diagnostics.cache, kakao + tmap], ['network_error', 2, 'miss', 4]);
});
