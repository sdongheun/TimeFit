import assert from 'node:assert/strict';
import test from 'node:test';
import { liveEvidenceFixture, checkpoint, evidenceCompletion } from '../fixtures/liveLearningEvidenceFixture';
import { createOwnedCourseLifecycle } from '../../src/ui/ownedCourseLifecycle';
import { createLearningEvidenceCoordinator, type LearningNativePort } from '../../src/ui/liveActivity/learningEvidenceCoordinator';
import { createLiveCourseProgressController } from '../../src/ui/liveActivity/courseProgressRuntimeModel';
import type { LearningEvidenceProjectionV1 } from '../../src/services/liveLearningEvidence';
import { buildReleaseOneStopRepresentativeCourseV1 } from '../../src/engine';

function harness(f = liveEvidenceFixture(), run = 'run', ids = ['p']) {
  let db = f.make();
  const ports = () => ({ beginOwnedCourseRun: db.beginCourseRun, preserveUnverifiedOwnedCourseRun: db.preserveUnverifiedCourseRun, completeOwnedCourseRun: db.completeCourseRun,
    prepareOwnedRunLearningEvidence: db.prepareRunLearningEvidence, publishOwnedRunLearningEvidence: db.publishRunLearningEvidence,
    acceptOwnedConfirmationEvidence: db.acceptConfirmationEvidence, closeOwnedRunLearningEvidence: db.closeRunLearningEvidence,
    purgeOwnedRunLearningEvidence: db.purgeRunLearningEvidence, retryOwnedLearningEvidenceCleanup: db.retryLearningEvidenceCleanup, retryOwnedCourseRunSync: db.retryCourseRunSync });
  let projection: LearningEvidenceProjectionV1 | null = null, scope: string | null = null, raw: string | null = null;
  const receipts = new Map<string, string>();
  const native: { -readonly [K in keyof LearningNativePort]: LearningNativePort[K] } = {
    setActiveRun(id) { scope = id; projection = null; }, readScope: () => scope,
    readActive: id => scope === id && projection?.publicationToken ? { ...projection } : null,
    async storePrepared(p) { assert.equal(scope, p.courseRunId); if (!projection) projection = p; return p; },
    async activate(p) { assert.equal(scope, p.courseRunId); assert.equal(projection?.evidenceRef, p.evidenceRef); projection = p; return p; },
    async clearExact(id) { if (scope === id) { scope = null; projection = null; } },
  };
  let learning = createLearningEvidenceCoordinator(async () => ports() as any, native);
  const owned = createOwnedCourseLifecycle(async () => ports() as any);
  const stops = ids.map((contentId, index) => ({ stopId: `stop:${index}:${contentId}`, stopOrdinal: (index + 1) as 1 | 2, contentId }));
  const dependencies = {
    storage: { async read() { return raw; }, async write(v: string) { raw = v; }, async clear() { raw = null; },
      async listReceipts() { return [...receipts].map(([receiptId, raw]) => ({ receiptId, raw })); }, async acknowledgeReceipt(id: string) { receipts.delete(id); } },
    activity: { async start() {}, async update() {}, async end() {} }, notification: { async sync() {}, async cancelOwned() {} },
    learning: { capture: (id: string) => learning.capture(id), consume: (v: any) => learning.consume(v), restore: () => learning.restore(run, stops), close: (id: string, why: any) => learning.close(id, why) },
  };
  let controller = createLiveCourseProgressController(dependencies);
  const plan: any = { courseRunId: run, snapshot: { courseRunId: run, finalArrivalAtMs: 1788753600000, arrivalBufferMin: 10,
    stops: stops.map(s => ({ stopId: s.stopId, placeId: s.contentId, title: 'fixture', plannedStayMin: 30 })) }, routes: stops.map((s, i) => ({ travelStepIndex: i * 2, targetKind: 'visit_stop', targetStopId: s.stopId, targetTitle: 'fixture', moveMin: 5, nextBoundaryAtMs: 1788753500000, departureReminderAtMs: null })) };
  return { f, native, owned, stops, receipts, dependencies, plan, get db() { return db; }, get learning() { return learning; }, get controller() { return controller; },
    async start(publish = true) { learning.start(run); await owned.begin(run); if (publish) await learning.bootstrap(run, stops); await controller.afterHandoff({ opened: true, plan, travelStepIndex: 0, occurredAtMs: 1788750000000, eventId: 'open' }); },
    async arrive(source = 'live_activity_intent', index = 0) {
      const eventId = `arrival-${run}-${index}`, occurredAtMs = 1788750300000 + index * 45 * 60000;
      if (source === 'app_action') await controller.confirmArrival({ courseRunId: run, stopId: stops[index].stopId, eventId, source, occurredAtMs });
      else { receipts.set(eventId, JSON.stringify({ schemaVersion: 1, purpose: 'course_progress', courseRunId: run, stopId: stops[index].stopId, eventId, baseRevision: (await controller.readState())!.revision,
        type: 'arrival_confirmed', source, occurredAtMs, evidence: native.readActive(run) })); await controller.reconcile(run); }
      await checkpoint();
    },
    cold() { db = f.makeCold(); learning = createLearningEvidenceCoordinator(async () => ports() as any, native); controller = createLiveCourseProgressController(dependencies); },
    async complete() {
      const state = (await controller.readState())!;
      if (state.phase === 'dwelling') await controller.applyEvent({ type: 'departure_confirmed', courseRunId: run, stopId: state.activeStopId!, baseRevision: state.revision,
        eventId: `departure-${run}`, source: 'live_activity_intent', occurredAtMs: state.stops.at(-1)!.arrivedAtMs! + 40 * 60000 });
      const dwell = await controller.readActualDwell(run);
      const result = await owned.complete({ ...evidenceCompletion(run), places: stops.map(s => ({ ...evidenceCompletion(run).places[0], contentId: s.contentId, actualDwellMin: dwell[s.contentId] ?? null })) });
      await learning.close(run, 'completed'); await owned.sync(run); return result;
    },
  };
}

