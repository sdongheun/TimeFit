import assert from 'node:assert/strict';
import test from 'node:test';
import { createQa02RouteFixture, qa02Scenarios, runQa02Scenario } from './fixtures/qa02-recommendation-scenarios.fixture';

test('QA02: 45·78·120·180분 고정 생활권 입력은 동일한 엔진 결과 측정 스키마로 재현된다', async () => {
  assert.deepEqual(qa02Scenarios.map((scenario) => scenario.remainingMin), [45, 78, 120, 180]);
  for (const scenario of qa02Scenarios) {
    const first = await runQa02Scenario(scenario);
    const second = await runQa02Scenario(scenario);
    assert.deepEqual(second.record, first.record, scenario.id);
    assert.equal(first.record.confirmedOrigin.label, scenario.origin.label);
    assert.ok(first.record.representativePlaceCount >= 0 && first.record.representativePlaceCount <= 3);
    assert.ok(first.record.remainingAfterCourseMin === null || first.record.remainingAfterCourseMin >= 0);
    assert.ok(first.record.route.requests > 0);
    assert.ok(first.record.exactCourseAttemptCount <= 4);
    assert.ok(first.record.providerCandidateCount > first.record.candidatePoolCount);
    assert.ok(first.record.wideSingleCandidateId);
    assert.ok(first.record.preselectedCourseIds.includes(first.record.wideSingleCandidateId!));
  }
});

test('QA02: 같은 fixture를 다시 실행하면 route miss 대신 cache hit가 증가하고, 외부 호출은 없다', async () => {
  for (const scenario of qa02Scenarios) {
    const fixture = createQa02RouteFixture(scenario.routePlans, scenario.routeFallback);
    const first = await runQa02Scenario(scenario, fixture);
    const requestsAfterFirst = first.record.route.requests;
    const second = await runQa02Scenario(scenario, fixture);
    assert.equal(second.record.route.requests, requestsAfterFirst, scenario.id);
    assert.ok(second.record.route.cacheHits > 0, scenario.id);
  }
});

test('QA02: route fixture metadata는 Kakao transit, 결정적 Kakao/TMAP walk, 1회 fallback과 제한/timeout 상태를 표현한다', () => {
  const plans = qa02Scenarios.flatMap((scenario) => Object.values(scenario.routePlans));
  for (const route of plans) {
    assert.ok((route.walkAttempts?.length ?? 0) <= 2);
    assert.ok(!route.walkAttempts || route.walkAttempts.length < 2 || route.walkAttempts[0] !== route.walkAttempts[1]);
    assert.deepEqual(route.transitAttempts ?? [], route.mode === 'transit' ? ['kakao'] : []);
    assert.ok(['ok', 'timeout', 'limited'].includes(route.status));
  }
  assert.ok(plans.some((route) => route.walkAttempts?.length === 2), '도보 fallback fixture가 필요합니다.');
  assert.ok(plans.some((route) => route.mode === 'transit'), 'Kakao 대중교통 fixture가 필요합니다.');
});

test('QA02: 후보 없음과 최대 4회 안의 route 실패는 현행 제한 엔진에서 다른 상태로 기록한다', async () => {
  const base = qa02Scenarios[0];
  const none = await runQa02Scenario({ ...base, candidates: [] });
  const failed = await runQa02Scenario({ ...base, routePlans: {}, routeFallback: { mode: 'walk', status: 'timeout' } });
  assert.equal(none.result.resultState, 'no_representative_candidates');
  assert.equal(failed.result.resultState, 'no_verified_course_within_limit');
  assert.equal(failed.result.diagnostics.exactCourseAttemptCount, 4);
});

test('QA02: 현행 제한 엔진의 대표·대안은 부분집합/상위집합을 함께 반환하지 않는다', async () => {
  for (const scenario of qa02Scenarios) {
    const { result } = await runQa02Scenario(scenario);
    const courses = result.representativeCourse ? [result.representativeCourse, ...result.alternativeCourses] : [];
    for (const [index, course] of courses.entries()) for (const other of courses.slice(index + 1)) {
      const left = new Set(course.placeIds); const right = new Set(other.placeIds);
      const nested = [...left].every((id) => right.has(id)) || [...right].every((id) => left.has(id));
      assert.equal(nested, false, `${scenario.id}: ${course.id} / ${other.id}`);
    }
  }
});
