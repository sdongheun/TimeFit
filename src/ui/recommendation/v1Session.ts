import { buildConfirmedConditionalManualCourseV1, buildExplorationPageV1, buildLimitedRepresentativeCourseV1ForInternalB12, buildReleaseOneStopRepresentativeCourseV1, continueLimitedRepresentativeCourseV1, continueReleaseOneStopRepresentativeCourseV1, verifySelectedExplorationPlaceV1, type ConditionalManualCourseV1Result, type CourseV1Continuation, type CourseV1ContinuationResult, type CourseV1ExplorationPage, type CourseV1LimitedInput, type CourseV1LimitedResult, type CourseV1ReleaseOneStopContinuation, type CourseV1ReleaseOneStopContinuationResult, type CourseV1ReleaseOneStopResult, type CourseV1RouteAdapter, type CourseV1RouteReceiptAdapter, type ExplorationSelectionReason, type ReleaseTwoStopAttemptLedger, type ReleaseTwoStopSelectionResult, type ReleaseTwoStopSessionToken, type ReleaseTwoStopVerifiedPairSeed, type SelectedExplorationResult, type VerifiedCourseV1 } from '../../engine';
import { createCourseV1CandidateProvider } from '../../data/courseV1CandidateProvider';
import { createCourseV1RouteAdapter } from '../../services/courseV1RouteAdapter';
import { createActivatedCourseV1RouteAdapter, RouteProxyUnavailableError } from '../../services/routeProxyActivatedCourseAdapter';
import type { RecommendationSession } from '../nav';
import { parseRecommendationNowIso } from './recommendationSessionTime';
import { recommendationInternalPolicyForEnvironment, type RecommendationPublicEnvironment } from './recommendationInternalBuildModel';
import { releaseOneStopDisplayResult, type RecommendationResult } from './releaseOneStopResultsModel';
import { createTwoStopSelectionEnginePort } from './twoStopSelectionEnginePort';
import type { TwoStopSelectionPort } from './twoStopSelectionModel';
import type { RecommendationProgressStage } from './recommendationLoadingModel';

