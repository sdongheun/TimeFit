import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReleaseOneStopRepresentativeCourseV1, type CourseV1Candidate, type CourseV1RouteReceiptAdapter } from '../src/engine/courseV1';
import { releaseTimeSetupValidation } from '../src/ui/timeSetup/releaseTimeBoundary';
import { QA_RELEASE_ONE_STOP_SCENARIOS, buildQaReleaseOneStopSession } from '../src/ui/qaReleaseOneStopLauncherModel';
import {
  closedAvailability,
  createReleaseOneStopReceiptFixture,
  releaseOneStopCandidate,
  releaseOneStopScenarios,
  runReleaseOneStopScenario,
  type ReleaseOneStopScenario,
} from './fixtures/release-one-stop-scenarios.fixture';

const now = new Date('2026-09-02T15:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.05 };
const destination = { id: 'destination', lat: 35.16, lon: 129.06 };

function build(
  candidates: readonly CourseV1Candidate[],
  receiptRoutes: CourseV1RouteReceiptAdapter,
  remainingMin = 120,
) {
  return buildReleaseOneStopRepresentativeCourseV1({
    now, origin, destination, remainingMin, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates },
    routes: { async getRoute() { throw new Error('legacy route adapter must not be used'); } },
    receiptRoutes,
  });
}

const exactAdapter = (attempts: 0 | 1 | 2 = 1): CourseV1RouteReceiptAdapter => ({
  async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: attempts, reused: attempts === 0 }; },
});

test('QA-RELEASE-ONESTOP-01 A: 출시 전용 8개 입력은 15:00·여유 10분·1~120분으로 고정된다', () => {
  assert.deepEqual(releaseOneStopScenarios.map((scenario) => scenario.id), [
    'SIM-ONE-01', 'SIM-ONE-02', 'SIM-ONE-03', 'SIM-ONE-04',
    'SIM-ONE-05', 'SIM-ONE-06', 'SIM-ONE-07', 'SIM-ONE-08',
  ]);
  assert.deepEqual(releaseOneStopScenarios.map((scenario) => scenario.remainingMin), [45, 120, 90, 120, 75, 120, 60, 120]);
  assert.ok(releaseOneStopScenarios.every((scenario) => scenario.nowIso.endsWith('T15:00:00+09:00')));
  assert.ok(releaseOneStopScenarios.every((scenario) => scenario.arrivalBufferMin === 10));
});

test('QA-RELEASE-ONESTOP-01 A 보완: QA fixture 8개 입력은 UI launcher 공개 preset과 정확히 같다', () => {
  const launcherById = new Map(QA_RELEASE_ONE_STOP_SCENARIOS.map((scenario) => [scenario.id, scenario]));
  assert.equal(launcherById.size, 8);
  assert.equal(releaseOneStopScenarios.length, 8);

  for (const fixture of releaseOneStopScenarios) {
    const launcher = launcherById.get(fixture.id);
    assert.ok(launcher, `${fixture.id}: UI launcher preset이 필요합니다.`);
    assert.deepEqual(
      { label: fixture.origin.label, lat: fixture.origin.lat, lon: fixture.origin.lon },
      { label: launcher.origin.label, lat: launcher.origin.lat, lon: launcher.origin.lon },
      `${fixture.id}: 출발지 입력 불일치`,
    );
    assert.equal(fixture.destination === null, launcher.destination === null, `${fixture.id}: 왕복/편도 불일치`);
    if (fixture.destination && launcher.destination) {
      assert.deepEqual(
        { label: fixture.destination.label, lat: fixture.destination.lat, lon: fixture.destination.lon },
        { label: launcher.destination.label, lat: launcher.destination.lat, lon: launcher.destination.lon },
        `${fixture.id}: 도착지 입력 불일치`,
      );
    }
    assert.equal(fixture.remainingMin, launcher.remainingMin, `${fixture.id}: remainingMin 불일치`);
    assert.equal(fixture.arrivalBufferMin, launcher.arrivalBufferMin, `${fixture.id}: arrivalBufferMin 불일치`);

    const launcherSession = buildQaReleaseOneStopSession(fixture.id, new Date('2026-09-02T09:00:00+09:00'));
    assert.equal(new Date(fixture.nowIso).getHours(), 15, `${fixture.id}: QA fixture 시각`);
    assert.equal(new Date(launcherSession.nowIso).getHours(), 15, `${fixture.id}: UI launcher 시각`);
  }
});

