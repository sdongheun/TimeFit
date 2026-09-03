import {
  buildReleaseOneStopRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1Point,
  type CourseV1ReleaseOneStopResult,
  type CourseV1RouteReceipt,
  type CourseV1RouteReceiptAdapter,
  type CourseV1RouteUnavailableReason,
  type CourseV1TravelMode,
  type StructuredAvailability,
} from '../../src/engine/courseV1';
import { releaseTimeSetupValidation } from '../../src/ui/timeSetup/releaseTimeBoundary';

export type ReleaseOneStopScenarioId =
  | 'SIM-ONE-01' | 'SIM-ONE-02' | 'SIM-ONE-03' | 'SIM-ONE-04'
  | 'SIM-ONE-05' | 'SIM-ONE-06' | 'SIM-ONE-07' | 'SIM-ONE-08';

type FixtureReceipt = Readonly<{
  result: 'exact' | 'no_route' | 'unavailable';
  mode?: CourseV1TravelMode;
  min?: number;
  reason?: CourseV1RouteUnavailableReason;
  newProviderAttemptCount?: 0 | 1 | 2;
  reused?: boolean;
}>;

export type ReleaseOneStopScenario = Readonly<{
  id: ReleaseOneStopScenarioId;
  nowIso: '2026-09-02T15:00:00+09:00';
  origin: CourseV1Point & { label: string };
  destination: (CourseV1Point & { label: string }) | null;
  remainingMin: 45 | 60 | 75 | 90 | 120;
  arrivalBufferMin: 10;
  candidates: readonly CourseV1Candidate[];
  receipts: Readonly<Record<string, FixtureReceipt>>;
}>;

export type ReleaseOneStopFixtureMeasurement = Readonly<{
  adapterCalls: number;
  newProviderAttempts: number;
  reuseCount: number;
  pairs: readonly string[];
}>;

export type ReleaseOneStopScenarioRecord = Readonly<{
  scenarioId: ReleaseOneStopScenarioId;
  now: '15:00';
  remainingMin: number;
  arrivalBufferMin: 10;
  resultState: CourseV1ReleaseOneStopResult['resultState'];
  representativePlaceId: string | null;
  alternativePlaceIds: readonly string[];
  allPlaceIds: readonly string[];
  stays: readonly { placeId: string; stayMin: number; stayState: 'recommended' | 'short' | null }[];
  totals: readonly { placeId: string; totalMin: number; remainingAfterCourseMin: number | null }[];
  diagnostics: Readonly<{
    generatedOrderedCourseCount: number;
    exactCourseAttemptCount: number;
    newProviderAttemptCount: number;
    adapterCallCount: number;
    cacheOrSessionReuseCount: number;
    outcomeReasonCounts: CourseV1ReleaseOneStopResult['diagnostics']['outcomeReasonCounts'];
  }>;
  fixture: ReleaseOneStopFixtureMeasurement;
}>;

const ALWAYS_OPEN: StructuredAvailability = {
  status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [],
};

export const closedAvailability: StructuredAvailability = {
  status: 'structured', alwaysAccessible: false, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 600, endMin: 610 }],
};

export function releaseOneStopCandidate(
  id: string,
  index: number,
  overrides: Partial<CourseV1Candidate> = {},
): CourseV1Candidate {
  return {
    id,
    title: `고정 장소 ${id}`,
    lat: 35.15 + index * 0.0001,
    lon: 129.05 + index * 0.0001,
    classification: 'representative_standard',
    minStayMin: 20,
    recommendedStayMin: 30,
    maxStayMin: 60,
    availability: ALWAYS_OPEN,
    ...overrides,
  };
}

const point = (id: string, label: string, lat: number, lon: number) => ({ id, label, lat, lon });
const exact = (min: number, mode: CourseV1TravelMode = 'walk'): FixtureReceipt => ({ result: 'exact', min, mode, newProviderAttemptCount: 1 });

function scenarioReceipts(
  origin: CourseV1Point,
  destination: CourseV1Point | null,
  candidates: readonly CourseV1Candidate[],
  overrides: Readonly<Record<string, FixtureReceipt>> = {},
): Readonly<Record<string, FixtureReceipt>> {
  const target = destination ?? origin;
  return Object.fromEntries(candidates.flatMap((candidate, index) => [
    [`${origin.id}>${candidate.id}`, exact(4 + (index % 3))],
    [`${candidate.id}>${target.id}`, exact(4 + ((index + 1) % 3))],
  ]).concat(Object.entries(overrides)));
}

function makeScenario(
  id: ReleaseOneStopScenarioId,
  origin: CourseV1Point & { label: string },
  destination: (CourseV1Point & { label: string }) | null,
  remainingMin: ReleaseOneStopScenario['remainingMin'],
  receiptOverrides: Readonly<Record<string, FixtureReceipt>> = {},
): ReleaseOneStopScenario {
  const candidates = Array.from({ length: 4 }, (_, index) => releaseOneStopCandidate(`${id.toLowerCase()}-place-${index + 1}`, index + 1));
  return {
    id, nowIso: '2026-09-02T15:00:00+09:00', origin, destination, remainingMin, arrivalBufferMin: 10,
    candidates, receipts: scenarioReceipts(origin, destination, candidates, receiptOverrides),
  };
}

