import { buildLimitedRepresentativeCourseV1, type CourseV1Candidate, type CourseV1LimitedResult, type CourseV1Point, type CourseV1RouteAdapter, type CourseV1TravelMode, type StructuredAvailability } from '../../src/engine/courseV1';

export type Qa02RouteStatus = 'ok' | 'timeout' | 'limited';
export type Qa02Provider = 'kakao' | 'tmap';
export type Qa02RoutePlan = {
  mode: CourseV1TravelMode;
  min?: number;
  status: Qa02RouteStatus;
  /** 도보는 하나를 먼저 고르고 실패할 때만 다른 제공사를 한 번 쓴다. */
  walkAttempts?: readonly Qa02Provider[];
  /** 대중교통은 Kakao만 요청한다. */
  transitAttempts?: readonly ['kakao'];
};

export type Qa02Scenario = {
  id: 'QA02-01' | 'QA02-02' | 'QA02-03' | 'QA02-04';
  nowIso: string;
  origin: CourseV1Point & { label: string };
  destination: (CourseV1Point & { label: string }) | null;
  remainingMin: 45 | 78 | 120 | 180;
  arrivalBufferMin: number;
  candidates: readonly CourseV1Candidate[];
  routePlans: Readonly<Record<string, Qa02RoutePlan>>;
  /** 명시된 pair 외 fixture 응답. 실제 API 기본값이 아니다. */
  routeFallback?: Qa02RoutePlan;
  reproduction: readonly string[];
};

export type Qa02RouteMeasurement = {
  requests: number;
  cacheHits: number;
  misses: number;
  walkProviderAttempts: Qa02Provider[];
  transitProviderAttempts: Qa02Provider[];
  outcomes: Array<{ pair: string; status: Qa02RouteStatus; mode: CourseV1TravelMode }>;
};

/** QA-03이 그대로 집계할 수 있는, 입력·결과·route 관찰값의 고정 레코드다. */
export type Qa02ScenarioRecord = {
  scenarioId: Qa02Scenario['id'];
  nowIso: string;
  confirmedOrigin: { id: string; label: string; lat: number; lon: number };
  destination: string;
  resultState: CourseV1LimitedResult['resultState'];
  alternativeState: CourseV1LimitedResult['alternativeState'];
  providerCandidateCount: number;
  preselectionCandidateCount: number;
  candidatePoolCount: number;
  generatedOrderedCourseCount: number;
  exactCourseAttemptCount: number;
  wideSingleCandidateId: string | null;
  preselectedCourseIds: string[];
  rejections: Pick<CourseV1LimitedResult['diagnostics'], 'routeRejected' | 'openingRejected' | 'budgetRejected' | 'relationshipRejected' | 'classificationExcluded'>;
  representativePlaceCount: number;
  alternativeCount: number;
  alternativeOverlapsRepresentative: boolean;
  remainingAfterCourseMin: number | null;
  route: Qa02RouteMeasurement;
};

const availability: StructuredAvailability = { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 0, endMin: 1440 }] };
const candidate = (id: string, title: string, lat: number, lon: number, options: Partial<CourseV1Candidate> = {}): CourseV1Candidate => ({ id, title, lat, lon, classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 30, availability, ...options });
const key = (from: CourseV1Point, to: CourseV1Point) => `${from.id}>${to.id}`;
const plan = (mode: CourseV1TravelMode, min: number, extra: Partial<Qa02RoutePlan> = {}): Qa02RoutePlan => ({ mode, min, status: 'ok', ...extra });

