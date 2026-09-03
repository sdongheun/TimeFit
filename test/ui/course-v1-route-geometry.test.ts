import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import type { RecommendationSession } from '../../src/ui/nav';
import type { PrivateWalkConnectorPort } from '../../src/services/privateWalkConnector';
import {
  buildCourseV1ConnectorRequests,
  buildCourseV1RouteGeometryModel,
  loadCourseV1WalkConnectors,
} from '../../src/ui/recommendation/courseV1RouteGeometryModel';

const path = (...points: Array<[number, number]>) => ({
  points: points.map(([lat, lon]) => ({ lat, lon })),
});

function course(
  modes: Array<'walk' | 'transit'>,
  geometries: Array<unknown>,
  returning = false,
): VerifiedCourseV1 {
  const placeIds = modes.length === 2 ? ['A'] : ['A', 'B'];
  const pointIds = returning
    ? ['origin', ...placeIds, 'origin']
    : ['origin', ...placeIds, 'destination'];
  return {
    id: 'geometry-fixture',
    placeIds,
    stops: placeIds.map((placeId, index) => ({
      placeId,
      stayMin: 10,
      stayState: 'recommended',
      availabilityState: 'structured_verified',
      arrivalAt: `2026-09-03T0${index + 1}:10:00.000Z`,
      departureAt: `2026-09-03T0${index + 1}:20:00.000Z`,
    })),
    legs: modes.map((mode, index) => ({
      fromId: pointIds[index],
      toId: pointIds[index + 1],
      mode,
      min: 5,
      geometry: geometries[index] as VerifiedCourseV1['legs'][number]['geometry'],
    })),
    travelMin: modes.length * 5,
    stayMin: placeIds.length * 10,
    arrivalBufferMin: 5,
    totalMin: modes.length * 5 + placeIds.length * 10 + 5,
    remainingAfterCourseMin: 0,
    remainingAfterArrivalBufferMin: 0,
  };
}

const outbound = { paths: [path([35.16, 128.98], [35.161, 128.982]), path([35.161, 128.982], [35.162, 128.984])] };
const inbound = { paths: [path([35.162, 128.984], [35.16, 128.98])] };
const metersNorth = (meters: number) => meters / 6_371_000 * 180 / Math.PI;
const connectorSession: RecommendationSession = {
  nowIso: '2026-09-03T01:00:00.000Z',
  origin: { id: 'origin', label: '출발', lat: 35, lon: 129 },
  destination: { id: 'destination', label: '도착', lat: 35.01, lon: 129.01 },
  remainingMin: 80,
  arrivalBufferMin: 10,
};
const connectorPlaces = { A: { lat: 35.005, lon: 129.005 } };