test('production UI + DB: mixed/native-only three completions feed the next actual engine; cold ack and duplicate are idempotent', async () => {
  for (const mixed of [false, true]) {
    const f = liveEvidenceFixture();
    for (let i = 1; i <= 3; i++) {
      const h = harness(f, `run-${i}`); await h.start(); await h.arrive(mixed && i === 2 ? 'app_action' : 'live_activity_intent');
      assert.equal((await h.controller.readState())?.phase, 'dwelling');
      assert.equal(h.receipts.size, 0);
      h.cold(); await h.controller.reconcile(`run-${i}`); await checkpoint();
      assert.equal((await h.complete()).status, 'created');
      assert.equal(f.samples.size, i);
      const read = await h.db.readDwellPersonalizationSamples();
      assert.equal(read.status, 'ok');
      assert.equal(read.samples.length, i);
      assert.deepEqual(read.samples.map(s => [s.category, s.subCategory, s.dwellMin]),
        Array.from({ length: i }, () => ['카페', '커피전문점', 40]));
      let routeCalls = 0;
      const result = await buildReleaseOneStopRepresentativeCourseV1({
        now: new Date(1788753600000), origin: { id: 'o', lat: 35.15, lon: 129.06 }, destination: { id: 'd', lat: 35.16, lon: 129.07 }, remainingMin: 80, arrivalBufferMin: 10,
        provider: { listRepresentativeCandidates: () => [{ id: 'p', title: 'fixture', lat: 35.151, lon: 129.061, category: '카페', subCategory: '커피전문점', classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] } }] },
        routes: { async getRoute() { throw Error('legacy route fallback forbidden'); } }, receiptRoutes: { async getRouteReceipt() { routeCalls++; return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } }, dwellPersonalizationSamples: read.samples,
      });
      assert.equal(result.representativeCourse?.stops[0]?.stayMin, i < 3 ? 30 : 40);
      assert.equal(routeCalls, 2);
    }
  }
});

