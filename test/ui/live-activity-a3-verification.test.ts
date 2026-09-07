import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveActivityA3VerificationController } from '../../src/ui/liveActivity/a3VerificationModel';

const payload = {
  purpose: 'test_fixture',
  schemaVersion: 1,
  courseRunId: 'timefit-a3-fixture-v1',
  stopId: 'stop:a3-busan-citizens-park',
  targetTitle: '부산시민공원',
  revision: 1,
  arrivalPromptAtMs: 1_788_600_900_000,
  nextBoundaryAtMs: 1_788_602_700_000,
  departureReminderAtMs: null,
} as const;

test('A3 failure-first: 실제 handoff 성공 Promise 뒤에만 Activity를 시작한다', async () => {
  for (const routeResult of ['app_opened', 'web_opened', 'browser_fallback_opened'] as const) {
    const calls: string[] = [];
    const controller = createLiveActivityA3VerificationController({
      support: async () => { calls.push('support'); return { supported: true, enabled: true }; },
      openRoute: async () => { calls.push(`handoff:${routeResult}`); return routeResult; },
      startActivity: async (value) => { calls.push(`activity:${value.courseRunId}`); return { status: 'started', activityId: 'activity-a3', applicationState: 'inactive' }; },
    });
    assert.deepEqual(await controller.run(payload), { kind: 'started', activityId: 'activity-a3', applicationState: 'inactive', routeResult });
    assert.deepEqual(calls, ['support', `handoff:${routeResult}`, 'activity:timefit-a3-fixture-v1']);
  }
});

test('A3-R: 기존 exact fixture가 있으면 Kakao handoff 전에 cleanup을 요구한다', async () => {
  let handoffs = 0;
  const controller = createLiveActivityA3VerificationController({
    support: async () => ({ supported: true, enabled: true }),
    fixtureExists: async () => true,
    openRoute: async () => { handoffs++; return 'app_opened'; },
    startActivity: async () => ({ status: 'started', activityId: 'forbidden', applicationState: 'active' }),
  });
  assert.deepEqual(await controller.run(payload), { kind: 'cleanup_required' });
  assert.equal(handoffs, 0);
});

test('A3 failure-first: invalid/전체 handoff 실패와 disabled는 Activity 부수효과가 0이다', async () => {
  for (const routeResult of ['invalid_stage', 'failed'] as const) {
    let starts = 0;
    const controller = createLiveActivityA3VerificationController({
      support: async () => ({ supported: true, enabled: true }),
      openRoute: async () => routeResult,
      startActivity: async () => { starts++; return { status: 'started', activityId: 'forbidden', applicationState: 'active' }; },
    });
    assert.deepEqual(await controller.run(payload), { kind: 'handoff_failed', routeResult });
    assert.equal(starts, 0);
  }
  let handoffs = 0;
  const disabled = createLiveActivityA3VerificationController({
    support: async () => ({ supported: true, enabled: false }),
    openRoute: async () => { handoffs++; return 'app_opened'; },
    startActivity: async () => ({ status: 'started', activityId: 'forbidden', applicationState: 'active' }),
  });
  assert.deepEqual(await disabled.run(payload), { kind: 'activity_disabled' });
  assert.equal(handoffs, 0);
});

test('A3 failure-first: 중복 탭은 handoff를 한 번만 열고 시작 실패는 열린 길찾기를 취소하지 않는다', async () => {
  let release!: (value: 'app_opened') => void;
  const calls: string[] = [];
  const controller = createLiveActivityA3VerificationController({
    support: async () => ({ supported: true, enabled: true }),
    openRoute: () => new Promise((resolve) => { calls.push('handoff'); release = resolve; }),
    startActivity: async () => { calls.push('activity'); throw new Error('fixture native start failure'); },
  });
  const first = controller.run(payload);
  assert.deepEqual(await controller.run(payload), { kind: 'busy' });
  await Promise.resolve(); await Promise.resolve();
  release('app_opened');
  assert.deepEqual(await first, { kind: 'opened_without_activity', routeResult: 'app_opened' });
  assert.deepEqual(calls, ['handoff', 'activity']);
});
