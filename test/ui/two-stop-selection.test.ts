import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { CourseV1Candidate, CourseV1RouteReceiptAdapter, ReleaseTwoStopSelectionResult, VerifiedCourseV1 } from '../../src/engine';
import { createTwoStopSelectionEnginePort, normalizeTwoStopSelectionEngineResult } from '../../src/ui/recommendation/twoStopSelectionEnginePort';
import { createFrozenTwoStopSeedPort } from '../../src/ui/recommendation/v1Session';
import {
  buildTwoStopCandidateCard,
  canOfferTwoStopSelection,
  createInlineTwoStopSelectionController,
  createTwoStopSelectionController,
  resultsCourseRegionMode,
  twoStopSelectionReasonMessage,
  type TwoStopSelectionPort,
  type TwoStopSelectionSnapshot,
} from '../../src/ui/recommendation/twoStopSelectionModel';

function course(ids: string[], suffix = ''): VerifiedCourseV1 {
  return {
    id: `${ids.join('-')}${suffix}`,
    placeIds: ids,
    stops: ids.map((placeId, index) => ({ placeId, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: `2026-09-03T0${index + 1}:00:00.000Z`, departureAt: `2026-09-03T0${index + 1}:20:00.000Z` })),
    legs: Array.from({ length: ids.length + 1 }, (_, index) => ({ fromId: index ? ids[index - 1] : 'origin', toId: index < ids.length ? ids[index] : 'destination', mode: 'walk' as const, min: 5 })),
    travelMin: (ids.length + 1) * 5,
    stayMin: ids.length * 20,
    arrivalBufferMin: 10,
    totalMin: (ids.length + 1) * 5 + ids.length * 20 + 10,
    remainingAfterCourseMin: 10,
    remainingAfterArrivalBufferMin: 10,
  };
}

const first = course(['A']);
const snapshot: TwoStopSelectionSnapshot = {
  courses: [first, course(['X']), course(['Y'])],
  singleContinuation: { version: 1, cursor: 4 },
  singlePageState: 'more_available',
  scrollOffset: 720,
  focusedCourseId: 'X',
};

function engineFirstCourse(id: string, stayMin = 20): VerifiedCourseV1 {
  const value = course([id]);
  return {
    ...value,
    stops: [{ ...value.stops[0], stayMin, arrivalAt: '2026-09-03T00:05:00.000Z', departureAt: new Date(Date.parse('2026-09-03T00:05:00.000Z') + stayMin * 60_000).toISOString() }],
    stayMin,
    totalMin: 10 + stayMin + 10,
    remainingAfterCourseMin: 120 - (10 + stayMin + 10),
    remainingAfterArrivalBufferMin: 120 - (10 + stayMin + 10),
  };
}

function enginePortFixture(
  ids: string[],
  getRouteReceipt?: CourseV1RouteReceiptAdapter['getRouteReceipt'],
  onCompletedExact?: (result: ReleaseTwoStopSelectionResult) => void,
  initialLedger = { version: 1 as const, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 8 },
) {
  let calls = 0;
  const candidates: CourseV1Candidate[] = ids.map((id, index) => ({
    id, title: id, lat: 35.15 + index * 0.001, lon: 129.06 + index * 0.001,
    classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 20, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
  }));
  const port = createTwoStopSelectionEnginePort({
    now: new Date('2026-09-03T00:00:00.000Z'),
    origin: { id: 'origin', lat: 35.14, lon: 129.05 },
    destination: { id: 'destination', lat: 35.17, lon: 129.08 },
    remainingMin: 120,
    arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates },
    routes: { async getRoute() { return null; } },
    receiptRoutes: {
      async getRouteReceipt(from, to, budget) {
        calls += 1;
        return getRouteReceipt
          ? getRouteReceipt(from, to, budget)
          : { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
      },
    },
    ledger: initialLedger,
    onCompletedExact,
  });
  return { port, calls: () => calls };
}

test('UTWOSTOP01: A 선택 직후 started와 성공 1→2→3을 받은 순서대로 보존한다', async () => {
  const candidates = [course(['A', 'B1']), course(['B2', 'A']), course(['A', 'B3'])];
  const port: TwoStopSelectionPort = {
    async begin(input) {
      input.onProgress({ type: 'started', requestId: input.requestId, firstPlaceId: 'A' });
      candidates.forEach((item) => input.onProgress({ type: 'candidate_verified', requestId: input.requestId, firstPlaceId: 'A', course: item }));
      return { requestId: input.requestId, firstPlaceId: 'A', courses: candidates, pageState: 'more_available', continuation: { cursor: 3 } };
    },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
  };
  const controller = createTwoStopSelectionController(port);
  const counts: number[] = [];
  controller.subscribe((state) => { if (state.selection) counts.push(state.selection.courses.length); });
  await controller.begin(first, snapshot);
  assert.deepEqual(controller.getState().selection?.courses.map((item) => item.id), candidates.map((item) => item.id));
  assert.deepEqual([...new Set(counts)].filter((count) => count > 0), [1, 2, 3]);
  assert.equal(controller.getState().selection?.loading, false);
});

