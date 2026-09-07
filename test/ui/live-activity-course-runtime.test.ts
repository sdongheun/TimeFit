import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLiveCoursePlan,
  createLiveCourseProgressController,
  projectVerifiedProgressFromLocal,
  type LiveCoursePlan,
  type LiveCourseProgressDependencies,
} from '../../src/ui/liveActivity/courseProgressRuntimeModel';
import type { ActiveVerifiedCourse } from '../../src/ui/activeVerifiedCourseModel';
import type { VerifiedCourseProgressStep } from '../../src/ui/recommendation/verifiedCourseProgressModel';

const minute = 60_000;
const now = Date.parse('2026-09-06T01:00:00.000Z');
const session = {
  nowIso: new Date(now).toISOString(), remainingMin: 120, arrivalBufferMin: 10,
  origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.1 }, destination: { id: 'destination', label: '도착', lat: 35.2, lon: 129.2 },
};
function active(ids = ['A', 'B']): ActiveVerifiedCourse {
  const legs = Array.from({ length: ids.length + 1 }, (_, index) => ({ fromId: index ? ids[index - 1] : 'origin', toId: ids[index] ?? 'destination', mode: 'walk' as const, min: [10, 15, 20][index] }));
  return {
    identity: 'active-1', courseRunId: `course-run-${ids.join('-')}`, session,
    progress: { stepIndex: 0, routeOpened: false, finished: false },
    course: {
      id: ids.join('-'), placeIds: ids, legs,
      stops: ids.map((placeId, index) => ({ placeId, stayMin: 20 + index * 5, stayState: 'recommended' as const, availabilityState: 'structured_verified' as const, arrivalAt: new Date(now + (20 + index * 40) * minute).toISOString(), departureAt: new Date(now + (40 + index * 40) * minute).toISOString() })),
      travelMin: legs.reduce((sum, leg) => sum + leg.min, 0), stayMin: ids.length * 20 + (ids.length - 1) * 5,
      totalMin: 100, arrivalBufferMin: 10, remainingAfterCourseMin: 20, remainingAfterArrivalBufferMin: 10,
    },
  } as ActiveVerifiedCourse;
}
function steps(ids = ['A', 'B']): readonly VerifiedCourseProgressStep[] {
  const points = new Map([
    ['origin', session.origin], ['destination', session.destination],
    ['A', { id: 'A', label: '장소 A', lat: 35.11, lon: 129.11 }], ['B', { id: 'B', label: '장소 B', lat: 35.12, lon: 129.12 }],
  ]);
  const result: VerifiedCourseProgressStep[] = [];
  ids.forEach((id, index) => {
    result.push({ kind: 'travel', key: `t${index}`, from: points.get(index ? ids[index - 1] : 'origin')!, target: points.get(id)!, mode: 'walk', min: [10, 15][index], isFinal: false });
    result.push({ kind: 'stay', key: `s${index}`, target: points.get(id)!, stayMin: 20 + index * 5, arrivalAt: '', departureAt: '' });
  });
  result.push({ kind: 'travel', key: 'tf', from: points.get(ids.at(-1)!)!, target: points.get('destination')!, mode: 'walk', min: 20, isFinal: true });
  return result;
}

function memoryDependencies() {
  let raw: string | null = null;
  let receipts: Array<{ receiptId: string; raw: string }> = [];
  const calls: unknown[][] = [];
  const dependencies: LiveCourseProgressDependencies = {
    storage: {
      async read() { calls.push(['read']); return raw; }, async write(value) { calls.push(['write']); raw = value; }, async clear() { calls.push(['clear']); raw = null; },
      async listReceipts() { return receipts; }, async acknowledgeReceipt(id) { calls.push(['ack', id]); receipts = receipts.filter(item => item.receiptId !== id); },
    },
    activity: {
      async start(state) { calls.push(['activity-start', state.courseRunId, state.revision]); }, async update(state) { calls.push(['activity-update', state.courseRunId, state.revision]); }, async end(state) { calls.push(['activity-end', state.courseRunId, state.revision]); },
    },
    notification: { async sync(state) { calls.push(['notification-sync', state.revision]); }, async cancelOwned(run) { calls.push(['notification-cancel', run]); } },
  };
  return { dependencies, calls, raw: () => raw, setRaw(value: string | null) { raw = value; }, addReceipt(value: unknown) { receipts.push({ receiptId: `r${receipts.length + 1}`, raw: JSON.stringify(value) }); } };
}

