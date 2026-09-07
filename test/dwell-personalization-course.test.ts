import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginReleaseTwoStopSelectionV1,
  buildReleaseOneStopRepresentativeCourseV1,
  continueReleaseOneStopRepresentativeCourseV1,
  continueReleaseTwoStopSelectionV1,
  type CourseV1Candidate,
  type CourseV1RouteReceiptAdapter,
  type VerifiedCourseV1,
} from '../src/engine';
import type { DwellPersonalizationSampleV1 } from '../src/engine/dwellPersonalization';

const now = new Date('2026-09-03T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const destination = { id: 'destination', lat: 35.16, lon: 129.07 };

function place(id: string, category: string, subCategory: string, extra: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  return {
    id, title: id, lat: 35.151, lon: 129.061, category, subCategory,
    classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
    ...extra,
  };
}

function profile(category: string, subCategory: string, values: readonly number[]): DwellPersonalizationSampleV1[] {
  return values.map((dwellMin) => ({ category, subCategory, dwellMin }));
}

function exactAdapter(calls: string[]): CourseV1RouteReceiptAdapter {
  return {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  };
}

function oneStopInput(candidate: CourseV1Candidate, calls: string[], samples?: readonly DwellPersonalizationSampleV1[]) {
  return {
    now, origin, destination, remainingMin: 80, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => [candidate] },
    routes: { async getRoute() { return null; } }, receiptRoutes: exactAdapter(calls),
    dwellPersonalizationSamples: samples,
  };
}

function firstCourse(id: string): VerifiedCourseV1 {
  const arrivalAt = new Date(now.getTime() + 5 * 60_000);
  const departureAt = new Date(arrivalAt.getTime() + 30 * 60_000);
  return {
    id, placeIds: [id],
    stops: [{ placeId: id, stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: arrivalAt.toISOString(), departureAt: departureAt.toISOString() }],
    legs: [{ fromId: 'origin', toId: id, mode: 'walk', min: 5 }, { fromId: id, toId: 'destination', mode: 'walk', min: 5 }],
    stayMin: 30, travelMin: 10, totalMin: 50, arrivalBufferMin: 10,
    remainingAfterCourseMin: 70, remainingAfterArrivalBufferMin: 70,
  };
}

test('2-AB: one-stop은 개인화 목표를 같은 exact legs에서 적용하고 route를 추가 호출하지 않는다', async () => {
  const candidate = place('street', '상업지구', '거리');
  const baselineCalls: string[] = [];
  const baseline = await buildReleaseOneStopRepresentativeCourseV1(oneStopInput(candidate, baselineCalls));
  const personalizedCalls: string[] = [];
  const personalized = await buildReleaseOneStopRepresentativeCourseV1(oneStopInput(
    candidate, personalizedCalls, profile('상업지구', '거리', [40, 45, 50]),
  ));

  assert.equal(baseline.representativeCourse?.stops[0]?.stayMin, 30);
  assert.equal(personalized.representativeCourse?.stops[0]?.stayMin, 40);
  assert.deepEqual(personalizedCalls, baselineCalls);
  assert.equal(personalized.diagnostics.newProviderAttemptCount, baseline.diagnostics.newProviderAttemptCount);
});

test('2-AB: one-stop 목표가 예산·운영 종료를 넘으면 가능한 값으로 clamp하고 후보를 유지한다', async () => {
  const closing = { status: 'structured' as const, alwaysAccessible: false, dayTypes: ['weekday' as const], windows: [{ startMin: 600, endMin: 640 }] };
  const calls: string[] = [];
  const result = await buildReleaseOneStopRepresentativeCourseV1(oneStopInput(
    place('closing', '상업지구', '거리', { availability: closing }),
    calls,
    profile('상업지구', '거리', [40, 45, 50]),
  ));
  assert.deepEqual(result.representativeCourse?.placeIds, ['closing']);
  assert.equal(result.representativeCourse?.stops[0]?.stayMin, 35);
  assert.equal(calls.length, 2);
});

