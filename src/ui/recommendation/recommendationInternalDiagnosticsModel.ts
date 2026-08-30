import type { CourseV1LimitedResult, CourseV1OutcomeReason, CourseV1TierDiagnostics, CourseV1TierStopReason, CourseV1VerificationTier } from '../../engine';

export type RecommendationDiagnosticValue = { label: string; value: number };
export type RecommendationDiagnosticTier = { tier: CourseV1VerificationTier; values: RecommendationDiagnosticValue[]; stopReasons: RecommendationDiagnosticValue[] };
export type RecommendationInternalDiagnostics = {
  courseCounts: RecommendationDiagnosticValue[];
  candidateCounts: RecommendationDiagnosticValue[];
  requestCounts: RecommendationDiagnosticValue[];
  tiers: RecommendationDiagnosticTier[];
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
const value = (label: string, count: number | undefined): RecommendationDiagnosticValue => ({ label, value: Number.isInteger(count) && count! >= 0 ? count! : 0 });

function tierDiagnostics(tier: CourseV1VerificationTier, diagnostics: CourseV1TierDiagnostics): RecommendationDiagnosticTier {
  const stopCounts = diagnostics.stopReasons.reduce<Partial<Record<CourseV1TierStopReason, number>>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {});
  return {
    tier,
    values: [value('후보', diagnostics.candidateCount), value('시도', diagnostics.attemptedCourseCount), value('검증', diagnostics.verifiedCourseCount), value('새 경로 확인', diagnostics.newProviderAttemptCount)],
    stopReasons: (Object.keys(stopLabels) as CourseV1TierStopReason[]).flatMap((reason) => stopCounts[reason] ? [value(stopLabels[reason], stopCounts[reason])] : []),
  };
}

/** Internal-only, provider-free projection. It intentionally accepts neither routes, errors nor place metadata. */
export function recommendationInternalDiagnosticsModel(result: CourseV1LimitedResult, renderedCourseCount: number): RecommendationInternalDiagnostics {
  const diagnostics = result.diagnostics;
  const engineCourseCount = (result.representativeCourse ? 1 : 0) + result.alternativeCourses.length;
  const verificationTiers = diagnostics.verificationTiers;
  return {
    courseCounts: [value('엔진 코스', engineCourseCount), value('화면 코스', renderedCourseCount)],
    candidateCounts: [value('원천 후보', diagnostics.providerCandidateCount), value('조건 통과 후보', diagnostics.preselectionCandidateCount), value('공간 후보', diagnostics.candidatePoolCount), value('사전 제외', diagnostics.classificationExcluded)],
    requestCounts: verificationTiers ? [value('새 경로 확인', diagnostics.newProviderAttemptCount), value('adapter 호출', diagnostics.adapterCallCount), value('재사용', diagnostics.cacheOrSessionReuseCount)] : [],
    tiers: verificationTiers ? tiers.map((tier) => tierDiagnostics(tier, verificationTiers[tier])) : [],
    outcomeReasons: (Object.keys(outcomeLabels) as CourseV1OutcomeReason[]).flatMap((reason) => diagnostics.outcomeReasonCounts?.[reason] ? [value(outcomeLabels[reason], diagnostics.outcomeReasonCounts[reason])] : []),
  };
}

/** Public Expo configuration is permitted only as an exact internal-build switch. */
export function recommendationDiagnosticsEnabled(value: string | undefined): boolean {
  return value === 'true';
}
