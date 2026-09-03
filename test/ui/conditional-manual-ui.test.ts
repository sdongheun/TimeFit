import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConditionalManualCourseV1Input, CourseV1LimitedResult, CourseV1RouteAdapter, CourseV1RouteReceiptAdapter } from '../../src/engine';
import { requestConditionalManualCourse, runRecommendationSession } from '../../src/ui/recommendation/v1Session';
import { createKeyedInFlightLock, isConditionalManualConfirmTime, runConditionalManualAction } from '../../src/ui/recommendation/verifiedCourseResultsModel';

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

test('URESULTS03-C: CTA 실제 시각만 10:00~17:59에 entry를 허용하며 18:00은 UI에서 route 0으로 끝낸다', () => {
  assert.equal(isConditionalManualConfirmTime(new Date('2026-08-31T09:59:00+09:00')), false);
  assert.equal(isConditionalManualConfirmTime(new Date('2026-08-31T10:00:00+09:00')), true);
  assert.equal(isConditionalManualConfirmTime(new Date('2026-08-31T17:59:00+09:00')), true);
  assert.equal(isConditionalManualConfirmTime(new Date('2026-08-31T18:00:00+09:00')), false);
});

test('URESULTS03-C: 같은 카드의 같은 tick 두 CTA는 동기 lock으로 한 요청만 통과한다', () => {
  const lock = createKeyedInFlightLock();
  assert.equal(lock.tryLock('fixture-market'), true);
  assert.equal(lock.tryLock('fixture-market'), false);
  assert.equal(lock.tryLock('another-market'), true);
  lock.release('fixture-market');
  assert.equal(lock.tryLock('fixture-market'), true);
});

test('URESULTS03-C 보완: 실제 CTA action은 09:59·18:00에 request/route 0이고 10:00·17:59만 typed 결과를 한 번 전달한다', async () => {
  let calls = 0;
  const request = async () => {
    calls += 1;
    return { state: 'rejected' as const, reason: 'route_not_verified' as const, receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } };
  };
  assert.deepEqual(await runConditionalManualAction(new Date('2026-08-31T09:59:00+09:00'), request), { state: 'after_window' });
  assert.deepEqual(await runConditionalManualAction(new Date('2026-08-31T18:00:00+09:00'), request), { state: 'after_window' });
  assert.equal(calls, 0);
  assert.deepEqual(await runConditionalManualAction(new Date('2026-08-31T10:00:00+09:00'), request), { state: 'rejected', reason: 'route_not_verified' });
  assert.deepEqual(await runConditionalManualAction(new Date('2026-08-31T17:59:00+09:00'), request), { state: 'rejected', reason: 'route_not_verified' });
  assert.equal(calls, 2);
});

test('URESULTS03-C 보완: pending CTA는 keyed lock으로 request 한 번만 시작하고 unavailable·throw는 raw 오류 없이 끝난다', async () => {
  const lock = createKeyedInFlightLock();
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<{ state: 'unavailable'; receipt: { adapterCallCount: 0; newProviderAttemptCount: 0; cacheOrSessionReuseCount: 0 } }>((resolve) => { release = () => resolve({ state: 'unavailable', receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } }); });
  const start = () => lock.tryLock('market') ? runConditionalManualAction(new Date('2026-08-31T10:00:00+09:00'), async () => { calls += 1; return pending; }).finally(() => lock.release('market')) : null;
  const first = start();
  const second = start();
  assert.notEqual(first, null);
  assert.equal(second, null);
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { state: 'unavailable' });
  assert.deepEqual(await runConditionalManualAction(new Date('2026-08-31T10:00:00+09:00'), async () => { throw new Error('provider raw detail'); }), { state: 'unavailable' });
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