const scenarios: readonly Qa02Scenario[] = [
  {
    id: 'QA02-01', nowIso: '2026-08-27T01:15:00.000Z', remainingMin: 45, arrivalBufferMin: 5,
    origin: { id: 'seomyeon-station', label: '서면역', lat: 35.1578, lon: 129.0594 }, destination: null,
    candidates: [candidate('seomyeon-library', '부전도서관', 35.1620, 129.0602)],
    routePlans: {
      'seomyeon-station>seomyeon-library': plan('walk', 5, { walkAttempts: ['kakao'] }),
      'seomyeon-library>seomyeon-station': plan('walk', 5, { walkAttempts: ['kakao'] }),
    },
    reproduction: ['경로 설정하기', '출발지에서 서면역을 검색·확정', '도착지는 비워 현재 위치 복귀', '종료 시각을 45분 뒤, 도착 여유 5분으로 설정', '추천 결과의 상태·대표·대안·남는 시간을 기록'],
  },
  {
    id: 'QA02-02', nowIso: '2026-08-27T02:10:00.000Z', remainingMin: 78, arrivalBufferMin: 8,
    origin: { id: 'sabang-station', label: '사상역', lat: 35.1622, lon: 128.9848 }, destination: { id: 'sasang-terminal', label: '사상시외버스터미널', lat: 35.1631, lon: 128.9859 },
    candidates: [candidate('sasang-park', '사상근린공원', 35.1660, 128.9890), candidate('sasang-culture', '사상생활문화센터', 35.1597, 128.9834)],
    routePlans: {
      'sabang-station>sasang-park': plan('walk', 7, { walkAttempts: ['tmap'] }),
      'sasang-park>sasang-terminal': plan('walk', 8, { walkAttempts: ['tmap'] }),
      'sabang-station>sasang-culture': plan('walk', 5, { walkAttempts: ['kakao'] }),
      'sasang-culture>sasang-terminal': plan('walk', 6, { walkAttempts: ['kakao'] }),
      'sasang-park>sasang-culture': plan('walk', 7, { walkAttempts: ['tmap'] }),
      'sasang-culture>sasang-park': plan('walk', 7, { walkAttempts: ['kakao'] }),
    },
    reproduction: ['경로 설정하기', '출발지 사상역을 검색·확정', '도착지 사상시외버스터미널을 검색·확정', '종료 시각을 78분 뒤, 도착 여유 8분으로 설정', '검색 확정 출발지와 결과 측정값을 기록'],
  },
  {
    id: 'QA02-03', nowIso: '2026-08-27T03:30:00.000Z', remainingMin: 120, arrivalBufferMin: 10,
    origin: { id: 'nampo-station', label: '남포역', lat: 35.0976, lon: 129.0347 }, destination: null,
    candidates: [candidate('yongdusan', '용두산공원', 35.1017, 129.0320), candidate('biff', 'BIFF 광장', 35.0988, 129.0303), candidate('jagalchi', '자갈치시장', 35.0967, 129.0306)],
    routePlans: {
      'nampo-station>yongdusan': plan('walk', 8, { walkAttempts: ['kakao'] }), 'yongdusan>nampo-station': plan('walk', 8, { walkAttempts: ['kakao'] }),
      'nampo-station>biff': plan('walk', 6, { walkAttempts: ['tmap'] }), 'biff>nampo-station': plan('walk', 6, { walkAttempts: ['tmap'] }),
      'nampo-station>jagalchi': plan('walk', 7, { walkAttempts: ['kakao'] }), 'jagalchi>nampo-station': plan('walk', 7, { walkAttempts: ['kakao'] }),
      'yongdusan>biff': plan('walk', 5, { walkAttempts: ['kakao'] }), 'biff>yongdusan': plan('walk', 5, { walkAttempts: ['tmap'] }),
      'yongdusan>jagalchi': plan('walk', 6, { walkAttempts: ['tmap'] }), 'jagalchi>yongdusan': plan('walk', 6, { walkAttempts: ['kakao'] }),
      'biff>jagalchi': plan('walk', 4, { walkAttempts: ['kakao'] }), 'jagalchi>biff': plan('walk', 4, { walkAttempts: ['tmap'] }),
    },
    reproduction: ['경로 설정하기', '출발지 남포역을 검색·확정', '도착지는 비워 현재 위치 복귀', '종료 시각을 120분 뒤, 도착 여유 10분으로 설정', '대표와 대안의 장소 집합 중첩 여부를 기록'],
  },
  {
    id: 'QA02-04', nowIso: '2026-08-27T09:20:00.000Z', remainingMin: 180, arrivalBufferMin: 10,
    origin: { id: 'haeundae-station', label: '해운대역', lat: 35.1631, lon: 129.1588 }, destination: { id: 'dongbaek', label: '동백역', lat: 35.1684, lon: 129.1467 },
    candidates: [candidate('haeundae-beach', '해운대해수욕장', 35.1587, 129.1604), candidate('thebay', '더베이101', 35.1567, 129.1527), candidate('dongbaek-island', '동백섬', 35.1558, 129.1510)],
    routePlans: {
      'haeundae-station>haeundae-beach': plan('walk', 8, { walkAttempts: ['kakao', 'tmap'] }), 'haeundae-beach>dongbaek': plan('transit', 12, { transitAttempts: ['kakao'] }),
      'haeundae-station>thebay': plan('walk', 9, { walkAttempts: ['tmap'] }), 'thebay>dongbaek': plan('walk', 7, { walkAttempts: ['tmap'] }),
      'haeundae-station>dongbaek-island': plan('walk', 11, { walkAttempts: ['kakao'] }), 'dongbaek-island>dongbaek': plan('walk', 6, { walkAttempts: ['kakao'] }),
      'haeundae-beach>thebay': plan('walk', 5, { walkAttempts: ['kakao'] }), 'thebay>haeundae-beach': plan('walk', 5, { walkAttempts: ['tmap'] }),
      'haeundae-beach>dongbaek-island': plan('walk', 7, { walkAttempts: ['tmap'] }), 'dongbaek-island>haeundae-beach': plan('walk', 7, { walkAttempts: ['kakao'] }),
      'thebay>dongbaek-island': plan('walk', 4, { walkAttempts: ['kakao'] }), 'dongbaek-island>thebay': plan('walk', 4, { walkAttempts: ['tmap'] }),
    },
    reproduction: ['경로 설정하기', '출발지 해운대역과 도착지 동백역을 각각 검색·확정', '종료 시각을 180분 뒤, 도착 여유 10분으로 설정', 'provider별 route 요청·cache hit/miss·한도/timeout 여부와 결과를 기록'],
  },
];