test('UTWOSTOP01: 늦은 성공·실패는 취소 또는 다른 A의 epoch에 섞이지 않는다', async () => {
  let late: Parameters<Parameters<TwoStopSelectionPort['begin']>[0]['onProgress']>[0] | undefined;
  const port: TwoStopSelectionPort = {
    async begin(input) {
      late = { type: 'candidate_verified', requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], course: course([input.firstCourse.placeIds[0], 'LATE']) };
      return new Promise(() => undefined);
    },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: '', courses: [], pageState: 'unavailable', reason: 'provider_unavailable' }; },
  };
  const controller = createTwoStopSelectionController(port);
  void controller.begin(first, snapshot);
  const staleFromA = late;
  const restored = controller.cancel();
  staleFromA && controller.acceptProgress(staleFromA);
  assert.deepEqual(restored, snapshot);
  assert.equal(controller.getState().selection, null);

  void controller.begin(course(['C']), snapshot);
  staleFromA && controller.acceptProgress(staleFromA);
  assert.equal(controller.getState().selection?.firstPlaceId, 'C');
  assert.deepEqual(controller.getState().selection?.courses, []);
});

test('UTWOSTOP01: 취소는 긴 one-stop 목록·continuation·상태·offset·focus를 route 없이 그대로 돌려준다', () => {
  let calls = 0;
  const port: TwoStopSelectionPort = {
    async begin(input) { calls += 1; return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'no_candidate', reason: 'no_nearby_second_candidate' }; },
    async continue(input) { calls += 1; return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
  };
  const controller = createTwoStopSelectionController(port);
  void controller.begin(first, snapshot);
  const beforeCancel = calls;
  assert.deepEqual(controller.cancel(), snapshot);
  assert.equal(calls, beforeCancel);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
});

test('UTWOSTOP01: pair 누적은 성공 순서를 유지하고 B 중복·7번째·연타를 막는다', async () => {
  let release!: () => void;
  let continueCalls = 0;
  const initial = [course(['A', 'B1']), course(['A', 'B2']), course(['A', 'B3'])];
  const page = [course(['A', 'B4']), course(['B5', 'A']), course(['A', 'B6']), course(['A', 'B7']), course(['A', 'B4'], '-duplicate')];
  const port: TwoStopSelectionPort = {
    async begin(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: initial, pageState: 'more_available', continuation: { cursor: 3 } }; },
    async continue(input) { continueCalls += 1; await new Promise<void>((resolve) => { release = resolve; }); return { requestId: input.requestId, firstPlaceId: 'A', courses: page, pageState: 'exhausted' }; },
  };
  const controller = createTwoStopSelectionController(port);
  await controller.begin(first, snapshot);
  const firstMore = controller.continue();
  const duplicateMore = controller.continue();
  release();
  await Promise.all([firstMore, duplicateMore]);
  assert.equal(continueCalls, 1);
  assert.deepEqual(controller.getState().selection?.courses.map((item) => item.placeIds.find((id) => id !== 'A')), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
});

test('UTWOSTOP01: partial 1/2와 zero에서도 A one-stop·취소를 유지한다', async () => {
  for (const count of [0, 1, 2]) {
    const items = Array.from({ length: count }, (_, index) => course(['A', `P${index + 1}`]));
    const port: TwoStopSelectionPort = {
      async begin(input) {
        return {
          requestId: input.requestId,
          firstPlaceId: 'A',
          courses: items,
          pageState: count ? 'more_available' : 'no_candidate',
          continuation: { cursor: count },
          ...(count ? {} : { reason: 'no_nearby_second_candidate' as const }),
        };
      },
      async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
    };
    const controller = createTwoStopSelectionController(port);
    await controller.begin(first, snapshot);
    assert.equal(controller.getState().selection?.firstCourse, first);
    assert.equal(controller.getState().selection?.courses.length, count);
    assert.deepEqual(controller.cancel(), snapshot);
  }
});

test('UTWOSTOP01: 취소·같은 A·다른 A 재선택은 session port ledger를 초기화하지 않는다', async () => {
  let ledger = 8;
  const observed: number[] = [];
  const port: TwoStopSelectionPort = {
    async begin(input) {
      observed.push(ledger);
      ledger += 2;
      return { requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], courses: [], pageState: 'no_candidate', reason: 'no_nearby_second_candidate' };
    },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: input.firstCourse.placeIds[0], courses: [], pageState: 'exhausted' }; },
  };
  const controller = createTwoStopSelectionController(port);
  await controller.begin(first, snapshot);
  controller.cancel();
  await controller.begin(first, snapshot);
  controller.cancel();
  await controller.begin(course(['C']), snapshot);
  assert.deepEqual(observed, [8, 10, 12]);
});