for (const scenario of ['guest', 'anonymous', 'unpublished', 'notification', 'invalidated', 'legacy'] as const) test(`learning exclusion preserves progress: ${scenario}`, async () => {
  const h = harness(); if (scenario === 'guest' || scenario === 'anonymous') h.f.actor(scenario);
  await h.start(scenario !== 'unpublished');
  if (scenario === 'invalidated') await h.db.invalidateLearningEvidence();
  if (scenario === 'legacy') await h.native.clearExact('run');
  await h.arrive(scenario === 'notification' ? 'notification_action' : 'live_activity_intent');
  assert.equal((await h.controller.readState())?.phase, 'dwelling');
  await h.complete(); assert.equal(h.f.samples.size, 0);
});

test('unavailable consumption retains original receipt; cold replay resumes without a second arrival tap', async () => {
  const h = harness(); await h.start();
  const original = h.dependencies.learning.consume;
  h.dependencies.learning.consume = async () => ({ status: 'unavailable' });
  await h.arrive(); assert.equal(h.receipts.size, 1);
  h.dependencies.learning.consume = original; h.cold();
  await h.controller.reconcile('run'); await checkpoint();
  assert.equal(h.receipts.size, 0); await h.complete(); assert.equal(h.f.samples.size, 1);
});

test('optional consume never resolving cannot block progress or mandatory UI completion', async () => {
  const h = harness(); await h.start();
  h.dependencies.learning.consume = () => new Promise(() => {});
  await h.arrive(); assert.equal((await h.controller.readState())?.phase, 'dwelling');
  assert.equal((await h.owned.complete(evidenceCompletion('run'))).status, 'created');
  assert.equal(h.f.samples.size, 0);
});

test('two optimized stops retain first publication across native→app actions and actual dwell boundaries', async () => {
  const h = harness(liveEvidenceFixture(), 'pair', ['q', 'p']); await h.start(); await h.arrive();
  await h.controller.afterHandoff({ opened: true, plan: h.plan, travelStepIndex: 2, occurredAtMs: 1788750300000 + 40 * 60000, eventId: 'next' });
  await h.arrive('app_action', 1); await h.complete();
  assert.equal(h.f.samples.size, 2);
  assert.deepEqual([...h.f.samples.values()].map(s => s.dwellMin), [40, 40]);
});

test('publication before first action, double prepare, and lost activation ack preserve active token', async () => {
  const h = harness(); const activate = h.native.activate;
  h.native.activate = async p => { await activate(p); throw Error('ack lost'); };
  await h.start(); const before = h.native.readActive('run'); assert.ok(before?.publicationToken);
  await h.learning.bootstrap('run', h.stops); assert.deepEqual(h.native.readActive('run'), before);
  await h.arrive(); await h.complete(); assert.equal(h.f.samples.size, 1);
});

test('action before publication closes the window; delayed bootstrap cannot retroactively learn', async () => {
  const h = harness(); await h.start(false); await h.arrive();
  await h.learning.bootstrap('run', h.stops); assert.equal(h.native.readActive('run'), null);
  await h.complete(); assert.equal(h.f.samples.size, 0);
});

for (const reason of ['cancelled', 'expired', 'replaced'] as const) test(`${reason}: delayed activate cannot resurrect or remove the next run`, async () => {
  const h = harness(); await h.start(false);
  let release!: () => void;
  const barrier = new Promise<void>(r => { release = r; });
  const activate = h.native.activate;
  h.native.activate = async p => { await barrier; return activate(p); };
  const task = h.learning.bootstrap('run', h.stops); await checkpoint();
  await h.learning.close('run', reason); h.learning.start('next');
  release(); await task; assert.equal(h.native.readScope(), 'next'); assert.equal(h.native.readActive('run'), null);
});

