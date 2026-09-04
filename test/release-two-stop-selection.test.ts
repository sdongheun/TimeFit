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
  type ReleaseTwoStopSelectionResult,
  type ReleaseTwoStopSessionToken,
  type ReleaseTwoStopVerifiedPairSeed,
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

function pairCourse(firstId: string, secondId: string, remainingMin = 120): VerifiedCourseV1 {
  const firstArrival = new Date(now.getTime() + 5 * 60_000);
  const firstDeparture = new Date(firstArrival.getTime() + 20 * 60_000);
  const secondArrival = new Date(firstDeparture.getTime() + 5 * 60_000);
  const secondDeparture = new Date(secondArrival.getTime() + 20 * 60_000);
  return {
    id: `${firstId}|${secondId}`,
    placeIds: [firstId, secondId],
    stops: [
      { placeId: firstId, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: firstArrival.toISOString(), departureAt: firstDeparture.toISOString() },
      { placeId: secondId, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: secondArrival.toISOString(), departureAt: secondDeparture.toISOString() },
    ],
    legs: [
      { fromId: origin.id, toId: firstId, mode: 'walk', min: 5 },
      { fromId: firstId, toId: secondId, mode: 'walk', min: 5 },
      { fromId: secondId, toId: destination.id, mode: 'walk', min: 5 },
    ],
    stayMin: 40, travelMin: 15, totalMin: 65, arrivalBufferMin: 10,
    remainingAfterCourseMin: remainingMin - 65,
    remainingAfterArrivalBufferMin: remainingMin - 65,
  };
}

