import assert from 'node:assert/strict';
import test from 'node:test';
import { createCourseCompletionRepository } from '../src/services/courseCompletionRepository';
import { createAccountIdentityResolver } from '../src/services/accountIdentity';
import { createReleaseIdentityPersonalizationRuntime, RELEASE_DEVICE_OWNERSHIP_KEY, withCourseRunCaptureInvalidation } from '../src/services/releaseIdentityPersonalizationRuntime';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function checkpoint() { for (let n = 0; n < 250; n++) await Promise.resolve(); }
function fixture() {
  const values = new Map<string, string>(), calls: string[] = [];
  let actor = 'A', writes = 0, id = 0;
  const storage = {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { writes++; values.set(key, value); },
    async removeItem(key: string) { writes++; values.delete(key); },
  };
  const identity = createAccountIdentityResolver({
    async getSession() { return actor === 'guest' ? null : { accessToken: 'fixture', expiresAt: 9999999999999 }; },
    async getUser() { return { id: actor, email: null, isAnonymous: false }; },
  }, () => 1);
  let consent = { enabled: true, consentEpoch: 'epoch' as string | null, revision: 1, updatedAt: '' };
  const deps = {
    storage, identity: { resolve: identity.resolve }, legacyCompletions: createCourseCompletionRepository(storage), now: () => 1788753600000,
    createDeviceScopeId: () => 'device', createCompletionId: () => `completion-${++id}`,
    accountRemote: {
      async readGeneration() { return 1; }, async read() { return []; },
      async write() { calls.push('visit'); return { status: 'created' as const }; },
      async deleteOne() { return { status: 'deleted' as const, generation: 1 }; },
      async deleteAll() { return { status: 'deleted' as const, generation: 2 }; },
    },
    dwellRemote: {
      async readConsent() { return consent; }, async readSamples() { return []; },
      async setConsent() { consent = { enabled: false, consentEpoch: null, revision: 2, updatedAt: '' }; return consent; },
      async reset() { consent = { enabled: false, consentEpoch: null, revision: 2, updatedAt: '' }; return { consent, deletedSampleCount: 0 }; },
      async submit() { calls.push('sample'); return { status: 'accepted' as const }; },
    },
    guestRemote: { async import(input: { importId: string }) { return { status: 'acknowledged' as const, importId: input.importId, acceptedSourceIds: [], rejectedSourceIds: [] }; } },
  };
  return { deps, values, calls, make: () => createReleaseIdentityPersonalizationRuntime(deps), writes: () => writes, actor(value: string) { actor = value; } };
}
const completion = (courseRunId: string) => ({ courseRunId, completedAt: 1788753500000, trigger: 'explicit_course_finish' as const,
  places: [{ contentId: 'p', title: 'fixture', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 40 }] });
const arrival = (courseRunId: string) => ({ courseRunId, stopOrdinal: 1 as const, confirmationEventId: `event-${courseRunId}` });

test('failure-first: unresolved capture permits SAME run local completion before consent release', async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const old = await f.deps.dwellRemote.readConsent();
  f.deps.dwellRemote.readConsent = async () => { await barrier.promise; return old; };
  const capturing = runtime.captureStopPersonalizationEligibility(arrival('run'));
  await checkpoint();
  let completed = false;
  const finishing = runtime.completeCourseRun(completion('run')).then(result => { completed = result.status === 'completed'; return result; });
  await checkpoint();
  try { assert.equal(completed, true); assert.deepEqual(f.calls, []); }
  finally { barrier.release(); await capturing; await finishing; }
  const restored = f.make();
  await restored.captureStopPersonalizationEligibility(arrival('run'));
  await restored.retryCourseRunSync({ courseRunId: 'run' });
  assert.deepEqual(f.calls, ['visit']);
});

