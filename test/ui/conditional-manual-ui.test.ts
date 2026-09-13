import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConditionalManualCourseV1Input, CourseV1LimitedResult, CourseV1RouteAdapter, CourseV1RouteReceiptAdapter } from '../../src/engine';
import { requestConditionalManualCourse, runRecommendationSession } from '../../src/ui/recommendation/v1Session';

const session = { nowIso: '2026-08-31T01:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.05 }, destination: null, remainingMin: 90, arrivalBufferMin: 10 };
const routes = { async getRoute() { return null; }, async getRouteReceipt() { return { result: 'unavailable' as const, newProviderAttemptCount: 0 as const, reused: false }; } } as CourseV1RouteAdapter & CourseV1RouteReceiptAdapter;
const noContinuationResult = { representativeCourse: null, alternativeCourses: [], resultState: 'no_representative_candidates', alternativeState: 'no_candidates', diagnostics: { providerCandidateCount: 0, preselectionCandidateCount: 0, candidatePoolCount: 0, generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0 } } as CourseV1LimitedResult;

test('URESULTS03-C: continuation 없는 최초 결과도 동일 receipt port를 화면 메모리에 보관하고 CTA 시각만큼 예산을 올림 차감한다', async () => {
  await runRecommendationSession(session, { routeProxyEnabled: true }, { createLegacyRoutes: () => routes, createActivatedProxyRoutes: async () => routes, buildA8: async () => noContinuationResult });
  const received: ConditionalManualCourseV1Input[] = [];
  const build = async (input: ConditionalManualCourseV1Input) => {
    received.push(input);
    return { state: 'rejected' as const, reason: 'time_budget_exceeded' as const, receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } };
  };
  for (const [offsetSeconds, expectedRemaining] of [[1, 89], [60, 89], [61, 88]] as const) {
    await requestConditionalManualCourse(session, 'fixture-market', new Date(new Date(session.nowIso).getTime() + offsetSeconds * 1000), { buildConditionalManual: build });
    assert.equal(received.at(-1)?.now.getTime(), new Date(session.nowIso).getTime() + offsetSeconds * 1000);
    assert.equal(received.at(-1)?.remainingMin, expectedRemaining);
    assert.equal(received.at(-1)?.receiptRoutes, routes);
  }
  assert.doesNotMatch(JSON.stringify(session), /receiptRoutes|provider|captcha/i);
});

test('URESULTS03-C 보완: receipt port 없는 화면 메모리는 legacy fallback 없이 unavailable로 끝난다', async () => {
  const noReceiptSession = { ...session, nowIso: '2026-08-31T02:00:00.000Z' };
  let legacyCalls = 0;
  await runRecommendationSession(noReceiptSession, { routeProxyEnabled: false }, { createLegacyRoutes: () => { legacyCalls += 1; return { async getRoute() { throw new Error('must not be called'); } }; }, buildA8: async () => noContinuationResult });
  const result = await requestConditionalManualCourse(noReceiptSession, 'fixture-market', new Date('2026-08-31T10:00:00+09:00'));
  assert.equal(result.state, 'unavailable');
  assert.equal(legacyCalls, 1);
  assert.deepEqual(result.receipt, { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 });
});