test('2-AB: one-stop 개인화 목표가 총예산을 넘으면 같은 후보·legs의 가능한 분으로 clamp한다', async () => {
  const candidate = place('budget', '상업지구', '거리');
  const calls: string[] = [];
  const result = await buildReleaseOneStopRepresentativeCourseV1({
    ...oneStopInput(candidate, calls, profile('상업지구', '거리', [40, 45, 50])),
    remainingMin: 55,
  });
  assert.deepEqual(result.representativeCourse?.placeIds, ['budget']);
  assert.equal(result.representativeCourse?.stops[0]?.stayMin, 35);
  assert.equal(result.representativeCourse?.totalMin, 55);
  assert.equal(calls.length, 2);
});

test('2-AB: pair는 stop별 복합 키만 소비하고 순서·exact legs·attempt ledger를 유지한다', async () => {
  const candidates = [place('a', '상업지구', '거리'), place('b', '자연', '거리')];
  const run = async (samples?: readonly DwellPersonalizationSampleV1[]) => {
    const calls: string[] = [];
    const result = await beginReleaseTwoStopSelectionV1({
      now, origin, destination, remainingMin: 100, arrivalBufferMin: 10,
      provider: { listRepresentativeCandidates: () => candidates }, routes: { async getRoute() { return null; } },
      receiptRoutes: exactAdapter(calls), firstCourse: firstCourse('a'),
      ledger: { version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 },
      requestId: '2-ab', dwellPersonalizationSamples: samples,
    });
    return { result, calls };
  };
  const baseline = await run();
  const personalized = await run([
    ...profile('상업지구', '거리', [40, 45, 50]),
    ...profile('자연', '거리', [20, 20, 20]),
    ...profile('문화', '거리', [120, 120, 120]),
  ]);

  assert.deepEqual(personalized.result.courses[0]?.placeIds, baseline.result.courses[0]?.placeIds);
  assert.deepEqual(personalized.result.courses[0]?.stops.map((stop) => stop.stayMin), [40, 20]);
  assert.deepEqual(personalized.calls, baseline.calls);
  assert.deepEqual(personalized.result.ledger, baseline.result.ledger);
  assert.ok((personalized.result.courses[0]?.totalMin ?? Infinity) <= 100);
});

test('2-AB: pair 개인화 목표가 총예산을 넘어도 같은 pair를 feasible clamp하고 attempt를 늘리지 않는다', async () => {
  const candidates = [place('a', '문화', '전시'), place('b', '자연', '공원')];
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1({
    now, origin, destination, remainingMin: 100, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates }, routes: { async getRoute() { return null; } },
    receiptRoutes: exactAdapter(calls), firstCourse: firstCourse('a'),
    ledger: { version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 },
    requestId: '2-ab-clamp',
    dwellPersonalizationSamples: [...profile('문화', '전시', [40, 45, 50]), ...profile('자연', '공원', [40, 45, 50])],
  });
  assert.deepEqual(result.courses[0]?.placeIds, ['a', 'b']);
  assert.deepEqual(result.courses[0]?.stops.map((stop) => stop.stayMin), [40, 35]);
  assert.equal(result.courses[0]?.totalMin, 100);
  assert.equal(result.ledger.automaticTwoStopAttempts, calls.length);
});

test('2-AB: pair 두 stop의 목표가 두 번째 장소 영업 종료를 밀어내면 순서를 유지한 채 clamp한다', async () => {
  const closing = { status: 'structured' as const, alwaysAccessible: false, dayTypes: ['weekday' as const], windows: [{ startMin: 600, endMin: 675 }] };
  const candidates = [place('a', '문화', '전시'), place('b', '자연', '공원', { availability: closing })];
  const calls: string[] = [];
  const result = await beginReleaseTwoStopSelectionV1({
    now, origin, destination, remainingMin: 120, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates }, routes: { async getRoute() { return null; } },
    receiptRoutes: exactAdapter(calls), firstCourse: firstCourse('a'),
    ledger: { version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 },
    requestId: '2-ab-closing',
    dwellPersonalizationSamples: [...profile('문화', '전시', [40, 45, 50]), ...profile('자연', '공원', [40, 45, 50])],
  });
  assert.deepEqual(result.courses[0]?.placeIds, ['a', 'b']);
  assert.deepEqual(result.courses[0]?.stops.map((stop) => stop.stayMin), [35, 30]);
  assert.equal(result.ledger.automaticTwoStopAttempts, calls.length);
});

