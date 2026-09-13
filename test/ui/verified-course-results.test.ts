import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1Continuation, VerifiedCourseV1 } from '../../src/engine';
import { releaseOneStopDisplayResult } from '../../src/ui/recommendation/releaseOneStopResultsModel';

const continuation = (stopReason?: CourseV1Continuation['stopReason']): CourseV1Continuation => ({ version: 1, cursor: 0, candidatePlaceIds: [], candidateSetSignature: 'fixture', attemptedCourseSignatures: [], rejectedCourseSignatures: [], verifiedCourseSignatures: [], routeReceiptKeys: [], ...(stopReason ? { stopReason } : {}) });
const course = (placeIds: string[]) => ({ placeIds }) as VerifiedCourseV1;

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
