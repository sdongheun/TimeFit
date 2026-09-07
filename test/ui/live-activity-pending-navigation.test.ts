import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActiveVerifiedCourse } from '../../src/ui/activeVerifiedCourseModel';
import {
  createPendingNavigationHandoffController,
  decodePendingNavigationAction,
  type PendingNavigationAction,
} from '../../src/ui/liveActivity/pendingNavigationHandoffModel';
import type { LocalProgressState } from '../../src/ui/liveActivity/localProgressModel';
import type { VerifiedCourseProgressStep } from '../../src/ui/recommendation/verifiedCourseProgressModel';
import { createPendingNavigationRouteGate, pendingNavigationRouteTarget } from '../../src/ui/liveActivity/pendingNavigationRouteModel';

const point = (id: string) => ({ id, label: id, lat: 35, lon: 129 });
const steps = (count: 1 | 2): readonly VerifiedCourseProgressStep[] => count === 1 ? [
  { kind: 'travel', key: 'to-a', from: point('origin'), target: point('A'), mode: 'walk', min: 10, isFinal: false },
  { kind: 'stay', key: 'at-a', target: point('A'), stayMin: 20, arrivalAt: '', departureAt: '' },
  { kind: 'travel', key: 'to-final', from: point('A'), target: point('final'), mode: 'transit', min: 20, isFinal: true },
] : [
  { kind: 'travel', key: 'to-a', from: point('origin'), target: point('A'), mode: 'walk', min: 10, isFinal: false },
  { kind: 'stay', key: 'at-a', target: point('A'), stayMin: 20, arrivalAt: '', departureAt: '' },
  { kind: 'travel', key: 'to-b', from: point('A'), target: point('B'), mode: 'walk', min: 12, isFinal: false },
  { kind: 'stay', key: 'at-b', target: point('B'), stayMin: 20, arrivalAt: '', departureAt: '' },
  { kind: 'travel', key: 'to-final', from: point('B'), target: point('final'), mode: 'transit', min: 20, isFinal: true },
];
const active = (count: 1 | 2): ActiveVerifiedCourse => ({
  identity: 'active', courseRunId: 'run-current', progress: { stepIndex: 1, routeOpened: false, finished: false },
  session: { nowIso: '2026-09-06T16:00:00+09:00', remainingMin: 90, arrivalBufferMin: 10, origin: point('origin'), destination: point('final') },
  course: { id: 'course', placeIds: count === 1 ? ['A'] : ['A', 'B'], stops: (count === 1 ? ['A'] : ['A', 'B']).map(placeId => ({ placeId, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '', departureAt: '' })), legs: [], travelMin: 0, stayMin: 20 * count, totalMin: 60, arrivalBufferMin: 10, remainingAfterCourseMin: 10, remainingAfterArrivalBufferMin: 0 },
} as ActiveVerifiedCourse);
const local = (count: 1 | 2, stopIndex = 0): LocalProgressState => ({
  schemaVersion: 1, courseRunId: 'run-current', revision: 3, phase: 'traveling', finalArrivalAtMs: 10_000, arrivalBufferMin: 10,
  activeStopId: `stop:${stopIndex}:${stopIndex ? 'B' : 'A'}`, route: null, terminalAtMs: null, updatedAtMs: 3_000,
  processedEventIds: ['action-1'],
  stops: (count === 1 ? ['A'] : ['A', 'B']).map((placeId, index) => ({ stopId: `stop:${index}:${placeId}`, placeId, title: placeId, plannedStayMin: 20, snoozeUsed: false, arrivedAtMs: 1_000, departedAtMs: index === stopIndex ? 2_000 : null })),
});
const action = (overrides: Partial<PendingNavigationAction> = {}): PendingNavigationAction => ({
  schemaVersion: 1, purpose: 'course_progress_navigation', actionId: 'action-1', courseRunId: 'run-current', stopId: 'stop:0:A', baseRevision: 2, state: 'pending', ...overrides,
});

function fixture(initial = action()) {
  let stored: PendingNavigationAction | null = initial;
  const calls: string[] = [];
  const controller = createPendingNavigationHandoffController({
    async transition(target, from, to) {
      calls.push(`transition:${from}:${to}`);
      if (!stored || stored.actionId !== target.actionId || stored.state !== from) return false;
      stored = { ...stored, state: to };
      return true;
    },
    async clear(target) { calls.push('clear'); if (stored?.actionId === target.actionId) stored = null; },
  });
  return { controller, calls, stored: () => stored };
}

test('ULA handoff failure-first: 최소 native 요청만 엄격 decode하고 변조·좌표·URL payload는 거절한다', () => {
  assert.deepEqual(decodePendingNavigationAction(action()), action());
  assert.equal(decodePendingNavigationAction({ ...action(), url: 'kakaomap://route' }), null);
  assert.equal(decodePendingNavigationAction({ ...action(), latitude: 35 }), null);
  assert.equal(decodePendingNavigationAction({ ...action(), courseRunId: '' }), null);
  assert.equal(decodePendingNavigationAction({ ...action(), state: 'made-up' }), null);
});