for (const stage of ['identity', 'generation'] as const) test(`failure-first: unresolved begin ${stage} permits unrelated and explicit unverified local finish`, async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  await runtime.beginCourseRun({ courseRunId: 'other' });
  if (stage === 'identity') {
    const resolve = f.deps.identity.resolve;
    f.deps.identity.resolve = async () => { await barrier.promise; return resolve(); };
  } else f.deps.accountRemote.readGeneration = async () => { await barrier.promise; return 1; };
  const beginning = runtime.beginCourseRun({ courseRunId: 'pending' });
  await checkpoint();
  let completed = false;
  const finishing = runtime.completeCourseRun(completion('other')).then(result => { completed = result.status === 'completed'; });
  await checkpoint();
  try {
    assert.equal(completed, true);
    assert.equal((await runtime.preserveUnverifiedCourseRun({ courseRunId: 'pending' })).status, 'captured');
    assert.equal((await runtime.completeCourseRun(completion('pending'))).status, 'completed');
    assert.deepEqual(f.calls, []);
  } finally { barrier.release(); await beginning; await finishing; }
  const found = await f.make().readCourseRunOwnership({ courseRunId: 'pending', viewer: { kind: 'unverified' } });
  assert.equal(found.status, 'found');
  if (found.status === 'found') assert.equal(found.ownerKind, 'unverified');
});

test('failure-first: readonly cold ownership never creates, writes or exposes a mismatched subject', async () => {
  const f = fixture(), runtime = f.make();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const cold = f.make(), before = f.writes();
  const found = await cold.readCourseRunOwnership({ courseRunId: 'run', viewer: { kind: 'account', subject: 'A' } });
  assert.equal(found.status, 'found');
  assert.deepEqual(await cold.readCourseRunOwnership({ courseRunId: 'missing', viewer: { kind: 'account', subject: 'B' } }), { status: 'not_found' });
  const other = await cold.readCourseRunOwnership({ courseRunId: 'run', viewer: { kind: 'account', subject: 'B' } });
  assert.deepEqual(other, { status: 'found', courseRunId: 'run', ownerKind: 'account', ownerMatch: false, cleanupProof: null });
  assert.equal(f.writes(), before); assert.deepEqual(f.calls, []);
});

for (const mutation of ['complete', 'reset', 'off', 'delete', 'switch'] as const) test(`late stale consent cannot promote or resurrect after ${mutation}`, async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const old = await f.deps.dwellRemote.readConsent();
  const capture = runtime.captureStopPersonalizationEligibility;
  f.deps.dwellRemote.readConsent = async () => { await barrier.promise; return old; };
  const pending = capture(arrival('run')); await checkpoint();
  if (mutation === 'complete') await runtime.completeCourseRun(completion('run'));
  if (mutation === 'reset') await runtime.resetDwellPersonalization({ requestId: 'reset', expectedRevision: 1 });
  if (mutation === 'off') await withCourseRunCaptureInvalidation(f.deps.dwellRemote, runtime.invalidatePendingCourseRunCaptures).setConsent({ requestId: 'off', expectedRevision: 1, enabled: false });
  if (mutation === 'delete') await runtime.cleanupAccountDeviceData();
  if (mutation === 'switch') { f.actor('B'); runtime.notifyCourseRunAuthChanged(); }
  barrier.release(); await pending;
  const state = JSON.parse(f.values.get(RELEASE_DEVICE_OWNERSHIP_KEY)!);
  if (mutation === 'delete') assert.deepEqual(state.runs, []);
  else {
    assert.equal(state.runs[0].owner.subject, 'A');
    assert.equal(state.runs[0].stops[0].eligibility, null);
    // Repeated event + restart must not turn the exclusion into a new capture.
    const duplicate = await f.make().captureStopPersonalizationEligibility(arrival('run'));
    assert.deepEqual(duplicate, { status: 'captured', eligibility: null });
  }
  assert.deepEqual(f.calls, []);
});

test('begin in flight is invalidated by deletion even with no prior snapshot (empty -> empty ABA)', async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  f.deps.accountRemote.readGeneration = async () => { await barrier.promise; return 1; };
  const pending = runtime.beginCourseRun({ courseRunId: 'new' }); await checkpoint();
  await runtime.cleanupAccountDeviceData();
  barrier.release();
  assert.equal((await pending).status, 'stale');
  assert.equal((await runtime.readCourseRunOwnership({ courseRunId: 'new', viewer: { kind: 'account', subject: 'A' } })).status, 'not_found');
});

