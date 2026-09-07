/**
 * 현행 대표 코스 v1의 순수 조립 경계.
 *
 * 기존 planner.ts의 장바구니·근사 배치 계약과 분리한다. 호출자는 이미 좁힌
 * 후보와 실제 경로/구조화 운영시간 adapter를 주입하며, 이 모듈은 대표 1개와
 * 검증된 대안 식별자만 결정적으로 반환한다.
 */

import {
  deriveDwellPersonalizationV1,
  type DwellPersonalizationSampleV1,
} from './dwellPersonalization';

export type CourseV1Point = { id: string; lat: number; lon: number };
export type CourseV1Classification = 'representative_core' | 'representative_standard' | 'conditional_more' | 'hold';
export type CourseV1DayType = 'weekday' | 'weekend';
export type CourseV1TravelMode = 'walk' | 'transit';

export type StructuredAvailability = {
  status: 'structured' | 'needs_review';
  alwaysAccessible: boolean;
  dayTypes: CourseV1DayType[];
  windows: ReadonlyArray<{ startMin: number; endMin: number }>;
};

export type CourseV1Candidate = CourseV1Point & {
  title: string;
  /** 2-AB 복합 키. 누락 시 추정하지 않고 기본 체류를 쓴다. */
  category?: string;
  subCategory?: string;
  classification: CourseV1Classification;
  minStayMin: number;
  recommendedStayMin: number;
  /** DATA-DWELL-01 전환 전 누락값은 자동 추천에서 fail-closed로 제외한다. */
  maxStayMin?: number;
  availability: StructuredAvailability;
  siteGroupId?: string;
  /** DATA-MARKET-01의 사용자 확인 전용 표식. 대표/자동 큐에서는 사용하지 않는다. */
  conditionalVisit?: Readonly<{
    kind: 'market_or_street';
    displayWindow: Readonly<{ start: '10:00'; end: '18:00' }>;
    requiresUserHoursConfirmation: true;
  }>;
};

/** DATA-AREA-01의 탐색 자격. conditional은 자동 탐색 결과에 절대 승격되지 않는다. */
export type DiscoveryEligibility = 'representative' | 'area_access' | 'conditional';
/** area_access의 접근 근거가 적용되는 장소 단위. facility는 area_access로 fail-closed한다. */
export type CourseV1DiscoveryPlaceKind = 'area' | 'outdoor' | 'facility';
export type CourseV1DiscoveryAccessWindow = Readonly<{
  kind: 'always' | 'scheduled';
  dayTypes: readonly CourseV1DayType[];
  windows: readonly { startMin: number; endMin: number }[];
}>;
export type CourseV1DiscoveryCandidate = CourseV1Candidate & Readonly<{
  discovery: Readonly<{
    eligibility: DiscoveryEligibility;
    /** area_access에는 area/outdoor가 필수이며 누락은 fail-closed한다. */
    placeKind?: CourseV1DiscoveryPlaceKind;
    accessEvidence?: Readonly<{ status: 'public_outdoor_access'; source: string; sourceId: string; checkedAt: string; sourceText: string }>;
    accessWindow?: CourseV1DiscoveryAccessWindow;
  }>;
}>;

/** route 계산 전 로컬 탐색 페이지 입력. pageSize는 UI 렌더 묶음일 뿐 엔진 후보 상한이 아니다. */
export type CourseV1ExplorationInput = Pick<CourseV1Input, 'now' | 'origin' | 'destination' | 'remainingMin' | 'arrivalBufferMin'> & {
  candidates: readonly CourseV1DiscoveryCandidate[];
  /** 이미 상단 대표 코스에 포함된 place ID. 탐색 목록/선택에서 다시 제안하지 않는다. */
  excludedPlaceIds?: readonly string[];
  pageSize?: number;
  cursor?: number;
};
export type ExplorationPlace = Readonly<{
  placeId: string;
  title: string;
  lat: number;
  lon: number;
  siteGroupId?: string;
  eligibility: 'representative' | 'area_access';
  minStayMin: number;
  recommendedStayMin: number;
  /** area_access에만 보존한다. 목록은 실제 도착 시각·경로 검증을 주장하지 않는다. */
  accessEvidence?: CourseV1DiscoveryCandidate['discovery']['accessEvidence'];
  accessWindow?: CourseV1DiscoveryAccessWindow;
}>;
export type CourseV1ExplorationPage = Readonly<{
  places: readonly ExplorationPlace[];
  nextCursor: number | null;
  eligiblePlaceCount: number;
}>;

export const EXPLORATION_SELECTION_ADAPTER_CALL_LIMIT = 2;
export const EXPLORATION_SELECTION_PROVIDER_ATTEMPT_LIMIT = 4;
export type ExplorationSelectionReason = 'exploration_place_not_eligible' | 'route_not_verified' | 'route_verification_unavailable' | 'time_budget_exceeded' | 'access_window_unavailable';
export type ExplorationSelectionReceipt = Readonly<{
  adapterCallCount: number;
  newProviderAttemptCount: number;
  cacheOrSessionReuseCount: number;
}>;
export type CourseV1SelectedExplorationInput = CourseV1ExplorationInput & {
  selectedPlaceId: string;
  receiptRoutes: CourseV1RouteReceiptAdapter;
};
export type SelectedExplorationResult =
  | Readonly<{ state: 'verified'; course: VerifiedCourseV1; receipt: ExplorationSelectionReceipt }>
  | Readonly<{ state: 'rejected'; reason: ExplorationSelectionReason; receipt: ExplorationSelectionReceipt }>;

/** 2-R: 사용자가 카카오맵에서 확인한 조건부 시장·거리 한 곳의 순수 계산 입력이다. */
export type ConditionalManualCourseV1Input = Readonly<{
  now: Date;
  origin: CourseV1Point;
  destination: CourseV1Point | null;
  remainingMin: number;
  arrivalBufferMin: number;
  conditionalCandidates: readonly CourseV1Candidate[];
  selectedPlaceId: string;
  userConfirmedHours: true;
  receiptRoutes: CourseV1RouteReceiptAdapter;
}>;
export type CourseV1RouteReceiptSummary = ExplorationSelectionReceipt;
export type ConditionalManualCourseV1Result =
  | Readonly<{ state: 'conditional_manual_course'; course: VerifiedCourseV1; hoursStatus: 'hours_confirmation_required_user_confirmed'; receipt: CourseV1RouteReceiptSummary }>
  | Readonly<{
    state: 'rejected';
    reason: 'conditional_confirmation_required' | 'conditional_candidate_not_eligible' | 'conditional_display_window_unavailable' | 'time_budget_exceeded' | 'route_not_verified' | 'route_verification_unavailable';
    receipt: CourseV1RouteReceiptSummary;
  }>;

export const COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT = 32;
export const COURSE_V1_ROUTE_GEOMETRY_POINT_LIMIT = 512;
export type CourseV1RouteGeometryPoint = Readonly<{ lat: number; lon: number }>;
export type CourseV1RouteGeometryPath = Readonly<{ points: readonly CourseV1RouteGeometryPoint[] }>;
/** provider와 무관한 WGS84 경로선 snapshot. 전체 point 수는 최대 512개다. */
export type CourseV1RouteGeometry = Readonly<{ paths: readonly CourseV1RouteGeometryPath[] }>;

export type ExactRoute = {
  mode: CourseV1TravelMode;
  min: number;
  exact: true;
  /** 손상되거나 없는 geometry는 exact 시간 판정과 무관하게 생략한다. */
  geometry?: CourseV1RouteGeometry;
};
export type CourseV1RouteAdapter = {
  /** null은 실패 또는 근사 폴백이다. 차량은 이 계약에 존재하지 않는다. */
  getRoute(from: CourseV1Point, to: CourseV1Point): Promise<ExactRoute | null>;
};

/** API-4-C가 engine에 전달하는 provider-neutral·비밀 없는 단일 구간 receipt. */
export type CourseV1RouteUnavailableReason = 'limited' | 'in_flight' | 'store' | 'provider' | 'transport' | 'invalid_response' | 'rejected' | 'unknown';
export type CourseV1RouteReceipt =
  | { result: 'exact'; route: ExactRoute; newProviderAttemptCount: 0 | 1 | 2; reused: boolean }
  | { result: 'no_route'; newProviderAttemptCount: 0 | 1 | 2; reused: boolean }
  | { result: 'unavailable'; reason?: CourseV1RouteUnavailableReason; newProviderAttemptCount: 0 | 1 | 2; reused: boolean };

/** 남은 attempt 안에서만 provider 요청을 시작하도록 adapter가 보장하는 2-J port. */
export type CourseV1RouteReceiptAdapter = {
  getRouteReceipt(
    from: CourseV1Point,
    to: CourseV1Point,
    budget: { maxNewProviderAttemptCount: 0 | 1 | 2 },
  ): Promise<CourseV1RouteReceipt>;
};

export type CourseV1Input = {
  now: Date;
  origin: CourseV1Point;
  destination: CourseV1Point | null;
  remainingMin: number;
  arrivalBufferMin: number;
  candidates: readonly CourseV1Candidate[];
  routes: CourseV1RouteAdapter;
  /** 로그인/DB 객체가 제거된 시간순 완료 표본 snapshot. */
  dwellPersonalizationSamples?: readonly DwellPersonalizationSampleV1[];
};

export type CourseV1Leg = {
  fromId: string;
  toId: string;
  mode: CourseV1TravelMode;
  min: number;
  /** 추천 검증에 사용한 동일 exact route의 선택적 WGS84 snapshot. */
  geometry?: CourseV1RouteGeometry;
};

/** 엔진이 구조화 운영시간과 권장 체류를 통과시킨 방문 스냅샷. */
export type CourseV1Stop = {
  placeId: string;
  stayMin: number;
  /** 실제 구간·운영시간 후 선택한 체류 상태. UI/저장은 재해석하지 않는다. */
  stayState?: 'recommended' | 'short';
  /** UI·저장은 카탈로그 운영시간을 다시 해석하지 않고 이 검증 상태를 사용한다. */
  availabilityState: 'structured_verified';
  /** 실제 정확 경로 후의 도착 시각(ISO 8601 UTC). */
  arrivalAt: string;
  /** 선택된 실제 체류 종료 시각(ISO 8601 UTC). */
  departureAt: string;
  /** 미적용 결과에는 없어 byte-equivalent 기본 snapshot을 유지한다. */
  dwellPersonalization?: Readonly<{
    targetStayMin: number;
    baselineStayMin: number;
    baselineStayState: 'recommended' | 'short';
  }>;
};

export type VerifiedCourseV1 = {
  id: string;
  placeIds: string[];
  /** placeIds와 같은 방문 순서이며, stayMin 합계는 course.stayMin과 같다. */
  stops: CourseV1Stop[];
  legs: CourseV1Leg[];
  stayMin: number;
  travelMin: number;
  totalMin: number;
  arrivalBufferMin: number;
  /**
   * 입력 종료 시각까지 남는 분. 새 엔진 출력에는 항상 존재한다.
   * 이전 저장/화면 fixture와의 역호환을 위해 타입에서만 선택값으로 둔다.
   */
  remainingAfterCourseMin?: number;
  /** @deprecated remainingAfterCourseMin과 같은 값. 기존 호출자 호환용이다. */
  remainingAfterArrivalBufferMin: number;
};

export type AlternativeState = 'alternatives_available' | 'no_alternative_verified_course' | 'no_candidates';

export type CourseV1Diagnostics = {
  inputCandidateCount: number;
  representativeCandidateCount: number;
  classificationExcluded: number;
  evaluatedByPlaceCount: Record<1 | 2 | 3, number>;
  routeRejected: number;
  openingRejected: number;
  budgetRejected: number;
  relationshipRejected: number;
  verifiedCourseCount: number;
};

export type CourseV1Result = {
  representativeCourse: VerifiedCourseV1 | null;
  alternativeCourseIds: string[];
  alternativeState: AlternativeState;
  diagnostics: CourseV1Diagnostics;
};

/** 정확 경로를 새로 확인할 수 있는 후보 코스 수의 현행 상한. */
export const COURSE_V1_EXACT_COURSE_LIMIT = 4;
/** 공간 사전선정이 보관하는 장소 수 상한. 18곳이면 1~3곳 순서 코스는 최대 5,220개다. */
export const COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT = 18;
/** 장소 풀에서 정확 경로 호출 전에 만들 수 있는 순서 코스 수의 상한. */
export const COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT =
  COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT
  + COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT * (COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT - 1)
  + COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT * (COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT - 1) * (COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT - 2);

/** data provider의 구현을 엔진에 끌어들이지 않는, 주입용 최소 계약이다. */
export type CourseV1RepresentativeCandidateProvider = {
  listRepresentativeCandidates(now: Date): readonly CourseV1Candidate[];
};

export type CourseV1LimitedInput = Omit<CourseV1Input, 'candidates'> & {
  provider: CourseV1RepresentativeCandidateProvider;
  /** API-4-C 연결 뒤에만 제공한다. 없으면 기존 4코스 호환 경로를 그대로 사용한다. */
  receiptRoutes?: CourseV1RouteReceiptAdapter;
};

/** 2-M 고정 fixture 전용이며 engine barrel·앱 입력 계약에 노출하지 않는다. */
type CourseV1ReceiptEvaluationPolicy = {
  providerAttemptLimit: 8 | 12 | 16;
  queueOrder: 'A' | 'B';
};

type CourseV1ReceiptEvaluationOptions = { receiptPolicy: CourseV1ReceiptEvaluationPolicy };

/** 화면·저장에는 전달하지 않는 사전선정 슬롯의 결정적 관찰값. */
export type CourseV1PreselectionSlots = {
  nearSingle: string | null;
  wideSingle: string | null;
  independentTwo: string | null;
  independentThree: string | null;
};

/** receipt 검증 대기열의 내부 우선순위. 화면·저장 payload에는 노출하지 않는다. */
export type CourseV1VerificationTier = 'N1' | 'N2' | 'W' | 'T';
export type CourseV1TierStopReason =
  | 'provider_attempt_limit'
  | 'adapter_call_limit'
  | 'verified_course_limit'
  | 'gated_by_near_single_verification'
  | 'route_not_verified'
  | 'route_verification_unavailable'
  | 'time_budget_exceeded';