test('ULA handoff failure-first: foreground 전후·Home·다른 탭·cold pending을 중앙 CourseConfirm 경계가 연결한다', () => {
  const expected = { session: active(2).session, course: active(2).course, activeId: 'active' };
  assert.equal(pendingNavigationRouteTarget(null, action(), { name: 'Home' }), null);
  assert.deepEqual(pendingNavigationRouteTarget(active(2), action(), undefined), expected);
  assert.deepEqual(pendingNavigationRouteTarget(active(2), action(), { name: 'Home' }), expected);
  assert.deepEqual(pendingNavigationRouteTarget(active(2), action(), { name: 'Profile' }), expected);
  assert.equal(pendingNavigationRouteTarget(active(2), action(), { name: 'CourseConfirm', params: { activeId: 'active' } }), null);
  assert.equal(pendingNavigationRouteTarget(active(2), action({ state: 'success' }), { name: 'Home' }), null);
  assert.equal(pendingNavigationRouteTarget(active(2), action({ courseRunId: 'other-run' }), { name: 'Home' }), null);
  const gate = createPendingNavigationRouteGate();
  assert.deepEqual(gate.next(active(2), action(), { name: 'Profile' }), expected);
  assert.equal(gate.next(active(2), action(), { name: 'Profile' }), null, 'duplicate native/foreground callback must not push twice');
  assert.equal(gate.next(active(2), action({ state: 'success' }), { name: 'Profile' }), null);
  assert.deepEqual(gate.next(active(2), action({ actionId: 'action-2' }), { name: 'Profile' }), expected);
});

test('ULA handoff failure-first: 1곳/2곳 첫 stop/마지막 stop은 snapshot 순서의 정확한 다음 구간을 한 번만 연다', async () => {
  for (const [count, stopIndex, target] of [[1, 0, 'final'], [2, 0, 'B'], [2, 1, 'final']] as const) {
    const pending = action({ stopId: `stop:${stopIndex}:${stopIndex ? 'B' : 'A'}` });
    const f = fixture(pending); const opened: string[] = [];
    const input = { action: pending, active: active(count), local: local(count, stopIndex), steps: steps(count), open: async (travel: Extract<VerifiedCourseProgressStep, { kind: 'travel' }>) => { opened.push(travel.target.id); return true; }, onOpened: async () => undefined };
    assert.equal((await f.controller.consume(input, 'automatic')).status, 'opened');
    assert.deepEqual(opened, [target]);
    assert.equal((await f.controller.consume(input, 'automatic')).status, 'not_pending');
    assert.deepEqual(f.calls, ['transition:pending:executing', 'transition:executing:success', 'clear']);
  }
});

test('ULA handoff failure-first: 실패 재시도는 departed receipt를 바꾸지 않고 성공 전 routeOpened를 만들지 않는다', async () => {
  const f = fixture(); let opens = 0; let projected = 0;
  const input = { action: action(), active: active(2), local: local(2), steps: steps(2), open: async () => (++opens > 1), onOpened: async () => { projected += 1; } };
  assert.equal((await f.controller.consume(input, 'automatic')).status, 'failed');
  assert.equal(projected, 0);
  const failed = f.stored(); assert.equal(failed?.state, 'failure'); assert.equal(failed?.baseRevision, 2);
  assert.equal((await f.controller.consume({ ...input, action: failed! }, 'retry')).status, 'opened');
  assert.equal(opens, 2); assert.equal(projected, 1);
});

test('ULA handoff failure-first: 실행 중 종료는 unknown으로 취급해 foreground/cold 중복 자동 호출을 막고 명시 재시도만 허용한다', async () => {
  const executing = action({ state: 'executing' }); const f = fixture(executing); let opens = 0;
  const input = { action: executing, active: active(2), local: local(2), steps: steps(2), open: async () => { opens += 1; return false; }, onOpened: async () => undefined };
  assert.equal((await f.controller.consume(input, 'automatic')).status, 'success_unknown');
  assert.equal(opens, 0);
  assert.equal((await f.controller.consume(input, 'retry')).status, 'failed');
  assert.equal(opens, 1);
});

test('ULA handoff failure-first: 손상 snapshot·교체 run·완료·stale/변조 요청은 외부 호출 0으로 폐기한다', async () => {
  const cases = [
    { active: { ...active(2), courseRunId: 'replacement' }, local: local(2), steps: steps(2) },
    { active: active(2), local: { ...local(2), terminalAtMs: 4_000, phase: 'completed' as const }, steps: steps(2) },
    { active: active(2), local: { ...local(2), processedEventIds: [] }, steps: steps(2) },
    { active: active(2), local: local(2), steps: steps(2).slice(0, 2) },
  ];
  for (const value of cases) {
    const f = fixture(); let opens = 0;
    const result = await f.controller.consume({ action: action(), ...value, open: async () => { opens += 1; return true; }, onOpened: async () => undefined }, 'automatic');
    assert.equal(result.status, 'invalid'); assert.equal(opens, 0);
  }
});
