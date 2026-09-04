import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1ReleaseOneStopResult, VerifiedCourseV1 } from '../../src/engine';
import {
  canRecordTwoStopSelectionIntent,
  createFrozenTwoStopSeedPort,
  consumeTwoStopSelectionIntent,
  continueReleaseRecommendationSession,
  getRecommendationSessionAttemptLedger,
  getTwoStopSelectionPort,
  isRecommendationSessionOperationInFlight,
  recordTwoStopSelectionIntent,
  runRecommendationSession,
} from '../../src/ui/recommendation/v1Session';
import type { TwoStopSelectionPort } from '../../src/ui/recommendation/twoStopSelectionModel';

const session = () => ({
  nowIso: '2026-09-03T01:00:00.000Z',
  origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.06 },
  destination: { id: 'destination', label: '도착', lat: 35.16, lon: 129.07 },
  remainingMin: 120,
  arrivalBufferMin: 10,
});

const course = (id: string): VerifiedCourseV1 => ({
  id: `course-${id}`,
  placeIds: [id],
  stops: [{ placeId: id, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-03T01:05:00.000Z', departureAt: '2026-09-03T01:25:00.000Z' }],
  legs: [
    { fromId: 'origin', toId: id, mode: 'walk', min: 5 },
    { fromId: id, toId: 'destination', mode: 'walk', min: 5 },
  ],
  travelMin: 10,
  stayMin: 20,
  arrivalBufferMin: 10,
  totalMin: 40,
  remainingAfterCourseMin: 80,
  remainingAfterArrivalBufferMin: 80,
});

function result(first: VerifiedCourseV1, attempts: number | undefined = 8): CourseV1ReleaseOneStopResult {
  return {
    representativeCourse: first,
    alternativeCourses: [],
    resultState: 'verified',
    alternativeState: 'no_alternative_verified_course',
    continuation: { version: 1, cursor: 0, candidatePlaceIds: ['B'], candidateSetSignature: 'fixture', attemptedCandidateIds: [], rejectedCandidateIds: [], verifiedCandidateIds: [], routeReceiptKeys: [] },
    diagnostics: { providerCandidateCount: 1, preselectionCandidateCount: 1, candidatePoolCount: 1, generatedOrderedCourseCount: 1, preselectedCourseIds: [first.id], exactCourseAttemptCount: 1, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0, ...(attempts === undefined ? {} : { newProviderAttemptCount: attempts }) },
  };
}

async function start(initialAttempts: number | 'missing' = 8, routeReceipt = true) {
  const recommendationSession = session();
  const first = course('A');
  await runRecommendationSession(recommendationSession, { routeProxyEnabled: true }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: routeReceipt ? async () => ({
      async getRoute() { return null; },
      async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; },
    }) : undefined,
    buildRelease: async () => result(first, initialAttempts === 'missing' ? undefined : initialAttempts),
  });
  return { recommendationSession, first };
}

test('UTWOSTOP02 failure-first: runtime은 receipt port·fail-closed ledger·일회성 intent를 같은 session에 둔다', async () => {
  const { recommendationSession, first } = await start('missing');
  assert.ok(getTwoStopSelectionPort(recommendationSession));
  assert.equal(getRecommendationSessionAttemptLedger(recommendationSession)?.initialOneStopAttempts, 8);
  assert.equal(recordTwoStopSelectionIntent(recommendationSession, course('NOT-IN-RESULT')), false);
  assert.equal(recordTwoStopSelectionIntent(recommendationSession, first), true);
  assert.equal(consumeTwoStopSelectionIntent(recommendationSession), first);
  assert.equal(consumeTwoStopSelectionIntent(recommendationSession), null);
  assert.equal(JSON.stringify(recommendationSession).includes('provider'), false);
});

