import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginReleaseTwoStopSelectionV1,
  buildReleaseOneStopRepresentativeCourseV1,
  continueReleaseOneStopRepresentativeCourseV1,
  continueReleaseTwoStopSelectionV1,
  type CourseV1Candidate,
  type CourseV1RouteReceiptAdapter,
  type ReleaseTwoStopAttemptLedger,
  type ReleaseTwoStopProgressEvent,
  type VerifiedCourseV1,
} from '../src/engine';

const now = new Date('2026-09-03T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const destination = { id: 'destination', lat: 35.16, lon: 129.07 };

function place(id: string, extra: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  return {
    id, title: id, lat: 35.151, lon: 129.061,
    classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 20, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
    ...extra,
  };
}

function firstCourse(id = 'a', remainingMin = 120): VerifiedCourseV1 {
  return {
    id, placeIds: [id],
    stops: [{ placeId: id, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: new Date(now.getTime() + 5 * 60_000).toISOString(), departureAt: new Date(now.getTime() + 25 * 60_000).toISOString() }],
    legs: [
      { fromId: origin.id, toId: id, mode: 'walk', min: 5 },
      { fromId: id, toId: destination.id, mode: 'walk', min: 5 },
    ],
    stayMin: 20, travelMin: 10, totalMin: 40, arrivalBufferMin: 10,
    remainingAfterCourseMin: remainingMin - 40, remainingAfterArrivalBufferMin: remainingMin - 40,
  };
}

function ledger(extra: Partial<ReleaseTwoStopAttemptLedger> = {}): ReleaseTwoStopAttemptLedger {
  return { version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8, ...extra };
}

function exactAdapter(routeMinutes: Record<string, number> = {}, calls: string[] = []): CourseV1RouteReceiptAdapter {
  return {
    async getRouteReceipt(from, to) {
      const key = `${from.id}>${to.id}`;
      calls.push(key);
      return { result: 'exact', route: { mode: 'walk', min: routeMinutes[key] ?? 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  };
}

function request(candidates: CourseV1Candidate[], receiptRoutes: CourseV1RouteReceiptAdapter, overrides: Record<string, unknown> = {}) {
  const remainingMin = typeof overrides.remainingMin === 'number' ? overrides.remainingMin : 120;
  const selectedFirstCourse = (overrides.firstCourse as VerifiedCourseV1 | undefined) ?? firstCourse('a', remainingMin);
  return {
    now, origin, destination, remainingMin, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates },
    routes: { async getRoute() { return null; } }, receiptRoutes,
    firstCourse: selectedFirstCourse, ledger: ledger(), requestId: 'epoch-1',
    ...overrides,
  };
}

test('2-Y failure-first: 공개 entry는 A를 받은 뒤 pair-only exact 결과를 반환한다', async () => {
  const result = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], exactAdapter()));
  assert.equal(result.courses.length, 1);
  assert.deepEqual(new Set(result.courses[0]!.placeIds), new Set(['a', 'b']));
  assert.equal(result.courses[0]!.legs.length, 3);
  assert.equal(typeof continueReleaseTwoStopSelectionV1, 'function');
});

test('2-Y: 두 순서를 끝까지 비교해 한쪽 유효·이동합 최소·동률 A-first를 결정한다', async () => {
  const cases = [
    { name: 'A-first만 유효', times: {}, noRoute: new Set(['origin>b']), expected: ['a', 'b'] },
    { name: 'B-first만 유효', times: {}, noRoute: new Set(['a>b']), expected: ['b', 'a'] },
    { name: 'A-first 빠름', times: { 'a>b': 2, 'b>destination': 2, 'origin>b': 9, 'b>a': 9 }, noRoute: new Set<string>(), expected: ['a', 'b'] },
    { name: 'B-first 빠름', times: { 'a>b': 9, 'b>destination': 9, 'origin>b': 2, 'b>a': 2 }, noRoute: new Set<string>(), expected: ['b', 'a'] },
    { name: '동률 A-first', times: { 'a>b': 5, 'b>destination': 5, 'origin>b': 5, 'b>a': 5 }, noRoute: new Set<string>(), expected: ['a', 'b'] },
  ];
  for (const scenario of cases) {
    const calls: string[] = [];
    const adapter: CourseV1RouteReceiptAdapter = {
      async getRouteReceipt(from, to) {
        const key = `${from.id}>${to.id}`;
        calls.push(key);
        if (scenario.noRoute.has(key)) return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
        return { result: 'exact', route: { mode: 'walk', min: scenario.times[key as keyof typeof scenario.times] ?? 5, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    };
    const result = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], adapter));
    assert.deepEqual(result.courses[0]?.placeIds, scenario.expected, scenario.name);
    if (!scenario.noRoute.size) assert.ok(calls.includes('a>b') && calls.includes('b>a'), scenario.name);
  }
});

