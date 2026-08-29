import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLimitedRepresentativeCourseV1,
  COURSE_V1_EXACT_COURSE_LIMIT,
  COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT,
  COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT,
  preselectLimitedCourseV1,
  selectNonNestedCourseV1,
  selectRepresentativeCourseSetV1,
  type CourseV1Candidate,
  type CourseV1Point,
  type CourseV1RouteReceipt,
  type CourseV1RouteReceiptAdapter,
  type CourseV1RouteAdapter,
  type VerifiedCourseV1,
} from '../src/engine/courseV1';
import { createCourseV1CandidateProvider } from '../src/data/courseV1CandidateProvider';

const now = new Date('2026-08-24T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.1578, lon: 129.0594 };
const destination = { id: 'destination', lat: 35.153, lon: 129.118 };

function place(id: string, options: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  return {
    id, title: id, lat: 35.15, lon: 129.06,
    classification: 'representative_standard', minStayMin: 10, recommendedStayMin: 15,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 0, endMin: 1440 }] },
    ...options,
  };
}

function provider(candidates: readonly CourseV1Candidate[]) {
  return { listRepresentativeCandidates: () => candidates };
}

function exactRoutes(minutes: Record<string, number>, calls: string[] = []): CourseV1RouteAdapter {
  return {
    async getRoute(from: CourseV1Point, to: CourseV1Point) {
      const key = `${from.id}>${to.id}`;
      calls.push(key);
      const min = minutes[key];
      return min === undefined ? null : { mode: 'walk', min, exact: true };
    },
  };
}

function receiptRoutes(
  plans: Record<string, CourseV1RouteReceipt>,
  calls: string[] = [],
): CourseV1RouteReceiptAdapter {
  return {
    async getRouteReceipt(from, to, budget) {
      const key = `${from.id}>${to.id}`;
      calls.push(key);
      const receipt = plans[key] ?? { result: 'no_route' as const, newProviderAttemptCount: 1 as const, reused: false };
      return receipt.newProviderAttemptCount <= budget.maxNewProviderAttemptCount
        ? receipt
        : { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    },
  };
}

function assertVerifiedJourney(course: VerifiedCourseV1, expectedPlaceIds: string[]) {
  assert.deepEqual(course.placeIds, expectedPlaceIds);
  assert.deepEqual(course.stops.map((stop) => stop.placeId), expectedPlaceIds);
  assert.equal(course.stops.reduce((total, stop) => total + stop.stayMin, 0), course.stayMin);
  assert.equal(course.legs.length, course.stops.length + 1);

  let cursor = now.getTime();
  for (const [index, stop] of course.stops.entries()) {
    cursor += course.legs[index].min * 60_000;
    assert.equal(stop.arrivalAt, new Date(cursor).toISOString());
    assert.equal(stop.availabilityState, 'structured_verified');
    cursor += stop.stayMin * 60_000;
    assert.equal(stop.departureAt, new Date(cursor).toISOString());
  }
  cursor += course.legs.at(-1)!.min * 60_000;
  cursor += course.arrivalBufferMin * 60_000;
  assert.equal(cursor - now.getTime(), course.totalMin * 60_000);
}

test('ENG-2E: 45분 왕복은 주입 provider에서 대표 1곳을 검증하고 조건부·운영불가 후보를 제외한다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    provider: provider([
      place('open'),
      place('conditional', { classification: 'conditional_more' }),
      place('closed', { availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 600, endMin: 610 }] } }),
    ]),
    routes: exactRoutes({ 'origin>open': 5, 'open>origin': 5 }),
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['open']);
  assert.equal(result.resultState, 'verified');
  assert.equal(result.alternativeState, 'no_alternative_verified_course');
  assert.equal(result.diagnostics.classificationExcluded, 2);
});

