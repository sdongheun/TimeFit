import assert from 'node:assert/strict';
import test from 'node:test';
import {
  A3_FIXTURE_RUN_ID,
  createLiveActivityLifecycleController,
  type LiveActivityIdentity,
  type LiveActivityLifecycleNativePort,
} from '../../src/ui/liveActivity/lifecyclePolicy';

const fixture = (id = 'fixture-1'): LiveActivityIdentity => ({
  activityId: id, purpose: 'test_fixture', courseRunId: A3_FIXTURE_RUN_ID, schemaVersion: 1, revision: 1,
});
const course = (run = 'course-run-1', id = 'course-1', revision = 2): LiveActivityIdentity => ({
  activityId: id, purpose: 'course_progress', courseRunId: run, schemaVersion: 1, revision,
});
const unknown = (): LiveActivityIdentity => ({
  activityId: 'unknown-1', purpose: 'unknown', courseRunId: 'a3-1788600000000', schemaVersion: 1, revision: 1,
});
const coursePayload = (run = 'course-run-1', revision = 2) => ({
  purpose: 'course_progress' as const,
  schemaVersion: 1 as const,
  courseRunId: run,
  stopId: 'stop:1',
  revision,
  targetTitle: '부산시민공원',
  arrivalPromptAtMs: 1_788_600_900_000,
  nextBoundaryAtMs: 1_788_602_700_000,
  departureReminderAtMs: null,
});

function memoryPort(initial: LiveActivityIdentity[] = [], failEnd = new Set<string>(), rejectEnd = new Set<string>()) {
  let records = [...initial];
  const calls: unknown[][] = [];
  const port: LiveActivityLifecycleNativePort = {
    async listActivities() { calls.push(['list']); return records; },
    async startFixture(payload) {
      calls.push(['startFixture', payload]);
      const created = fixture(`fixture-${records.length + 1}`); records.push(created);
      return { status: 'started', activity: created, applicationState: 'active' };
    },
    async startCourseProgress(payload) {
      calls.push(['startCourseProgress', payload]);
      const created = course(payload.courseRunId, `course-${records.length + 1}`, payload.revision); records.push(created);
      return { status: 'started', activity: created, applicationState: 'active' };
    },
    async updateCourseProgress(payload) {
      calls.push(['updateCourseProgress', payload]);
      records = records.map(item => item.activityId === payload.activityId ? { ...item, revision: payload.revision } : item);
      return { status: 'updated', activity: records.find(item => item.activityId === payload.activityId)! };
    },
    async endActivityExact(identity) {
      calls.push(['endActivityExact', identity]);
      if (rejectEnd.has(identity.activityId)) throw new Error('native transport failed');
      if (failEnd.has(identity.activityId)) return { status: 'end_failed' };
      const before = records.length;
      records = records.filter(item => !(item.activityId === identity.activityId && item.courseRunId === identity.courseRunId && item.purpose === identity.purpose));
      return { status: before === records.length ? 'identity_mismatch' : 'ended' };
    },
  };
  return { port, calls, records: () => records, allowEnd: (id: string) => { failEnd.delete(id); rejectEnd.delete(id); } };
}

test('ULA-R failure-first: fixture가 있어도 실제 run을 시작하고 같은 실제 run만 재사용한다', async () => {
  const memory = memoryPort([fixture()]);
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  assert.equal((await lifecycle.startCourseProgress(coursePayload())).status, 'started');
  assert.equal((await lifecycle.startCourseProgress(coursePayload())).status, 'already_active');
  assert.equal(memory.calls.filter(call => call[0] === 'startCourseProgress').length, 1);
});

test('ULA-R failure-first: 다른 실제 run은 conflict이고 fixture 예약 ID/누락 payload는 invalid_input이다', async () => {
  const memory = memoryPort([course('course-run-existing')]);
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  assert.deepEqual(await lifecycle.startCourseProgress(coursePayload('course-run-new')), { status: 'conflict', conflictingRunId: 'course-run-existing' });
  assert.equal((await lifecycle.startCourseProgress(coursePayload(A3_FIXTURE_RUN_ID))).status, 'invalid_input');
  assert.equal((await lifecycle.startCourseProgress({ ...coursePayload(), stopId: '' })).status, 'invalid_input');
  assert.equal(memory.calls.filter(call => call[0] === 'startCourseProgress').length, 0);
});

