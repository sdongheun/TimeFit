import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveDwellPersonalizationV1 } from '../src/engine/dwellPersonalization';
import { createAccountIdentityResolver } from '../src/services/accountIdentity';
import { createCourseCompletionRepository, type CourseCompletionStorage } from '../src/services/courseCompletionRepository';
import { createReleaseIdentityPersonalizationRuntime } from '../src/services/releaseIdentityPersonalizationRuntime';

function memoryStorage() {
  const values = new Map<string, string>(); const writes: string[] = [];
  const storage: CourseCompletionStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); writes.push(key); },
    async removeItem(key) { values.delete(key); writes.push(`remove:${key}`); },
  };
  return { storage, values, writes };
}

function fixture() {
  const device = memoryStorage(); let actor: 'account-a' | 'account-b' | 'guest' | 'unavailable' = 'account-a';
  let accountWriteUnavailable = false; let consentReadUnavailable = false;
  let consent = { enabled: true, consentEpoch: 'epoch-a' as string | null, revision: 1, updatedAt: 'now' };
  const calls: string[] = []; const serverCompletions = new Set<string>(); const samples: Array<{ category: string; subCategory: string; dwellMin: number }> = [];
  const identity = createAccountIdentityResolver({
    async getSession() {
      if (actor === 'guest') return null;
      if (actor === 'unavailable') throw new Error('offline');
      return { accessToken: actor, expiresAt: 9_999_999_999_999 };
    },
    async getUser() { return { id: actor, email: null, isAnonymous: false }; },
  }, () => 1_000);
  const accountRemote = {
    async readGeneration() { return 1; },
    async write(input: { courseRunId: string }) { calls.push(`server:${input.courseRunId}`); if (accountWriteUnavailable) throw new Error('server unavailable'); const existed = serverCompletions.has(input.courseRunId); serverCompletions.add(input.courseRunId); return { status: existed ? 'already_completed' as const : 'created' as const }; },
    async read() { return []; },
    async deleteOne() { return { status: 'deleted' as const, generation: 1 }; },
    async deleteAll() { serverCompletions.clear(); return { status: 'deleted' as const, generation: 2 }; },
  };
  const dwellRemote = {
    async readConsent() { if (consentReadUnavailable) throw new Error('consent unavailable'); return consent; },
    async setConsent(input: { enabled: boolean }) { consent = { enabled: input.enabled, consentEpoch: input.enabled ? 'epoch-next' : null, revision: consent.revision + 1, updatedAt: 'next' }; return consent; },
    async reset() { consent = { enabled: false, consentEpoch: null, revision: consent.revision + 1, updatedAt: 'reset' }; samples.length = 0; return { consent, deletedSampleCount: 3 }; },
    async submit(input: { courseRunId: string; category: string; subCategory: string; actualDwellMin: number }) {
      assert.equal(serverCompletions.has(input.courseRunId), true, 'server visit acknowledgement must precede dwell submit');
      calls.push(`sample:${input.courseRunId}`); samples.push({ category: input.category, subCategory: input.subCategory, dwellMin: input.actualDwellMin });
      return { status: 'accepted' as const };
    },
    async readSamples() { return [...samples]; },
  };
  const legacy = createCourseCompletionRepository({
    getItem: (key) => device.storage.getItem(`legacy:${key}`),
    setItem: (key, value) => device.storage.setItem(`legacy:${key}`, value),
    removeItem: (key) => device.storage.removeItem(`legacy:${key}`),
  }, { createCompletionId: () => 'legacy-completion' });
  let importAttempts = 0;
  const dependencies = {
    storage: device.storage, identity, legacyCompletions: legacy, accountRemote, dwellRemote,
    guestRemote: { async import(input: { importId: string; items: readonly { sourceCompletionId: string }[] }) { importAttempts += 1; if (importAttempts === 1) throw new Error('response lost'); return { status: 'already_acknowledged' as const, importId: input.importId, acceptedSourceIds: input.items.map((item) => item.sourceCompletionId), rejectedSourceIds: [] }; } },
    now: () => Date.UTC(2026, 8, 7, 12), createDeviceScopeId: () => 'device-1', createCompletionId: () => `completion-${calls.length}`, createImportId: () => '11111111-1111-4111-8111-111111111111',
  };
  return {
    device, dependencies, calls, samples,
    setActor(next: typeof actor) { actor = next; }, setConsent(next: typeof consent) { consent = next; },
    setAccountWriteUnavailable(next: boolean) { accountWriteUnavailable = next; },
    setConsentReadUnavailable(next: boolean) { consentReadUnavailable = next; },
  };
}

const place = (dwell: number) => ({ contentId: 'poi_1158', title: '히떼로스터리', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: dwell });