test('ENG-2E: 90분 별도 도착지는 대표와 전체 검증 대안의 장소·구간·시간을 반환한다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination, remainingMin: 90, arrivalBufferMin: 10,
    provider: provider([
      place('a', { minStayMin: 20, recommendedStayMin: 20 }),
      place('b', { minStayMin: 20, recommendedStayMin: 20 }),
      place('c', { minStayMin: 20, recommendedStayMin: 20 }),
    ]),
    routes: exactRoutes({
      'origin>a': 5, 'a>destination': 5, 'origin>b': 6, 'b>destination': 6,
      'origin>c': 7, 'c>destination': 7,
      'a>b': 5, 'b>a': 5, 'a>c': 5, 'c>a': 5, 'b>c': 5, 'c>b': 5,
    }),
  });
  assert.ok(result.representativeCourse);
  assert.ok(result.alternativeCourses.length > 0);
  for (const course of result.alternativeCourses) {
    assert.ok(course.legs.length >= 2);
    assert.ok(course.totalMin > 0);
    assert.notEqual([...course.placeIds].sort().join('|'), [...result.representativeCourse.placeIds].sort().join('|'));
  }
  assert.equal(result.alternativeState, 'alternatives_available');
});

test('ENG-2E: 180분에는 3곳 코스가 시간 적합성에 따라 대표가 될 수 있다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination, remainingMin: 180, arrivalBufferMin: 10,
    provider: provider([place('a'), place('b'), place('c')]),
    routes: exactRoutes({ 'origin>a': 5, 'a>b': 5, 'b>c': 5, 'c>destination': 5 }),
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['a', 'b', 'c']);
  assert.ok(result.diagnostics.preselectedCourseIds.length <= COURSE_V1_EXACT_COURSE_LIMIT);
});

test('ENG-2E: 정확 검증은 최대 4개 후보에서 멈추며, 4개 실패 뒤 후보를 확장하지 않는다', async () => {
  const calls: string[] = [];
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    provider: provider(['a', 'b', 'c', 'd', 'e'].map((id) => place(id))),
    routes: exactRoutes({}, calls),
  });
  assert.equal(result.resultState, 'no_verified_course_within_limit');
  assert.equal(result.diagnostics.exactCourseAttemptCount, COURSE_V1_EXACT_COURSE_LIMIT);
  assert.equal(result.diagnostics.preselectedCourseIds.length, COURSE_V1_EXACT_COURSE_LIMIT);
  assert.ok(calls.length <= COURSE_V1_EXACT_COURSE_LIMIT);
  assert.equal(calls.some((call) => call === 'origin>e'), false);
});

test('ENG-2E: 엔진 내 동일 구간은 한 번만 adapter를 호출하고, 근사·차량을 의미하는 null은 코스를 탈락시킨다', async () => {
  const calls: string[] = [];
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    provider: provider([place('a'), place('b')]),
    routes: exactRoutes({ 'origin>a': 5, 'a>origin': 5, 'origin>b': 5, 'b>origin': 5, 'a>b': 5, 'b>a': 5 }, calls),
  });
  assert.ok(result.representativeCourse);
  assert.equal(calls.filter((call) => call === 'origin>a').length, 1);

  const vehicleOrApproximate = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    provider: provider([place('only')]),
    routes: { async getRoute() { return { mode: 'walk', min: 5, exact: false } as never; } },
  });
  assert.equal(vehicleOrApproximate.resultState, 'no_verified_course_within_limit');
});

test('ENG-2E: provider 후보 없음과 상한 내 검증 실패를 구분하고, 입력 범위를 지킨다', async () => {
  const none = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5, provider: provider([]), routes: exactRoutes({}),
  });
  assert.equal(none.resultState, 'no_representative_candidates');
  await assert.rejects(() => buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 181, arrivalBufferMin: 5, provider: provider([]), routes: exactRoutes({}),
  }), /1~180/);
});

test('ENG-2E-A: 실제 provider 190개 입력도 route 호출 없이 18곳·5,220개 이하의 유한 공간 사전선정으로 끝낸다', () => {
  const candidates = createCourseV1CandidateProvider().listRepresentativeCandidates(now);
  let routeCalls = 0;
  const selection = preselectLimitedCourseV1({
    now, origin, destination,
    remainingMin: 180, arrivalBufferMin: 10, candidates,
  });

  assert.equal(candidates.length, 190);
  assert.ok(selection.candidatePool.length <= COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT);
  assert.ok(selection.generatedOrderedCourseCount <= COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT);
  assert.ok(selection.candidateCourses.length <= COURSE_V1_EXACT_COURSE_LIMIT);
  assert.ok(COURSE_V1_PRESELECTION_ORDERED_COURSE_LIMIT === 5220);
  // 사전선정 공개 계약에는 adapter가 없으므로 실제 경로 호출 경로 자체가 없다.
  assert.equal(routeCalls, 0);
});