test('UTWOSTOP01: B→A snapshot은 엔진 순서를 유지하고 카드는 방문 순서를 단정하지 않는다', () => {
  const pair = course(['B', 'A']);
  const card = buildTwoStopCandidateCard(pair, first, (id) => ({ title: id === 'B' ? '두 번째 후보' : '선택 A', lat: 35.1, lon: 129.1, category: '문화시설', shortStay: { type: 'compact_culture' } }));
  assert.ok(card);
  assert.equal(card.placeId, 'B');
  assert.equal(card.title, '두 번째 후보');
  assert.equal(card.course, pair);
  assert.match(card.accessibilityLabel, /선택한 장소와 함께 가능한 곳/);
  assert.doesNotMatch(card.accessibilityLabel, /(^|[ ,])A([ ,]|$)|(^|[ ,])B([ ,]|$)/);
  assert.doesNotMatch(card.accessibilityLabel, /첫 번째 방문/);
});

test('UTWOSTOP04 수락 전 보완 failure-first: B 카드는 A one-stop 대비 추가 소요시간과 명시 total fallback을 구분한다', () => {
  const first51 = {
    ...course(['A']),
    stops: [{ ...course(['A']).stops[0]!, stayMin: 40 }],
    legs: [{ ...course(['A']).legs[0]!, min: 5 }, { ...course(['A']).legs[1]!, min: 6 }],
    travelMin: 11, stayMin: 40, totalMin: 61,
  };
  const pair88 = {
    ...course(['B', 'A']),
    stops: course(['B', 'A']).stops.map((stop) => ({ ...stop, stayMin: 30 })),
    legs: course(['B', 'A']).legs.map((leg, index) => ({ ...leg, min: [8, 10, 10][index]! })),
    travelMin: 28, stayMin: 60, totalMin: 98,
  };
  const getPlace = (id: string) => ({ title: id, lat: 35.1, lon: 129.1, category: '문화시설', shortStay: { type: 'compact_culture' as const } });
  const additional = buildTwoStopCandidateCard(pair88, first51, getPlace);
  assert.ok(additional);
  assert.deepEqual({ kind: additional.durationKind, min: additional.durationMin }, { kind: 'additional', min: 37 });
  assert.match(additional.accessibilityLabel, /함께 가면 약 37분 추가/);
  assert.doesNotMatch(additional.accessibilityLabel, /약 88분 코스/);

  const nonPositive = buildTwoStopCandidateCard({ ...pair88, travelMin: 10, stayMin: 40 }, first51, getPlace);
  assert.deepEqual(nonPositive && { kind: nonPositive.durationKind, min: nonPositive.durationMin }, { kind: 'total', min: 50 });
  assert.match(nonPositive?.accessibilityLabel ?? '', /선택 시 전체 약 50분/);
  const invalidFirst = buildTwoStopCandidateCard(pair88, course(['A', 'X']), getPlace);
  assert.deepEqual(invalidFirst && { kind: invalidFirst.durationKind, min: invalidFirst.durationMin }, { kind: 'total', min: 88 });
});

