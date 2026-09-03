import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReleaseOneStopRepresentativeCourseV1,
  continueReleaseOneStopRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1RouteReceiptAdapter,
} from '../src/engine/courseV1';

const now = new Date('2026-09-02T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const destination = { id: 'destination', lat: 35.16, lon: 129.07 };

function place(id: string, classification: CourseV1Candidate['classification'] = 'representative_standard'): CourseV1Candidate {
  return {
    id, title: id, lat: 35.151, lon: 129.061, classification,
    minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
  };
}

function candidates(count: number): CourseV1Candidate[] {
  return Array.from({ length: count }, (_, index) => place(`p${String(index).padStart(2, '0')}`));
}

function input(candidateList: CourseV1Candidate[], receiptRoutes: CourseV1RouteReceiptAdapter) {
  return {
    now, origin, destination, remainingMin: 120, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidateList },
    routes: { async getRoute() { return null; } }, receiptRoutes,
  };
}

function exact(calls: string[]): CourseV1RouteReceiptAdapter {
  return {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  };
}

test('2-V: initial 8회 뒤 continuation으로 서로 다른 single 최대 3개를 이어 검증한다', async () => {
  const list = [...candidates(10), place('conditional', 'conditional_more')];
  const calls: string[] = [];
  const request = input(list, exact(calls));
  const first = await buildReleaseOneStopRepresentativeCourseV1(request);
  assert.ok(first.continuation);
  assert.equal(first.continuation.candidatePlaceIds.includes('conditional'), false);
  assert.equal(/"(?:lat|lon|provider|userId|now)"/i.test(JSON.stringify(first.continuation)), false);
  assert.equal([first.representativeCourse, ...first.alternativeCourses].filter(Boolean).length, 4);
  assert.ok((first.diagnostics.newProviderAttemptCount ?? 0) <= 8);

  const page = await continueReleaseOneStopRepresentativeCourseV1({ ...request, continuation: first.continuation });
  const firstIds = new Set([first.representativeCourse, ...first.alternativeCourses].filter((course) => course !== null).map((course) => course.id));
  assert.equal(page.appendedCourses.length, 3);
  assert.ok(page.appendedCourses.every((course) => course.placeIds.length === 1 && course.legs.length === 2));
  assert.equal(page.appendedCourses.some((course) => firstIds.has(course.id)), false);
  assert.ok((page.diagnostics.newProviderAttemptCount ?? 0) <= 8);
  assert.equal(calls.some((pair) => /^p\d+>p\d+$/.test(pair)), false);
});

