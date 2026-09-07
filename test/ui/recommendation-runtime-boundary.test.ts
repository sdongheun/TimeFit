import assert from 'node:assert/strict';
import test from 'node:test';
import { createPersonalizationSessionController } from '../../src/ui/personalizationSessionModel';
import { continueReleaseRecommendationSession } from '../../src/ui/recommendation/v1Session';
import type { CourseV1LimitedResult, CourseV1ReleaseOneStopResult, CourseV1RouteAdapter, CourseV1RouteReceiptAdapter } from '../../src/engine';
import { RouteProxyUnavailableError } from '../../src/services/routeProxyActivatedCourseAdapter';
import { buildRecommendationLimitedInput, recommendationBuilderForEnvironment, recommendationPortsFor, recommendationRoutesFor, runRecommendationSession } from '../../src/ui/recommendation/v1Session';
import { recommendationInternalPolicyForEnvironment, recommendationInternalPolicyLabel } from '../../src/ui/recommendation/recommendationInternalBuildModel';

const legacy = { async getRoute() { return null; } } as CourseV1RouteAdapter;
const proxy = { async getRoute() { return null; }, async getRouteReceipt() { return { result: 'unavailable' as const, newProviderAttemptCount: 0 as const, reused: false }; } } as CourseV1RouteAdapter & CourseV1RouteReceiptAdapter;

