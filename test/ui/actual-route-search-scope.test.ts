import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ROUTE_SEARCH_RADIUS_M,
  MAX_ROUTE_SEARCH_RADIUS_M,
  createActualRouteSearchScope,
  isPointInActualRouteSearchScope,
} from "../../src/engine/actualRouteSearchScope";

const origin = { lat: 35.15, lon: 129.05 };
const destination = { lat: 35.15, lon: 129.09 };

test("도착지가 없으면 현재 위치 복귀 반경만 탐색한다", () => {
  const scope = createActualRouteSearchScope({ origin });

  assert.equal(scope.kind, "return_area");
  assert.equal(scope.radiusM, DEFAULT_ROUTE_SEARCH_RADIUS_M);
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.157, lon: 129.05 }, scope), true);
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.17, lon: 129.05 }, scope), false);
});

test("직선 상이 아니라 성공한 실제 경로가 휘어진 축 주변 후보를 포함한다", () => {
  const scope = createActualRouteSearchScope({
    origin,
    destination,
    radiusM: 1_000,
    baselines: [{
      mode: "walk",
      geometry: [origin, { lat: 35.17, lon: 129.07 }, destination],
    }],
  });

  assert.equal(scope.kind, "route_corridor");
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.171, lon: 129.07 }, scope), true);
  // 출발지와 도착지를 직선으로 이었을 때는 가깝지만, 실제 우회 경로와는 1km 이상 떨어진 후보다.
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.15, lon: 129.07 }, scope), false);
});

test("도보·차량·대중교통 중 성공한 기준 경로의 합집합만 후보 범위가 된다", () => {
  const scope = createActualRouteSearchScope({
    origin,
    destination,
    radiusM: 1_000,
    baselines: [
      { mode: "walk", geometry: [origin, { lat: 35.17, lon: 129.07 }, destination] },
      { mode: "car", geometry: [origin, { lat: 35.13, lon: 129.07 }, destination] },
      { mode: "transit", geometry: [] },
    ],
  });

  assert.equal(scope.kind, "route_corridor");
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.131, lon: 129.07 }, scope), true);
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.15, lon: 129.07 }, scope), false);
});

test("모든 기준 경로가 실패하면 확장 반경을 적용하지 않고 양 끝 1km 생활권만 남긴다", () => {
  const scope = createActualRouteSearchScope({
    origin,
    destination,
    radiusM: MAX_ROUTE_SEARCH_RADIUS_M,
    baselines: [{ mode: "walk", geometry: [] }],
  });

  assert.equal(scope.kind, "endpoint_fallback");
  assert.equal(scope.radiusM, DEFAULT_ROUTE_SEARCH_RADIUS_M);
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.157, lon: 129.05 }, scope), true);
  assert.equal(isPointInActualRouteSearchScope({ lat: 35.15, lon: 129.07 }, scope), false);
});

test("탐색 반경은 기본 1km에서 최대 8km로만 정규화된다", () => {
  const short = createActualRouteSearchScope({ origin, radiusM: 10 });
  const wide = createActualRouteSearchScope({ origin, radiusM: 99_999 });

  assert.equal(short.radiusM, DEFAULT_ROUTE_SEARCH_RADIUS_M);
  assert.equal(wide.radiusM, MAX_ROUTE_SEARCH_RADIUS_M);
});
