import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnedCourseLifecycle } from '../../src/ui/ownedCourseLifecycle';
import { ownedCourseFixture } from './fixtures/ownedCoursePorts';
import { deriveDwellPersonalizationV1 } from '../../src/engine/dwellPersonalization';
import { personalizedCoursePlaceIds } from '../../src/ui/personalizedCourseLabel';
import { mergeOwnedRecords } from '../../src/ui/ownedRecordsModel';

test('labels require exact changed engine snapshot; local and remote share completion identity', () => {
  const stop = { placeId: 'A', stayMin: 40, dwellPersonalization: { targetStayMin: 40, baselineStayMin: 30 } };
  assert.deepEqual(personalizedCoursePlaceIds({ stops: [stop] } as any), ['A']);
  assert.deepEqual(personalizedCoursePlaceIds({ stops: [{ ...stop, stayMin: 20 }] } as any), []);
  assert.deepEqual(personalizedCoursePlaceIds({ stops: [{ ...stop, dwellPersonalization: undefined }] } as any), []);
  const local = { completionId: 'c', courseRunId: 'run', completedAt: 60000, places: [] };
  const remote = { completionId: 'c', courseRunId: 'run', completedAtMinute: 1, places: [] };
  assert.equal(mergeOwnedRecords([local] as any, [remote] as any).length, 1);
  assert.equal(mergeOwnedRecords([local] as any, [remote] as any)[0].pending, false);
  assert.equal(mergeOwnedRecords([local] as any, [])[0].pending, true);
});

test('production service factories: 1/2 stops, offline local completion, restart sync, next recommendation and A/B/guest isolation', async () => {
  const f = ownedCourseFixture();
  for (let n = 0; n < 3; n++) {
    const ports = f.make(), ui = createOwnedCourseLifecycle(async () => ports as any);
    const courseRunId = `run-${n}`;
    await ui.begin(courseRunId);
    const places = Array.from({ length: n === 2 ? 2 : 1 }, (_, i) => ({ contentId: `place-${i}`, title: 'fixture', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 40 }));
    for (let i = 0; i < places.length; i++) await ui.captureArrival({ courseRunId, stopOrdinal: (i + 1) as 1 | 2, confirmationEventId: `${courseRunId}-${i}` });
    f.setOnline(false);
    assert.equal((await ui.complete({ courseRunId, trigger: 'explicit_course_finish', completedAt: 1788753500000 + n, places })).status, 'created');
    assert.equal((await ports.readOwnedDeviceCourseCompletions()).records.length, n + 1);
    const before = f.samples.length; await ui.sync(courseRunId); assert.equal(f.samples.length, before);
    f.setOnline(true);
    const cold = createOwnedCourseLifecycle(async () => f.make() as any); await cold.resumePending();
  }
  assert.equal(f.samples.length, 4);
  const applied = deriveDwellPersonalizationV1({ category: '카페', subCategory: '커피전문점', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, samples: f.samples });
  assert.equal(applied.state, 'applied');
  f.setActor('B'); assert.equal((await f.make().readOwnedDeviceCourseCompletions()).records.length, 0);
  f.setActor('guest'); assert.equal((await f.make().readOwnedDeviceCourseCompletions()).records.length, 0);
});

test('owned completion returns local success without remote; cleanup precedes separate sync', async () => {
  const calls: string[] = [];
  const controller = createOwnedCourseLifecycle(async () => ({
    beginOwnedCourseRun: async () => { calls.push('begin'); return { status: 'captured', snapshot: { owner: { kind: 'guest' } } }; },
    completeOwnedCourseRun: async () => { calls.push('local'); return { status: 'completed', localStatus: 'created', record: {}, sync: { status: 'pending' } }; },
    retryOwnedCourseRunSync: async () => { calls.push('sync'); return new Promise(() => {}); },
    readPendingOwnedCourseRunSyncs: async () => ({ status: 'empty', courseRunIds: [] }),
  }) as any);
  controller.begin('run');
  const result = await controller.complete({ courseRunId: 'run' } as any);
  assert.equal(result.status, 'created');
  assert.deepEqual(calls, ['begin', 'local']);
  calls.push('cleanup');
  void controller.sync('run');
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls, ['begin', 'local', 'cleanup', 'sync']);
});

test('cold completion never creates a new owner; failure cannot be promoted to success', async () => {
  let begins = 0;
  const controller = createOwnedCourseLifecycle(async () => ({
    beginOwnedCourseRun: async () => { begins++; },
    completeOwnedCourseRun: async () => ({ status: 'run_not_captured' }),
  }) as any);
  assert.equal((await controller.complete({ courseRunId: 'old-run' } as any)).status, 'storage_unavailable');
  assert.equal(begins, 0);
});

test('DB handoff regression: pending eligibility never delays mandatory local completion', async () => {
  const f = ownedCourseFixture(), ports = f.make();
  const ui = createOwnedCourseLifecycle(async () => ports as any);
  await ui.begin('run-lock');
  let release!: () => void;
  f.setConsentBarrier(new Promise<void>(resolve => { release = resolve; }));
  const capture = ui.captureArrival({ courseRunId: 'run-lock', stopOrdinal: 1, confirmationEventId: 'arrival-lock' });
  for (let n = 0; n < 40; n++) await Promise.resolve();
  let completed = false;
  const finishing = ui.complete({ courseRunId: 'run-lock', trigger: 'explicit_course_finish', completedAt: 1788753500000, places: [{ contentId: 'p', title: 'fixture', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 40 }] }).then(result => { completed = true; return result; });
  for (let n = 0; n < 80; n++) await Promise.resolve();
  assert.equal(completed, true, 'local completion must settle before remote consent');
  assert.equal(f.calls.length, 0);
  release(); await capture;
  assert.equal((await finishing).status, 'created');
});

test('UI lifecycle: unresolved begin cannot block explicit local completion', async () => {
  const f = ownedCourseFixture(), ports = f.make();
  f.setConsentBarrier(new Promise<void>(() => {}));
  const ui = createOwnedCourseLifecycle(async () => ports as any);
  void ui.begin('unresolved-start');
  let result: any;
  void ui.complete({ courseRunId: 'unresolved-start', trigger: 'explicit_course_finish', completedAt: 1788753500000,
    places: [{ contentId: 'p', title: 'fixture', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 40 }] }).then(r => { result = r; });
  for (let n = 0; n < 300; n++) await Promise.resolve();
  assert.equal(result?.status, 'created');
  assert.equal(f.calls.length, 0);
});