test('QA-RELEASE-ONESTOP-01 A: 8개 fixture는 one-stop·중복 0·예산·체류·attempt 상한을 결정적으로 지킨다', async () => {
  for (const scenario of releaseOneStopScenarios) {
    const first = await runReleaseOneStopScenario(scenario);
    const second = await runReleaseOneStopScenario(scenario);
    assert.deepEqual(second.record, first.record, scenario.id);
    const courses = [first.result.representativeCourse, ...first.result.alternativeCourses].filter((course) => course !== null);
    assert.ok(first.result.representativeCourse === null || first.result.representativeCourse.placeIds.length === 1, scenario.id);
    assert.ok(first.result.alternativeCourses.length <= 3, scenario.id);
    assert.ok(courses.every((course) => course.placeIds.length === 1 && course.legs.length === 2), scenario.id);
    assert.equal(new Set(first.record.allPlaceIds).size, first.record.allPlaceIds.length, scenario.id);
    assert.ok(courses.every((course) => course.totalMin <= scenario.remainingMin), scenario.id);
    assert.ok(courses.every((course) => (course.remainingAfterCourseMin ?? -1) >= 0), scenario.id);
    assert.ok(courses.every((course) => course.arrivalBufferMin === 10), scenario.id);
    assert.ok(courses.every((course) => course.stops[0]!.stayMin >= 20), scenario.id);
    assert.ok(courses.every((course) => course.stops[0]!.stayState === (course.stops[0]!.stayMin < 30 ? 'short' : 'recommended')), scenario.id);
    assert.ok(courses.every((course) => course.stops[0]!.stayMin <= 30), `${scenario.id}: 남는 시간으로 최대 체류까지 자동 연장하면 안 됩니다.`);
    assert.ok(first.record.diagnostics.newProviderAttemptCount <= 8, scenario.id);
    assert.equal(first.record.diagnostics.newProviderAttemptCount, first.record.fixture.newProviderAttempts, scenario.id);
    assert.equal(first.record.diagnostics.adapterCallCount, first.record.fixture.adapterCalls, scenario.id);
    assert.equal(first.record.diagnostics.generatedOrderedCourseCount, 0, scenario.id);
    assert.equal('continuation' in first.result, false, scenario.id);
    assert.equal(first.record.fixture.pairs.some((pair) => /place-\d+>sim-one-\d+-place-\d+/.test(pair)), false, scenario.id);
  }
});

test('QA-RELEASE-ONESTOP-01 A: 120분은 통과하고 121분·0분은 builder와 adapter 전에 거절된다', async () => {
  let builderCalls = 0;
  let adapterCalls = 0;
  const guardedRun = async (remainingMin: number) => {
    const validation = releaseTimeSetupValidation(true, remainingMin);
    if (validation) return validation;
    builderCalls += 1;
    await build([releaseOneStopCandidate('boundary', 1)], { async getRouteReceipt() {
      adapterCalls += 1;
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    } }, remainingMin);
    return '';
  };
  assert.equal(await guardedRun(120), '');
  const afterValid = { builderCalls, adapterCalls };
  assert.match(await guardedRun(121), /최대 2시간/);
  assert.match(await guardedRun(0), /현재 시각 뒤/);
  assert.deepEqual({ builderCalls, adapterCalls }, afterValid);
});

test('QA-RELEASE-ONESTOP-01 A: 대표 없음·대표만·대표와 대안 3개를 구분한다', async () => {
  const none = await build([], exactAdapter());
  const only = await build([releaseOneStopCandidate('only', 1)], exactAdapter());
  const four = await build(Array.from({ length: 4 }, (_, index) => releaseOneStopCandidate(`four-${index}`, index)), exactAdapter());
  assert.equal(none.representativeCourse, null);
  assert.equal(none.alternativeCourses.length, 0);
  assert.ok(only.representativeCourse);
  assert.equal(only.alternativeCourses.length, 0);
  assert.ok(four.representativeCourse);
  assert.equal(four.alternativeCourses.length, 3);
});