test('UTWOSTOP03 사용자 반환 failure-first: A branch는 최초 표시 순서 seed를 begin/continue/reuse에 동결한다', async () => {
  const A = course('A');
  const B = course('B');
  const C = course('C');
  const D = course('D');
  let displayed = [A, B, C] as readonly VerifiedCourseV1[];
  const observed: Array<readonly VerifiedCourseV1[] | undefined> = [];
  const base: TwoStopSelectionPort = {
    async begin(input) {
      observed.push(input.verifiedOneStopCourses);
      return { requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], courses: [], pageState: 'more_available', continuation: { cursor: 1 } };
    },
    async continue(input) {
      observed.push(input.verifiedOneStopCourses);
      return { requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], courses: [], pageState: 'exhausted' };
    },
  };
  const seeded = createFrozenTwoStopSeedPort(base, () => displayed);
  const common = { requestId: 'seed-1', onProgress() {}, signal: new AbortController().signal };
  await seeded.begin({ ...common, firstCourse: A });
  displayed = [A, B, C, D];
  await seeded.continue({ ...common, requestId: 'seed-2', firstCourse: A, continuation: { cursor: 1 } });
  await seeded.begin({ ...common, requestId: 'seed-3', firstCourse: A });
  await seeded.begin({ ...common, requestId: 'seed-4', firstCourse: D });

  assert.deepEqual(observed.map((seed) => seed?.map(({ id }) => id)), [
    [A.id, B.id, C.id], [A.id, B.id, C.id], [A.id, B.id, C.id], [A.id, B.id, C.id, D.id],
  ]);
  assert.equal(observed[0], observed[1]);
  assert.equal(observed[0], observed[2]);
  assert.notEqual(observed[0], observed[3]);
  assert.equal(Object.isFrozen(observed[0]), true);
});

test('UTWOSTOP04 failure-first: exact pair store는 역선택 B branch에 같은 token과 frozen seed를 전달한다', async () => {
  const A = course('A');
  const B = course('B');
  const pair = { ...A, id: 'pair-A-B', placeIds: ['A', 'B'] } as VerifiedCourseV1;
  const token = {};
  const pairSeeds = [{ course: pair, recommendationSessionToken: token, inputSignature: 'input', providerSignature: 'provider' }];
  const observed: Array<{ token?: object; pairs?: readonly unknown[] }> = [];
  const base: TwoStopSelectionPort = {
    async begin(input) {
      observed.push({ token: input.recommendationSessionToken, pairs: input.verifiedPairCourses });
      return { requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], courses: [], pageState: 'exhausted' };
    },
    async continue(input) {
      observed.push({ token: input.recommendationSessionToken, pairs: input.verifiedPairCourses });
      return { requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], courses: [], pageState: 'exhausted' };
    },
  };
  const seeded = createFrozenTwoStopSeedPort(base, () => [A, B], () => pairSeeds, token);
  const common = { firstCourse: B, requestId: 'reverse-1', onProgress() {}, signal: new AbortController().signal };
  await seeded.begin(common);
  pairSeeds.push({ ...pairSeeds[0], course: { ...pair, id: 'late-pair' } });
  await seeded.continue({ ...common, requestId: 'reverse-2', continuation: { cursor: 1 } });

  assert.equal(observed[0]?.token, token);
  assert.equal(observed[0]?.pairs, observed[1]?.pairs);
  assert.deepEqual(observed[0]?.pairs, pairSeeds.slice(0, 1));
  assert.equal(Object.isFrozen(observed[0]?.pairs), true);
});