test('2-AB: 개인화 체류는 기존 이동·안전성 정렬을 뒤집는 1차 점수가 아니다', async () => {
  const fast = place('a-fast', '상업지구', '거리');
  const slow = place('b-slow', '문화', '전시');
  const calls: string[] = [];
  const result = await buildReleaseOneStopRepresentativeCourseV1({
    ...oneStopInput(fast, calls, profile('상업지구', '거리', [20, 20, 20])),
    provider: { listRepresentativeCandidates: () => [fast, slow] },
    receiptRoutes: {
      async getRouteReceipt(from, to) {
        calls.push(`${from.id}>${to.id}`);
        const min = from.id === 'b-slow' || to.id === 'b-slow' ? 6 : 5;
        return { result: 'exact', route: { mode: 'walk', min, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    },
  });
  assert.equal(result.representativeCourse?.id, 'a-fast');
});

test('2-AB: 프로필 없음·오염 profile은 비개인화 snapshot과 byte-equivalent하다', async () => {
  const candidate = place('default', '상업지구', '거리');
  const baseline = await buildReleaseOneStopRepresentativeCourseV1(oneStopInput(candidate, []));
  const polluted = await buildReleaseOneStopRepresentativeCourseV1(oneStopInput(candidate, [], [
    ...profile('자연', '거리', [100, 110, 120]),
    { category: '상업지구', subCategory: '거리', dwellMin: Number.NaN },
    { category: '상업지구', subCategory: '거리', dwellMin: 0 },
  ]));
  assert.deepEqual(polluted.representativeCourse, baseline.representativeCourse);
});

test('2-AB 출시: 다른 stop의 프로필은 미적용 stop의 기본 선택 체류를 재배분하지 않는다', async () => {
  const run = (samples?: readonly DwellPersonalizationSampleV1[]) => beginReleaseTwoStopSelectionV1({
    now, origin, destination, remainingMin: 80, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => [place('a', '문화', '전시'), place('b', '자연', '공원')] },
    routes: { async getRoute() { throw new Error('legacy route forbidden'); } },
    receiptRoutes: exactAdapter([]), firstCourse: firstCourse('a'),
    ledger: { version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 },
    requestId: 'release-isolation', dwellPersonalizationSamples: samples,
  });
  const baseline = await run();
  assert.deepEqual(baseline.courses[0]?.stops.map((stop) => stop.stayMin), [30, 20]);
  for (const target of [20, 30]) {
    const result = await run(profile('문화', '전시', [target, target, target]));
    assert.equal(result.courses[0]?.stops[1]?.stayMin, 20);
    assert.deepEqual(result.courses[0]?.legs, baseline.courses[0]?.legs);
    assert.deepEqual(result.ledger, baseline.ledger);
  }
});

test('2-AB 출시: off/empty/invalid는 one-stop과 pair 전체 결과가 동일하다', async () => {
  const variants = [undefined, [], profile('문화', '전시', [NaN, Infinity, 0, -1])];
  const singleResults = [];
  const pairResults = [];
  for (const samples of variants) {
    const calls: string[] = [];
    singleResults.push(await buildReleaseOneStopRepresentativeCourseV1(oneStopInput(place('a', '문화', '전시'), calls, samples)));
    pairResults.push(await beginReleaseTwoStopSelectionV1({
      ...oneStopInput(place('a', '문화', '전시'), calls, samples), remainingMin: 100,
      provider: { listRepresentativeCandidates: () => [place('a', '문화', '전시'), place('b', '자연', '공원')] },
      firstCourse: firstCourse('a'), requestId: 'off',
      ledger: { version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 },
    }));
  }
  for (let i = 1; i < variants.length; i += 1) {
    assert.equal(JSON.stringify(singleResults[i]), JSON.stringify(singleResults[0]));
    assert.equal(JSON.stringify(pairResults[i]), JSON.stringify(pairResults[0]));
  }
});

test('2-AB 출시: snapshot은 변화·동일값·기본 복귀·부분 clamp를 구분한다', async () => {
  for (const scenario of [
    { target: 40, budget: 80, baseline: 30, selected: 40 },
    { target: 30, budget: 80, baseline: 30, selected: 30 },
    { target: 40, budget: 50, baseline: 30, selected: 30 },
    { target: 40, budget: 55, baseline: 30, selected: 35 },
  ]) {
    const result = await buildReleaseOneStopRepresentativeCourseV1({
      ...oneStopInput(place('a', '문화', '전시'), [], profile('문화', '전시', Array(3).fill(scenario.target))),
      remainingMin: scenario.budget,
    });
    const stop = result.representativeCourse!.stops[0]!;
    assert.equal(stop.stayMin, scenario.selected);
    assert.deepEqual(stop.dwellPersonalization, {
      targetStayMin: scenario.target, baselineStayMin: scenario.baseline, baselineStayState: 'recommended',
    });
  }
});

test('2-AB 출시: frozen 표본으로 single/pair continue해도 후보·legs·호출·ledger·시간 안전성을 유지한다', async () => {
  const candidates = Array.from({ length: 8 }, (_, i) => place(i === 0 ? 'a' : `b${i}`, '문화', '전시'));
  const samples = Object.freeze(profile('문화', '전시', [40, 45, 50]).map((sample) => Object.freeze(sample)));
  const run = async (snapshot?: readonly DwellPersonalizationSampleV1[]) => {
    const calls: string[] = [];
    const input = { ...oneStopInput(candidates[0]!, calls, snapshot), remainingMin: 120,
      provider: { listRepresentativeCandidates: () => candidates } };
    const single = await buildReleaseOneStopRepresentativeCourseV1(input);
    assert.ok(single.continuation);
    const singleNext = await continueReleaseOneStopRepresentativeCourseV1({ ...input, continuation: single.continuation });
    const pairInput = { ...input, firstCourse: firstCourse('a'), requestId: 'frozen',
      ledger: { version: 1 as const, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 } };
    const pair = await beginReleaseTwoStopSelectionV1(pairInput);
    const pairNext = await continueReleaseTwoStopSelectionV1({ ...pairInput, continuation: pair.continuation, ledger: pair.ledger });
    assert.equal(singleNext.appendedCourses.length, 3);
    assert.equal(pair.courses.length, 3);
    assert.equal(pairNext.courses.length, 2); // shared 12회 안에서 검증 완료한 결과만 반환한다.
    return { calls, courses: [single.representativeCourse!, ...single.alternativeCourses, ...singleNext.appendedCourses, ...pair.courses, ...pairNext.courses], ledger: pairNext.ledger };
  };
  const baseline = await run();
  const personalized = await run(samples);
  assert.deepEqual(personalized.calls, baseline.calls);
  assert.deepEqual(personalized.ledger, baseline.ledger);
  assert.deepEqual(personalized.courses.map((course) => [course.placeIds, course.legs]), baseline.courses.map((course) => [course.placeIds, course.legs]));
  for (const course of personalized.courses) {
    assert.ok(course.totalMin <= 120);
    assert.equal(course.totalMin, course.travelMin + course.stayMin + course.arrivalBufferMin);
    let elapsed = 0;
    course.stops.forEach((stop, index) => {
      elapsed += course.legs[index]!.min;
      assert.equal(stop.arrivalAt, new Date(now.getTime() + elapsed * 60_000).toISOString());
      elapsed += stop.stayMin;
      assert.equal(stop.departureAt, new Date(now.getTime() + elapsed * 60_000).toISOString());
      assert.ok(stop.stayMin >= 20 && stop.stayMin <= 60);
    });
  }
});
