import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLimitedRepresentativeCourseV1,
  continueLimitedRepresentativeCourseV1,
  preselectLimitedCourseV1,
  type CourseV1Candidate,
  type CourseV1RouteReceiptAdapter,
} from '../src/engine/courseV1';

const now = new Date('2026-08-24T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };

function place(id: string): CourseV1Candidate {
  return { id, title: id, lat: 35.15, lon: 129.06, classification: 'representative_standard', minStayMin: 5, recommendedStayMin: 5, maxStayMin: 10, availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] } };
}

function receipts(calls: string[]): CourseV1RouteReceiptAdapter {
  return { async getRouteReceipt(from, to) {
    calls.push(`${from.id}>${to.id}`);
    return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
  } };
}

function inputFor(candidates: CourseV1Candidate[], receiptRoutes: CourseV1RouteReceiptAdapter) {
  return { now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5, provider: { listRepresentativeCandidates: () => candidates }, routes: { async getRoute() { return null; } }, receiptRoutes };
}

test('2-Q: continuation 큐는 부분집합을 보존하고 순서만 다른 장소 집합은 하나로 합친다', () => {
  const preselected = preselectLimitedCourseV1({ now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5, candidates: [place('a'), place('b'), place('c')] });
  const signatures = preselected.continuationQueue.map((course) => course.map((candidate) => candidate.id).sort().join('|'));
  assert.ok(signatures.includes('a'));
  assert.ok(signatures.includes('a|b'));
  assert.ok(signatures.includes('a|b|c'));
  assert.equal(signatures.filter((signature) => signature === 'a|b').length, 1);
});

test('2-S: 첫 receipt 큐는 N1/N2를 교차하고 시간 적합 3곳에 한 번의 기회를 둔다', () => {
  const preselected = preselectLimitedCourseV1({ now, origin, destination: null, remainingMin: 120, arrivalBufferMin: 5, candidates: ['a', 'b', 'c', 'd'].map(place) });
  assert.deepEqual(preselected.continuationQueue.slice(0, 4).map((course) => course.length), [1, 2, 1, 2]);
  assert.equal(preselected.continuationQueue.some((course) => course.length === 3), true);
});

test('2-Q: initial continuation은 JSON 안전하며 ID/signature 불일치는 route 호출 없이 fail-closed한다', async () => {
  const candidates = ['a', 'b', 'c', 'd', 'e'].map(place);
  const provider = { listRepresentativeCandidates: () => candidates };
  const calls: string[] = [];
  const input = { now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5, provider, routes: { async getRoute() { return null; } }, receiptRoutes: receipts(calls) };
  const first = await buildLimitedRepresentativeCourseV1(input);
  assert.ok(first.continuation);
  const json = JSON.stringify(first.continuation);
  assert.equal(/\"(?:lat|lon|provider|userId|now)\"/i.test(json), false);
  const before = calls.length;
  const invalid = await continueLimitedRepresentativeCourseV1({ ...input, continuation: { ...first.continuation!, candidateSetSignature: 'wrong' } });
  assert.equal(invalid.pageState, 'continuation_unavailable');
  assert.equal(calls.length, before);
});

test('2-Q: 이어보기는 각 페이지의 새 provider attempt와 새 코스를 8/3 이하로 제한한다', async () => {
  const candidates = Array.from({ length: 8 }, (_, index) => place(`p${index}`));
  const provider = { listRepresentativeCandidates: () => candidates };
  const input = { now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5, provider, routes: { async getRoute() { return null; } }, receiptRoutes: receipts([]) };
  const first = await buildLimitedRepresentativeCourseV1(input);
  const next = await continueLimitedRepresentativeCourseV1({ ...input, continuation: first.continuation! });
  const second = await continueLimitedRepresentativeCourseV1({ ...input, continuation: next.continuation });
  assert.ok((next.diagnostics.newProviderAttemptCount ?? 0) <= 8);
  assert.ok(next.appendedCourses.length <= 3);
  assert.ok((second.diagnostics.newProviderAttemptCount ?? 0) <= 8);
  assert.ok(second.appendedCourses.length <= 3);
  assert.ok(next.continuation.attemptedCourseSignatures.length >= first.continuation!.attemptedCourseSignatures.length);
  assert.deepEqual(
    second.appendedCourses.map((course) => course.id).filter((id) => next.appendedCourses.some((course) => course.id === id)),
    [],
  );
});

test('2-Q: 첫 8회에 목표를 못 채우고 같은 큐가 남으면 16회 이내로만 보충한다', async () => {
  const calls: string[] = [];
  const input = inputFor(Array.from({ length: 8 }, (_, index) => place(String.fromCharCode(97 + index))), {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      if (to.id === 'a') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  });
  const result = await buildLimitedRepresentativeCourseV1(input);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) > 8);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 16);
  assert.ok((result.continuation?.cursor ?? 0) > 0);
  assert.ok(calls.length > 8);
});