test('B confirmed app arrival emits the stable identity once; late native receipt restores progress without retroactive eligibility', async () => {
  for (const native of [false, true]) {
    const memory = memoryDependencies(), captured: unknown[] = [];
    const controller = createLiveCourseProgressController({ ...memory.dependencies, onConfirmedArrival: input => { captured.push(input); } });
    const built = buildLiveCoursePlan(active(['A']), steps(['A']));
    if (built.status !== 'ready') throw Error('invalid fixture');
    const courseRunId = built.plan.snapshot.courseRunId, stopId = built.plan.snapshot.stops[0].stopId;
    await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open' });
    if (native) {
      memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', type: 'arrival_confirmed', courseRunId, stopId, eventId: 'native-arrival', source: 'live_activity_intent', baseRevision: 1, occurredAtMs: now + minute });
      await controller.reconcile(courseRunId);
    } else {
      await controller.confirmArrival({ courseRunId, stopId, eventId: 'app-arrival', source: 'app_action', occurredAtMs: now + minute });
      await controller.confirmArrival({ courseRunId, stopId, eventId: 'app-arrival', source: 'app_action', occurredAtMs: now + minute });
    }
    assert.equal((await controller.readState())?.phase, 'dwelling');
    assert.deepEqual(captured, native ? [] : [{ courseRunId, stopOrdinal: 1, confirmationEventId: 'app-arrival' }]);
  }
});

test('learning first arrival proof is durable; consume unavailable cannot block progress or ack the receipt', async () => {
  const memory = memoryDependencies(), consumed: any[] = [];
  const built = buildLiveCoursePlan(active(['A']), steps(['A']));
  if (built.status !== 'ready') throw Error('fixture');
  const controller = createLiveCourseProgressController({ ...memory.dependencies,
    learning: { capture: () => undefined, consume: async (value: any) => { consumed.push(value); return { status: 'unavailable' }; } } } as any);
  const courseRunId = built.plan.courseRunId;
  await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open' });
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', type: 'arrival_confirmed', source: 'live_activity_intent', courseRunId,
    stopId: 'stop:0:A', eventId: 'first', baseRevision: 1, occurredAtMs: now + minute });
  await controller.reconcile(courseRunId);
  for (let n = 0; n < 30; n++) await Promise.resolve();
  assert.equal(consumed[0]?.application.firstArrivalEventId, 'first');
  assert.equal(JSON.parse(memory.raw()!).stops[0].firstArrival.eventId, 'first');
  assert.equal(memory.calls.filter(c => c[0] === 'ack').length, 0);
});

test('release A: foreground preparation is not success; new/existing failure and cold restore preserve progress', async () => {
  for (const existing of [false, true]) {
    const memory = memoryDependencies();
    const controller = createLiveCourseProgressController(memory.dependencies);
    const built = buildLiveCoursePlan(active(['A']), steps(['A']));
    assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
    if (existing) await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'old-open' });
    const before = await controller.readState();
    memory.calls.length = 0;
    const input = { plan: built.plan, travelStepIndex: 0, occurredAtMs: now + minute, eventId: 'attempt' };
    await controller.prepareHandoff(input);
    await controller.prepareHandoff(input);
    const prepared = await createLiveCourseProgressController(memory.dependencies).readState();
    assert.ok(prepared);
    assert.deepEqual(prepared.route, before?.route ?? null);
    assert.equal(prepared.processedEventIds.includes('attempt'), false);
    assert.equal(memory.calls.filter(call => call[0] === 'notification-sync').length, 0);
    assert.equal(memory.calls.filter(call => call[0] === 'activity-start').length, existing ? 0 : 1);
    if (!existing) assert.equal(projectVerifiedProgressFromLocal(prepared).routeOpened, false);
    await controller.settleHandoff({ ...input, opened: false });
    const failed = await controller.readState();
    if (existing) assert.deepEqual(failed, before);
    else {
      assert.equal(failed?.handoffPreparation?.status, 'failed');
      assert.equal(failed?.route, null);
      assert.deepEqual(failed?.processedEventIds, []);
      assert.equal(projectVerifiedProgressFromLocal(failed!).routeOpened, false);
    }
  }
});

