import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReleaseOneStopRepresentativeCourseV1,
  continueReleaseOneStopRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1ReleaseOneStopContinuationResult,
  type CourseV1ReleaseOneStopResult,
  type CourseV1RouteReceiptAdapter,
  type VerifiedCourseV1,
} from '../src/engine';
import {
  appendReleaseOneStopPage,
  initialReleaseOneStopMoreState,
  releaseOneStopMoreEndMessage,
} from '../src/ui/recommendation/releaseOneStopMoreResultsModel';

const now = new Date('2026-09-03T15:00:00+09:00');
const origin = { id: 'origin', lat: 35.1578, lon: 129.0592 };
const destination = { id: 'destination', lat: 35.1682, lon: 129.0571 };

function candidate(id: string, classification: CourseV1Candidate['classification'] = 'representative_standard'): CourseV1Candidate {
  return {
    id,
    title: id,
    lat: 35.16,
    lon: 129.06,
    classification,
    minStayMin: 20,
    recommendedStayMin: 30,
    maxStayMin: 60,
    availability: {
      status: 'structured',
      alwaysAccessible: true,
      dayTypes: ['weekday', 'weekend'],
      windows: [],
    },
  };
}

function denseCandidates(prefix: string, count = 18): CourseV1Candidate[] {
  return Array.from({ length: count }, (_, index) => candidate(`${prefix}-${String(index).padStart(2, '0')}`));
}

function request(candidates: readonly CourseV1Candidate[], receiptRoutes: CourseV1RouteReceiptAdapter) {
  return {
    now,
    origin,
    destination,
    remainingMin: 120,
    arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates },
    routes: { async getRoute() { throw new Error('고정 receipt fixture에서 legacy route를 호출하면 안 됩니다.'); } },
    receiptRoutes,
  };
}

function exactReceiptFixture(noRouteOriginIds: ReadonlySet<string> = new Set()) {
  const pairs: string[] = [];
  const adapter: CourseV1RouteReceiptAdapter = {
    async getRouteReceipt(from, to) {
      pairs.push(`${from.id}>${to.id}`);
      if (from.id === 'origin' && noRouteOriginIds.has(to.id)) {
        return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      }
      return {
        result: 'exact',
        route: { mode: 'walk', min: 5, exact: true },
        newProviderAttemptCount: 1,
        reused: false,
      };
    },
  };
  return { adapter, pairs };
}

const coursesOf = (result: CourseV1ReleaseOneStopResult): VerifiedCourseV1[] =>
  [result.representativeCourse, ...result.alternativeCourses].filter((course): course is VerifiedCourseV1 => course !== null);

const idsOf = (courses: readonly VerifiedCourseV1[]): string[] => courses.map((course) => course.placeIds[0]!);

function assertPageReceipt(page: CourseV1ReleaseOneStopContinuationResult) {
  assert.ok((page.diagnostics.newProviderAttemptCount ?? 0) <= 8);
  assert.equal(page.diagnostics.cacheOrSessionReuseCount ?? 0, 0);
  assert.ok(page.appendedCourses.length <= 3);
  assert.ok(page.appendedCourses.every((course) => course.placeIds.length === 1 && course.legs.length === 2));
}

test('QA-ONE-MORE-01 밀집 A: initial→page1→page2는 상한 안에서 고유 one-stop을 누적하고 기존 순서를 유지한다', async () => {
  const conditionalId = 'dense-a-conditional-market';
  const candidates = [...denseCandidates('dense-a'), candidate(conditionalId, 'conditional_more')];
  const receipt = exactReceiptFixture();
  const fixedRequest = request(candidates, receipt.adapter);

  const initial = await buildReleaseOneStopRepresentativeCourseV1(fixedRequest);
  const initialCourses = coursesOf(initial);
  assert.equal(initialCourses.length, 4);
  assert.ok(initial.continuation);
  assert.equal(initial.diagnostics.newProviderAttemptCount, 8);
  assert.equal(initial.diagnostics.cacheOrSessionReuseCount ?? 0, 0);
  assert.equal(initial.continuation.candidatePlaceIds.includes(conditionalId), false);

  const page1 = await continueReleaseOneStopRepresentativeCourseV1({ ...fixedRequest, continuation: initial.continuation });
  assertPageReceipt(page1);
  assert.equal(page1.appendedCourses.length, 3);
  assert.equal(page1.diagnostics.newProviderAttemptCount, 6);
  assert.equal(page1.pageState, 'more_available');

  const page2 = await continueReleaseOneStopRepresentativeCourseV1({ ...fixedRequest, continuation: page1.continuation });
  assertPageReceipt(page2);
  assert.equal(page2.appendedCourses.length, 3);
  assert.equal(page2.diagnostics.newProviderAttemptCount, 6);

  const allCourses = [...initialCourses, ...page1.appendedCourses, ...page2.appendedCourses];
  const allIds = idsOf(allCourses);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(allIds.includes(conditionalId), false);
  assert.equal(receipt.pairs.length, 20);
  assert.equal(receipt.pairs.some((pair) => /^dense-a-\d+>dense-a-\d+$/.test(pair)), false);

  const initialUi = initialReleaseOneStopMoreState(initial);
  const page1Ui = appendReleaseOneStopPage(initialUi, page1);
  const page2Ui = appendReleaseOneStopPage(page1Ui, page2);
  assert.deepEqual(
    idsOf([page2Ui.representativeCourse!, ...page2Ui.alternativeCourses]),
    allIds,
  );
  assert.ok(allIds.length > initialCourses.length);
});