test('UTWOSTOP04 수락 전 보완 failure-first: exact 일부 뒤 provider/store terminal은 callback과 역선택 seed가 0이다', async () => {
  for (const unavailableReason of ['provider', 'store'] as const) {
    const token = {};
    const stored: Array<{ course: VerifiedCourseV1; recommendationSessionToken: object; inputSignature: string; providerSignature: string }> = [];
    const fixture = enginePortFixture(['A', 'B', 'C'], async (from, to) => {
      if (from.id === 'A' && to.id === 'C') return { result: 'unavailable', reason: unavailableReason, newProviderAttemptCount: 0, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
    }, (result) => result.courses.forEach((item) => stored.push({
      course: item,
      recommendationSessionToken: token,
      inputSignature: result.continuation.inputSignature,
      providerSignature: result.continuation.providerSignature,
    })));
    const observedPairSeeds: Array<readonly unknown[] | undefined> = [];
    const observingPort: TwoStopSelectionPort = {
      begin(input) { observedPairSeeds.push(input.verifiedPairCourses); return fixture.port.begin(input); },
      continue(input) { observedPairSeeds.push(input.verifiedPairCourses); return fixture.port.continue(input); },
    };
    const A = engineFirstCourse('A');
    const B = engineFirstCourse('B');
    const seeded = createFrozenTwoStopSeedPort(observingPort, () => [A, B, engineFirstCourse('C')], () => stored, token);
    const firstResult = await seeded.begin({ firstCourse: A, requestId: `terminal-${unavailableReason}-A`, signal: new AbortController().signal, onProgress() {} });
    assert.equal(firstResult.courses.length, 1);
    assert.equal(firstResult.reason, `${unavailableReason}_unavailable`);
    assert.equal(stored.length, 0);
    await seeded.begin({ firstCourse: B, requestId: `terminal-${unavailableReason}-B`, signal: new AbortController().signal, onProgress() {} });
    assert.deepEqual(observedPairSeeds[1], []);
  }

  let attemptLimitCommits = 0;
  const attemptLimit = enginePortFixture(['A', 'B', 'C'], async (from, to) => {
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
  }, () => { attemptLimitCommits += 1; }, {
    version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 14, sharedExpansionAttempts: 0, totalNewProviderAttempts: 22,
  });
  const attemptLimitResult = await attemptLimit.port.begin({
    firstCourse: engineFirstCourse('A'),
    verifiedOneStopCourses: ['A', 'B', 'C'].map((id) => engineFirstCourse(id)),
    requestId: 'terminal-attempt-limit', signal: new AbortController().signal, onProgress() {},
  });
  assert.equal(attemptLimitResult.courses.length, 1);
  assert.equal(attemptLimitResult.reason, undefined);
  assert.equal(attemptLimitCommits, 1);
});

test('UTWOSTOP04 수락 전 보완: begin과 continue는 terminal partial 저장 predicate를 함께 사용한다', async () => {
  for (const unavailableReason of ['provider', 'store'] as const) {
    const committed: ReleaseTwoStopSelectionResult[] = [];
    const fixture = enginePortFixture(['A', 'B', 'C', 'D', 'E', 'F'], async (from, to) => {
      if (from.id === 'A' && to.id === 'F') return { result: 'unavailable', reason: unavailableReason, newProviderAttemptCount: 0, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
    }, (result) => committed.push(result));
    const common = {
      firstCourse: engineFirstCourse('A'),
      verifiedOneStopCourses: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => engineFirstCourse(id)),
      signal: new AbortController().signal,
      onProgress() {},
    };
    const firstPage = await fixture.port.begin({ ...common, requestId: `continue-${unavailableReason}-begin` });
    assert.equal(firstPage.courses.length, 3);
    assert.equal(committed.length, 1);
    assert.ok(firstPage.continuation);
    const terminalPage = await fixture.port.continue({ ...common, requestId: `continue-${unavailableReason}-terminal`, continuation: firstPage.continuation! });
    assert.equal(terminalPage.courses.length, 1);
    assert.equal(terminalPage.reason, `${unavailableReason}_unavailable`);
    assert.equal(committed.length, 1);
  }
});

test('UTWOSTOP01: safe reason은 고정 문구만 쓰고 A one-stop 유지 여부를 바꾸지 않는다', () => {
  assert.deepEqual([
    'no_nearby_second_candidate', 'insufficient_time_for_two_stops', 'second_place_closed', 'no_exact_route',
    'provider_unavailable', 'store_unavailable', 'attempt_limit_reached', 'continuation_unavailable',
  ].map((reason) => twoStopSelectionReasonMessage(reason as Parameters<typeof twoStopSelectionReasonMessage>[0])), [
    '근처에서 함께 갈 수 있는 장소가 부족해요', '남은 시간 안에 두 곳을 안전하게 연결하기 어려워요', '이용 가능한 시간이 맞지 않아요', '실제 경로를 확인하지 못했어요',
    '경로 확인이 잠시 어려워요', '경로 확인이 잠시 어려워요', '이번 추천의 추가 확인 횟수를 모두 사용했어요', '이 결과에서는 더 확인할 수 없어요',
  ]);
});

test('UTWOSTOP01 표시 보완: rejection 뒤 B 3개 성공과 후보 소진은 실패 사유를 남기지 않는다', async () => {
  for (const reason of ['no_exact_route', 'no_nearby_second_candidate'] as const) {
    const items = [course(['A', 'S1']), course(['A', 'S2']), course(['S3', 'A'])];
    const port: TwoStopSelectionPort = {
      async begin(input) {
        input.onProgress({ type: 'candidate_rejected', requestId: input.requestId, firstPlaceId: 'A', reason });
        items.forEach((item) => input.onProgress({ type: 'candidate_verified', requestId: input.requestId, firstPlaceId: 'A', course: item }));
        return { requestId: input.requestId, firstPlaceId: 'A', courses: items, pageState: 'exhausted', reason };
      },
      async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
    };
    const controller = createTwoStopSelectionController(port);
    await controller.begin(first, snapshot);
    assert.equal(controller.getState().selection?.courses.length, 3);
    assert.equal(controller.getState().selection?.reason, undefined);
  }
});

test('UTWOSTOP01 표시 보완: partial 1/2만 부족 사유를 하나 유지한다', async () => {
  for (const count of [1, 2]) {
    const items = Array.from({ length: count }, (_, index) => course(['A', `L${index}`]));
    const port: TwoStopSelectionPort = {
      async begin(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: items, pageState: 'exhausted', reason: 'no_nearby_second_candidate' }; },
      async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
    };
    const controller = createTwoStopSelectionController(port);
    await controller.begin(first, snapshot);
    assert.equal(controller.getState().selection?.courses.length, count);
    assert.equal(controller.getState().selection?.reason, 'no_nearby_second_candidate');
  }
});