test('DB identity device flow: 실제 조합이 local 완료→server ack→sample 순서와 cold restore를 보장한다', async () => {
  const f = fixture();
  for (let index = 1; index <= 3; index += 1) {
    const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
    assert.equal((await runtime.beginCourseRun({ courseRunId: `run-${index}` })).status, 'captured');
    assert.equal((await runtime.captureStopPersonalizationEligibility({ courseRunId: `run-${index}`, stopOrdinal: 1, confirmationEventId: `arrival-${index}` })).status, 'captured');
    const result = await runtime.completeCourseRun({ courseRunId: `run-${index}`, completedAt: Date.UTC(2026, 8, 7, 11, index), trigger: 'explicit_course_finish', places: [place(20 + index * 5)] });
    assert.equal(result.status, 'completed');
    assert.equal(result.sync.status, 'pending');
    assert.equal((await runtime.retryCourseRunSync({ courseRunId: `run-${index}` })).status, 'synced');
  }
  assert.deepEqual(f.calls, ['server:run-1','sample:run-1','server:run-2','sample:run-2','server:run-3','sample:run-3']);
  const restarted = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  assert.equal((await restarted.retryCourseRunSync({ courseRunId: 'run-3' })).status, 'synced');
  const read = await restarted.readDwellPersonalizationSamples();
  assert.equal(read.status, 'ok');
  if (read.status === 'ok') assert.equal(deriveDwellPersonalizationV1({ category: '카페', subCategory: '커피전문점', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, samples: read.samples }).state, 'applied');
});