/** 제한 엔진의 18개 풀·넓은 한 곳·분류/관계/시간 탈락을 관찰할 synthetic 후보다. */
function enrichCandidateSupply(scenario: Qa02Scenario): Qa02Scenario {
  const near = Array.from({ length: 20 }, (_, index) => candidate(
    `${scenario.id.toLowerCase()}-near-${String(index + 1).padStart(2, '0')}`,
    `${scenario.origin.label} 고정 후보 ${index + 1}`,
    scenario.origin.lat + (index + 1) * 0.00001,
    scenario.origin.lon + (index + 1) * 0.00001,
  ));
  const conditional = candidate(`${scenario.id.toLowerCase()}-conditional`, '운영시간 확인 필요 후보', scenario.origin.lat + 0.003, scenario.origin.lon, { classification: 'conditional_more' });
  const hold = candidate(`${scenario.id.toLowerCase()}-hold`, '보류 후보', scenario.origin.lat + 0.0031, scenario.origin.lon, { classification: 'hold' });
  const groupA = candidate(`${scenario.id.toLowerCase()}-group-a`, '동일 단지 A', scenario.origin.lat + 0.0032, scenario.origin.lon, { siteGroupId: `${scenario.id}-same-group` });
  const groupB = candidate(`${scenario.id.toLowerCase()}-group-b`, '동일 단지 B', scenario.origin.lat + 0.0033, scenario.origin.lon, { siteGroupId: `${scenario.id}-same-group` });
  const budget = candidate(`${scenario.id.toLowerCase()}-long-stay`, '시간 초과 활동', scenario.origin.lat + 0.0034, scenario.origin.lon, { minStayMin: 20, recommendedStayMin: 170 });
  return { ...scenario, candidates: [...scenario.candidates, ...near, conditional, hold, groupA, groupB, budget], routeFallback: plan('walk', 6, { walkAttempts: ['kakao'] }) };
}

export const qa02Scenarios = scenarios.map(enrichCandidateSupply);