test('UTWOSTOP01 표시 보완: 누적 6은 정상 종료하고 실제 shared 소진 partial만 안내한다', async () => {
  const initial = [course(['A', 'C1']), course(['A', 'C2']), course(['A', 'C3'])];
  const final = [course(['A', 'C4']), course(['A', 'C5']), course(['A', 'C6'])];
  let continueCalls = 0;
  const capped = createTwoStopSelectionController({
    async begin(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: initial, pageState: 'more_available', continuation: { cursor: 3 } }; },
    async continue(input) { continueCalls += 1; return { requestId: input.requestId, firstPlaceId: 'A', courses: final, pageState: 'exhausted', reason: 'attempt_limit_reached' }; },
  });
  await capped.begin(first, snapshot);
  await capped.continue();
  await capped.continue();
  assert.equal(capped.getState().selection?.courses.length, 6);
  assert.equal(capped.getState().selection?.reason, undefined);
  assert.equal(continueCalls, 1);

  let exhaustedCalls = 0;
  const exhausted = createTwoStopSelectionController({
    async begin(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [initial[0]], pageState: 'more_available', continuation: { cursor: 1 } }; },
    async continue(input) { exhaustedCalls += 1; return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted', reason: 'attempt_limit_reached' }; },
  });
  await exhausted.begin(first, snapshot);
  await exhausted.continue();
  await exhausted.continue();
  assert.equal(exhausted.getState().selection?.courses.length, 1);
  assert.equal(exhausted.getState().selection?.reason, 'attempt_limit_reached');
  assert.equal(exhaustedCalls, 1);
});

test('UTWOSTOP01 표시 보완: 다음 완료에 reason이 없으면 이전 page 사유를 제거한다', async () => {
  const controller = createTwoStopSelectionController({
    async begin(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [course(['A', 'R1'])], pageState: 'more_available', continuation: { cursor: 1 }, reason: 'no_exact_route' }; },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [course(['A', 'R2'])], pageState: 'more_available', continuation: { cursor: 2 } }; },
  });
  await controller.begin(first, snapshot);
  assert.equal(controller.getState().selection?.reason, 'no_exact_route');
  await controller.continue();
  assert.equal(controller.getState().selection?.reason, undefined);
});

test('UTWOSTOP03: production은 인라인 선택·sticky tray·fixed CTA만 사용하고 과거 secondary를 제거한다', () => {
  const panel = fs.readFileSync('src/ui/recommendation/TwoStopSelectionPanel.tsx', 'utf8');
  const tray = fs.readFileSync('src/ui/recommendation/TwoStopSelectionTray.tsx', 'utf8');
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf8');
  assert.match(panel, /선택한 장소/);
  assert.match(panel, /함께 갈 장소를 확인하고 있어요/);
  assert.match(panel, /twoStopCandidateDurationLabel\(candidate\)/);
  assert.doesNotMatch(panel, /candidate\.courseMin/);
  assert.match(panel, /accessibilityState=\{\{ selected \}\}/);
  assert.match(panel, /✓ 선택됨/);
  assert.doesNotMatch(panel, /선택한 장소 코스 시작하기/);
  assert.match(panel, /선택한 장소와 함께 가능한 곳/);
  assert.match(panel, /함께 둘러볼 장소/);
  assert.doesNotMatch(panel, />A[^<]*</);
  assert.doesNotMatch(panel, /첫 번째 장소/);
  assert.match(tray, /two-stop-selection-tray/);
  assert.match(tray, /two-stop-fixed-cta/);
  assert.match(tray, /이 장소로 코스 보기/);
  assert.match(tray, /선택한 2곳 코스 보기/);
  assert.match(tray, /width: 44, height: 44/);
  assert.match(tray, /minHeight: 52/);
  assert.match(confirm, /testID="verified-course-start"/);
  assert.doesNotMatch(confirm, /TwoStopSecondaryAction|한 곳 더 고르기|recordTwoStopSelectionIntent/);
  assert.match(results, /TwoStopSelectionPanel/);
  assert.match(results, /createInlineTwoStopSelectionController/);
  assert.match(results, /beforeRemove/);
  assert.match(results, /selected \? 86 \+ Math\.max\(insets\.bottom, 10\) : 34/);
  assert.doesNotMatch(results, /consumeTwoStopSelectionIntent/);
  assert.doesNotMatch(results, /beginReleaseTwoStopSelectionV1/);
});