function oneStop(
  modes: ['walk' | 'transit', 'walk' | 'transit'],
  gaps: [[number, number], [number, number]],
  returning = false,
): VerifiedCourseV1 {
  const endpoint = returning ? connectorSession.origin : connectorSession.destination!;
  const expected = [connectorSession.origin, connectorPlaces.A, endpoint];
  const geometries = gaps.map(([startGap, endGap], index) => ({ paths: [path(
    [expected[index].lat + metersNorth(startGap), expected[index].lon],
    [expected[index + 1].lat + metersNorth(endGap), expected[index + 1].lon],
  )] }));
  return {
    ...course(modes, geometries, returning),
    placeIds: ['A'],
    stops: [{ placeId: 'A', stayMin: 10, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-03T01:10:00.000Z', departureAt: '2026-09-03T01:20:00.000Z' }],
    legs: [
      { ...course(modes, geometries, returning).legs[0], fromId: 'origin', toId: 'A' },
      { ...course(modes, geometries, returning).legs[1], fromId: 'A', toId: returning ? 'origin' : 'destination' },
    ],
    stayMin: 10,
    travelMin: 10,
    arrivalBufferMin: 5,
    totalMin: 25,
  };
}

test('UCOURSEGEOMETRY01: 모든 path를 leg/path 순서대로 별도 선으로 투영한다', () => {
  const model = buildCourseV1RouteGeometryModel(course(['walk', 'transit'], [outbound, inbound]));
  assert.deepEqual(model.segments.map(({ mode, legIndex, pathIndex }) => [mode, legIndex, pathIndex]), [
    ['walk', 0, 0], ['walk', 0, 1], ['transit', 1, 0],
  ]);
  assert.deepEqual(model.legend, [
    { mode: 'walk', label: '도보 경로' },
    { mode: 'transit', label: '대중교통 경로' },
  ]);
  assert.equal(model.hasMissingGeometry, false);
});

test('UCOURSEGEOMETRY01: walk+walk와 transit+walk 범례는 실제 표시 수단만 중복 없이 알린다', () => {
  const walk = buildCourseV1RouteGeometryModel(course(['walk', 'walk'], [inbound, inbound]));
  const mixed = buildCourseV1RouteGeometryModel(course(['transit', 'walk'], [outbound, inbound]));
  assert.deepEqual(walk.legend, [{ mode: 'walk', label: '도보 경로' }]);
  assert.deepEqual(mixed.legend.map((item) => item.label), ['대중교통 경로', '도보 경로']);
  assert.equal(mixed.accessibilityLabel, '경로 범례, 대중교통 경로, 도보 경로');
});

test('UCOURSEGEOMETRY01: 왕복의 서로 다른 두 geometry를 모두 보존한다', () => {
  const model = buildCourseV1RouteGeometryModel(course(['walk', 'walk'], [outbound, inbound], true));
  assert.equal(model.segments.length, 3);
  assert.deepEqual(model.segments.at(-1)?.points, inbound.paths[0].points);
});

test('UCOURSEGEOMETRY01: 일부 누락은 유효 leg만 남기고 직선 fallback을 만들지 않는다', () => {
  const model = buildCourseV1RouteGeometryModel(course(['walk', 'transit'], [outbound, undefined]));
  assert.equal(model.segments.length, 2);
  assert.equal(model.hasMissingGeometry, true);
  assert.equal(model.missingMessage, '일부 경로선을 표시하지 못했어요');
  assert.equal(model.segments.some((segment) => segment.quality === 'fallback'), false);
});

test('UCOURSEGEOMETRY01: 전부 누락과 손상 geometry는 marker-only로 안전하게 닫는다', () => {
  const invalid = [
    undefined,
    { paths: [] },
    { paths: [{ points: [{ lat: 35.16, lon: 128.98 }] }] },
    { paths: [path([91, 128.98], [35.16, 128.98])] },
  ];
  for (const geometry of invalid) {
    const model = buildCourseV1RouteGeometryModel(course(['walk', 'transit'], [geometry, geometry]));
    assert.deepEqual(model.segments, []);
    assert.equal(model.hasMissingGeometry, true);
    assert.equal(model.missingMessage, '일부 경로선을 표시하지 못했어요');
  }
});

test('UCOURSEGEOMETRY01: 긴 geometry 상한과 화면 연결은 snapshot-only 계약을 지킨다', () => {
  const longPath = path(...Array.from({ length: 512 }, (_, index) => [35.1 + index * 0.00001, 129.01] as [number, number]));
  const model = buildCourseV1RouteGeometryModel(course(['walk', 'walk'], [{ paths: [longPath] }, inbound]));
  assert.equal(model.segments[0].points.length, 512);

  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const map = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf8');
  assert.match(confirm, /buildCourseV1RouteGeometryModel\(course, connectorState\.connectors\)/);
  assert.match(confirm, /boundsPadding=\{\{ top: 48, right: 38, bottom: 64, left: 38 \}\}/);
  assert.match(confirm, /testID="verified-course-start"/);
  assert.match(confirm, /<CourseV1VerticalDetail/);
  assert.match(confirm, /showRouteLegend=\{false\} safeErrorPresentation/);
  assert.match(confirm, /active: false/);
  assert.doesNotMatch(confirm, /runRecommendationSession|RouteProxy|fetch\(|getRouteReceipt/);
  assert.match(map, /segments !== undefined \? segments/);
  assert.match(map, /safeErrorPresentation \? '지도를 표시할 수 없어요'/);
});

test('UCOURSEGEOMETRY02: 정확히 50m는 요청하지 않고 50m 초과 endpoint만 순서대로 만든다', () => {
  const boundary = oneStop(['transit', 'walk'], [[50, 51], [80, 80]]);
  const requests = buildCourseV1ConnectorRequests(boundary, connectorSession, (id) => connectorPlaces[id as 'A']);
  assert.deepEqual(requests.map(({ key, legIndex, endpoint }) => [key, legIndex, endpoint]), [['0:end', 0, 'end']]);
  assert.deepEqual(requests[0].from, boundary.legs[0].geometry?.paths[0].points[1]);
  assert.deepEqual(requests[0].to, connectorPlaces.A);
});

test('UCOURSEGEOMETRY02: walk/transit 조합은 유효 transit endpoint만 최대 네 개 요청한다', () => {
  const counts = [
    [['walk', 'walk'], 0],
    [['transit', 'walk'], 2],
    [['walk', 'transit'], 2],
    [['transit', 'transit'], 4],
  ] as const;
  for (const [modes, count] of counts) {
    const requests = buildCourseV1ConnectorRequests(oneStop([...modes], [[51, 51], [51, 51]]), connectorSession, (id) => connectorPlaces[id as 'A']);
    assert.equal(requests.length, count);
  }
  const requests = buildCourseV1ConnectorRequests(oneStop(['transit', 'transit'], [[51, 51], [51, 51]]), connectorSession, (id) => connectorPlaces[id as 'A']);
  assert.deepEqual(requests.map(({ key }) => key), ['0:start', '0:end', '1:start', '1:end']);
});

test('UCOURSEGEOMETRY02: 왕복 endpoint를 쓰고 손상·불일치·walk snapshot은 호출 0으로 닫는다', () => {
  const returning = oneStop(['walk', 'transit'], [[51, 51], [51, 51]], true);
  const returningRequests = buildCourseV1ConnectorRequests(returning, { ...connectorSession, destination: null }, (id) => connectorPlaces[id as 'A']);
  assert.deepEqual(returningRequests.at(-1)?.to, connectorSession.origin);

  const invalid = [
    { ...returning, placeIds: ['A', 'B'] },
    { ...returning, legs: [{ ...returning.legs[0], toId: 'wrong' }, returning.legs[1]] },
    { ...returning, legs: [returning.legs[0], { ...returning.legs[1], geometry: { paths: [] } }] },
  ];
  for (const item of invalid) {
    assert.deepEqual(buildCourseV1ConnectorRequests(item, { ...connectorSession, destination: null }, (id) => connectorPlaces[id as 'A']), []);
  }
});

test('UCOURSEGEOMETRY02: connector는 동시 최대 2개이며 역순 응답도 key 순서로 합성한다', async () => {
  const requests = buildCourseV1ConnectorRequests(oneStop(['transit', 'transit'], [[51, 51], [51, 51]]), connectorSession, (id) => connectorPlaces[id as 'A']);
  let active = 0;
  let maxActive = 0;
  const port: PrivateWalkConnectorPort = {
    async getConnector(from, to) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, from.lat > to.lat ? 1 : 4));
      active -= 1;
      return { status: 'exact_geometry', geometry: { paths: [{ points: [from, to] }] }, receipt: { newRequestStarted: true, reuse: 'new_request' } };
    },
    reset() {},
  };
  const loaded = await loadCourseV1WalkConnectors(requests, port);
  assert.equal(maxActive, 2);
  assert.deepEqual(loaded.connectors.map(({ key }) => key), requests.map(({ key }) => key));
  assert.equal(loaded.failedCount, 0);

  const merged = buildCourseV1RouteGeometryModel(oneStop(['transit', 'transit'], [[51, 51], [51, 51]]), loaded.connectors);
  assert.deepEqual(merged.segments.map(({ mode, connectorKey }) => [mode, connectorKey ?? null]), [
    ['walk', '0:start'], ['transit', null], ['walk', '0:end'],
    ['walk', '1:start'], ['transit', null], ['walk', '1:end'],
  ]);
});