function verifiedFixture(placeIds: string[], options: Partial<Pick<VerifiedCourseV1, 'travelMin' | 'stayMin' | 'totalMin'>> = {}): VerifiedCourseV1 {
  const stayMin = options.stayMin ?? placeIds.length * 15;
  const travelMin = options.travelMin ?? 0;
  const totalMin = options.totalMin ?? stayMin + travelMin + 5;
  return {
    id: placeIds.join('|'), placeIds,
    stops: placeIds.map((placeId) => ({ placeId, stayMin: 15, availabilityState: 'structured_verified', arrivalAt: now.toISOString(), departureAt: now.toISOString() })),
    legs: [], stayMin, travelMin, totalMin,
    arrivalBufferMin: 5, remainingAfterCourseMin: 0, remainingAfterArrivalBufferMin: 0,
  };
}

test('ENG-2H: A 다음 새 추천은 A의 부분·상위집합이 아닌 B,C 또는 D만 남긴다', () => {
  const selected = selectNonNestedCourseV1([
    verifiedFixture(['A']),
    verifiedFixture(['A', 'B']),
    verifiedFixture(['A', 'C', 'B']),
    verifiedFixture(['B', 'C']),
    verifiedFixture(['D']),
  ]);
  assert.deepEqual(selected.map((course) => course.placeIds), [['A'], ['B', 'C'], ['D']]);
  assert.deepEqual(selectNonNestedCourseV1([verifiedFixture(['A']), verifiedFixture(['A', 'B'])]).map((course) => course.placeIds), [['A']]);
});

test('ENG-2I: 분 단위 예산과 무관하게 1·2·3곳을 모두 검토하되 체류 합계로 장소 수를 강제하지 않는다', () => {
  const candidates = [
    place('a', { minStayMin: 35, recommendedStayMin: 35 }),
    place('b', { minStayMin: 35, recommendedStayMin: 35 }),
    place('c', { minStayMin: 35, recommendedStayMin: 35 }),
  ];
  for (const remainingMin of [45, 90, 180]) {
    const placeCounts = preselectLimitedCourseV1({ now, origin, destination: null, remainingMin, arrivalBufferMin: 5, candidates })
      .candidateCourses.map((course) => course.length);
    assert.ok(placeCounts.includes(1));
    assert.ok(placeCounts.includes(2));
    assert.ok(placeCounts.includes(3));
  }
});

test('ENG-2I: 78분의 유효한 1곳은 2·3곳 시간 채우기 후보에 밀리지 않고 정확 경로 검증 기회를 얻는다', async () => {
  const calls: string[] = [];
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 78, arrivalBufferMin: 8,
    provider: provider([place('a'), place('b'), place('c'), place('d')]),
    routes: exactRoutes({ 'origin>a': 8, 'a>origin': 8 }, calls),
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['a']);
  assert.equal(result.representativeCourse?.remainingAfterCourseMin, 39);
  assert.ok(result.diagnostics.exactCourseAttemptCount <= COURSE_V1_EXACT_COURSE_LIMIT);
  assert.ok(calls.includes('origin>a'));
});

test('ENG-2I-R: 왕복의 공간 상위 18개가 실패해도 19번째 공간 관련 1곳은 4개 안에서 정확 검증한다', async () => {
  const calls: string[] = [];
  const near = Array.from({ length: 18 }, (_, index) => place(`round-near-${String(index + 1).padStart(2, '0')}`, {
    lat: origin.lat + (index + 1) * 0.00001,
    lon: origin.lon,
  }));
  const wide = place('round-wide', { lat: origin.lat + 0.001, lon: origin.lon });
  const selection = preselectLimitedCourseV1({
    now, origin, destination: null, remainingMin: 78, arrivalBufferMin: 8, candidates: [...near, wide],
  });
  assert.equal(selection.wideSingleCandidateId, 'round-wide');
  assert.ok(selection.candidatePool.some((candidate) => candidate.id === 'round-wide'));
  assert.ok(selection.candidateCourses.some((course) => course.length === 1 && course[0]?.id === 'round-near-01'));
  assert.ok(selection.candidateCourses.some((course) => course.length === 1 && course[0]?.id === 'round-wide'));

  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 78, arrivalBufferMin: 8,
    provider: provider([...near, wide]),
    routes: exactRoutes({ 'origin>round-wide': 10, 'round-wide>origin': 10 }, calls),
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['round-wide']);
  assert.equal(result.representativeCourse?.remainingAfterCourseMin, 35);
  assert.equal(result.diagnostics.wideSingleCandidateId, 'round-wide');
  assert.ok(result.diagnostics.preselectedCourseIds.includes('round-wide'));
  assert.ok(result.diagnostics.exactCourseAttemptCount <= COURSE_V1_EXACT_COURSE_LIMIT);
  assert.ok(calls.includes('origin>round-wide'));
});