test('UTWOSTOP03 사용자 반환 failure-first: 선택 전후는 같은 Results ScrollView에서 course region만 교체한다', () => {
  const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf8');
  assert.equal((results.match(/ref=\{scrollRef\}/g) ?? []).length, 1);
  assert.doesNotMatch(results, /if \(inlineState\.mode !== 'idle'\) \{[\s\S]*?return <View style=\{s\.root\}>/);
  assert.match(results, /resultsCourseRegionMode/);
  assert.match(results, /style=\{s\.traySlot\}/);
  assert.match(results, /style=\{s\.ctaSlot\}/);
  const immediate = { mode: 'first_selected', firstCourse: first, selectedPairCourse: null, snapshot, pairEnabled: true } as const;
  assert.equal(resultsCourseRegionMode({ mode: 'idle' }, null), 'one_stop');
  assert.equal(resultsCourseRegionMode(immediate, null), 'pair_loading');
  assert.equal(resultsCourseRegionMode({ ...immediate, pairEnabled: false }, null), 'pair_terminal');
});

test('UTWOSTOP03 failure-first: A는 즉시 선택되고 pair begin은 연타에도 한 번만 실행된다', async () => {
  let beginCalls = 0;
  const pair = createTwoStopSelectionController({
    async begin(input) { beginCalls += 1; return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'no_candidate' }; },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
  });
  const inline = createInlineTwoStopSelectionController(pair, () => true);
  const firstBegin = inline.selectFirst(first, snapshot);
  const duplicateBegin = inline.selectFirst(first, snapshot);
  assert.equal(inline.getState().mode, 'first_selected');
  assert.equal(inline.getSelectedCourse(), first);
  assert.equal(await firstBegin, true);
  assert.equal(await duplicateBegin, false);
  assert.equal(beginCalls, 1);
});

test('UTWOSTOP03: exact B 선택·교체·해제는 호출 없이 identity와 후보 상태를 보존한다', async () => {
  let beginCalls = 0;
  let aborts = 0;
  const pairs = [course(['A', 'B1']), course(['B2', 'A'])];
  const pair = createTwoStopSelectionController({
    async begin(input) {
      beginCalls += 1;
      input.signal.addEventListener('abort', () => { aborts += 1; });
      return { requestId: input.requestId, firstPlaceId: 'A', courses: pairs, pageState: 'more_available', continuation: { cursor: 2 }, reason: 'no_exact_route' };
    },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
  });
  const inline = createInlineTwoStopSelectionController(pair, () => true);
  await inline.selectFirst(first, snapshot);
  const before = pair.getState().selection;
  assert.equal(inline.selectPair(pairs[0]), true);
  assert.equal(inline.getState().mode, 'pair_selected');
  assert.equal(inline.getSelectedCourse(), pairs[0]);
  assert.equal(inline.selectPair({ ...pairs[1] }), false);
  assert.equal(inline.selectPair(pairs[1]), true);
  assert.equal(inline.getSelectedCourse(), pairs[1]);
  assert.equal(inline.clearPair(), true);
  assert.equal(inline.getState().mode, 'first_selected');
  assert.equal(pair.getState().selection, before);
  assert.equal(beginCalls, 1);
  assert.equal(aborts, 0);
});

test('UTWOSTOP03: A 취소는 snapshot을 복원하고 pending을 abort하며 route-only도 one-stop 선택은 허용한다', async () => {
  let aborts = 0;
  const pair = createTwoStopSelectionController({
    async begin(input) {
      await new Promise<void>((resolve) => input.signal.addEventListener('abort', () => { aborts += 1; resolve(); }));
      return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'unavailable' };
    },
    async continue(input) { return { requestId: input.requestId, firstPlaceId: 'A', courses: [], pageState: 'exhausted' }; },
  });
  const inline = createInlineTwoStopSelectionController(pair, () => true);
  const pending = inline.selectFirst(first, snapshot);
  assert.deepEqual(inline.cancelFirst(), snapshot);
  await pending;
  assert.equal(aborts, 1);
  assert.equal(inline.getState().mode, 'idle');

  const routeOnly = createInlineTwoStopSelectionController(null, () => false);
  assert.equal(await routeOnly.selectFirst(first, snapshot), true);
  assert.equal(routeOnly.getState().mode, 'first_selected');
  assert.equal(routeOnly.getPairSelection(), null);
  assert.equal(routeOnly.getSelectedCourse(), first);
});

test('UTWOSTOP01: secondary action은 fixture port와 exact one-stop이 함께 있을 때만 열린다', () => {
  const port = { begin: async () => { throw new Error('unused'); }, continue: async () => { throw new Error('unused'); } } satisfies TwoStopSelectionPort;
  assert.equal(canOfferTwoStopSelection(first, port), true);
  assert.equal(canOfferTwoStopSelection(first, null), false);
  assert.equal(canOfferTwoStopSelection(course(['A', 'B']), port), false);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /AbortSignal|provider|function/);
  assert.deepEqual(JSON.parse(serialized), snapshot);
});