test('DB identity device flow: guest source는 side-effect-free 조회·명시 승인·ack 뒤에만 제거된다', async () => {
  const f = fixture(); f.setActor('guest');
  const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  await runtime.beginCourseRun({ courseRunId: 'guest-run' });
  await runtime.completeCourseRun({ courseRunId: 'guest-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(25)] });
  f.setActor('account-a');
  const before = await runtime.readGuestImportSource({ surface: 'login' });
  assert.equal(before.status, 'available');
  assert.equal(before.records.length, 1);
  assert.equal(f.device.values.has('@timefit/guest-completion-import-pending-v1'), false);
  await runtime.dismissGuestImportOffer();
  assert.equal((await runtime.readGuestImportSource({ surface: 'login' })).status, 'dismissed');
  assert.equal((await runtime.readGuestImportSource({ surface: 'records' })).status, 'available');
  const approved = await runtime.approveGuestCompletionImport({ sourceCompletionIds: before.records.map((record) => record.completionId) });
  assert.equal(approved.status, 'prepared');
  assert.equal((await runtime.continueGuestCompletionImport({ importId: approved.importId! })).status, 'unavailable');
  assert.equal((await runtime.readGuestImportSource({ surface: 'records' })).records.length, 1);
  assert.equal((await runtime.continueGuestCompletionImport({ importId: approved.importId! })).status, 'source_removed');
  assert.equal((await runtime.readGuestImportSource({ surface: 'records' })).records.length, 0);
  assert.equal(f.samples.length, 0);
});

test('DB identity device flow: logout·계정전환·동의철회·삭제 cleanup은 다른 owner를 노출하거나 재생하지 않는다', async () => {
  const f = fixture(); const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  await runtime.beginCourseRun({ courseRunId: 'a-run' });
  await runtime.captureStopPersonalizationEligibility({ courseRunId: 'a-run', stopOrdinal: 1, confirmationEventId: 'a-arrival' });
  f.setActor('account-b');
  assert.equal((await runtime.completeCourseRun({ courseRunId: 'a-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(30)] })).sync.status, 'pending');
  assert.equal((await runtime.retryCourseRunSync({ courseRunId: 'a-run' })).status, 'owner_changed');
  assert.deepEqual((await runtime.readDeviceCourseCompletions()).records, []);
  const bCleanup = await runtime.cleanupAccountDeviceData();
  assert.equal(bCleanup.status, 'cleaned');
  if ('ownerSubject' in bCleanup) assert.equal(bCleanup.ownerSubject, 'account-b');
  f.setActor('account-a');
  assert.equal((await runtime.readDeviceCourseCompletions()).records.length, 1, 'B cleanup must not delete A local completion');
  await runtime.completeCourseRun({ courseRunId: 'a-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(30)] });
  await runtime.retryCourseRunSync({ courseRunId: 'a-run' });
  const reset = await runtime.resetDwellPersonalization({ requestId: 'reset-a', expectedRevision: 1 });
  assert.equal(reset.status, 'reset');
  assert.equal((await runtime.retryCourseRunSync({ courseRunId: 'a-run' })).submittedSampleCount, 0);
  const cleanup = await runtime.cleanupAccountDeviceData();
  assert.equal(cleanup.status, 'cleaned');
  f.setActor('account-b');
  assert.deepEqual((await runtime.readDeviceCourseCompletions()).records, []);
});

test('DB identity device flow: 동시 begin은 최초 owner를 고정하고 인증 확인 실패 기록을 guest로 노출하지 않는다', async () => {
  const f = fixture();
  const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  const [first, repeated] = await Promise.all([
    runtime.beginCourseRun({ courseRunId: 'concurrent-run' }),
    runtime.beginCourseRun({ courseRunId: 'concurrent-run' }),
  ]);
  assert.equal(first.status, 'captured');
  assert.deepEqual(repeated, first);
  f.setActor('unavailable');
  assert.equal((await runtime.beginCourseRun({ courseRunId: 'unverified-run' })).status, 'captured');
  assert.equal((await runtime.completeCourseRun({ courseRunId: 'unverified-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(30)] })).sync.status, 'not_applicable');
  assert.equal((await runtime.retryCourseRunSync({ courseRunId: 'unverified-run' })).status, 'local_only');
  f.setActor('guest');
  assert.deepEqual(await runtime.readDeviceCourseCompletions(), { status: 'empty', records: [] });
});

test('DB identity device flow: 손상된 owner storage는 빈 guest로 강등하지 않고 명시 오류를 반환한다', async () => {
  const f = fixture();
  f.device.values.set('@timefit/release-device-ownership-v1', '{broken');
  const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  assert.deepEqual(await runtime.beginCourseRun({ courseRunId: 'run-corrupt' }), { status: 'storage_corrupt' });
  assert.deepEqual(await runtime.readDeviceCourseCompletions(), { status: 'storage_corrupt', records: [] });
  assert.deepEqual(await runtime.captureStopPersonalizationEligibility({ courseRunId: 'run-corrupt', stopOrdinal: 1, confirmationEventId: 'event-corrupt' }), { status: 'storage_corrupt' });
});

test('DB identity device flow: 원격 실패는 local 완료를 유지하고 server ack 전 표본을 보내지 않으며 재시작 후 수렴한다', async () => {
  const f = fixture(); const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  await runtime.beginCourseRun({ courseRunId: 'offline-run' });
  await runtime.captureStopPersonalizationEligibility({ courseRunId: 'offline-run', stopOrdinal: 1, confirmationEventId: 'offline-arrival' });
  f.setAccountWriteUnavailable(true);
  const completed = await runtime.completeCourseRun({ courseRunId: 'offline-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(30)] });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.sync.status, 'pending');
  assert.deepEqual(f.calls, []);
  assert.equal((await runtime.readDeviceCourseCompletions()).records.length, 1);
  assert.equal((await runtime.retryCourseRunSync({ courseRunId: 'offline-run' })).status, 'unavailable');
  assert.deepEqual(f.calls, ['server:offline-run']);
  f.setAccountWriteUnavailable(false);
  const restarted = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  const recovered = await restarted.retryCourseRunSync({ courseRunId: 'offline-run' });
  assert.equal(recovered.status, 'synced');
  assert.equal(recovered.submittedSampleCount, 1);
  assert.deepEqual(f.calls, ['server:offline-run', 'server:offline-run', 'sample:offline-run']);
});

test('DB identity device flow: 개별 기록 삭제는 해당 run local/eligibility/outbox만 정리해 재전송하지 않는다', async () => {
  const f = fixture(); const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  await runtime.beginCourseRun({ courseRunId: 'delete-one-run' });
  await runtime.captureStopPersonalizationEligibility({ courseRunId: 'delete-one-run', stopOrdinal: 1, confirmationEventId: 'delete-one-arrival' });
  const completed = await runtime.completeCourseRun({ courseRunId: 'delete-one-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(30)] });
  assert.equal(completed.status, 'completed');
  if (completed.status !== 'completed') return;
  await runtime.retryCourseRunSync({ courseRunId: 'delete-one-run' });
  const deleted = await runtime.deleteAccountRecord({ completionId: completed.record.completionId, requestId: 'delete-one-request' });
  assert.equal(deleted.status, 'deleted');
  assert.deepEqual(await runtime.retryCourseRunSync({ courseRunId: 'delete-one-run' }), { status: 'not_found', submittedSampleCount: 0 });
  assert.deepEqual(await runtime.readDeviceCourseCompletions(), { status: 'empty', records: [] });
});

test('DB identity device flow: 선택 동의 조회 실패는 account 방문 저장을 막지 않고 학습만 제외한다', async () => {
  const f = fixture(); f.setConsentReadUnavailable(true);
  const runtime = createReleaseIdentityPersonalizationRuntime(f.dependencies);
  const began = await runtime.beginCourseRun({ courseRunId: 'consent-offline-run' });
  assert.equal(began.status, 'captured');
  if (began.status === 'captured') assert.equal(began.snapshot.runEligibility, null);
  await runtime.captureStopPersonalizationEligibility({ courseRunId: 'consent-offline-run', stopOrdinal: 1, confirmationEventId: 'consent-offline-arrival' });
  const completed = await runtime.completeCourseRun({ courseRunId: 'consent-offline-run', completedAt: Date.UTC(2026, 8, 7, 11), trigger: 'explicit_course_finish', places: [place(30)] });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.sync.status, 'pending');
  assert.equal((await runtime.retryCourseRunSync({ courseRunId: 'consent-offline-run' })).status, 'synced');
  assert.deepEqual(f.calls, ['server:consent-offline-run']);
});