test('ULA-R failure-first: old revision은 무시하고 exact same run/activity만 update/end한다', async () => {
  const memory = memoryPort([course('same-run', 'course-exact', 3), fixture('fixture-safe'), unknown()]);
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  assert.equal((await lifecycle.updateCourseProgress(coursePayload('same-run', 2))).status, 'ignored_old_revision');
  assert.equal((await lifecycle.updateCourseProgress(coursePayload('same-run', 4))).status, 'updated');
  assert.deepEqual(await lifecycle.endCourseProgress({ activityId: 'course-exact', purpose: 'course_progress', courseRunId: 'same-run', schemaVersion: 1, revision: 4 }), { status: 'ended' });
  assert.deepEqual(memory.records().map(item => item.activityId), ['fixture-safe', 'unknown-1']);
});

test('ULA-R failure-first: fixture cleanup은 분류된 exact fixture만 끝내고 actual/unknown을 보존한다', async () => {
  const legacy: LiveActivityIdentity = { activityId: 'fixture-legacy', purpose: 'test_fixture', courseRunId: 'a3-fixture-run', schemaVersion: 1, revision: 1 };
  const memory = memoryPort([fixture('fixture-a'), legacy, course(), unknown()]);
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  assert.deepEqual(await lifecycle.cleanupTestFixtures(), { status: 'ended', endedActivityIds: ['fixture-a', 'fixture-legacy'], failedActivityIds: [] });
  assert.deepEqual(memory.records().map(item => item.activityId), ['course-1', 'unknown-1']);
  assert.deepEqual(await lifecycle.cleanupTestFixtures(), { status: 'already_ended', endedActivityIds: [], failedActivityIds: [] });
});

test('ULA-R failure-first: native reject와 동시 cleanup도 부분 실패로 수렴하고 정확한 대상만 재시도한다', async () => {
  const memory = memoryPort([fixture('fixture-reject')], new Set(), new Set(['fixture-reject']));
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  const [first, second] = await Promise.all([lifecycle.cleanupTestFixtures(), lifecycle.cleanupTestFixtures()]);
  assert.equal(first.status, 'partial_failure');
  assert.equal(second.status, 'partial_failure');
  assert.deepEqual(memory.records().map(item => item.activityId), ['fixture-reject']);
  memory.allowEnd('fixture-reject');
  assert.equal((await lifecycle.cleanupTestFixtures()).status, 'ended');
});

test('ULA-R failure-first: 잘못된 actual identity 종료 요청은 fixture나 다른 run을 건드리지 않는다', async () => {
  const memory = memoryPort([course('run-a', 'course-a'), fixture('fixture-safe')]);
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  assert.equal((await lifecycle.endCourseProgress({ activityId: 'course-a', purpose: 'course_progress', courseRunId: 'run-b', schemaVersion: 1, revision: 2 })).status, 'not_found');
  assert.deepEqual(memory.records().map(item => item.activityId), ['course-a', 'fixture-safe']);
  assert.equal(memory.calls.filter(call => call[0] === 'endActivityExact').length, 0);
});

test('ULA-R failure-first: 부분 종료 실패는 대상만 남겨 재시도하고 cleanup 뒤 새 fixture를 만든다', async () => {
  const memory = memoryPort([fixture('fixture-a'), fixture('fixture-b')], new Set(['fixture-b']));
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  assert.deepEqual(await lifecycle.cleanupTestFixtures(), { status: 'partial_failure', endedActivityIds: ['fixture-a'], failedActivityIds: ['fixture-b'] });
  assert.equal((await lifecycle.startTestFixture()).status, 'cleanup_required');
  memory.allowEnd('fixture-b');
  assert.equal((await lifecycle.cleanupTestFixtures()).status, 'ended');
  assert.equal((await lifecycle.startTestFixture()).status, 'started');
});

test('ULA-R failure-first: 동시 start 두 번은 직렬화되어 native create가 한 번뿐이다', async () => {
  const memory = memoryPort();
  const lifecycle = createLiveActivityLifecycleController(memory.port);
  const [first, second] = await Promise.all([lifecycle.startCourseProgress(coursePayload()), lifecycle.startCourseProgress(coursePayload())]);
  assert.equal(first.status, 'started');
  assert.equal(second.status, 'already_active');
  assert.equal(memory.calls.filter(call => call[0] === 'startCourseProgress').length, 1);
});
