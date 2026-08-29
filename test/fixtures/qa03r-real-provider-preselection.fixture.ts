import { createCourseV1CandidateProvider } from '../../src/data/courseV1CandidateProvider';
import {
  buildLimitedRepresentativeCourseV1,
  preselectLimitedCourseV1,
  type CourseV1Candidate,
  type CourseV1Point,
  type CourseV1RouteAdapter,
} from '../../src/engine/courseV1';

export type Qa03rScenario = {
  id: 'QA02-01' | 'QA02-02' | 'QA02-03' | 'QA02-04';
  nowIso: string;
  origin: CourseV1Point & { label: string };
  destination: (CourseV1Point & { label: string }) | null;
  remainingMin: 45 | 78 | 120 | 180;
  arrivalBufferMin: number;
};

export type Qa03rPlace = Pick<CourseV1Candidate, 'id' | 'title'>;

export type Qa03rRecord = {
  scenarioId: Qa03rScenario['id'];
  providerCandidateCount: number;
  preselectionCandidateCount: number;
  classificationOrOpeningExcluded: number;
  candidatePool: Qa03rPlace[];
  generatedOrderedCourseCount: number;
  wideSingleCandidate: Qa03rPlace | null;
  preselectedCourses: Qa03rPlace[][];
  exactCourseAttemptCount: number;
  wideSingleInCandidatePool: boolean;
  wideSingleInPreselectedCourses: boolean;
  routeSpyRequestPairs: string[];
  externalProviderCalls: 0;
  resultState: 'verified' | 'no_representative_candidates' | 'no_verified_course_within_limit';
};

/** QA-02의 입력만 재사용한다. 합성 후보·routeFallback은 이 파일에 없다. */
export const qa03rScenarios: readonly Qa03rScenario[] = [
  { id: 'QA02-01', nowIso: '2026-08-27T01:15:00.000Z', remainingMin: 45, arrivalBufferMin: 5, origin: { id: 'seomyeon-station', label: '서면역', lat: 35.1578, lon: 129.0594 }, destination: null },
  { id: 'QA02-02', nowIso: '2026-08-27T02:10:00.000Z', remainingMin: 78, arrivalBufferMin: 8, origin: { id: 'sabang-station', label: '사상역', lat: 35.1622, lon: 128.9848 }, destination: { id: 'sasang-terminal', label: '사상시외버스터미널', lat: 35.1631, lon: 128.9859 } },
  { id: 'QA02-03', nowIso: '2026-08-27T03:30:00.000Z', remainingMin: 120, arrivalBufferMin: 10, origin: { id: 'nampo-station', label: '남포역', lat: 35.0976, lon: 129.0347 }, destination: null },
  { id: 'QA02-04', nowIso: '2026-08-27T09:20:00.000Z', remainingMin: 180, arrivalBufferMin: 10, origin: { id: 'haeundae-station', label: '해운대역', lat: 35.1631, lon: 129.1588 }, destination: { id: 'dongbaek', label: '동백역', lat: 35.1684, lon: 129.1467 } },
];

export function createNullRouteSpy(): { adapter: CourseV1RouteAdapter; requestPairs: string[]; externalProviderCalls: 0 } {
  const requestPairs: string[] = [];
  return {
    adapter: {
      async getRoute(from, to) {
        requestPairs.push(`${from.id}>${to.id}`);
        return null;
      },
    },
    requestPairs,
    externalProviderCalls: 0,
  };
}

function placesFor(ids: readonly string[], byId: ReadonlyMap<string, CourseV1Candidate>): Qa03rPlace[] {
  return ids.map((id) => {
    const candidate = byId.get(id);
    if (!candidate) throw new Error(`QA-03-R provider candidate missing: ${id}`);
    return { id: candidate.id, title: candidate.title };
  });
}

/** 실제 runtime provider와 null route spy의 사전선정 원본값 하나를 만든다. */
export async function runQa03rScenario(scenario: Qa03rScenario): Promise<Qa03rRecord> {
  const now = new Date(scenario.nowIso);
  const provider = createCourseV1CandidateProvider();
  const supplied = provider.listRepresentativeCandidates(now);
  const byId = new Map(supplied.map((candidate) => [candidate.id, candidate]));
  const selection = preselectLimitedCourseV1({
    now, origin: scenario.origin, destination: scenario.destination,
    remainingMin: scenario.remainingMin, arrivalBufferMin: scenario.arrivalBufferMin, candidates: supplied,
  });
  const spy = createNullRouteSpy();
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin: scenario.origin, destination: scenario.destination,
    remainingMin: scenario.remainingMin, arrivalBufferMin: scenario.arrivalBufferMin,
    provider, routes: spy.adapter,
  });
  const preselectedCourses = result.diagnostics.preselectedCourseIds.map((courseId) => placesFor(courseId.split('|'), byId));
  const wideSingleCandidate = result.diagnostics.wideSingleCandidateId
    ? placesFor([result.diagnostics.wideSingleCandidateId], byId)[0]!
    : null;

  return {
    scenarioId: scenario.id,
    providerCandidateCount: result.diagnostics.providerCandidateCount,
    preselectionCandidateCount: result.diagnostics.preselectionCandidateCount,
    classificationOrOpeningExcluded: result.diagnostics.classificationExcluded,
    candidatePool: placesFor(selection.candidatePool.map((candidate) => candidate.id), byId),
    generatedOrderedCourseCount: result.diagnostics.generatedOrderedCourseCount,
    wideSingleCandidate,
    preselectedCourses,
    exactCourseAttemptCount: result.diagnostics.exactCourseAttemptCount,
    wideSingleInCandidatePool: wideSingleCandidate !== null && selection.candidatePool.some((candidate) => candidate.id === wideSingleCandidate.id),
    wideSingleInPreselectedCourses: wideSingleCandidate !== null && preselectedCourses.some((course) => course.some((candidate) => candidate.id === wideSingleCandidate.id)),
    routeSpyRequestPairs: spy.requestPairs,
    externalProviderCalls: spy.externalProviderCalls,
    resultState: result.resultState,
  };
}
