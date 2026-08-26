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

export type CourseV1CandidateProvider = {
  listRepresentativeCandidates(now: Date): readonly CourseV1CatalogCandidate[];
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
    siteGroupId: place.siteGroupId ?? undefined,
    availability: availabilityFor(availability),
    evidenceReviewDueAt: dueAt,
    evidenceExpired: false,
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
  };
}