test('UTWOSTOP04: production session은 완료 exact pair를 역선택 첫 후보로 route 0 재사용한다', async () => {
  const recommendationSession = session();
  let receiptCalls = 0;
  const result = await runRecommendationSession(recommendationSession, { routeProxyEnabled: true }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: async () => ({
      async getRoute() { return null; },
      async getRouteReceipt() {
        receiptCalls += 1;
        return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
      },
    }),
  });
  const displayed = [result.representativeCourse, ...result.alternativeCourses].filter((item): item is VerifiedCourseV1 => Boolean(item));
  assert.ok(displayed.length >= 2);
  const first = displayed[0];
  const port = getTwoStopSelectionPort(recommendationSession)!;
  const initial = await port.begin({ firstCourse: first, requestId: 'production-forward', signal: new AbortController().signal, onProgress() {} });
  const exactPair = initial.courses.find((item) => displayed.some((candidate) => candidate.placeIds[0] === item.placeIds.find((id) => id !== first.placeIds[0])));
  assert.ok(exactPair);
  const reverseFirst = displayed.find((candidate) => exactPair.placeIds.includes(candidate.placeIds[0]) && candidate !== first)!;
  const beforeReverse = receiptCalls;
  let callsAtReverseSeed = -1;
  const reverse = await port.begin({
    firstCourse: reverseFirst,
    requestId: 'production-reverse',
    signal: new AbortController().signal,
    onProgress(event) { if (event.type === 'candidate_verified' && event.course === exactPair) callsAtReverseSeed = receiptCalls; },
  });
  assert.equal(callsAtReverseSeed, beforeReverse);
  assert.equal(reverse.courses[0], exactPair);
  assert.deepEqual(reverse.courses[0].placeIds, exactPair.placeIds);
});

test('UTWOSTOP02 eligibility 반환: secondary 조회는 실제 allowlist snapshot만 허용하고 intent를 변경하지 않는다', async () => {
  const exact = await start(8);
  const other = await start(8);
  const clone = { ...exact.first };
  const arbitrary = course('NOT-IN-RESULT');
  const pair = { ...exact.first, id: 'pair', placeIds: ['A', 'B'] };

  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, exact.first), true);
  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, exact.first), true);
  assert.equal(consumeTwoStopSelectionIntent(exact.recommendationSession), null);
  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, clone), false);
  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, arbitrary), false);
  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, other.first), false);
  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, pair), false);

  const routeOnlySession = session();
  await runRecommendationSession(routeOnlySession, { routeProxyEnabled: false }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    buildRelease: async () => result(exact.first),
  });
  assert.equal(canRecordTwoStopSelectionIntent(routeOnlySession, exact.first), false);

  const internalSession = session();
  await runRecommendationSession(internalSession, { routeProxyEnabled: true }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: async () => ({ async getRoute() { return null; }, async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; } }),
    getPublicRecommendationEnvironment: () => ({ diagnostics: 'true', internalB12: 'true' }),
    buildInternalB12: async () => ({ representativeCourse: exact.first, alternativeCourses: [], resultState: 'verified', alternativeState: 'no_alternative_verified_course', diagnostics: result(exact.first).diagnostics }),
  });
  assert.equal(canRecordTwoStopSelectionIntent(internalSession, exact.first), false);

  const cappedSession = session();
  const alternatives = ['B', 'C', 'D', 'E'].map(course);
  await runRecommendationSession(cappedSession, { routeProxyEnabled: true }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: async () => ({ async getRoute() { return null; }, async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; } }),
    buildRelease: async () => ({ ...result(exact.first), alternativeCourses: alternatives }),
  });
  assert.equal(canRecordTwoStopSelectionIntent(cappedSession, alternatives[2]), true);
  assert.equal(canRecordTwoStopSelectionIntent(cappedSession, alternatives[3]), false);

  assert.equal(recordTwoStopSelectionIntent(exact.recommendationSession, exact.first), true);
  assert.equal(consumeTwoStopSelectionIntent(exact.recommendationSession), exact.first);
  assert.equal(consumeTwoStopSelectionIntent(exact.recommendationSession), null);
});

test('UTWOSTOP02: 다른 session은 intent를 소비하지 못하고 route-only runtime은 pair entry가 없다', async () => {
  const left = await start(9);
  const right = await start(0);
  assert.equal(getRecommendationSessionAttemptLedger(left.recommendationSession)?.initialOneStopAttempts, 8);
  assert.equal(recordTwoStopSelectionIntent(left.recommendationSession, left.first), true);
  assert.equal(consumeTwoStopSelectionIntent(right.recommendationSession), null);
  assert.equal(consumeTwoStopSelectionIntent(left.recommendationSession), left.first);

  const routeOnlySession = session();
  await runRecommendationSession(routeOnlySession, { routeProxyEnabled: false }, {
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    buildRelease: async () => result(course('A')),
  });
  assert.equal(getTwoStopSelectionPort(routeOnlySession), null);
  assert.equal(recordTwoStopSelectionIntent(routeOnlySession, course('A')), false);
});

