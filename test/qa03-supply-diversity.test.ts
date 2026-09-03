import assert from 'node:assert/strict';
import test from 'node:test';
import { qa02Scenarios, runQa02Scenario } from './fixtures/qa02-recommendation-scenarios.fixture';

type Qa03ScenarioMeasurement = {
  scenarioId: string;
  remainingMin: number;
  representative: boolean;
  resultState: string;
  alternativeState: string;
  providerCandidateCount: number;
  preselectionCandidateCount: number;
  candidatePoolCount: number;
  generatedOrderedCourseCount: number;
  exactCourseAttemptCount: number;
  rejections: { route: number; opening: number; budget: number; relationship: number; classification: number };
  verifiedCourseCount: number;
  alternativeCount: number;
  nonOverlappingAlternativeCount: number;
  placeCountDistribution: Record<1 | 2 | 3, number>;
  wideSingleCandidateId: string | null;
  wideSinglePreselected: boolean;
  wideSingleVerified: boolean;
  initialRouteMisses: number;
  replayRouteCacheHits: number;
  providerAttempts: { kakao: number; tmap: number };
};

const emptyDistribution = (): Record<1 | 2 | 3, number> => ({ 1: 0, 2: 0, 3: 0 });

test('QA03: 생활권·시간 예산별 공급과 다양성은 QA02 원본 fixture에서 엔진 진단을 바꾸지 않고 집계한다', async () => {
  const rows: Qa03ScenarioMeasurement[] = [];
  for (const scenario of qa02Scenarios) {
    const first = await runQa02Scenario(scenario);
    const initialRouteMisses = first.record.route.misses;
    const cacheHitsBeforeReplay = first.record.route.cacheHits;
    const providerAttempts = [...first.record.route.walkProviderAttempts, ...first.record.route.transitProviderAttempts]
      .reduce((total, provider) => ({ ...total, [provider]: total[provider] + 1 }), { kakao: 0, tmap: 0 });
    const replay = await runQa02Scenario(scenario, first.fixture);
    const representative = first.result.representativeCourse;
    const courses = representative ? [representative, ...first.result.alternativeCourses] : [];
    const distribution = emptyDistribution();
    for (const course of courses) {
      const count = course.placeIds.length;
      if (count >= 1 && count <= 3) distribution[count as 1 | 2 | 3] += 1;
    }
    const nonOverlappingAlternativeCount = representative
      ? first.result.alternativeCourses.filter((course) => course.placeIds.every((placeId) => !representative.placeIds.includes(placeId))).length
      : 0;
    rows.push({
      scenarioId: scenario.id,
      remainingMin: scenario.remainingMin,
      representative: !!representative,
      resultState: first.record.resultState,
      alternativeState: first.record.alternativeState,
      providerCandidateCount: first.record.providerCandidateCount,
      preselectionCandidateCount: first.record.preselectionCandidateCount,
      candidatePoolCount: first.record.candidatePoolCount,
      generatedOrderedCourseCount: first.record.generatedOrderedCourseCount,
      exactCourseAttemptCount: first.record.exactCourseAttemptCount,
      rejections: {
        route: first.record.rejections.routeRejected,
        opening: first.record.rejections.openingRejected,
        budget: first.record.rejections.budgetRejected,
        relationship: first.record.rejections.relationshipRejected,
        classification: first.record.rejections.classificationExcluded,
      },
      verifiedCourseCount: courses.length,
      alternativeCount: first.result.alternativeCourses.length,
      nonOverlappingAlternativeCount,
      placeCountDistribution: distribution,
      wideSingleCandidateId: first.record.wideSingleCandidateId,
      wideSinglePreselected: first.record.wideSingleCandidateId !== null && first.record.preselectedCourseIds.includes(first.record.wideSingleCandidateId),
      wideSingleVerified: first.record.wideSingleCandidateId !== null && courses.some((course) => course.placeIds.includes(first.record.wideSingleCandidateId!)),
      initialRouteMisses,
      replayRouteCacheHits: replay.record.route.cacheHits - cacheHitsBeforeReplay,
      providerAttempts,
    });
  }
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.resultState), ['verified', 'verified', 'verified', 'verified']);
  assert.equal(rows.filter((row) => row.representative).length, 4);
  assert.ok(rows.every((row) => row.initialRouteMisses > 0 && row.replayRouteCacheHits > 0));
  assert.ok(rows.every((row) => row.wideSinglePreselected));
  assert.ok(rows.every((row) => row.exactCourseAttemptCount <= 4));
  assert.ok(rows.every((row) => row.rejections.classification === 3));
  assert.ok(rows.some((row) => row.rejections.budget > 0));
  assert.ok(rows.every((row) => row.verifiedCourseCount === row.alternativeCount + (row.representative ? 1 : 0)));
  console.log(`QA03 measurement ${JSON.stringify(rows)}`);
});