export type RecommendationRuntimeOptions = {
  routeProxyEnabled: boolean;
  /** One request-stack token only. It is never copied into a navigation session or persisted UI state. */
  captchaToken?: string;
  /** 화면 보조 진행 표시 전용. 저장·navigation·engine input에는 포함하지 않는다. */
  onProgress?: (stage: RecommendationProgressStage) => void;
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
type PairSelectionIntent = Readonly<{ course: VerifiedCourseV1 }>;
type RecommendationSessionRuntime = {
  input: CourseV1LimitedInput;
  ledger: ReleaseTwoStopAttemptLedger;
  twoStopPort: TwoStopSelectionPort | null;
  pairIntent: PairSelectionIntent | null;
  eligibleOneStopCourses: Map<string, VerifiedCourseV1>;
  pairSessionToken: ReleaseTwoStopSessionToken;
  verifiedPairSeeds: Map<string, ReleaseTwoStopVerifiedPairSeed>;
  operationTail: Promise<void>;
  operationCount: number;
};

const continuationInputs = new WeakMap<RecommendationSession, CourseV1LimitedInput>();
const sessionRuntimes = new WeakMap<RecommendationSession, RecommendationSessionRuntime>();

export type ReleaseOneStopUiContinuationResult = CourseV1ReleaseOneStopContinuationResult | Readonly<{
  appendedCourses: readonly VerifiedCourseV1[];
  continuation: CourseV1ReleaseOneStopContinuation;
  pageState: 'shared_attempt_limit';
  outcomeReasons: readonly [];
  diagnostics: Readonly<{ newProviderAttemptCount: 0 }>;
}>;

function initialAttemptCount(result: RecommendationResult): number {
  const value = result.diagnostics.newProviderAttemptCount;
  return Number.isInteger(value) && value! >= 0 && value! <= 8 ? value! : 8;
}

function commitLedger(runtime: RecommendationSessionRuntime, next: ReleaseTwoStopAttemptLedger): void {
  const initialOneStopAttempts = runtime.ledger.initialOneStopAttempts;
  const automaticTwoStopAttempts = Math.min(16, Math.max(runtime.ledger.automaticTwoStopAttempts, next.automaticTwoStopAttempts));
  const sharedExpansionAttempts = Math.min(12, Math.max(runtime.ledger.sharedExpansionAttempts, next.sharedExpansionAttempts));
  runtime.ledger = {
    version: 1,
    initialOneStopAttempts,
    automaticTwoStopAttempts,
    sharedExpansionAttempts,
    totalNewProviderAttempts: initialOneStopAttempts + automaticTwoStopAttempts + sharedExpansionAttempts,
  };
}

function runSessionOperation<T>(runtime: RecommendationSessionRuntime, operation: () => Promise<T>): Promise<T> {
  runtime.operationCount += 1;
  const task = runtime.operationTail.then(operation, operation);
  runtime.operationTail = task.then(() => undefined, () => undefined);
  return task.finally(() => { runtime.operationCount = Math.max(0, runtime.operationCount - 1); });
}

/** 표시 완료 one-stop과 완료 exact pair를 A별 최초 begin에 동결해 같은 branch 요청에 재사용한다. */
export function createFrozenTwoStopSeedPort(
  port: TwoStopSelectionPort,
  getDisplayedOneStopCourses: () => readonly VerifiedCourseV1[],
  getVerifiedPairSeeds: () => readonly ReleaseTwoStopVerifiedPairSeed[] = () => [],
  recommendationSessionToken?: ReleaseTwoStopSessionToken,
): TwoStopSelectionPort {
  const seedByFirstPlace = new Map<string, Readonly<{
    oneStopCourses: readonly VerifiedCourseV1[];
    pairCourses: readonly ReleaseTwoStopVerifiedPairSeed[];
  }>>();
  const frozenSeed = (firstCourse: VerifiedCourseV1) => {
    const firstPlaceId = firstCourse.placeIds.length === 1 ? firstCourse.placeIds[0] : '';
    const existing = seedByFirstPlace.get(firstPlaceId);
    if (existing) return existing;
    const seed = Object.freeze({
      oneStopCourses: Object.freeze(getDisplayedOneStopCourses().filter((course) => course.placeIds.length === 1).slice()),
      pairCourses: Object.freeze(getVerifiedPairSeeds().filter(({ course }) => course.placeIds.includes(firstPlaceId)).slice()),
    });
    if (firstPlaceId) seedByFirstPlace.set(firstPlaceId, seed);
    return seed;
  };
  return {
    begin: (request) => {
      const seed = frozenSeed(request.firstCourse);
      return port.begin({ ...request, verifiedOneStopCourses: seed.oneStopCourses, recommendationSessionToken, verifiedPairCourses: seed.pairCourses });
    },
    continue: (request) => {
      const seed = frozenSeed(request.firstCourse);
      return port.continue({ ...request, verifiedOneStopCourses: seed.oneStopCourses, recommendationSessionToken, verifiedPairCourses: seed.pairCourses });
    },
  };
}

function exactPairKey(course: VerifiedCourseV1): string | null {
  if (course.placeIds.length !== 2 || new Set(course.placeIds).size !== 2) return null;
  return [...course.placeIds].sort().join('\u0000');
}

function commitVerifiedPairResult(runtime: RecommendationSessionRuntime, result: ReleaseTwoStopSelectionResult): void {
  for (const course of result.courses) {
    const key = exactPairKey(course);
    if (!key || runtime.verifiedPairSeeds.has(key)) continue;
    runtime.verifiedPairSeeds.set(key, Object.freeze({
      course,
      recommendationSessionToken: runtime.pairSessionToken,
      inputSignature: result.continuation.inputSignature,
      providerSignature: result.continuation.providerSignature,
    }));
  }
}

function createSessionRuntime(input: CourseV1LimitedInput, result: RecommendationResult, pairEnabled: boolean): RecommendationSessionRuntime {
  const initialOneStopAttempts = initialAttemptCount(result);
  const displayed = releaseOneStopDisplayResult(result);
  const runtime: RecommendationSessionRuntime = {
    input,
    ledger: { version: 1, initialOneStopAttempts, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: initialOneStopAttempts },
    twoStopPort: null,
    pairIntent: null,
    eligibleOneStopCourses: new Map(
      [displayed.representativeCourse, ...displayed.alternativeCourses]
        .filter((course): course is VerifiedCourseV1 => course?.placeIds.length === 1)
        .map((course) => [course.id, course]),
    ),
    pairSessionToken: {},
    verifiedPairSeeds: new Map(),
    operationTail: Promise.resolve(),
    operationCount: 0,
  };
  if (pairEnabled && input.receiptRoutes) {
    const enginePort = createTwoStopSelectionEnginePort({
      ...input,
      receiptRoutes: input.receiptRoutes,
      ledger: runtime.ledger,
      ledgerStore: { read: () => runtime.ledger, commit: (next) => commitLedger(runtime, next) },
      onCompletedExact: (completed) => commitVerifiedPairResult(runtime, completed),
    });
    const seededPort = createFrozenTwoStopSeedPort(
      enginePort,
      () => [...runtime.eligibleOneStopCourses.values()],
      () => [...runtime.verifiedPairSeeds.values()],
      runtime.pairSessionToken,
    );
    runtime.twoStopPort = {
      begin: (request) => runSessionOperation(runtime, () => seededPort.begin(request)),
      continue: (request) => runSessionOperation(runtime, () => seededPort.continue(request)),
    };
  }
  return runtime;
}

function registerDisplayedOneStopPage(runtime: RecommendationSessionRuntime, courses: readonly VerifiedCourseV1[]): void {
  const shownPlaceIds = new Set(
    [...runtime.eligibleOneStopCourses.values()].flatMap((course) => course.placeIds.length === 1 ? course.placeIds : []),
  );
  for (const course of courses.slice(0, 3)) {
    const placeId = course.placeIds.length === 1 ? course.placeIds[0] : undefined;
    if (!placeId || shownPlaceIds.has(placeId)) continue;
    shownPlaceIds.add(placeId);
    runtime.eligibleOneStopCourses.set(course.id, course);
  }
}

export function getTwoStopSelectionPort(session: RecommendationSession): TwoStopSelectionPort | null {
  return sessionRuntimes.get(session)?.twoStopPort ?? null;
}

export function getRecommendationSessionAttemptLedger(session: RecommendationSession): ReleaseTwoStopAttemptLedger | null {
  return sessionRuntimes.get(session)?.ledger ?? null;
}

export function isRecommendationSessionOperationInFlight(session: RecommendationSession): boolean {
  return (sessionRuntimes.get(session)?.operationCount ?? 0) > 0;
}

/** Secondary 렌더와 intent 기록이 동일한 exact Results snapshot 경계를 사용한다. */
export function canRecordTwoStopSelectionIntent(session: RecommendationSession, course: VerifiedCourseV1): boolean {
  const runtime = sessionRuntimes.get(session);
  if (!runtime?.twoStopPort) return false;
  return runtime.operationCount === 0 && runtime.eligibleOneStopCourses.get(course.id) === course;
}

export function recordTwoStopSelectionIntent(session: RecommendationSession, course: VerifiedCourseV1): boolean {
  const runtime = sessionRuntimes.get(session);
  if (!runtime || !canRecordTwoStopSelectionIntent(session, course)) return false;
  runtime.pairIntent = { course };
  return true;
}

export function consumeTwoStopSelectionIntent(session: RecommendationSession): VerifiedCourseV1 | null {
  const runtime = sessionRuntimes.get(session);
  const intent = runtime?.pairIntent ?? null;
  if (runtime) runtime.pairIntent = null;
  return intent?.course ?? null;
}

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
  const emitProgress = (stage: RecommendationProgressStage) => {
    try { options.onProgress?.(stage); } catch { /* 표시 callback은 추천 성공·실패 의미를 바꾸지 않는다. */ }
  };
  const environment = publicRecommendationEnvironment(dependencies);
  const internalPolicy = recommendationInternalPolicyForEnvironment(environment);
  const builder = recommendationBuilderForEnvironment(environment, dependencies);
  emitProgress('input_ready');
  const input = await buildRecommendationLimitedInput(session, options, dependencies);
  emitProgress('route_port_ready');
  emitProgress('verifying');
  const result = await builder(input);
  continuationInputs.set(session, input);
  sessionRuntimes.set(session, createSessionRuntime(input, result, internalPolicy !== 'B12'));
  emitProgress('complete');
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
): Promise<ReleaseOneStopUiContinuationResult | null> {
  const runtime = sessionRuntimes.get(session);
  const originalInput = runtime?.input ?? continuationInputs.get(session);
  if (!originalInput) return null;
  if (!runtime) return (dependencies.continueRelease ?? continueReleaseOneStopRepresentativeCourseV1)({ ...originalInput, continuation });
  return runSessionOperation(runtime, async () => {
    const remaining = Math.max(0, 12 - runtime.ledger.sharedExpansionAttempts);
    if (remaining === 0) {
      return { appendedCourses: [], continuation, pageState: 'shared_attempt_limit', outcomeReasons: [], diagnostics: { newProviderAttemptCount: 0 } };
    }
    const pageProviderAttemptLimit = Math.min(8, remaining) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    const page = await (dependencies.continueRelease ?? continueReleaseOneStopRepresentativeCourseV1)({ ...originalInput, continuation, pageProviderAttemptLimit });
    registerDisplayedOneStopPage(runtime, page.appendedCourses);
    const observed = page.diagnostics.newProviderAttemptCount;
    const added = Number.isInteger(observed) && observed! >= 0 && observed! <= pageProviderAttemptLimit ? observed! : pageProviderAttemptLimit;
    commitLedger(runtime, { ...runtime.ledger, sharedExpansionAttempts: runtime.ledger.sharedExpansionAttempts + added });
    return page;
  });
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
