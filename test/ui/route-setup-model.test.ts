import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRouteLocation, canApplyRouteSetup, initialRouteSetupState, openRouteField, routeSetupSummary } from '../../src/ui/routeSetupModel';

const origin = { label: '현재 위치', lat: 35.16, lon: 129.06 };
const destination = { label: '사상역', lat: 35.162, lon: 128.985 };

test('UR7-01/02: 권한 자동 적용 전에는 출발지가 비어 있고 route 적용은 불가하다', () => {
  assert.equal(canApplyRouteSetup(initialRouteSetupState), false);
  assert.equal(routeSetupSummary(initialRouteSetupState), null);
  assert.equal(canApplyRouteSetup(applyRouteLocation(initialRouteSetupState, origin)), true);
});

test('UR7-03/07: 같은 picker 결과는 active field에만 적용하고 빈 도착지는 복귀 요약이다', () => {
  const withOrigin = applyRouteLocation(initialRouteSetupState, origin);
  assert.equal(routeSetupSummary(withOrigin), '현재 위치 · 출발지로 돌아오기');
  const withDestination = applyRouteLocation(openRouteField(withOrigin, 'destination'), destination);
  assert.equal(routeSetupSummary(withDestination), '현재 위치 → 사상역');
  assert.deepEqual(withDestination.origin, origin);
});