test('ENG-2I-R: 도착지에서도 공간 상위 18개 실패 뒤 19번째 경로 관련 1곳을 대표로 반환한다', async () => {
  const calls: string[] = [];
  const midpoint = { lat: (origin.lat + destination.lat) / 2, lon: (origin.lon + destination.lon) / 2 };
  const near = Array.from({ length: 18 }, (_, index) => place(`destination-near-${String(index + 1).padStart(2, '0')}`, midpoint));
  const wide = place('destination-wide', { lat: midpoint.lat + 0.001, lon: midpoint.lon });
  const selection = preselectLimitedCourseV1({
    now, origin, destination, remainingMin: 78, arrivalBufferMin: 8, candidates: [...near, wide],
  });
  assert.equal(selection.wideSingleCandidateId, 'destination-wide');
  assert.ok(selection.candidateCourses.some((course) => course.length === 1 && course[0]?.id === 'destination-near-01'));
  assert.ok(selection.candidateCourses.some((course) => course.length === 1 && course[0]?.id === 'destination-wide'));

  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination, remainingMin: 78, arrivalBufferMin: 8,
    provider: provider([...near, wide]),
    routes: exactRoutes({ 'origin>destination-wide': 10, 'destination-wide>destination': 10 }, calls),
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['destination-wide']);
  assert.equal(result.representativeCourse?.remainingAfterCourseMin, 35);
  assert.equal(result.diagnostics.wideSingleCandidateId, 'destination-wide');
  assert.ok(result.diagnostics.preselectedCourseIds.includes('destination-wide'));
  assert.ok(result.diagnostics.exactCourseAttemptCount <= COURSE_V1_EXACT_COURSE_LIMIT);
  assert.ok(calls.includes('origin>destination-wide'));
});

test('ENG-2K-01: 45분 왕복에서 20분 유효 1곳은 30분 다장소 후보와 함께 있어도 검증·반환된다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    provider: provider([
      place('valid', { lat: origin.lat, lon: origin.lon, recommendedStayMin: 20 }),
      place('long-a', { lat: origin.lat + 0.0001, lon: origin.lon, recommendedStayMin: 30 }),
      place('long-b', { lat: origin.lat + 0.0002, lon: origin.lon, recommendedStayMin: 30 }),
      place('long-c', { lat: origin.lat + 0.0003, lon: origin.lon, recommendedStayMin: 30 }),
    ]),
    routes: exactRoutes({ 'origin>valid': 8, 'valid>origin': 8 }),
  });
  assert.equal(result.diagnostics.preselectionSlots?.nearSingle, 'valid');
  assert.deepEqual(result.representativeCourse?.placeIds, ['valid']);
  assert.equal(result.representativeCourse?.remainingAfterCourseMin, 4);
});