export type CourseV1TierDiagnostics = {
  candidateCount: number;
  attemptedCourseCount: number;
  verifiedCourseCount: number;
  newProviderAttemptCount: number;
  stopReasons: CourseV1TierStopReason[];
};
/** 2-S: 카드 수가 아닌 검증 대기열 형태별 내부 관찰값. UI payload로 쓰지 않는다. */
export type CourseV1ShapeDiagnostics = Record<1 | 2 | 3, {
  queueCount: number;
  attemptedCourseCount: number;
  verifiedCourseCount: number;
  timeBudgetExceededCount: number;
  routeNotVerifiedCount: number;
  routeVerificationUnavailableCount: number;
  /** unavailable receipt의 safe reason 집계. API 원문·식별자·URL은 절대 보관하지 않는다. */
  unavailableReasonCounts?: Record<CourseV1RouteUnavailableReason, number>;
}>;

export type CourseV1LimitedDiagnostics = {
  providerCandidateCount: number;
  preselectionCandidateCount: number;
  candidatePoolCount: number;
  /** 근접 기본 풀 밖에서 1곳 검증을 위해 예약한 공간 관련 후보. */
  wideSingleCandidateId?: string;
  /** 새 엔진 결과에는 항상 있으나, 기존 UI/저장 fixture 호환을 위해 타입에서는 선택값이다. */
  preselectionSlots?: CourseV1PreselectionSlots;
  generatedOrderedCourseCount: number;
  preselectedCourseIds: string[];
  exactCourseAttemptCount: number;
  routeRejected: number;
  openingRejected: number;
  budgetRejected: number;
  relationshipRejected: number;
  classificationExcluded: number;
  outcomeReasonCounts?: Partial<Record<CourseV1OutcomeReason, number>>;
  newProviderAttemptCount?: number;
  adapterCallCount?: number;
  cacheOrSessionReuseCount?: number;
  /** 2-L receipt queue의 tier별 안전 관찰값. provider·URL·좌표·cache key는 포함하지 않는다. */
  verificationTiers?: Record<CourseV1VerificationTier, CourseV1TierDiagnostics>;
  shapeDiagnostics?: CourseV1ShapeDiagnostics;
};

export type CourseV1OutcomeReason =
  | 'no_eligible_candidates'
  | 'no_open_candidates'
  | 'time_budget_exceeded'
  | 'route_not_verified'
  | 'route_verification_unavailable'
  | 'no_distinct_verified_alternative';

export type CourseV1PreselectionInput = Pick<CourseV1Input, 'now' | 'origin' | 'destination' | 'remainingMin' | 'arrivalBufferMin' | 'candidates'>;
export type CourseV1PreselectionResult = {
  candidatePool: CourseV1Candidate[];
  candidateCourses: CourseV1Candidate[][];
  /** 2-J receipt 경로의 탈락 보충 대기열. 첫 항목들은 candidateCourses와 같은 포트폴리오다. */
  candidateQueue: CourseV1Candidate[][];
  /** 2-Q의 이어보기 전용 전체 검증 큐. 같은 장소 집합의 순서 변형은 한 번만 둔다. */
  continuationQueue: CourseV1Candidate[][];
  /** 근접 기본 풀 밖에서 1곳 검증을 위해 예약한 공간 관련 후보. */
  wideSingleCandidateId?: string;
  preselectionSlots: CourseV1PreselectionSlots;
  generatedOrderedCourseCount: number;
  eligibleCandidateCount: number;
  classificationExcluded: number;
};

export type CourseV1LimitedResult = {
  representativeCourse: VerifiedCourseV1 | null;
  alternativeCourses: VerifiedCourseV1[];
  /** 후보 자체가 없었던 경우와, 상한 내 정확 검증이 모두 실패한 경우를 구분한다. */
  resultState: 'verified' | 'no_representative_candidates' | 'no_verified_course_within_limit';
  alternativeState: 'alternatives_available' | 'no_alternative_verified_course' | 'no_candidates';
  /** 2-J receipt 경로에서만 채운다. 기존 호출자는 기존 resultState를 계속 쓴다. */
  outcomeReasons?: CourseV1OutcomeReason[];
  primaryOutcomeReason?: CourseV1OutcomeReason;
  /** receipt 검증 경로의 다음 페이지 참조값. route-only legacy 호출에는 만들 수 없다. */
  continuation?: CourseV1Continuation;
  diagnostics: CourseV1LimitedDiagnostics;
};

/** 2-U 출시 경로 전용: continuation·다장소 조립 없이 실제 검증된 1곳만 반환한다. */
export type CourseV1ReleaseOneStopResult = Readonly<{
  representativeCourse: VerifiedCourseV1 | null;
  alternativeCourses: readonly VerifiedCourseV1[];
  resultState: 'verified' | 'no_representative_candidates' | 'no_verified_course_within_limit';
  alternativeState: 'alternatives_available' | 'no_alternative_verified_course' | 'no_candidates';
  outcomeReasons?: readonly CourseV1OutcomeReason[];
  primaryOutcomeReason?: CourseV1OutcomeReason;
  /** 미검증 single 후보가 남을 때만 제공하는 2-V 클라이언트 메모리용 참조값. */
  continuation?: CourseV1ReleaseOneStopContinuation;
  diagnostics: CourseV1LimitedDiagnostics;
}>;

export type CourseV1ReleaseOneStopPageState = 'more_available' | 'exhausted' | 'provider_unavailable' | 'continuation_unavailable';
export type CourseV1ReleaseOneStopContinuationStopReason = Exclude<CourseV1ReleaseOneStopPageState, 'more_available'>;
/** 좌표·시각·runtime 객체 없이 single 후보 진행 상태만 직렬화한다. */
export type CourseV1ReleaseOneStopContinuation = Readonly<{
  version: 1;
  cursor: number;
  candidatePlaceIds: readonly string[];
  candidateSetSignature: string;
  attemptedCandidateIds: readonly string[];
  rejectedCandidateIds: readonly string[];
  verifiedCandidateIds: readonly string[];
  routeReceiptKeys: readonly string[];
  stopReason?: CourseV1ReleaseOneStopContinuationStopReason;
}>;
export type CourseV1ReleaseOneStopContinuationInput = CourseV1LimitedInput & {
  continuation: CourseV1ReleaseOneStopContinuation;
  /** 2-Y enabled session만 shared budget 잔여를 전달한다. 생략 시 기존 page 8회를 유지한다. */
  pageProviderAttemptLimit?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};
export type CourseV1ReleaseOneStopContinuationResult = Readonly<{
  appendedCourses: readonly VerifiedCourseV1[];
  continuation: CourseV1ReleaseOneStopContinuation;
  pageState: CourseV1ReleaseOneStopPageState;
  outcomeReasons: readonly CourseV1OutcomeReason[];
  diagnostics: CourseV1LimitedDiagnostics;
}>;

/** 2-Q: 좌표·사용자·provider 객체를 담지 않는 클라이언트 메모리용 큐 참조값. */
export type CourseV1ContinuationStopReason = 'candidate_queue_exhausted' | 'provider_daily_limit' | 'provider_unavailable' | 'continuation_unavailable';
export type CourseV1Continuation = Readonly<{
  version: 1;
  cursor: number;
  candidatePlaceIds: readonly string[];
  candidateSetSignature: string;
  attemptedCourseSignatures: readonly string[];
  rejectedCourseSignatures: readonly string[];
  verifiedCourseSignatures: readonly string[];
  routeReceiptKeys: readonly string[];
  stopReason?: CourseV1ContinuationStopReason;
}>;
export type CourseV1ContinuationInput = CourseV1LimitedInput & { continuation: CourseV1Continuation };
export type CourseV1ContinuationResult = Readonly<{
  appendedCourses: readonly VerifiedCourseV1[];
  continuation: CourseV1Continuation;
  pageState: 'more_available' | 'exhausted' | 'provider_unavailable' | 'continuation_unavailable';
  outcomeReasons: readonly CourseV1OutcomeReason[];
  diagnostics: CourseV1LimitedDiagnostics;
}>;

export const COURSE_V1_PROVIDER_ATTEMPT_LIMIT = 8;
export const COURSE_V1_ADAPTER_CALL_LIMIT = 24;
export const COURSE_V1_VERIFIED_COURSE_LIMIT = 9;

const DEFAULT_RECEIPT_EVALUATION_POLICY: CourseV1ReceiptEvaluationPolicy = {
  providerAttemptLimit: COURSE_V1_PROVIDER_ATTEMPT_LIMIT,
  queueOrder: 'A',
};

/** 2-N: 통합·결정이 수락한 internal build 전용 고정 정책이다. */
const INTERNAL_B12_RECEIPT_EVALUATION_POLICY: CourseV1ReceiptEvaluationPolicy = {
  providerAttemptLimit: 12,
  queueOrder: 'B',
};

const representative = new Set<CourseV1Classification>(['representative_core', 'representative_standard']);

