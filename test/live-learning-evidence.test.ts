import assert from 'node:assert/strict';
import test from 'node:test';
import { liveEvidenceFixture, evidenceStops, evidenceCompletion, evidenceConfirmation, barrier, checkpoint } from './fixtures/liveLearningEvidenceFixture';
import { LIVE_LEARNING_EVIDENCE_PREFIX, createLearningEvidenceAuthObserver, type LearningEvidenceProjectionV1 } from '../src/services/liveLearningEvidence';
import { buildReleaseOneStopRepresentativeCourseV1 } from '../src/engine';
import { RELEASE_DEVICE_OWNERSHIP_KEY } from '../src/services/releaseIdentityPersonalizationRuntime';

const nativePort = { async storePrepared(p: LearningEvidenceProjectionV1) { return p; }, async activate(p: LearningEvidenceProjectionV1) { return p; } };
async function preparedRun(f: ReturnType<typeof liveEvidenceFixture>, id = 'run') {
  const runtime = f.make();
  await runtime.beginCourseRun({ courseRunId: id });
  const prepared = await runtime.prepareRunLearningEvidence({ courseRunId: id, stops: evidenceStops });
  assert.equal(prepared.status, 'prepared'); if (prepared.status !== 'prepared') throw Error('prepare fixture');
  return { runtime, prepared };
}
async function publishedRun(f: ReturnType<typeof liveEvidenceFixture>, id = 'run') {
  const { runtime, prepared } = await preparedRun(f, id);
  const published = await runtime.publishRunLearningEvidence(prepared, nativePort);
  assert.equal(published.status, 'published'); if (published.status !== 'published') throw Error('publish fixture');
  return { runtime, prepared, projection: published.projection };
}

test('failure-first: app/native action-time evidence uses the SAME local consumption and visit-before-sample path', async () => {
  const f = liveEvidenceFixture(), runtime = f.make();
  for (const source of ['app_action', 'live_activity_intent']) {
    const courseRunId = source;
    await runtime.beginCourseRun({ courseRunId });
    const prepared = await runtime.prepareRunLearningEvidence({ courseRunId, stops: evidenceStops });
    assert.equal(prepared.status, 'prepared'); if (prepared.status !== 'prepared') return;
    const published = await runtime.publishRunLearningEvidence({ projection: prepared.projection }, { async storePrepared(p) { return p; }, async activate(p) { return p; } });
    assert.equal(published.status, 'published'); if (published.status !== 'published') return;
    const input = evidenceConfirmation(courseRunId, published.projection, source);
    assert.equal((await runtime.acceptConfirmationEvidence(input)).status, 'accepted');
    assert.equal((await runtime.acceptConfirmationEvidence(input)).status, 'already_accepted');
    assert.equal((await runtime.completeCourseRun(evidenceCompletion(courseRunId))).status, 'completed');
    await runtime.retryCourseRunSync({ courseRunId });
  }
  assert.deepEqual(f.calls, ['visit', 'sample', 'visit', 'sample']);
});

test('failure-first: publication hanging outside storage lock cannot block mandatory local completion', async () => {
  const f = liveEvidenceFixture(), runtime = f.make(), blocked = barrier();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const prepared = await runtime.prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops });
  assert.equal(prepared.status, 'prepared'); if (prepared.status !== 'prepared') return;
  const pending = runtime.publishRunLearningEvidence({ projection: prepared.projection }, { async storePrepared(p) { await blocked.promise; return p; }, async activate(p) { return p; } });
  await checkpoint();
  let completed = false;
  const finishing = runtime.completeCourseRun(evidenceCompletion('run')).then(r => { completed = r.status === 'completed'; });
  await checkpoint();
  try { assert.equal(completed, true); assert.deepEqual(f.calls, []); }
  finally { blocked.release(); await pending; await finishing; }
  assert.equal((await pending).status, 'excluded');
});