test('UTWOSTOP02 failure-first: one-stop 더보기는 shared 12 잔여를 직렬 예약하고 실제 attempt만 누적한다', async () => {
  const { recommendationSession, first: exactCourse } = await start(8);
  const continuation = result(course('A')).continuation!;
  const limits: number[] = [];
  const queuedLimits: number[] = [];
  let release!: () => void;
  const first = continueReleaseRecommendationSession(recommendationSession, continuation, {
    continueRelease: async (input) => {
      limits.push(input.pageProviderAttemptLimit ?? -1);
      await new Promise<void>((resolve) => { release = resolve; });
      return { appendedCourses: [], continuation, pageState: 'more_available', outcomeReasons: [], diagnostics: { ...result(course('A')).diagnostics, newProviderAttemptCount: 8 } };
    },
  });
  assert.equal(isRecommendationSessionOperationInFlight(recommendationSession), true);
  assert.equal(canRecordTwoStopSelectionIntent(recommendationSession, exactCourse), false);
  const second = continueReleaseRecommendationSession(recommendationSession, continuation, {
    continueRelease: async (input) => {
      queuedLimits.push(input.pageProviderAttemptLimit ?? -1);
      return { appendedCourses: [], continuation, pageState: 'exhausted', outcomeReasons: [], diagnostics: { ...result(course('A')).diagnostics, newProviderAttemptCount: input.pageProviderAttemptLimit } };
    },
  });
  await Promise.resolve();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(limits, [8]);
  assert.deepEqual(queuedLimits, [4]);
  assert.equal(getRecommendationSessionAttemptLedger(recommendationSession)?.sharedExpansionAttempts, 12);
  assert.equal(getRecommendationSessionAttemptLedger(recommendationSession)?.totalNewProviderAttempts, 20);
});

test('UTWOSTOP02 eligibility 반환: 성공 page에서 실제 append 가능한 앞 3개만 allowlist에 추가한다', async () => {
  const exact = await start(8);
  const continuation = result(exact.first).continuation!;
  const appended = ['B', 'C', 'D', 'E'].map(course);
  await continueReleaseRecommendationSession(exact.recommendationSession, continuation, {
    continueRelease: async () => ({ appendedCourses: appended, continuation, pageState: 'more_available', outcomeReasons: [], diagnostics: { ...result(exact.first).diagnostics, newProviderAttemptCount: 0 } }),
  });
  assert.deepEqual(appended.map((item) => canRecordTwoStopSelectionIntent(exact.recommendationSession, item)), [true, true, true, false]);
  assert.equal(canRecordTwoStopSelectionIntent(exact.recommendationSession, { ...appended[0] }), false);
});

test('UTWOSTOP02 failure-first: shared 소진 뒤 one-stop은 provider를 호출하지 않는다', async () => {
  const { recommendationSession } = await start(8);
  const continuation = result(course('A')).continuation!;
  let calls = 0;
  await continueReleaseRecommendationSession(recommendationSession, continuation, {
    continueRelease: async (input) => ({ appendedCourses: [], continuation, pageState: 'more_available', outcomeReasons: [], diagnostics: { ...result(course('A')).diagnostics, newProviderAttemptCount: input.pageProviderAttemptLimit } }),
  });
  await continueReleaseRecommendationSession(recommendationSession, continuation, {
    continueRelease: async (input) => ({ appendedCourses: [], continuation, pageState: 'more_available', outcomeReasons: [], diagnostics: { ...result(course('A')).diagnostics, newProviderAttemptCount: input.pageProviderAttemptLimit } }),
  });
  const exhausted = await continueReleaseRecommendationSession(recommendationSession, continuation, {
    continueRelease: async () => { calls += 1; throw new Error('must not call'); },
  });
  assert.equal(calls, 0);
  assert.equal(exhausted?.pageState, 'shared_attempt_limit');
});
