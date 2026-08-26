import assert from 'node:assert/strict';
import test from 'node:test';
import { captureRecommendationNowIso, parseRecommendationNowIso, startMinuteForRecommendation } from '../../src/ui/recommendation/recommendationSessionTime';
import { buildRecommendationEngineInput } from '../../src/ui/recommendation/v1Session';

test('고정 테스트 시각은 UTC ISO로 직렬화하며 화면·엔진이 같은 시각을 복원한다', () => {
  const nowIso = captureRecommendationNowIso(new Date('2026-08-25T01:22:48.000Z'), 20 * 60 + 15);
  assert.equal(nowIso, '2026-08-25T11:15:00.000Z');
  assert.equal(parseRecommendationNowIso(nowIso).toISOString(), nowIso);
  assert.equal(startMinuteForRecommendation(nowIso), 20 * 60 + 15);
  assert.equal(buildRecommendationEngineInput({ nowIso, origin: { id: 'origin', lat: 35.15, lon: 129.05, label: '서면' }, destination: null, remainingMin: 90, arrivalBufferMin: 10 }).now.toISOString(), nowIso);
});

test('운영 시각은 추천을 누른 순간의 ISO 값을 한 번만 캡처해 직렬화한다', () => {
  const captured = new Date('2026-08-25T01:22:48.500Z');
  assert.equal(captureRecommendationNowIso(captured, null), '2026-08-25T01:22:48.500Z');
});

test('추천 세션은 유효하지 않거나 UTC ISO가 아닌 시각을 navigation 경계에서 거부한다', () => {
  assert.throws(() => parseRecommendationNowIso('2026-08-25 11:15:00'), /UTC ISO/);
  assert.throws(() => parseRecommendationNowIso('not-a-date'), /UTC ISO/);
});

test('직렬화한 Results·CourseConfirm 파라미터와 대안 교체 뒤 세션은 JSON 안전하다', () => {
  const session = { nowIso: '2026-08-25T11:15:00.000Z', origin: { id: 'origin', lat: 35.15, lon: 129.05, label: '서면' }, destination: null, remainingMin: 90, arrivalBufferMin: 10 };
  const resultParams = { session, result: { representativeCourse: null, alternativeCourses: [], resultState: 'no_representative_candidates', alternativeState: 'no_candidates' } };
  const confirmParams = { ...resultParams, courseId: 'course-1' };
  assert.doesNotThrow(() => JSON.stringify(resultParams));
  assert.doesNotThrow(() => JSON.stringify(confirmParams));
  assert.equal({ ...resultParams, result: { ...resultParams.result, alternativeCourses: [] } }.session.nowIso, session.nowIso);
});
