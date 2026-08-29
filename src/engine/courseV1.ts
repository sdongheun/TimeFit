/**
 * 현행 대표 코스 v1의 순수 조립 경계.
 *
 * 기존 planner.ts의 장바구니·근사 배치 계약과 분리한다. 호출자는 이미 좁힌
 * 후보와 실제 경로/구조화 운영시간 adapter를 주입하며, 이 모듈은 대표 1개와
 * 검증된 대안 식별자만 결정적으로 반환한다.
 */

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
  classification: CourseV1Classification;
  minStayMin: number;
  recommendedStayMin: number;
  availability: StructuredAvailability;
  siteGroupId?: string;
};

export type ExactRoute = { mode: CourseV1TravelMode; min: number; exact: true };
export type CourseV1RouteAdapter = {
  /** null은 실패 또는 근사 폴백이다. 차량은 이 계약에 존재하지 않는다. */
  getRoute(from: CourseV1Point, to: CourseV1Point): Promise<ExactRoute | null>;
};

/** API-4-C가 engine에 전달하는 provider-neutral·비밀 없는 단일 구간 receipt. */
export type CourseV1RouteReceipt =
  | { result: 'exact'; route: ExactRoute; newProviderAttemptCount: 0 | 1 | 2; reused: boolean }
  | { result: 'no_route'; newProviderAttemptCount: 0 | 1 | 2; reused: boolean }
  | { result: 'unavailable'; newProviderAttemptCount: 0 | 1 | 2; reused: boolean };

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
};

export type CourseV1Leg = {
  fromId: string;
  toId: string;
  mode: CourseV1TravelMode;
  min: number;
};

/** 엔진이 구조화 운영시간과 권장 체류를 통과시킨 방문 스냅샷. */
export type CourseV1Stop = {
  placeId: string;
  stayMin: number;
  /** UI·저장은 카탈로그 운영시간을 다시 해석하지 않고 이 검증 상태를 사용한다. */
  availabilityState: 'structured_verified';
  /** 실제 정확 경로 후의 도착 시각(ISO 8601 UTC). */
  arrivalAt: string;
  /** 권장 체류 종료 시각(ISO 8601 UTC). */
  departureAt: string;
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

/** 화면·저장에는 전달하지 않는 사전선정 슬롯의 결정적 관찰값. */
export type CourseV1PreselectionSlots = {
  nearSingle: string | null;
  wideSingle: string | null;
  independentTwo: string | null;
  independentThree: string | null;
};

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
  diagnostics: CourseV1LimitedDiagnostics;
};

export const COURSE_V1_PROVIDER_ATTEMPT_LIMIT = 8;
export const COURSE_V1_ADAPTER_CALL_LIMIT = 24;
export const COURSE_V1_VERIFIED_COURSE_LIMIT = 9;

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
      const allowed = representative.has(candidate.classification);
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
  return route;
}

/**
 * provider와 실제 경로 adapter를 연결하는 v1의 제한된 조립 경계.
 *
 * 근사 거리/시간은 여기서 결과나 성공 판정에 사용하지 않는다. 순수 사전선정은
 * 체류시간·분류·운영가능성으로만 최대 네 코스를 고르고, 그 네 코스만 실제 경로로 검증한다.
 */
