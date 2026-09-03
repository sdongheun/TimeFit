import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeKakaoTransitSegments } from '../supabase/functions/route-proxy/handler';

const officialWalkingRouteFixture = {
  steps: [
    { properties: { type: 'WALKING' }, path: { points: [[20, 10], [20.01, 10.01]] } },
    { properties: { type: 'SUBWAY' }, path: { points: [[20.01, 10.01], [20.09, 10.09]] } },
    { properties: { type: 'WALKING' }, path: { points: [[20.09, 10.09], [20.1, 10.1]] } },
  ],
};

test('API-ROUTE-GEOMETRY-01 교정: 공식 WALKING을 walk로 정규화하고 마지막 목적지 path를 순서대로 보존한다', () => {
  const result = sanitizeKakaoTransitSegments(officialWalkingRouteFixture, {
    origin: { lat: 10, lon: 20 },
    destination: { lat: 10.1, lon: 20.1 },
  });
  assert.deepEqual(result.segments.map((segment) => segment.mode), ['walk', 'transit', 'walk']);
  assert.deepEqual(result.segments.at(-1)?.paths.at(-1)?.points.at(-1), { lat: 10.1, lon: 20.1 });
  assert.equal(result.allStepsMapped, true);
  assert.deepEqual(result.endpointDistanceM, { start: 0, end: 0 });
});

test('API-ROUTE-GEOMETRY-01 교정: BUS와 SUBWAY는 transit이며 unknown type은 위치로 추정하지 않고 불완전으로 닫는다', () => {
  const result = sanitizeKakaoTransitSegments({
    steps: [
      { properties: { type: 'BUS' }, path: { points: [[20, 10], [20.02, 10.02]] } },
      { properties: { type: 'TRANSFER' }, path: { points: [[20.02, 10.02], [20.03, 10.03]] } },
      { properties: { type: 'SUBWAY' }, path: { points: [[20.03, 10.03], [20.1, 10.1]] } },
    ],
  });
  assert.deepEqual(result.segments.map((segment) => segment.mode), ['transit', 'transit']);
  assert.equal(result.allStepsMapped, false);
});

test('API-ROUTE-GEOMETRY-01 교정: ordered segment 전체에 32 paths·512 points 상한을 적용하고 양 끝을 보존한다', () => {
  const oversizedPath = Array.from({ length: 513 }, (_, index) => [20 + index / 10_000, 10 + index / 10_000]);
  const bounded = sanitizeKakaoTransitSegments({
    steps: [{ properties: { type: 'WALKING' }, path: { points: oversizedPath } }],
  });
  assert.equal(bounded.segments[0].paths[0].points.length, 512);
  assert.deepEqual(bounded.segments[0].paths[0].points[0], { lat: 10, lon: 20 });
  assert.deepEqual(bounded.segments[0].paths[0].points.at(-1), { lat: 10.0512, lon: 20.0512 });

  const tooManyPaths = sanitizeKakaoTransitSegments({
    steps: Array.from({ length: 33 }, (_, index) => ({
      properties: { type: index % 2 ? 'BUS' : 'WALKING' },
      path: { points: [[20 + index / 1_000, 10], [20 + (index + 1) / 1_000, 10]] },
    })),
  });
  assert.deepEqual(tooManyPaths.segments, []);
  assert.equal(tooManyPaths.allStepsMapped, false);
});