export async function buildRepresentativeCourseV1(input: CourseV1Input): Promise<CourseV1Result> {
  validateInput(input);
  const diagnostics: CourseV1Diagnostics = {
    inputCandidateCount: input.candidates.length,
    representativeCandidateCount: 0,
    classificationExcluded: 0,
    evaluatedByPlaceCount: { 1: 0, 2: 0, 3: 0 },
    routeRejected: 0,
    openingRejected: 0,
    budgetRejected: 0,
    relationshipRejected: 0,
    verifiedCourseCount: 0,
  };
  const candidates = input.candidates
    .filter((candidate) => {
      const allowed = representative.has(candidate.classification) && hasValidStayRange(candidate);
      if (!allowed) diagnostics.classificationExcluded += 1;
      return allowed;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  diagnostics.representativeCandidateCount = candidates.length;

  if (!candidates.length) return noCourse('no_candidates', diagnostics);

  const target = input.destination ?? input.origin;
  const routeCache = new Map<string, ExactRoute | null>();
  const getRoute = async (from: CourseV1Point, to: CourseV1Point) => {
    const key = `${from.id}>${to.id}`;
    if (!routeCache.has(key)) routeCache.set(key, exactRouteOrNull(await input.routes.getRoute(from, to)));
    return routeCache.get(key) ?? null;
  };

  const verified: VerifiedCourseV1[] = [];
  for (const places of permutationsUpToThree(candidates)) {
    diagnostics.evaluatedByPlaceCount[places.length as 1 | 2 | 3] += 1;
    if (hasRelationshipConflict(places)) {
      diagnostics.relationshipRejected += 1;
      continue;
    }
    const course = await verifyCourse(places, input, target, getRoute);
    if (course.kind === 'verified') verified.push(course.course);
    else diagnostics[course.reason] += 1;
  }

  const unique = deduplicateCourses(verified);
  diagnostics.verifiedCourseCount = unique.length;
  if (!unique.length) return noCourse('no_candidates', diagnostics);

  // 동일한 시간 조건에서는 더 적은 장소·더 짧은 총 시간이 첫 체감에 더 이해하기 쉽다.
  unique.sort((a, b) => a.placeIds.length - b.placeIds.length || a.totalMin - b.totalMin || a.id.localeCompare(b.id));
  const [representativeCourse, ...alternatives] = unique;
  return {
    representativeCourse,
    alternativeCourseIds: alternatives.map((course) => course.id),
    alternativeState: alternatives.length ? 'alternatives_available' : 'no_alternative_verified_course',
    diagnostics,
  };
}

function exactRouteOrNull(route: ExactRoute | null): ExactRoute | null {
  if (!route || route.exact !== true) return null;
  if ((route.mode !== 'walk' && route.mode !== 'transit') || !Number.isInteger(route.min) || route.min <= 0) return null;
  const geometry = normalizedRouteGeometry(route.geometry);
  return { mode: route.mode, min: route.min, exact: true, ...(geometry ? { geometry } : {}) };
}

function normalizedRouteGeometry(value: unknown): CourseV1RouteGeometry | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const paths = (value as { paths?: unknown }).paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT) return undefined;
  let pointCount = 0;
  const normalizedPaths: CourseV1RouteGeometryPath[] = [];
  for (const path of paths) {
    if (!path || typeof path !== 'object') return undefined;
    const points = (path as { points?: unknown }).points;
    if (!Array.isArray(points) || points.length < 2) return undefined;
    const normalizedPoints: CourseV1RouteGeometryPoint[] = [];
    for (const point of points) {
      if (!point || typeof point !== 'object') return undefined;
      const { lat, lon } = point as { lat?: unknown; lon?: unknown };
      if (typeof lat !== 'number' || typeof lon !== 'number'
        || !Number.isFinite(lat) || !Number.isFinite(lon)
        || lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
      pointCount += 1;
      if (pointCount > COURSE_V1_ROUTE_GEOMETRY_POINT_LIMIT) return undefined;
      normalizedPoints.push({ lat, lon });
    }
    normalizedPaths.push({ points: normalizedPoints });
  }
  return { paths: normalizedPaths };
}

function courseV1Leg(fromId: string, toId: string, route: ExactRoute): CourseV1Leg {
  const geometry = normalizedRouteGeometry(route.geometry);
  return { fromId, toId, mode: route.mode, min: route.min, ...(geometry ? { geometry } : {}) };
}

/**
 * provider와 실제 경로 adapter를 연결하는 v1의 제한된 조립 경계.
 *
 * 근사 거리/시간은 여기서 결과나 성공 판정에 사용하지 않는다. 순수 사전선정은
 * 체류시간·분류·운영가능성으로만 최대 네 코스를 고르고, 그 네 코스만 실제 경로로 검증한다.
 */
export async function buildLimitedRepresentativeCourseV1(
  input: CourseV1LimitedInput,
): Promise<CourseV1LimitedResult> {
  return buildLimitedRepresentativeCourseV1WithEvaluation(input);
}

/**
 * 출시 자동 추천의 명시적 1곳 receipt 경계다. 기존 A8/B12와 달리 후보 간 leg,
 * continuation, 8→16 보충을 만들지 않는다. 각 후보는 endpoint→candidate→endpoint만
 * 실제 검증하며, 검증된 수가 하나여도 정상 결과다.
 */
export async function buildReleaseOneStopRepresentativeCourseV1(
  input: CourseV1LimitedInput,
): Promise<CourseV1ReleaseOneStopResult> {
  validateInput(input);
  const supplied = input.provider.listRepresentativeCandidates(input.now);
  const selection = selectReleaseOneStopCandidates({ ...input, candidates: supplied });
  const diagnostics = releaseOneStopDiagnostics(supplied.length, selection);
  const asRelease = (result: CourseV1LimitedResult): CourseV1ReleaseOneStopResult => ({
    representativeCourse: result.representativeCourse,
    alternativeCourses: result.alternativeCourses,
    resultState: result.resultState,
    alternativeState: result.alternativeState,
    ...(result.outcomeReasons ? { outcomeReasons: result.outcomeReasons } : {}),
    ...(result.primaryOutcomeReason ? { primaryOutcomeReason: result.primaryOutcomeReason } : {}),
    diagnostics: result.diagnostics,
  });
  if (!input.receiptRoutes || !selection.eligibleCandidateCount) {
    return asRelease(limitedNoCourse('no_representative_candidates', diagnostics));
  }
  const page = await verifyReleaseOneStopPage(input, selection, emptyReleaseOneStopContinuation(selection), 4, diagnostics);
  const continuation = page.pageState === 'more_available' ? page.continuation : undefined;
  if (!page.courses.length) {
    return {
      ...asRelease(receiptNoCourse(page.primaryReason, diagnostics, page.reasonCounts)),
      ...(continuation ? { continuation } : {}),
    };
  }
  const selected = [...page.courses].sort(compareRepresentativeCourses).slice(0, 4);
  const [representativeCourse, ...alternativeCourses] = selected;
  return {
    representativeCourse: representativeCourse!, alternativeCourses,
    resultState: 'verified', alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
    outcomeReasons: uniqueReasons(Object.keys(page.reasonCounts) as CourseV1OutcomeReason[]),
    ...(alternativeCourses.length ? {} : { primaryOutcomeReason: 'no_distinct_verified_alternative' }),
    ...(continuation ? { continuation } : {}),
    diagnostics,
  };
}

/**
 * 출시 one-stop 전용 순수 후보 선별기다. 기존 공간 정렬·그룹 중복 제거·18개 상한과
 * wide single 규칙만 공유하며, 다장소 순열·검증 큐·continuation은 만들지 않는다.
 */
type CourseV1ReleaseOneStopSelection = {
  candidatePool: CourseV1Candidate[];
  wideSingleCandidateId?: string;
  eligibleCandidateCount: number;
  classificationExcluded: number;
};

function selectReleaseOneStopCandidates(input: CourseV1PreselectionInput): CourseV1ReleaseOneStopSelection {
  let classificationExcluded = 0;
  const eligible = input.candidates.filter((candidate) => {
    const allowed = representative.has(candidate.classification)
      && canPossiblyOpen(candidate, input.now)
      && candidate.minStayMin >= 20;
    if (!allowed) classificationExcluded += 1;
    return allowed;
  });
  const target = input.destination ?? input.origin;
  const spatialSelection = selectSpatialCandidatePool(eligible, input.origin, target, input.destination === null);
  return {
    ...spatialSelection,
    eligibleCandidateCount: eligible.length,
    classificationExcluded,
  };
}

function releaseOneStopDiagnostics(
  providerCandidateCount: number,
  selection: CourseV1ReleaseOneStopSelection,
): CourseV1LimitedDiagnostics {
  return {
    providerCandidateCount,
    preselectionCandidateCount: selection.eligibleCandidateCount,
    candidatePoolCount: selection.candidatePool.length,
    ...(selection.wideSingleCandidateId ? { wideSingleCandidateId: selection.wideSingleCandidateId } : {}),
    generatedOrderedCourseCount: 0,
    preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0,
    budgetRejected: 0, relationshipRejected: 0, classificationExcluded: selection.classificationExcluded,
  };
}

function emptyReleaseOneStopContinuation(selection: CourseV1ReleaseOneStopSelection): CourseV1ReleaseOneStopContinuation {
  const candidatePlaceIds = selection.candidatePool.map((candidate) => candidate.id);
  return {
    version: 1, cursor: 0, candidatePlaceIds, candidateSetSignature: candidateSetSignature(candidatePlaceIds),
    attemptedCandidateIds: [], rejectedCandidateIds: [], verifiedCandidateIds: [], routeReceiptKeys: [],
  };
}

/** 2-V: 출시 single pool만 재수화하는 요청형 이어보기 entry다. */
export async function continueReleaseOneStopRepresentativeCourseV1(
  input: CourseV1ReleaseOneStopContinuationInput,
): Promise<CourseV1ReleaseOneStopContinuationResult> {
  validateInput(input);
  const supplied = input.provider.listRepresentativeCandidates(input.now);
  const selection = selectReleaseOneStopCandidates({ ...input, candidates: supplied });
  const diagnostics = releaseOneStopDiagnostics(supplied.length, selection);
  const unavailable = (): CourseV1ReleaseOneStopContinuationResult => ({
    appendedCourses: [],
    continuation: { ...input.continuation, stopReason: 'continuation_unavailable' },
    pageState: 'continuation_unavailable',
    outcomeReasons: ['route_verification_unavailable'], diagnostics,
  });
  if (!input.receiptRoutes || !isValidReleaseOneStopContinuation(input.continuation, selection)
    || (input.pageProviderAttemptLimit !== undefined
      && (!Number.isInteger(input.pageProviderAttemptLimit) || input.pageProviderAttemptLimit < 0 || input.pageProviderAttemptLimit > 8))) return unavailable();
  if (input.continuation.stopReason === 'provider_unavailable') {
    return { appendedCourses: [], continuation: input.continuation, pageState: 'provider_unavailable', outcomeReasons: ['route_verification_unavailable'], diagnostics };
  }
  if (input.continuation.stopReason === 'exhausted') {
    return { appendedCourses: [], continuation: input.continuation, pageState: 'exhausted', outcomeReasons: [], diagnostics };
  }
  if (input.continuation.stopReason === 'continuation_unavailable') return unavailable();
  const page = await verifyReleaseOneStopPage(input, selection, input.continuation, 3, diagnostics, input.pageProviderAttemptLimit);
  return {
    appendedCourses: page.courses,
    continuation: page.continuation,
    pageState: page.pageState,
    outcomeReasons: uniqueReasons(Object.keys(page.reasonCounts) as CourseV1OutcomeReason[]),
    diagnostics: page.diagnostics,
  };
}

function isValidReleaseOneStopContinuation(
  continuation: CourseV1ReleaseOneStopContinuation,
  selection: CourseV1ReleaseOneStopSelection,
): boolean {
  const expectedIds = selection.candidatePool.map((candidate) => candidate.id);
  if (continuation.version !== 1
    || !Array.isArray(continuation.candidatePlaceIds)
    || !Array.isArray(continuation.attemptedCandidateIds)
    || !Array.isArray(continuation.rejectedCandidateIds)
    || !Array.isArray(continuation.verifiedCandidateIds)
    || !Array.isArray(continuation.routeReceiptKeys)
    || !Number.isInteger(continuation.cursor) || continuation.cursor < 0 || continuation.cursor > expectedIds.length
    || expectedIds.length !== continuation.candidatePlaceIds.length
    || expectedIds.some((id, index) => id !== continuation.candidatePlaceIds[index])
    || candidateSetSignature(expectedIds) !== continuation.candidateSetSignature
    || (continuation.stopReason !== undefined
      && continuation.stopReason !== 'exhausted'
      && continuation.stopReason !== 'provider_unavailable'
      && continuation.stopReason !== 'continuation_unavailable')) return false;
  const known = new Set(expectedIds);
  const attempted = new Set(continuation.attemptedCandidateIds);
  const rejected = new Set(continuation.rejectedCandidateIds);
  const verified = new Set(continuation.verifiedCandidateIds);
  if (attempted.size !== continuation.attemptedCandidateIds.length
    || rejected.size !== continuation.rejectedCandidateIds.length
    || verified.size !== continuation.verifiedCandidateIds.length) return false;
  if ([...attempted, ...rejected, ...verified].some((id) => !known.has(id))) return false;
  if ([...rejected].some((id) => verified.has(id))) return false;
  if ([...rejected, ...verified].some((id) => !attempted.has(id))) return false;
  if ([...attempted].some((id) => !rejected.has(id) && !verified.has(id))) return false;
  return attempted.size === continuation.cursor
    && expectedIds.slice(0, continuation.cursor).every((id) => attempted.has(id));
}

type CourseV1ReleaseOneStopPage = {
  courses: VerifiedCourseV1[];
  continuation: CourseV1ReleaseOneStopContinuation;
  pageState: Exclude<CourseV1ReleaseOneStopPageState, 'continuation_unavailable'>;
  diagnostics: CourseV1LimitedDiagnostics;
  reasonCounts: Partial<Record<CourseV1OutcomeReason, number>>;
  primaryReason: CourseV1OutcomeReason;
};

async function verifyReleaseOneStopPage(
  input: CourseV1LimitedInput,
  selection: CourseV1ReleaseOneStopSelection,
  continuation: CourseV1ReleaseOneStopContinuation,
  targetCourseCount: 3 | 4,
  diagnostics: CourseV1LimitedDiagnostics,
  providerAttemptLimit: number = COURSE_V1_PROVIDER_ATTEMPT_LIMIT,
): Promise<CourseV1ReleaseOneStopPage> {
  const attempted = new Set(continuation.attemptedCandidateIds);
  const rejected = new Set(continuation.rejectedCandidateIds);
  const verified = new Set(continuation.verifiedCandidateIds);
  const receiptKeys = new Set(continuation.routeReceiptKeys);
  const courses: VerifiedCourseV1[] = [];
  const reasonCounts: Partial<Record<CourseV1OutcomeReason, number>> = {};
  let cursor = continuation.cursor;
  let providerAttempts = 0;
  let adapterCalls = 0;
  let reuseCount = 0;
  let localBudgetExhausted = false;
  let stopReason: CourseV1ReleaseOneStopContinuationStopReason | undefined;
  const receiptCache = new Map<string, Promise<CourseV1RouteReceipt>>();
  const getReceipt = async (from: CourseV1Point, to: CourseV1Point): Promise<CourseV1RouteReceipt> => {
    const key = `${from.id}>${to.id}`;
    const cached = receiptCache.get(key);
    if (cached) { reuseCount += 1; return cached; }
    if (providerAttempts >= providerAttemptLimit || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) {
      localBudgetExhausted = true;
      return { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false };
    }
    const budget = Math.min(2, providerAttemptLimit - providerAttempts) as 0 | 1 | 2;
    adapterCalls += 1;
    const receipt = input.receiptRoutes!.getRouteReceipt(from, to, { maxNewProviderAttemptCount: budget })
      .then((value) => normalizeReceipt(value, budget));
    receiptCache.set(key, receipt);
    receiptKeys.add(opaqueReceiptKey(key));
    const value = await receipt;
    providerAttempts += value.newProviderAttemptCount;
    if (value.reused) reuseCount += 1;
    return value;
  };
  while (cursor < selection.candidatePool.length && courses.length < targetCourseCount) {
    const candidate = selection.candidatePool[cursor]!;
    if (attempted.has(candidate.id)) { cursor += 1; continue; }
    if (candidate.id === input.origin.id || candidate.id === (input.destination ?? input.origin).id) {
      attempted.add(candidate.id); rejected.add(candidate.id); cursor += 1;
      continue;
    }
    if (providerAttempts >= providerAttemptLimit || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) break;
    localBudgetExhausted = false;
    diagnostics.exactCourseAttemptCount += 1;
    const outcome = await verifyCourseWithReceipts([candidate], input, input.destination ?? input.origin, getReceipt);
    if (outcome.kind === 'rejected' && outcome.reason === 'route_verification_unavailable' && localBudgetExhausted) break;
    attempted.add(candidate.id);
    cursor += 1;
    if (outcome.kind === 'verified') {
      verified.add(candidate.id);
      courses.push(outcome.course);
    } else {
      rejected.add(candidate.id);
      reasonCounts[outcome.reason] = (reasonCounts[outcome.reason] ?? 0) + 1;
      if (outcome.reason === 'route_verification_unavailable') {
        stopReason = 'provider_unavailable';
        break;
      }
    }
  }
  if (!stopReason && cursor >= selection.candidatePool.length) stopReason = 'exhausted';
  diagnostics.newProviderAttemptCount = providerAttempts;
  diagnostics.adapterCallCount = adapterCalls;
  diagnostics.cacheOrSessionReuseCount = reuseCount;
  diagnostics.preselectedCourseIds = [...attempted];
  diagnostics.outcomeReasonCounts = reasonCounts;
  const next: CourseV1ReleaseOneStopContinuation = {
    version: 1, cursor, candidatePlaceIds: continuation.candidatePlaceIds,
    candidateSetSignature: continuation.candidateSetSignature,
    attemptedCandidateIds: [...attempted], rejectedCandidateIds: [...rejected], verifiedCandidateIds: [...verified],
    routeReceiptKeys: [...receiptKeys], ...(stopReason ? { stopReason } : {}),
  };
  return {
    courses, continuation: next,
    pageState: stopReason === 'provider_unavailable' ? 'provider_unavailable' : stopReason === 'exhausted' ? 'exhausted' : 'more_available',
    diagnostics, reasonCounts,
    primaryReason: selectPrimaryReceiptReason(reasonCounts, localBudgetExhausted || stopReason === 'provider_unavailable'),
  };
}

/** 2-M 고정 matrix 전용이다. engine barrel·production 조립 경로에서 export하지 않는다. */
export async function buildLimitedRepresentativeCourseV1ForTestOnlyReceiptEvaluation(
  input: CourseV1LimitedInput,
  evaluationOptions: CourseV1ReceiptEvaluationOptions,
): Promise<CourseV1LimitedResult> {
  return buildLimitedRepresentativeCourseV1WithEvaluation(input, evaluationOptions);
}

async function buildLimitedRepresentativeCourseV1WithEvaluation(
  input: CourseV1LimitedInput,
  evaluationOptions?: CourseV1ReceiptEvaluationOptions,
): Promise<CourseV1LimitedResult> {
  validateInput(input);
  const supplied = input.provider.listRepresentativeCandidates(input.now);
  const diagnostics: CourseV1LimitedDiagnostics = {
    providerCandidateCount: supplied.length,
    preselectionCandidateCount: 0,
    candidatePoolCount: 0,
    preselectionSlots: emptyPreselectionSlots(),
    generatedOrderedCourseCount: 0,
    preselectedCourseIds: [],
    exactCourseAttemptCount: 0,
    routeRejected: 0,
    openingRejected: 0,
    budgetRejected: 0,
    relationshipRejected: 0,
    classificationExcluded: 0,
  };
  const preselection = preselectLimitedCourseV1({ ...input, candidates: supplied });
  diagnostics.preselectionCandidateCount = preselection.eligibleCandidateCount;
  diagnostics.candidatePoolCount = preselection.candidatePool.length;
  diagnostics.generatedOrderedCourseCount = preselection.generatedOrderedCourseCount;
  diagnostics.classificationExcluded = preselection.classificationExcluded;
  diagnostics.wideSingleCandidateId = preselection.wideSingleCandidateId;
  diagnostics.preselectionSlots = preselection.preselectionSlots;
  if (!preselection.eligibleCandidateCount) {
    if (input.receiptRoutes) return receiptNoCourse(
      supplied.some((candidate) => representative.has(candidate.classification)) ? 'no_open_candidates' : 'no_eligible_candidates', diagnostics,
    );
    return limitedNoCourse('no_representative_candidates', diagnostics);
  }

  if (input.receiptRoutes) {
    // 내부 B12 관찰 fixture는 기존 tier matrix를 유지한다. 공개 기본 entry는 2-Q
    // continuation 큐만 사용하며, runtime에서 정책 값을 주입받지 않는다.
    if (evaluationOptions?.receiptPolicy) return buildReceiptBudgetedRepresentativeCourseV1(input, preselection, diagnostics, evaluationOptions.receiptPolicy);
    return buildInitialContinuationCourseV1(input, preselection, diagnostics);
  }

  const candidates = preselection.candidatePool;
  const preselected = preselection.candidateCourses;
  diagnostics.preselectedCourseIds = preselected.map((places) => places.map((place) => place.id).join('|'));
  if (!preselected.length) return limitedNoCourse('no_representative_candidates', diagnostics);

  const target = input.destination ?? input.origin;
  const verificationInput: CourseV1Input = {
    now: input.now,
    origin: input.origin,
    destination: input.destination,
    remainingMin: input.remainingMin,
    arrivalBufferMin: input.arrivalBufferMin,
    candidates,
    routes: input.routes,
  };
  const routeCache = new Map<string, ExactRoute | null>();
  const getRoute = async (from: CourseV1Point, to: CourseV1Point) => {
    const key = `${from.id}>${to.id}`;
    if (!routeCache.has(key)) routeCache.set(key, exactRouteOrNull(await input.routes.getRoute(from, to)));
    return routeCache.get(key) ?? null;
  };
  const verified: VerifiedCourseV1[] = [];
  for (const places of preselected) {
    diagnostics.exactCourseAttemptCount += 1;
    const course = await verifyCourse(places, verificationInput, target, getRoute);
    if (course.kind === 'verified') verified.push(course.course);
    else diagnostics[course.reason] += 1;
  }
  const unique = deduplicateCourses(verified);
  if (!unique.length) return limitedNoCourse('no_verified_course_within_limit', diagnostics);

  const [representativeCourse, ...alternativeCourses] = selectRepresentativeCourseSetV1(unique);
  return {
    representativeCourse,
    alternativeCourses,
    resultState: 'verified',
    alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
    diagnostics,
  };
}

/**
 * internal diagnostics build에서만 쓰는 고정 B12 receipt 진입점이다.
 * 정책 객체·상한·queue 순서를 호출자에게 받지 않으며 production 기본 entry의 A8을 바꾸지 않는다.
 */
export async function buildLimitedRepresentativeCourseV1ForInternalB12(
  input: CourseV1LimitedInput,
): Promise<CourseV1LimitedResult> {
  return buildLimitedRepresentativeCourseV1WithEvaluation(input, {
    receiptPolicy: INTERNAL_B12_RECEIPT_EVALUATION_POLICY,
  });
}

async function buildInitialContinuationCourseV1(
  input: CourseV1LimitedInput,
  preselection: CourseV1PreselectionResult,
  diagnostics: CourseV1LimitedDiagnostics,
): Promise<CourseV1LimitedResult> {
  const base = emptyContinuation(preselection);
  const first = await verifyContinuationPage(input, preselection, base, 4, 8, 16, diagnostics);
  const selected = selectContinuationCourseSet(first.courses).slice(0, 4);
  const [representativeCourse, ...alternativeCourses] = selected;
  if (!representativeCourse) {
    return {
      ...receiptNoCourse(first.primaryReason, first.diagnostics, first.reasonCounts),
      continuation: first.continuation,
    };
  }
  return {
    representativeCourse,
    alternativeCourses,
    resultState: 'verified',
    alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
    outcomeReasons: uniqueReasons(Object.keys(first.reasonCounts) as CourseV1OutcomeReason[]),
    primaryOutcomeReason: alternativeCourses.length ? undefined : 'no_distinct_verified_alternative',
    continuation: first.continuation,
    diagnostics: first.diagnostics,
  };
}

/**
 * 2-Q 이어보기 entry. continuation은 재실행 토큰이 아니며, 호출자가 같은 메모리
 * 입력/adapter를 다시 준다. 후보 ID나 signature가 달라지면 provider route port는
 * 절대 건드리지 않는다.
 */
export async function continueLimitedRepresentativeCourseV1(
  input: CourseV1ContinuationInput,
): Promise<CourseV1ContinuationResult> {
  validateInput(input);
  const supplied = input.provider.listRepresentativeCandidates(input.now);
  const preselection = preselectLimitedCourseV1({ ...input, candidates: supplied });
  const diagnostics = continuationDiagnostics(supplied.length, preselection);
  const unavailable = (): CourseV1ContinuationResult => ({
    appendedCourses: [],
    continuation: { ...input.continuation, stopReason: 'continuation_unavailable' },
    pageState: 'continuation_unavailable',
    outcomeReasons: ['route_verification_unavailable'],
    diagnostics,
  });
  if (!input.receiptRoutes || input.continuation.version !== 1) return unavailable();
  const expectedIds = preselection.candidatePool.map((candidate) => candidate.id);
  if (expectedIds.length !== input.continuation.candidatePlaceIds.length
    || expectedIds.some((id, index) => id !== input.continuation.candidatePlaceIds[index])
    || candidateSetSignature(expectedIds) !== input.continuation.candidateSetSignature) return unavailable();
  if (input.continuation.stopReason === 'provider_daily_limit' || input.continuation.stopReason === 'provider_unavailable') {
    return {
      appendedCourses: [], continuation: input.continuation, pageState: 'provider_unavailable',
      outcomeReasons: ['route_verification_unavailable'], diagnostics,
    };
  }

  const page = await verifyContinuationPage(input, preselection, input.continuation, 3, 8, 8, diagnostics);
  const appendedCourses = selectContinuationCourseSet(page.courses).slice(0, 3);
  return {
    appendedCourses,
    continuation: page.continuation,
    pageState: page.continuation.stopReason === 'provider_daily_limit' || page.continuation.stopReason === 'provider_unavailable'
      ? 'provider_unavailable'
      : page.continuation.stopReason === 'candidate_queue_exhausted' ? 'exhausted' : 'more_available',
    outcomeReasons: uniqueReasons(Object.keys(page.reasonCounts) as CourseV1OutcomeReason[]),
    diagnostics: page.diagnostics,
  };
}

function continuationDiagnostics(providerCandidateCount: number, preselection: CourseV1PreselectionResult): CourseV1LimitedDiagnostics {
  return {
    providerCandidateCount,
    preselectionCandidateCount: preselection.eligibleCandidateCount,
    candidatePoolCount: preselection.candidatePool.length,
    wideSingleCandidateId: preselection.wideSingleCandidateId,
    preselectionSlots: preselection.preselectionSlots,
    generatedOrderedCourseCount: preselection.generatedOrderedCourseCount,
    preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0,
    budgetRejected: 0, relationshipRejected: 0, classificationExcluded: preselection.classificationExcluded,
  };
}

function emptyContinuation(preselection: CourseV1PreselectionResult): CourseV1Continuation {
  const candidatePlaceIds = preselection.candidatePool.map((candidate) => candidate.id);
  return { version: 1, cursor: 0, candidatePlaceIds, candidateSetSignature: candidateSetSignature(candidatePlaceIds), attemptedCourseSignatures: [], rejectedCourseSignatures: [], verifiedCourseSignatures: [], routeReceiptKeys: [] };
}

/** non-reversible opaque checksum; coordinates or runtime input are deliberately not included. */
function candidateSetSignature(ids: readonly string[]): string {
  let hash = 2166136261;
  for (const char of ids.join('\u001f')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `q1-${(hash >>> 0).toString(36)}`;
}

function courseSignature(places: readonly CourseV1Candidate[]): string {
  return [...places.map((place) => place.id)].sort().join('|');
}

type ContinuationPage = { courses: VerifiedCourseV1[]; continuation: CourseV1Continuation; diagnostics: CourseV1LimitedDiagnostics; reasonCounts: Partial<Record<CourseV1OutcomeReason, number>>; primaryReason: CourseV1OutcomeReason };

async function verifyContinuationPage(
  input: CourseV1LimitedInput,
  preselection: CourseV1PreselectionResult,
  continuation: CourseV1Continuation,
  targetCourseCount: number,
  firstAttemptLimit: number,
  totalAttemptLimit: number,
  diagnostics: CourseV1LimitedDiagnostics,
): Promise<ContinuationPage> {
  const queue = preselection.continuationQueue;
  const attempted = new Set(continuation.attemptedCourseSignatures);
  const rejected = new Set(continuation.rejectedCourseSignatures);
  const verified = new Set(continuation.verifiedCourseSignatures);
  const receiptKeys = new Set(continuation.routeReceiptKeys);
  const courses: VerifiedCourseV1[] = [];
  const reasonCounts: Partial<Record<CourseV1OutcomeReason, number>> = {};
  const shapeDiagnostics = emptyShapeDiagnostics(queue);
  let attempts = 0;
  let adapterCalls = 0;
  let reuseCount = 0;
  let localBudgetExhausted = false;
  let cursor = Math.max(0, continuation.cursor);
  let stopReason: CourseV1ContinuationStopReason | undefined;
  const receiptCache = new Map<string, Promise<CourseV1RouteReceipt>>();
  const getReceipt = async (from: CourseV1Point, to: CourseV1Point): Promise<CourseV1RouteReceipt> => {
    const key = `${from.id}>${to.id}`;
    const cached = receiptCache.get(key);
    if (cached) { reuseCount += 1; return cached; }
    if (attempts >= totalAttemptLimit || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) {
      localBudgetExhausted = true;
      return { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false };
    }
    const maxNewProviderAttemptCount = Math.min(2, totalAttemptLimit - attempts) as 0 | 1 | 2;
    adapterCalls += 1;
    const receipt = input.receiptRoutes!.getRouteReceipt(from, to, { maxNewProviderAttemptCount })
      .then((value) => normalizeReceipt(value, maxNewProviderAttemptCount));
    receiptCache.set(key, receipt);
    receiptKeys.add(opaqueReceiptKey(key));
    const value = await receipt;
    attempts += value.newProviderAttemptCount;
    if (value.reused) reuseCount += 1;
    return value;
  };
  const run = async (limit: number) => {
    while (cursor < queue.length && courses.length < targetCourseCount && attempts < limit) {
      const places = queue[cursor++]!;
      const signature = courseSignature(places);
      if (attempted.has(signature) || rejected.has(signature) || verified.has(signature)) continue;
      attempted.add(signature);
      diagnostics.exactCourseAttemptCount += 1;
      shapeDiagnostics[places.length as 1 | 2 | 3].attemptedCourseCount += 1;
      const outcome = await verifyCourseWithReceipts(places, input, input.destination ?? input.origin, getReceipt);
      if (outcome.kind === 'verified') {
        courses.push(outcome.course);
        verified.add(signature);
        shapeDiagnostics[places.length as 1 | 2 | 3].verifiedCourseCount += 1;
      }
      else {
        rejected.add(signature);
        reasonCounts[outcome.reason] = (reasonCounts[outcome.reason] ?? 0) + 1;
        if (outcome.reason === 'time_budget_exceeded') shapeDiagnostics[places.length as 1 | 2 | 3].timeBudgetExceededCount += 1;
        if (outcome.reason === 'route_not_verified') shapeDiagnostics[places.length as 1 | 2 | 3].routeNotVerifiedCount += 1;
        if (outcome.reason === 'route_verification_unavailable') {
          const shape = shapeDiagnostics[places.length as 1 | 2 | 3];
          shape.routeVerificationUnavailableCount += 1;
          (shape.unavailableReasonCounts ??= emptyUnavailableReasonCounts())[outcome.unavailableReason ?? 'unknown'] += 1;
        }
        if (outcome.reason === 'route_verification_unavailable') {
          if (!localBudgetExhausted) stopReason = attempts >= limit ? 'provider_daily_limit' : 'provider_unavailable';
          break;
        }
      }
    }
  };
  await run(firstAttemptLimit);
  // 첫 페이지에서만, 동일 큐가 남고 4개를 못 얻은 경우에만 16회까지 연다.
  if (totalAttemptLimit > firstAttemptLimit && courses.length < targetCourseCount && cursor < queue.length && attempts >= firstAttemptLimit && !stopReason) await run(totalAttemptLimit);
  if (!stopReason && cursor >= queue.length) stopReason = 'candidate_queue_exhausted';
  diagnostics.newProviderAttemptCount = attempts;
  diagnostics.adapterCallCount = adapterCalls;
  diagnostics.cacheOrSessionReuseCount = reuseCount;
  diagnostics.preselectedCourseIds = [...attempted];
  diagnostics.outcomeReasonCounts = reasonCounts;
  diagnostics.shapeDiagnostics = shapeDiagnostics;
  const next: CourseV1Continuation = {
    version: 1, cursor, candidatePlaceIds: continuation.candidatePlaceIds,
    candidateSetSignature: continuation.candidateSetSignature,
    attemptedCourseSignatures: [...attempted], rejectedCourseSignatures: [...rejected], verifiedCourseSignatures: [...verified],
    routeReceiptKeys: [...receiptKeys], ...(stopReason ? { stopReason } : {}),
  };
  return { courses, continuation: next, diagnostics, reasonCounts, primaryReason: selectPrimaryReceiptReason(reasonCounts, Boolean(stopReason)) };
}

function emptyShapeDiagnostics(queue: readonly CourseV1Candidate[][]): CourseV1ShapeDiagnostics {
  const create = (count: 1 | 2 | 3) => ({
    queueCount: queue.filter((places) => places.length === count).length,
    attemptedCourseCount: 0, verifiedCourseCount: 0,
    timeBudgetExceededCount: 0, routeNotVerifiedCount: 0, routeVerificationUnavailableCount: 0,
    unavailableReasonCounts: emptyUnavailableReasonCounts(),
  });
  return { 1: create(1), 2: create(2), 3: create(3) };
}

function emptyUnavailableReasonCounts(): Record<CourseV1RouteUnavailableReason, number> {
  return { limited: 0, in_flight: 0, store: 0, provider: 0, transport: 0, invalid_response: 0, rejected: 0, unknown: 0 };
}

function opaqueReceiptKey(value: string): string { return candidateSetSignature([value]); }

function selectContinuationCourseSet(courses: readonly VerifiedCourseV1[]): VerifiedCourseV1[] {
  const unique = deduplicateCourses(courses);
  const short = unique.filter((course) => course.placeIds.length <= 2).sort(compareRepresentativeCourses);
  const representativeCourse = short[0] ?? [...unique].sort(compareRepresentativeCourses)[0];
  if (!representativeCourse) return [];
  return [representativeCourse, ...unique.filter((course) => course.id !== representativeCourse.id).sort(compareRepresentativeCourses)];
}

async function buildReceiptBudgetedRepresentativeCourseV1(
  input: CourseV1LimitedInput,
  preselection: CourseV1PreselectionResult,
  diagnostics: CourseV1LimitedDiagnostics,
  receiptEvaluationPolicy?: CourseV1ReceiptEvaluationPolicy,
): Promise<CourseV1LimitedResult> {
  const receiptAdapter = input.receiptRoutes!;
  const evaluationPolicy = receiptEvaluationPolicy ?? DEFAULT_RECEIPT_EVALUATION_POLICY;
  const target = input.destination ?? input.origin;
  const reasonCounts: Partial<Record<CourseV1OutcomeReason, number>> = {};
  const countReason = (reason: CourseV1OutcomeReason) => { reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1; };
  let providerAttempts = 0;
  let adapterCalls = 0;
  let reuseCount = 0;
  let budgetStopped = false;
  const receiptCache = new Map<string, Promise<CourseV1RouteReceipt>>();
  const getReceipt = async (from: CourseV1Point, to: CourseV1Point): Promise<CourseV1RouteReceipt> => {
    const key = `${from.id}>${to.id}`;
    const cached = receiptCache.get(key);
    if (cached) {
      reuseCount += 1;
      return cached;
    }
    const remainingAttempts = evaluationPolicy.providerAttemptLimit - providerAttempts;
    if (remainingAttempts <= 0 || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) {
      budgetStopped = true;
      return { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    }
    const maxNewProviderAttemptCount = Math.min(2, remainingAttempts) as 0 | 1 | 2;
    adapterCalls += 1;
    const receipt = receiptAdapter.getRouteReceipt(from, to, { maxNewProviderAttemptCount })
      .then((value) => normalizeReceipt(value, maxNewProviderAttemptCount));
    receiptCache.set(key, receipt);
    const resolved = await receipt;
    providerAttempts += resolved.newProviderAttemptCount;
    if (resolved.reused) reuseCount += 1;
    return resolved;
  };

  const verified: VerifiedCourseV1[] = [];
  const attemptedSets = new Set<string>();
  const tiers = receiptVerificationTiers(preselection);
  const tierDiagnostics = emptyTierDiagnostics(tiers);
  const budgetStopReason = (): CourseV1TierStopReason | null => {
    if (verified.length >= COURSE_V1_VERIFIED_COURSE_LIMIT) return 'verified_course_limit';
    if (providerAttempts >= evaluationPolicy.providerAttemptLimit) return 'provider_attempt_limit';
    if (adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) return 'adapter_call_limit';
    return null;
  };
  const runTier = async (tier: CourseV1VerificationTier, stopAfterVerifiedCount?: number) => {
    const tierDiagnostic = tierDiagnostics[tier];
    const attemptsAtStart = providerAttempts;
    for (const places of tiers[tier]) {
      if (stopAfterVerifiedCount !== undefined && tierDiagnostic.verifiedCourseCount >= stopAfterVerifiedCount) break;
      const stopReason = budgetStopReason();
      if (stopReason) {
        budgetStopped = true;
        tierDiagnostic.stopReasons.push(stopReason);
        break;
      }
      const setKey = places.map((place) => place.id).sort().join('|');
      if (attemptedSets.has(setKey)) continue;
      // 부분 겹침은 허용한다. 동일·부분집합·상위집합만 현행 반환 계약대로 제외한다.
      if (verified.some((course) => hasNestedPlaceSet(places.map((place) => place.id), course.placeIds))) continue;
      attemptedSets.add(setKey);
      tierDiagnostic.attemptedCourseCount += 1;
      diagnostics.exactCourseAttemptCount += 1;
      const outcome = await verifyCourseWithReceipts(places, input, target, getReceipt);
      if (outcome.kind === 'verified') {
        verified.push(outcome.course);
        tierDiagnostic.verifiedCourseCount += 1;
      } else {
        countReason(outcome.reason);
        tierDiagnostic.stopReasons.push(outcome.reason);
      }
    }
    tierDiagnostic.newProviderAttemptCount = providerAttempts - attemptsAtStart;
  };

  // 2-L: 정적 2-K 슬롯이 아니라 지연 tier를 순서대로 연다. N1/N2의 실제 검증
  // 기회를 먼저 소진해야 넓은 한 곳이나 3곳이 가까운 대안을 밀어내지 않는다.
  if (evaluationPolicy.queueOrder === 'B') {
    // B: N1에서 하나를 실제 검증한 뒤 N2를 한 번 열고 남은 N1으로 돌아간다.
    await runTier('N1', 1);
    await runTier('N2');
    await runTier('N1');
  } else {
    await runTier('N1');
    await runTier('N2');
  }
  if (input.remainingMin <= 120 && tierDiagnostics.N1.verifiedCourseCount > 0) {
    tierDiagnostics.W.stopReasons.push('gated_by_near_single_verification');
  } else {
    await runTier('W');
  }
  await runTier('T');

  diagnostics.preselectedCourseIds = [...attemptedSets];
  diagnostics.outcomeReasonCounts = reasonCounts;
  diagnostics.newProviderAttemptCount = providerAttempts;
  diagnostics.adapterCallCount = adapterCalls;
  diagnostics.cacheOrSessionReuseCount = reuseCount;
  diagnostics.verificationTiers = tierDiagnostics;
  const selected = selectRepresentativeCourseSetV1(deduplicateCourses(verified)).slice(0, COURSE_V1_VERIFIED_COURSE_LIMIT);
  const [representativeCourse, ...alternativeCourses] = selected;
  if (!representativeCourse) {
    const primary = selectPrimaryReceiptReason(reasonCounts, budgetStopped);
    return receiptNoCourse(primary, diagnostics, reasonCounts);
  }
  const outcomeReasons = Object.keys(reasonCounts) as CourseV1OutcomeReason[];
  if (!alternativeCourses.length) {
    countReason('no_distinct_verified_alternative');
    outcomeReasons.push('no_distinct_verified_alternative');
  }
  return {
    representativeCourse,
    alternativeCourses,
    resultState: 'verified',
    alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
    outcomeReasons: uniqueReasons(outcomeReasons),
    primaryOutcomeReason: alternativeCourses.length ? undefined : 'no_distinct_verified_alternative',
    diagnostics,
  };
}

function normalizeReceipt(receipt: CourseV1RouteReceipt, maxNewProviderAttemptCount: 0 | 1 | 2): CourseV1RouteReceipt {
  if (receipt.newProviderAttemptCount > maxNewProviderAttemptCount) return { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false };
  if (receipt.result === 'exact') {
    const route = exactRouteOrNull(receipt.route);
    if (route) return { ...receipt, route };
  }
  if (receipt.result === 'no_route') return receipt;
  if (receipt.result === 'unavailable') {
    return { result: 'unavailable', reason: normalizeUnavailableReason(receipt.reason), newProviderAttemptCount: receipt.newProviderAttemptCount, reused: receipt.reused };
  }
  return { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: receipt.newProviderAttemptCount, reused: receipt.reused };
}

function normalizeUnavailableReason(value: unknown): CourseV1RouteUnavailableReason {
  return value === 'limited' || value === 'in_flight' || value === 'store' || value === 'provider'
    || value === 'transport' || value === 'invalid_response' || value === 'rejected' || value === 'unknown'
    ? value
    : 'unknown';
}

type ReceiptVerification =
  | { kind: 'verified'; course: VerifiedCourseV1 }
  | { kind: 'rejected'; reason: 'time_budget_exceeded' | 'route_not_verified' }
  | { kind: 'rejected'; reason: 'route_verification_unavailable'; unavailableReason: CourseV1RouteUnavailableReason };

async function verifyCourseWithReceipts(
  places: readonly CourseV1Candidate[], input: CourseV1LimitedInput, target: CourseV1Point,
  getReceipt: (from: CourseV1Point, to: CourseV1Point) => Promise<CourseV1RouteReceipt>,
): Promise<ReceiptVerification> {
  const legs: CourseV1Leg[] = [];
  let current: CourseV1Point = input.origin;
  let minimumElapsedMin = 0;
  for (const place of places) {
    const receipt = await getReceipt(current, place);
    if (receipt.result === 'unavailable') return { kind: 'rejected', reason: 'route_verification_unavailable', unavailableReason: normalizeUnavailableReason(receipt.reason) };
    if (receipt.result !== 'exact') return { kind: 'rejected', reason: 'route_not_verified' };
    legs.push(courseV1Leg(current.id, place.id, receipt.route));
    minimumElapsedMin += receipt.route.min;
    const arrivalAt = new Date(input.now.getTime() + minimumElapsedMin * 60_000);
    // 이후 leg의 receipt를 요청하기 전에 최소 체류 운영시간을 확정한다. 이미 닫힌
    // 장소를 통과시켜 downstream provider 비용을 쓰거나, short/recommended 판정이
    // route queue를 바꾸는 일을 막는다.
    if (!isAvailable(place.availability, arrivalAt, place.minStayMin)) return { kind: 'rejected', reason: 'time_budget_exceeded' };
    minimumElapsedMin += place.minStayMin;
    if (minimumElapsedMin + input.arrivalBufferMin > input.remainingMin) return { kind: 'rejected', reason: 'time_budget_exceeded' };
    current = place;
  }
  const finalReceipt = await getReceipt(current, target);
  if (finalReceipt.result === 'unavailable') return { kind: 'rejected', reason: 'route_verification_unavailable', unavailableReason: normalizeUnavailableReason(finalReceipt.reason) };
  if (finalReceipt.result !== 'exact') return { kind: 'rejected', reason: 'route_not_verified' };
  legs.push(courseV1Leg(current.id, target.id, finalReceipt.route));
  if (minimumElapsedMin + finalReceipt.route.min + input.arrivalBufferMin > input.remainingMin) {
    return { kind: 'rejected', reason: 'time_budget_exceeded' };
  }
  const stayPlan = selectStayPlan(places, input, legs);
  if (!stayPlan) return { kind: 'rejected', reason: 'time_budget_exceeded' };
  const placeIds = places.map((place) => place.id);
  return { kind: 'verified', course: { id: placeIds.join('|'), placeIds, stops: stayPlan.stops, legs, stayMin: stayPlan.stayMin, travelMin: legs.reduce((total, leg) => total + leg.min, 0), totalMin: stayPlan.totalMin, arrivalBufferMin: input.arrivalBufferMin, remainingAfterCourseMin: input.remainingMin - stayPlan.totalMin, remainingAfterArrivalBufferMin: input.remainingMin - stayPlan.totalMin } };
}

function selectPrimaryReceiptReason(reasons: Partial<Record<CourseV1OutcomeReason, number>>, budgetStopped: boolean): CourseV1OutcomeReason {
  if (budgetStopped || reasons.route_verification_unavailable) return 'route_verification_unavailable';
  return (['time_budget_exceeded', 'route_not_verified'] as const).find((reason) => reasons[reason]) ?? 'no_eligible_candidates';
}

function uniqueReasons(reasons: readonly CourseV1OutcomeReason[]): CourseV1OutcomeReason[] {
  return [...new Set(reasons)];
}

function receiptNoCourse(
  primary: CourseV1OutcomeReason,
  diagnostics: CourseV1LimitedDiagnostics,
  reasonCounts: Partial<Record<CourseV1OutcomeReason, number>> = {},
): CourseV1LimitedResult {
  if (!reasonCounts[primary]) reasonCounts[primary] = 1;
  diagnostics.outcomeReasonCounts = reasonCounts;
  return {
    ...limitedNoCourse(primary === 'no_eligible_candidates' || primary === 'no_open_candidates' ? 'no_representative_candidates' : 'no_verified_course_within_limit', diagnostics),
    outcomeReasons: uniqueReasons(Object.keys(reasonCounts) as CourseV1OutcomeReason[]),
    primaryOutcomeReason: primary,
  };
}

function validateInput(input: Pick<CourseV1Input, 'now' | 'remainingMin' | 'arrivalBufferMin'>): void {
  if (!Number.isInteger(input.remainingMin) || input.remainingMin < 1 || input.remainingMin > 180) {
    throw new RangeError('remainingMin must be 1~180 minutes');
  }
  if (!Number.isInteger(input.arrivalBufferMin) || input.arrivalBufferMin < 1 || input.arrivalBufferMin >= input.remainingMin) {
    throw new RangeError('arrivalBufferMin must be at least 1 minute and smaller than remainingMin');
  }
  if (Number.isNaN(input.now.getTime())) throw new RangeError('now must be a valid date');
}

/**
 * 2-P의 route 없는 고유 장소 탐색 페이지다. 공간 점수는 내부 순서에만 쓰며,
 * 실제 이동 시간·도착 가능·검증 완료를 반환하지 않는다.
 */
export function buildExplorationPageV1(input: CourseV1ExplorationInput): CourseV1ExplorationPage {
  validateInput(input);
  const pageSize = input.pageSize ?? 12;
  const cursor = input.cursor ?? 0;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new RangeError('pageSize must be 1~50');
  if (!Number.isInteger(cursor) || cursor < 0) throw new RangeError('cursor must be a non-negative integer');
  const eligible = eligibleExplorationCandidates(input);
  const places = eligible.slice(cursor, cursor + pageSize).map(toExplorationPlace);
  const nextOffset = cursor + places.length;
  return { places, nextCursor: nextOffset < eligible.length ? nextOffset : null, eligiblePlaceCount: eligible.length };
}

/**
 * 사용자가 탭한 한 장소만 receipt port로 검증한다. 대표 코스/탐색 페이지를
 * 입력·출력으로 갖지 않으므로 이 행동이 기존 결과를 교체하거나 다음 후보를 자동 조회할 수 없다.
 */
export async function verifySelectedExplorationPlaceV1(input: CourseV1SelectedExplorationInput): Promise<SelectedExplorationResult> {
  validateInput(input);
  const selected = eligibleExplorationCandidates(input).find((candidate) => candidate.id === input.selectedPlaceId);
  let adapterCallCount = 0;
  let newProviderAttemptCount = 0;
  let cacheOrSessionReuseCount = 0;
  const receipt = (): ExplorationSelectionReceipt => ({ adapterCallCount, newProviderAttemptCount, cacheOrSessionReuseCount });
  const reject = (reason: ExplorationSelectionReason): SelectedExplorationResult => ({ state: 'rejected', reason, receipt: receipt() });
  if (!selected) return reject('exploration_place_not_eligible');

  const getReceipt = async (from: CourseV1Point, to: CourseV1Point): Promise<CourseV1RouteReceipt> => {
    const remainingAttempts = EXPLORATION_SELECTION_PROVIDER_ATTEMPT_LIMIT - newProviderAttemptCount;
    if (adapterCallCount >= EXPLORATION_SELECTION_ADAPTER_CALL_LIMIT || remainingAttempts <= 0) {
      return { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    }
    const maxNewProviderAttemptCount = Math.min(2, remainingAttempts) as 0 | 1 | 2;
    adapterCallCount += 1;
    const value = normalizeReceipt(await input.receiptRoutes.getRouteReceipt(from, to, { maxNewProviderAttemptCount }), maxNewProviderAttemptCount);
    newProviderAttemptCount += value.newProviderAttemptCount;
    if (value.reused) cacheOrSessionReuseCount += 1;
    return value;
  };
  const target = input.destination ?? input.origin;
  const first = await getReceipt(input.origin, selected);
  if (first.result === 'unavailable') return reject('route_verification_unavailable');
  if (first.result !== 'exact') return reject('route_not_verified');
  const arrivalAt = new Date(input.now.getTime() + first.route.min * 60_000);
  if (selected.discovery.eligibility === 'area_access') {
    if (!isAccessAvailable(selected.discovery.accessWindow!, arrivalAt, selected.minStayMin)) return reject('access_window_unavailable');
  } else if (!isAvailable(selected.availability, arrivalAt, selected.minStayMin)) {
    return reject('time_budget_exceeded');
  }

  const final = await getReceipt(selected, target);
  if (final.result === 'unavailable') return reject('route_verification_unavailable');
  if (final.result !== 'exact') return reject('route_not_verified');
  const legs: CourseV1Leg[] = [
    courseV1Leg(input.origin.id, selected.id, first.route),
    courseV1Leg(selected.id, target.id, final.route),
  ];
  const course = selected.discovery.eligibility === 'area_access'
    ? buildAreaAccessSelectionCourse(selected, input, legs)
    : buildRepresentativeSelectionCourse(selected, input, legs);
  if (!course) return reject('time_budget_exceeded');
  return { state: 'verified', course, receipt: receipt() };
}

/**
 * 사용자 확인 조건부 장소는 자동 운영시간 검증을 되살리지 않는다. 이 entry는 오직
 * 한 시장/거리의 실제 이동·체류 예산만 계산하며, 성공 상태도 대표/verified 결과와 분리한다.
 */
export async function buildConfirmedConditionalManualCourseV1(
  input: ConditionalManualCourseV1Input,
): Promise<ConditionalManualCourseV1Result> {
  let adapterCallCount = 0;
  let newProviderAttemptCount = 0;
  let cacheOrSessionReuseCount = 0;
  const receipt = (): CourseV1RouteReceiptSummary => ({ adapterCallCount, newProviderAttemptCount, cacheOrSessionReuseCount });
  const reject = (reason: Extract<ConditionalManualCourseV1Result, { state: 'rejected' }>['reason']): ConditionalManualCourseV1Result => ({ state: 'rejected', reason, receipt: receipt() });
  if (input.userConfirmedHours !== true) return reject('conditional_confirmation_required');
  if (Number.isNaN(input.now.getTime()) || !Number.isInteger(input.remainingMin) || !Number.isInteger(input.arrivalBufferMin)
    || input.remainingMin < 1 || input.remainingMin > 180 || input.arrivalBufferMin < 1 || input.arrivalBufferMin >= input.remainingMin) return reject('time_budget_exceeded');
  const minuteOfDay = input.now.getHours() * 60 + input.now.getMinutes();
  if (minuteOfDay < 600 || minuteOfDay >= 1080) return reject('conditional_display_window_unavailable');
  const selected = input.conditionalCandidates.find((candidate) => candidate.id === input.selectedPlaceId);
  if (!isEligibleConditionalManualCandidate(selected)) return reject('conditional_candidate_not_eligible');

  const routeCache = new Map<string, Promise<CourseV1RouteReceipt>>();
  const getReceipt = async (from: CourseV1Point, to: CourseV1Point): Promise<CourseV1RouteReceipt> => {
    const key = `${from.id}>${to.id}`;
    const cached = routeCache.get(key);
    if (cached) { cacheOrSessionReuseCount += 1; return cached; }
    if (adapterCallCount >= 2 || newProviderAttemptCount >= 4) return { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    const budget = Math.min(2, 4 - newProviderAttemptCount) as 0 | 1 | 2;
    adapterCallCount += 1;
    const value = input.receiptRoutes.getRouteReceipt(from, to, { maxNewProviderAttemptCount: budget })
      .then((item) => normalizeReceipt(item, budget));
    routeCache.set(key, value);
    const resolved = await value;
    newProviderAttemptCount += resolved.newProviderAttemptCount;
    if (resolved.reused) cacheOrSessionReuseCount += 1;
    return resolved;
  };
  const target = input.destination ?? input.origin;
  const first = await getReceipt(input.origin, selected);
  if (first.result === 'unavailable') return reject('route_verification_unavailable');
  if (first.result !== 'exact') return reject('route_not_verified');
  const last = await getReceipt(selected, target);
  if (last.result === 'unavailable') return reject('route_verification_unavailable');
  if (last.result !== 'exact') return reject('route_not_verified');
  const legs: CourseV1Leg[] = [
    courseV1Leg(input.origin.id, selected.id, first.route),
    courseV1Leg(selected.id, target.id, last.route),
  ];
  const travelMin = first.route.min + last.route.min;
  const availableForStay = input.remainingMin - input.arrivalBufferMin - travelMin;
  const stayMin = availableForStay >= selected.recommendedStayMin ? selected.recommendedStayMin : selected.minStayMin;
  if (availableForStay < selected.minStayMin) return reject('time_budget_exceeded');
  const arrivalAt = new Date(input.now.getTime() + first.route.min * 60_000);
  const departureAt = new Date(arrivalAt.getTime() + stayMin * 60_000);
  const totalMin = travelMin + stayMin + input.arrivalBufferMin;
  const course: VerifiedCourseV1 = {
    id: selected.id,
    placeIds: [selected.id],
    stops: [{ placeId: selected.id, stayMin, stayState: stayMin === selected.recommendedStayMin ? 'recommended' : 'short', availabilityState: 'structured_verified', arrivalAt: arrivalAt.toISOString(), departureAt: departureAt.toISOString() }],
    legs, stayMin, travelMin, totalMin, arrivalBufferMin: input.arrivalBufferMin,
    remainingAfterCourseMin: input.remainingMin - totalMin,
    remainingAfterArrivalBufferMin: input.remainingMin - totalMin,
  };
  return { state: 'conditional_manual_course', course, hoursStatus: 'hours_confirmation_required_user_confirmed', receipt: receipt() };
}

function isEligibleConditionalManualCandidate(candidate: CourseV1Candidate | undefined): candidate is CourseV1Candidate {
  return Boolean(candidate
    && candidate.classification === 'conditional_more'
    && candidate.conditionalVisit?.kind === 'market_or_street'
    && candidate.conditionalVisit.displayWindow.start === '10:00'
    && candidate.conditionalVisit.displayWindow.end === '18:00'
    && candidate.conditionalVisit.requiresUserHoursConfirmation === true
    && Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon)
    && hasValidStayRange(candidate));
}

function eligibleExplorationCandidates(input: Pick<CourseV1ExplorationInput, 'now' | 'origin' | 'destination' | 'remainingMin' | 'arrivalBufferMin' | 'candidates' | 'excludedPlaceIds'>): CourseV1DiscoveryCandidate[] {
  const target = input.destination ?? input.origin;
  const excludedPlaceIds = new Set(input.excludedPlaceIds ?? []);
  const unique = new Set<string>();
  return input.candidates
    .filter((candidate) => !excludedPlaceIds.has(candidate.id) && isExplorationEligible(candidate, input.now, input.remainingMin, input.arrivalBufferMin))
    .sort((left, right) => {
      const spatial = candidateSpatialBurden(left, input.origin, target, input.destination === null)
        - candidateSpatialBurden(right, input.origin, target, input.destination === null);
      return spatial || left.id.localeCompare(right.id);
    })
    .filter((candidate) => {
      const key = candidate.siteGroupId ? `group:${candidate.siteGroupId}` : `place:${candidate.id}`;
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    });
}

function isExplorationEligible(candidate: CourseV1DiscoveryCandidate, now: Date, remainingMin: number, arrivalBufferMin: number): boolean {
  if (!hasValidStayRange(candidate) || candidate.minStayMin + arrivalBufferMin > remainingMin) return false;
  if (candidate.discovery.eligibility === 'representative') {
    return representative.has(candidate.classification) && canPossiblyOpen(candidate, now);
  }
  return candidate.discovery.eligibility === 'area_access'
    && (candidate.discovery.placeKind === 'area' || candidate.discovery.placeKind === 'outdoor')
    && hasValidAccessEvidence(candidate.discovery.accessEvidence)
    && hasValidAccessWindow(candidate.discovery.accessWindow)
    && isAccessAvailable(candidate.discovery.accessWindow, now, candidate.minStayMin);
}

function hasValidAccessEvidence(evidence: CourseV1DiscoveryCandidate['discovery']['accessEvidence']): evidence is NonNullable<CourseV1DiscoveryCandidate['discovery']['accessEvidence']> {
  return evidence?.status === 'public_outdoor_access'
    && Boolean(evidence.source && evidence.sourceId && evidence.checkedAt && evidence.sourceText);
}

function hasValidAccessWindow(window: CourseV1DiscoveryCandidate['discovery']['accessWindow']): window is CourseV1DiscoveryAccessWindow {
  if (!window || (window.kind !== 'always' && window.kind !== 'scheduled')) return false;
  if (!window.dayTypes.length || !window.dayTypes.every((day) => day === 'weekday' || day === 'weekend')) return false;
  return window.kind === 'always'
    ? window.windows.length === 0
    : window.windows.length > 0 && window.windows.every((item) => Number.isInteger(item.startMin) && Number.isInteger(item.endMin) && item.startMin >= 0 && item.endMin <= 1440 && item.startMin < item.endMin);
}

function isAccessAvailable(window: CourseV1DiscoveryAccessWindow, arrival: Date, dwellMin: number): boolean {
  const dayType: CourseV1DayType = arrival.getDay() === 0 || arrival.getDay() === 6 ? 'weekend' : 'weekday';
  if (!window.dayTypes.includes(dayType)) return false;
  if (window.kind === 'always') return true;
  const startMin = arrival.getHours() * 60 + arrival.getMinutes();
  return window.windows.some((item) => startMin >= item.startMin && startMin + dwellMin <= item.endMin);
}

function toExplorationPlace(candidate: CourseV1DiscoveryCandidate): ExplorationPlace {
  return {
    placeId: candidate.id,
    title: candidate.title,
    lat: candidate.lat,
    lon: candidate.lon,
    ...(candidate.siteGroupId ? { siteGroupId: candidate.siteGroupId } : {}),
    eligibility: candidate.discovery.eligibility as 'representative' | 'area_access',
    minStayMin: candidate.minStayMin,
    recommendedStayMin: candidate.recommendedStayMin,
    ...(candidate.discovery.eligibility === 'area_access' ? { accessEvidence: candidate.discovery.accessEvidence, accessWindow: candidate.discovery.accessWindow } : {}),
  };
}

function buildRepresentativeSelectionCourse(candidate: CourseV1Candidate, input: Pick<CourseV1Input, 'now' | 'remainingMin' | 'arrivalBufferMin'>, legs: readonly CourseV1Leg[]): VerifiedCourseV1 | null {
  const stayPlan = selectStayPlan([candidate], input, legs);
  return stayPlan ? verifiedSelectionCourse(candidate.id, stayPlan.stops, stayPlan.stayMin, stayPlan.totalMin, input, legs) : null;
}

function buildAreaAccessSelectionCourse(candidate: CourseV1DiscoveryCandidate, input: Pick<CourseV1Input, 'now' | 'remainingMin' | 'arrivalBufferMin'>, legs: readonly CourseV1Leg[]): VerifiedCourseV1 | null {
  const arrivalAt = new Date(input.now.getTime() + legs[0]!.min * 60_000);
  const stayMin = candidate.minStayMin;
  const totalMin = legs[0]!.min + stayMin + legs[1]!.min + input.arrivalBufferMin;
  if (!isAccessAvailable(candidate.discovery.accessWindow!, arrivalAt, stayMin) || totalMin > input.remainingMin) return null;
  const departureAt = new Date(arrivalAt.getTime() + stayMin * 60_000);
  const stops: CourseV1Stop[] = [{ placeId: candidate.id, stayMin, stayState: 'short', availabilityState: 'structured_verified', arrivalAt: arrivalAt.toISOString(), departureAt: departureAt.toISOString() }];
  return verifiedSelectionCourse(candidate.id, stops, stayMin, totalMin, input, legs);
}

function verifiedSelectionCourse(placeId: string, stops: CourseV1Stop[], stayMin: number, totalMin: number, input: Pick<CourseV1Input, 'remainingMin' | 'arrivalBufferMin'>, legs: readonly CourseV1Leg[]): VerifiedCourseV1 {
  return {
    id: placeId,
    placeIds: [placeId],
    stops,
    legs: [...legs],
    stayMin,
    travelMin: legs.reduce((total, leg) => total + leg.min, 0),
    totalMin,
    arrivalBufferMin: input.arrivalBufferMin,
    remainingAfterCourseMin: input.remainingMin - totalMin,
    remainingAfterArrivalBufferMin: input.remainingMin - totalMin,
  };
}

function noCourse(alternativeState: AlternativeState, diagnostics: CourseV1Diagnostics): CourseV1Result {
  return { representativeCourse: null, alternativeCourseIds: [], alternativeState, diagnostics };
}

function limitedNoCourse(
  resultState: 'no_representative_candidates' | 'no_verified_course_within_limit',
  diagnostics: CourseV1LimitedDiagnostics,
): CourseV1LimitedResult {
  return {
    representativeCourse: null,
    alternativeCourses: [],
    resultState,
    alternativeState: resultState === 'no_representative_candidates' ? 'no_candidates' : 'no_alternative_verified_course',
    diagnostics,
  };
}

function emptyPreselectionSlots(): CourseV1PreselectionSlots {
  return { nearSingle: null, wideSingle: null, independentTwo: null, independentThree: null };
}

function* permutationsUpToThree(candidates: readonly CourseV1Candidate[]): Generator<CourseV1Candidate[]> {
  for (const first of candidates) yield [first];
  for (const first of candidates) for (const second of candidates) {
    if (first.id !== second.id) yield [first, second];
  }
  for (const first of candidates) for (const second of candidates) for (const third of candidates) {
    if (new Set([first.id, second.id, third.id]).size === 3) yield [first, second, third];
  }
}

function hasRelationshipConflict(places: readonly CourseV1Candidate[]): boolean {
  const groups = new Set<string>();
  for (const place of places) {
    if (!place.siteGroupId) continue;
    if (groups.has(place.siteGroupId)) return true;
    groups.add(place.siteGroupId);
  }
  return false;
}

/** 현재 시각에 전혀 시작할 수 없는 후보만 사전 제외한다. 실제 도착·체류 판정은 정확 경로 뒤에 한다. */
function canPossiblyOpen(candidate: CourseV1Candidate, now: Date): boolean {
  if (!hasValidStayRange(candidate)) return false;
  const availability = candidate.availability;
  if (availability.status !== 'structured') return false;
  const dayType: CourseV1DayType = now.getDay() === 0 || now.getDay() === 6 ? 'weekend' : 'weekday';
  if (!availability.dayTypes.includes(dayType)) return false;
  if (availability.alwaysAccessible) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return availability.windows.some((window) => Math.max(nowMin, window.startMin) + candidate.minStayMin <= window.endMin);
}

function hasValidStayRange(candidate: CourseV1Candidate): boolean {
  return candidate.maxStayMin !== undefined
    && [candidate.minStayMin, candidate.recommendedStayMin, candidate.maxStayMin].every((value) => Number.isInteger(value) && value > 0)
    && candidate.minStayMin <= candidate.recommendedStayMin
    && candidate.recommendedStayMin <= candidate.maxStayMin;
}

/** 최소 체류로 안전성을 확정한 뒤, 같은 exact legs 안에서 앞 순서부터 권장 체류를 올린다. */
function selectStayPlan(
  places: readonly CourseV1Candidate[], input: Pick<CourseV1Input, 'now' | 'remainingMin' | 'arrivalBufferMin' | 'dwellPersonalizationSamples'>, legs: readonly CourseV1Leg[],
): { stops: CourseV1Stop[]; stayMin: number; totalMin: number } | null {
  const build = (
    stays: readonly number[],
    targets: readonly number[],
    personalization?: readonly (CourseV1Stop['dwellPersonalization'] | undefined)[],
  ): { stops: CourseV1Stop[]; stayMin: number; totalMin: number } | null => {
    let elapsedMin = 0;
    const stops: CourseV1Stop[] = [];
    for (const [index, place] of places.entries()) {
      elapsedMin += legs[index]!.min;
      const arrivalAt = new Date(input.now.getTime() + elapsedMin * 60_000);
      const stayMin = stays[index]!;
      if (!isAvailable(place.availability, arrivalAt, stayMin)) return null;
      const departureAt = new Date(arrivalAt.getTime() + stayMin * 60_000);
      stops.push({
        placeId: place.id, stayMin,
        stayState: stayMin === targets[index] ? 'recommended' : 'short',
        availabilityState: 'structured_verified', arrivalAt: arrivalAt.toISOString(), departureAt: departureAt.toISOString(),
        ...(personalization?.[index] ? { dwellPersonalization: personalization[index] } : {}),
      });
      elapsedMin += stayMin;
    }
    const totalMin = elapsedMin + legs.at(-1)!.min + input.arrivalBufferMin;
    return totalMin <= input.remainingMin ? { stops, stayMin: stays.reduce((sum, value) => sum + value, 0), totalMin } : null;
  };

  const defaultTargets = places.map((place) => place.recommendedStayMin);
  const baselineStays = places.map((place) => place.minStayMin);
  if (!build(baselineStays, defaultTargets)) return null;
  for (const [index, target] of defaultTargets.entries()) {
    if (target === baselineStays[index]) continue;
    const minimum = baselineStays[index]!;
    baselineStays[index] = target;
    if (!build(baselineStays, defaultTargets)) baselineStays[index] = minimum;
  }
  const baseline = build(baselineStays, defaultTargets);
  if (!baseline || !input.dwellPersonalizationSamples?.length) return baseline;

  const profiles = places.map((place) => {
    if (place.maxStayMin === undefined) return null;
    return deriveDwellPersonalizationV1({
      category: place.category ?? '',
      subCategory: place.subCategory,
      minStayMin: place.minStayMin,
      recommendedStayMin: place.recommendedStayMin,
      maxStayMin: place.maxStayMin,
      samples: input.dwellPersonalizationSamples!,
    });
  });
  if (!profiles.some((profile) => profile?.state === 'applied')) return baseline;
  const personalizedTargets = profiles.map((profile, index) => profile?.recommendedStayMin ?? defaultTargets[index]!);

  const personalizedStays = [...baselineStays];
  for (const [index, target] of personalizedTargets.entries()) {
    // 다른 stop의 개인화가 이 stop의 기본 배분을 다시 늘려서는 안 된다.
    if (profiles[index]?.state !== 'applied') continue;
    const baselineStay = baselineStays[index]!;
    if (target <= baselineStay) {
      personalizedStays[index] = target;
      if (!build(personalizedStays, personalizedTargets)) personalizedStays[index] = baselineStay;
      continue;
    }
    let selected = baselineStay;
    // route를 다시 호출하지 않고 같은 legs에서 예산·운영 가능한 최대 분으로 clamp한다.
    for (let dwellMin = target; dwellMin > baselineStay; dwellMin -= 1) {
      personalizedStays[index] = dwellMin;
      if (build(personalizedStays, personalizedTargets)) {
        selected = dwellMin;
        break;
      }
    }
    personalizedStays[index] = selected;
  }
  const personalization = profiles.map((profile, index): CourseV1Stop['dwellPersonalization'] | undefined => (
    profile?.state === 'applied'
      ? {
          targetStayMin: profile.recommendedStayMin,
          baselineStayMin: baselineStays[index]!,
          baselineStayState: baselineStays[index] === defaultTargets[index] ? 'recommended' : 'short',
        }
      : undefined
  ));
  return build(personalizedStays, personalizedTargets, personalization) ?? baseline;
}

/**
 * adapter를 전혀 받지 않는 순수 공간 사전선정 경계다.
 * 거리 값은 이 함수 밖으로 반환하지 않으며, 실제 경로·성공·화면 시간으로 사용하지 않는다.
 */
export function preselectLimitedCourseV1(input: CourseV1PreselectionInput): CourseV1PreselectionResult {
  validateInput(input);
  let classificationExcluded = 0;
  const eligible = input.candidates
    .filter((candidate) => {
      const allowed = representative.has(candidate.classification) && canPossiblyOpen(candidate, input.now);
      if (!allowed) classificationExcluded += 1;
      return allowed;
    });
  const target = input.destination ?? input.origin;
  const spatialSelection = selectSpatialCandidatePool(eligible, input.origin, target, input.destination === null);
  const { candidatePool, wideSingleCandidateId } = spatialSelection;
  const ranked: Array<{ places: CourseV1Candidate[]; score: number; minimumStayMin: number; key: string }> = [];
  for (const places of permutationsUpToThree(candidatePool)) {
    if (hasRelationshipConflict(places)) continue;
    // 실제 경로가 아니라 코스 순서의 공간적 관련성만 이용한다. 숫자는 반환하지 않는다.
    const spatialBurden = orderedSpatialBurden(places, input.origin, target);
    const score = spatialBurden;
    const key = places.map((place) => place.id).join('|');
    ranked.push({ places, score, minimumStayMin: places.reduce((sum, place) => sum + place.minStayMin, 0), key });
  }
  // 공간 관련성을 먼저 유지하고, 같은 공간 부담에서는 입력 예산에 더 가벼운 권장 체류를
  // 우선한다. 남는 시간을 채우기 위한 점수나 최종 탈락 조건으로는 사용하지 않는다.
  ranked.sort((left, right) => left.score - right.score || left.minimumStayMin - right.minimumStayMin || left.key.localeCompare(right.key));

  // 네 검증 자리를 장소 수 채우기가 아닌 서로 다른 장소 집합의 포트폴리오로 배정한다.
  // 실제 이동은 이 단계에서 알 수 없으므로, 권장 체류+도착 여유가 이미 입력을 넘는
  // 3곳 조합만 마지막 독립 슬롯에서 피한다. 정확 경로만 최종 통과/표시 근거다.
  const selected: CourseV1Candidate[][] = [];
  const seenSets = new Set<string>();
  const preselectionSlots = emptyPreselectionSlots();
  const setKeyOf = (places: readonly CourseV1Candidate[]) => [...places.map((place) => place.id)].sort().join('|');
  const add = (item: { places: CourseV1Candidate[]; minimumStayMin: number }, slot?: keyof CourseV1PreselectionSlots) => {
    const setKey = setKeyOf(item.places);
    if (seenSets.has(setKey) || selected.length >= COURSE_V1_EXACT_COURSE_LIMIT) return false;
    seenSets.add(setKey);
    selected.push(item.places);
    if (slot) preselectionSlots[slot] = item.places.map((place) => place.id).join('|');
    return true;
  };
  const addFirst = (
    placeCount: 1 | 2 | 3,
    slot: keyof CourseV1PreselectionSlots,
    requireIndependent: boolean,
    requiresTimeLowerBound = false,
  ) => {
    for (const item of ranked) {
      if (item.places.length !== placeCount) continue;
      if (requiresTimeLowerBound && item.minimumStayMin + input.arrivalBufferMin > input.remainingMin) continue;
      if (requireIndependent && selected.some((existing) => hasSharedPlace(item.places, existing))) continue;
      if (add(item, slot)) return;
    }
  };
  addFirst(1, 'nearSingle', false);
  // 근접 1곳과 별도로, 같은 자동 후보 집합의 다음 바깥 공간 구간 1곳도 실제 경로를 확인한다.
  // 인기도나 발견성 점수는 쓰지 않으며, 이 후보 역시 출발→도착/복귀 공간 부담 순서에서만 나온다.
  if (wideSingleCandidateId && selected.length < COURSE_V1_EXACT_COURSE_LIMIT) {
    const wideSingle = ranked.find((item) => item.places.length === 1 && item.places[0]?.id === wideSingleCandidateId);
    if (wideSingle) add(wideSingle, 'wideSingle');
  }
  addFirst(2, 'independentTwo', true);
  addFirst(3, 'independentThree', true, true);

  // 독립 3곳을 만들 수 없으면 기존 1~3곳 계약을 보존하는 마지막 fallback만 허용한다.
  // 이 경우 슬롯은 independentThree가 아니라 null로 남아, 검증된 3곳을 독립 대안으로
  // 취급하지 않는다.
  for (const item of ranked) {
    if (selected.length === COURSE_V1_EXACT_COURSE_LIMIT) break;
    if (item.places.length !== 3) continue;
    add(item);
  }
  // 후보가 부족하면 남은 1·2곳을 순위대로 보완하되, 없는 유형을 만들지는 않는다.
  for (const item of ranked) {
    if (selected.length === COURSE_V1_EXACT_COURSE_LIMIT) break;
    if (item.places.length === 3) continue;
    add(item);
  }
  // receipt port는 이 지연 순서를 소비한다. legacy 4코스는 candidateCourses를 계속
  // 사용하므로 2-K의 공개 슬롯/호환 동작은 바뀌지 않는다.
  const candidateQueue: CourseV1Candidate[][] = [];
  const queuedSets = new Set<string>();
  const enqueue = (places: CourseV1Candidate[]) => {
    const key = setKeyOf(places);
    if (queuedSets.has(key)) return false;
    queuedSets.add(key);
    candidateQueue.push(places);
    return true;
  };
  let nearbySingles = 0;
  for (const candidate of candidatePool) {
    if (candidate.id === wideSingleCandidateId || nearbySingles >= 3) continue;
    enqueue([candidate]);
    nearbySingles += 1;
  }
  // N2도 가까운 세 쌍까지만 지연 대기열에 넣는다. 무한한 2곳 순열이 24 adapter
  // call을 모두 소진해 W/T의 fallback 기회를 없애지 않도록 하는 내부 예산 경계다.
  let nearbyTwos = 0;
  for (const item of ranked) {
    if (item.places.length !== 2 || nearbyTwos >= 3) continue;
    if (enqueue(item.places)) nearbyTwos += 1;
  }
  if (wideSingleCandidateId) {
    const wideSingle = ranked.find((item) => item.places.length === 1 && item.places[0]?.id === wideSingleCandidateId);
    if (wideSingle) enqueue(wideSingle.places);
  }
  for (const item of ranked) if (item.places.length === 3) enqueue(item.places);
  // 이어보기는 이 짧은 receipt tier가 아니라 18곳 공간 풀의 전체 후보를 사용한다.
  // 순서만 다른 같은 장소 집합은 첫 공간 우선 순서를 대표로 하나만 남기고, 서로 다른
  // cardinality의 부분집합은 절대 제거하지 않는다.
  const continuationQueue: CourseV1Candidate[][] = [];
  const continuationSets = new Set<string>();
  const enqueueContinuation = (places: CourseV1Candidate[]) => {
    const key = setKeyOf(places);
    if (continuationSets.has(key)) return;
    continuationSets.add(key);
    continuationQueue.push(places);
  };
  const canonicalByCount = (count: 1 | 2 | 3) => ranked.filter((item) => item.places.length === count);
  const singles = canonicalByCount(1);
  const twos = canonicalByCount(2);
  const triples = canonicalByCount(3)
    .filter((item) => item.minimumStayMin + input.arrivalBufferMin <= input.remainingMin);
  // 2-S: 1곳이 목표 수를 먼저 채워도 가능한 2곳의 receipt 기회가 사라지지 않게
  // 근접 N1/N2를 교차한다. 3곳은 대표 우선이 아니며, 1·2곳 두 라운드 뒤 한 번만
  // 연다. 같은 장소 집합의 순서 변형은 enqueueContinuation이 계속 하나로 합친다.
  const rounds = Math.max(singles.length, twos.length);
  for (let index = 0; index < rounds; index += 1) {
    if (singles[index]) enqueueContinuation(singles[index].places);
    if (twos[index]) enqueueContinuation(twos[index].places);
    if (index === 1 && triples[0]) enqueueContinuation(triples[0].places);
  }
  for (const item of triples.slice(1)) enqueueContinuation(item.places);
  return {
    candidatePool,
    candidateCourses: selected,
    candidateQueue,
    continuationQueue,
    wideSingleCandidateId,
    preselectionSlots,
    generatedOrderedCourseCount: ranked.length,
    eligibleCandidateCount: eligible.length,
    classificationExcluded,
  };
}

function receiptVerificationTiers(preselection: CourseV1PreselectionResult): Record<CourseV1VerificationTier, CourseV1Candidate[][]> {
  const wideId = preselection.wideSingleCandidateId;
  const tiers: Record<CourseV1VerificationTier, CourseV1Candidate[][]> = { N1: [], N2: [], W: [], T: [] };
  for (const places of preselection.candidateQueue) {
    if (places.length === 1) {
      if (places[0]?.id === wideId) tiers.W.push(places);
      else if (tiers.N1.length < 3) tiers.N1.push(places);
    } else if (places.length === 2) tiers.N2.push(places);
    else if (places.length === 3) tiers.T.push(places);
  }
  return tiers;
}

function emptyTierDiagnostics(
  tiers: Record<CourseV1VerificationTier, CourseV1Candidate[][]>,
): Record<CourseV1VerificationTier, CourseV1TierDiagnostics> {
  return {
    N1: { candidateCount: tiers.N1.length, attemptedCourseCount: 0, verifiedCourseCount: 0, newProviderAttemptCount: 0, stopReasons: [] },
    N2: { candidateCount: tiers.N2.length, attemptedCourseCount: 0, verifiedCourseCount: 0, newProviderAttemptCount: 0, stopReasons: [] },
    W: { candidateCount: tiers.W.length, attemptedCourseCount: 0, verifiedCourseCount: 0, newProviderAttemptCount: 0, stopReasons: [] },
    T: { candidateCount: tiers.T.length, attemptedCourseCount: 0, verifiedCourseCount: 0, newProviderAttemptCount: 0, stopReasons: [] },
  };
}

/**
 * 사전선정 순서에서 대표와 실질적으로 다른 새 추천만 남긴다.
 * 두 장소 집합이 부분집합·상위집합이면 사용자는 같은 코스의 축소/확장으로 인식하므로 함께 반환하지 않는다.
 */
export function selectNonNestedCourseV1(courses: readonly VerifiedCourseV1[]): VerifiedCourseV1[] {
  const selected: VerifiedCourseV1[] = [];
  for (const course of courses) {
    if (selected.some((existing) => hasNestedPlaceSet(course.placeIds, existing.placeIds))) continue;
    selected.push(course);
  }
  return selected;
}

/**
 * 실제 경로 검증 후의 대표·대안 세트. 1·2곳이 하나라도 유효하면 3곳은 대표로 승격하지 않는다.
 * 남는 시간을 벌점으로 쓰지 않으며, 실제 이동 부담 대비 권장 체류가 나은 코스를 앞세운다.
 */
export function selectRepresentativeCourseSetV1(courses: readonly VerifiedCourseV1[]): VerifiedCourseV1[] {
  const shortCourses = courses.filter((course) => course.placeIds.length <= 2);
  const representativePool = shortCourses.length ? shortCourses : courses;
  const sortedRepresentativePool = [...representativePool].sort(compareRepresentativeCourses);
  const representative = sortedRepresentativePool[0];
  if (!representative) return [];
  const remaining = courses.filter((course) => course.id !== representative.id).sort(compareRepresentativeCourses);
  return selectNonNestedCourseV1([representative, ...remaining]);
}

function compareRepresentativeCourses(left: VerifiedCourseV1, right: VerifiedCourseV1): number {
  const baselineStayMin = (course: VerifiedCourseV1) => course.stops.reduce(
    (sum, stop) => sum + (stop.dwellPersonalization?.baselineStayMin ?? stop.stayMin), 0,
  );
  const baselineRecommendedStopCount = (course: VerifiedCourseV1) => course.stops.filter(
    (stop) => (stop.dwellPersonalization?.baselineStayState ?? stop.stayState) === 'recommended',
  ).length;
  const personalizedTargetCount = (course: VerifiedCourseV1) => course.stops.filter(
    (stop) => stop.dwellPersonalization && stop.stayMin === stop.dwellPersonalization.targetStayMin,
  ).length;
  const leftMovementBurden = left.travelMin / Math.max(baselineStayMin(left), 1);
  const rightMovementBurden = right.travelMin / Math.max(baselineStayMin(right), 1);
  const leftRecommendedStopCount = baselineRecommendedStopCount(left);
  const rightRecommendedStopCount = baselineRecommendedStopCount(right);
  return leftMovementBurden - rightMovementBurden
    || left.travelMin - right.travelMin
    // 이동 부담과 실제 이동 시간이 같을 때만, 이미 검증된 권장 체류를 더 많이
    // 확보한 코스를 우선한다. 남는 시간을 채우기 위한 점수로는 사용하지 않는다.
    || rightRecommendedStopCount - leftRecommendedStopCount
    // 개인화는 위 기존 안전성·이동·기본 권장 품질이 같을 때만 보조 순위로 쓴다.
    || personalizedTargetCount(right) - personalizedTargetCount(left)
    || left.placeIds.length - right.placeIds.length
    || left.id.localeCompare(right.id);
}

function hasNestedPlaceSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const leftIsSubset = [...leftSet].every((id) => rightSet.has(id));
  const rightIsSubset = [...rightSet].every((id) => leftSet.has(id));
  return leftIsSubset || rightIsSubset;
}

/** 사전선정 포트폴리오는 슬롯끼리 장소를 공유하지 않아 실제로 다른 코스를 검증한다. */
function hasSharedPlace(left: readonly CourseV1Candidate[], right: readonly CourseV1Candidate[]): boolean {
  const rightIds = new Set(right.map((place) => place.id));
  return left.some((place) => rightIds.has(place.id));
}

function selectSpatialCandidatePool(
  candidates: readonly CourseV1Candidate[], origin: CourseV1Point, target: CourseV1Point, isRoundTrip: boolean,
): { candidatePool: CourseV1Candidate[]; wideSingleCandidateId?: string } {
  const seenGroups = new Set<string>();
  const spatiallyRanked = [...candidates]
    .sort((left, right) => {
      const spatial = candidateSpatialBurden(left, origin, target, isRoundTrip) - candidateSpatialBurden(right, origin, target, isRoundTrip);
      if (spatial !== 0) return spatial;
      // core 우선은 같은 공간 적합성의 동점 해소에만 작동한다.
      const core = Number(right.classification === 'representative_core') - Number(left.classification === 'representative_core');
      return core || left.id.localeCompare(right.id);
    })
    .filter((candidate) => {
      const group = candidate.siteGroupId ?? `place:${candidate.id}`;
      if (seenGroups.has(group)) return false;
      seenGroups.add(group);
      return true;
    });
  if (spatiallyRanked.length <= COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT) {
    return { candidatePool: spatiallyRanked };
  }

  // 18개 상한을 유지하면서 17개 근접 기본 후보와 한 개의 바깥 1곳 lane을 둔다.
  // 첫 18개만 자르면 19번째의 여전히 공간 관련인 단일 장소가 영구히 검증되지 않는다.
  // 18번째 후보는 이 lane의 외곽 경계 역할만 하므로 넣지 않고, 다음(기존 19번째)을
  // 출발→도착/복귀 공간 부담 순서의 대표로 선택한다.
  const baseCount = COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT - 1;
  const wideSingle = spatiallyRanked[COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT];
  return {
    candidatePool: [...spatiallyRanked.slice(0, baseCount), wideSingle],
    wideSingleCandidateId: wideSingle.id,
  };
}

function candidateSpatialBurden(candidate: CourseV1Point, origin: CourseV1Point, target: CourseV1Point, isRoundTrip: boolean): number {
  if (isRoundTrip) return planarDistanceSquared(origin, candidate) * 2;
  return planarDistanceSquared(origin, candidate) + planarDistanceSquared(candidate, target) - planarDistanceSquared(origin, target);
}

function orderedSpatialBurden(places: readonly CourseV1Candidate[], origin: CourseV1Point, target: CourseV1Point): number {
  let burden = 0;
  let current: CourseV1Point = origin;
  for (const place of places) {
    burden += planarDistanceSquared(current, place);
    current = place;
  }
  return burden + planarDistanceSquared(current, target);
}

/** 빠르고 결정적인 사전선정용 지역 평면 점수. 실제 거리·시간 단위나 결과로 노출하지 않는다. */
function planarDistanceSquared(from: CourseV1Point, to: CourseV1Point): number {
  const latScale = 111_000;
  const lonScale = 91_000;
  const lat = (from.lat - to.lat) * latScale;
  const lon = (from.lon - to.lon) * lonScale;
  return lat * lat + lon * lon;
}

type Rejection = 'routeRejected' | 'openingRejected' | 'budgetRejected';
type Verification = { kind: 'verified'; course: VerifiedCourseV1 } | { kind: 'rejected'; reason: Rejection };

async function verifyCourse(
  places: readonly CourseV1Candidate[], input: CourseV1Input, target: CourseV1Point,
  getRoute: (from: CourseV1Point, to: CourseV1Point) => Promise<ExactRoute | null>,
): Promise<Verification> {
  const legs: CourseV1Leg[] = [];
  let current: CourseV1Point = input.origin;
  let minimumElapsedMin = 0;
  for (const place of places) {
    const route = await getRoute(current, place);
    if (!route) return { kind: 'rejected', reason: 'routeRejected' };
    legs.push(courseV1Leg(current.id, place.id, route));
    minimumElapsedMin += route.min;
    const arrivalAt = new Date(input.now.getTime() + minimumElapsedMin * 60_000);
    if (!isAvailable(place.availability, arrivalAt, place.minStayMin)) return { kind: 'rejected', reason: 'openingRejected' };
    minimumElapsedMin += place.minStayMin;
    if (minimumElapsedMin + input.arrivalBufferMin > input.remainingMin) return { kind: 'rejected', reason: 'budgetRejected' };
    current = place;
  }
  const finalRoute = await getRoute(current, target);
  if (!finalRoute) return { kind: 'rejected', reason: 'routeRejected' };
  legs.push(courseV1Leg(current.id, target.id, finalRoute));
  if (minimumElapsedMin + finalRoute.min + input.arrivalBufferMin > input.remainingMin) return { kind: 'rejected', reason: 'budgetRejected' };
  const stayPlan = selectStayPlan(places, input, legs);
  // 위의 최소 체류 운영·예산 gate를 통과한 뒤에는 권장 체류를 되돌릴 뿐이다.
  // 방어적으로 null이 되면 기존 시간 예산 거절 의미를 유지한다.
  if (!stayPlan) return { kind: 'rejected', reason: 'budgetRejected' };
  const placeIds = places.map((place) => place.id);
  return {
    kind: 'verified',
    course: {
      id: placeIds.join('|'),
      placeIds,
      stops: stayPlan.stops,
      legs,
      stayMin: stayPlan.stayMin,
      travelMin: legs.reduce((total, leg) => total + leg.min, 0),
      totalMin: stayPlan.totalMin,
      arrivalBufferMin: input.arrivalBufferMin,
      remainingAfterCourseMin: input.remainingMin - stayPlan.totalMin,
      remainingAfterArrivalBufferMin: input.remainingMin - stayPlan.totalMin,
    },
  };
}

function isAvailable(availability: StructuredAvailability, arrival: Date, dwellMin: number): boolean {
  if (availability.status !== 'structured') return false;
  const dayType: CourseV1DayType = arrival.getDay() === 0 || arrival.getDay() === 6 ? 'weekend' : 'weekday';
  if (!availability.dayTypes.includes(dayType)) return false;
  if (availability.alwaysAccessible) return true;
  const startMin = arrival.getHours() * 60 + arrival.getMinutes();
  return availability.windows.some((window) => startMin >= window.startMin && startMin + dwellMin <= window.endMin);
}

function deduplicateCourses(courses: readonly VerifiedCourseV1[]): VerifiedCourseV1[] {
  const unique = new Map<string, VerifiedCourseV1>();
  for (const course of courses) {
    const key = [...course.placeIds].sort().join('|');
    const previous = unique.get(key);
    if (!previous || course.totalMin < previous.totalMin || (course.totalMin === previous.totalMin && course.id < previous.id)) {
      unique.set(key, course);
    }
  }
  return [...unique.values()];
}

/**
 * 2-Y pair-only 모듈이 one-stop과 동일한 후보·운영·체류 정책을 재사용하는 내부 경계다.
 * engine barrel에는 노출하지 않으며 UI/API가 직접 호출하지 않는다.
 */
export function selectReleaseTwoStopCandidatePoolInternal(input: CourseV1PreselectionInput): CourseV1Candidate[] {
  return selectReleaseOneStopCandidates(input).candidatePool;
}

export function isCourseV1CandidateAvailableInternal(
  candidate: CourseV1Candidate,
  arrival: Date,
  dwellMin: number,
): boolean {
  return isAvailable(candidate.availability, arrival, dwellMin);
}

export function selectCourseV1StayPlanInternal(
  places: readonly CourseV1Candidate[],
  input: Pick<CourseV1Input, 'now' | 'remainingMin' | 'arrivalBufferMin' | 'dwellPersonalizationSamples'>,
  legs: readonly CourseV1Leg[],
): { stops: CourseV1Stop[]; stayMin: number; totalMin: number } | null {
  return selectStayPlan(places, input, legs);
}

export function courseV1LegInternal(fromId: string, toId: string, route: ExactRoute): CourseV1Leg {
  return courseV1Leg(fromId, toId, route);
}

export function normalizeCourseV1ReceiptInternal(
  receipt: CourseV1RouteReceipt,
  maxNewProviderAttemptCount: 0 | 1 | 2,
): CourseV1RouteReceipt {
  return normalizeReceipt(receipt, maxNewProviderAttemptCount);
}