function verifiedPairSeed(
  course: VerifiedCourseV1,
  source: ReleaseTwoStopSelectionResult,
  recommendationSessionToken: ReleaseTwoStopSessionToken,
): ReleaseTwoStopVerifiedPairSeed {
  return {
    course,
    recommendationSessionToken,
    inputSignature: source.continuation.inputSignature,
    providerSignature: source.continuation.providerSignature,
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

test('2-Z failure-first: 표시 완료 A+B의 endpoint leg를 재사용하고 교차 leg 두 개만 요청한다', async () => {
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request(
    [place('a'), place('b')],
    {
      async getRouteReceipt(from, to) {
        const key = `${from.id}>${to.id}`;
        calls.push(key);
        return { result: 'exact', route: { mode: 'transit', min: 7, exact: true }, newProviderAttemptCount: 2, reused: false };
      },
    },
    { verifiedOneStopCourses: [firstCourse('a'), firstCourse('b')] },
  ));

  assert.deepEqual(calls, ['a>b', 'b>a']);
  assert.equal(result.courses.length, 1);
  assert.equal(result.ledger.automaticTwoStopAttempts, 4);
  assert.equal(result.ledger.totalNewProviderAttempts, 12);
  assert.deepEqual(result.continuation.routeReceiptKeys.length, 2);
});

test('2-Z: seeded pair도 양방향 유효성·최소 이동합·동률 A-first를 그대로 판정한다', async () => {
  const cases = [
    { name: 'A-first만 유효', noRoute: new Set(['b>a']), minutes: {}, expected: ['a', 'b'] },
    { name: 'B-first만 유효', noRoute: new Set(['a>b']), minutes: {}, expected: ['b', 'a'] },
    { name: 'A-first 빠름', noRoute: new Set<string>(), minutes: { 'a>b': 2, 'b>a': 9 }, expected: ['a', 'b'] },
    { name: 'B-first 빠름', noRoute: new Set<string>(), minutes: { 'a>b': 9, 'b>a': 2 }, expected: ['b', 'a'] },
    { name: '동률 A-first', noRoute: new Set<string>(), minutes: { 'a>b': 5, 'b>a': 5 }, expected: ['a', 'b'] },
  ];
  for (const scenario of cases) {
    const calls: string[] = [];
    const result = await beginReleaseTwoStopSelectionV1(request([place('a'), place('b')], {
      async getRouteReceipt(from, to) {
        const key = `${from.id}>${to.id}`;
        calls.push(key);
        if (scenario.noRoute.has(key)) return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
        return { result: 'exact', route: { mode: 'walk', min: scenario.minutes[key as keyof typeof scenario.minutes] ?? 5, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    }, { verifiedOneStopCourses: [firstCourse('a'), firstCourse('b')] }));
    assert.deepEqual(result.courses[0]?.placeIds, scenario.expected, scenario.name);
    assert.deepEqual(calls, ['a>b', 'b>a'], scenario.name);
  }
});

test('2-Z: 유효 seed 표시 순서를 앞세우고 나머지 pool 결정 순서를 중복 없이 유지한다', async () => {
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request(
    ['a', 'b', 'c', 'd'].map((id) => place(id)),
    exactAdapter({}, calls),
    { verifiedOneStopCourses: [firstCourse('d'), firstCourse('b'), firstCourse('d')] },
  ));
  assert.deepEqual(result.courses.map((course) => course.placeIds.find((id) => id !== 'a')), ['d', 'b', 'c']);
  assert.deepEqual(result.continuation.orderedCandidateIds, ['d', 'b', 'c']);
  assert.deepEqual(calls.slice(0, 4), ['a>d', 'd>a', 'a>b', 'b>a']);
});

test('2-Z: 손상 seed는 신뢰하지 않지만 후보는 제거하지 않고 adapter fallback으로 검증한다', async () => {
  const malformed = { ...firstCourse('b'), totalMin: 999 };
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request(
    [place('a'), place('b')], exactAdapter({}, calls),
    { verifiedOneStopCourses: [malformed] },
  ));
  assert.equal(result.courses.length, 1);
  assert.deepEqual(calls, ['a>b', 'b>destination', 'origin>b', 'b>a']);

  const rejected = await beginReleaseTwoStopSelectionV1(request(
    [place('a', { siteGroupId: 'same-site' }), place('b'), place('outside', { siteGroupId: 'same-site' }), place('conditional', { classification: 'conditional_more' })],
    { async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; } },
    { verifiedOneStopCourses: [malformed, firstCourse('outside'), firstCourse('conditional')] },
  ));
  assert.equal(rejected.courses.length, 0);
});

test('2-Z: endpoint·mode·geometry가 비정상인 seed는 각각 exact cache로 승격하지 않는다', async () => {
  const base = firstCourse('b');
  const malformedSeeds: VerifiedCourseV1[] = [
    { ...base, legs: [{ ...base.legs[0]!, fromId: 'other-origin' }, base.legs[1]!] },
    { ...base, legs: [{ ...base.legs[0]!, mode: 'car' as 'walk' }, base.legs[1]!] },
    { ...base, legs: [{ ...base.legs[0]!, geometry: { paths: [{ points: [{ lat: 999, lon: 129 }, { lat: 35, lon: 129 }] }] } }, base.legs[1]!] },
  ];
  for (const malformedSeed of malformedSeeds) {
    const calls: string[] = [];
    const result = await beginReleaseTwoStopSelectionV1(request(
      [place('a'), place('b')], exactAdapter({}, calls),
      { verifiedOneStopCourses: [malformedSeed] },
    ));
    assert.equal(result.courses.length, 1);
    assert.ok(calls.includes('origin>b') && calls.includes('b>destination'));
  }
});

test('2-Z: one-stop 때 열렸던 B도 pair의 새 도착시각에 닫히면 거절한다', async () => {
  const closing = { status: 'structured' as const, alwaysAccessible: false, dayTypes: ['weekday' as const], windows: [{ startMin: 600, endMin: 650 }] };
  const result = await beginReleaseTwoStopSelectionV1(request(
    [place('a'), place('b', { availability: closing })],
    {
      async getRouteReceipt(from, to) {
        const key = `${from.id}>${to.id}`;
        if (key === 'b>a') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
        return { result: 'exact', route: { mode: 'walk', min: key === 'a>b' ? 30 : 5, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    },
    { remainingMin: 180, verifiedOneStopCourses: [firstCourse('b', 180)], firstCourse: firstCourse('a', 180) },
  ));
  assert.equal(result.courses.length, 0);
  assert.ok(result.reasons.includes('second_place_closed'));
});

test('2-Z: seed mode/min/geometry는 보존하고 pair 체류·합계는 현재 입력에서 다시 계산한다', async () => {
  const geometry = { paths: [{ points: [{ lat: 35.15, lon: 129.06 }, { lat: 35.151, lon: 129.061 }] }] } as const;
  const aSeed: VerifiedCourseV1 = {
    ...firstCourse('a'),
    legs: [
      { fromId: 'origin', toId: 'a', mode: 'transit', min: 5, geometry },
      { fromId: 'a', toId: 'destination', mode: 'walk', min: 5 },
    ],
  };
  const result = await beginReleaseTwoStopSelectionV1(request(
    [place('a'), place('b')], exactAdapter({ 'a>b': 4, 'b>a': 9 }),
    { firstCourse: aSeed, verifiedOneStopCourses: [firstCourse('b')] },
  ));
  assert.equal(result.courses[0]?.legs[0]?.mode, 'transit');
  assert.deepEqual(result.courses[0]?.legs[0]?.geometry, geometry);
  assert.equal(result.courses[0]?.stayMin, 40);
  assert.equal(result.courses[0]?.totalMin, 5 + 4 + 5 + 40 + 10);
});

test('2-Z: 같은 frozen seed로 continue하고 누락·재정렬 seed는 route 0으로 거절한다', async () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => place(id));
  const seeds = ['b', 'c', 'd', 'e', 'f', 'g'].map((id) => firstCourse(id));
  const first = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter(), { verifiedOneStopCourses: seeds }));
  const continued = await continueReleaseTwoStopSelectionV1({
    ...request(list, exactAdapter(), { verifiedOneStopCourses: seeds, ledger: first.ledger }),
    continuation: first.continuation,
    ledger: first.ledger,
  });
  assert.equal(continued.courses.length, 3);
  for (const changedSeeds of [undefined, [seeds[1]!, seeds[0]!, ...seeds.slice(2)]]) {
    let calls = 0;
    const invalid = await continueReleaseTwoStopSelectionV1({
      ...request(list, { async getRouteReceipt() { calls += 1; throw new Error('must not call'); } }, {
        verifiedOneStopCourses: changedSeeds,
        ledger: first.ledger,
      }),
      continuation: first.continuation,
      ledger: first.ledger,
    });
    assert.equal(invalid.state, 'continuation_unavailable');
    assert.equal(calls, 0);
  }
  assert.equal(/verifiedOneStopCourses|geometry|latitude|longitude/.test(JSON.stringify(first.continuation)), false);
});