test('UTWOSTOP01: 2-Y adapter는 공개 begin export를 UI progress·JSON continuation으로 정규화한다', async () => {
  const candidates: CourseV1Candidate[] = ['A', 'B'].map((id, index) => ({
    id,
    title: id,
    lat: 35.15 + index * 0.001,
    lon: 129.06 + index * 0.001,
    classification: 'representative_standard',
    minStayMin: 20,
    recommendedStayMin: 20,
    maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
  }));
  const events: string[] = [];
  let routeCalls = 0;
  const engineFirst: VerifiedCourseV1 = {
    ...first,
    stops: [{ ...first.stops[0], arrivalAt: '2026-09-03T00:05:00.000Z', departureAt: '2026-09-03T00:25:00.000Z' }],
    remainingAfterCourseMin: 80,
    remainingAfterArrivalBufferMin: 80,
  };
  const port = createTwoStopSelectionEnginePort({
    now: new Date('2026-09-03T00:00:00.000Z'),
    origin: { id: 'origin', lat: 35.14, lon: 129.05 },
    destination: { id: 'destination', lat: 35.17, lon: 129.08 },
    remainingMin: 120,
    arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates },
    routes: { async getRoute() { return null; } },
    receiptRoutes: {
      async getRouteReceipt() {
        routeCalls += 1;
        return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
      },
    },
    ledger: { version: 1, initialOneStopAttempts: 0, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 0 },
  });
  const result = await port.begin({
    firstCourse: engineFirst,
    requestId: 'adapter-1',
    signal: new AbortController().signal,
    onProgress: (event) => events.push(event.type),
  });
  assert.equal(result.courses.length, 1, JSON.stringify(result));
  assert.deepEqual(new Set(result.courses[0]?.placeIds), new Set(['A', 'B']));
  assert.deepEqual(events, ['started', 'candidate_verified', 'completed']);
  assert.doesNotThrow(() => JSON.stringify(result.continuation));
  assert.equal(result.pageState, 'exhausted');
  const firstRouteCalls = routeCalls;
  const reused = await port.begin({
    firstCourse: engineFirst,
    requestId: 'adapter-2',
    signal: new AbortController().signal,
    onProgress: (event) => events.push(event.type),
  });
  assert.ok(firstRouteCalls > 0);
  assert.equal(routeCalls, firstRouteCalls);
  assert.deepEqual(reused.courses.map(({ id }) => id), result.courses.map(({ id }) => id));
  assert.deepEqual(reused.continuation, result.continuation);
});

test('UTWOSTOP03 사용자 반환: frozen 표시 seed는 2-Z engine port에서 endpoint 4구간을 재사용한다', async () => {
  const fixture = enginePortFixture(['A', 'B']);
  const A = engineFirstCourse('A');
  const B = engineFirstCourse('B');
  const port = createFrozenTwoStopSeedPort(fixture.port, () => [A, B]);
  const result = await port.begin({ firstCourse: A, requestId: 'seeded-ui-port', signal: new AbortController().signal, onProgress() {} });
  assert.equal(result.courses.length, 1, JSON.stringify(result));
  assert.equal(fixture.calls(), 2);
  assert.deepEqual(new Set(result.courses[0].placeIds), new Set(['A', 'B']));
});