test('2-Y: 도착별 운영시간·두 최소 체류·final buffer 경계를 exact로 판정한다', async () => {
  const closing = { status: 'structured' as const, alwaysAccessible: false, dayTypes: ['weekday' as const], windows: [{ startMin: 600, endMin: 650 }] };
  const closed = await beginReleaseTwoStopSelectionV1(request([
    place('a'), place('b', { availability: closing }),
  ], exactAdapter({ 'origin>b': 40, 'a>b': 40 }), { remainingMin: 180 }));
  assert.equal(closed.courses.length, 0);
  assert.ok(closed.reasons.includes('second_place_closed'));

  const selectedAClosesOnReverse = await beginReleaseTwoStopSelectionV1(request([
    place('a', { availability: closing }), place('b'),
  ], {
    async getRouteReceipt(from, to) {
      const key = `${from.id}>${to.id}`;
      if (key === 'a>b') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: key === 'b>a' ? 40 : 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }, { remainingMin: 180 }));
  assert.equal(selectedAClosesOnReverse.courses.length, 0);
  assert.ok(selectedAClosesOnReverse.reasons.includes('second_place_closed'));

  const tooShort = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], exactAdapter(), { remainingMin: 64 }));
  assert.equal(tooShort.courses.length, 0);
  assert.ok(tooShort.reasons.includes('insufficient_time_for_two_stops'));
  const boundary = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], exactAdapter(), { remainingMin: 65 }));
  assert.equal(boundary.courses.length, 1);
});

test('2-Y: exact success를 1→2→3으로 점진 전달하고 기본 0/1/2 부족을 허용한다', async () => {
  const events: ReleaseTwoStopProgressEvent[] = [];
  const three = await beginReleaseTwoStopSelectionV1(request(
    ['a', 'b', 'c', 'd'].map((id) => place(id)), exactAdapter(), { onProgress: (event: ReleaseTwoStopProgressEvent) => events.push(event) },
  ));
  assert.equal(three.courses.length, 3);
  assert.deepEqual(events.filter((event) => event.type === 'candidate_verified').map((event) => event.type === 'candidate_verified' ? event.course.placeIds.find((id) => id !== 'a') : ''), ['b', 'c', 'd']);
  for (const count of [0, 1, 2]) {
    const list = [place('a'), ...Array.from({ length: count }, (_, index) => place(`b${index}`))];
    const result = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
    assert.equal(result.courses.length, count);
  }
});

test('2-Y: continue 누적 결과는 6에서 닫히고 새 후보는 페이지당 최대 3개다', async () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => place(id));
  const first = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true }; },
  }));
  const second = await continueReleaseTwoStopSelectionV1({ ...request(list, {
    async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true }; },
  }), continuation: first.continuation, ledger: first.ledger });
  assert.equal(first.courses.length, 3);
  assert.equal(second.courses.length, 3);
  assert.equal(second.continuation.verifiedCount, 6);
  let calls = 0;
  const closed = await continueReleaseTwoStopSelectionV1({
    ...request(list, { async getRouteReceipt() { calls += 1; throw new Error('must not call'); } }),
    continuation: second.continuation, ledger: second.ledger,
  });
  assert.equal(closed.state, 'exhausted');
  assert.equal(calls, 0);
});