/** 고정 route 계획을 실제 네트워크 없이 CourseV1 경계로 주입하고 요청/캐시 관찰값을 수집한다. */
export function createQa02RouteFixture(plans: Readonly<Record<string, Qa02RoutePlan>>, fallback: Qa02RoutePlan | undefined): { adapter: CourseV1RouteAdapter; measurement: Qa02RouteMeasurement } {
  const cache = new Map<string, Qa02RoutePlan | null>();
  const measurement: Qa02RouteMeasurement = { requests: 0, cacheHits: 0, misses: 0, walkProviderAttempts: [], transitProviderAttempts: [], outcomes: [] };
  return {
    adapter: {
      async getRoute(from, to) {
        const pair = key(from, to);
        const cached = cache.get(pair);
        const route = cached === undefined ? (plans[pair] ?? fallback ?? null) : cached;
        if (cached === undefined) {
          measurement.requests += 1;
          measurement.misses += 1;
          cache.set(pair, route);
        } else measurement.cacheHits += 1;
        if (!route) { measurement.outcomes.push({ pair, status: 'timeout', mode: 'walk' }); return null; }
        measurement.walkProviderAttempts.push(...(route.walkAttempts ?? []));
        measurement.transitProviderAttempts.push(...(route.transitAttempts ?? []));
        measurement.outcomes.push({ pair, status: route.status, mode: route.mode });
        return route.status === 'ok' && route.min ? { mode: route.mode, min: route.min, exact: true } : null;
      },
    },
    measurement,
  };
}

const overlapsRepresentative = (representative: CourseV1LimitedResult['representativeCourse'], alternatives: readonly CourseV1LimitedResult['alternativeCourses'][number][]) => representative
  ? alternatives.some((course) => course.placeIds.some((placeId) => representative.placeIds.includes(placeId)))
  : false;

/** 외부 API 없이 고정 route fixture를 주입해 QA 측정 레코드 하나를 만든다. */
export async function runQa02Scenario(scenario: Qa02Scenario, fixture = createQa02RouteFixture(scenario.routePlans, scenario.routeFallback)): Promise<{ fixture: ReturnType<typeof createQa02RouteFixture>; result: CourseV1LimitedResult; record: Qa02ScenarioRecord }> {
  const result = await buildLimitedRepresentativeCourseV1({
    now: new Date(scenario.nowIso), origin: scenario.origin, destination: scenario.destination,
    remainingMin: scenario.remainingMin, arrivalBufferMin: scenario.arrivalBufferMin,
    provider: { listRepresentativeCandidates: () => scenario.candidates }, routes: fixture.adapter,
  });
  return {
    fixture,
    result,
    record: {
      scenarioId: scenario.id,
      nowIso: scenario.nowIso,
      confirmedOrigin: { id: scenario.origin.id, label: scenario.origin.label, lat: scenario.origin.lat, lon: scenario.origin.lon },
      destination: scenario.destination?.label ?? '현재 위치 복귀',
      resultState: result.resultState,
      alternativeState: result.alternativeState,
      providerCandidateCount: result.diagnostics.providerCandidateCount,
      preselectionCandidateCount: result.diagnostics.preselectionCandidateCount,
      candidatePoolCount: result.diagnostics.candidatePoolCount,
      generatedOrderedCourseCount: result.diagnostics.generatedOrderedCourseCount,
      exactCourseAttemptCount: result.diagnostics.exactCourseAttemptCount,
      wideSingleCandidateId: result.diagnostics.wideSingleCandidateId ?? null,
      preselectedCourseIds: [...result.diagnostics.preselectedCourseIds],
      rejections: {
        routeRejected: result.diagnostics.routeRejected,
        openingRejected: result.diagnostics.openingRejected,
        budgetRejected: result.diagnostics.budgetRejected,
        relationshipRejected: result.diagnostics.relationshipRejected,
        classificationExcluded: result.diagnostics.classificationExcluded,
      },
      representativePlaceCount: result.representativeCourse?.placeIds.length ?? 0,
      alternativeCount: result.alternativeCourses.length,
      alternativeOverlapsRepresentative: overlapsRepresentative(result.representativeCourse, result.alternativeCourses),
      remainingAfterCourseMin: result.representativeCourse?.remainingAfterCourseMin ?? null,
      route: fixture.measurement,
    },
  };
}
