import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../src/engine';
import {
  createPrivateWalkConnectorPort,
  type PrivateWalkConnectorPort,
} from '../src/services/privateWalkConnector';
import type {
  RouteProxyEdgeInvoker,
  RouteProxyFunctionRequest,
} from '../src/services/routeProxyClientAdapter';
import type { RecommendationSession } from '../src/ui/nav';
import {
  buildCourseV1ConnectorRequests,
  buildCourseV1RouteGeometryModel,
  loadCourseV1WalkConnectors,
} from '../src/ui/recommendation/courseV1RouteGeometryModel';
import {
  createRouteProxyHandler,
  type RouteProxyHandlerDependencies,
} from '../supabase/functions/route-proxy/handler';

const origin = { id: 'origin', label: '출발', lat: 35.157, lon: 129.059 };
const place = { id: 'place', lat: 35.16, lon: 129.062 };
const secondPlace = { id: 'second-place', lat: 35.164, lon: 129.06 };
const destination = { id: 'destination', label: '도착', lat: 35.168, lon: 129.057 };
const session: RecommendationSession = {
  nowIso: '2026-09-03T15:00:00+09:00',
  origin,
  destination,
  remainingMin: 120,
  arrivalBufferMin: 10,
};
const metersNorth = (meters: number) => meters / 6_371_000 * 180 / Math.PI;
const pointNorth = (point: { lat: number; lon: number }, meters: number) => ({ lat: point.lat + metersNorth(meters), lon: point.lon });
const geometry = (from: { lat: number; lon: number }, to: { lat: number; lon: number }) => ({ paths: [{ points: [from, to] }] });

function transitCourse(gaps: [[number, number], [number, number]]): VerifiedCourseV1 {
  const endpoints = [[origin, place], [place, destination]] as const;
  return {
    id: 'qa-course-geometry-02',
    placeIds: ['place'],
    stops: [{
      placeId: 'place',
      stayMin: 30,
      stayState: 'recommended',
      availabilityState: 'structured_verified',
      arrivalAt: '2026-09-03T15:30:00+09:00',
      departureAt: '2026-09-03T16:00:00+09:00',
    }],
    legs: gaps.map(([startGap, endGap], index) => ({
      fromId: index === 0 ? 'origin' : 'place',
      toId: index === 0 ? 'place' : 'destination',
      mode: 'transit' as const,
      min: 20,
      geometry: geometry(pointNorth(endpoints[index][0], startGap), pointNorth(endpoints[index][1], endGap)),
    })),
    travelMin: 40,
    stayMin: 30,
    arrivalBufferMin: 10,
    totalMin: 80,
    remainingAfterCourseMin: 40,
    remainingAfterArrivalBufferMin: 30,
  };
}

function twoStopTransitCourse(gaps: [[number, number], [number, number], [number, number]]): VerifiedCourseV1 {
  const endpoints = [[origin, place], [place, secondPlace], [secondPlace, destination]] as const;
  return {
    id: 'qa-two-stop-course-geometry-02',
    placeIds: ['place', 'second-place'],
    stops: [
      {
        placeId: 'place',
        stayMin: 20,
        stayState: 'recommended',
        availabilityState: 'structured_verified',
        arrivalAt: '2026-09-03T15:20:00+09:00',
        departureAt: '2026-09-03T15:40:00+09:00',
      },
      {
        placeId: 'second-place',
        stayMin: 20,
        stayState: 'recommended',
        availabilityState: 'structured_verified',
        arrivalAt: '2026-09-03T16:00:00+09:00',
        departureAt: '2026-09-03T16:20:00+09:00',
      },
    ],
    legs: gaps.map(([startGap, endGap], index) => ({
      fromId: index === 0 ? 'origin' : index === 1 ? 'place' : 'second-place',
      toId: index === 0 ? 'place' : index === 1 ? 'second-place' : 'destination',
      mode: 'transit' as const,
      min: 20,
      geometry: geometry(pointNorth(endpoints[index][0], startGap), pointNorth(endpoints[index][1], endGap)),
    })),
    travelMin: 60,
    stayMin: 40,
    arrivalBufferMin: 10,
    totalMin: 110,
    remainingAfterCourseMin: 10,
    remainingAfterArrivalBufferMin: 0,
  };
}

