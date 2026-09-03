import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReleaseOneStopRepresentativeCourseV1, type CourseV1Candidate, type CourseV1Point } from '../src/engine';
import { createCourseV1ProxyRouteAdapter, type RouteProxyFunctionRequest, type RouteProxyFunctionResponse } from '../src/services/routeProxyClientAdapter';
import { createRouteProxyCatalogScopeResolver } from '../src/services/routeProxyActivatedCourseAdapter';
import { createRouteProxyHandler, type RouteProxyHandlerDependencies } from '../supabase/functions/route-proxy/handler';
import type { RecommendationSession } from '../src/ui/nav';
import { buildCourseV1DetailMarkers, buildCourseV1DetailModel } from '../src/ui/recommendation/courseV1CardDetailModel';
import { buildCourseV1RouteGeometryModel } from '../src/ui/recommendation/courseV1RouteGeometryModel';

const now = new Date('2026-09-03T15:00:00+09:00');
const origin = { id: 'origin', lat: 35.1578, lon: 129.0592 };
const placePoint = { id: 'place', lat: 35.1601, lon: 129.0621 };
const destination = { id: 'destination', lat: 35.1682, lon: 129.0571 };
const snapshot = {
  version: 'qa-course-geometry-v1',
  points: {
    origin: { lat: origin.lat, lon: origin.lon },
    place: { lat: placePoint.lat, lon: placePoint.lon },
    destination: { lat: destination.lat, lon: destination.lon },
  },
};

const candidate: CourseV1Candidate = {
  ...placePoint,
  title: '고정 장소',
  classification: 'representative_standard',
  minStayMin: 20,
  recommendedStayMin: 30,
  maxStayMin: 60,
  availability: {
    status: 'structured',
    alwaysAccessible: true,
    dayTypes: ['weekday', 'weekend'],
    windows: [],
  },
};

type StoredRoute = { total_min: number; steps: unknown[] };

function routeKey(args: Record<string, unknown>): string {
  return [args.p_provider, args.p_mode, args.p_from_poi_id, args.p_to_poi_id, args.p_catalog_version].join(':');
}

function createFixtureBridge(options: { malformedGeometry?: boolean } = {}) {
  const cache = new Map<string, StoredRoute>();
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const providerRequests: string[] = [];

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
        ROUTE_PROXY_CACHE_TTL_MS: '900000',
        KAKAO_ROUTE_REST_API_KEY: 'fixture-only',
        ROUTE_PROXY_CATALOG_SNAPSHOT_JSON: JSON.stringify(snapshot),
      };
      return values[name] ?? '';
    },
    async fetch(input) {
      providerRequests.push(input);
      const url = new URL(input);
      const mode = url.pathname.endsWith('/walk') ? 'walk' : 'transit';
      const startLon = Number(url.searchParams.get('start_x'));
      const startLat = Number(url.searchParams.get('start_y'));
      const endLon = Number(url.searchParams.get('end_x'));
      const endLat = Number(url.searchParams.get('end_y'));
      const isOutboundFromOrigin = startLon === origin.lon && startLat === origin.lat;
      const totalMin = mode === 'walk' ? (isOutboundFromOrigin ? 5 : 20) : 7;
      const points: unknown = options.malformedGeometry
        ? [[String(startLon), startLat], [181, endLat]]
        : [[startLon, startLat], [(startLon + endLon) / 2, (startLat + endLat) / 2], [endLon, endLat]];
      const route = { properties: { totalTime: totalMin * 60 }, steps: [{ path: { points } }] };
      const body = mode === 'walk'
        ? { status: 'OK', route: { properties: route.properties, legs: [{ steps: route.steps }] } }
        : { status: 'OK', routes: [route] };
      return new Response(JSON.stringify(body), { status: 200 });
    },
    async authenticate() { return { user: { aud: 'authenticated', is_anonymous: true } }; },
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (name === 'route_proxy_get_route') {
        const stored = cache.get(routeKey(args));
        return { data: stored ? [stored] : [] };
      }
      if (name === 'route_proxy_reserve_budget') return { data: [{ granted: true }] };
      if (name === 'route_proxy_claim_fetch_lease') return { data: [{ state: 'claimed', lease_id: `lease-${rpcCalls.length}` }] };
      if (name === 'route_proxy_complete_fetch_lease') {
        cache.set(routeKey(args), { total_min: args.p_total_min as number, steps: args.p_steps as unknown[] });
        return { data: 'completed' };
      }
      if (name === 'route_proxy_release_fetch_lease') return { data: 'released' };
      throw new Error(`unexpected fixture RPC: ${name}`);
    },
    now: () => Date.parse('2026-09-03T06:00:00.000Z'),
    wait: async () => undefined,
    consumeRate: async () => true,
    storeAvailable: () => true,
  };
  const handler = createRouteProxyHandler(deps);
  const invoker = {
    async invoke(body: RouteProxyFunctionRequest): Promise<RouteProxyFunctionResponse> {
      const response = await handler(new Request('https://fixture.invalid/route-proxy', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture-jwt', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
      return await response.json() as RouteProxyFunctionResponse;
    },
  };
  return { cache, invoker, providerRequests, rpcCalls };
}

function buildInput(destinationPoint: CourseV1Point | null, receiptRoutes: ReturnType<typeof createCourseV1ProxyRouteAdapter>) {
  return {
    now,
    origin,
    destination: destinationPoint,
    remainingMin: 120,
    arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => [candidate] },
    routes: receiptRoutes,
    receiptRoutes,
  };
}