test('QA-ONE-MORE-01 밀집 B: initial 0건은 자동 종료하지 않고 명시 page 뒤 첫 검증 course를 대표로 표시한다', async () => {
  const candidates = denseCandidates('dense-b');
  const initialFailures = new Set(candidates.slice(0, 8).map((item) => item.id));
  const receipt = exactReceiptFixture(initialFailures);
  const fixedRequest = request(candidates, receipt.adapter);

  const initial = await buildReleaseOneStopRepresentativeCourseV1(fixedRequest);
  assert.equal(initial.representativeCourse, null);
  assert.equal(initial.alternativeCourses.length, 0);
  assert.ok(initial.continuation);
  assert.equal(initial.diagnostics.newProviderAttemptCount, 8);
  assert.equal(initial.diagnostics.cacheOrSessionReuseCount ?? 0, 0);

  const initialUi = initialReleaseOneStopMoreState(initial);
  assert.equal(initialUi.pageState, 'more_available');
  assert.equal(initialUi.representativeCourse, null);
  assert.equal(releaseOneStopMoreEndMessage(initialUi.pageState), null);
  assert.equal(receipt.pairs.length, 8, 'initial 계산 뒤 page가 자동 호출되면 안 됩니다.');

  const page1 = await continueReleaseOneStopRepresentativeCourseV1({ ...fixedRequest, continuation: initial.continuation });
  assertPageReceipt(page1);
  assert.equal(page1.appendedCourses.length, 3);
  assert.equal(page1.diagnostics.newProviderAttemptCount, 6);
  assert.equal(receipt.pairs.length, 14);
  const afterTap = appendReleaseOneStopPage(initialUi, page1);
  assert.equal(afterTap.representativeCourse?.placeIds[0], page1.appendedCourses[0]!.placeIds[0]);
  assert.deepEqual(idsOf(afterTap.alternativeCourses), idsOf(page1.appendedCourses.slice(1)));
});

test('QA-ONE-MORE-01 상태 계약: signature 불일치·provider 종료·큐 소진은 안전 상태와 고정 문구로 분리된다', async () => {
  const candidates = denseCandidates('state', 10);
  const receipt = exactReceiptFixture();
  const fixedRequest = request(candidates, receipt.adapter);
  const initial = await buildReleaseOneStopRepresentativeCourseV1(fixedRequest);
  assert.ok(initial.continuation);

  let invalidCalls = 0;
  const invalid = await continueReleaseOneStopRepresentativeCourseV1({
    ...request(candidates, { async getRouteReceipt() { invalidCalls += 1; throw new Error('호출 금지'); } }),
    continuation: { ...initial.continuation, candidateSetSignature: 'mismatch' },
  });
  assert.equal(invalid.pageState, 'continuation_unavailable');
  assert.equal(invalidCalls, 0);
  assert.equal(releaseOneStopMoreEndMessage(invalid.pageState), '이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.');

  const unavailable = await continueReleaseOneStopRepresentativeCourseV1({
    ...request(candidates, {
      async getRouteReceipt() {
        return { result: 'unavailable', reason: 'provider', newProviderAttemptCount: 0, reused: false };
      },
    }),
    continuation: initial.continuation,
  });
  assert.equal(unavailable.pageState, 'provider_unavailable');
  assert.equal(releaseOneStopMoreEndMessage(unavailable.pageState), '다른 장소를 지금 확인하지 못했어요');

  let continuation = initial.continuation;
  let exhausted: CourseV1ReleaseOneStopContinuationResult | null = null;
  while (!exhausted || exhausted.pageState === 'more_available') {
    exhausted = await continueReleaseOneStopRepresentativeCourseV1({ ...fixedRequest, continuation });
    continuation = exhausted.continuation;
  }
  assert.equal(exhausted.pageState, 'exhausted');
  assert.equal(releaseOneStopMoreEndMessage(exhausted.pageState), '이 조건에서 확인할 수 있는 다른 장소가 없어요');
});
