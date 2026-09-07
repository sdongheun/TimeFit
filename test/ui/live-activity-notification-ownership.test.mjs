import assert from 'node:assert/strict';
import test from 'node:test';
import { screenRuntime } from './support/screenRuntime.mjs';

function fixture() {
  const values = new Map();
  const scheduled = [];
  let scheduleCalls = 0;
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
  const notifications = {
    SchedulableTriggerInputTypes: { DATE: 'date' },
    async getPermissionsAsync() { return { granted: true, status: 'granted' }; },
    async setNotificationCategoryAsync() {},
    async scheduleNotificationAsync(request) {
      scheduleCalls += 1;
      if (scheduleCalls === 2) throw new Error('injected second schedule failure');
      const id = `notification-${scheduleCalls}`;
      scheduled.push({ identifier: id, content: request.content });
      return id;
    },
    async getAllScheduledNotificationsAsync() { return scheduled; },
    async cancelScheduledNotificationAsync(id) { const index = scheduled.findIndex(item => item.identifier === id); if (index >= 0) scheduled.splice(index, 1); },
  };
  const runtime = screenRuntime({ '@react-native-async-storage/async-storage': storage, 'expo-notifications': notifications });
  return { ...runtime.load('src/ui/liveActivity/courseProgressNotifications.ts'), values, scheduled };
}

test('B-remediation failure-first: 예약 두 번째 실패에도 첫 소유 ID를 즉시 보존하고 exact cleanup이 회수한다', async () => {
  const f = fixture();
  const state = {
    schemaVersion: 1, courseRunId: 'run-notification', revision: 1, phase: 'traveling', finalArrivalAtMs: 9_000_000,
    arrivalBufferMin: 10, activeStopId: 'stop:0:A', processedEventIds: [], updatedAtMs: 1_000_000, terminalAtMs: null,
    stops: [{ stopId: 'stop:0:A', placeId: 'A', title: 'A', plannedStayMin: 20, arrivedAtMs: null, departedAtMs: null, snoozeUsed: false }],
    route: { targetKind: 'visit_stop', targetStopId: 'stop:0:A', targetTitle: 'A', moveMin: 10, routeOpenedAtMs: 1_000_000, arrivalPromptAtMs: 2_000_000, nextBoundaryAtMs: 8_000_000, departureReminderAtMs: 7_000_000 },
  };
  await assert.rejects(f.liveCourseNotificationPort.sync(state), /second schedule failure/);
  assert.deepEqual(await f.listOwnedLiveCourseNotificationIds('run-notification'), ['notification-1']);
  assert.match(f.values.get('@timefit/live-course-notifications-v2'), /notification-1/);
  await f.cancelLiveCourseNotificationExact('notification-1', 'run-notification');
  assert.deepEqual(await f.listOwnedLiveCourseNotificationIds('run-notification'), []);
});

test('B-remediation: native snooze pending request도 purpose/run 대조 후 exact 소유 대상으로 회수한다', async () => {
  const f = fixture();
  f.scheduled.push(
    { identifier: 'native-snooze-owned', content: { data: { purpose: 'course_progress', courseRunId: 'run-a' } } },
    { identifier: 'unrelated', content: { data: { purpose: 'other', courseRunId: 'run-a' } } },
    { identifier: 'other-run', content: { data: { purpose: 'course_progress', courseRunId: 'run-b' } } },
  );
  assert.deepEqual(await f.listOwnedLiveCourseNotificationIds('run-a'), ['native-snooze-owned']);
  await f.cancelLiveCourseNotificationExact('native-snooze-owned', 'run-a');
  assert.deepEqual(f.scheduled.map(item => item.identifier), ['unrelated', 'other-run']);
});
