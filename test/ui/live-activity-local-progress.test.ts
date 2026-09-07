import assert from 'node:assert/strict';
import test from 'node:test';
import {
  arrivalGraceMin,
  buildLocalProgressState,
  createLocalProgressCoordinator,
  decodeLocalProgressState,
  departureReminder,
  openRouteThenStartLocalProgress,
  reduceLocalProgressEvent,
  snoozeArrivalPrompt,
  type LocalCourseSnapshot,
} from '../../src/ui/liveActivity/localProgressModel';

const minute = 60_000;
const clock = Date.parse('2026-09-06T01:00:00.000Z');

const oneStop: LocalCourseSnapshot = {
  courseRunId: 'course-run-one',
  finalArrivalAtMs: clock + 90 * minute,
  arrivalBufferMin: 10,
  stops: [{ stopId: 'stop:place-a', placeId: 'place-a', title: '부산시민공원', plannedStayMin: 20 }],
};

const twoStop: LocalCourseSnapshot = {
  courseRunId: 'course-run-two',
  finalArrivalAtMs: clock + 120 * minute,
  arrivalBufferMin: 10,
  stops: [
    { stopId: 'stop:place-a', placeId: 'place-a', title: '부산시민공원', plannedStayMin: 20 },
    { stopId: 'stop:place-b', placeId: 'place-b', title: '부산박물관', plannedStayMin: 25 },
  ],
};

test('A1 failure-first: 이동 10/30/60분 유예는 3/6/10분이고 epoch 계산은 자정을 재해석하지 않는다', () => {
  assert.deepEqual([10, 30, 60].map(arrivalGraceMin), [3, 6, 10]);
  const state = buildLocalProgressState(oneStop, {
    eventId: 'event-route-1', source: 'app_handoff', baseRevision: 0, occurredAtMs: clock, courseRunId: oneStop.courseRunId,
    type: 'handoff_succeeded', targetKind: 'visit_stop', targetStopId: 'stop:place-a', targetTitle: '부산시민공원', moveMin: 30,
  });
  assert.equal(state.phase, 'traveling');
  assert.equal(state.route?.arrivalPromptAtMs, clock + 36 * minute);
});

test('A1 failure-first: 출발 5분 전은 남은 이동·이후 체류·여유를 한 번만 빼고 과거면 즉시 1회다', () => {
  assert.deepEqual(departureReminder({ nowMs: clock, finalArrivalAtMs: clock + 120 * minute, arrivalBufferMin: 10, remainingMoveMin: 25, laterStayMin: 20 }), { kind: 'scheduled', atMs: clock + 60 * minute });
  assert.deepEqual(departureReminder({ nowMs: clock + 61 * minute, finalArrivalAtMs: clock + 120 * minute, arrivalBufferMin: 10, remainingMoveMin: 25, laterStayMin: 20 }), { kind: 'immediate', atMs: clock + 61 * minute });
});

test('A1 failure-first: stable stopId 이벤트만 적용하고 중복·오래된 revision·다른 run은 무시한다', () => {
  const initial = buildLocalProgressState(twoStop, {
    eventId: 'route-a', source: 'app_handoff', baseRevision: 0, occurredAtMs: clock, courseRunId: twoStop.courseRunId,
    type: 'handoff_succeeded', targetKind: 'visit_stop', targetStopId: 'stop:place-a', targetTitle: '부산시민공원', moveMin: 10,
  });
  const arrival = { eventId: 'arrival-a', source: 'live_activity_intent', baseRevision: 1, occurredAtMs: clock + 12 * minute, type: 'arrival_confirmed', courseRunId: twoStop.courseRunId, stopId: 'stop:place-a' } as const;
  const arrived = reduceLocalProgressEvent(initial, arrival);
  assert.equal(arrived.state.phase, 'dwelling');
  assert.equal(arrived.applied, true);
  assert.equal(reduceLocalProgressEvent(arrived.state, arrival).applied, false);
  assert.equal(reduceLocalProgressEvent(arrived.state, { ...arrival, eventId: 'stale', baseRevision: 1 }).applied, false);
  assert.equal(reduceLocalProgressEvent(arrived.state, { ...arrival, eventId: 'wrong-run', baseRevision: 2, courseRunId: 'other' }).applied, false);
  assert.equal(reduceLocalProgressEvent(arrived.state, { ...arrival, eventId: 'screen-index', baseRevision: 2, stopId: '0' }).applied, false);
});