function privateEdgeFixture() {
  const providerModes: string[] = [];
  const rpcNames: string[] = [];
  const deps: RouteProxyHandlerDependencies = {
    env(name) {
      const values: Record<string, string> = {
        ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED: 'true',
        ROUTE_PROXY_ABUSE_GUARD_APPROVED: 'true',
        ROUTE_PROXY_FETCH_LEASE_TTL_MS: '5000',
        ROUTE_PROXY_PROVIDER_DEADLINE_MS: '4750',
        ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT: '100',
        ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT: '90',
        ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT: '10',
        ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT: '100',
        ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT: '90',
        ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT: '10',
        KAKAO_ROUTE_REST_API_KEY: 'fixture-only',
      };
      return values[name] ?? '';
    },
    async fetch(input) {
      const url = new URL(input);
      const mode = url.pathname.endsWith('/walk') ? 'walk' : 'transit';
      providerModes.push(mode);
      const start = { lat: Number(url.searchParams.get('start_y')), lon: Number(url.searchParams.get('start_x')) };
      const end = { lat: Number(url.searchParams.get('end_y')), lon: Number(url.searchParams.get('end_x')) };
      return new Response(JSON.stringify({
        status: 'OK',
        route: {
          properties: { totalTime: 180 },
          legs: [{ steps: [{ path: { points: [[start.lon, start.lat], [end.lon, end.lat]] } }] }],
        },
      }), { status: 200 });
    },
    async authenticate() { return { user: { aud: 'authenticated', is_anonymous: true } }; },
    async rpc(name) {
      rpcNames.push(name);
      if (name === 'route_proxy_reserve_budget') return { data: [{ granted: true }] };
      throw new Error(`private connector must not call persistence RPC: ${name}`);
    },
    now: () => Date.parse('2026-09-03T06:00:00.000Z'),
    wait: async () => undefined,
    consumeRate: async () => true,
    storeAvailable: () => true,
  };
  const handler = createRouteProxyHandler(deps);
  const edge: RouteProxyEdgeInvoker = {
    async invoke(_name, options) {
      const response = await handler(new Request('https://fixture.invalid/route-proxy', {
        method: 'POST',
        headers: { ...(options.headers as Record<string, string>), 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body as RouteProxyFunctionRequest),
      }));
      return { data: await response.json(), error: null };
    },
  };
  return { edge, providerModes, rpcNames };
}

test('QA-COURSE-GEOMETRY-02 통합: 선택 전 0회, 선택 후 private walk만 보충하고 장소 marker까지 잇는다', async () => {
  const course = transitCourse([[0, 120], [120, 0]]);
  const originalSnapshot = JSON.stringify(course);
  const fixture = privateEdgeFixture();
  const port = createPrivateWalkConnectorPort({
    auth: { async getSession() { return { accessToken: 'fixture-session' }; } },
    edge: fixture.edge,
  });

  const requests = buildCourseV1ConnectorRequests(course, session, (id) => id === 'place' ? place : undefined);
  assert.deepEqual(requests.map(({ key }) => key), ['0:end', '1:start']);
  assert.deepEqual(fixture.providerModes, [], '상세 선택 전에는 connector provider 호출이 없어야 합니다.');

  const first = await loadCourseV1WalkConnectors(requests, port);
  assert.deepEqual(fixture.providerModes, ['walk', 'walk']);
  assert.deepEqual(fixture.rpcNames, ['route_proxy_reserve_budget', 'route_proxy_reserve_budget']);
  assert.equal(first.failedCount, 0);
  const model = buildCourseV1RouteGeometryModel(course, first.connectors);
  assert.deepEqual(model.segments.map(({ mode, connectorKey }) => [mode, connectorKey ?? null]), [
    ['transit', null], ['walk', '0:end'], ['walk', '1:start'], ['transit', null],
  ]);
  assert.deepEqual(model.segments[1].points.at(-1), { lat: place.lat, lon: place.lon });
  assert.deepEqual(model.segments[2].points[0], { lat: place.lat, lon: place.lon });
  assert.deepEqual(model.legend.map(({ mode }) => mode), ['transit', 'walk']);

  const second = await loadCourseV1WalkConnectors(requests, port);
  assert.equal(second.failedCount, 0);
  assert.deepEqual(fixture.providerModes, ['walk', 'walk'], '재진입은 process memory를 사용하고 provider를 다시 호출하면 안 됩니다.');
  assert.equal(JSON.stringify(course), originalSnapshot, 'connector는 추천 snapshot과 시간을 변경하면 안 됩니다.');
});