const seomyeon = point('seomyeon-station', '서면역', 35.1578, 129.0594);
const sasang = point('sasang-station', '사상역', 35.1622, 128.9848);
const busan = point('busan-station', '부산역', 35.1152, 129.0422);
const nampo = point('nampo-station', '남포역', 35.0976, 129.0347);
const gwangalli = point('gwangalli-beach', '광안리해수욕장', 35.1532, 129.1187);
const centum = point('centum-city-station', '센텀시티역', 35.1691, 129.1305);
const haeundae = point('haeundae-station', '해운대역', 35.1631, 129.1588);
const dongnae = point('dongnae-station', '동래역', 35.2057, 129.0785);
const dadaepo = point('dadaepo-beach-station', '다대포해수욕장역', 35.0484, 128.9658);

const sim03First = 'sim-one-03-place-1';
const sim04First = 'sim-one-04-place-1';
export const releaseOneStopScenarios: readonly ReleaseOneStopScenario[] = [
  makeScenario('SIM-ONE-01', seomyeon, null, 45),
  makeScenario('SIM-ONE-02', seomyeon, null, 120),
  makeScenario('SIM-ONE-03', sasang, seomyeon, 90, { [`${sasang.id}>${sim03First}`]: { result: 'no_route', newProviderAttemptCount: 1 } }),
  makeScenario('SIM-ONE-04', busan, nampo, 120, { [`${busan.id}>${sim04First}`]: { result: 'unavailable', reason: 'provider', newProviderAttemptCount: 1 } }),
  makeScenario('SIM-ONE-05', gwangalli, null, 75),
  makeScenario('SIM-ONE-06', centum, haeundae, 120),
  makeScenario('SIM-ONE-07', dongnae, null, 60),
  makeScenario('SIM-ONE-08', dadaepo, null, 120),
];

export function createReleaseOneStopReceiptFixture(
  receipts: Readonly<Record<string, FixtureReceipt>>,
  fallback: FixtureReceipt = { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0 },
): { adapter: CourseV1RouteReceiptAdapter; readMeasurement: () => ReleaseOneStopFixtureMeasurement } {
  let adapterCalls = 0;
  let newProviderAttempts = 0;
  let reuseCount = 0;
  const pairs: string[] = [];
  return {
    adapter: {
      async getRouteReceipt(from, to, budget): Promise<CourseV1RouteReceipt> {
        const pair = `${from.id}>${to.id}`;
        const plan = receipts[pair] ?? fallback;
        const attempts = Math.min(plan.newProviderAttemptCount ?? 1, budget.maxNewProviderAttemptCount) as 0 | 1 | 2;
        adapterCalls += 1;
        newProviderAttempts += attempts;
        if (plan.reused) reuseCount += 1;
        pairs.push(pair);
        if (plan.result === 'exact') {
          return { result: 'exact', route: { mode: plan.mode ?? 'walk', min: plan.min ?? 5, exact: true }, newProviderAttemptCount: attempts, reused: plan.reused ?? false };
        }
        if (plan.result === 'no_route') return { result: 'no_route', newProviderAttemptCount: attempts, reused: plan.reused ?? false };
        return { result: 'unavailable', reason: plan.reason, newProviderAttemptCount: attempts, reused: plan.reused ?? false };
      },
    },
    readMeasurement: () => ({ adapterCalls, newProviderAttempts, reuseCount, pairs: [...pairs] }),
  };
}

export async function runReleaseOneStopScenario(
  scenario: ReleaseOneStopScenario,
): Promise<{ result: CourseV1ReleaseOneStopResult; record: ReleaseOneStopScenarioRecord }> {
  const preflight = releaseTimeSetupValidation(true, scenario.remainingMin);
  if (preflight) throw new RangeError(preflight);
  const fixture = createReleaseOneStopReceiptFixture(scenario.receipts);
  const result = await buildReleaseOneStopRepresentativeCourseV1({
    now: new Date(scenario.nowIso), origin: scenario.origin, destination: scenario.destination,
    remainingMin: scenario.remainingMin, arrivalBufferMin: scenario.arrivalBufferMin,
    provider: { listRepresentativeCandidates: () => scenario.candidates },
    routes: { async getRoute() { throw new Error('release one-stop fixture must use receiptRoutes'); } },
    receiptRoutes: fixture.adapter,
  });
  const courses = [result.representativeCourse, ...result.alternativeCourses].filter((course) => course !== null);
  const measurement = fixture.readMeasurement();
  return {
    result,
    record: {
      scenarioId: scenario.id, now: '15:00', remainingMin: scenario.remainingMin, arrivalBufferMin: 10,
      resultState: result.resultState,
      representativePlaceId: result.representativeCourse?.placeIds[0] ?? null,
      alternativePlaceIds: result.alternativeCourses.map((course) => course.placeIds[0]!),
      allPlaceIds: courses.map((course) => course.placeIds[0]!),
      stays: courses.map((course) => ({ placeId: course.placeIds[0]!, stayMin: course.stops[0]!.stayMin, stayState: course.stops[0]!.stayState ?? null })),
      totals: courses.map((course) => ({ placeId: course.placeIds[0]!, totalMin: course.totalMin, remainingAfterCourseMin: course.remainingAfterCourseMin ?? null })),
      diagnostics: {
        generatedOrderedCourseCount: result.diagnostics.generatedOrderedCourseCount,
        exactCourseAttemptCount: result.diagnostics.exactCourseAttemptCount,
        newProviderAttemptCount: result.diagnostics.newProviderAttemptCount ?? 0,
        adapterCallCount: result.diagnostics.adapterCallCount ?? 0,
        cacheOrSessionReuseCount: result.diagnostics.cacheOrSessionReuseCount ?? 0,
        outcomeReasonCounts: result.diagnostics.outcomeReasonCounts,
      },
      fixture: measurement,
    },
  };
}
