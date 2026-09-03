import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1Continuation, VerifiedCourseV1 } from '../../src/engine';
import { releaseOneStopDisplayResult } from '../../src/ui/recommendation/releaseOneStopResultsModel';
import { appendDistinctVerifiedCourses, conditionalVisitPage, continuationEndMessage, createContinuationInFlightLock, effectiveContinuationState, millisecondsUntilConditionalVisibilityBoundary } from '../../src/ui/recommendation/verifiedCourseResultsModel';

const continuation = (stopReason?: CourseV1Continuation['stopReason']): CourseV1Continuation => ({ version: 1, cursor: 0, candidatePlaceIds: [], candidateSetSignature: 'fixture', attemptedCourseSignatures: [], rejectedCourseSignatures: [], verifiedCourseSignatures: [], routeReceiptKeys: [], ...(stopReason ? { stopReason } : {}) });
const course = (placeIds: string[]) => ({ placeIds }) as VerifiedCourseV1;
const session = (nowIso: string) => ({ nowIso, origin: { lat: 35.15, lon: 129.05 }, destination: { lat: 35.17, lon: 129.07 } });

test('URESULTS03-R: 초기 continuation 종료 상태는 버튼 없이 같은 종료 문구를 쓴다', () => {
  assert.equal(effectiveContinuationState(continuation('candidate_queue_exhausted')), 'exhausted');
  assert.equal(effectiveContinuationState(continuation('provider_daily_limit')), 'provider_unavailable');
  assert.equal(effectiveContinuationState(continuation('provider_unavailable')), 'provider_unavailable');
  assert.equal(effectiveContinuationState(continuation('continuation_unavailable')), 'continuation_unavailable');
  assert.equal(effectiveContinuationState(undefined), 'exhausted');
  assert.equal(continuationEndMessage('exhausted'), '이 조건에서 다른 검증 코스가 없어요.');
  assert.equal(continuationEndMessage('provider_unavailable'), '지금은 추가 경로를 확인할 수 없어요.');
  assert.equal(continuationEndMessage('continuation_unavailable'), '이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.');
});

test('URESULTS03-R: append는 기존 순서를 보존하고 순서만 다른 같은 장소 집합만 막는다', () => {
  const appended = appendDistinctVerifiedCourses([course(['A'])], [course(['B']), course(['B', 'A']), course(['A', 'B']), course(['A'])]);
  assert.deepEqual(appended.map((item) => item.placeIds), [['A'], ['B'], ['B', 'A']]);
});

test('URESULTS03-R: 동기 in-flight lock은 같은 tick의 두 번째 continuation 요청을 막고 finally 뒤 다시 연다', () => {
  const lock = createContinuationInFlightLock();
  assert.equal(lock.tryLock(), true);
  assert.equal(lock.tryLock(), false);
  lock.release();
  assert.equal(lock.tryLock(), true);
});

test('URELEASEONESTOP01: 대표 single과 서로 다른 대안 single 최대 3개만 원래 순서로 표시한다', () => {
  const representative = course(['A']);
  const result = releaseOneStopDisplayResult({
    representativeCourse: representative,
    alternativeCourses: [course(['A']), course(['B']), course(['B']), course(['C']), course(['D']), course(['E'])],
    resultState: 'verified', alternativeState: 'alternatives_available', diagnostics: {} as never,
  });
  assert.equal(result.representativeCourse, representative);
  assert.deepEqual(result.alternativeCourses.map((item) => item.placeIds), [['B'], ['C'], ['D']]);
});

test('URELEASEONESTOP01: 다장소 snapshot은 자르거나 대안으로 승격하지 않고 fail-closed한다', () => {
  const invalidRepresentative = releaseOneStopDisplayResult({ representativeCourse: course(['A', 'B']), alternativeCourses: [course(['C'])], resultState: 'verified', alternativeState: 'alternatives_available', diagnostics: {} as never });
  assert.equal(invalidRepresentative.representativeCourse, null);
  assert.deepEqual(invalidRepresentative.alternativeCourses, []);
  assert.equal(invalidRepresentative.resultState, 'no_verified_course_within_limit');
  const result = releaseOneStopDisplayResult({ representativeCourse: course(['A']), alternativeCourses: [course(['B', 'C']), course(['D'])], resultState: 'verified', alternativeState: 'alternatives_available', diagnostics: {} as never });
  assert.deepEqual(result.alternativeCourses.map((item) => item.placeIds), [['D']]);
});

test('URESULTS04: 조건부 카드는 세션 시작 시각과 무관하게 실제 시각 10:00~17:59에만 가까운 순서로 8개씩 보인다', () => {
  const places = Array.from({ length: 17 }, (_, index) => ({ id: String(index).padStart(2, '0'), lat: 35.15 + index / 1000, lon: 129.05 }));
  const fixedSession = session('2026-08-31T17:59:00+09:00');
  assert.deepEqual(conditionalVisitPage(places, fixedSession, new Date('2026-08-31T09:59:00+09:00')).places, []);
  const first = conditionalVisitPage(places, fixedSession, new Date('2026-08-31T10:00:00+09:00'));
  assert.equal(first.places.length, 8);
  assert.equal(first.nextCursor, 8);
  const second = conditionalVisitPage(places, fixedSession, new Date('2026-08-31T10:00:00+09:00'), first.nextCursor!);
  assert.equal(second.places.length, 8);
  assert.equal(new Set([...first.places, ...second.places].map((place) => place.id)).size, 16);
  assert.equal(conditionalVisitPage(places, fixedSession, new Date('2026-08-31T17:59:00+09:00')).places.length, 8);
  assert.deepEqual(conditionalVisitPage(places, fixedSession, new Date('2026-08-31T18:00:00+09:00')).places, []);
});

test('URESULTS04: 다음 경계 타이머는 17:59 렌더 뒤 18:00에서 한 번 갱신하고, foreground 갱신에도 같은 실제 시각 gate를 쓴다', () => {
  const beforeClose = new Date('2026-08-31T17:59:30+09:00');
  const foregroundAtClose = new Date('2026-08-31T18:00:00+09:00');
  assert.equal(millisecondsUntilConditionalVisibilityBoundary(beforeClose), 30_000);
  assert.equal(millisecondsUntilConditionalVisibilityBoundary(foregroundAtClose), 16 * 60 * 60 * 1000);
  const places = [{ id: 'near', lat: 35.15, lon: 129.05 }];
  const fixedSession = session('2026-08-31T17:59:00+09:00');
  assert.equal(conditionalVisitPage(places, fixedSession, beforeClose).places.length, 1);
  assert.deepEqual(conditionalVisitPage(places, fixedSession, foregroundAtClose).places, []);
});