test('three independent native courses: 1/2 samples baseline, 3 samples alter actual engine stay; cleanup before cold sync', async () => {
  const f = liveEvidenceFixture();
  for (let i = 1; i <= 3; i++) {
    const courseRunId = `native-${i}`, { runtime, projection } = await publishedRun(f, courseRunId);
    assert.equal((await runtime.acceptConfirmationEvidence(evidenceConfirmation(courseRunId, projection))).status, 'accepted');
    await runtime.completeCourseRun(evidenceCompletion(courseRunId));
    assert.equal((await runtime.closeRunLearningEvidence({ courseRunId, reason: 'completed' })).status, 'closed');
    await runtime.purgeRunLearningEvidence({ courseRunId });
    assert.equal(f.values.has(`${LIVE_LEARNING_EVIDENCE_PREFIX}${courseRunId}`), false);
    f.online(false); await runtime.retryCourseRunSync({ courseRunId });
    f.online(true); const cold = f.makeCold(); await cold.retryCourseRunSync({ courseRunId }); await cold.retryCourseRunSync({ courseRunId });
    const read = await cold.readDwellPersonalizationSamples(); assert.equal(read.samples.length, i);
    const result = await buildReleaseOneStopRepresentativeCourseV1({
      now: new Date(1788753600000), origin: { id: 'o', lat: 35.15, lon: 129.06 }, destination: { id: 'd', lat: 35.16, lon: 129.07 }, remainingMin: 80, arrivalBufferMin: 10,
      provider: { listRepresentativeCandidates: () => [{ id: 'p', title: 'fixture', lat: 35.151, lon: 129.061, category: '카페', subCategory: '커피전문점', classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] } }] },
      routes: { async getRoute() { return null; } }, receiptRoutes: { async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } }, dwellPersonalizationSamples: read.samples,
    });
    assert.equal(result.representativeCourse?.stops[0]?.stayMin, i < 3 ? 30 : 40);
  }
  assert.equal(f.samples.size, 3);
});

for (const phase of ['before_prepare', 'prepared', 'native_stored_before_ack'] as const) test(`publication boundary: ${phase} cannot be approved by a later ack`, async () => {
  const f = liveEvidenceFixture(), runtime = f.make();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  if (phase === 'before_prepare') {
    assert.equal((await runtime.acceptConfirmationEvidence(evidenceConfirmation('run', undefined))).status, 'excluded');
    assert.equal((await runtime.prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops })).status, 'excluded');
    return;
  }
  const prepared = await runtime.prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops });
  assert.equal(prepared.status, 'prepared'); if (prepared.status !== 'prepared') return;
  if (phase === 'native_stored_before_ack') await nativePort.storePrepared(prepared.projection);
  assert.equal((await runtime.acceptConfirmationEvidence(evidenceConfirmation('run', prepared.projection))).status, 'excluded');
  const published = await runtime.publishRunLearningEvidence(prepared, nativePort);
  assert.equal(published.status, 'published'); if (published.status !== 'published') return;
  assert.equal((await runtime.acceptConfirmationEvidence(evidenceConfirmation('run', published.projection))).status, 'excluded');
  await runtime.completeCourseRun(evidenceCompletion('run')); await runtime.retryCourseRunSync({ courseRunId: 'run' });
  assert.equal(f.samples.size, 0);
});

test('activation stored but ack lost: only the action-time token is replayable, no cross-file atomic claim', async () => {
  const f = liveEvidenceFixture(), { runtime, prepared } = await preparedRun(f);
  let actual: LearningEvidenceProjectionV1 | undefined;
  const published = await runtime.publishRunLearningEvidence(prepared, { ...nativePort, async activate(p) { actual = p; throw Error('ack lost'); } });
  assert.equal(published.status, 'unavailable'); assert.ok(actual);
  const cold = f.makeCold(), input = evidenceConfirmation('run', actual);
  input.application.outcome = 'replayed_first';
  assert.equal((await cold.acceptConfirmationEvidence(input)).status, 'accepted');
  const nextCold = f.makeCold();
  assert.equal((await nextCold.acceptConfirmationEvidence(input)).status, 'already_accepted');
  await nextCold.completeCourseRun(evidenceCompletion('run')); await nextCold.retryCourseRunSync({ courseRunId: 'run' });
  assert.equal(f.samples.size, 1);
});