test('release A: success alone commits timing; stale callbacks and receipt races cannot erase confirmations', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const built = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  const input = { plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'first' };
  await controller.prepareHandoff(input);
  await controller.prepareHandoff({ ...input, eventId: 'retry' });
  await controller.settleHandoff({ ...input, opened: false });
  assert.equal((await controller.readState())?.handoffPreparation?.attemptId, 'retry');
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', eventId: 'arrival-race', baseRevision: 1, source: 'live_activity_intent', type: 'arrival_confirmed', occurredAtMs: now + minute });
  await controller.settleHandoff({ ...input, eventId: 'retry', opened: false });
  const arrived = await controller.readState();
  assert.equal(arrived?.phase, 'dwelling');
  assert.equal(arrived?.stops[0].arrivedAtMs, now + minute);
  await controller.applyEvent({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', eventId: 'depart', baseRevision: arrived!.revision, source: 'live_activity_intent', type: 'departure_confirmed', occurredAtMs: now + 2 * minute });
  const next = { ...input, travelStepIndex: 2, eventId: 'next' };
  await controller.prepareHandoff(next);
  await controller.settleHandoff({ ...next, opened: false });
  assert.equal((await controller.readState())?.stops[0].departedAtMs, now + 2 * minute);
  await controller.prepareHandoff({ ...next, eventId: 'next-retry' });
  await controller.settleHandoff({ ...next, eventId: 'next-retry', occurredAtMs: now + 3 * minute, opened: true });
  const done = await controller.readState();
  assert.equal(done?.route?.routeOpenedAtMs, now + 3 * minute);
  assert.equal(done?.stops[0].departedAtMs, now + 2 * minute);
});

test('release A: Activity denial, late receipt after rollback, and failed retry remain safe across controller recreation', async () => {
  const memory = memoryDependencies();
  const built = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  const controller = createLiveCourseProgressController({ ...memory.dependencies, activity: { ...memory.dependencies.activity, async start() { throw Error('denied'); } } });
  const input = { plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'denied' };
  assert.equal((await controller.prepareHandoff(input)).status, 'prepared_without_activity');
  assert.equal((await controller.settleHandoff({ ...input, opened: false })).status, 'preparation_retained');
  assert.equal((await controller.settleHandoff({ ...input, opened: true })).status, 'stale');
  const cold = createLiveCourseProgressController(memory.dependencies);
  // The Intent had entered before Activity end, but durable write completed afterwards.
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', eventId: 'late-arrival', baseRevision: 1, source: 'live_activity_intent', type: 'arrival_confirmed', occurredAtMs: now + minute });
  const restored = await cold.reconcile(built.plan.courseRunId);
  assert.equal(restored.status, 'ready'); if (restored.status !== 'ready') return;
  assert.equal(restored.state.stops[0].arrivedAtMs, now + minute);
  const next = { ...input, travelStepIndex: 2, eventId: 'app-next' };
  await cold.prepareHandoff(next);
  await cold.settleHandoff({ ...next, opened: false });
  assert.equal((await cold.readState())?.stops[0].departedAtMs, null);
  await cold.prepareHandoff({ ...next, eventId: 'app-next-retry' });
  await cold.settleHandoff({ ...next, eventId: 'app-next-retry', occurredAtMs: now + 2 * minute, opened: true });
  assert.equal((await cold.readState())?.stops[0].departedAtMs, now + 2 * minute);
});

test('release A: late incoming success preserves arrival and restores its planned reminder, not a departure', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const built = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  const input = { plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'incoming' };
  await controller.prepareHandoff(input);
  await controller.confirmArrival({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', occurredAtMs: now + minute, eventId: 'arrival', source: 'app_action' });
  await controller.settleHandoff({ ...input, opened: true, occurredAtMs: now + 2 * minute });
  const state = await controller.readState();
  assert.equal(state?.phase, 'dwelling');
  assert.equal(state?.stops[0].arrivedAtMs, now + minute);
  assert.equal(state?.stops[0].departedAtMs, null);
  assert.equal(state?.route?.departureReminderAtMs, built.plan.routes[0].departureReminderAtMs);
});

test('B failure-first: 실제 1/2곳 snapshot은 stable stop과 검증 leg로 도착·출발 시각을 계산한다', () => {
  const one = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(one.status, 'ready');
  const two = buildLiveCoursePlan(active(), steps());
  assert.equal(two.status, 'ready');
  if (two.status !== 'ready') return;
  assert.deepEqual(two.snapshot.stops.map(stop => stop.stopId), ['stop:0:A', 'stop:1:B']);
  assert.equal(two.routes[0].arrivalPromptAtMs, now + 13 * minute);
  assert.equal(two.routes[0].departureReminderAtMs, now + 45 * minute);
  assert.equal(two.routes[1].departureReminderAtMs, now + 85 * minute);
  assert.equal(two.routes[2].targetKind, 'final_destination');
});

test('B failure-first: 첫 handoff만 start, 다음 handoff는 명시 departure와 update이며 실패는 부수효과 0이다', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const plan = buildLiveCoursePlan(active(), steps());
  assert.equal(plan.status, 'ready'); if (plan.status !== 'ready') return;
  assert.equal((await controller.afterHandoff({ opened: false, plan: plan.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open-fail' })).status, 'handoff_failed');
  assert.deepEqual(memory.calls, []);
  assert.equal((await controller.afterHandoff({ opened: true, plan: plan.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open-a' })).status, 'started');
  assert.equal((await controller.confirmArrival({ courseRunId: plan.plan.courseRunId, stopId: 'stop:0:A', occurredAtMs: now + 12 * minute, eventId: 'arrive-a', source: 'app_action' })).status, 'updated');
  assert.equal((await controller.afterHandoff({ opened: true, plan: plan.plan, travelStepIndex: 2, occurredAtMs: now + 30 * minute, eventId: 'open-b' })).status, 'updated');
  const state = JSON.parse(memory.raw()!);
  assert.equal(state.stops[0].departedAtMs, now + 30 * minute);
  assert.deepEqual(memory.calls.filter(call => String(call[0]).startsWith('activity')).map(call => call[0]), ['activity-start', 'activity-update', 'activity-update']);
});

test('B failure-first: Intent receipt는 revision 순서로 한 번 적용·ack되고 앱 진행으로 복구된다', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const plan = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(plan.status, 'ready'); if (plan.status !== 'ready') return;
  await controller.afterHandoff({ opened: true, plan: plan.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open-a' });
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', courseRunId: plan.plan.courseRunId, stopId: 'stop:0:A', eventId: 'intent-arrive', baseRevision: 1, source: 'live_activity_intent', type: 'arrival_confirmed', occurredAtMs: now + 12 * minute, nextBoundaryAtMs: null });
  const restored = await controller.reconcile(plan.plan.courseRunId);
  assert.equal(restored.status, 'ready');
  if (restored.status === 'ready') assert.deepEqual(projectVerifiedProgressFromLocal(restored.state, plan.plan), { stepIndex: 1, routeOpened: false, finished: false });
  assert.deepEqual(memory.calls.filter(call => call[0] === 'ack'), [['ack', 'r1']]);
});

test('ULA lock arrival: 17:04 예정이어도 16:48 첫 native receipt를 cold reconcile해 즉시 dwelling·최초 시각으로 고정한다', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const plan = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(plan.status, 'ready'); if (plan.status !== 'ready') return;
  await controller.afterHandoff({ opened: true, plan: plan.plan, travelStepIndex: 0, occurredAtMs: Date.parse('2026-09-06T16:30:00+09:00'), eventId: 'open-early' });
  const arrivedAt = Date.parse('2026-09-06T16:48:00+09:00');
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', courseRunId: plan.plan.courseRunId, stopId: 'stop:0:A', eventId: 'native-arrive-early', baseRevision: 1, source: 'live_activity_intent', type: 'arrival_confirmed', occurredAtMs: arrivedAt });
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', courseRunId: plan.plan.courseRunId, stopId: 'stop:0:A', eventId: 'late-duplicate', baseRevision: 1, source: 'live_activity_intent', type: 'arrival_confirmed', occurredAtMs: Date.parse('2026-09-06T17:04:00+09:00') });
  const restored = await controller.reconcile(plan.plan.courseRunId);
  assert.equal(restored.status, 'ready'); if (restored.status !== 'ready') return;
  assert.equal(restored.state.phase, 'dwelling');
  assert.equal(restored.state.stops[0].arrivedAtMs, arrivedAt);
  assert.equal(restored.state.revision, 2);
  assert.deepEqual(memory.calls.filter(call => call[0] === 'ack'), [['ack', 'r1'], ['ack', 'r2']]);
});

test('B failure-first: 명시 완료는 실제 확인된 체류만 반환하고 exact Activity·알림·상태를 정리한다', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const plan = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(plan.status, 'ready'); if (plan.status !== 'ready') return;
  await controller.afterHandoff({ opened: true, plan: plan.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open-a' });
  await controller.confirmArrival({ courseRunId: plan.plan.courseRunId, stopId: 'stop:0:A', occurredAtMs: now + 13 * minute, eventId: 'arrive-a', source: 'app_action' });
  await controller.afterHandoff({ opened: true, plan: plan.plan, travelStepIndex: 2, occurredAtMs: now + 33 * minute, eventId: 'open-final' });
  const ended = await controller.finish({ courseRunId: plan.plan.courseRunId, terminal: 'completed', occurredAtMs: now + 55 * minute, eventId: 'finish' });
  assert.deepEqual(ended, { status: 'ended', actualDwellByPlaceId: { A: 20 } });
  assert.equal(memory.raw(), null);
  assert.deepEqual(memory.calls.slice(-3).map(call => call[0]), ['activity-end', 'notification-cancel', 'clear']);
});

test('B failure-first: 손상된 App Group 상태는 새 run으로 덮어쓰거나 Activity·알림을 만들지 않는다', async () => {
  const memory = memoryDependencies();
  memory.setRaw('{broken');
  const controller = createLiveCourseProgressController(memory.dependencies);
  const built = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  assert.equal((await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open' })).status, 'storage_unreadable');
  assert.equal(memory.raw(), '{broken');
  assert.deepEqual(memory.calls, [['read']]);
});

test('B failure-first: Live/알림의 명시 출발만으로 다음 길찾기를 열었다고 표시하지 않는다', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const built = buildLiveCoursePlan(active(), steps());
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open' });
  await controller.confirmArrival({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', occurredAtMs: now + 12 * minute, eventId: 'arrive', source: 'app_action' });
  const state = await controller.applyEvent({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', baseRevision: 2, occurredAtMs: now + 20 * minute, eventId: 'depart', source: 'live_activity_intent', type: 'departure_confirmed' });
  assert.equal(state.status, 'updated');
  if (state.status === 'updated') assert.deepEqual(projectVerifiedProgressFromLocal(state.state), { stepIndex: 1, routeOpened: false, finished: false });
});

test('B-remediation failure-first: 실제 체류는 초 단위 경계를 내림하고 누락·역순·비정상 값은 합성하지 않는다', async () => {
  const boundaries = [[0, 0], [59, 0], [60, 1], [100, 1], [119, 1], [120, 2]] as const;
  for (const [seconds, expected] of boundaries) {
    const memory = memoryDependencies();
    const controller = createLiveCourseProgressController(memory.dependencies);
    const built = buildLiveCoursePlan(active(['A']), steps(['A']));
    assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
    await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: `open-${seconds}` });
    await controller.confirmArrival({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', occurredAtMs: now + minute, eventId: `arrive-${seconds}`, source: 'app_action' });
    await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 2, occurredAtMs: now + minute + seconds * 1000, eventId: `depart-${seconds}` });
    assert.deepEqual(await controller.readActualDwell(built.plan.courseRunId), { A: expected });
  }

  for (const [arrivedAtMs, departedAtMs] of [[null, now], [now, null], [now + 1, now], [Number.NaN, now]]) {
    const memory = memoryDependencies();
    const built = buildLiveCoursePlan(active(['A']), steps(['A']));
    assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
    const state = buildLocalProgressStateForInvalidDwell(built.plan, arrivedAtMs, departedAtMs);
    memory.setRaw(JSON.stringify(state));
    assert.deepEqual(await createLiveCourseProgressController(memory.dependencies).readActualDwell(built.plan.courseRunId), {});
  }
});

test('B-remediation failure-first: native snooze 뒤 다른 채널 재시도는 거절하고 다음 stop은 별도 1회를 허용한다', async () => {
  const memory = memoryDependencies();
  const controller = createLiveCourseProgressController(memory.dependencies);
  const built = buildLiveCoursePlan(active(), steps());
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open-a' });
  memory.addReceipt({ schemaVersion: 1, purpose: 'course_progress', courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', eventId: 'native-snooze-a', baseRevision: 1, source: 'live_activity_intent', type: 'arrival_snoozed', occurredAtMs: now + minute, nextBoundaryAtMs: built.plan.routes[0].nextBoundaryAtMs });
  const first = await controller.reconcile(built.plan.courseRunId);
  assert.equal(first.status, 'ready'); if (first.status !== 'ready') return;
  assert.equal(first.state.revision, 2);
  assert.equal(first.state.stops[0].snoozeUsed, true);
  const repeated = await controller.applyEvent({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', eventId: 'notification-snooze-a-again', baseRevision: 2, source: 'notification_action', type: 'arrival_snoozed', occurredAtMs: now + 2 * minute, nextBoundaryAtMs: built.plan.routes[0].nextBoundaryAtMs });
  assert.equal(repeated.status, 'stale');
  const arrived = await controller.applyEvent({ courseRunId: built.plan.courseRunId, stopId: 'stop:0:A', eventId: 'notification-arrive-a', baseRevision: 2, source: 'notification_action', type: 'arrival_confirmed', occurredAtMs: now + 3 * minute });
  assert.equal(arrived.status, 'updated');
  await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 2, occurredAtMs: now + 20 * minute, eventId: 'open-b' });
  const beforeSecond = await controller.readState();
  assert.ok(beforeSecond);
  if (!beforeSecond) return;
  const second = await controller.applyEvent({ courseRunId: built.plan.courseRunId, stopId: 'stop:1:B', eventId: 'snooze-b', baseRevision: beforeSecond.revision, source: 'notification_action', type: 'arrival_snoozed', occurredAtMs: now + 21 * minute, nextBoundaryAtMs: built.plan.routes[1].nextBoundaryAtMs });
  assert.equal(second.status, 'updated');
  if (second.status === 'updated') assert.equal(second.state.stops[1].snoozeUsed, true);
});

test('B-remediation: terminal 대상 저장 뒤 cleanup port를 실행하고 활성 state가 없어도 같은 run 정리를 재개한다', async () => {
  const memory = memoryDependencies();
  const cleanupCalls: string[] = [];
  const controller = createLiveCourseProgressController({
    ...memory.dependencies,
    cleanup: {
      async prepare(run) { cleanupCalls.push(`prepare:${run}`); return { status: 'prepared' }; },
      async retry(run) { cleanupCalls.push(`retry:${run}`); return { status: 'clean' }; },
    },
  });
  const built = buildLiveCoursePlan(active(['A']), steps(['A']));
  assert.equal(built.status, 'ready'); if (built.status !== 'ready') return;
  await controller.afterHandoff({ opened: true, plan: built.plan, travelStepIndex: 0, occurredAtMs: now, eventId: 'open-cleanup' });
  assert.equal((await controller.finish({ courseRunId: built.plan.courseRunId, terminal: 'cancelled', occurredAtMs: now + minute, eventId: 'cancel-cleanup' })).status, 'ended');
  assert.deepEqual(cleanupCalls, [`prepare:${built.plan.courseRunId}`, `retry:${built.plan.courseRunId}`]);
  assert.equal(memory.calls.some(call => call[0] === 'activity-end' || call[0] === 'notification-cancel'), false);

  cleanupCalls.length = 0;
  assert.equal((await controller.finish({ courseRunId: built.plan.courseRunId, terminal: 'incomplete', occurredAtMs: now + 2 * minute, eventId: 'resume-cleanup' })).status, 'already_ended');
  assert.deepEqual(cleanupCalls, [`prepare:${built.plan.courseRunId}`, `retry:${built.plan.courseRunId}`]);
});

function buildLocalProgressStateForInvalidDwell(plan: LiveCoursePlan, arrivedAtMs: number | null, departedAtMs: number | null) {
  return {
    schemaVersion: 1, courseRunId: plan.courseRunId, revision: 3, phase: 'traveling', finalArrivalAtMs: plan.snapshot.finalArrivalAtMs,
    arrivalBufferMin: plan.snapshot.arrivalBufferMin, activeStopId: null, route: null,
    stops: plan.snapshot.stops.map(stop => ({ ...stop, snoozeUsed: false, arrivedAtMs, departedAtMs })),
    processedEventIds: [], updatedAtMs: now, terminalAtMs: null,
  };
}
