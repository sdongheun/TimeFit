import assert from "node:assert/strict";
import test from "node:test";
import type { LatLon } from "../../src/engine";
import { buildRouteMapSegments } from "../../src/ui/map/routeSegments";

const points: LatLon[] = [
  { lat: 35.1, lon: 129.0 },
  { lat: 35.2, lon: 129.1 },
  { lat: 35.3, lon: 129.2 },
];

test("TMAP의 유효한 다점 경로는 실경로로, 단순 좌표는 약식 경로로 표시한다", () => {
  const segments = buildRouteMapSegments(points, [
    {
      src: "TMAP",
      geo: [points[0], points[0], { lat: 35.13, lon: 129.03 }, { lat: 35.16, lon: 129.06 }, points[1]],
    },
    { geo: [points[1], points[2]] },
  ]);

  assert.equal(segments[0]?.quality, "precise");
  assert.equal(segments[0]?.points.length, 4);
  assert.equal(segments[1]?.quality, "approx");
});

test("좌표가 없거나 유효하지 않은 구간은 양 끝점을 잇는 직선 추정으로 폴백한다", () => {
  const segments = buildRouteMapSegments(points, [
    { geo: [{ lat: Number.NaN, lon: 129.0 }] },
    {},
  ]);

  assert.deepEqual(segments.map((segment) => segment.quality), ["fallback", "fallback"]);
  assert.deepEqual(segments[0]?.points, [points[0], points[1]]);
  assert.deepEqual(segments[1]?.points, [points[1], points[2]]);
});