test('A1 failure-first: snooze는 1회이며 다음 경계나 종료를 넘기지 않는다', () => {
  const prompt = clock + 20 * minute;
  assert.deepEqual(snoozeArrivalPrompt({ nowMs: prompt, currentPromptAtMs: prompt, nextBoundaryAtMs: prompt + 8 * minute, snoozeUsed: false }), { kind: 'scheduled', atMs: prompt + 5 * minute });
  assert.deepEqual(snoozeArrivalPrompt({ nowMs: prompt, currentPromptAtMs: prompt, nextBoundaryAtMs: prompt + 4 * minute, snoozeUsed: false }), { kind: 'unavailable' });
  assert.deepEqual(snoozeArrivalPrompt({ nowMs: prompt, currentPromptAtMs: prompt, nextBoundaryAtMs: prompt + 8 * minute, snoozeUsed: true }), { kind: 'unavailable' });

  const initial = buildLocalProgressState(oneStop, {
    eventId: 'route-for-snooze', source: 'app_handoff', baseRevision: 0, occurredAtMs: clock, courseRunId: oneStop.courseRunId,
    type: 'handoff_succeeded', targetKind: 'visit_stop', targetStopId: 'stop:place-a', targetTitle: '부산시민공원', moveMin: 10,
  });
  const snoozed = reduceLocalProgressEvent(initial, {
    eventId: 'snooze-a', source: 'live_activity_intent', baseRevision: 1, occurredAtMs: clock + 13 * minute,
    courseRunId: oneStop.courseRunId, type: 'arrival_snoozed', stopId: 'stop:place-a', nextBoundaryAtMs: clock + 30 * minute,
  });
  assert.equal(snoozed.applied, true);
  assert.equal(snoozed.state.route?.arrivalPromptAtMs, clock + 18 * minute);
  assert.equal(snoozed.state.stops[0]?.snoozeUsed, true);
  assert.equal(reduceLocalProgressEvent(snoozed.state, {
    eventId: 'snooze-b', source: 'live_activity_intent', baseRevision: 2, occurredAtMs: clock + 18 * minute,
    courseRunId: oneStop.courseRunId, type: 'arrival_snoozed', stopId: 'stop:place-a', nextBoundaryAtMs: clock + 30 * minute,
  }).applied, false);
});

test('A1 failure-first: v0는 v1로 migration하고 손상/미지원 값은 기존 데이터를 덮지 않는 fallback이다', () => {
  const migrated = decodeLocalProgressState(JSON.stringify({ schemaVersion: 0, runId: 'legacy-run', revision: 2, phase: 'traveling', stops: [] }));
  assert.equal(migrated.kind, 'migrated');
  if (migrated.kind === 'migrated') assert.deepEqual([migrated.state.schemaVersion, migrated.state.courseRunId, migrated.state.revision], [1, 'legacy-run', 2]);
  assert.deepEqual(decodeLocalProgressState('{bad'), { kind: 'corrupt' });
  assert.deepEqual(decodeLocalProgressState(JSON.stringify({ schemaVersion: 99 })), { kind: 'unsupported_version' });
});

test('A1 failure-first: handoff 실패는 저장/activity/알림 0이고 성공·중복은 직렬화된 한 writer만 사용한다', async () => {
  const calls: string[] = [];
  let raw: string | null = null;
  const coordinator = createLocalProgressCoordinator({
    storage: {
      async read() { calls.push('read'); return raw; },
      async write(next) { calls.push('write'); raw = next; },
      async clear() { calls.push('clear'); raw = null; },
    },
    activity: { async start() { calls.push('activity'); throw new Error('disabled'); }, async update() { calls.push('update'); }, async end() { calls.push('end'); } },
    notification: { async scheduleArrival() { calls.push('notification'); }, async cancelOwned() { calls.push('cancel'); } },
  });
  const event = { eventId: 'event-route-1', source: 'app_handoff', baseRevision: 0, occurredAtMs: clock, courseRunId: oneStop.courseRunId, type: 'handoff_succeeded', targetKind: 'visit_stop', targetStopId: 'stop:place-a', targetTitle: '부산시민공원', moveMin: 10 } as const;
  assert.deepEqual(await openRouteThenStartLocalProgress({ handoff: { async open() { calls.push('handoff-failed'); return false; } }, coordinator, snapshot: oneStop, event }), { status: 'handoff_failed' });
  assert.deepEqual(calls, ['handoff-failed']);
  calls.length = 0;
  const [first, duplicate] = await Promise.all([
    openRouteThenStartLocalProgress({ handoff: { async open() { calls.push('handoff-success'); return true; } }, coordinator, snapshot: oneStop, event }),
    coordinator.afterHandoff({ opened: true, snapshot: oneStop, event }),
  ]);
  assert.deepEqual([first.status, duplicate.status].sort(), ['duplicate', 'started_without_activity']);
  assert.deepEqual(calls, ['handoff-success', 'read', 'write', 'activity', 'notification', 'read']);
});
