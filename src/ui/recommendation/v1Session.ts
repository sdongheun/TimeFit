import { buildConfirmedConditionalManualCourseV1, buildExplorationPageV1, buildLimitedRepresentativeCourseV1ForInternalB12, buildReleaseOneStopRepresentativeCourseV1, continueLimitedRepresentativeCourseV1, continueReleaseOneStopRepresentativeCourseV1, verifySelectedExplorationPlaceV1, type ConditionalManualCourseV1Result, type CourseV1Continuation, type CourseV1ContinuationResult, type CourseV1ExplorationPage, type CourseV1LimitedInput, type CourseV1LimitedResult, type CourseV1ReleaseOneStopContinuation, type CourseV1ReleaseOneStopContinuationResult, type CourseV1ReleaseOneStopResult, type CourseV1RouteAdapter, type CourseV1RouteReceiptAdapter, type ExplorationSelectionReason, type SelectedExplorationResult } from '../../engine';
import { createCourseV1CandidateProvider } from '../../data/courseV1CandidateProvider';
import { createCourseV1RouteAdapter } from '../../services/courseV1RouteAdapter';
import { createActivatedCourseV1RouteAdapter, RouteProxyUnavailableError } from '../../services/routeProxyActivatedCourseAdapter';
import type { RecommendationSession } from '../nav';
import { parseRecommendationNowIso } from './recommendationSessionTime';
import { recommendationInternalPolicyForEnvironment, type RecommendationPublicEnvironment } from './recommendationInternalBuildModel';
import type { RecommendationResult } from './releaseOneStopResultsModel';

export type RecommendationRuntimeOptions = {
  routeProxyEnabled: boolean;
  /** One request-stack token only. It is never copied into a navigation session or persisted UI state. */
  captchaToken?: string;
};

export type RecommendationRuntimeDependencies = {
  createLegacyRoutes: () => CourseV1RouteAdapter;
  /** API-4-A-ACT-04-B-R supplies this factory; UI owns only the boolean/token call boundary. */
  createActivatedProxyRoutes?: (input: { captchaToken?: string }) => Promise<CourseV1RouteAdapter & CourseV1RouteReceiptAdapter>;
  /** Test seam only: production reads the two public Expo values once at recommendation start. */
  getPublicRecommendationEnvironment?: () => RecommendationPublicEnvironment;
  buildRelease?: (input: CourseV1LimitedInput) => Promise<CourseV1ReleaseOneStopResult>;
  /** Legacy seam only; production/default must never select it. */
  buildA8?: (input: CourseV1LimitedInput) => Promise<CourseV1LimitedResult>;
  buildInternalB12?: (input: CourseV1LimitedInput) => Promise<CourseV1LimitedResult>;
  buildConditionalManual?: typeof buildConfirmedConditionalManualCourseV1;
  /** UI test seam; production always uses the accepted 2-V single page entry. */
  continueRelease?: typeof continueReleaseOneStopRepresentativeCourseV1;
};

const productionRecommendationRuntimeDependencies: RecommendationRuntimeDependencies = {
  createLegacyRoutes: createCourseV1RouteAdapter,
  createActivatedProxyRoutes: async ({ captchaToken }) => {
    // Proxy ports load only after its explicit gate succeeds; local/test legacy does not need public config.
    const { createSupabaseRouteProxyPorts } = await import('../../services/routeProxyProductionPorts');
    return createActivatedCourseV1RouteAdapter({ enabled: true, captchaToken, ...createSupabaseRouteProxyPorts() });
  },
};

// navigation payload에는 provider·route port를 넣지 않는다. 같은 화면 메모리에서만 이어보기를 재조립한다.
const continuationInputs = new WeakMap<RecommendationSession, CourseV1LimitedInput>();

export type RecommendationRuntimePorts = {
  routes: CourseV1RouteAdapter;
  /** Proxy enabled mode requires the exact same activated port for receipt-budget verification. */
  receiptRoutes?: CourseV1RouteReceiptAdapter;
};