test('cold duplicate preparation is idempotent but cold first issuance and late on/login are forbidden', async () => {
  const f = liveEvidenceFixture(), { prepared } = await preparedRun(f);
  assert.deepEqual(await f.make().prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops }), prepared);
  const r = f.make(); await r.beginCourseRun({ courseRunId: 'unissued' });
  assert.equal((await f.make().prepareRunLearningEvidence({ courseRunId: 'unissued', stops: evidenceStops })).status, 'excluded');
  f.actor('guest'); const guest = f.make(); await guest.beginCourseRun({ courseRunId: 'guest' });
  f.actor('A');
  assert.equal((await guest.prepareRunLearningEvidence({ courseRunId: 'guest', stops: evidenceStops })).status, 'excluded');
  await f.remote.setConsent({ requestId: 'off', enabled: false, expectedRevision: 1 });
  await guest.beginCourseRun({ courseRunId: 'off' });
  await f.remote.setConsent({ requestId: 'on', enabled: true, expectedRevision: 2 });
  assert.equal((await guest.prepareRunLearningEvidence({ courseRunId: 'off', stops: evidenceStops })).status, 'excluded');
});

for (const variant of ['missing', 'legacy', 'wrong_ref', 'wrong_generation', 'wrong_stop', 'wrong_run', 'wrong_revision', 'stale', 'notification', 'departure', 'sensitive'] as const) test(`invalid confirmation ${variant}: no sample or retroactive replacement`, async () => {
  const f = liveEvidenceFixture(), { runtime, projection } = await publishedRun(f);
  const input = evidenceConfirmation('run', projection);
  if (variant === 'missing') input.receipt.evidence = undefined;
  if (variant === 'legacy') input.receipt.evidence = { schemaVersion: 0 };
  if (variant === 'wrong_ref') input.receipt.evidence = { ...projection, evidenceRef: '00000000-0000-4000-8000-999999999999' };
  if (variant === 'wrong_generation') input.receipt.evidence = { ...projection, captureGeneration: 99 };
  if (variant === 'wrong_stop') input.receipt.stopId = 'different';
  if (variant === 'wrong_run') input.receipt.courseRunId = 'different';
  if (variant === 'wrong_revision') input.application.arrivalBaseRevision = 1;
  if (variant === 'stale') input.application.outcome = 'stale';
  if (variant === 'notification') { input.receipt.source = 'notification_action'; input.application.source = 'notification_action'; }
  if (variant === 'departure') input.receipt.type = 'departure_confirmed';
  if (variant === 'sensitive') input.receipt.evidence = { ...projection, accessToken: 'forbidden-fixture' };
  assert.ok(['excluded', 'conflict'].includes((await runtime.acceptConfirmationEvidence(input)).status));
  await runtime.completeCourseRun(evidenceCompletion('run')); await runtime.retryCourseRunSync({ courseRunId: 'run' });
  assert.equal(f.samples.size, 0);
});

test('app/native competition preserves first stop event; different mapping or publication ack conflicts', async () => {
  const f = liveEvidenceFixture(), { runtime, projection, prepared } = await publishedRun(f);
  assert.equal((await runtime.prepareRunLearningEvidence({ courseRunId: 'run', stops: [{ ...evidenceStops[0]!, stopId: 'other' }] })).status, 'conflict');
  assert.equal((await runtime.confirmRunEvidencePublication({ projection: prepared.projection, nativePreparedAck: { ...prepared.projection, courseRunId: 'other' } })).status, 'conflict');
  const app = evidenceConfirmation('run', projection, 'app_action'), native = evidenceConfirmation('run', projection);
  native.receipt.eventId = 'competing'; native.application.firstArrivalEventId = 'competing';
  const results = await Promise.all([runtime.acceptConfirmationEvidence(app), runtime.acceptConfirmationEvidence(native)]);
  assert.deepEqual(results.map(r => r.status), ['accepted', 'conflict']);
});

