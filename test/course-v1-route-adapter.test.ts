import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COURSE_V1_ROUTE_FAILURE_TTL_MS,
  COURSE_V1_ROUTE_SUCCESS_TTL_MS,
  courseV1RouteCacheKey,
  createCourseV1RouteCacheOwner,
  createCourseV1RouteAdapter,
} from '../src/services/courseV1RouteAdapter';
import { fixtureRouteKey, routeFetcherFixture, routeFixturePoints } from './fixtures/course-v1-route-adapter.fixture';

const { origin, nearby, distant } = routeFixturePoints;

test('성공 fixture: 실제 TMAP 보행 14분 이하는 도보 정확 경로만 반환한다', async () => {
  const fixture = routeFetcherFixture({
    [fixtureRouteKey('walk', origin, nearby)]: { min: 8, source: 'TMAP' },
  });
  const adapter = createCourseV1RouteAdapter({ fetcher: fixture.fetcher });

  assert.deepEqual(await adapter.getRoute(origin, nearby), { mode: 'walk', min: 8, exact: true });
  assert.deepEqual(fixture.calls, [fixtureRouteKey('walk', origin, nearby)]);
});

test('한 구간 실패 fixture: 먼 실제 보행 뒤 ODsay가 실패하면 근사 폴백 대신 null을 반환한다', async () => {
  const fixture = routeFetcherFixture({
    [fixtureRouteKey('walk', origin, distant)]: { min: 18, source: 'TMAP' },
    [fixtureRouteKey('transit', origin, distant)]: { min: 12, source: 'transit_fallback' },
  });
  const adapter = createCourseV1RouteAdapter({ fetcher: fixture.fetcher });

  assert.equal(await adapter.getRoute(origin, distant), null);
  assert.deepEqual(fixture.calls, [
    fixtureRouteKey('walk', origin, distant),
    fixtureRouteKey('transit', origin, distant),
  ]);
});

test('전체 실패 fixture: 도보·대중교통 모두 실제 응답이 없으면 null을 반환한다', async () => {
  const fixture = routeFetcherFixture({});
  const adapter = createCourseV1RouteAdapter({ fetcher: fixture.fetcher });

  assert.equal(await adapter.getRoute(origin, distant), null);
  assert.deepEqual(fixture.calls, [
    fixtureRouteKey('walk', origin, distant),
    fixtureRouteKey('transit', origin, distant),
  ]);
});

test('캐시 적중 fixture: 좌표쌍·수단 키는 5자리 좌표를 포함하고 성공은 24시간, 실패는 5분 동안 재호출하지 않는다', async () => {
  let now = 0;
  const fixture = routeFetcherFixture({
    [fixtureRouteKey('walk', origin, nearby)]: { min: 9, source: 'TMAP' },
  });
  const adapter = createCourseV1RouteAdapter({ fetcher: fixture.fetcher, now: () => now });

  assert.match(courseV1RouteCacheKey('walk', origin, nearby), /course-v1:exact-route:v1:walk:35\.15781,129\.05941:35\.15801,129\.06001/);
  await adapter.getRoute(origin, nearby);
  now += COURSE_V1_ROUTE_SUCCESS_TTL_MS - 1;
  await adapter.getRoute(origin, nearby);
  assert.equal(fixture.calls.length, 1);

  now += 1;
  await adapter.getRoute(origin, nearby);
  assert.equal(fixture.calls.length, 2);

  const failed = routeFetcherFixture({});
  const failedAdapter = createCourseV1RouteAdapter({ fetcher: failed.fetcher, now: () => now });
  await failedAdapter.getRoute(origin, distant);
  await failedAdapter.getRoute(origin, distant);
  assert.equal(failed.calls.length, 2);
  now += COURSE_V1_ROUTE_FAILURE_TTL_MS;
  await failedAdapter.getRoute(origin, distant);
  assert.equal(failed.calls.length, 4);
});

test('앱 세션 cache owner: 새 추천이 이미 검증된 대안을 교체하면 네트워크를 다시 호출하지 않는다', async () => {
  const fixture = routeFetcherFixture({
    [fixtureRouteKey('walk', origin, nearby)]: { min: 9, source: 'TMAP' },
  });
  const owner = createCourseV1RouteCacheOwner({ fetcher: fixture.fetcher });
  const firstRecommendation = owner.createAdapter();
  const replacementRecommendation = owner.createAdapter();

  await firstRecommendation.getRoute(origin, nearby);
  await replacementRecommendation.getRoute(origin, nearby);

  assert.equal(fixture.calls.length, 1);
  assert.deepEqual(owner.diagnostics(), {
    fetchRequests: 1,
    cacheHits: 1,
    sharedInFlightWaits: 0,
    failures: 0,
  });
});

test('앱 세션 cache owner: 동시에 들어온 같은 구간은 하나의 fetch를 공유하고 관찰값에 기록한다', async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const owner = createCourseV1RouteCacheOwner({
    fetcher: {
      async fetch(_from, _to, mode) {
        calls += 1;
        await pending;
        return mode === 'walk' ? { min: 8, source: 'TMAP' } : null;
      },
    },
  });
  const adapter = owner.createAdapter();

  const first = adapter.getRoute(origin, nearby);
  const second = adapter.getRoute(origin, nearby);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);

  assert.deepEqual(owner.diagnostics(), {
    fetchRequests: 1,
    cacheHits: 0,
    sharedInFlightWaits: 1,
    failures: 0,
  });
});

test('cache key은 수단·방향·좌표쌍을 분리해 서로 다른 실제 요청을 재사용하지 않는다', async () => {
  const fixture = routeFetcherFixture({
    [fixtureRouteKey('walk', origin, nearby)]: { min: 8, source: 'TMAP' },
    [fixtureRouteKey('walk', nearby, origin)]: { min: 8, source: 'TMAP' },
    [fixtureRouteKey('walk', origin, distant)]: { min: 8, source: 'TMAP' },
  });
  const owner = createCourseV1RouteCacheOwner({ fetcher: fixture.fetcher });
  const adapter = owner.createAdapter();

  await adapter.getRoute(origin, nearby);
  await adapter.getRoute(nearby, origin);
  await adapter.getRoute(origin, distant);

  assert.equal(fixture.calls.length, 3);
  assert.notEqual(courseV1RouteCacheKey('walk', origin, nearby), courseV1RouteCacheKey('transit', origin, nearby));
  assert.notEqual(courseV1RouteCacheKey('walk', origin, nearby), courseV1RouteCacheKey('walk', nearby, origin));
  assert.notEqual(courseV1RouteCacheKey('walk', origin, nearby), courseV1RouteCacheKey('walk', origin, distant));
});