test('concurrent different runs retain both explicit local snapshots; duplicate stop event is immutable', async () => {
  const f = fixture(), runtime = f.make();
  await Promise.all(['one', 'two'].map(courseRunId => runtime.preserveUnverifiedCourseRun({ courseRunId })));
  await Promise.all([runtime.captureStopPersonalizationEligibility(arrival('one')), f.make().captureStopPersonalizationEligibility(arrival('one'))]);
  assert.equal((await runtime.captureStopPersonalizationEligibility({ ...arrival('one'), confirmationEventId: 'replacement' })).status, 'conflict');
  const state = JSON.parse(f.values.get(RELEASE_DEVICE_OWNERSHIP_KEY)!);
  assert.equal(state.runs.length, 2); assert.equal(state.runs[0].stops.length, 1);
});

test('readonly guest/unverified/corrupt/unavailable and missing finish fail closed without auth or writes', async () => {
  const f = fixture(), runtime = f.make();
  f.actor('guest'); await runtime.beginCourseRun({ courseRunId: 'guest' });
  await runtime.preserveUnverifiedCourseRun({ courseRunId: 'unknown' });
  f.deps.identity.resolve = async () => { throw Error('readonly must not call auth'); };
  const cold = f.make(), before = f.writes();
  for (const [courseRunId, kind] of [['guest', 'guest'], ['unknown', 'unverified']] as const) {
    const found = await cold.readCourseRunOwnership({ courseRunId, viewer: { kind } });
    assert.deepEqual(found, { status: 'found', courseRunId, ownerKind: kind, ownerMatch: true, cleanupProof: null });
  }
  assert.equal((await cold.completeCourseRun(completion('missing'))).status, 'run_not_captured');
  f.values.set(RELEASE_DEVICE_OWNERSHIP_KEY, '{');
  assert.equal((await cold.readCourseRunOwnership({ courseRunId: 'guest', viewer: { kind: 'guest' } })).status, 'corrupt');
  assert.equal((await cold.preserveUnverifiedCourseRun({ courseRunId: 'bad' })).status, 'storage_corrupt');
  f.deps.storage.getItem = async () => { throw Error('disk'); };
  assert.equal((await cold.readCourseRunOwnership({ courseRunId: 'guest', viewer: { kind: 'guest' } })).status, 'unavailable');
  assert.equal((await cold.preserveUnverifiedCourseRun({ courseRunId: 'bad' })).status, 'storage_unavailable');
  assert.equal(f.writes(), before); assert.deepEqual(f.calls, []);
});

test('cleanup proof survives acknowledged local deletion, not active replacement, account switch, forgery or restart', async () => {
  const f = fixture(), runtime = f.make();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const found = await runtime.readCourseRunOwnership({ courseRunId: 'run', viewer: { kind: 'account', subject: 'A' } });
  assert.equal(found.status, 'found'); if (found.status !== 'found') return;
  const input = { proof: found.cleanupProof, currentSubject: 'A', activeCourseRunId: 'run' };
  assert.equal(runtime.canCleanupCourseRun(input), true);
  assert.equal(runtime.canCleanupCourseRun({ ...input, activeCourseRunId: 'replacement' }), false);
  assert.equal(runtime.canCleanupCourseRun({ ...input, currentSubject: 'B' }), false);
  assert.equal(runtime.canCleanupCourseRun({ ...input, proof: { courseRunId: 'run' } }), false);
  await runtime.cleanupAccountDeviceData();
  assert.equal(runtime.canCleanupCourseRun(input), true);
  assert.equal(f.make().canCleanupCourseRun(input), false);
  runtime.notifyCourseRunAuthChanged();
  assert.equal(runtime.canCleanupCourseRun(input), false);
});