test('2-Q: 정확히 4개를 얻으면 첫 16회 stage를 열지 않는다', async () => {
  const calls: string[] = [];
  const result = await buildLimitedRepresentativeCourseV1(inputFor(['a', 'b', 'c'].map(place), receipts(calls)));
  assert.equal([result.representativeCourse, ...result.alternativeCourses].filter(Boolean).length, 4);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
});

test('2-S: 단일 코스가 가능해도 독립 2곳은 첫 검증에서 기회를 얻고 형태별 진단을 남긴다', async () => {
  const candidates = ['a', 'b', 'c', 'd'].map(place);
  const result = await buildLimitedRepresentativeCourseV1(inputFor(candidates, receipts([])));
  assert.ok(result.alternativeCourses.some((course) => course.placeIds.length === 2));
  assert.ok((result.diagnostics.shapeDiagnostics?.[1].attemptedCourseCount ?? 0) > 0);
  assert.ok((result.diagnostics.shapeDiagnostics?.[2].attemptedCourseCount ?? 0) > 0);
  assert.equal(result.diagnostics.shapeDiagnostics?.[3].queueCount, 4);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
});

test('2-S-R: 첫 N2 route 탈락 뒤 두 번째 N2는 120분 왕복·도착지 첫 결과에서 검증된다', async () => {
  const candidates = ['a', 'b', 'c', 'd'].map(place);
  for (const destination of [null, { id: 'destination', lat: 35.16, lon: 129.07 }]) {
    const preselected = preselectLimitedCourseV1({ now, origin, destination, remainingMin: 120, arrivalBufferMin: 5, candidates });
    const twos = preselected.continuationQueue.filter((course) => course.length === 2);
    const firstTwo = twos[0]!;
    const secondTwo = twos[1]!;
    const firstTwoFailureLeg = `${firstTwo[0]!.id}>${firstTwo[1]!.id}`;
    const result = await buildLimitedRepresentativeCourseV1({
      now, origin, destination, remainingMin: 120, arrivalBufferMin: 5,
      provider: { listRepresentativeCandidates: () => candidates },
      routes: { async getRoute() { return null; } },
      receiptRoutes: {
        async getRouteReceipt(from, to) {
          if (`${from.id}>${to.id}` === firstTwoFailureLeg) return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
          return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
        },
      },
    });
    const expectedSet = [...secondTwo.map((candidate) => candidate.id)].sort().join('|');
    const returned = [result.representativeCourse, ...result.alternativeCourses]
      .filter((course): course is NonNullable<typeof course> => course !== null)
      .map((course) => [...course.placeIds].sort().join('|'));
    assert.ok(returned.includes(expectedSet));
    assert.ok((result.diagnostics.shapeDiagnostics?.[2].attemptedCourseCount ?? 0) >= 2);
    assert.ok((result.diagnostics.shapeDiagnostics?.[2].verifiedCourseCount ?? 0) >= 1);
    assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
    assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
  }
});

