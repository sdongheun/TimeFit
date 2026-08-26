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
};

export type CourseV1LimitedDiagnostics = {
  providerCandidateCount: number;
  preselectionCandidateCount: number;
  candidatePoolCount: number;
  /** 근접 기본 풀 밖에서 1곳 검증을 위해 예약한 공간 관련 후보. */
  wideSingleCandidateId?: string;
  generatedOrderedCourseCount: number;
  preselectedCourseIds: string[];
  exactCourseAttemptCount: number;
  routeRejected: number;
  openingRejected: number;
  budgetRejected: number;
  relationshipRejected: number;
  classificationExcluded: number;
};

export type CourseV1PreselectionInput = Pick<CourseV1Input, 'now' | 'origin' | 'destination' | 'remainingMin' | 'arrivalBufferMin' | 'candidates'>;
export type CourseV1PreselectionResult = {
  candidatePool: CourseV1Candidate[];
  candidateCourses: CourseV1Candidate[][];
  /** 근접 기본 풀 밖에서 1곳 검증을 위해 예약한 공간 관련 후보. */
  wideSingleCandidateId?: string;
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
  diagnostics: CourseV1LimitedDiagnostics;
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
  if (!preselection.eligibleCandidateCount) return limitedNoCourse('no_representative_candidates', diagnostics);

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
  const ranked: Array<{ places: CourseV1Candidate[]; score: number; key: string }> = [];
  for (const places of permutationsUpToThree(candidatePool)) {
    if (hasRelationshipConflict(places)) continue;
    // 실제 경로가 아니라 코스 순서의 공간적 관련성만 이용한다. 숫자는 반환하지 않는다.
    const spatialBurden = orderedSpatialBurden(places, input.origin, target);
    const score = spatialBurden;
    const key = places.map((place) => place.id).join('|');
    ranked.push({ places, score, key });
  }
  ranked.sort((left, right) => left.score - right.score || left.key.localeCompare(right.key));

  // 1곳과 서로 다른 2곳 코스에 먼저 실제 검증 기회를 주고, 3곳도 독립 대안이 될 수 있으면 넣는다.
  // 이는 시간 예산을 채우기 위한 장소 수 강제가 아니라 4개 정확 경로 상한에서의 탐색 다양성 보장이다.
  const selected: CourseV1Candidate[][] = [];
  const seenSets = new Set<string>();
  const addFirst = (placeCount: 1 | 2 | 3, requireIndependent: boolean) => {
    for (const item of ranked) {
      if (item.places.length !== placeCount) continue;
      const setKey = [...item.places.map((place) => place.id)].sort().join('|');
      if (seenSets.has(setKey)) continue;
      if (requireIndependent && selected.some((existing) => hasNestedPlaceSet(item.places.map((place) => place.id), existing.map((place) => place.id)))) continue;
      seenSets.add(setKey);
      selected.push(item.places);
      return;
    }
  };
  addFirst(1, false);
  // 근접 1곳과 별도로, 같은 자동 후보 집합의 다음 바깥 공간 구간 1곳도 실제 경로를 확인한다.
  // 인기도나 발견성 점수는 쓰지 않으며, 이 후보 역시 출발→도착/복귀 공간 부담 순서에서만 나온다.
  if (wideSingleCandidateId && selected.length < COURSE_V1_EXACT_COURSE_LIMIT) {
    const wideSingle = ranked.find((item) => item.places.length === 1 && item.places[0]?.id === wideSingleCandidateId);
    if (wideSingle) {
      seenSets.add(wideSingleCandidateId);
      selected.push(wideSingle.places);
    }
  }
  addFirst(2, true);
  // 3곳은 대표 fallback/독립 대안 가능성을 실제 경로로 확인한다. 중첩이면 검증 뒤 2-H 필터가 숨긴다.
  addFirst(3, false);
  for (const item of ranked) {
    if (selected.length === COURSE_V1_EXACT_COURSE_LIMIT) break;
    const setKey = [...item.places.map((place) => place.id)].sort().join('|');
    if (seenSets.has(setKey)) continue;
    seenSets.add(setKey);
    selected.push(item.places);
  }
  return {
    candidatePool,
    candidateCourses: selected,
    wideSingleCandidateId,
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