test('2-Z: 첫 seeded B 실패 뒤 non-seeded 후보를 검증하며 exact event는 완료 전에 한 번만 발생한다', async () => {
  const events: ReleaseTwoStopProgressEvent[] = [];
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request(['a', 'b', 'c'].map((id) => place(id)), {
    async getRouteReceipt(from, to) {
      const key = `${from.id}>${to.id}`;
      calls.push(key);
      if (key === 'a>b' || key === 'b>a') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }, {
    verifiedOneStopCourses: [firstCourse('b')],
    onProgress: (event: ReleaseTwoStopProgressEvent) => events.push(event),
  }));
  assert.deepEqual(result.courses.map((course) => course.placeIds), [['a', 'c']]);
  const verifiedIndexes = events.flatMap((event, index) => event.type === 'candidate_verified' ? [index] : []);
  assert.equal(verifiedIndexes.length, 1);
  assert.ok(verifiedIndexes[0]! < events.findIndex((event) => event.type === 'completed'));
  assert.deepEqual(calls.slice(0, 2), ['a>b', 'b>a']);
});

test('2-Z: seed 미제공과 빈 배열은 기존 2-Y 호출·결과·ledger를 바꾸지 않는다', async () => {
  const runs = [];
  for (const verifiedOneStopCourses of [undefined, []] as const) {
    const calls: string[] = [];
    const result = await beginReleaseTwoStopSelectionV1(request(
      [place('a'), place('b')], exactAdapter({}, calls), { verifiedOneStopCourses },
    ));
    runs.push({ calls, places: result.courses.map((course) => course.placeIds), ledger: result.ledger });
  }
  assert.deepEqual(runs[0], runs[1]);
  assert.equal(runs[0]!.calls.length, 6);
});

