import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeKakaoTransitRoutes } from '../supabase/functions/route-geometry-diagnostic/summarizeKakaoTransitRoutes';
import { routeGeometryAllRoutesDiagnosticSafeResult } from './fixtures/route-geometry-diagnostic-safe.fixture';

const step = (type: string, points: number[][]) => ({ properties: { type }, path: { points } });
const route = (type: string, totalTime: number, transfers: number, steps: unknown[]) => ({ properties: { type, totalTime, transfers }, steps });
const endpoints = { origin: { lon: 20, lat: 10 }, destination: { lon: 20.1, lat: 10.1 } };

test('API-ROUTE-GEOMETRY-02: route 0만 보지 않고 완전·부분 WALKING을 전체 route 순서로 요약한다', () => {
  const result = summarizeKakaoTransitRoutes({ routes: [
    route('BUS', 600, 0, [step('BUS', [[20.01, 10.01], [20.09, 10.09]])]),
    route('BUS_AND_SUBWAY', 720, 1, [
      step('WALKING', [[20, 10], [20.01, 10.01]]),
      step('SUBWAY', [[20.01, 10.01], [20.09, 10.09]]),
      step('WALKING', [[20.09, 10.09], [20.1, 10.1]]),
    ]),
    route('SUBWAY', 660, 0, [
      step('WALKING', [[20, 10], [20.01, 10.01]]),
      step('SUBWAY', [[20.01, 10.01], [20.09, 10.09]]),
      step('WALKING', []),
    ]),
  ] }, endpoints);

  assert.equal(result.routeCount, 3);
  assert.deepEqual(result.routes.map((item: { routeIndex: number }) => item.routeIndex), [0, 1, 2]);
  assert.deepEqual(result.routes[0], {
    routeIndex: 0, routeType: 'BUS', totalMin: 10, transfers: 0,
    stepModeOrder: ['transit'], steps: [{ type: 'BUS', validPointCount: 2 }],
    firstStepType: 'BUS', lastStepType: 'BUS', startEndpointGap: 'over_250m', endEndpointGap: 'over_250m',
    hasLeadingWalkingPath: false, hasTerminalWalkingPath: false,
  });
  assert.equal(result.routes[1].hasLeadingWalkingPath, true);
  assert.equal(result.routes[1].hasTerminalWalkingPath, true);
  assert.deepEqual([result.routes[1].startEndpointGap, result.routes[1].endEndpointGap], ['0_25m', '0_25m']);
  assert.equal(result.routes[2].lastStepType, 'WALKING');
  assert.equal(result.routes[2].hasTerminalWalkingPath, false);
  assert.equal(result.routes[2].endEndpointGap, 'over_250m');
});

test('API-ROUTE-GEOMETRY-02: 최대 32 route만 보존하고 unknown route/step을 allowlist 밖으로 노출하지 않는다', () => {
  const result = summarizeKakaoTransitRoutes({ routes: Array.from({ length: 33 }, (_, index) => route(
    index === 0 ? 'SECRET_ROUTE' : 'BUS', 60, 0,
    [step(index === 0 ? 'SECRET_STEP' : 'BUS', [[20, 10], [20.1, 10.1]])],
  )) }, endpoints);
  assert.equal(result.routeCount, 33);
  assert.equal(result.routes.length, 32);
  assert.equal(result.truncated, true);
  assert.equal(result.routes[0].routeType, 'UNKNOWN');
  assert.deepEqual(result.routes[0].stepModeOrder, ['unknown']);
  assert.equal(result.routes[0].steps[0].type, 'UNKNOWN');
});

test('API-ROUTE-GEOMETRY-02: 실제 단일 C2 전체-route 안전 집계는 R3 판정을 보존한다', () => {
  const result = routeGeometryAllRoutesDiagnosticSafeResult;
  assert.equal(result.providerCallCount, 1);
  assert.equal(result.routeCount, 14);
  assert.equal(result.leadingWalkingPathCount, 0);
  assert.equal(result.terminalWalkingPathCount, 0);
  assert.deepEqual(result.interiorWalkingRouteIndexes, [2, 6, 8, 9, 10]);
  assert.deepEqual(result.terminalGapCounts, { '51_100m': 2, '101_250m': 12 });
  assert.equal(result.verdict, 'R3');
});