for (const mutation of ['account', 'off', 'reset', 'delete'] as const) test(`${mutation}: historic evidence cannot become eligible after local invalidation`, async () => {
  const h = harness(); await h.start();
  if (mutation === 'account') { h.f.actor('B'); h.db.notifyCourseRunAuthChanged(); h.f.actor('A'); h.db.notifyCourseRunAuthChanged(); }
  if (mutation === 'off') { await h.f.remote.setConsent({ requestId: 'off', enabled: false, expectedRevision: 1 }); h.db.invalidatePendingCourseRunCaptures(); }
  if (mutation === 'reset') { await h.f.remote.reset({ requestId: 'reset', expectedRevision: 1 }); h.db.invalidatePendingCourseRunCaptures(); }
  if (mutation === 'delete') await h.db.invalidateLearningEvidence();
  await h.learning.clearInvalidatedNative(); await h.arrive(); await h.complete();
  assert.equal(h.f.samples.size, 0);
});

test('consume committed but ack failed: cold first replay acknowledges once and preserves sample eligibility', async () => {
  const h = harness(); await h.start();
  const ack = h.dependencies.storage.acknowledgeReceipt;
  h.dependencies.storage.acknowledgeReceipt = async () => { throw Error('ack failed'); };
  await h.arrive(); assert.equal(h.receipts.size, 1);
  h.dependencies.storage.acknowledgeReceipt = ack; h.cold(); await h.controller.reconcile('run'); await checkpoint();
  assert.equal(h.receipts.size, 0); await h.complete(); assert.equal(h.f.samples.size, 1);
});

test('handoff receive applies native receipt while evidence remains optional', async () => {
  const h = harness(); await h.start();
  h.receipts.set('r', JSON.stringify({ schemaVersion: 1, purpose: 'course_progress', courseRunId: 'run', stopId: 'stop:0:p', eventId: 'receive-first', baseRevision: 1,
    type: 'arrival_confirmed', source: 'live_activity_intent', occurredAtMs: 1788750300000, evidence: h.native.readActive('run') }));
  await h.controller.prepareHandoff({ plan: h.plan, travelStepIndex: 0, occurredAtMs: 1788750300000, eventId: 'retry' });
  await checkpoint(); assert.equal((await h.controller.readState())?.stops[0].firstArrival?.eventId, 'receive-first');
  assert.equal(h.receipts.size, 0);
});

test('competing stale receipt never replaces the persisted first arrival or adds a sample', async () => {
  const h = harness(); await h.start(); await h.arrive('app_action');
  h.receipts.set('competitor', JSON.stringify({ schemaVersion: 1, purpose: 'course_progress', courseRunId: 'run', stopId: 'stop:0:p', eventId: 'competitor', baseRevision: 1,
    type: 'arrival_confirmed', source: 'live_activity_intent', occurredAtMs: 1788750350000, evidence: h.native.readActive('run') }));
  await h.controller.reconcile('run'); await checkpoint();
  assert.equal((await h.controller.readState())?.stops[0].firstArrival?.eventId, 'arrival-run-0');
  assert.equal(h.receipts.size, 0); await h.complete(); assert.equal(h.f.samples.size, 1);
});

test('cold cleanup retries receipt removal without a UI durable queue and preserves active progress receipts', async () => {
  const h = harness(); await h.start();
  h.native.receiptRuns = async () => ['run'];
  h.native.activeProgressRun = async () => 'run';
  let clears = 0; h.native.clearReceipts = async () => { clears++; };
  await h.learning.retry(); assert.equal(clears, 0);
  await h.learning.close('run', 'cancelled');
  const before = clears; h.native.activeProgressRun = async () => null;
  h.cold(); await h.learning.retry(); assert.equal(clears, before + 1);
});