export async function recommendationPortsFor(options: RecommendationRuntimeOptions, dependencies: RecommendationRuntimeDependencies): Promise<RecommendationRuntimePorts> {
  if (!options.routeProxyEnabled) return { routes: dependencies.createLegacyRoutes() };
  if (!dependencies.createActivatedProxyRoutes) throw new RouteProxyUnavailableError();
  try {
    const activatedRoutes = await dependencies.createActivatedProxyRoutes({ captchaToken: options.captchaToken });
    if (typeof activatedRoutes.getRouteReceipt !== 'function') throw new RouteProxyUnavailableError();
    return { routes: activatedRoutes, receiptRoutes: activatedRoutes };
  } catch (error) {
    if (error instanceof RouteProxyUnavailableError) throw error;
    throw new RouteProxyUnavailableError();
  }
}

/** Backward-compatible route-only boundary for callers that do not build engine input. */
export async function recommendationRoutesFor(options: RecommendationRuntimeOptions, dependencies: RecommendationRuntimeDependencies): Promise<CourseV1RouteAdapter> {
  return (await recommendationPortsFor(options, dependencies)).routes;
}

/** 직렬화된 navigation session을 엔진 호출 직전에만 Date로 복원한다. */
export function buildRecommendationEngineInput(session: RecommendationSession) {
  return { now: parseRecommendationNowIso(session.nowIso), origin: session.origin, destination: session.destination, remainingMin: session.remainingMin, arrivalBufferMin: session.arrivalBufferMin };
}

/** Activated proxy mode passes one shared route/receipt port; legacy mode deliberately remains route-only. */
export async function buildRecommendationLimitedInput(
  session: RecommendationSession,
  options: RecommendationRuntimeOptions,
  dependencies: RecommendationRuntimeDependencies,
): Promise<CourseV1LimitedInput> {
  return { ...buildRecommendationEngineInput(session), provider: createCourseV1CandidateProvider(), ...await recommendationPortsFor(options, dependencies) };
}

/** Local exploration paging shares a recommendation snapshot but deliberately has no route port. */
export function buildRecommendationExplorationPage(
  session: RecommendationSession,
  result: RecommendationResult,
  cursor?: number,
): CourseV1ExplorationPage {
  const now = parseRecommendationNowIso(session.nowIso);
  return buildExplorationPageV1({
    now,
    origin: session.origin,
    destination: session.destination,
    remainingMin: session.remainingMin,
    arrivalBufferMin: session.arrivalBufferMin,
    candidates: createCourseV1CandidateProvider().listDiscoveryCandidates(now),
    excludedPlaceIds: result.representativeCourse?.placeIds,
    pageSize: 8,
    cursor,
  });
}

const explorationUnavailable = (): SelectedExplorationResult => ({
  state: 'rejected', reason: 'route_verification_unavailable', receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 },
});

/** Only an explicit card selection gets a receipt port and enters the engine's one-place verifier. */
export async function verifyRecommendationExplorationPlace(
  session: RecommendationSession,
  result: RecommendationResult,
  selectedPlaceId: string,
  options: RecommendationRuntimeOptions,
  dependencies: RecommendationRuntimeDependencies = productionRecommendationRuntimeDependencies,
): Promise<SelectedExplorationResult> {
  const now = parseRecommendationNowIso(session.nowIso);
  let ports: RecommendationRuntimePorts;
  try { ports = await recommendationPortsFor(options, dependencies); } catch { return explorationUnavailable(); }
  if (!ports.receiptRoutes) return explorationUnavailable();
  return verifySelectedExplorationPlaceV1({
    now,
    origin: session.origin,
    destination: session.destination,
    remainingMin: session.remainingMin,
    arrivalBufferMin: session.arrivalBufferMin,
    candidates: createCourseV1CandidateProvider().listDiscoveryCandidates(now),
    excludedPlaceIds: result.representativeCourse?.placeIds,
    selectedPlaceId,
    receiptRoutes: ports.receiptRoutes,
  });
}

export function explorationSelectionMessage(reason: ExplorationSelectionReason): string {
  switch (reason) {
    case 'time_budget_exceeded': return '시간이 부족해요.';
    case 'access_window_unavailable': return '접근 가능 시간을 확인하지 못했어요.';
    default: return '경로를 확인하지 못했어요.';
  }
}