test('2-V: 첫 결과가 3개여도 미검증 single이 남으면 more_available이고 다음 장소를 추가한다', async () => {
  const list = candidates(10);
  const failed = new Set(['p03', 'p04']);
  const request = input(list, {
    async getRouteReceipt(from, to) {
      if (from.id === 'origin' && failed.has(to.id)) return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  });
  const first = await buildReleaseOneStopRepresentativeCourseV1(request);
  assert.equal([first.representativeCourse, ...first.alternativeCourses].filter(Boolean).length, 3);
  assert.ok(first.continuation);
  const page = await continueReleaseOneStopRepresentativeCourseV1({ ...request, continuation: first.continuation });
  assert.ok(page.appendedCourses.length > 0);
  assert.equal(page.continuation.rejectedCandidateIds.filter((id) => failed.has(id)).length, 2);
});

test('2-V: 검증·탈락한 ID는 페이지에서 다시 요청하거나 반환하지 않는다', async () => {
  const list = candidates(8);
  const initialCalls: string[] = [];
  const firstInput = input(list, {
    async getRouteReceipt(from, to) {
      initialCalls.push(`${from.id}>${to.id}`);
      if (from.id === 'origin' && to.id === 'p00') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  });
  const first = await buildReleaseOneStopRepresentativeCourseV1(firstInput);
  const pageCalls: string[] = [];
  const page = await continueReleaseOneStopRepresentativeCourseV1({ ...input(list, exact(pageCalls)), continuation: first.continuation! });
  assert.equal(pageCalls.some((pair) => pair.includes('p00')), false);
  assert.equal(page.appendedCourses.some((course) => first.continuation!.verifiedCandidateIds.includes(course.id)), false);
});

test('2-V: 두 leg 사이에서 페이지 예산이 끝나면 같은 후보를 영구 탈락시키지 않고 cache reuse로 재개한다', async () => {
  const list = candidates(12);
  const cache = new Set<string>();
  const adapter: CourseV1RouteReceiptAdapter = {
    async getRouteReceipt(from, to) {
      const key = `${from.id}>${to.id}`;
      if (cache.has(key)) return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
      cache.add(key);
      if (from.id === 'origin' && /^p(?:0[4-9]|10)$/.test(to.id)) return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  };
  const request = input(list, adapter);
  const first = await buildReleaseOneStopRepresentativeCourseV1(request);
  const partial = await continueReleaseOneStopRepresentativeCourseV1({ ...request, continuation: first.continuation! });
  assert.equal(partial.pageState, 'more_available');
  assert.equal(partial.continuation.cursor, 11);
  assert.equal(partial.continuation.rejectedCandidateIds.includes('p11'), false);
  const resumed = await continueReleaseOneStopRepresentativeCourseV1({ ...request, continuation: partial.continuation });
  assert.equal(resumed.appendedCourses.some((course) => course.id === 'p11'), true);
  assert.ok((resumed.diagnostics.cacheOrSessionReuseCount ?? 0) > 0);
});

test('2-V: version·signature·provider 후보 불일치는 route 0 continuation_unavailable이다', async () => {
  const list = candidates(8);
  const request = input(list, exact([]));
  const first = await buildReleaseOneStopRepresentativeCourseV1(request);
  for (const continuation of [
    { ...first.continuation!, version: 2 as 1 },
    { ...first.continuation!, candidateSetSignature: 'wrong' },
  ]) {
    let calls = 0;
    const invalid = await continueReleaseOneStopRepresentativeCourseV1({
      ...input(list, { async getRouteReceipt() { calls += 1; throw new Error('must not call'); } }), continuation,
    });
    assert.equal(invalid.pageState, 'continuation_unavailable');
    assert.equal(invalid.appendedCourses.length, 0);
    assert.equal(calls, 0);
  }
  let changedCalls = 0;
  const changed = await continueReleaseOneStopRepresentativeCourseV1({
    ...input([...list, place('changed')], { async getRouteReceipt() { changedCalls += 1; throw new Error('must not call'); } }),
    continuation: first.continuation!,
  });
  assert.equal(changed.pageState, 'continuation_unavailable');
  assert.equal(changedCalls, 0);
});

test('2-V: 로컬 예산은 more_available, typed unavailable은 provider_unavailable, 큐 소진은 exhausted다', async () => {
  const list = candidates(12);
  const first = await buildReleaseOneStopRepresentativeCourseV1(input(list, exact([])));
  const local = await continueReleaseOneStopRepresentativeCourseV1({ ...input(list, exact([])), continuation: first.continuation! });
  assert.equal(local.pageState, 'more_available');

  const unavailable = await continueReleaseOneStopRepresentativeCourseV1({
    ...input(list, { async getRouteReceipt() { return { result: 'unavailable', reason: 'limited', newProviderAttemptCount: 0, reused: false }; } }),
    continuation: first.continuation!,
  });
  assert.equal(unavailable.pageState, 'provider_unavailable');

  let continuation = first.continuation!;
  let state = 'more_available';
  while (state === 'more_available') {
    const page = await continueReleaseOneStopRepresentativeCourseV1({ ...input(list, exact([])), continuation });
    continuation = page.continuation;
    state = page.pageState;
  }
  assert.equal(state, 'exhausted');
});
