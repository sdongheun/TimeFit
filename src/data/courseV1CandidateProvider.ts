import type { CourseV1Candidate, CourseV1Classification, CourseV1DayType, StructuredAvailability } from '../engine/courseV1';
import runtimeCatalog from './busan_poi_catalog.json';
import structuredAvailability from '../../data/processed/review/부산_장소_구조화_운영시간.json';

type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
type AvailabilityRow = (typeof structuredAvailability.data)[number];

export type CourseV1CatalogCandidate = CourseV1Candidate & {
  /** 근거 프로필의 재검토 기한. 엔진은 이 값을 해석하지 않고 provider가 제외한다. */
  evidenceReviewDueAt: string;
  evidenceExpired: false;
  siteRole?: string;
};

export type DiscoveryEligibility = 'representative' | 'area_access' | 'conditional';
/** 2-P가 시설형 area_access 우회를 차단할 수 있도록 전달하는 원천 장소 성격. */
export type DiscoveryPlaceKind = 'area' | 'outdoor' | 'facility';
export type DiscoveryAccessWindow = Readonly<{
  kind: 'always' | 'scheduled';
  dayTypes: readonly CourseV1DayType[];
  windows: readonly { startMin: number; endMin: number }[];
}>;
export type CourseV1DiscoveryCandidate = CourseV1CatalogCandidate & Readonly<{
  discovery: Readonly<{
    eligibility: DiscoveryEligibility;
    placeKind?: DiscoveryPlaceKind;
    accessEvidence?: Readonly<{ status: 'public_outdoor_access'; source: string; sourceId: string; checkedAt: string; sourceText: string }>;
    accessWindow?: DiscoveryAccessWindow;
    exclusionReason?: string;
  }>;
}>;

export type CourseV1ConditionalVisitCandidate = CourseV1CatalogCandidate & Readonly<{
  conditionalVisit: Readonly<{
    kind: 'market_or_street';
    displayWindow: Readonly<{ start: '10:00'; end: '18:00' }>;
    requiresUserHoursConfirmation: true;
  }>;
}>;

export type CourseV1CandidateProvider = {
  listRepresentativeCandidates(now: Date): readonly CourseV1CatalogCandidate[];
  /** DATA-AREA-01의 로컬 탐색 입력. 2-P가 대표/area_access만 소비한다. */
  listDiscoveryCandidates(now: Date): readonly CourseV1DiscoveryCandidate[];
  /** DATA-MARKET-01의 정보 확인용 입력. 대표/검증 대안 큐에는 사용하지 않는다. */
  listConditionalVisitCandidates(now: Date): readonly CourseV1ConditionalVisitCandidate[];
  fixtureSummary: Readonly<{ runtimeTotal: number; representativeTotal: number; conditionalTotal: number }>;
};

const allRuntime: readonly RuntimePlace[] = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data];
const availabilityByPlaceId = new Map<string, AvailabilityRow>(structuredAvailability.data.map((row) => [row.placeId, row]));
const representativeClassifications = new Set(['representative_core', 'representative_standard']);

function classificationFor(value: string): CourseV1Classification {
  if (value === 'representative_core' || value === 'representative_standard' || value === 'conditional_more' || value === 'hold') return value;
  throw new Error(`unknown course v1 classification: ${value}`);
}

function availabilityFor(row: AvailabilityRow): StructuredAvailability {
  if (row.status !== 'structured' && row.status !== 'needs_review') throw new Error(`${row.placeId}: unknown availability status`);
  const dayTypes = (row.dayTypes ?? []).filter((day): day is CourseV1DayType => day === 'weekday' || day === 'weekend');
  return { status: row.status, alwaysAccessible: row.alwaysAccessible ?? false, dayTypes, windows: row.windows ?? [] };
}

function toDateText(now: Date): string {
  if (Number.isNaN(now.getTime())) throw new RangeError('now must be a valid date');
  return now.toISOString().slice(0, 10);
}

function candidateFor(place: RuntimePlace): CourseV1CatalogCandidate {
  const availability = availabilityByPlaceId.get(place.contentId);
  if (!availability) throw new Error(`${place.contentId}: structured availability missing`);
  const dueAt = place.evidenceProfile.reviewDueAt;
  if (!dueAt) throw new Error(`${place.contentId}: evidence review due date missing`);
  return {
    id: place.contentId,
    title: place.title,
    lat: place.lat,
    lon: place.lon,
    classification: classificationFor(place.classification),
    minStayMin: place.shortStay.minStayMin,
    recommendedStayMin: place.shortStay.recommendedStayMin,
    maxStayMin: place.shortStay.maxStayMin,
    siteGroupId: place.siteGroupId ?? undefined,
    availability: availabilityFor(availability),
    evidenceReviewDueAt: dueAt,
    evidenceExpired: false,
  };
}