test('2-T: 다장소 unavailable safe reason은 형태별로만 집계하고 누락·오염값은 unknown이다', async () => {
  const candidates = ['a', 'b', 'c'].map(place);
  const preselected = preselectLimitedCourseV1({ now, origin, destination: null, remainingMin: 120, arrivalBufferMin: 5, candidates });
  const firstTwo = preselected.continuationQueue.find((course) => course.length === 2)!;
  const unavailableLeg = `${firstTwo[0]!.id}>${firstTwo[1]!.id}`;
  for (const [reason, expected] of [
    ['limited', 'limited'],
    ['provider', 'provider'],
    [undefined, 'unknown'],
    ['raw-edge-message', 'unknown'],
  ] as const) {
    const result = await buildLimitedRepresentativeCourseV1(inputFor(candidates, {
      async getRouteReceipt(from, to) {
        if (`${from.id}>${to.id}` === unavailableLeg) {
          return { result: 'unavailable', reason, newProviderAttemptCount: 1, reused: false } as never;
        }
        return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    }));
    const shape = result.diagnostics.shapeDiagnostics?.[2];
    assert.equal(shape?.routeVerificationUnavailableCount, 1);
    assert.equal(shape?.unavailableReasonCounts?.[expected], 1);
    assert.equal(Object.values(shape?.unavailableReasonCounts ?? {}).reduce((total, count) => total + count, 0), 1);
  }
});

test('2-T: exact/no_route receipt는 unavailable reason을 집계하지 않는다', async () => {
  const candidates = ['a', 'b', 'c'].map(place);
  const result = await buildLimitedRepresentativeCourseV1(inputFor(candidates, {
    async getRouteReceipt(from, to) {
      if (from.id !== 'origin' && to.id !== 'origin') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  for (const shape of Object.values(result.diagnostics.shapeDiagnostics ?? {})) {
    assert.equal(Object.values(shape.unavailableReasonCounts ?? {}).reduce((total, count) => total + count, 0), 0);
  }
});

test('2-S: 다장소 route가 모두 탈락하면 단일 코스만 유지하며 상한을 넘지 않는다', async () => {
  const candidates = ['a', 'b', 'c', 'd'].map(place);
  const result = await buildLimitedRepresentativeCourseV1(inputFor(candidates, {
    async getRouteReceipt(from, to) {
      if (from.id !== 'origin' && to.id !== 'origin') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  assert.equal(result.representativeCourse?.placeIds.length, 1);
  assert.equal(result.alternativeCourses.some((course) => course.placeIds.length > 1), false);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 16);
  assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
});

test('2-Q: 로컬 페이지 예산 소진은 provider 불가가 아니며 typed unavailable만 종료한다', async () => {
  const candidates = Array.from({ length: 12 }, (_, index) => place(`x${index}`));
  const unavailableCalls: string[] = [];
  const exhausted = await buildLimitedRepresentativeCourseV1(inputFor(candidates, {
    async getRouteReceipt(from, to) {
      unavailableCalls.push(`${from.id}>${to.id}`);
      return to.id === 'origin'
        ? { result: 'no_route', newProviderAttemptCount: 1, reused: false }
        : { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  const resumedInput = inputFor(candidates, {
    async getRouteReceipt(from, to) {
      return to.id === 'origin'
        ? { result: 'no_route', newProviderAttemptCount: 1, reused: false }
        : { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  });
  const page = await continueLimitedRepresentativeCourseV1({ ...resumedInput, continuation: exhausted.continuation! });
  // The prior continuation is deliberately supplied after rebuilding the input ports.
  assert.equal(exhausted.continuation?.stopReason, undefined);
  assert.equal(page.pageState, 'more_available');

  const providerUnavailable = await buildLimitedRepresentativeCourseV1(inputFor([place('u')], {
    async getRouteReceipt() { return { result: 'unavailable', newProviderAttemptCount: 0, reused: false }; },
  }));
  assert.equal(providerUnavailable.continuation?.stopReason, 'provider_unavailable');
});