test('2-Y: initial 8 + auto 16 + shared 12 = 36 뒤 37번째 provider attempt는 0이다', async () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map((id) => place(id));
  let calls = 0;
  const maxCost: CourseV1RouteReceiptAdapter = {
    async getRouteReceipt(_from, _to, budget) {
      calls += 1;
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: budget.maxNewProviderAttemptCount, reused: false };
    },
  };
  const automatic = await beginReleaseTwoStopSelectionV1(request(list, maxCost));
  assert.equal(automatic.ledger.automaticTwoStopAttempts, 16);
  assert.equal(automatic.ledger.totalNewProviderAttempts, 24);
  const expanded = await continueReleaseTwoStopSelectionV1({ ...request(list, maxCost, { ledger: automatic.ledger }), continuation: automatic.continuation, ledger: automatic.ledger });
  assert.equal(expanded.ledger.sharedExpansionAttempts, 12);
  assert.equal(expanded.ledger.totalNewProviderAttempts, 36);
  const callsAt36 = calls;
  const closed = await continueReleaseTwoStopSelectionV1({ ...request(list, maxCost, { ledger: expanded.ledger }), continuation: expanded.continuation, ledger: expanded.ledger });
  assert.equal(closed.state, 'exhausted');
  assert.equal(calls, callsAt36);
});

test('2-Y: one-stop shared 8회 뒤 pair more에는 4회만 남는다', async () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map((id) => place(id));
  const reuseAdapter: CourseV1RouteReceiptAdapter = { async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true }; } };
  const first = await beginReleaseTwoStopSelectionV1(request(list, reuseAdapter));
  const spent = ledger({ sharedExpansionAttempts: 8, totalNewProviderAttempts: 16 });
  const continued = await continueReleaseTwoStopSelectionV1({
    ...request(list, { async getRouteReceipt(_from, _to, budget) { return { result: 'no_route', newProviderAttemptCount: budget.maxNewProviderAttemptCount, reused: false }; } }, { ledger: spent }),
    continuation: first.continuation, ledger: spent,
  });
  assert.equal(continued.ledger.sharedExpansionAttempts, 12);
  assert.equal(continued.ledger.totalNewProviderAttempts, 20);
});

test('2-Y: cache/session reuse는 attempt 0이며 같은 directed leg를 중복 요청하지 않는다', async () => {
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request(['a', 'b', 'c'].map((id) => place(id)), {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
    },
  }));
  assert.equal(result.ledger.totalNewProviderAttempts, 8);
  assert.equal(new Set(calls).size, calls.length);
});

test('2-Y: abort는 이미 시작한 attempt를 유지하고 모든 event가 requestId로 식별된다', async () => {
  const controller = new AbortController();
  const events: ReleaseTwoStopProgressEvent[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], {
    async getRouteReceipt() {
      controller.abort();
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }, { signal: controller.signal, requestId: 'stale-epoch', onProgress: (event: ReleaseTwoStopProgressEvent) => events.push(event) }));
  assert.equal(result.ledger.totalNewProviderAttempts, 9);
  assert.ok(events.every((event) => event.requestId === 'stale-epoch' && event.firstPlaceId === 'a'));
});

test('2-Y: 같은 A result reuse는 route 0이고 다른 A branch는 별도 firstPlaceId를 쓴다', async () => {
  const list = ['a', 'b', 'c', 'd'].map((id) => place(id));
  const first = await beginReleaseTwoStopSelectionV1(request(list, { async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true }; } }));
  let calls = 0;
  const reused = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { calls += 1; throw new Error('must not call'); },
  }, { requestId: 'epoch-2', ledger: first.ledger, reuse: { courses: first.courses, continuation: first.continuation } }));
  assert.equal(calls, 0);
  assert.equal(reused.courses.length, first.courses.length);

  const branch = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter(), { firstCourse: firstCourse('b'), requestId: 'epoch-b', ledger: first.ledger }));
  assert.equal(branch.firstPlaceId, 'b');
  assert.notEqual(branch.continuation.firstCourseSignature, first.continuation.firstCourseSignature);
});

test('2-Y: tampered continuation·provider·input 불일치는 route 0 continuation_unavailable이다', async () => {
  const list = ['a', 'b', 'c', 'd'].map((id) => place(id));
  const first = await beginReleaseTwoStopSelectionV1(request(list, { async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true }; } }));
  for (const overrides of [
    { continuation: { ...first.continuation, candidateSetSignature: 'tampered' } },
    { provider: { listRepresentativeCandidates: () => [...list, place('changed')] }, continuation: first.continuation },
    { remainingMin: 119, continuation: first.continuation },
  ]) {
    let calls = 0;
    const invalid = await continueReleaseTwoStopSelectionV1({
      ...request(list, { async getRouteReceipt() { calls += 1; throw new Error('must not call'); } }, { ledger: first.ledger }),
      ledger: first.ledger, ...overrides,
    });
    assert.equal(invalid.state, 'continuation_unavailable');
    assert.equal(calls, 0);
  }
});

