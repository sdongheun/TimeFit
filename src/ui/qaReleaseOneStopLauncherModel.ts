import type { CourseV1OutcomeReason } from '../engine';
import type { RecommendationSession } from './nav';
import type { RecommendationResult } from './recommendation/releaseOneStopResultsModel';
import { captureRecommendationNowIso } from './recommendation/recommendationSessionTime';

export const QA_RELEASE_ONE_STOP_PREFIX = '[qa-release-one-stop]';

export type QaReleaseOneStopScenarioId = `SIM-ONE-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
type QaPoint = Readonly<{ id: string; label: string; lat: number; lon: number }>;
export type QaReleaseOneStopScenario = Readonly<{
  id: QaReleaseOneStopScenarioId;
  origin: QaPoint;
  destination: QaPoint | null;
  remainingMin: number;
  arrivalBufferMin: 10;
}>;

const point = (id: string, label: string, lat: number, lon: number): QaPoint => ({ id, label, lat, lon });
const SEOMYEON = point('qa-seomyeon-station', '서면역', 35.1578, 129.0594);

export const QA_RELEASE_ONE_STOP_SCENARIOS: readonly QaReleaseOneStopScenario[] = [
  { id: 'SIM-ONE-01', origin: SEOMYEON, destination: null, remainingMin: 45, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-02', origin: SEOMYEON, destination: null, remainingMin: 120, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-03', origin: point('qa-sasang-station', '사상역', 35.1622, 128.9848), destination: SEOMYEON, remainingMin: 90, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-04', origin: point('qa-busan-station', '부산역', 35.1152, 129.0422), destination: point('qa-nampo-station', '남포역', 35.0976, 129.0347), remainingMin: 120, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-05', origin: point('qa-gwangalli-beach', '광안리해수욕장', 35.1532, 129.1187), destination: null, remainingMin: 75, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-06', origin: point('qa-centumcity-station', '센텀시티역', 35.1691, 129.1305), destination: point('qa-haeundae-station', '해운대역', 35.1631, 129.1588), remainingMin: 120, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-07', origin: point('qa-dongnae-station', '동래역', 35.2057, 129.0785), destination: null, remainingMin: 60, arrivalBufferMin: 10 },
  { id: 'SIM-ONE-08', origin: point('qa-dadaepo-station', '다대포해수욕장역', 35.0484, 128.9658), destination: null, remainingMin: 120, arrivalBufferMin: 10 },
];

export function qaReleaseOneStopLauncherEnabled(dev: boolean, diagnostics: string | undefined): boolean {
  return dev === true && diagnostics === 'true';
}

export function buildQaReleaseOneStopSession(scenarioId: QaReleaseOneStopScenarioId, capturedAt: Date): RecommendationSession {
  const scenario = QA_RELEASE_ONE_STOP_SCENARIOS.find(({ id }) => id === scenarioId);
  if (!scenario) throw new Error('알 수 없는 QA 시나리오입니다.');
  return {
    nowIso: captureRecommendationNowIso(capturedAt, 15 * 60),
    origin: { ...scenario.origin },
    destination: scenario.destination ? { ...scenario.destination } : null,
    remainingMin: scenario.remainingMin,
    arrivalBufferMin: scenario.arrivalBufferMin,
  };
}

export function nextQaReleaseOneStopScenarioId(lastId: QaReleaseOneStopScenarioId | null): QaReleaseOneStopScenarioId | null {
  if (!lastId) return QA_RELEASE_ONE_STOP_SCENARIOS[0]?.id ?? null;
  const index = QA_RELEASE_ONE_STOP_SCENARIOS.findIndex(({ id }) => id === lastId);
  return index < 0 ? QA_RELEASE_ONE_STOP_SCENARIOS[0]?.id ?? null : QA_RELEASE_ONE_STOP_SCENARIOS[index + 1]?.id ?? null;
}

export type QaReleaseOneStopRunToken = Readonly<{ sequence: number; scenarioId: QaReleaseOneStopScenarioId }>;

/** UI state 반영 전 중복 tap과 취소 뒤 늦게 도착한 CAPTCHA/추천 응답을 함께 차단한다. */
export function createQaReleaseOneStopRunController() {
  let sequence = 0;
  let active: { token: QaReleaseOneStopRunToken; phase: 'selected' | 'running' } | null = null;
  let lastFinished: QaReleaseOneStopScenarioId | null = null;
  return {
    select(scenarioId: QaReleaseOneStopScenarioId): QaReleaseOneStopRunToken | null {
      if (active) return null;
      const token = { sequence: sequence += 1, scenarioId } as const;
      active = { token, phase: 'selected' };
      return token;
    },
    beginRecommendation(token: QaReleaseOneStopRunToken): boolean {
      if (active?.token.sequence !== token.sequence || active.phase !== 'selected') return false;
      active.phase = 'running';
      return true;
    },
    isCurrent(token: QaReleaseOneStopRunToken): boolean {
      return active?.token.sequence === token.sequence;
    },
    finish(token: QaReleaseOneStopRunToken): boolean {
      if (active?.token.sequence !== token.sequence || active.phase !== 'running') return false;
      lastFinished = token.scenarioId;
      active = null;
      return true;
    },
    cancel(token: QaReleaseOneStopRunToken): boolean {
      if (active?.token.sequence !== token.sequence) return false;
      active = null;
      return true;
    },
    isLocked: () => active !== null,
    lastFinishedScenarioId: () => lastFinished,
  };
}

const outcomeReasons: readonly CourseV1OutcomeReason[] = ['no_eligible_candidates', 'no_open_candidates', 'time_budget_exceeded', 'route_not_verified', 'route_verification_unavailable', 'no_distinct_verified_alternative'];
const safeFailures = new Set([
  'captcha_token_missing', 'anonymous_auth_failed', 'route_proxy_transport_failed', 'route_proxy_rejected',
  'route_proxy_limited', 'route_proxy_in_flight', 'route_proxy_unconfigured', 'route_proxy_store_unavailable',
  'route_proxy_provider_failed', 'route_proxy_invalid_response', 'recommendation_failed',
]);

const safeCount = (value: number | undefined) => Number.isInteger(value) && (value ?? -1) >= 0 ? value as number : 0;
const safeText = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 160);
  return !trimmed || /https?:\/\/|(?:token|jwt|api[_-]?key|user[_-]?id|supabase)|(?:3[3-9]|12[4-9])\.\d{3,}/i.test(trimmed) ? null : trimmed;
};
const safeFailure = (error: unknown): string => {
  if (!error || typeof error !== 'object' || !('reason' in error) || typeof error.reason !== 'string') return 'recommendation_failed';
  return safeFailures.has(error.reason) ? error.reason : 'recommendation_failed';
};

export type QaReleaseOneStopReceipt = Readonly<{
  scenarioId: QaReleaseOneStopScenarioId;
  status: 'verified' | 'empty' | 'failed';
  resultState: RecommendationResult['resultState'] | null;
  alternativeState: RecommendationResult['alternativeState'] | null;
  representative: Readonly<{ placeId: string | null; name: string | null }> | null;
  alternatives: readonly Readonly<{ placeId: string | null; name: string | null }>[];
  coursePlaceCounts: readonly number[];
  newProviderAttemptCount: number;
  adapterCallCount: number;
  cacheOrSessionReuseCount: number;
  rejectionCounts: Readonly<{ route: number; opening: number; budget: number; relationship: number; classification: number }>;
  outcomeReasonCounts: Partial<Record<CourseV1OutcomeReason, number>>;
  failure: string | null;
}>;

/** 허용 목록의 집계·장소 식별 정보만 새 객체로 투영하며 입력 객체의 나머지 필드는 복사하지 않는다. */
export function buildQaReleaseOneStopReceipt(
  scenarioId: QaReleaseOneStopScenarioId,
  result: RecommendationResult | null,
  resolvePlaceName: ((placeId: string) => string | null | undefined) | undefined = undefined,
  error?: unknown,
): QaReleaseOneStopReceipt {
  if (!result) return { scenarioId, status: 'failed', resultState: null, alternativeState: null, representative: null, alternatives: [], coursePlaceCounts: [], newProviderAttemptCount: 0, adapterCallCount: 0, cacheOrSessionReuseCount: 0, rejectionCounts: { route: 0, opening: 0, budget: 0, relationship: 0, classification: 0 }, outcomeReasonCounts: {}, failure: safeFailure(error) };
  const courses = [...(result.representativeCourse ? [result.representativeCourse] : []), ...result.alternativeCourses];
  const place = (placeId: string | undefined) => placeId ? { placeId: safeText(placeId), name: safeText(resolvePlaceName?.(placeId)) } : null;
  const counts = outcomeReasons.reduce<Partial<Record<CourseV1OutcomeReason, number>>>((values, reason) => {
    const count = result.diagnostics.outcomeReasonCounts?.[reason];
    return Number.isInteger(count) && (count ?? 0) > 0 ? { ...values, [reason]: count } : values;
  }, {});
  return {
    scenarioId,
    status: result.representativeCourse ? 'verified' : 'empty',
    resultState: result.resultState,
    alternativeState: result.alternativeState,
    representative: place(result.representativeCourse?.placeIds[0]),
    alternatives: result.alternativeCourses.map((course) => place(course.placeIds[0])).filter((value): value is NonNullable<typeof value> => value !== null),
    coursePlaceCounts: courses.map((course) => course.placeIds.length),
    newProviderAttemptCount: safeCount(result.diagnostics.newProviderAttemptCount),
    adapterCallCount: safeCount(result.diagnostics.adapterCallCount),
    cacheOrSessionReuseCount: safeCount(result.diagnostics.cacheOrSessionReuseCount),
    rejectionCounts: {
      route: safeCount(result.diagnostics.routeRejected),
      opening: safeCount(result.diagnostics.openingRejected),
      budget: safeCount(result.diagnostics.budgetRejected),
      relationship: safeCount(result.diagnostics.relationshipRejected),
      classification: safeCount(result.diagnostics.classificationExcluded),
    },
    outcomeReasonCounts: counts,
    failure: null,
  };
}

export function qaReleaseOneStopReceiptLine(dev: boolean, diagnostics: string | undefined, receipt: QaReleaseOneStopReceipt): string | null {
  return qaReleaseOneStopLauncherEnabled(dev, diagnostics) ? `${QA_RELEASE_ONE_STOP_PREFIX} ${JSON.stringify(receipt)}` : null;
}