/** 카탈로그 원천 enum을 공개 탐색 계약으로만 명시 변환한다. 알 수 없는 값은 추정하지 않는다. */
function discoveryPlaceKindFor(place: RuntimePlace): DiscoveryPlaceKind | undefined {
  switch (place.evidenceProfile.placeKind) {
    case 'area': return 'area';
    case 'outdoor_route': return 'outdoor';
    case 'point_facility': return 'facility';
    default: return undefined;
  }
}

function discoveryCandidateFor(place: RuntimePlace): CourseV1DiscoveryCandidate {
  const candidate = candidateFor(place);
  const discovery = place.discovery;
  const placeKind = discoveryPlaceKindFor(place);
  // 감사 파일이나 필수 area_access 근거가 빠진 데이터는 자동 탐색으로 넘기지 않는다.
  if (discovery?.eligibility === 'area_access'
    && discovery.accessEvidence?.status === 'public_outdoor_access'
    && discovery.accessEvidence.source
    && discovery.accessEvidence.sourceId
    && discovery.accessEvidence.checkedAt
    && discovery.accessEvidence.sourceText
    && discovery.accessWindow?.kind === 'always'
    && Array.isArray(discovery.accessWindow.dayTypes)
    && Array.isArray(discovery.accessWindow.windows)
    && (placeKind === 'area' || placeKind === 'outdoor')) {
    return {
      ...candidate,
      discovery: {
        eligibility: 'area_access',
        placeKind,
        accessEvidence: {
          status: 'public_outdoor_access',
          source: discovery.accessEvidence.source,
          sourceId: discovery.accessEvidence.sourceId,
          checkedAt: discovery.accessEvidence.checkedAt,
          sourceText: discovery.accessEvidence.sourceText,
        },
        accessWindow: { kind: 'always', dayTypes: ['weekday', 'weekend'], windows: [] },
      },
    };
  }
  if (discovery?.eligibility === 'representative') return { ...candidate, discovery: { eligibility: 'representative', ...(placeKind ? { placeKind } : {}) } };
  return { ...candidate, discovery: { eligibility: 'conditional', ...(placeKind ? { placeKind } : {}), ...(discovery?.exclusionReason ? { exclusionReason: discovery.exclusionReason } : {}) } };
}

function conditionalVisitCandidateFor(place: RuntimePlace): CourseV1ConditionalVisitCandidate | null {
  const visit = place.conditionalVisit;
  if (place.classification !== 'conditional_more'
    || place.evidenceProfile.placeKind !== 'area'
    || !['시장', '거리·골목'].includes(place.subCategory ?? '')
    || visit?.kind !== 'market_or_street'
    || visit.displayWindow?.start !== '10:00'
    || visit.displayWindow?.end !== '18:00'
    || visit.requiresUserHoursConfirmation !== true) return null;
  return {
    ...candidateFor(place),
    conditionalVisit: {
      kind: 'market_or_street',
      displayWindow: { start: '10:00', end: '18:00' },
      requiresUserHoursConfirmation: true,
    },
  };
}

/**
 * 데이터 카탈로그와 구조화 운영시간을 결합하는 순수 변환 경계.
 * 네트워크·경로 계산·후보 코스 상한은 소유하지 않는다.
 */
export function createCourseV1CandidateProvider(): CourseV1CandidateProvider {
  const fixtureSummary = Object.freeze({
    runtimeTotal: allRuntime.length,
    representativeTotal: allRuntime.filter((place) => representativeClassifications.has(place.classification)).length,
    conditionalTotal: allRuntime.filter((place) => place.classification === 'conditional_more').length,
  });

  return {
    fixtureSummary,
    listRepresentativeCandidates(now) {
      const dateText = toDateText(now);
      return allRuntime
        .filter((place) => representativeClassifications.has(place.classification))
        .map(candidateFor)
        .filter((candidate) => candidate.evidenceReviewDueAt >= dateText && candidate.siteRole !== 'internal')
        .sort((left, right) => left.id.localeCompare(right.id));
    },
    listDiscoveryCandidates(now) {
      const dateText = toDateText(now);
      return allRuntime
        .map(discoveryCandidateFor)
        .filter((candidate) => candidate.evidenceReviewDueAt >= dateText && candidate.siteRole !== 'internal')
        .sort((left, right) => left.id.localeCompare(right.id));
    },
    listConditionalVisitCandidates(now) {
      const dateText = toDateText(now);
      return allRuntime
        .map(conditionalVisitCandidateFor)
        .filter((candidate): candidate is CourseV1ConditionalVisitCandidate => candidate !== null)
        .filter((candidate) => candidate.evidenceReviewDueAt >= dateText && candidate.siteRole !== 'internal')
        .sort((left, right) => left.id.localeCompare(right.id));
    },
  };
}