function session(destinationPoint: RecommendationSession['destination']): RecommendationSession {
  return {
    nowIso: now.toISOString(),
    origin: { ...origin, label: '설정 출발지' },
    destination: destinationPoint,
    remainingMin: 120,
    arrivalBufferMin: 10,
  };
}

const getDisplayPlace = (id: string) => id === candidate.id
  ? { title: candidate.title, lat: candidate.lat, lon: candidate.lon, category: '문화시설', shortStay: { type: 'compact_culture' } }
  : undefined;

test('QA-COURSE-GEOMETRY-01 public: provider miss→cache hit→adapter→engine→map이 같은 두 geometry와 수단을 보존한다', async () => {
  const bridge = createFixtureBridge();
  const adapter = createCourseV1ProxyRouteAdapter({
    invoker: bridge.invoker,
    resolveScope: createRouteProxyCatalogScopeResolver({ snapshot }),
  });

  const miss = await buildReleaseOneStopRepresentativeCourseV1(buildInput(destination, adapter));
  const missCourse = miss.representativeCourse;
  assert.ok(missCourse);
  assert.equal(miss.diagnostics.newProviderAttemptCount, 3);
  assert.deepEqual(missCourse.legs.map(({ mode, min }) => [mode, min]), [['walk', 5], ['transit', 7]]);
  assert.ok(missCourse.legs.every((leg) => leg.geometry?.paths[0]?.points.length === 3));
  assert.equal(bridge.providerRequests.length, 3);
  assert.equal(bridge.cache.size, 3);

  const hit = await buildReleaseOneStopRepresentativeCourseV1(buildInput(destination, adapter));
  const hitCourse = hit.representativeCourse;
  assert.ok(hitCourse);
  assert.equal(hit.diagnostics.newProviderAttemptCount, 0);
  assert.equal(hit.diagnostics.cacheOrSessionReuseCount, 2, '엔진 diagnostics는 하위 Proxy 호출이 아니라 두 leg receipt의 reuse를 집계합니다.');
  assert.equal(bridge.providerRequests.length, 3, 'cache hit에서 provider를 다시 호출하면 안 됩니다.');
  assert.deepEqual(hitCourse.legs, missCourse.legs);

  const map = buildCourseV1RouteGeometryModel(hitCourse);
  assert.deepEqual(map.segments.map(({ mode, legIndex, pathIndex }) => [mode, legIndex, pathIndex]), [
    ['walk', 0, 0],
    ['transit', 1, 0],
  ]);
  assert.equal(map.hasMissingGeometry, false);
  const detailSession = session({ ...destination, label: '설정 목적지' });
  const detail = buildCourseV1DetailModel(hitCourse, detailSession, getDisplayPlace);
  assert.ok(detail);
  const markers = buildCourseV1DetailMarkers(detail, detailSession);
  assert.deepEqual(markers?.map(({ label, kind }) => [label, kind]), [
    ['설정 출발지', 'origin'],
    ['고정 장소', 'spot'],
    ['설정 목적지', 'appointment'],
  ]);
  const boundsPoints = [...(markers ?? []).map(({ lat, lon }) => ({ lat, lon })), ...map.segments.flatMap(({ points }) => points)];
  assert.equal(Math.min(...boundsPoints.map(({ lat }) => lat)), origin.lat);
  assert.equal(Math.max(...boundsPoints.map(({ lat }) => lat)), destination.lat);
});