test('2-AA failure-first: 같은 session exact pair를 반대 A branch에서 adapter 0회로 재사용한다', async () => {
  const list = [place('a'), place('b')];
  const recommendationSessionToken = {};
  const first = await beginReleaseTwoStopSelectionV1(request(
    list,
    exactAdapter(),
    { verifiedOneStopCourses: [firstCourse('a'), firstCourse('b')] },
  ));
  assert.equal(first.courses.length, 1);

  let reverseCalls = 0;
  const reverse = await beginReleaseTwoStopSelectionV1(request(
    list,
    { async getRouteReceipt() { reverseCalls += 1; throw new Error('verified pair seed must be route 0'); } },
    {
      firstCourse: firstCourse('b'),
      verifiedOneStopCourses: [firstCourse('a'), firstCourse('b')],
      recommendationSessionToken,
      verifiedPairCourses: [{
        course: first.courses[0]!, recommendationSessionToken,
        inputSignature: first.continuation.inputSignature,
        providerSignature: first.continuation.providerSignature,
      }],
      ledger: first.ledger,
      requestId: 'epoch-reverse',
    },
  ));

  assert.equal(reverseCalls, 0);
  assert.equal(reverse.courses[0], first.courses[0]);
  assert.deepEqual(reverse.courses[0]?.placeIds, ['a', 'b']);
  assert.deepEqual(reverse.ledger, first.ledger);
});

test('2-AA: 원 snapshot이 B→A여도 역선택에서 방문 순서·legs·stop 시각을 바꾸지 않는다', async () => {
  const list = [place('a'), place('b')];
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const original = pairCourse('b', 'a');
  const result = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { throw new Error('must not call'); },
  }, {
    firstCourse: firstCourse('a'), recommendationSessionToken: token,
    verifiedPairCourses: [verifiedPairSeed(original, source, token)],
  }));
  assert.equal(result.courses[0], original);
  assert.deepEqual(result.courses[0]?.placeIds, ['b', 'a']);
  assert.deepEqual(result.courses[0]?.legs, original.legs);
  assert.deepEqual(result.courses[0]?.stops, original.stops);
});

test('2-AA: automatic 16 소진 뒤에도 pair seed 1개는 0-call 반환하고 미검증 후보는 호출하지 않는다', async () => {
  const list = [place('a'), place('b'), place('c')];
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const exhausted = ledger({ automaticTwoStopAttempts: 16, totalNewProviderAttempts: 24 });
  let calls = 0;
  const result = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { calls += 1; throw new Error('budget 0 must not call'); },
  }, {
    firstCourse: firstCourse('b'), recommendationSessionToken: token,
    verifiedPairCourses: [verifiedPairSeed(pairCourse('a', 'b'), source, token)],
    ledger: exhausted,
  }));
  assert.equal(calls, 0);
  assert.deepEqual(result.courses.map((course) => course.placeIds), [['a', 'b']]);
  assert.deepEqual(result.ledger, exhausted);
  assert.equal(result.continuation.stopReason, 'attempt_limit_reached');
});

test('2-AA: seed 1개 뒤 남은 예산으로 신규 2개만 더해 initial 3을 중복 없이 채운다', async () => {
  const list = ['a', 'b', 'c', 'd'].map((id) => place(id));
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter({}, calls), {
    recommendationSessionToken: token,
    verifiedPairCourses: [verifiedPairSeed(pairCourse('a', 'b'), source, token)],
  }));
  assert.deepEqual(result.courses.map((course) => course.placeIds), [['a', 'b'], ['a', 'c'], ['a', 'd']]);
  assert.equal(result.continuation.verifiedCount, 3);
  assert.equal(calls.some((key) => key === 'a>b' || key === 'b>a'), false);
});

