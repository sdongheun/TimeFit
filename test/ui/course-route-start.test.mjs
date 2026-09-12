import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import 'tsx/cjs';
const require = createRequire(import.meta.url);
const { createLiveCourseProgressController } = require('../../src/ui/liveActivity/courseProgressRuntimeModel.ts');
const plan = { courseRunId: 'run', snapshot: { courseRunId: 'run', finalArrivalAtMs: 9999999, arrivalBufferMin: 10, stops: [{ stopId: 'stop:0:A', placeId: 'A', title: 'A', plannedStayMin: 20 }] }, routes: [{ travelStepIndex: 0, targetKind: 'visit_stop', targetStopId: 'stop:0:A', targetTitle: 'A', moveMin: 5, nextBoundaryAtMs: 9999999 }, { travelStepIndex: 2, targetKind: 'final_destination', targetStopId: null, targetTitle: 'End', moveMin: 5, nextBoundaryAtMs: 9999999 }] };
function fixture(failActivity = false) {
  let raw = null; const calls = []; const receipts = [];
  const dependencies = { storage: { async read() { return raw; }, async write(v) { raw = v; calls.push('write'); }, async clear() { raw = null; }, async listReceipts() { return receipts; }, async acknowledgeReceipt() {} }, activity: { async start() { calls.push('start'); if (failActivity) throw Error('denied'); }, async update() { calls.push('update'); }, async end() { calls.push('end'); } }, notification: { async sync() { calls.push('notify'); }, async cancelOwned() { calls.push('cancel'); } } };
  return { runtime: createLiveCourseProgressController(dependencies), dependencies, calls, receipts };
}
const start = (runtime, index = 0, eventId = 'click') => runtime.beginRouteIntent({ plan, travelStepIndex: index, occurredAtMs: 1000, eventId });
test('ROUTESTART saves moving intent before Activity, survives cold read; reopen never resets', async () => {
  const f = fixture(true), begun = await start(f.runtime);
  assert.equal(begun.status, 'started'); assert.deepEqual(f.calls, ['write', 'start', 'notify']);
  const cold = await createLiveCourseProgressController(f.dependencies).readState();
  assert.equal(cold.route.routeOpenedAtMs, 1000); assert.equal(cold.stops[0].arrivedAtMs, null);
  const count = f.calls.length;
  assert.equal((await start(f.runtime, 0, 'reopen')).status, 'reused'); assert.equal(f.calls.length, count);
});
test('ROUTESTART all-open failure restores only owned attempt; retry stays monotonic', async () => {
  const f = fixture(), begun = await start(f.runtime);
  assert.equal((await f.runtime.rollbackRouteIntent(begun)).status, 'rolled_back');
  const failed = await f.runtime.readState(); assert.equal(failed.route, null); assert.ok(f.calls.includes('cancel')); assert.ok(f.calls.includes('end'));
  await start(f.runtime, 0, 'retry'); assert.ok((await f.runtime.readState()).revision > begun.state.revision);
});
for (const change of ['arrival', 'terminal', 'different_run', 'receipt']) test(`ROUTESTART late failure preserves ${change}`, async () => {
  const f = fixture(), begun = await start(f.runtime);
  if (change === 'arrival') await f.runtime.confirmArrival({ courseRunId: 'run', stopId: 'stop:0:A', occurredAtMs: 2000, eventId: 'arrival', source: 'app_action' });
  if (change === 'terminal') await f.runtime.applyEvent({ courseRunId: 'run', baseRevision: begun.state.revision, type: 'terminal', terminal: 'completed', source: 'app_action', occurredAtMs: 2000, eventId: 'finish' });
  if (change === 'different_run') await f.dependencies.storage.write(JSON.stringify({ ...begun.state, courseRunId: 'other' }));
  if (change === 'receipt') f.receipts.push({ receiptId: 'receipt', raw: JSON.stringify({ schemaVersion: 1, purpose: 'course_progress', courseRunId: 'run', baseRevision: begun.state.revision, stopId: 'stop:0:A', type: 'arrival_confirmed', source: 'live_activity_intent', occurredAtMs: 2000, eventId: 'arrival' }) });
  assert.equal((await f.runtime.rollbackRouteIntent(begun)).status, 'preserved');
  const state = await f.runtime.readState(); assert.equal(state.courseRunId, change === 'different_run' ? 'other' : 'run');
  if (change === 'arrival' || change === 'receipt') assert.equal(state.phase, 'dwelling');
});
test('ROUTESTART next/final rollback restores confirmed dwell but cannot erase native departure', async () => {
  const f = fixture(); await start(f.runtime); await f.runtime.confirmArrival({ courseRunId: 'run', stopId: 'stop:0:A', occurredAtMs: 2000, eventId: 'arrival', source: 'app_action' });
  const next = await start(f.runtime, 2, 'next'); assert.equal(next.state.route.targetKind, 'final_destination');
  await f.runtime.rollbackRouteIntent(next); assert.equal((await f.runtime.readState()).phase, 'dwelling');
  const state = await f.runtime.readState(); await f.runtime.applyEvent({ courseRunId: 'run', stopId: 'stop:0:A', baseRevision: state.revision, type: 'departure_confirmed', source: 'live_activity_intent', occurredAtMs: 3000, eventId: 'native-departure' });
  const nativeNext = await start(f.runtime, 2, 'native-open'); await f.runtime.rollbackRouteIntent(nativeNext);
  assert.equal((await f.runtime.readState()).stops[0].departedAtMs, 3000);
});
