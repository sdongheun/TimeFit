import assert from 'node:assert/strict';
import test from 'node:test';
import { createTerminalCleanupController } from '../../src/ui/liveActivity/terminalCleanupModel';

test('B-remediation failure-first: exact 종료 대상을 먼저 저장하고 일부 실패 뒤 실패 대상만 재시도한다', async () => {
  let raw: string | null = null;
  let activityFailures = 1;
  const notificationFailures = new Map([['notification-b', 1]]);
  const calls: string[] = [];
  const controller = createTerminalCleanupController({
    storage: { async read() { return raw; }, async write(value) { calls.push('persist'); raw = value; } },
    activity: {
      async resolve(run) { return { activityId: `activity-${run}`, courseRunId: run, purpose: 'course_progress' as const, schemaVersion: 1, revision: 7 }; },
      async endExact(target) { calls.push(`activity:${target.activityId}`); if (activityFailures-- > 0) throw new Error('injected'); },
    },
    notification: {
      async listOwned() { return ['notification-a', 'notification-b']; },
      async cancelExact(id) { calls.push(`notification:${id}`); const remaining = notificationFailures.get(id) ?? 0; if (remaining > 0) { notificationFailures.set(id, remaining - 1); throw new Error('injected'); } },
    },
  });

  assert.equal((await controller.prepare('run-a')).status, 'prepared');
  assert.equal(calls[0], 'persist');
  const first = await controller.retryAll();
  assert.equal(first.status, 'pending');
  assert.match(raw!, /activity-run-a/);
  assert.doesNotMatch(raw!, /notification-a/);
  assert.match(raw!, /notification-b/);
  calls.length = 0;
  const second = await controller.retryAll();
  assert.equal(second.status, 'clean');
  assert.deepEqual(calls.filter(value => value.startsWith('notification:')), ['notification:notification-b']);
  assert.equal(calls.some(value => value === 'notification:notification-a'), false);
  assert.equal(raw, JSON.stringify({ schemaVersion: 1, jobs: [] }));
});

test('B-remediation failure-first: 이전 run 보류 중 새 run을 덮지 않고 cold start 중복 retry가 멱등이다', async () => {
  let raw: string | null = null;
  const ended: string[] = [];
  const dependencies = {
    storage: { async read() { return raw; }, async write(value: string) { raw = value; } },
    activity: { async resolve(run: string) { return { activityId: `activity-${run}`, courseRunId: run, purpose: 'course_progress' as const, schemaVersion: 1, revision: 2 }; }, async endExact(target: { activityId: string }) { ended.push(target.activityId); } },
    notification: { async listOwned(run: string) { return [`notification-${run}`]; }, async cancelExact() {} },
  };
  const firstProcess = createTerminalCleanupController(dependencies);
  await firstProcess.prepare('old-run');
  await firstProcess.prepare('new-run');
  const restartedProcess = createTerminalCleanupController(dependencies);
  assert.equal((await restartedProcess.retryAll()).status, 'clean');
  assert.deepEqual(ended.sort(), ['activity-new-run', 'activity-old-run']);
  assert.equal((await restartedProcess.retryAll()).status, 'clean');
  assert.deepEqual(ended.sort(), ['activity-new-run', 'activity-old-run']);
});

test('B-remediation failure-first: 손상된 종료 queue는 무차별 삭제하거나 효과를 실행하지 않는다', async () => {
  let raw: string | null = '{broken';
  let effects = 0;
  const controller = createTerminalCleanupController({
    storage: { async read() { return raw; }, async write(value) { raw = value; } },
    activity: { async resolve() { effects += 1; return null; }, async endExact() { effects += 1; } },
    notification: { async listOwned() { effects += 1; return []; }, async cancelExact() { effects += 1; } },
  });
  assert.equal((await controller.retryAll()).status, 'storage_unreadable');
  assert.equal(raw, '{broken');
  assert.equal(effects, 0);
});
