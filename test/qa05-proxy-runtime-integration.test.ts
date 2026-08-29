import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLimitedRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1Point,
  type CourseV1RouteAdapter,
  type CourseV1RouteReceipt,
  type CourseV1RouteReceiptAdapter,
} from '../src/engine';
import { courseV1OutcomeMessage } from '../src/ui/recommendation/courseV1OutcomeMessageModel';
import { buildRecommendationLimitedInput } from '../src/ui/recommendation/v1Session';

const nowIso = '2026-08-24T01:00:00.000Z';
const now = new Date(nowIso);

function place(id: string, input: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  return {
    id,
    title: id,
    lat: 35.15,
    lon: 129.06,
    classification: 'representative_standard',
    minStayMin: 10,
    recommendedStayMin: 15,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 0, endMin: 1440 }] },
    ...input,
  };
}

function candidateProvider(candidates: readonly CourseV1Candidate[]) {
  return { listRepresentativeCandidates: () => candidates };
}

type ReceiptPlan = Record<string, CourseV1RouteReceipt>;

function fixedProxy(plans: ReceiptPlan = {}) {
  const receiptCalls: string[] = [];
  let routeCalls = 0;
  const port: CourseV1RouteAdapter & CourseV1RouteReceiptAdapter = {
    async getRoute() {
      routeCalls += 1;
      return null;
    },
    async getRouteReceipt(from, to, budget) {
      const key = `${from.id}>${to.id}`;
      receiptCalls.push(key);
      const receipt = plans[key] ?? {
        result: 'exact' as const,
        route: { mode: 'walk' as const, min: 5, exact: true },
        newProviderAttemptCount: 1 as const,
        reused: false,
      };
      return receipt.newProviderAttemptCount <= budget.maxNewProviderAttemptCount
        ? receipt
        : { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    },
  };
  return { port, receiptCalls, get routeCalls() { return routeCalls; } };
}

const districts = [
  ['sasang', 35.1631, 128.9854], ['seomyeon', 35.1578, 129.0594], ['busan-station', 35.1151, 129.0422],
  ['nampo', 35.0969, 129.0302], ['gwanganri', 35.1531, 129.1186], ['haeundae', 35.1632, 129.1636],
] as const;

test('QA05-01: Proxy 활성 UI 조립 entry의 48 고정 입력은 receipt 예산과 adapter 상한 안에서 결정적으로 끝난다', async () => {
  const remainingMinutes = [45, 78, 120, 180] as const;
  let executed = 0;

  for (const [district, lat, lon] of districts) for (const remainingMin of remainingMinutes) for (const endpoint of ['return', 'destination'] as const) {
    const origin: CourseV1Point & { label: string } = { id: `${district}-origin`, label: district, lat, lon };
    const destination = endpoint === 'destination'
      ? { id: `${district}-destination`, label: `${district}-destination`, lat: lat + 0.002, lon: lon + 0.002 }
      : null;
    const proxy = fixedProxy();
    let legacyFactoryCalls = 0;
    let proxyFactoryCalls = 0;
    const assembled = await buildRecommendationLimitedInput(
      { nowIso, origin, destination, remainingMin, arrivalBufferMin: 5 },
      { routeProxyEnabled: true, captchaToken: 'qa05-one-shot-fixture' },
      {
        createLegacyRoutes: () => { legacyFactoryCalls += 1; return proxy.port; },
        createActivatedProxyRoutes: async () => { proxyFactoryCalls += 1; return proxy.port; },
      },
    );
    const result = await buildLimitedRepresentativeCourseV1({
      ...assembled,
      provider: candidateProvider([place(`${district}-${remainingMin}-${endpoint}`, { lat: lat + 0.001, lon: lon + 0.001 })]),
    });

    assert.equal(assembled.routes, proxy.port);
    assert.equal(assembled.receiptRoutes, proxy.port);
    assert.equal(legacyFactoryCalls, 0);
    assert.equal(proxyFactoryCalls, 1);
    assert.ok(result.representativeCourse, `${district}/${remainingMin}/${endpoint} must verify a fixed course`);
    assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
    assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
    assert.equal(proxy.routeCalls, 0, 'receipt runtime must not invoke legacy route port');
    executed += 1;
  }

  assert.equal(executed, 48);
});

test('QA05-02: no_route 탈락 뒤 뒤 후보를 보충하고, 같은 구간 재사용은 provider attempt 0으로 남는다', async () => {
  const origin = { id: 'origin', lat: 35.1578, lon: 129.0594 };
  const proxy = fixedProxy({
    'origin>a': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
    'origin>b': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
    'origin>c': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
    'origin>d': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
    'origin>e': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true },
    'e>origin': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true },
  });
  const result = await buildLimitedRepresentativeCourseV1({
    now,
    origin,
    destination: null,
    remainingMin: 90,
    arrivalBufferMin: 5,
    provider: candidateProvider(['a', 'b', 'c', 'd', 'e'].map((id, index) => place(id, { lat: origin.lat + index * 0.0001, lon: origin.lon }))),
    routes: proxy.port,
    receiptRoutes: proxy.port,
  });

  assert.deepEqual(result.representativeCourse?.placeIds, ['e']);
  assert.ok(proxy.receiptCalls.includes('origin>e'));
  assert.equal(result.diagnostics.newProviderAttemptCount ?? 0, 4);
  assert.ok((result.diagnostics.cacheOrSessionReuseCount ?? 0) >= 2, '동일 구간 재사용은 provider attempt 0으로 누적된다');
  assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
});