export async function buildLimitedRepresentativeCourseV1(input: CourseV1LimitedInput): Promise<CourseV1LimitedResult> {
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

  if (input.receiptRoutes) return buildReceiptBudgetedRepresentativeCourseV1(input, preselection, diagnostics);

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

async function buildReceiptBudgetedRepresentativeCourseV1(
  input: CourseV1LimitedInput,
  preselection: CourseV1PreselectionResult,
  diagnostics: CourseV1LimitedDiagnostics,
): Promise<CourseV1LimitedResult> {
  const receiptAdapter = input.receiptRoutes!;
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
    const remainingAttempts = COURSE_V1_PROVIDER_ATTEMPT_LIMIT - providerAttempts;
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
  for (const places of preselection.candidateQueue) {
    if (verified.length >= COURSE_V1_VERIFIED_COURSE_LIMIT || providerAttempts >= COURSE_V1_PROVIDER_ATTEMPT_LIMIT || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) {
      budgetStopped = true;
      break;
    }
    const setKey = places.map((place) => place.id).sort().join('|');
    if (attemptedSets.has(setKey)) continue;
    if (verified.some((course) => hasNestedPlaceSet(places.map((place) => place.id), course.placeIds))) continue;
    attemptedSets.add(setKey);
    diagnostics.exactCourseAttemptCount += 1;
    const outcome = await verifyCourseWithReceipts(places, input, target, getReceipt);
    if (outcome.kind === 'verified') verified.push(outcome.course);
    else countReason(outcome.reason);
  }

  diagnostics.preselectedCourseIds = [...attemptedSets];
  diagnostics.outcomeReasonCounts = reasonCounts;
  diagnostics.newProviderAttemptCount = providerAttempts;
  diagnostics.adapterCallCount = adapterCalls;
  diagnostics.cacheOrSessionReuseCount = reuseCount;
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
  if (receipt.newProviderAttemptCount > maxNewProviderAttemptCount) return { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
  if (receipt.result === 'exact' && exactRouteOrNull(receipt.route)) return receipt;
  if (receipt.result === 'no_route') return receipt;
  return { result: 'unavailable', newProviderAttemptCount: receipt.newProviderAttemptCount, reused: receipt.reused };
}

type ReceiptVerification =
  | { kind: 'verified'; course: VerifiedCourseV1 }
  | { kind: 'rejected'; reason: 'time_budget_exceeded' | 'route_not_verified' | 'route_verification_unavailable' };

async function verifyCourseWithReceipts(
  places: readonly CourseV1Candidate[], input: CourseV1LimitedInput, target: CourseV1Point,
  getReceipt: (from: CourseV1Point, to: CourseV1Point) => Promise<CourseV1RouteReceipt>,
): Promise<ReceiptVerification> {
  const legs: CourseV1Leg[] = []; const stops: CourseV1Stop[] = [];
  let current: CourseV1Point = input.origin; let elapsedMin = 0; let stayMin = 0;
  for (const place of places) {
    const receipt = await getReceipt(current, place);
    if (receipt.result === 'unavailable') return { kind: 'rejected', reason: 'route_verification_unavailable' };
    if (receipt.result !== 'exact') return { kind: 'rejected', reason: 'route_not_verified' };
    elapsedMin += receipt.route.min;
    const arrivalAt = new Date(input.now.getTime() + elapsedMin * 60_000);
    if (!isAvailable(place.availability, arrivalAt, place.recommendedStayMin)) return { kind: 'rejected', reason: 'time_budget_exceeded' };
    legs.push({ fromId: current.id, toId: place.id, mode: receipt.route.mode, min: receipt.route.min });
    const departureAt = new Date(arrivalAt.getTime() + place.recommendedStayMin * 60_000);
    stops.push({ placeId: place.id, stayMin: place.recommendedStayMin, availabilityState: 'structured_verified', arrivalAt: arrivalAt.toISOString(), departureAt: departureAt.toISOString() });
    elapsedMin += place.recommendedStayMin; stayMin += place.recommendedStayMin; current = place;
  }
  const finalReceipt = await getReceipt(current, target);
  if (finalReceipt.result === 'unavailable') return { kind: 'rejected', reason: 'route_verification_unavailable' };
  if (finalReceipt.result !== 'exact') return { kind: 'rejected', reason: 'route_not_verified' };
  elapsedMin += finalReceipt.route.min;
  legs.push({ fromId: current.id, toId: target.id, mode: finalReceipt.route.mode, min: finalReceipt.route.min });
  const totalMin = elapsedMin + input.arrivalBufferMin;
  if (totalMin > input.remainingMin) return { kind: 'rejected', reason: 'time_budget_exceeded' };
  const placeIds = places.map((place) => place.id);
  return { kind: 'verified', course: { id: placeIds.join('|'), placeIds, stops, legs, stayMin, travelMin: legs.reduce((total, leg) => total + leg.min, 0), totalMin, arrivalBufferMin: input.arrivalBufferMin, remainingAfterCourseMin: input.remainingMin - totalMin, remainingAfterArrivalBufferMin: input.remainingMin - totalMin } };
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
  const availability = candidate.availability;
  if (availability.status !== 'structured') return false;
  const dayType: CourseV1DayType = now.getDay() === 0 || now.getDay() === 6 ? 'weekend' : 'weekday';
  if (!availability.dayTypes.includes(dayType)) return false;
  if (availability.alwaysAccessible) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return availability.windows.some((window) => Math.max(nowMin, window.startMin) + candidate.recommendedStayMin <= window.endMin);
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
    ranked.push({ places, score, minimumStayMin: places.reduce((sum, place) => sum + place.recommendedStayMin, 0), key });
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
  return {
    candidatePool,
    candidateCourses: selected,
    candidateQueue: [...selected, ...ranked
      .filter((item) => !seenSets.has(setKeyOf(item.places)))
      .map((item) => item.places)],
    wideSingleCandidateId,
    preselectionSlots,
    generatedOrderedCourseCount: ranked.length,
    eligibleCandidateCount: eligible.length,
    classificationExcluded,
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
  const leftMovementBurden = left.travelMin / Math.max(left.stayMin, 1);
  const rightMovementBurden = right.travelMin / Math.max(right.stayMin, 1);
  return leftMovementBurden - rightMovementBurden
    || left.travelMin - right.travelMin
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
  const stops: CourseV1Stop[] = [];
  let current: CourseV1Point = input.origin;
  let elapsedMin = 0;
  let stayMin = 0;
  for (const place of places) {
    const route = await getRoute(current, place);
    if (!route) return { kind: 'rejected', reason: 'routeRejected' };
    elapsedMin += route.min;
    const arrivalAt = new Date(input.now.getTime() + elapsedMin * 60_000);
    if (!isAvailable(place.availability, arrivalAt, place.recommendedStayMin)) {
      return { kind: 'rejected', reason: 'openingRejected' };
    }
    legs.push({ fromId: current.id, toId: place.id, mode: route.mode, min: route.min });
    const departureAt = new Date(arrivalAt.getTime() + place.recommendedStayMin * 60_000);
    stops.push({
      placeId: place.id,
      stayMin: place.recommendedStayMin,
      availabilityState: 'structured_verified',
      arrivalAt: arrivalAt.toISOString(),
      departureAt: departureAt.toISOString(),
    });
    elapsedMin += place.recommendedStayMin;
    stayMin += place.recommendedStayMin;
    current = place;
  }
  const finalRoute = await getRoute(current, target);
  if (!finalRoute) return { kind: 'rejected', reason: 'routeRejected' };
  elapsedMin += finalRoute.min;
  legs.push({ fromId: current.id, toId: target.id, mode: finalRoute.mode, min: finalRoute.min });

  const totalMin = elapsedMin + input.arrivalBufferMin;
  if (totalMin > input.remainingMin) return { kind: 'rejected', reason: 'budgetRejected' };
  const placeIds = places.map((place) => place.id);
  return {
    kind: 'verified',
    course: {
      id: placeIds.join('|'),
      placeIds,
      stops,
      legs,
      stayMin,
      travelMin: legs.reduce((total, leg) => total + leg.min, 0),
      totalMin,
      arrivalBufferMin: input.arrivalBufferMin,
      remainingAfterCourseMin: input.remainingMin - totalMin,
      remainingAfterArrivalBufferMin: input.remainingMin - totalMin,
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