test('B public runtime freezes samples across first/continue and blocks old-account continuation', async () => {
  const controller = createPersonalizationSessionController({ read: async () => ({ enabled: true, samples: [{ category: 'cafe', subCategory: 'coffee', dwellMin: 35 }] }) });
  controller.setAccount('fixture-account-A');
  const session = { nowIso: '2026-08-30T06:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.0 }, destination: { id: 'destination', label: '도착', lat: 35.2, lon: 129.1 }, remainingMin: 60, arrivalBufferMin: 5 };
  let samples: unknown, continued = 0;
  const diagnostics = { providerCandidateCount: 0, preselectionCandidateCount: 0, candidatePoolCount: 0, generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0, newProviderAttemptCount: 0 };
  await runRecommendationSession(session, { routeProxyEnabled: false }, {
    createLegacyRoutes: () => legacy,
    getPublicRecommendationEnvironment: () => ({}),
    readPersonalizationSnapshot: () => controller.snapshot(),
    buildRelease: async input => { samples = input.dwellPersonalizationSamples; return { representativeCourse: null, alternativeCourses: [], resultState: 'no_representative_candidates', alternativeState: 'no_candidates', diagnostics } as CourseV1ReleaseOneStopResult; },
  });
  const continuation = {} as Parameters<typeof continueReleaseRecommendationSession>[1];
  const deps = { continueRelease: (async input => { continued++; assert.equal(input.dwellPersonalizationSamples, samples); return { appendedCourses: [], continuation, pageState: 'exhausted', outcomeReasons: [], diagnostics }; }) as NonNullable<Parameters<typeof continueReleaseRecommendationSession>[2]>['continueRelease'] };
  await continueReleaseRecommendationSession(session, continuation, deps);
  assert.equal(continued, 1);
  assert.equal(Object.isFrozen(samples), true);
  assert.doesNotMatch(JSON.stringify(session), /fixture-account|dwellPersonalization|dwellMin/);
  controller.setAccount('fixture-account-B');
  assert.equal(await continueReleaseRecommendationSession(session, continuation, deps), null);
  assert.equal(continued, 1);
});

test('UCAP03-01/02: false는 legacy만, true는 activated proxy factory만 사용한다', async () => {
  let legacyCalls = 0; let proxyCalls = 0;
  const deps = { createLegacyRoutes: () => { legacyCalls += 1; return legacy; }, createActivatedProxyRoutes: async () => { proxyCalls += 1; return proxy; } };
  assert.equal(await recommendationRoutesFor({ routeProxyEnabled: false }, deps), legacy);
  assert.equal(await recommendationRoutesFor({ routeProxyEnabled: true }, deps), proxy);
  assert.deepEqual([legacyCalls, proxyCalls], [1, 1]);
});

test('UCAP03-03/04/05: one-shot token은 activated factory에만 전달하고 factory 부재는 legacy fallback 없이 typed 실패다', async () => {
  let received: string | undefined;
  await recommendationRoutesFor({ routeProxyEnabled: true, captchaToken: 'fixture-one-shot' }, { createLegacyRoutes: () => legacy, createActivatedProxyRoutes: async ({ captchaToken }) => { received = captchaToken; return proxy; } });
  assert.equal(received, 'fixture-one-shot');
  await assert.rejects(() => recommendationRoutesFor({ routeProxyEnabled: true }, { createLegacyRoutes: () => legacy }), RouteProxyUnavailableError);
});

test('UREC01-01/02: engine input은 legacy에서 receipt 없이, activated proxy에서는 같은 port를 route와 receipt에 함께 쓴다', async () => {
  const session = { nowIso: '2026-08-29T10:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.0 }, destination: { id: 'destination', label: '도착', lat: 35.2, lon: 129.1 }, remainingMin: 60, arrivalBufferMin: 5 };
  const deps = { createLegacyRoutes: () => legacy, createActivatedProxyRoutes: async () => proxy };
  const localInput = await buildRecommendationLimitedInput(session, { routeProxyEnabled: false }, deps);
  const proxyInput = await buildRecommendationLimitedInput(session, { routeProxyEnabled: true }, deps);
  assert.equal(localInput.routes, legacy);
  assert.equal(localInput.receiptRoutes, undefined);
  assert.equal(proxyInput.routes, proxy);
  assert.equal(proxyInput.receiptRoutes, proxy);
});

test('UREC01-03: activated receipt port 생성 실패는 legacy 또는 engine route 요청 없이 typed safe error로 끝난다', async () => {
  let legacyCalls = 0; let proxyCalls = 0;
  const deps = { createLegacyRoutes: () => { legacyCalls += 1; return legacy; }, createActivatedProxyRoutes: async () => { proxyCalls += 1; throw new Error('secret transport detail'); } };
  await assert.rejects(() => recommendationPortsFor({ routeProxyEnabled: true }, deps), RouteProxyUnavailableError);
  assert.deepEqual([legacyCalls, proxyCalls], [0, 1]);
});

test('URELEASEONESTOP01: exact B12 외 모든 환경은 release entry만 한 번 선택한다', async () => {
  const session = { nowIso: '2026-08-30T06:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.0 }, destination: { id: 'destination', label: '도착', lat: 35.2, lon: 129.1 }, remainingMin: 60, arrivalBufferMin: 5 };
  const result = { representativeCourse: null, alternativeCourses: [], resultState: 'no_representative_candidates', alternativeState: 'no_candidates', diagnostics: { providerCandidateCount: 0, preselectionCandidateCount: 0, candidatePoolCount: 0, generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0 } } as CourseV1LimitedResult;
  let releaseCalls = 0; let a8Calls = 0; let b12Calls = 0; let routePortCalls = 0;
  const combinations = [
    { diagnostics: 'true', internalB12: 'true', expected: 'B12' },
    { diagnostics: 'true', internalB12: 'false', expected: 'RELEASE_ONE_STOP' },
    { diagnostics: 'false', internalB12: 'true', expected: 'RELEASE_ONE_STOP' },
    { diagnostics: 'false', internalB12: 'false', expected: 'RELEASE_ONE_STOP' },
    { diagnostics: undefined, internalB12: undefined, expected: 'RELEASE_ONE_STOP' },
  ] as const;
  for (const environment of combinations) {
    const received = await runRecommendationSession(session, { routeProxyEnabled: false }, {
      createLegacyRoutes: () => { routePortCalls += 1; return legacy; },
      getPublicRecommendationEnvironment: () => environment,
      buildRelease: async () => { releaseCalls += 1; return result as CourseV1ReleaseOneStopResult; },
      buildA8: async () => { a8Calls += 1; return result; },
      buildInternalB12: async () => { b12Calls += 1; return result; },
    });
    assert.equal(received, result);
    assert.equal(recommendationInternalPolicyForEnvironment(environment), environment.expected);
  }
  assert.deepEqual([releaseCalls, a8Calls, b12Calls, routePortCalls], [4, 0, 1, 5]);
});

test('URELEASEONESTOP01: 정책 label과 builder seam은 출시 1곳과 exact B12를 구분한다', () => {
  assert.equal(recommendationInternalPolicyLabel('RELEASE_ONE_STOP'), '내부 정책: 출시 1곳');
  assert.equal(recommendationInternalPolicyLabel('B12'), '내부 정책: B12');
  const release = async () => ({}) as CourseV1ReleaseOneStopResult;
  const a8 = async () => ({}) as CourseV1LimitedResult;
  const b12 = async () => ({}) as CourseV1LimitedResult;
  assert.equal(recommendationBuilderForEnvironment({ diagnostics: 'true', internalB12: 'false' }, { buildRelease: release, buildA8: a8, buildInternalB12: b12 }), release);
  assert.equal(recommendationBuilderForEnvironment({ diagnostics: 'false', internalB12: 'true' }, { buildRelease: release, buildA8: a8, buildInternalB12: b12 }), release);
  assert.equal(recommendationBuilderForEnvironment({ diagnostics: 'true', internalB12: 'true' }, { buildRelease: release, buildA8: a8, buildInternalB12: b12 }), b12);
});