test('QA-COURSE-GEOMETRY-01 private 왕복: geometry는 화면까지 오고 cache·lease·geometry DB write·로그는 0이다', async () => {
  const bridge = createFixtureBridge();
  const adapter = createCourseV1ProxyRouteAdapter({ invoker: bridge.invoker, resolveScope: () => ({ kind: 'private_request' }) });
  const logs: unknown[][] = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  console.log = (...args) => { logs.push(args); };
  console.info = (...args) => { logs.push(args); };
  console.warn = (...args) => { logs.push(args); };
  console.error = (...args) => { logs.push(args); };
  let result;
  try {
    result = await buildReleaseOneStopRepresentativeCourseV1(buildInput(null, adapter));
  } finally {
    Object.assign(console, originals);
  }

  const course = result.representativeCourse;
  assert.ok(course);
  assert.deepEqual(course.legs.map(({ fromId, toId, mode }) => [fromId, toId, mode]), [
    ['origin', 'place', 'walk'],
    ['place', 'origin', 'transit'],
  ]);
  assert.ok(course.legs.every((leg) => leg.geometry));
  assert.equal(bridge.cache.size, 0);
  assert.deepEqual(new Set(bridge.rpcCalls.map(({ name }) => name)), new Set(['route_proxy_reserve_budget']));
  assert.equal(logs.length, 0);

  const map = buildCourseV1RouteGeometryModel(course);
  assert.deepEqual(map.segments.map(({ mode, legIndex }) => [mode, legIndex]), [['walk', 0], ['transit', 1]]);
  const returnSession = session(null);
  const detail = buildCourseV1DetailModel(course, returnSession, getDisplayPlace);
  assert.ok(detail);
  assert.deepEqual(buildCourseV1DetailMarkers(detail, returnSession)?.map(({ label }) => label), ['출발·복귀', '고정 장소']);
});

test('QA-COURSE-GEOMETRY-01 손상: exact 시간·코스·marker·CTA 계약은 유지하고 직선/추가 route는 만들지 않는다', async () => {
  const bridge = createFixtureBridge({ malformedGeometry: true });
  const adapter = createCourseV1ProxyRouteAdapter({ invoker: bridge.invoker, resolveScope: () => ({ kind: 'private_request' }) });
  const result = await buildReleaseOneStopRepresentativeCourseV1(buildInput(null, adapter));
  const course = result.representativeCourse;
  assert.ok(course);
  assert.equal(course.totalMin, 52);
  assert.ok(course.legs.every((leg) => leg.geometry === undefined));
  assert.equal(bridge.providerRequests.length, 3);

  const map = buildCourseV1RouteGeometryModel(course);
  assert.deepEqual(map.segments, []);
  assert.equal(map.hasMissingGeometry, true);
  assert.equal(map.missingMessage, '일부 경로선을 표시하지 못했어요');
  const returnSession = session(null);
  const detail = buildCourseV1DetailModel(course, returnSession, getDisplayPlace);
  assert.ok(detail);
  assert.equal(buildCourseV1DetailMarkers(detail, returnSession)?.length, 2);
  assert.equal(bridge.providerRequests.length, 3, '상세 model은 route를 재호출하면 안 됩니다.');
});