test('QA-RELEASE-ONESTOP-01 A: 첫 route 실패 뒤 다음 single 후보를 검증한다', async () => {
  const candidates = [releaseOneStopCandidate('failed-first', 1), releaseOneStopCandidate('verified-next', 2)];
  const fixture = createReleaseOneStopReceiptFixture({
    'origin>failed-first': { result: 'no_route', newProviderAttemptCount: 1 },
    'origin>verified-next': { result: 'exact', min: 5, newProviderAttemptCount: 1 },
    'verified-next>destination': { result: 'exact', min: 5, newProviderAttemptCount: 1 },
  });
  const result = await build(candidates, fixture.adapter);
  assert.deepEqual(result.representativeCourse?.placeIds, ['verified-next']);
  assert.equal(result.diagnostics.outcomeReasonCounts?.route_not_verified, 1);
});

test('QA-RELEASE-ONESTOP-01 A: 모든 no_route와 provider unavailable은 서로 다른 safe 상태다', async () => {
  const candidates = [releaseOneStopCandidate('one', 1), releaseOneStopCandidate('two', 2)];
  const noRoute = await build(candidates, { async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 1, reused: false }; } });
  let unavailableCalls = 0;
  const unavailable = await build(candidates, { async getRouteReceipt() {
    unavailableCalls += 1;
    return { result: 'unavailable', reason: 'provider', newProviderAttemptCount: 1, reused: false };
  } });
  assert.equal(noRoute.primaryOutcomeReason, 'route_not_verified');
  assert.equal(noRoute.diagnostics.outcomeReasonCounts?.route_not_verified, 2);
  assert.equal(unavailable.primaryOutcomeReason, 'route_verification_unavailable');
  assert.equal(unavailable.diagnostics.outcomeReasonCounts?.route_verification_unavailable, 1);
  assert.equal(unavailableCalls, 1, 'typed provider unavailable은 첫 응답에서 terminal로 중단해야 합니다.');
});

test('QA-RELEASE-ONESTOP-01 A: 운영 불가·시간 초과·ID/단지 중복은 검증 course로 승격되지 않는다', async () => {
  let calls = 0;
  const closed = releaseOneStopCandidate('closed', 1, { availability: closedAvailability });
  const budget = releaseOneStopCandidate('budget', 2, { minStayMin: 30, recommendedStayMin: 30 });
  const sameIdVariant = releaseOneStopCandidate('same-id', 3, { title: '같은 장소' });
  const sameIdSpacingVariant = releaseOneStopCandidate('same-id', 4, { title: '같 은 장소' });
  const sameGroupA = releaseOneStopCandidate('group-a', 5, { siteGroupId: 'same-site' });
  const sameGroupB = releaseOneStopCandidate('group-b', 6, { siteGroupId: 'same-site' });
  const result = await build([closed, budget, sameIdVariant, sameIdSpacingVariant, sameGroupA, sameGroupB], {
    async getRouteReceipt(from, to) {
      calls += 1;
      const isBudget = from.id === 'budget' || to.id === 'budget';
      return { result: 'exact', route: { mode: 'walk', min: isBudget ? 55 : 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }, 70);
  const ids = [result.representativeCourse, ...result.alternativeCourses].filter((course) => course !== null).flatMap((course) => course.placeIds);
  assert.equal(ids.includes('closed'), false);
  assert.equal(ids.includes('budget'), false);
  assert.ok(ids.filter((id) => id === 'same-id').length <= 1);
  assert.ok(ids.filter((id) => id === 'group-a' || id === 'group-b').length <= 1);
  assert.ok(calls <= 8);
});

test('QA-RELEASE-ONESTOP-01 A: cache/session 재사용은 신규 attempt가 아니며 계수는 분리된다', async () => {
  const candidates = [releaseOneStopCandidate('reused', 1)];
  const result = await build(candidates, exactAdapter(0));
  assert.ok(result.representativeCourse);
  assert.equal(result.diagnostics.newProviderAttemptCount, 0);
  assert.equal(result.diagnostics.adapterCallCount, 2);
  assert.equal(result.diagnostics.cacheOrSessionReuseCount, 2);
});
