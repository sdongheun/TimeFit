import type { CourseV1LimitedResult, CourseV1OutcomeReason, CourseV1ReleaseOneStopResult, CourseV1RouteUnavailableReason, CourseV1ShapeDiagnostics, CourseV1TierDiagnostics, CourseV1TierStopReason, CourseV1VerificationTier } from '../../engine';

export type RecommendationDiagnosticValue = { label: string; value: number };
export type RecommendationDiagnosticTier = { tier: CourseV1VerificationTier; values: RecommendationDiagnosticValue[]; stopReasons: RecommendationDiagnosticValue[] };
export type RecommendationDiagnosticShape = { shape: 1 | 2 | 3; values: RecommendationDiagnosticValue[]; unavailableReasons: RecommendationDiagnosticValue[] };
export type RecommendationInternalDiagnostics = {
  courseCounts: RecommendationDiagnosticValue[];
  candidateCounts: RecommendationDiagnosticValue[];
  requestCounts: RecommendationDiagnosticValue[];
  tiers: RecommendationDiagnosticTier[];
  shapes: RecommendationDiagnosticShape[];
  outcomeReasons: RecommendationDiagnosticValue[];
};

const outcomeLabels: Record<CourseV1OutcomeReason, string> = {
  route_not_verified: '경로 미검증',
  route_verification_unavailable: '경로 확인 불가',
  time_budget_exceeded: '시간 예산 초과',
  no_eligible_candidates: '조건 통과 후보 없음',
  no_open_candidates: '운영 중 후보 없음',
  no_distinct_verified_alternative: '독립 검증 대안 없음',
};

const stopLabels: Record<CourseV1TierStopReason, string> = {
  provider_attempt_limit: '새 경로 확인 상한',
  adapter_call_limit: 'adapter 호출 상한',
  verified_course_limit: '검증 코스 상한',
  gated_by_near_single_verification: 'N1 검증 대기',
  route_not_verified: '경로 미검증',
  route_verification_unavailable: '경로 확인 불가',
  time_budget_exceeded: '시간 예산 초과',
};

const tiers: readonly CourseV1VerificationTier[] = ['N1', 'N2', 'W', 'T'];
const shapes: readonly (1 | 2 | 3)[] = [1, 2, 3];
const unavailableReasons: readonly CourseV1RouteUnavailableReason[] = ['limited', 'in_flight', 'store', 'provider', 'transport', 'invalid_response', 'rejected', 'unknown'];
const unavailableReasonLabels: Record<CourseV1RouteUnavailableReason, string> = {
  limited: '제공사 한도',
  in_flight: '동일 경로 처리 중',
  store: '경로 저장소',
  provider: '경로 제공사',
  transport: '경로 통신',
  invalid_response: '경로 응답 형식',
  rejected: '경로 요청 거절',
  unknown: '안전상 원인 미확인',
};
const value = (label: string, count: number | undefined): RecommendationDiagnosticValue => ({ label, value: Number.isInteger(count) && count! >= 0 ? count! : 0 });

function tierDiagnostics(tier: CourseV1VerificationTier, diagnostics: CourseV1TierDiagnostics): RecommendationDiagnosticTier {
  const stopCounts = diagnostics.stopReasons.reduce<Partial<Record<CourseV1TierStopReason, number>>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});
  return {
    tier,
    values: [value('후보', diagnostics.candidateCount), value('시도', diagnostics.attemptedCourseCount), value('검증', diagnostics.verifiedCourseCount), value('새 경로 확인', diagnostics.newProviderAttemptCount)],
    stopReasons: (Object.keys(stopLabels) as CourseV1TierStopReason[]).flatMap((reason) => stopCounts[reason] ? [value(stopLabels[reason], stopCounts[reason])] : []),
  };
}

function shapeDiagnostics(shape: 1 | 2 | 3, diagnostics: CourseV1ShapeDiagnostics): RecommendationDiagnosticShape {
  const counts = diagnostics[shape];
  return {
    shape,
    values: [
      value('큐 후보', counts.queueCount),
      value('시도', counts.attemptedCourseCount),
      value('검증', counts.verifiedCourseCount),
      value('시간 예산 초과', counts.timeBudgetExceededCount),
      value('경로 미검증', counts.routeNotVerifiedCount),
      value('경로 확인 불가', counts.routeVerificationUnavailableCount),
    ],
    unavailableReasons: unavailableReasons.flatMap((reason) => {
      const count = counts.unavailableReasonCounts?.[reason];
      return Number.isInteger(count) && count! > 0 ? [value(unavailableReasonLabels[reason], count)] : [];
    }),
  };
}

/** Internal-only, provider-free projection. It intentionally accepts neither routes, errors nor place metadata. */
export function recommendationInternalDiagnosticsModel(result: CourseV1LimitedResult | CourseV1ReleaseOneStopResult, renderedCourseCount: number): RecommendationInternalDiagnostics {
  const diagnostics = result.diagnostics;
  const engineCourseCount = (result.representativeCourse ? 1 : 0) + result.alternativeCourses.length;
  const verificationTiers = diagnostics.verificationTiers;
  const shapeCounts = diagnostics.shapeDiagnostics;
  return {
    courseCounts: [value('엔진 코스', engineCourseCount), value('화면 코스', renderedCourseCount)],
    candidateCounts: [value('원천 후보', diagnostics.providerCandidateCount), value('조건 통과 후보', diagnostics.preselectionCandidateCount), value('공간 후보', diagnostics.candidatePoolCount), value('사전 제외', diagnostics.classificationExcluded)],
    requestCounts: verificationTiers || shapeCounts ? [value('새 경로 확인', diagnostics.newProviderAttemptCount), value('adapter 호출', diagnostics.adapterCallCount), value('재사용', diagnostics.cacheOrSessionReuseCount)] : [],
    tiers: verificationTiers ? tiers.map((tier) => tierDiagnostics(tier, verificationTiers[tier])) : [],
    shapes: shapeCounts ? shapes.map((shape) => shapeDiagnostics(shape, shapeCounts)) : [],
    outcomeReasons: (Object.keys(outcomeLabels) as CourseV1OutcomeReason[]).flatMap((reason) => diagnostics.outcomeReasonCounts?.[reason] ? [value(outcomeLabels[reason], diagnostics.outcomeReasonCounts[reason])] : []),
  };
}

/** Public Expo configuration is permitted only as an exact internal-build switch. */
export function recommendationDiagnosticsEnabled(value: string | undefined): boolean {
  return value === 'true';
}