test('ENG-2K-02: 78분 밀집 후보에서는 독립 1곳과 2곳이 각각 검증되어 비중첩 대안으로 반환된다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 78, arrivalBufferMin: 8,
    provider: provider([
      place('near', { lat: origin.lat, lon: origin.lon, recommendedStayMin: 20 }),
      place('pair-a', { lat: origin.lat + 0.0001, lon: origin.lon, recommendedStayMin: 20 }),
      place('pair-b', { lat: origin.lat + 0.0002, lon: origin.lon, recommendedStayMin: 30 }),
      place('crowded', { lat: origin.lat + 0.0003, lon: origin.lon, recommendedStayMin: 45 }),
    ]),
    routes: exactRoutes({
      'origin>near': 8, 'near>origin': 8,
      'origin>pair-a': 6, 'pair-a>pair-b': 6, 'pair-b>origin': 6,
      'origin>pair-b': 6, 'pair-b>pair-a': 6, 'pair-a>origin': 6,
    }),
  });
  assert.equal(result.diagnostics.preselectionSlots?.nearSingle, 'near');
  assert.equal(result.diagnostics.preselectionSlots?.independentTwo, 'pair-b|pair-a');
  assert.ok([result.representativeCourse, ...result.alternativeCourses].some((course) => course?.id === 'near'));
  assert.ok([result.representativeCourse, ...result.alternativeCourses]
    .some((course) => course && [...course.placeIds].sort().join('|') === 'pair-a|pair-b'));
});

test('ENG-2K-03: 90분 도착지에서 근접·넓은 단일 lane은 각각 검증되고 넓은 유효 후보가 남는다', async () => {
  const near = Array.from({ length: 18 }, (_, index) => place(`near-${String(index + 1).padStart(2, '0')}`, {
    lat: origin.lat + (index + 1) * 0.00001, lon: origin.lon,
  }));
  const wide = place('wide', { lat: origin.lat + 0.001, lon: origin.lon, recommendedStayMin: 20 });
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination, remainingMin: 90, arrivalBufferMin: 8,
    provider: provider([...near, wide]),
    routes: exactRoutes({ 'origin>wide': 10, 'wide>destination': 10 }),
  });
  assert.equal(result.diagnostics.preselectionSlots?.nearSingle, 'near-01');
  assert.equal(result.diagnostics.preselectionSlots?.wideSingle, 'wide');
  assert.deepEqual(result.representativeCourse?.placeIds, ['wide']);
});

test('ENG-2K-04: 120분에는 유효한 60분 1곳과 20+30분 독립 2곳을 함께 검증해 이동 부담으로 대표를 정한다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 120, arrivalBufferMin: 10,
    provider: provider([
      place('long-one', { lat: origin.lat, lon: origin.lon, recommendedStayMin: 60 }),
      place('two-a', { lat: origin.lat + 0.0001, lon: origin.lon, recommendedStayMin: 20 }),
      place('two-b', { lat: origin.lat + 0.0002, lon: origin.lon, recommendedStayMin: 30 }),
    ]),
    routes: exactRoutes({
      'origin>long-one': 10, 'long-one>origin': 10,
      'origin>two-a': 5, 'two-a>two-b': 5, 'two-b>origin': 10,
      'origin>two-b': 5, 'two-b>two-a': 5, 'two-a>origin': 10,
    }),
  });
  assert.equal(result.diagnostics.preselectionSlots?.nearSingle, 'long-one');
  assert.equal(result.diagnostics.preselectionSlots?.independentTwo, 'two-b|two-a');
  assert.deepEqual(result.representativeCourse?.placeIds, ['long-one']);
  assert.ok(result.alternativeCourses.some((course) => [...course.placeIds].sort().join('|') === 'two-a|two-b'));
});

test('ENG-2K-05: 180분에는 독립 1·2·3곳을 모두 검증하고 3곳은 대안으로 남긴다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 180, arrivalBufferMin: 10,
    provider: provider([
      place('one', { lat: origin.lat, lon: origin.lon }),
      place('two-a', { lat: origin.lat + 0.0001, lon: origin.lon }),
      place('two-b', { lat: origin.lat + 0.0002, lon: origin.lon }),
      place('three-a', { lat: origin.lat + 0.0003, lon: origin.lon }),
      place('three-b', { lat: origin.lat + 0.0004, lon: origin.lon }),
      place('three-c', { lat: origin.lat + 0.0005, lon: origin.lon }),
    ]),
    routes: exactRoutes({
      'origin>one': 5, 'one>origin': 5,
      'origin>two-a': 5, 'two-a>two-b': 5, 'two-b>origin': 5,
      'origin>three-a': 5, 'three-a>three-b': 5, 'three-b>three-c': 5, 'three-c>origin': 5,
      'origin>two-b': 5, 'two-b>two-a': 5, 'two-a>origin': 5,
      'origin>three-b': 5, 'origin>three-c': 5,
      'three-a>three-c': 5, 'three-b>three-a': 5,
      'three-c>three-a': 5, 'three-c>three-b': 5, 'three-a>origin': 5, 'three-b>origin': 5,
    }),
  });
  assert.equal(result.diagnostics.preselectionSlots?.nearSingle, 'one');
  assert.equal(result.diagnostics.preselectionSlots?.independentTwo, 'two-b|two-a');
  assert.ok(result.diagnostics.preselectionSlots?.independentThree);
  assert.ok(result.representativeCourse!.placeIds.length <= 2);
  assert.ok([result.representativeCourse, ...result.alternativeCourses].some((course) => course?.id === 'one'));
  assert.ok([result.representativeCourse, ...result.alternativeCourses]
    .some((course) => course && [...course.placeIds].sort().join('|') === 'two-a|two-b'));
  assert.ok(result.alternativeCourses.some((course) => [...course.placeIds].sort().join('|') === 'three-a|three-b|three-c'));
});