test('UCOURSEGEOMETRY02: 부분·전체 실패는 성공선만 유지하고 안전한 실패 수를 반환한다', async () => {
  const requests = buildCourseV1ConnectorRequests(oneStop(['transit', 'walk'], [[51, 51], [0, 0]]), connectorSession, (id) => connectorPlaces[id as 'A']);
  let calls = 0;
  const loaded = await loadCourseV1WalkConnectors(requests, {
    async getConnector(from, to) {
      calls += 1;
      if (calls === 1) return { status: 'exact_geometry', geometry: { paths: [{ points: [from, to] }] }, receipt: { newRequestStarted: false, reuse: 'memory' } };
      return { status: 'unavailable', reason: 'transport', receipt: { newRequestStarted: false, reuse: 'none' } };
    },
    reset() {},
  });
  assert.equal(calls, 2);
  assert.equal(loaded.connectors.length, 1);
  assert.equal(loaded.failedCount, 1);
});

test('UCOURSEGEOMETRY02: no-route·unavailable·throw는 자동 재시도나 선 합성 없이 끝난다', async () => {
  const requests = buildCourseV1ConnectorRequests(oneStop(['transit', 'transit'], [[51, 51], [51, 51]]), connectorSession, (id) => connectorPlaces[id as 'A']);
  let calls = 0;
  const loaded = await loadCourseV1WalkConnectors(requests, {
    async getConnector() {
      calls += 1;
      if (calls === 1) return { status: 'no_route', receipt: { newRequestStarted: true, reuse: 'new_request' } };
      if (calls === 2) return { status: 'unavailable', reason: 'session_unavailable', receipt: { newRequestStarted: false, reuse: 'none' } };
      throw new Error('private detail must not escape');
    },
    reset() {},
  });
  assert.equal(calls, 4);
  assert.deepEqual(loaded.connectors, []);
  assert.equal(loaded.failedCount, 4);
});

test('UCOURSEGEOMETRY02: 앱 composition·화면은 singleton port와 non-blocking 상태만 사용한다', () => {
  const composition = fs.readFileSync('src/ui/privateWalkConnectorComposition.ts', 'utf8');
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  assert.equal((composition.match(/createSupabasePrivateWalkConnectorPort\(/g) ?? []).length, 1);
  assert.match(composition, /EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true'/);
  assert.match(confirm, /도보 연결을 확인하는 중이에요/);
  assert.match(confirm, /일부 도보 경로선을 표시하지 못했어요/);
  assert.match(confirm, /<CourseV1VerticalDetail/);
  assert.match(confirm, /testID="verified-course-start"/);
  assert.doesNotMatch(confirm, /transit.*getConnector|navigation.*connector|totalMin/);
});
