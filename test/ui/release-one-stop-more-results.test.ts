import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type {
  CourseV1ReleaseOneStopContinuation,
  CourseV1ReleaseOneStopContinuationResult,
  CourseV1ReleaseOneStopResult,
  VerifiedCourseV1,
} from '../../src/engine';
import {
  appendReleaseOneStopPage,
  createReleaseOneStopMoreInFlightLock,
  initialReleaseOneStopMoreState,
  releaseOneStopMoreEndMessage,
} from '../../src/ui/recommendation/releaseOneStopMoreResultsModel';
import { continueReleaseRecommendationSession, runRecommendationSession } from '../../src/ui/recommendation/v1Session';

const continuation: CourseV1ReleaseOneStopContinuation = {
  version: 1,
  cursor: 3,
  candidatePlaceIds: ['A', 'B', 'C', 'D', 'E', 'F'],
  candidateSetSignature: 'safe-signature',
  attemptedCandidateIds: ['A', 'B', 'C'],
  rejectedCandidateIds: [],
  verifiedCandidateIds: ['A', 'B', 'C'],
  routeReceiptKeys: [],
};

function course(placeId: string): VerifiedCourseV1 {
  return {
    id: `course-${placeId}`,
    placeIds: [placeId],
    legs: [{ fromId: 'origin', toId: placeId, mode: 'walk', min: 5 }, { fromId: placeId, toId: 'destination', mode: 'walk', min: 7 }],
    stops: [{ placeId, stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-02T01:05:00.000Z', departureAt: '2026-09-02T01:35:00.000Z' }],
    travelMin: 12,
    stayMin: 30,
    totalMin: 52,
    arrivalBufferMin: 10,
    remainingAfterCourseMin: 28,
    remainingAfterArrivalBufferMin: 28,
  };
}

function result(representativeCourse: VerifiedCourseV1 | null, alternativeCourses: VerifiedCourseV1[]): CourseV1ReleaseOneStopResult {
  return {
    representativeCourse,
    alternativeCourses,
    resultState: representativeCourse ? 'verified' : 'no_verified_course_within_limit',
    alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
    continuation,
    diagnostics: {} as never,
  };
}

function page(appendedCourses: VerifiedCourseV1[], pageState: CourseV1ReleaseOneStopContinuationResult['pageState']): CourseV1ReleaseOneStopContinuationResult {
  return { appendedCourses, continuation: { ...continuation, cursor: continuation.cursor + 3, ...(pageState === 'more_available' ? {} : { stopReason: pageState }) }, pageState, outcomeReasons: [], diagnostics: {} as never };
}

test('UONEMORE01: 대표 1+대안 2 뒤 새 single 최대 3개를 중복 없이 append하고 기존 identity·순서를 유지한다', () => {
  const initial = initialReleaseOneStopMoreState(result(course('A'), [course('B'), course('C')]));
  const next = appendReleaseOneStopPage(initial, page([course('D'), course('E'), course('F')], 'more_available'));
  assert.equal(next.representativeCourse, initial.representativeCourse);
  assert.deepEqual(next.alternativeCourses.map((item) => item.placeIds[0]), ['B', 'C', 'D', 'E', 'F']);
  assert.equal(next.continuation?.cursor, 6);
  assert.equal(next.pageState, 'more_available');
});

test('UONEMORE01: page 중복·다장소·4번째 항목은 승격하지 않고 기존 카드도 다시 자르지 않는다', () => {
  const initial = initialReleaseOneStopMoreState(result(course('A'), [course('B'), course('C')]));
  const multi = { ...course('X'), placeIds: ['X', 'Y'] };
  const next = appendReleaseOneStopPage(initial, page([course('B'), multi, course('D'), course('E')], 'exhausted'));
  assert.deepEqual(next.alternativeCourses.map((item) => item.placeIds[0]), ['B', 'C', 'D']);
  assert.equal(next.pageState, 'exhausted');
});

test('UONEMORE01: initial 0건+후보 잔여는 열어 두고 첫 page의 첫 single만 대표로 승격한다', () => {
  const initial = initialReleaseOneStopMoreState(result(null, []));
  assert.equal(initial.representativeCourse, null);
  assert.equal(initial.pageState, 'more_available');
  const next = appendReleaseOneStopPage(initial, page([course('D'), course('E')], 'more_available'));
  assert.equal(next.representativeCourse?.placeIds[0], 'D');
  assert.deepEqual(next.alternativeCourses.map((item) => item.placeIds[0]), ['E']);
});

test('UONEMORE01: 빈 more_available page는 자동 재호출이나 provider 오류 없이 버튼 상태를 유지한다', () => {
  const initial = initialReleaseOneStopMoreState(result(course('A'), [course('B')]));
  const next = appendReleaseOneStopPage(initial, page([], 'more_available'));
  assert.deepEqual(next.alternativeCourses, initial.alternativeCourses);
  assert.equal(next.pageState, 'more_available');
  assert.equal(releaseOneStopMoreEndMessage(next.pageState), null);
});

test('UONEMORE01: 종료 상태는 비밀 없는 고정 문구만 사용한다', () => {
  assert.equal(releaseOneStopMoreEndMessage('exhausted'), '이 조건에서 확인할 수 있는 다른 장소가 없어요');
  assert.equal(releaseOneStopMoreEndMessage('provider_unavailable'), '다른 장소를 지금 확인하지 못했어요');
  assert.equal(releaseOneStopMoreEndMessage('continuation_unavailable'), '이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.');
  assert.equal(releaseOneStopMoreEndMessage('more_available'), null);
});

test('UONEMORE01: 동기 lock은 로딩 중 두 번째 tap을 막고 완료 뒤에만 다시 연다', () => {
  const lock = createReleaseOneStopMoreInFlightLock();
  assert.equal(lock.tryLock(), true);
  assert.equal(lock.tryLock(), false);
  lock.release();
  assert.equal(lock.tryLock(), true);
});

test('UONEMORE01: 명시 tap wrapper는 같은 session 메모리 input과 현재 continuation으로 single page entry를 한 번만 부른다', async () => {
  const recommendationSession = {
    nowIso: '2026-09-02T01:00:00.000Z',
    origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.06 },
    destination: { id: 'destination', label: '도착', lat: 35.16, lon: 129.07 },
    remainingMin: 120,
    arrivalBufferMin: 10,
  };
  const initial = result(course('A'), [course('B')]);
  await runRecommendationSession(recommendationSession, { routeProxyEnabled: false }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    buildRelease: async () => initial,
  });
  let calls = 0;
  const expected = page([course('C')], 'more_available');
  const received = await continueReleaseRecommendationSession(recommendationSession, continuation, {
    continueRelease: async (input) => { calls += 1; assert.equal(input.continuation, continuation); return expected; },
  });
  assert.equal(calls, 1);
  assert.equal(received, expected);
});

test('UONEMORE01: 검증 더보기와 조건부 로컬 더보기는 testID·호출 경계를 공유하지 않는다', () => {
  const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf8');
  const session = fs.readFileSync('src/ui/recommendation/v1Session.ts', 'utf8');
  assert.match(results, /testID="verified-course-more"/);
  assert.match(results, /testID="conditional-visit-more"/);
  assert.match(results, /continueReleaseRecommendationSession/);
  assert.match(session, /continueReleaseOneStopRepresentativeCourseV1/);
  assert.doesNotMatch(results, /continueLimitedRepresentativeCourseV1/);
});