test('2-AA: pair seed 6개는 입력 결정 순서로 initial 3·continue 3만 반환한다', async () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => place(id));
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; },
  }));
  const seeds = ['d', 'b', 'g', 'c', 'f', 'e'].map((id) => verifiedPairSeed(pairCourse('a', id), source, token));
  let calls = 0;
  const noCallAdapter: CourseV1RouteReceiptAdapter = { async getRouteReceipt() { calls += 1; throw new Error('must not call'); } };
  const first = await beginReleaseTwoStopSelectionV1(request(list, noCallAdapter, {
    recommendationSessionToken: token, verifiedPairCourses: seeds,
  }));
  const second = await continueReleaseTwoStopSelectionV1({
    ...request(list, noCallAdapter, {
      recommendationSessionToken: token, verifiedPairCourses: seeds, ledger: first.ledger,
    }),
    continuation: first.continuation,
    ledger: first.ledger,
  });
  assert.equal(calls, 0);
  assert.deepEqual(first.courses.map((course) => course.placeIds[1]), ['d', 'b', 'g']);
  assert.deepEqual(second.courses.map((course) => course.placeIds[1]), ['c', 'f', 'e']);
  assert.equal(second.continuation.verifiedCount, 6);

  let tamperedCalls = 0;
  const tampered = await continueReleaseTwoStopSelectionV1({
    ...request(list, { async getRouteReceipt() { tamperedCalls += 1; throw new Error('must not call'); } }, {
      recommendationSessionToken: token,
      verifiedPairCourses: [seeds[1]!, seeds[0]!, ...seeds.slice(2)],
      ledger: first.ledger,
    }),
    continuation: first.continuation,
    ledger: first.ledger,
  });
  assert.equal(tampered.state, 'continuation_unavailable');
  assert.equal(tamperedCalls, 0);
  assert.equal(/verifiedPairCourses|recommendationSessionToken|"course"/.test(JSON.stringify(first.continuation)), false);
});

test('2-AA: 다른 session·input/provider signature와 abort에서는 pair seed를 재사용하지 않는다', async () => {
  const list = [place('a'), place('b')];
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const validSeed = verifiedPairSeed(pairCourse('a', 'b'), source, token);
  const aborted = new AbortController();
  aborted.abort();
  const changedOrigin = { id: 'changed-origin', lat: 35.14, lon: 129.05 };
  const changedDestination = { id: 'changed-destination', lat: 35.17, lon: 129.08 };
  const bufferFirst = {
    ...firstCourse('a'), arrivalBufferMin: 11, totalMin: 41,
    remainingAfterCourseMin: 79, remainingAfterArrivalBufferMin: 79,
  };
  const cases = [
    { recommendationSessionToken: {}, verifiedPairCourses: [validSeed] },
    { recommendationSessionToken: token, verifiedPairCourses: [{ ...validSeed, inputSignature: 'stale-input' }] },
    { recommendationSessionToken: token, verifiedPairCourses: [{ ...validSeed, providerSignature: 'stale-provider' }] },
    { recommendationSessionToken: token, verifiedPairCourses: [validSeed], signal: aborted.signal },
    { recommendationSessionToken: token, verifiedPairCourses: [validSeed], now: new Date(now.getTime() + 60_000) },
    { recommendationSessionToken: token, verifiedPairCourses: [validSeed], remainingMin: 119, firstCourse: firstCourse('a', 119) },
    { recommendationSessionToken: token, verifiedPairCourses: [validSeed], arrivalBufferMin: 11, firstCourse: bufferFirst },
    {
      recommendationSessionToken: token, verifiedPairCourses: [validSeed], origin: changedOrigin,
      firstCourse: { ...firstCourse('a'), legs: [{ ...firstCourse('a').legs[0]!, fromId: changedOrigin.id }, firstCourse('a').legs[1]!] },
    },
    {
      recommendationSessionToken: token, verifiedPairCourses: [validSeed], destination: changedDestination,
      firstCourse: { ...firstCourse('a'), legs: [firstCourse('a').legs[0]!, { ...firstCourse('a').legs[1]!, toId: changedDestination.id }] },
    },
    {
      recommendationSessionToken: token, verifiedPairCourses: [validSeed],
      provider: { listRepresentativeCandidates: () => [...list, place('catalog-changed')] },
    },
  ];
  for (const overrides of cases) {
    let calls = 0;
    const result = await beginReleaseTwoStopSelectionV1(request(list, {
      async getRouteReceipt() { calls += 1; return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; },
    }, overrides));
    assert.equal(result.courses.length, 0);
    if (overrides.signal) assert.equal(calls, 0);
  }
});