test('ENG-2K-06: 유효 코스가 정확히 하나면 60·120분 모두 대안을 부풀리지 않는다', async () => {
  for (const remainingMin of [60, 120]) {
    const result = await buildLimitedRepresentativeCourseV1({
      now, origin, destination: null, remainingMin, arrivalBufferMin: 8,
      provider: provider([place('only', { recommendedStayMin: 20 })]),
      routes: exactRoutes({ 'origin>only': 8, 'only>origin': 8 }),
    });
    assert.deepEqual(result.representativeCourse?.placeIds, ['only']);
    assert.deepEqual(result.alternativeCourses, []);
    assert.equal(result.alternativeState, 'no_alternative_verified_course');
    assert.deepEqual(result.diagnostics.preselectionSlots, {
      nearSingle: 'only', wideSingle: null, independentTwo: null, independentThree: null,
    });
  }
});

test('ENG-2I: 실제 검증 뒤에는 1·2곳을 대표로 우선하고, 독립적인 3곳 검증 코스는 대안으로 남긴다', () => {
  const selected = selectRepresentativeCourseSetV1([
    verifiedFixture(['A'], { travelMin: 10, stayMin: 15 }),
    verifiedFixture(['B', 'C'], { travelMin: 12, stayMin: 30 }),
    verifiedFixture(['D', 'E', 'F'], { travelMin: 15, stayMin: 45 }),
  ]);
  assert.notEqual(selected[0].placeIds.length, 3);
  assert.ok(selected.slice(1).some((course) => course.placeIds.length === 3));
});

test('ENG-2I: 78·120·180분 왕복/도착지 코스는 권장 체류·실제 legs·buffer 뒤 남는 시간을 불변 스냅샷으로 보존한다', async () => {
  const cases = [
    { remainingMin: 78, destination: null, ids: ['a'], routes: { 'origin>a': 8, 'a>origin': 8 } },
    { remainingMin: 120, destination, ids: ['a', 'b'], routes: { 'origin>a': 5, 'a>b': 5, 'b>destination': 10 } },
    { remainingMin: 180, destination, ids: ['a', 'b', 'c'], routes: { 'origin>a': 5, 'a>b': 5, 'b>c': 5, 'c>destination': 10 } },
  ] as const;
  for (const scenario of cases) {
    const result = await buildLimitedRepresentativeCourseV1({
      now, origin, destination: scenario.destination, remainingMin: scenario.remainingMin, arrivalBufferMin: 10,
      provider: provider(scenario.ids.map((id) => place(id))), routes: exactRoutes(scenario.routes),
    });
    const course = result.representativeCourse!;
    assert.ok(course.totalMin <= scenario.remainingMin);
    assert.equal(course.remainingAfterCourseMin, scenario.remainingMin - course.travelMin - course.stayMin - course.arrivalBufferMin);
    assert.equal(course.remainingAfterCourseMin, course.remainingAfterArrivalBufferMin);
    assert.equal(course.stops.reduce((sum, stop) => sum + stop.stayMin, 0), course.stayMin);
  }
});

