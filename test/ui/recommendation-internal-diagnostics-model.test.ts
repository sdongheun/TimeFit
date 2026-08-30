import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1LimitedResult } from '../../src/engine';
import { recommendationDiagnosticsEnabled, recommendationInternalDiagnosticsModel } from '../../src/ui/recommendation/recommendationInternalDiagnosticsModel';

function resultFixture(overrides: Partial<CourseV1LimitedResult['diagnostics']> = {}): CourseV1LimitedResult {
  return {
    representativeCourse: {} as CourseV1LimitedResult['representativeCourse'],
    alternativeCourses: [{} as never, {} as never],
    resultState: 'verified',
    alternativeState: 'alternatives_available',
    diagnostics: {
      providerCandidateCount: 12, preselectionCandidateCount: 8, candidatePoolCount: 6, classificationExcluded: 4,
      generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0,
      newProviderAttemptCount: 8, adapterCallCount: 24, cacheOrSessionReuseCount: 3,
      outcomeReasonCounts: { route_not_verified: 2, time_budget_exceeded: 1 },
      verificationTiers: {
        N1: { candidateCount: 2, attemptedCourseCount: 1, verifiedCourseCount: 1, newProviderAttemptCount: 2, stopReasons: [] },
        N2: { candidateCount: 3, attemptedCourseCount: 2, verifiedCourseCount: 0, newProviderAttemptCount: 3, stopReasons: ['route_not_verified'] },
        W: { candidateCount: 1, attemptedCourseCount: 0, verifiedCourseCount: 0, newProviderAttemptCount: 0, stopReasons: ['gated_by_near_single_verification'] },
        T: { candidateCount: 4, attemptedCourseCount: 4, verifiedCourseCount: 0, newProviderAttemptCount: 3, stopReasons: ['provider_attempt_limit', 'provider_attempt_limit'] },
      },
      ...overrides,
    },
  };
}

test('URECDIAG01-01: tier·탈락 진단은 고정 한국어 label과 정수만 투영한다', () => {
  const model = recommendationInternalDiagnosticsModel(resultFixture(), 3);
  assert.deepEqual(model.courseCounts, [{ label: '엔진 코스', value: 3 }, { label: '화면 코스', value: 3 }]);
  assert.deepEqual(model.candidateCounts, [{ label: '원천 후보', value: 12 }, { label: '조건 통과 후보', value: 8 }, { label: '공간 후보', value: 6 }, { label: '사전 제외', value: 4 }]);
  assert.deepEqual(model.requestCounts, [{ label: '새 경로 확인', value: 8 }, { label: 'adapter 호출', value: 24 }, { label: '재사용', value: 3 }]);
  assert.deepEqual(model.tiers.map(({ tier, stopReasons }) => [tier, stopReasons]), [['N1', []], ['N2', [{ label: '경로 미검증', value: 1 }]], ['W', [{ label: 'N1 검증 대기', value: 1 }]], ['T', [{ label: '새 경로 확인 상한', value: 2 }]]]);
  assert.deepEqual(model.outcomeReasons, [{ label: '경로 미검증', value: 2 }, { label: '시간 예산 초과', value: 1 }]);
  assert.doesNotMatch(JSON.stringify(model), /http|token|jwt|url|좌표|cache key|secret/i);
});

test('URECDIAG01-02: 빈 결과와 legacy 진단은 허위 tier·요청 0을 만들지 않는다', () => {
  const legacy = resultFixture({ verificationTiers: undefined, newProviderAttemptCount: undefined, adapterCallCount: undefined, cacheOrSessionReuseCount: undefined });
  legacy.representativeCourse = null;
  legacy.alternativeCourses = [];
  legacy.resultState = 'no_verified_course_within_limit';
  const model = recommendationInternalDiagnosticsModel(legacy, 0);
  assert.deepEqual(model.courseCounts, [{ label: '엔진 코스', value: 0 }, { label: '화면 코스', value: 0 }]);
  assert.deepEqual([model.requestCounts, model.tiers], [[], []]);
});

test('URECDIAG01-03: exact true만 internal panel을 허용하고 false·누락은 접근성 진단도 만들지 않는다', () => {
  assert.equal(recommendationDiagnosticsEnabled('true'), true);
  assert.equal(recommendationDiagnosticsEnabled('false'), false);
  assert.equal(recommendationDiagnosticsEnabled(undefined), false);
});