test('UTWOSTOP01 session reuse: pair 더보기 누적 6도 취소 뒤 같은 선택에서 route 0으로 복원한다', async () => {
  const fixture = enginePortFixture(['A', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6']);
  const controller = createTwoStopSelectionController(fixture.port);
  await controller.begin(engineFirstCourse('A'), snapshot);
  await controller.continue();
  assert.equal(controller.getState().selection?.courses.length, 6);
  const ids = controller.getState().selection?.courses.map(({ id }) => id);
  const continuation = controller.getState().selection?.continuation;
  const calls = fixture.calls();
  controller.cancel();
  await controller.begin(engineFirstCourse('A'), snapshot);
  assert.equal(fixture.calls(), calls);
  assert.deepEqual(controller.getState().selection?.courses.map(({ id }) => id), ids);
  assert.deepEqual(controller.getState().selection?.continuation, continuation);
});

test('UTWOSTOP01 session reuse: 다른 선택은 독립 계산하고 선택→다른 선택→선택은 기존 branch만 재사용한다', async () => {
  const fixture = enginePortFixture(['A', 'B', 'C']);
  const controller = createTwoStopSelectionController(fixture.port);
  await controller.begin(engineFirstCourse('A'), snapshot);
  const firstIds = controller.getState().selection?.courses.map(({ id }) => id);
  controller.cancel();
  const beforeDifferent = fixture.calls();
  await controller.begin(engineFirstCourse('C'), snapshot);
  assert.ok(fixture.calls() > beforeDifferent);
  assert.equal(controller.getState().selection?.firstPlaceId, 'C');
  assert.ok(controller.getState().selection?.courses.every(({ placeIds }) => placeIds.includes('C')));
  controller.cancel();
  const beforeReuse = fixture.calls();
  await controller.begin(engineFirstCourse('A'), snapshot);
  assert.equal(fixture.calls(), beforeReuse);
  assert.deepEqual(controller.getState().selection?.courses.map(({ id }) => id), firstIds);
});

test('UTWOSTOP01 session reuse: abort된 미완료와 transient terminal은 cache하지 않는다', async () => {
  let release!: () => void;
  let delayed = true;
  const pendingFixture = enginePortFixture(['A', 'B'], async () => {
    if (delayed) {
      delayed = false;
      await new Promise<void>((resolve) => { release = resolve; });
    }
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
  });
  const controller = createTwoStopSelectionController(pendingFixture.port);
  const pending = controller.begin(engineFirstCourse('A'), snapshot);
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.cancel();
  release();
  await pending;
  const afterAbort = pendingFixture.calls();
  await controller.begin(engineFirstCourse('A'), snapshot);
  assert.ok(pendingFixture.calls() > afterAbort);

  const transient = enginePortFixture(['A', 'B'], async () => ({
    result: 'unavailable', reason: 'provider', newProviderAttemptCount: 0, reused: false,
  }));
  const transientController = createTwoStopSelectionController(transient.port);
  await transientController.begin(engineFirstCourse('A'), snapshot);
  const firstTerminalCalls = transient.calls();
  transientController.cancel();
  await transientController.begin(engineFirstCourse('A'), snapshot);
  assert.ok(transient.calls() > firstTerminalCalls);
});

test('UTWOSTOP01 session reuse: 같은 ID라도 firstCourse signature가 바뀌면 stale 카드를 먼저 쓰지 않는다', async () => {
  const fixture = enginePortFixture(['A', 'B']);
  const firstResult = await fixture.port.begin({ firstCourse: engineFirstCourse('A'), requestId: 'signature-1', signal: new AbortController().signal, onProgress() {} });
  const calls = fixture.calls();
  const changed = await fixture.port.begin({ firstCourse: engineFirstCourse('A', 25), requestId: 'signature-2', signal: new AbortController().signal, onProgress() {} });
  assert.ok(fixture.calls() > calls);
  assert.notDeepEqual(changed.continuation, firstResult.continuation);
  assert.ok(changed.courses.every(({ placeIds }) => placeIds.includes('A')));
});

test('UTWOSTOP01 표시 보완: 2-Y adapter는 정상 3/6과 실제 shared 12회 소진을 분리한다', () => {
  const ledger = (sharedExpansionAttempts: number) => ({
    version: 1 as const,
    initialOneStopAttempts: 8,
    automaticTwoStopAttempts: 0,
    sharedExpansionAttempts,
    totalNewProviderAttempts: 8 + sharedExpansionAttempts,
  });
  const result = (
    courses: VerifiedCourseV1[],
    reason: 'no_exact_route' | 'no_nearby_second_candidate' | 'attempt_limit_reached',
    verifiedCount: number,
    sharedExpansionAttempts: number,
  ): ReleaseTwoStopSelectionResult => ({
    state: 'exhausted', requestId: 'normalize', firstPlaceId: 'A', courses, reasons: [reason], ledger: ledger(sharedExpansionAttempts),
    continuation: {
      version: 1, firstPlaceId: 'A', cursor: courses.length, orderedCandidateIds: courses.map((item) => item.id),
      candidateSetSignature: 'fixture', inputSignature: 'fixture', providerSignature: 'fixture', firstCourseSignature: 'fixture',
      attemptedPairSignatures: [], rejectedPairSignatures: [], verifiedPairSignatures: [], routeReceiptKeys: [],
      verifiedCount, ledger: ledger(sharedExpansionAttempts), stopReason: reason,
    },
  });
  const three = [course(['A', 'N1']), course(['A', 'N2']), course(['A', 'N3'])];
  assert.equal(normalizeTwoStopSelectionEngineResult(result(three, 'no_exact_route', 3, 0), 'automatic').reason, undefined);
  assert.equal(normalizeTwoStopSelectionEngineResult(result(three, 'no_nearby_second_candidate', 3, 0), 'automatic').reason, undefined);
  assert.equal(normalizeTwoStopSelectionEngineResult(result(three, 'attempt_limit_reached', 6, 12), 'shared').reason, undefined);
  assert.equal(normalizeTwoStopSelectionEngineResult(result([three[0]], 'attempt_limit_reached', 1, 12), 'shared').reason, 'attempt_limit_reached');
  assert.equal(normalizeTwoStopSelectionEngineResult(result([three[0]], 'attempt_limit_reached', 1, 11), 'shared').reason, undefined);
});
