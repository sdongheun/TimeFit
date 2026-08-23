import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOneStopRouteService,
  type OneStopRouteAdapter,
} from '../../src/engine/oneStopRouteService';

const origin = { lat: 35.1578, lon: 129.0594 };
const spot = { contentId: 'spot-1', lat: 35.163, lon: 129.072 };
const target = { lat: 35.1796, lon: 129.075 };

function adapterFixture(options: { transitFallback?: boolean; release?: Promise<void> } = {}) {
  let walkCalls = 0;
  let transitCalls = 0;
  const adapter: OneStopRouteAdapter = {
    precomputeWalk: async () => {
      walkCalls += 1;
      await options.release;
    },
    precomputeTransit: async () => {
      transitCalls += 1;
      await options.release;
    },
    read: (from, _to, mode) => {
      const isApproach = from.lat === origin.lat && from.lon === origin.lon;
      if (mode === 'walk') return { min: isApproach ? 11 : 17, source: 'TMAP' };
      return { min: isApproach ? 16 : 24, source: options.transitFallback ? 'transit_fallback' : 'ODsay' };
    },
  };
  return {
    adapter,
    calls: () => ({ walk: walkCalls, transit: transitCalls }),
  };
}

test('한 장소 정밀화는 두 구간을 도보와 대중교통으로 계산하고 같은 결과를 반환한다', async () => {
  const fixture = adapterFixture();
  const service = createOneStopRouteService({ adapter: fixture.adapter });

  const result = await service.get({ origin, spot, target });

  assert.deepEqual(fixture.calls(), { walk: 1, transit: 1 });
  assert.deepEqual(result.modes.walk, { approachMin: 11, onwardMin: 17, exact: true });
  assert.deepEqual(result.modes.transit, { approachMin: 16, onwardMin: 24, exact: true });
  assert.equal(result.status, 'ready');
});

test('동일한 장소 정밀화는 진행 중 요청과 완료 결과를 공유해 API를 반복 호출하지 않는다', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const fixture = adapterFixture({ release: pending });
  const service = createOneStopRouteService({ adapter: fixture.adapter });

  const first = service.get({ origin, spot, target });
  const second = service.get({ origin, spot, target });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fixture.calls(), { walk: 1, transit: 1 });
  release();
  const [a, b] = await Promise.all([first, second]);
  await service.get({ origin, spot, target });

  assert.deepEqual(a, b);
  assert.deepEqual(fixture.calls(), { walk: 1, transit: 1 });
});

test('완료된 정밀 경로는 24시간 TTL이 지나면 다시 계산한다', async () => {
  let now = 0;
  const fixture = adapterFixture();
  const service = createOneStopRouteService({
    adapter: fixture.adapter,
    now: () => now,
    ttlMs: 24 * 60 * 60 * 1000,
  });

  await service.get({ origin, spot, target });
  now += 24 * 60 * 60 * 1000 + 1;
  await service.get({ origin, spot, target });

  assert.deepEqual(fixture.calls(), { walk: 2, transit: 2 });
});

test('한 수단이 근사값으로 폴백되면 그 수단은 정밀 결과로 쓰지 않는다', async () => {
  const fixture = adapterFixture({ transitFallback: true });
  const service = createOneStopRouteService({ adapter: fixture.adapter });

  const result = await service.get({ origin, spot, target });

  assert.equal(result.status, 'partial');
  assert.equal(result.modes.walk.exact, true);
  assert.equal(result.modes.transit.exact, false);
});

test('두 수단 모두 정밀 경로를 만들지 못하면 추천 가능한 결과로 승격하지 않는다', async () => {
  const adapter: OneStopRouteAdapter = {
    precomputeWalk: async () => undefined,
    precomputeTransit: async () => undefined,
    read: () => ({ min: 30, source: 'haversine' }),
  };
  const service = createOneStopRouteService({ adapter });

  const result = await service.get({ origin, spot, target });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.modes.walk.exact, false);
  assert.equal(result.modes.transit.exact, false);
});