function publicRecommendationEnvironment(dependencies: RecommendationRuntimeDependencies): RecommendationPublicEnvironment {
  return dependencies.getPublicRecommendationEnvironment?.() ?? {
    diagnostics: process.env.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS,
    internalB12: process.env.EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12,
  };
}

/** Selects one fixed engine entry before calculation; neither result rendering nor retries can alter it. */
export function recommendationBuilderForEnvironment(
  environment: RecommendationPublicEnvironment,
  dependencies: Pick<RecommendationRuntimeDependencies, 'buildRelease' | 'buildA8' | 'buildInternalB12'> = {},
): (input: CourseV1LimitedInput) => Promise<RecommendationResult> {
  return recommendationInternalPolicyForEnvironment(environment) === 'B12'
    ? dependencies.buildInternalB12 ?? buildLimitedRepresentativeCourseV1ForInternalB12
    : dependencies.buildRelease ?? buildReleaseOneStopRepresentativeCourseV1;
}

/** UI 컨테이너만 엔진 provider·실제 경로 adapter를 조립한다. 표시 화면은 result만 받는다. */
export async function runRecommendationSession(
  session: RecommendationSession,
  options: RecommendationRuntimeOptions = { routeProxyEnabled: false },
  dependencies: RecommendationRuntimeDependencies = productionRecommendationRuntimeDependencies,
): Promise<RecommendationResult> {
  const builder = recommendationBuilderForEnvironment(publicRecommendationEnvironment(dependencies), dependencies);
  const input = await buildRecommendationLimitedInput(session, options, dependencies);
  const result = await builder(input);
  continuationInputs.set(session, input);
  return result;
}

/** 결과 화면 메모리에 남은 동일 input만 continuation과 결합한다. 세션 재수화·저장은 허용하지 않는다. */
export async function continueRecommendationSession(
  session: RecommendationSession,
  continuation: CourseV1Continuation,
): Promise<CourseV1ContinuationResult | null> {
  const originalInput = continuationInputs.get(session);
  if (!originalInput) return null;
  return continueLimitedRepresentativeCourseV1({ ...originalInput, continuation });
}

/** 출시 Results의 명시 tap만 같은 메모리 input과 single continuation을 결합한다. */
export async function continueReleaseRecommendationSession(
  session: RecommendationSession,
  continuation: CourseV1ReleaseOneStopContinuation,
  dependencies: Pick<RecommendationRuntimeDependencies, 'continueRelease'> = {},
): Promise<CourseV1ReleaseOneStopContinuationResult | null> {
  const originalInput = continuationInputs.get(session);
  if (!originalInput) return null;
  return (dependencies.continueRelease ?? continueReleaseOneStopRepresentativeCourseV1)({ ...originalInput, continuation });
}

export type ConditionalManualUiResult = ConditionalManualCourseV1Result | Readonly<{
  state: 'unavailable';
  receipt: { adapterCallCount: 0; newProviderAttemptCount: 0; cacheOrSessionReuseCount: 0 };
}>;

/** CTA의 실제 시각만 사용한다. 최초 추천 시각은 예산 차감의 기준일 뿐 now로 재사용하지 않는다. */
export async function requestConditionalManualCourse(
  session: RecommendationSession,
  selectedPlaceId: string,
  confirmedAt: Date,
  dependencies: Pick<RecommendationRuntimeDependencies, 'buildConditionalManual'> = {},
): Promise<ConditionalManualUiResult> {
  const originalInput = continuationInputs.get(session);
  if (!originalInput?.receiptRoutes) return { state: 'unavailable', receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } };
  const elapsedMin = Math.max(0, Math.ceil((confirmedAt.getTime() - parseRecommendationNowIso(session.nowIso).getTime()) / 60_000));
  return (dependencies.buildConditionalManual ?? buildConfirmedConditionalManualCourseV1)({
    now: confirmedAt,
    origin: originalInput.origin,
    destination: originalInput.destination,
    remainingMin: session.remainingMin - elapsedMin,
    arrivalBufferMin: session.arrivalBufferMin,
    conditionalCandidates: createCourseV1CandidateProvider().listConditionalVisitCandidates(confirmedAt),
    selectedPlaceId,
    userConfirmedHours: true,
    receiptRoutes: originalInput.receiptRoutes,
  });
}