test('QA-COURSE-GEOMETRY-02 통합: session 부재는 Edge·provider 0회이고 기존 선·상세 계약을 유지한다', async () => {
  const course = transitCourse([[0, 120], [120, 0]]);
  const originalSnapshot = JSON.stringify(course);
  const fixture = privateEdgeFixture();
  const requests = buildCourseV1ConnectorRequests(course, session, (id) => id === 'place' ? place : undefined);
  const loaded = await loadCourseV1WalkConnectors(requests, createPrivateWalkConnectorPort({
    auth: { async getSession() { return null; } },
    edge: fixture.edge,
  }));

  assert.deepEqual(loaded.connectors, []);
  assert.equal(loaded.failedCount, 2);
  assert.deepEqual(fixture.providerModes, []);
  assert.deepEqual(fixture.rpcNames, []);
  const model = buildCourseV1RouteGeometryModel(course, loaded.connectors);
  assert.deepEqual(model.segments.map(({ mode }) => mode), ['transit', 'transit']);
  assert.equal(model.segments.some(({ quality }) => quality === 'fallback'), false);
  assert.equal(JSON.stringify(course), originalSnapshot);
});

test('QA-COURSE-GEOMETRY-02 통합: 1곳은 최대 4개, 2곳은 최대 6개 request를 생성한다', () => {
  const oneStopRequests = buildCourseV1ConnectorRequests(
    transitCourse([[51, 51], [51, 51]]),
    session,
    (id) => id === 'place' ? place : undefined,
  );
  assert.equal(oneStopRequests.length, 4);

  const twoStopRequests = buildCourseV1ConnectorRequests(
    twoStopTransitCourse([[51, 51], [51, 51], [51, 51]]),
    session,
    (id) => id === 'place' ? place : id === 'second-place' ? secondPlace : undefined,
  );
  assert.equal(twoStopRequests.length, 6);
});

test('QA-COURSE-GEOMETRY-02 통합: 공통 loader는 최대 6개·동시 2개, 부분 실패와 인위적 7번째 차단을 지킨다', async () => {
  const course = twoStopTransitCourse([[51, 51], [51, 51], [51, 51]]);
  const requests = buildCourseV1ConnectorRequests(
    course,
    session,
    (id) => id === 'place' ? place : id === 'second-place' ? secondPlace : undefined,
  );
  assert.equal(requests.length, 6);
  const seven = [...requests, { ...requests[0], key: '3:start' as const }];
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const port: PrivateWalkConnectorPort = {
    async getConnector(from, to) {
      calls += 1;
      const current = calls;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active -= 1;
      if (current === 2) return { status: 'no_route', receipt: { newRequestStarted: true, reuse: 'new_request' } };
      return {
        status: 'exact_geometry',
        geometry: geometry(from, to),
        receipt: { newRequestStarted: true, reuse: 'new_request' },
      };
    },
    reset() {},
  };

  const loaded = await loadCourseV1WalkConnectors(seven, port);
  assert.equal(calls, 6, '일곱 번째 connector는 provider에 전달하면 안 됩니다.');
  assert.equal(maxActive, 2);
  assert.equal(loaded.connectors.length, 5);
  assert.equal(loaded.failedCount, 2, '부분 실패 1건과 상한으로 차단된 1건을 집계합니다.');
  const model = buildCourseV1RouteGeometryModel(course, loaded.connectors);
  assert.equal(model.segments.filter(({ mode }) => mode === 'transit').length, 3);
  assert.equal(model.segments.filter(({ mode }) => mode === 'walk').length, 5);
  assert.equal(model.segments.some(({ quality }) => quality === 'fallback'), false);
});