test('2-AA: pool/조건부/site-group·손상 pair는 false verified 없이 무시한다', async () => {
  const list = [
    place('a', { siteGroupId: 'same' }), place('b'), place('same-site', { siteGroupId: 'same' }),
    place('conditional', { classification: 'conditional_more' }),
  ];
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const badTotal = { ...pairCourse('a', 'b'), totalMin: 999 };
  const badLeg = { ...pairCourse('a', 'b'), legs: [{ ...pairCourse('a', 'b').legs[0]!, fromId: 'wrong' }, ...pairCourse('a', 'b').legs.slice(1)] };
  const badArrival = { ...pairCourse('a', 'b'), stops: [{ ...pairCourse('a', 'b').stops[0]!, arrivalAt: now.toISOString() }, pairCourse('a', 'b').stops[1]!] };
  const seeds = [badTotal, badLeg, badArrival, pairCourse('a', 'same-site'), pairCourse('a', 'conditional')]
    .map((course) => verifiedPairSeed(course, source, token));
  const result = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; },
  }, { recommendationSessionToken: token, verifiedPairCourses: seeds }));
  assert.equal(result.courses.length, 0);
  assert.equal(result.continuation.verifiedCount, 0);
});

test('2-AA: 순서 없는 pair key는 AB/BA만 합치고 AC는 별도 seed로 유지한다', async () => {
  const list = [place('a'), place('b'), place('c')];
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const ab = pairCourse('a', 'b');
  const ba = pairCourse('b', 'a');
  const ac = pairCourse('a', 'c');
  const result = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { throw new Error('must not call'); },
  }, {
    recommendationSessionToken: token,
    verifiedPairCourses: [ab, ba, ac].map((course) => verifiedPairSeed(course, source, token)),
  }));
  assert.deepEqual(result.courses, [ab, ac]);
  assert.equal(result.continuation.verifiedPairSignatures.length, 2);
});

test('2-AA: same-A reuse와 pair/one-stop seed가 함께 있어도 course·count·호출을 중복하지 않는다', async () => {
  const list = [place('a'), place('b')];
  const token = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, exactAdapter()));
  const seeds = [verifiedPairSeed(pairCourse('a', 'b'), source, token)];
  const first = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { throw new Error('pair seed must be route 0'); },
  }, {
    recommendationSessionToken: token,
    verifiedOneStopCourses: [firstCourse('a'), firstCourse('b')],
    verifiedPairCourses: seeds,
  }));
  let calls = 0;
  const reused = await beginReleaseTwoStopSelectionV1(request(list, {
    async getRouteReceipt() { calls += 1; throw new Error('must not call'); },
  }, {
    recommendationSessionToken: token,
    verifiedOneStopCourses: [firstCourse('a'), firstCourse('b')],
    verifiedPairCourses: seeds,
    ledger: first.ledger,
    reuse: { courses: first.courses, continuation: first.continuation },
  }));
  assert.equal(calls, 0);
  assert.equal(reused.courses.length, 1);
  assert.equal(reused.continuation.verifiedCount, 1);
});

test('2-AA: 새 session에서 seed가 없으면 뒤쪽 미검증 상대를 첫 3개에 강제하지 않는다', async () => {
  const list = ['b', 'c', 'd', 'e', 'a'].map((id) => place(id));
  const adapter: CourseV1RouteReceiptAdapter = {
    async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true }; },
  };
  const sourceToken = {};
  const source = await beginReleaseTwoStopSelectionV1(request(list, adapter, { firstCourse: firstCourse('b') }));
  const baseline = await beginReleaseTwoStopSelectionV1(request(list, adapter, { firstCourse: firstCourse('b') }));
  const otherSession = await beginReleaseTwoStopSelectionV1(request(list, adapter, {
    firstCourse: firstCourse('b'),
    recommendationSessionToken: {},
    verifiedPairCourses: [verifiedPairSeed(pairCourse('a', 'b'), source, sourceToken)],
  }));
  assert.deepEqual(otherSession.courses.map((course) => course.placeIds), baseline.courses.map((course) => course.placeIds));
  assert.deepEqual(otherSession.ledger, baseline.ledger);
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