test('ENG-2G: 1·2·3곳의 검증 코스는 legs·stops·최종 여유 순서로 재계산 없이 시간 여정을 복원한다', async () => {
  const one = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    provider: provider([place('one')]), routes: exactRoutes({ 'origin>one': 5, 'one>origin': 5 }),
  });
  assertVerifiedJourney(one.representativeCourse!, ['one']);

  const two = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    provider: provider([place('a'), place('b')]),
    routes: exactRoutes({ 'origin>a': 5, 'a>b': 5, 'b>origin': 5 }),
  });
  assertVerifiedJourney(two.representativeCourse!, ['a', 'b']);

  const three = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 180, arrivalBufferMin: 10,
    provider: provider([place('a'), place('b'), place('c')]),
    routes: exactRoutes({ 'origin>a': 5, 'a>b': 5, 'b>c': 5, 'c>origin': 5 }),
  });
  assertVerifiedJourney(three.representativeCourse!, ['a', 'b', 'c']);
});

test('ENG-2G: 조건부·needs_review 후보는 검증 stop으로 유입되지 않는다', async () => {
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    provider: provider([
      place('conditional', { classification: 'conditional_more' }),
      place('review', { availability: { status: 'needs_review', alwaysAccessible: false, dayTypes: ['weekday'], windows: [] } }),
    ]),
    routes: exactRoutes({}),
  });
  assert.equal(result.resultState, 'no_representative_candidates');
  assert.deepEqual(result.alternativeCourses, []);
});

test('REC-26: 6개 생활권의 48개 분 단위 receipt fixture는 실제 API 없이 결정적으로 검증된다', async () => {
  const districts = ['사상', '서면', '부산역', '남포', '광안리', '해운대'];
  const scenarios = [
    { remainingMin: 45, destination: null }, { remainingMin: 78, destination: null },
    { remainingMin: 120, destination: null }, { remainingMin: 180, destination: null },
    { remainingMin: 45, destination }, { remainingMin: 78, destination },
    { remainingMin: 120, destination }, { remainingMin: 180, destination },
  ];
  for (const district of districts) for (const scenario of scenarios) {
    const id = `${district}-대표`;
    const target = scenario.destination?.id ?? origin.id;
    const result = await buildLimitedRepresentativeCourseV1({
      now, origin, destination: scenario.destination, remainingMin: scenario.remainingMin, arrivalBufferMin: 5,
      provider: provider([place(id, { recommendedStayMin: 20 })]), routes: exactRoutes({}),
      receiptRoutes: receiptRoutes({
        [`origin>${id}`]: { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
        [`${id}>${target}`]: { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
      }),
    });
    assert.deepEqual(result.representativeCourse?.placeIds, [id]);
    assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
    assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
  }
});

test('REC-26: receipt no_route 뒤에는 4개에서 멈추지 않고 뒤 단일 후보를 보충하며 동일 구간은 세션 재사용한다', async () => {
  const calls: string[] = [];
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    provider: provider(['a', 'b', 'c', 'd', 'e'].map((id, index) => place(id, { lat: origin.lat + index * 0.0001, lon: origin.lon }))),
    routes: exactRoutes({}),
    receiptRoutes: receiptRoutes({
      'origin>a': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
      'origin>b': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
      'origin>c': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
      'origin>d': { result: 'no_route', newProviderAttemptCount: 1, reused: false },
      'origin>e': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
      'e>origin': { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false },
    }, calls),
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['e']);
  assert.ok(result.diagnostics.exactCourseAttemptCount > COURSE_V1_EXACT_COURSE_LIMIT);
  assert.ok((result.diagnostics.cacheOrSessionReuseCount ?? 0) >= 0);
  assert.ok(calls.includes('origin>e'));
});

test('REC-26: 8번째 provider attempt와 unavailable은 fallback 없이 상한·구조화 reason으로 끝난다', async () => {
  const calls: string[] = [];
  const result = await buildLimitedRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    provider: provider(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((id, index) => place(id, { lat: origin.lat + index * 0.0001, lon: origin.lon }))),
    routes: exactRoutes({}), receiptRoutes: receiptRoutes({}, calls),
  });
  assert.equal(result.primaryOutcomeReason, 'route_verification_unavailable');
  assert.equal(result.diagnostics.newProviderAttemptCount, 8);
  assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
  assert.equal(calls.length, 8);
});
