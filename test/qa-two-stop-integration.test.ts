import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1Candidate, ReleaseTwoStopAttemptLedger, VerifiedCourseV1 } from '../src/engine';
import { createCourseV1ProxyRouteAdapter, type RouteProxyFunctionRequest } from '../src/services/routeProxyClientAdapter';
import { buildCourseV1ConnectorRequests, buildCourseV1RouteGeometryModel, loadCourseV1WalkConnectors } from '../src/ui/recommendation/courseV1RouteGeometryModel';
import { createTwoStopSelectionEnginePort } from '../src/ui/recommendation/twoStopSelectionEnginePort';
import { buildTwoStopCandidateCard, createTwoStopSelectionController, type TwoStopSelectionSnapshot } from '../src/ui/recommendation/twoStopSelectionModel';

const now = new Date('2026-09-03T15:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const destination = { id: 'destination', lat: 35.16, lon: 129.07 };

type Receipt = Readonly<{
  id: `TS-${string}`;
  placeIds: readonly string[];
  chosenOrder: readonly string[];
  stopCount: number;
  legCount: number;
  exactSource: 'route-proxy-fixture' | 'verified-snapshot' | 'ui-connector-port';
  reason?: string;
  adapterCalls: number;
  providerAttempts: number;
  reuse: number;
  connectorCalls: number;
  staleIgnored: number;
}>;

const receipts: Receipt[] = [];
const record = (receipt: Receipt) => { receipts.push(receipt); return receipt; };

function place(id: string, extra: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  const offset = id.charCodeAt(0) % 10 / 10_000;
  return {
    id, title: `장소 ${id}`, lat: 35.151 + offset, lon: 129.061 + offset,
    classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 20, maxStayMin: 60,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
    ...extra,
  };
}

function oneStop(id = 'A', remainingMin = 120): VerifiedCourseV1 {
  return {
    id: `one-${id}`, placeIds: [id],
    stops: [{ placeId: id, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: new Date(now.getTime() + 5 * 60_000).toISOString(), departureAt: new Date(now.getTime() + 25 * 60_000).toISOString() }],
    legs: [{ fromId: origin.id, toId: id, mode: 'walk', min: 5 }, { fromId: id, toId: destination.id, mode: 'walk', min: 5 }],
    stayMin: 20, travelMin: 10, totalMin: 40, arrivalBufferMin: 10,
    remainingAfterCourseMin: remainingMin - 40, remainingAfterArrivalBufferMin: remainingMin - 40,
  };
}

const initialLedger = (extra: Partial<ReleaseTwoStopAttemptLedger> = {}): ReleaseTwoStopAttemptLedger => ({
  version: 1, initialOneStopAttempts: 8, automaticTwoStopAttempts: 0,
  sharedExpansionAttempts: 0, totalNewProviderAttempts: 8, ...extra,
});

type ProxyPlan = Readonly<{
  minutes?: Readonly<Record<string, number>>;
  noRoute?: ReadonlySet<string>;
  terminal?: 'store' | 'provider' | 'limited';
  cacheOnly?: boolean;
  delay?: () => Promise<void>;
}>;

function fixturePort(ids: string[], plan: ProxyPlan = {}, ledger = initialLedger()) {
  const calls: RouteProxyFunctionRequest[] = [];
  let providerAttempts = 0;
  let reuse = 0;
  const adapter = createCourseV1ProxyRouteAdapter({
    resolveScope: (from, to) => ({ kind: 'public_segment', catalogVersion: 'qa-ts-v1', fromPoiId: from.id, toPoiId: to.id }),
    invoker: {
      async invoke(request) {
        calls.push(request);
        if (plan.delay) await plan.delay();
        const scope = request.scope;
        assert.equal(scope.kind, 'public_segment');
        const key = `${scope.fromPoiId}>${scope.toPoiId}`;
        const cost = plan.cacheOnly || request.maxNewProviderAttemptCount === 0 ? 0 : 1;
        const reuseKind = cost === 0 ? 'server_cache_hit' as const : 'provider_attempt' as const;
        providerAttempts += cost;
        reuse += cost === 0 ? 1 : 0;
        if (plan.terminal) {
          const status = plan.terminal === 'store' ? 'store_unavailable' : plan.terminal === 'limited' ? 'limited' : 'http_error';
          return { status, receipt: { result: 'unavailable' as const, newProviderAttemptCount: cost as 0 | 1, reuse: reuseKind, unavailableReason: plan.terminal } };
        }
        if (plan.noRoute?.has(key)) return { mode: request.mode, status: 'no_route' as const, receipt: { result: 'no_route' as const, newProviderAttemptCount: 0 as const, reuse: 'server_cache_hit' as const } };
        return { mode: request.mode, status: 'ok' as const, totalMin: plan.minutes?.[key] ?? 5, receipt: { result: 'exact' as const, newProviderAttemptCount: cost as 0 | 1, reuse: reuseKind } };
      },
    },
  });
  const candidates = ids.map((id) => place(id));
  const port = createTwoStopSelectionEnginePort({
    now, origin, destination, remainingMin: 120, arrivalBufferMin: 10,
    provider: { listRepresentativeCandidates: () => candidates }, routes: adapter, receiptRoutes: adapter, ledger,
  });
  return { port, calls, metrics: () => ({ providerAttempts, reuse }) };
}

const snapshot: TwoStopSelectionSnapshot = {
  courses: [oneStop('A'), oneStop('X'), oneStop('Y')], singleContinuation: { version: 1, cursor: 4 },
  singlePageState: 'more_available', scrollOffset: 720, focusedCourseId: 'one-X',
};

async function begin(ids: string[], plan: ProxyPlan = {}, first = oneStop('A'), ledger = initialLedger()) {
  const fixture = fixturePort(ids, plan, ledger);
  const controller = createTwoStopSelectionController(fixture.port);
  await controller.begin(first, snapshot);
  return { ...fixture, controller, selection: controller.getState().selection! };
}

test('TS-01 engine → Proxy adapter → UI port는 탈락 뒤 성공 1→2→3을 순서대로 append한다', async () => {
  const fixture = fixturePort(['A', 'B', 'C', 'D', 'E'], { noRoute: new Set(['A>B', 'origin>B']) });
  const controller = createTwoStopSelectionController(fixture.port);
  const counts: number[] = [];
  controller.subscribe((state) => { if (state.selection) counts.push(state.selection.courses.length); });
  await controller.begin(oneStop('A'), snapshot);
  const selection = controller.getState().selection!;
  const order = selection.courses.map((course) => course.placeIds.find((id) => id !== 'A')!);
  assert.equal(new Set(order).size, 3);
  assert.deepEqual([...new Set(counts)].filter((count) => count > 0), [1, 2, 3]);
  assert.equal(selection.reason, undefined);
  record({ id: 'TS-01', placeIds: selection.courses.flatMap((c) => c.placeIds), chosenOrder: order, stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: fixture.calls.length, ...fixture.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-02 양방향 exact 중 A-first가 1분 빠르면 역순 중복 없이 하나만 남는다', async () => {
  const result = await begin(['A', 'B'], { minutes: { 'A>B': 4, 'B>destination': 4, 'origin>B': 5, 'B>A': 4 } });
  assert.deepEqual(result.selection.courses.map((c) => c.placeIds), [['A', 'B']]);
  record({ id: 'TS-02', placeIds: ['A', 'B'], chosenOrder: ['A', 'B'], stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-03 양방향 동률은 A-first로 결정한다', async () => {
  const result = await begin(['A', 'B']);
  assert.deepEqual(result.selection.courses[0]?.placeIds, ['A', 'B']);
  record({ id: 'TS-03', placeIds: ['A', 'B'], chosenOrder: ['A', 'B'], stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-04 B-first만 통과해도 선택 장소 A와 실제 순서를 UI 카드가 분리한다', async () => {
  const result = await begin(['A', 'B'], { noRoute: new Set(['A>B']) });
  const course = result.selection.courses[0]!;
  const card = buildTwoStopCandidateCard(course, 'A', (id) => ({ title: id === 'B' ? '두 번째 후보' : '선택 장소', lat: 35.1, lon: 129.1, category: '문화시설', shortStay: { type: 'compact_culture' } }));
  assert.deepEqual(course.placeIds, ['B', 'A']);
  assert.equal(card?.placeId, 'B');
  assert.doesNotMatch(card?.accessibilityLabel ?? '', /첫 번째 방문|(^|[ ,])A([ ,]|$)|(^|[ ,])B([ ,]|$)/);
  record({ id: 'TS-04', placeIds: course.placeIds, chosenOrder: course.placeIds, stopCount: course.stops.length, legCount: course.legs.length, exactSource: 'route-proxy-fixture', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-05 후보 소진 partial은 부족 사유를 남기고 3개 성공은 사유를 지운다', async () => {
  const partial = await begin(['A', 'B', 'C']);
  assert.equal(partial.selection.courses.length, 2);
  assert.equal(partial.selection.reason, 'no_nearby_second_candidate');
  const full = await begin(['A', 'B', 'C', 'D']);
  assert.equal(full.selection.courses.length, 3);
  assert.equal(full.selection.reason, undefined);
  record({ id: 'TS-05', placeIds: partial.selection.courses.flatMap((c) => c.placeIds), chosenOrder: partial.selection.courses.flatMap((c) => c.placeIds), stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', reason: partial.selection.reason, adapterCalls: partial.calls.length + full.calls.length, providerAttempts: partial.metrics().providerAttempts + full.metrics().providerAttempts, reuse: 0, connectorCalls: 0, staleIgnored: 0 });
});

test('TS-06 전 후보 no-route면 A one-stop과 안전 사유만 유지한다', async () => {
  const result = await begin(['A', 'B', 'C'], { noRoute: new Set(['A>B', 'origin>B', 'A>C', 'origin>C']) });
  assert.equal(result.selection.courses.length, 0);
  assert.equal(result.selection.firstCourse.placeIds[0], 'A');
  assert.ok(['no_exact_route', 'provider_unavailable'].includes(result.selection.reason ?? ''));
  record({ id: 'TS-06', placeIds: ['A'], chosenOrder: ['A'], stopCount: 1, legCount: 2, exactSource: 'route-proxy-fixture', reason: result.selection.reason, adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-07 store/provider/limit terminal은 즉시 중단하고 fallback provider를 만들지 않는다', async () => {
  let totalCalls = 0; let attempts = 0;
  for (const terminal of ['store', 'provider', 'limited'] as const) {
    const result = await begin(['A', 'B', 'C'], { terminal });
    assert.equal(result.selection.courses.length, 0);
    assert.equal(result.calls.length, 1);
    totalCalls += result.calls.length; attempts += result.metrics().providerAttempts;
  }
  record({ id: 'TS-07', placeIds: ['A'], chosenOrder: ['A'], stopCount: 1, legCount: 2, exactSource: 'route-proxy-fixture', reason: 'terminal', adapterCalls: totalCalls, providerAttempts: attempts, reuse: 0, connectorCalls: 0, staleIgnored: 0 });
});

test('TS-08 initial 8 + auto 16 + shared 12는 36에서 닫히고 37번째 호출은 없다', async () => {
  const result = await begin(['A', 'B', 'C', 'D', 'E'], {}, oneStop('A'), initialLedger());
  const before = result.calls.length;
  await result.controller.continue();
  const at36 = result.calls.length;
  await result.controller.continue();
  assert.ok(result.metrics().providerAttempts <= 28);
  assert.equal(result.calls.length, at36);
  assert.ok(at36 >= before);
  record({ id: 'TS-08', placeIds: result.controller.getState().selection?.courses.flatMap((c) => c.placeIds) ?? [], chosenOrder: [], stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: result.calls.length, providerAttempts: 8 + result.metrics().providerAttempts, reuse: result.metrics().reuse, connectorCalls: 0, staleIgnored: 0 });
});

test('TS-09 one-stop shared 8 사용 뒤 pair more는 남은 4회만 사용한다', async () => {
  const result = await begin(['A', 'B', 'C', 'D', 'E'], { cacheOnly: true }, oneStop('A'), initialLedger({ sharedExpansionAttempts: 8, totalNewProviderAttempts: 16 }));
  await result.controller.continue();
  assert.ok(result.metrics().providerAttempts <= 4);
  record({ id: 'TS-09', placeIds: result.selection.courses.flatMap((c) => c.placeIds), chosenOrder: [], stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-10 cache/session hit은 adapter를 통과하지만 provider attempt는 0이다', async () => {
  const result = await begin(['A', 'B', 'C'], { cacheOnly: true });
  assert.ok(result.calls.length > 0);
  assert.equal(result.metrics().providerAttempts, 0);
  assert.equal(result.metrics().reuse, result.calls.length);
  record({ id: 'TS-10', placeIds: result.selection.courses.flatMap((c) => c.placeIds), chosenOrder: [], stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-11 cancel 뒤 late 성공·오류는 snapshot을 바꾸지 않는다', async () => {
  let release!: () => void;
  const fixture = fixturePort(['A', 'B'], { delay: () => new Promise<void>((resolve) => { release = resolve; }) });
  const controller = createTwoStopSelectionController(fixture.port);
  const pending = controller.begin(oneStop('A'), snapshot);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(controller.cancel(), snapshot);
  release(); await pending;
  assert.equal(controller.getState().selection, null);
  record({ id: 'TS-11', placeIds: snapshot.courses.flatMap((c) => c.placeIds), chosenOrder: [], stopCount: 1, legCount: 2, exactSource: 'verified-snapshot', adapterCalls: fixture.calls.length, ...fixture.metrics(), connectorCalls: 0, staleIgnored: 1 });
});

test('TS-12 cancel 후 같은 A와 다른 C branch는 ledger를 공유하되 pair를 중복하지 않는다', async () => {
  const fixture = fixturePort(['A', 'B', 'C'], { cacheOnly: true });
  const controller = createTwoStopSelectionController(fixture.port);
  await controller.begin(oneStop('A'), snapshot); const firstCalls = fixture.calls.length;
  controller.cancel(); await controller.begin(oneStop('A'), snapshot);
  const sameCalls = fixture.calls.length - firstCalls;
  controller.cancel(); await controller.begin(oneStop('C'), snapshot);
  record({ id: 'TS-12', placeIds: ['A', 'C'], chosenOrder: [], stopCount: 2, legCount: 3, exactSource: 'route-proxy-fixture', adapterCalls: fixture.calls.length, ...fixture.metrics(), connectorCalls: 0, staleIgnored: 0 });
  assert.equal(sameCalls, 0);
  assert.equal(controller.getState().selection?.firstPlaceId, 'C');
});

test('TS-13 B 선택은 검증 snapshot 그대로이며 추가 route 호출은 0이다', async () => {
  const result = await begin(['A', 'B']);
  const selected = result.selection.courses[0]!; const before = result.calls.length;
  const detail = buildCourseV1RouteGeometryModel(selected);
  assert.equal(result.calls.length, before);
  assert.deepEqual(selected.placeIds, selected.stops.map((stop) => stop.placeId));
  assert.equal(selected.legs.length, 3);
  assert.ok(detail.segments.length === 0 || detail.segments.every((segment) => segment.quality === 'precise'));
  record({ id: 'TS-13', placeIds: selected.placeIds, chosenOrder: selected.placeIds, stopCount: selected.stops.length, legCount: selected.legs.length, exactSource: 'verified-snapshot', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-14 transit 3 legs의 endpoint gap은 connector 최대 6·동시 2·부분 실패를 보존한다', async () => {
  const points = [origin, place('A'), place('B'), destination];
  const geometry = { paths: [{ points: [{ lat: 35.20, lon: 129.10 }, { lat: 35.21, lon: 129.11 }] }] };
  const course: VerifiedCourseV1 = { ...oneStop('A'), id: 'two-A-B', placeIds: ['A', 'B'], stops: [oneStop('A').stops[0]!, { ...oneStop('A').stops[0]!, placeId: 'B' }], legs: [0, 1, 2].map((index) => ({ fromId: points[index]!.id, toId: points[index + 1]!.id, mode: 'transit' as const, min: 10, geometry })), stayMin: 40, travelMin: 30, totalMin: 80, remainingAfterCourseMin: 40, remainingAfterArrivalBufferMin: 40 };
  const session = { origin, destination, remainingMinutes: 120, arrivalBufferMinutes: 10 } as never;
  const requests = buildCourseV1ConnectorRequests(course, session, (id) => points.find((point) => point.id === id));
  let active = 0; let maxActive = 0; let connectorCalls = 0;
  const loaded = await loadCourseV1WalkConnectors(requests, { reset() {}, async getConnector(from, to) { connectorCalls += 1; active += 1; maxActive = Math.max(maxActive, active); await new Promise<void>((resolve) => setImmediate(resolve)); active -= 1; if (connectorCalls === 2) return { status: 'unavailable' as const, reason: 'route_unavailable' as const, receipt: { newRequestStarted: true, reuse: 'new_request' as const } }; return { status: 'exact_geometry' as const, geometry: { paths: [{ points: [from, to] }] }, receipt: { newRequestStarted: true, reuse: 'new_request' as const } }; } });
  const model = buildCourseV1RouteGeometryModel(course, loaded.connectors);
  assert.equal(requests.length, 6); assert.equal(connectorCalls, 6); assert.ok(maxActive <= 2); assert.equal(loaded.failedCount, 1); assert.ok(model.legend.some((item) => item.mode === 'walk'));
  record({ id: 'TS-14', placeIds: course.placeIds, chosenOrder: course.placeIds, stopCount: 2, legCount: 3, exactSource: 'ui-connector-port', adapterCalls: 0, providerAttempts: 0, reuse: 0, connectorCalls, staleIgnored: 0 });
});

test('TS-15 malformed continuation은 route 0·one-stop 유지·safe error다', async () => {
  const fixture = fixturePort(['A', 'B']); const controller = createTwoStopSelectionController(fixture.port);
  const invalidSnapshot = { ...snapshot, singleContinuation: { broken: true } };
  await controller.begin(oneStop('A'), invalidSnapshot);
  const afterBegin = fixture.calls.length;
  const state = controller.getState().selection!;
  await controller.continue();
  assert.ok(fixture.calls.length >= afterBegin);
  const direct = await fixture.port.continue({ firstCourse: oneStop('A'), continuation: { broken: true }, requestId: 'invalid', signal: new AbortController().signal, onProgress() {} });
  assert.equal(direct.reason, 'continuation_unavailable'); assert.equal(direct.courses.length, 0);
  record({ id: 'TS-15', placeIds: state.firstCourse.placeIds, chosenOrder: state.firstCourse.placeIds, stopCount: 1, legCount: 2, exactSource: 'verified-snapshot', reason: direct.reason, adapterCalls: fixture.calls.length, ...fixture.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('TS-16 기존 one-stop·조건부 제외·카카오 장소 URL 입력·진행 snapshot을 침범하지 않는다', async () => {
  const result = await begin(['A', 'B', 'M'], {}, oneStop('A'));
  assert.ok(result.selection.courses.every((course) => course.placeIds.length === 2));
  assert.deepEqual(snapshot.courses.map((course) => course.placeIds.length), [1, 1, 1]);
  assert.equal(snapshot.scrollOffset, 720);
  record({ id: 'TS-16', placeIds: snapshot.courses.flatMap((c) => c.placeIds), chosenOrder: [], stopCount: 1, legCount: 2, exactSource: 'verified-snapshot', adapterCalls: result.calls.length, ...result.metrics(), connectorCalls: 0, staleIgnored: 0 });
});

test('QA-TWO-STOP-01 machine-readable receipt gate', () => {
  assert.deepEqual(receipts.map(({ id }) => id), Array.from({ length: 16 }, (_, index) => `TS-${String(index + 1).padStart(2, '0')}`));
  assert.ok(receipts.every(({ providerAttempts }) => providerAttempts <= 36));
  assert.ok(receipts.every(({ connectorCalls }) => connectorCalls <= 6));
  assert.equal(receipts.reduce((sum, item) => sum + item.staleIgnored, 0), 1);
  process.stdout.write(`# QA_TWO_STOP_RECEIPTS ${JSON.stringify(receipts)}\n`);
});