test('cold duplicate during unresolved capture returns durable null without querying consent again', async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const old = await f.deps.dwellRemote.readConsent(); let reads = 0;
  f.deps.dwellRemote.readConsent = async () => { reads++; await barrier.promise; return old; };
  const pending = runtime.captureStopPersonalizationEligibility(arrival('run')); await checkpoint();
  const cold = f.make();
  assert.deepEqual(await cold.captureStopPersonalizationEligibility(arrival('run')), { status: 'captured', eligibility: null });
  assert.equal(reads, 1);
  barrier.release(); await pending;
  assert.deepEqual(await cold.captureStopPersonalizationEligibility(arrival('run')), { status: 'captured', eligibility: null });
  await cold.completeCourseRun(completion('run'));
});

test('mandatory record survives envelope write failure and late capture cannot approve it', async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  const old = await f.deps.dwellRemote.readConsent();
  f.deps.dwellRemote.readConsent = async () => { await barrier.promise; return old; };
  const pending = runtime.captureStopPersonalizationEligibility(arrival('run')); await checkpoint();
  const setItem = f.deps.storage.setItem;
  f.deps.storage.setItem = async (key, value) => { if (key === RELEASE_DEVICE_OWNERSHIP_KEY) throw Error('disk'); await setItem(key, value); };
  const completed = await runtime.completeCourseRun(completion('run'));
  assert.equal(completed.status, 'completed');
  if (completed.status === 'completed') assert.equal(completed.learning.status, 'excluded_storage_failure');
  f.deps.storage.setItem = setItem; barrier.release(); await pending;
  await f.make().retryCourseRunSync({ courseRunId: 'run' });
  assert.deepEqual(f.calls, ['visit']);
});

test('begin auth switch while consent is pending never assigns the original account', async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  const old = await f.deps.dwellRemote.readConsent();
  f.deps.dwellRemote.readConsent = async () => { await barrier.promise; return old; };
  const pending = runtime.beginCourseRun({ courseRunId: 'run' }); await checkpoint();
  f.actor('B'); runtime.notifyCourseRunAuthChanged(); barrier.release();
  assert.equal((await pending).status, 'stale');
  assert.equal((await runtime.readCourseRunOwnership({ courseRunId: 'run', viewer: { kind: 'account', subject: 'B' } })).status, 'not_found');
});

test('unresolved consent on another run does not delay local finish or overwrite its commit', async () => {
  const f = fixture(), runtime = f.make(), barrier = deferred();
  await runtime.beginCourseRun({ courseRunId: 'first' });
  await runtime.beginCourseRun({ courseRunId: 'other' });
  const old = await f.deps.dwellRemote.readConsent();
  f.deps.dwellRemote.readConsent = async () => { await barrier.promise; return old; };
  const pending = runtime.captureStopPersonalizationEligibility(arrival('first')); await checkpoint();
  assert.equal((await f.make().completeCourseRun(completion('other'))).status, 'completed');
  assert.deepEqual(f.calls, []); barrier.release(); await pending;
  const state = JSON.parse(f.values.get(RELEASE_DEVICE_OWNERSHIP_KEY)!);
  assert.equal(state.runs.find((run: { courseRunId: string }) => run.courseRunId === 'other').visitSync, 'pending');
});

test('failed local reservation/preservation does not synthesize success or query consent', async () => {
  const f = fixture(), runtime = f.make();
  await runtime.beginCourseRun({ courseRunId: 'run' });
  let consentReads = 0;
  f.deps.dwellRemote.readConsent = async () => { consentReads++; throw Error('unused'); };
  f.deps.storage.setItem = async () => { throw Error('disk'); };
  assert.equal((await runtime.captureStopPersonalizationEligibility(arrival('run'))).status, 'storage_unavailable');
  assert.equal((await runtime.preserveUnverifiedCourseRun({ courseRunId: 'new' })).status, 'storage_unavailable');
  assert.equal((await runtime.completeCourseRun(completion('new'))).status, 'run_not_captured');
  assert.equal(consentReads, 0); assert.deepEqual(f.calls, []);
});
