import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1RouteAdapter, CourseV1RouteReceiptAdapter } from '../../src/engine';
import { RouteProxyUnavailableError } from '../../src/services/routeProxyActivatedCourseAdapter';
import { buildRecommendationLimitedInput, recommendationPortsFor, recommendationRoutesFor } from '../../src/ui/recommendation/v1Session';

const legacy = { async getRoute() { return null; } } as CourseV1RouteAdapter;
const proxy = { async getRoute() { return null; }, async getRouteReceipt() { return { result: 'unavailable' as const, newProviderAttemptCount: 0 as const, reused: false }; } } as CourseV1RouteAdapter & CourseV1RouteReceiptAdapter;

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