test('QA05-02-R: 운영 종료·시간 초과·no_route 뒤 열린 후보를 Proxy 활성 UI→engine 경계에서 보충한다', async () => {
  const origin = { id: 'origin', label: 'origin', lat: 35.1578, lon: 129.0594 };
  const proxy = fixedProxy({
    'origin>timed': { result: 'exact', route: { mode: 'walk', min: 20, exact: true }, newProviderAttemptCount: 1, reused: false },
    'timed>origin': { result: 'exact', route: { mode: 'walk', min: 20, exact: true }, newProviderAttemptCount: 1, reused: false },
    'origin>no-route': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
    'origin>open': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
    'open>origin': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
  });
  let legacyFactoryCalls = 0;
  let proxyFactoryCalls = 0;
  const assembled = await buildRecommendationLimitedInput(
    { nowIso, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5 },
    { routeProxyEnabled: true, captchaToken: 'qa05-mixed-fixture' },
    {
      createLegacyRoutes: () => { legacyFactoryCalls += 1; return proxy.port; },
      createActivatedProxyRoutes: async () => { proxyFactoryCalls += 1; return proxy.port; },
    },
  );
  const closedAtStart = place('closed', {
    lat: origin.lat + 0.00001,
    lon: origin.lon,
    availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 0, endMin: 1 }] },
  });
  const result = await buildLimitedRepresentativeCourseV1({
    ...assembled,
    provider: candidateProvider([
      closedAtStart,
      place('timed', { lat: origin.lat + 0.0001, lon: origin.lon, recommendedStayMin: 15 }),
      place('no-route', { lat: origin.lat + 0.0002, lon: origin.lon }),
      place('open', { lat: origin.lat + 0.0003, lon: origin.lon }),
    ]),
  });

  assert.equal(assembled.routes, proxy.port);
  assert.equal(assembled.receiptRoutes, proxy.port);
  assert.equal(legacyFactoryCalls, 0);
  assert.equal(proxyFactoryCalls, 1);
  assert.deepEqual(result.representativeCourse?.placeIds, ['open']);
  assert.equal(proxy.receiptCalls.some((key) => key.includes('closed')), false, '운영 종료 후보는 receipt 요청 전에 제외된다');
  assert.ok((result.diagnostics.outcomeReasonCounts?.time_budget_exceeded ?? 0) >= 1, 'exact route 뒤 시간 초과를 보존한다');
  assert.ok((result.diagnostics.outcomeReasonCounts?.route_not_verified ?? 0) >= 1, 'no_route 탈락을 보존한다');
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
  assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
  assert.equal(proxy.routeCalls, 0);
});

test('QA05-03: 8번째 attempt 뒤에는 추가 adapter/provider 요청 없이 unavailable으로 fail-closed한다', async () => {
  const origin = { id: 'origin', lat: 35.1578, lon: 129.0594 };
  const proxy = fixedProxy(Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((id) => [`origin>${id}`, { result: 'no_route', newProviderAttemptCount: 1, reused: false }])));
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    provider: candidateProvider(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((id, index) => place(id, { lat: origin.lat + index * 0.0001, lon: origin.lon }))),
    routes: proxy.port, receiptRoutes: proxy.port,
  });

  assert.equal(result.primaryOutcomeReason, 'route_verification_unavailable');
  assert.equal(result.diagnostics.newProviderAttemptCount ?? 0, 8);
  assert.equal(proxy.receiptCalls.length, 8);
  assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
});

test('QA05-04: 다섯 빈 상태는 provider·HTTP·비밀값 없는 Results UI 문구로 매핑된다', async () => {
  const origin = { id: 'origin', lat: 35.1578, lon: 129.0594 };
  const cases: Array<{ expected: Parameters<typeof courseV1OutcomeMessage>[0]; candidates: CourseV1Candidate[]; receipt: CourseV1RouteReceipt }> = [
    { expected: 'no_eligible_candidates', candidates: [place('conditional', { classification: 'conditional_more' })], receipt: { result: 'no_route', newProviderAttemptCount: 1, reused: false } },
    { expected: 'no_open_candidates', candidates: [place('closed', { availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 0, endMin: 1 }] } })], receipt: { result: 'no_route', newProviderAttemptCount: 1, reused: false } },
    { expected: 'time_budget_exceeded', candidates: [place('slow')], receipt: { result: 'exact', route: { mode: 'walk', min: 30, exact: true }, newProviderAttemptCount: 1, reused: false } },
    { expected: 'route_not_verified', candidates: [place('no-route')], receipt: { result: 'no_route', newProviderAttemptCount: 1, reused: false } },
    { expected: 'route_verification_unavailable', candidates: [place('unavailable')], receipt: { result: 'unavailable', newProviderAttemptCount: 0, reused: false } },
  ];

  for (const item of cases) {
    const proxy = fixedProxy({ 'origin>slow': item.receipt, 'slow>origin': item.receipt, 'origin>no-route': item.receipt, 'origin>unavailable': item.receipt });
    const candidate = item.candidates[0];
    const result = await buildLimitedRepresentativeCourseV1({
      now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
      provider: candidateProvider(item.candidates), routes: proxy.port,
      receiptRoutes: { async getRouteReceipt(from, to, budget) { return proxy.port.getRouteReceipt(from, to, budget); } },
    });
    assert.equal(result.primaryOutcomeReason, item.expected);
    const message = courseV1OutcomeMessage(item.expected);
    assert.ok(message);
    assert.doesNotMatch(message!, /kakao|provider|quota|http|https?:|token|jwt|cache|좌표|카카오/i);
  }
});