test('2-Y: conditional·3곳·후보별 live place API 없이 pair-only만 만든다', async () => {
  let providerReads = 0;
  const result = await beginReleaseTwoStopSelectionV1(request([
    place('a'), place('b'), place('conditional', { classification: 'conditional_more' }),
  ], exactAdapter(), { provider: { listRepresentativeCandidates: () => { providerReads += 1; return [place('a'), place('b'), place('conditional', { classification: 'conditional_more' })]; } } }));
  assert.equal(providerReads, 1);
  assert.ok(result.courses.every((course) => course.placeIds.length === 2 && course.placeIds.includes('conditional') === false));
});

test('2-Y: store/provider/limit terminal reason을 구분하고 다음 후보를 호출하지 않는다', async () => {
  for (const [receiptReason, expected] of [['store', 'store_unavailable'], ['provider', 'provider_unavailable'], ['limited', 'attempt_limit_reached']] as const) {
    const calls: string[] = [];
    const result = await beginReleaseTwoStopSelectionV1(request(['a', 'b', 'c'].map((id) => place(id)), {
      async getRouteReceipt(from, to) {
        const key = `${from.id}>${to.id}`;
        calls.push(key);
        if (key === 'a>b') return { result: 'unavailable', reason: receiptReason, newProviderAttemptCount: 1, reused: false };
        return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    }));
    assert.ok(result.reasons.includes(expected));
    assert.equal(calls.some((key) => key.includes('c')), false);
  }
});

test('2-Y: malformed ledger와 ledger reset은 route 0이며 continuation에는 민감 입력이 없다', async () => {
  for (const malformed of [
    ledger({ initialOneStopAttempts: -1, totalNewProviderAttempts: -1 }),
    ledger({ automaticTwoStopAttempts: 17, totalNewProviderAttempts: 25 }),
    ledger({ totalNewProviderAttempts: Number.NaN }),
  ]) {
    let calls = 0;
    const invalid = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], {
      async getRouteReceipt() { calls += 1; throw new Error('must not call'); },
    }, { ledger: malformed }));
    assert.equal(invalid.state, 'continuation_unavailable');
    assert.equal(calls, 0);
  }

  const first = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b'), place('c')], exactAdapter()));
  assert.equal(/"(?:lat|lon|now|provider|userId|apiKey|signal)"/i.test(JSON.stringify(first.continuation)), false);
  let resetCalls = 0;
  const reset = await continueReleaseTwoStopSelectionV1({
    ...request([place('a'), place('b'), place('c')], { async getRouteReceipt() { resetCalls += 1; throw new Error('must not call'); } }),
    continuation: first.continuation, ledger: ledger(),
  });
  assert.equal(reset.state, 'continuation_unavailable');
  assert.equal(resetCalls, 0);
});

test('2-Y: one-stop continuation의 optional shared 잔여 상한은 기존 8 기본값을 깨지 않는다', async () => {
  const list = Array.from({ length: 10 }, (_, index) => place(`p${index}`));
  const calls: string[] = [];
  const oneStopInput = {
    now, origin, destination, remainingMin: 120, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => list }, routes: { async getRoute() { return null; } },
    receiptRoutes: exactAdapter({}, calls),
  };
  const first = await buildReleaseOneStopRepresentativeCourseV1(oneStopInput);
  assert.ok(first.continuation);
  const limited = await continueReleaseOneStopRepresentativeCourseV1({ ...oneStopInput, continuation: first.continuation!, pageProviderAttemptLimit: 4 });
  assert.ok((limited.diagnostics.newProviderAttemptCount ?? 0) <= 4);

  const defaultPage = await continueReleaseOneStopRepresentativeCourseV1({ ...oneStopInput, continuation: first.continuation! });
  assert.ok((defaultPage.diagnostics.newProviderAttemptCount ?? 0) <= 8);
});