for (const mutation of ['A-B-A', 'off-on', 'reset', 'delete', 'replaced', 'expired', 'cancelled'] as const) test(`invalidation ${mutation}: late publication/receipt cannot revive learning despite native removal failure`, async () => {
  const f = liveEvidenceFixture(), { runtime, projection, prepared } = await publishedRun(f);
  const remove = f.deps.storage.removeItem;
  f.deps.storage.removeItem = async key => { if (key.startsWith(LIVE_LEARNING_EVIDENCE_PREFIX)) throw Error('native/optional removal unavailable'); return remove(key); };
  if (mutation === 'A-B-A') { f.actor('B'); runtime.notifyCourseRunAuthChanged(); await checkpoint(); f.actor('A'); runtime.notifyCourseRunAuthChanged(); }
  if (mutation === 'off-on') { await f.deps.dwellRemote.setConsent({ requestId: 'off', enabled: false, expectedRevision: 1 }); await f.deps.dwellRemote.setConsent({ requestId: 'on', enabled: true, expectedRevision: 2 }); }
  if (mutation === 'reset') await runtime.resetDwellPersonalization({ requestId: 'reset', expectedRevision: 1 });
  if (mutation === 'delete') await runtime.cleanupAccountDeviceData();
  if (mutation === 'replaced' || mutation === 'expired' || mutation === 'cancelled') await runtime.closeRunLearningEvidence({ courseRunId: 'run', reason: mutation });
  await checkpoint();
  const cold = f.makeCold();
  assert.equal((await cold.acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'excluded');
  assert.equal((await cold.publishRunLearningEvidence(prepared, nativePort)).status, 'excluded');
  assert.equal(f.samples.size, 0);
});

test('optional evidence write hang cannot occupy mandatory completion storage lock; late write is terminal', async () => {
  const f = liveEvidenceFixture(), { runtime, projection } = await publishedRun(f), blocked = barrier();
  const write = f.deps.storage.setItem;
  f.deps.storage.setItem = async (key, value) => { if (key.startsWith(LIVE_LEARNING_EVIDENCE_PREFIX)) await blocked.promise; return write(key, value); };
  const pending = runtime.acceptConfirmationEvidence(evidenceConfirmation('run', projection)); await checkpoint();
  let finished = false;
  const finish = runtime.completeCourseRun(evidenceCompletion('run')).then(r => { finished = r.status === 'completed'; });
  await checkpoint();
  try { assert.equal(finished, true); } finally { blocked.release(); await pending; await finish; }
  assert.equal((await pending).status, 'excluded');
  await f.make().retryCourseRunSync({ courseRunId: 'run' }); assert.equal(f.samples.size, 0);
});

test('corrupt/failed evidence storage is unavailable, not receipt ack success; mandatory record still saved', async () => {
  for (const corruption of [true, false]) {
    const f = liveEvidenceFixture(), { runtime, projection } = await publishedRun(f);
    if (corruption) f.values.set(`${LIVE_LEARNING_EVIDENCE_PREFIX}run`, '{');
    else { const write = f.deps.storage.setItem; f.deps.storage.setItem = async (key, value) => { if (key.startsWith(LIVE_LEARNING_EVIDENCE_PREFIX)) throw Error('disk'); return write(key, value); }; }
    assert.equal((await runtime.acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'unavailable');
    assert.equal((await runtime.completeCourseRun(evidenceCompletion('run'))).status, 'completed');
    await runtime.retryCourseRunSync({ courseRunId: 'run' }); assert.equal(f.samples.size, 0);
  }
});

test('cold owner reconciliation preserves A evidence for A, not a different initial account', async () => {
  const f = liveEvidenceFixture(), { projection } = await publishedRun(f);
  const cold = f.make(); assert.equal((await cold.reconcileLearningEvidenceAccount('A')).status, 'ready');
  assert.equal((await cold.acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'accepted');
  await cold.reconcileLearningEvidenceAccount('B');
  assert.equal((await f.make().acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'excluded');
});

test('failed optional deletion remains discoverable after account snapshot removal; other active run survives', async () => {
  const f = liveEvidenceFixture(), first = await publishedRun(f, 'A-run');
  const remove = f.deps.storage.removeItem;
  f.deps.storage.removeItem = async key => { if (key.startsWith(LIVE_LEARNING_EVIDENCE_PREFIX)) throw Error('disk'); return remove(key); };
  await first.runtime.cleanupAccountDeviceData(); await checkpoint();
  assert.ok(f.values.has(`${LIVE_LEARNING_EVIDENCE_PREFIX}A-run`));
  f.actor('B'); const second = await publishedRun(f, 'B-run');
  f.deps.storage.removeItem = remove;
  assert.equal((await f.make().retryLearningEvidenceCleanup()).status, 'cleaned');
  assert.equal(f.values.has(`${LIVE_LEARNING_EVIDENCE_PREFIX}A-run`), false);
  assert.equal(f.values.has(`${LIVE_LEARNING_EVIDENCE_PREFIX}B-run`), true);
  assert.equal((await second.runtime.acceptConfirmationEvidence(evidenceConfirmation('B-run', second.projection))).status, 'accepted');
  assert.deepEqual(JSON.parse(f.values.get(RELEASE_DEVICE_OWNERSHIP_KEY)!).evidenceCleanupRunIds, []);
});

for (const actor of ['guest', 'anonymous', 'error']) test(`${actor}: no projection issuance, no network from evidence service`, async () => {
  const f = liveEvidenceFixture(); f.actor(actor); const runtime = f.make();
  await runtime.beginCourseRun({ courseRunId: actor });
  assert.equal((await runtime.prepareRunLearningEvidence({ courseRunId: actor, stops: evidenceStops })).status, 'excluded');
  assert.deepEqual(f.calls, []);
});

test('two exact stop mappings produce two samples; swapped completion content never learns', async () => {
  for (const swapped of [false, true]) {
    const f = liveEvidenceFixture(), runtime = f.make();
    await runtime.beginCourseRun({ courseRunId: 'two' });
    const prepared = await runtime.prepareRunLearningEvidence({ courseRunId: 'two', stops: [...evidenceStops, { stopId: 'stop-2', stopOrdinal: 2, contentId: 'q' }] });
    assert.equal(prepared.status, 'prepared'); if (prepared.status !== 'prepared') return;
    const pub = await runtime.publishRunLearningEvidence(prepared, nativePort);
    assert.equal(pub.status, 'published'); if (pub.status !== 'published') return;
    for (const ordinal of [1, 2] as const) {
      const input = evidenceConfirmation('two', pub.projection);
      input.receipt.stopId = `stop-${ordinal}`; input.application.stopId = `stop-${ordinal}`;
      input.application.stopOrdinal = ordinal;
      input.receipt.eventId = `arrival-${ordinal}`; input.application.firstArrivalEventId = `arrival-${ordinal}`;
      assert.equal((await runtime.acceptConfirmationEvidence(input)).status, 'accepted');
    }
    const completion = evidenceCompletion('two');
    completion.places.push({ ...completion.places[0]!, contentId: 'q' });
    if (swapped) completion.places.reverse();
    await runtime.completeCourseRun(completion); await runtime.retryCourseRunSync({ courseRunId: 'two' });
    assert.equal(f.samples.size, swapped ? 0 : 2);
  }
});

test('new evidence cleanup does not reset 7-day age or resurrect the 33rd-outbox eviction', async () => {
  const f = liveEvidenceFixture();
  f.deps.dwellRemote = { ...f.deps.dwellRemote, async submit() { throw Error('offline sample'); } };
  for (let i = 0; i < 33; i++) {
    const run = `capacity-${i}`, { runtime, projection } = await publishedRun(f, run);
    await runtime.acceptConfirmationEvidence(evidenceConfirmation(run, projection));
    await runtime.completeCourseRun(evidenceCompletion(run)); await runtime.purgeRunLearningEvidence({ courseRunId: run });
    await runtime.retryCourseRunSync({ courseRunId: run });
  }
  let submitted = 0;
  f.deps.dwellRemote = { ...f.deps.dwellRemote, async submit() { submitted++; return { status: 'accepted' }; } };
  await f.make().retryCourseRunSync({ courseRunId: 'capacity-0' });
  assert.equal(submitted, 0);
  f.time(1788753500000 + 7 * 86400000 + 1);
  await f.make().retryCourseRunSync({ courseRunId: 'capacity-32' });
  assert.equal(submitted, 0);
  assert.equal((await f.make().readDeviceCourseCompletions()).records.length, 33);
});

test('invalidation write failure quarantines evidence across runtime recreation but does not stop local completion', async () => {
  const f = liveEvidenceFixture(), { runtime, projection } = await publishedRun(f);
  const write = f.deps.storage.setItem;
  f.deps.storage.setItem = async (key, value) => { if (key === RELEASE_DEVICE_OWNERSHIP_KEY) throw Error('disk'); return write(key, value); };
  assert.equal((await runtime.invalidateLearningEvidence()).status, 'unavailable');
  assert.equal((await f.make().acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'unavailable');
  assert.equal((await runtime.completeCourseRun(evidenceCompletion('run'))).status, 'completed');
  f.deps.storage.setItem = write;
  assert.equal((await runtime.invalidateLearningEvidence()).status, 'invalidated');
  assert.equal((await f.make().acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'excluded');
});

for (const operation of ['prepare', 'consume', 'activation'] as const) test(`in-flight ${operation} invalidation: stale result cannot reopen active evidence`, async () => {
  const f = liveEvidenceFixture(), blocked = barrier();
  const runtime = f.make(); let prepared: LearningEvidenceProjectionV1 | undefined;
  await runtime.beginCourseRun({ courseRunId: 'run' });
  if (operation !== 'prepare') {
    const result = await runtime.prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops });
    assert.equal(result.status, 'prepared'); if (result.status !== 'prepared') return; prepared = result.projection;
  }
  let pending: Promise<{ status: string }>;
  if (operation === 'activation') {
    pending = runtime.publishRunLearningEvidence({ projection: prepared! }, { ...nativePort, async activate(p) { await blocked.promise; return p; } });
  } else {
    let projection: LearningEvidenceProjectionV1 | undefined;
    if (operation === 'consume') {
      const pub = await runtime.publishRunLearningEvidence({ projection: prepared! }, nativePort);
      assert.equal(pub.status, 'published'); if (pub.status !== 'published') return; projection = pub.projection;
    }
    const write = f.deps.storage.setItem;
    f.deps.storage.setItem = async (key, value) => { if (key.startsWith(LIVE_LEARNING_EVIDENCE_PREFIX)) await blocked.promise; return write(key, value); };
    pending = operation === 'prepare' ? runtime.prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops }) : runtime.acceptConfirmationEvidence(evidenceConfirmation('run', projection));
  }
  await checkpoint();
  assert.equal((await runtime.invalidateLearningEvidence()).status, 'invalidated');
  blocked.release(); assert.equal((await pending).status, 'excluded');
  await runtime.retryLearningEvidenceCleanup();
  assert.equal(f.values.has(`${LIVE_LEARNING_EVIDENCE_PREFIX}run`), false);
});

test('production Auth observer: INITIAL_SESSION and refresh preserve same-owner cold receipt, real transitions invalidate', async () => {
  const f = liveEvidenceFixture(), { runtime, projection } = await publishedRun(f);
  let ready = false;
  const observer = createLearningEvidenceAuthObserver({ setReady: value => { ready = value; }, reconcile: runtime.reconcileLearningEvidenceAccount, notifyChanged: runtime.notifyCourseRunAuthChanged });
  observer('INITIAL_SESSION', { user: { id: 'A' } });
  observer('TOKEN_REFRESHED', { user: { id: 'A' } });
  await checkpoint(); assert.equal(ready, true);
  observer('SIGNED_IN', { user: { id: 'A' } });
  assert.equal((await runtime.acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'accepted');
  observer('SIGNED_OUT', null); await checkpoint();
  observer('SIGNED_IN', { user: { id: 'A' } }); await checkpoint();
  assert.equal((await f.make().acceptConfirmationEvidence(evidenceConfirmation('run', projection))).status, 'excluded');
});

test('after receipt ack then restart: duplicate prepare restores already durable accepted evidence without receipt recreation', async () => {
  const f = liveEvidenceFixture(), { runtime, projection, prepared } = await publishedRun(f);
  await runtime.acceptConfirmationEvidence(evidenceConfirmation('run', projection));
  // The receipt has been acknowledged; only active evidence + immutable course mapping remain.
  const cold = f.makeCold();
  assert.deepEqual(await cold.prepareRunLearningEvidence({ courseRunId: 'run', stops: evidenceStops }), prepared);
  await cold.completeCourseRun(evidenceCompletion('run')); await cold.retryCourseRunSync({ courseRunId: 'run' });
  assert.equal(f.samples.size, 1);
});
