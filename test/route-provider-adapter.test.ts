import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseWalkProvider, createRouteProviderClients, disabledRouteProvider, resolveTransitRoute, resolveWalkRoute } from '../src/services/routeProviderAdapter';

const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const request = { origin: { id: 'origin', lat: 35.1, lon: 129.0 }, destination: { id: 'destination', lat: 35.2, lon: 129.1 }, mode: 'walk' as const, routeVersion: 'v1' };

test('API4B-01: Kakao 도보·대중교통과 TMAP 도보 원문 fixture는 같은 provider-neutral route 결과로 변환한다', async () => {
  const urls: string[] = [];
  const clients = createRouteProviderClients({ kakaoRestKey: 'fixture', tmapAppKey: 'fixture', fetcher: async (url, init) => {
    urls.push(String(url));
    if (String(url).includes('publictraffic')) return response(200, { status: 'OK', routes: [{ properties: { totalTime: 601 }, steps: [{ properties: { time: 61, distance: 80, guidance: 'go' } }] }] });
    if (String(url).includes('routing/walk')) return response(200, { status: 'OK', route: { properties: { totalTime: 300 }, legs: [{ steps: [{ properties: { time: 120, distance: 50, guidance: 'walk' } }] }] } });
    assert.equal(init?.method, 'POST');
    return response(200, { features: [{ properties: { totalTime: 240 } }] });
  } });
  const [walk, transit, tmap] = await Promise.all([clients.kakaoWalk(request), clients.kakaoTransit({ ...request, mode: 'transit' }), clients.tmapWalk(request)]);
  assert.deepEqual([walk.status, walk.totalMin, transit.status, transit.totalMin, tmap.status, tmap.totalMin], ['ok', 5, 'ok', 11, 'ok', 4]);
  assert.ok(urls.some((url) => url.includes('routing/walk')) && urls.some((url) => url.includes('publictraffic')));
});

test('API4B-02: 빈·형식·401/429·network는 근사 경로가 아닌 typed route 실패다', async () => {
  const clients = createRouteProviderClients({ kakaoRestKey: 'fixture', fetcher: async (url) => {
    if (String(url).includes('walk')) return response(401, {});
    return response(429, {});
  } });
  const unauthorized = await clients.kakaoWalk(request);
  const limited = await clients.kakaoTransit({ ...request, mode: 'transit' });
  const malformed = await createRouteProviderClients({ kakaoRestKey: 'fixture', fetcher: async () => response(200, {}) }).kakaoWalk(request);
  const network = await createRouteProviderClients({ kakaoRestKey: 'fixture', fetcher: async () => { throw new Error('offline'); } }).kakaoWalk(request);
  assert.deepEqual([unauthorized.status, unauthorized.statusCode, limited.status, limited.statusCode, malformed.status, network.status], ['http_error', 401, 'http_error', 429, 'invalid_response', 'network_error']);
});

test('API4B-03: 도보 miss는 낮은 used/softLimit을 고르고 동률은 방향·mode·공개 identity·version으로 결정적이며 이중 호출하지 않는다', async () => {
  const lower = chooseWalkProvider({ request, kakao: { used: 1, hardLimit: 10, softLimit: 9 }, tmap: { used: 4, hardLimit: 10, softLimit: 9 } });
  const tieA = chooseWalkProvider({ request, kakao: { used: 1, hardLimit: 10 }, tmap: { used: 1, hardLimit: 10 } });
  const tieB = chooseWalkProvider({ request, kakao: { used: 1, hardLimit: 10 }, tmap: { used: 1, hardLimit: 10 } });
  let kakaoCalls = 0; let tmapCalls = 0;
  const clients = { kakaoWalk: async () => { kakaoCalls += 1; return { provider: 'kakao' as const, mode: 'walk' as const, fromId: 'origin', toId: 'destination', status: 'ok' as const, totalMin: 5 }; }, tmapWalk: async () => { tmapCalls += 1; return { provider: 'tmap' as const, mode: 'walk' as const, fromId: 'origin', toId: 'destination', status: 'ok' as const, totalMin: 5 }; }, kakaoTransit: async () => { throw new Error('not used'); } };
  const resolved = await resolveWalkRoute({ request, kakao: { used: 1, hardLimit: 10 }, tmap: { used: 5, hardLimit: 10 }, clients });
  assert.equal(lower.provider, 'kakao');
  assert.deepEqual(tieA, tieB);
  assert.equal(tieA.reason, 'deterministic_tie');
  assert.equal(resolved.attempts.length, 1);
  assert.equal(kakaoCalls + tmapCalls, 1);
});

test('API4B-04: 선택 도보 provider 실패/timeout일 때만 다른 provider를 한 번 fallback하고, transit은 Kakao만 사용한다', async () => {
  const clients = {
    kakaoWalk: async () => ({ provider: 'kakao' as const, mode: 'walk' as const, fromId: 'origin', toId: 'destination', status: 'network_error' as const }),
    tmapWalk: async () => ({ provider: 'tmap' as const, mode: 'walk' as const, fromId: 'origin', toId: 'destination', status: 'ok' as const, totalMin: 5 }),
    kakaoTransit: async () => ({ provider: 'kakao' as const, mode: 'transit' as const, fromId: 'origin', toId: 'destination', status: 'network_error' as const }),
  };
  const walk = await resolveWalkRoute({ request, kakao: { used: 0, hardLimit: 10 }, tmap: { used: 9, hardLimit: 10 }, clients });
  const transit = await resolveTransitRoute({ request, kakao: { used: 0, hardLimit: 10 }, clients });
  assert.deepEqual([walk.result.provider, walk.attempts, transit.result.status, transit.attempts], ['tmap', ['kakao', 'tmap'], 'network_error', ['kakao']]);
  assert.equal(disabledRouteProvider('odsay', { ...request, mode: 'transit' }).status, 'disabled');
  assert.equal(disabledRouteProvider('tmap', { ...request, mode: 'transit' }).status, 'disabled');
});

test('API4B-05: hard limit은 새 요청을 제한하고 cache hit 선택은 provider 사용률보다 우선한다', async () => {
  const limited = chooseWalkProvider({ request, kakao: { used: 10, hardLimit: 10 }, tmap: { used: 10, hardLimit: 10 } });
  const hit = chooseWalkProvider({ request, kakao: { used: 10, hardLimit: 10 }, tmap: { used: 10, hardLimit: 10 }, cachedProvider: 'tmap' });
  const clients = { kakaoWalk: async () => { throw new Error('not used'); }, tmapWalk: async () => { throw new Error('not used'); }, kakaoTransit: async () => { throw new Error('not used'); } };
  const reused = await resolveWalkRoute({ request, kakao: { used: 10, hardLimit: 10 }, tmap: { used: 10, hardLimit: 10 }, cachedProvider: 'tmap', cachedResult: { provider: 'tmap', mode: 'walk', fromId: 'origin', toId: 'destination', status: 'ok', totalMin: 5 }, clients });
  const transit = await resolveTransitRoute({ request, kakao: { used: 10, hardLimit: 10 }, clients });
  assert.deepEqual([limited, hit, reused.attempts, reused.result.provider, transit.result.status, transit.attempts], [{ provider: null, reason: 'hard_limited' }, { provider: 'tmap', reason: 'cache_hit' }, [], 'tmap', 'limited', []]);
});
