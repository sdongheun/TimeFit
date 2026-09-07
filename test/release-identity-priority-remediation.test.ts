import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountIdentityResolver, createSupabaseAccountAuthPort } from '../src/services/accountIdentity';
import { createCourseCompletionRepository, type CourseCompletionStorage } from '../src/services/courseCompletionRepository';
import { createDwellOutbox, createMemoryDwellOutboxStorage } from '../src/services/dwellPersonalizationOutbox';
import type { DwellPersonalizationRemote } from '../src/services/dwellPersonalizationRepository';
import { createReleaseIdentityPersonalizationRuntime } from '../src/services/releaseIdentityPersonalizationRuntime';

const DAY = 86_400_000;

function storageFixture() {
  const values = new Map<string, string>();
  const storage: CourseCompletionStorage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
  return { storage, values };
}

function runtimeFixture(now: () => number) {
  const local = storageFixture(); const calls: string[] = []; let sampleUnavailable = false;
  let consent: Awaited<ReturnType<DwellPersonalizationRemote['readConsent']>> = { enabled: true, consentEpoch: 'epoch-a', revision: 1, updatedAt: 'now' };
  const identity = createAccountIdentityResolver({
    async getSession() { return { accessToken: 'fixture-token', expiresAt: 9_999_999_999_999 }; },
    async getUser() { return { id: 'account-a', email: null, isAnonymous: false }; },
  }, () => 1_000);
  const legacy = createCourseCompletionRepository(local.storage);
  const dwellRemote: DwellPersonalizationRemote = {
    async readConsent() { return consent; },
    async setConsent() { throw new Error('unused'); },
    async reset() { consent = { enabled: false, consentEpoch: null, revision: consent.revision + 1, updatedAt: 'reset' }; return { consent, deletedSampleCount: 0 }; },
    async submit(input) { calls.push(`sample:${input.courseRunId}`); if (sampleUnavailable) throw new Error('sample unavailable'); return { status: 'accepted' as const }; },
    async readSamples() { return []; },
  };
  const deps = {
    storage: local.storage, identity, legacyCompletions: legacy, now,
    createCompletionId: () => `completion-${calls.length}`,
    accountRemote: {
      async readGeneration() { return 1; },
      async write(input: { courseRunId: string }) { calls.push(`visit:${input.courseRunId}`); return { status: 'created' as const }; },
      async read() { return []; }, async deleteOne() { return { status: 'deleted' as const, generation: 1 }; }, async deleteAll() { return { status: 'deleted' as const, generation: 2 }; },
    },
    dwellRemote,
    guestRemote: { async import(input: { importId: string }) { return { status: 'acknowledged' as const, importId: input.importId, acceptedSourceIds: [], rejectedSourceIds: [] }; } },
  };
  return {
    runtime: createReleaseIdentityPersonalizationRuntime(deps), deps, local, calls,
    setSampleUnavailable(value: boolean) { sampleUnavailable = value; },
    setConsent(value: typeof consent) { consent = value; },
  };
}

const completion = (courseRunId: string, completedAt: number) => ({
  courseRunId, completedAt, trigger: 'explicit_course_finish' as const,
  places: [{ contentId: 'poi_1158', title: '히떼로스터리', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 30 }],
});

test('최우선 보완 failure-first: complete는 local 결과만 반환하고 원격 호출을 시작하지 않는다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now);
  await f.runtime.beginCourseRun({ courseRunId: 'local-first-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'local-first-run', stopOrdinal: 1, confirmationEventId: 'local-first-event' });
  const result = await f.runtime.completeCourseRun(completion('local-first-run', clock.now - 60_000));
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.sync, { status: 'pending' });
  assert.deepEqual(f.calls, []);
});

test('최우선 보완 failure-first: 33번째 enqueue는 상한으로 제거한 event ID를 반환한다', async () => {
  let now = Date.UTC(2026, 8, 7, 12);
  const outbox = createDwellOutbox(createMemoryDwellOutboxStorage(), { now: () => now, maxItems: 32, retentionMs: 7 * DAY });
  let result: Awaited<ReturnType<typeof outbox.enqueue>> | null = null;
  for (let index = 0; index < 33; index += 1) {
    result = await outbox.enqueue({ completionEventId: `event-${index}`, courseRunId: `run-${index}`, stopOrdinal: 1, contentId: 'poi_1158', category: '카페', subCategory: '커피전문점', actualDwellMin: 30, completedAtMinute: Math.floor(now / 60_000), ownerSubject: 'account-a', consentEpoch: 'epoch-a', consentRevision: 1 });
    now += 1;
  }
  assert.deepEqual(result, { status: 'queued', evictedCompletionEventIds: ['event-0'] });
});

test('최우선 보완 failure-first: 실제 Supabase adapter는 정상 무세션과 조회 오류를 구분한다', async () => {
  const missing = createAccountIdentityResolver(createSupabaseAccountAuthPort({
    async getSession() { return { data: { session: null }, error: null }; },
    async getUser() { throw new Error('unused'); },
  }), () => 1_000);
  assert.deepEqual(await missing.resolve(), { status: 'account_required', reason: 'missing_session' });

  for (const getSession of [
    async () => ({ data: { session: null }, error: { message: 'storage read failed' } }),
    async () => { throw new Error('network failed'); },
  ]) {
    const failed = createAccountIdentityResolver(createSupabaseAccountAuthPort({ getSession, async getUser() { throw new Error('unused'); } }), () => 1_000);
    assert.deepEqual(await failed.resolve(), { status: 'unavailable' });
  }
});

test('최우선 보완: unresolved 원격은 local 완료 응답을 막지 않고 별도 sync만 대기한다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now);
  let signalStarted!: () => void; const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  let resolveVisit!: () => void; const unresolved = new Promise<void>((resolve) => { resolveVisit = resolve; });
  f.deps.accountRemote.write = async (input: { courseRunId: string }) => { f.calls.push(`visit:${input.courseRunId}`); signalStarted(); await unresolved; return { status: 'created' as const }; };
  await f.runtime.beginCourseRun({ courseRunId: 'deferred-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'deferred-run', stopOrdinal: 1, confirmationEventId: 'deferred-event' });
  assert.equal((await f.runtime.completeCourseRun(completion('deferred-run', clock.now))).sync.status, 'pending');
  assert.deepEqual(f.calls, []);
  const restarted = createReleaseIdentityPersonalizationRuntime(f.deps);
  assert.deepEqual(await restarted.readPendingCourseRunSyncs(), { status: 'ok', courseRunIds: ['deferred-run'] });
  const sync = restarted.retryCourseRunSync({ courseRunId: 'deferred-run' });
  await started;
  let settled = false; sync.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  resolveVisit();
  assert.equal((await sync).status, 'synced');
  assert.deepEqual(await restarted.readPendingCourseRunSyncs(), { status: 'empty', courseRunIds: [] });
});

test('최우선 보완: 학습 최초 시각은 7일을 포함하고 +1ms부터 재시작·반복 sync에서도 만료된다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now); f.setSampleUnavailable(true);
  await f.runtime.beginCourseRun({ courseRunId: 'expiry-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'expiry-run', stopOrdinal: 1, confirmationEventId: 'expiry-event' });
  await f.runtime.completeCourseRun(completion('expiry-run', clock.now));
  const firstSync = await f.runtime.retryCourseRunSync({ courseRunId: 'expiry-run' });
  assert.equal('sampleSync' in firstSync ? firstSync.sampleSync?.status : null, 'pending');
  clock.now += 7 * DAY - 1;
  await f.runtime.retryCourseRunSync({ courseRunId: 'expiry-run' });
  clock.now += 1;
  await f.runtime.retryCourseRunSync({ courseRunId: 'expiry-run' });
  const beforeExpiry = f.calls.filter((call) => call === 'sample:expiry-run').length;
  assert.equal(beforeExpiry, 3, 'exactly 7 days remains eligible');
  clock.now += 1;
  const expired = await f.runtime.retryCourseRunSync({ courseRunId: 'expiry-run' });
  assert.equal('sampleSync' in expired ? expired.sampleSync?.status : null, 'excluded');
  const restarted = createReleaseIdentityPersonalizationRuntime(f.deps);
  await restarted.retryCourseRunSync({ courseRunId: 'expiry-run' });
  await restarted.retryCourseRunSync({ courseRunId: 'expiry-run' });
  assert.equal(f.calls.filter((call) => call === 'sample:expiry-run').length, beforeExpiry);
  assert.equal((await restarted.readDeviceCourseCompletions()).records.length, 1);
});

test('최우선 보완: 방문 ack가 7일 뒤 도착하면 방문만 저장하고 새 학습 대기를 만들지 않는다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now);
  await f.runtime.beginCourseRun({ courseRunId: 'late-ack-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'late-ack-run', stopOrdinal: 1, confirmationEventId: 'late-ack-event' });
  await f.runtime.completeCourseRun(completion('late-ack-run', clock.now));
  clock.now += 7 * DAY + 1;
  const synced = await f.runtime.retryCourseRunSync({ courseRunId: 'late-ack-run' });
  assert.equal(synced.visitStatus, 'created');
  assert.equal(synced.sampleSync.status, 'excluded');
  assert.deepEqual(f.calls, ['visit:late-ack-run']);
});

test('최우선 보완: 33번째 학습 대기가 제거한 첫 표본은 local 방문 33건에서 부활하지 않는다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now); f.setSampleUnavailable(true);
  for (let index = 0; index < 33; index += 1) {
    const run = `capacity-run-${index}`;
    await f.runtime.beginCourseRun({ courseRunId: run });
    await f.runtime.captureStopPersonalizationEligibility({ courseRunId: run, stopOrdinal: 1, confirmationEventId: `capacity-event-${index}` });
    await f.runtime.completeCourseRun(completion(run, clock.now));
    await f.runtime.retryCourseRunSync({ courseRunId: run });
    clock.now += 1;
  }
  const beforeRetry = f.calls.filter((call) => call === 'sample:capacity-run-0').length;
  const restarted = createReleaseIdentityPersonalizationRuntime(f.deps);
  const retry = await restarted.retryCourseRunSync({ courseRunId: 'capacity-run-0' });
  assert.equal('sampleSync' in retry ? retry.sampleSync?.status : null, 'excluded');
  assert.equal(f.calls.filter((call) => call === 'sample:capacity-run-0').length, beforeRetry);
  assert.equal((await restarted.readDeviceCourseCompletions()).records.length, 33);
});

test('최우선 보완: Supabase 인증 오류 중 network은 unavailable, 검증된 401은 session_expired다', async () => {
  const session = { access_token: 'fixture-token', expires_at: 9_999_999_999 };
  const network = createAccountIdentityResolver(createSupabaseAccountAuthPort({
    async getSession() { return { data: { session }, error: null }; },
    async getUser() { return { data: { user: null }, error: { status: 0, message: 'fetch failed' } }; },
  }), () => 1_000);
  assert.deepEqual(await network.resolve(), { status: 'unavailable' });
  const invalid = createAccountIdentityResolver(createSupabaseAccountAuthPort({
    async getSession() { return { data: { session }, error: null }; },
    async getUser() { return { data: { user: null }, error: { status: 401, code: 'bad_jwt' } }; },
  }), () => 1_000);
  assert.deepEqual(await invalid.resolve(), { status: 'session_expired' });

  const resolveUser = (isAnonymous: boolean, expiresAt = 9_999_999_999) => createAccountIdentityResolver(createSupabaseAccountAuthPort({
    async getSession() { return { data: { session: { access_token: 'fixture-token', expires_at: expiresAt } }, error: null }; },
    async getUser() { return { data: { user: { id: 'account-a', email: 'fixture@example.invalid', is_anonymous: isAnonymous } }, error: null }; },
  }), () => 1_000);
  assert.equal((await resolveUser(false).resolve()).status, 'account');
  assert.deepEqual(await resolveUser(true).resolve(), { status: 'account_required', reason: 'anonymous' });
  assert.deepEqual(await resolveUser(false, 0).resolve(), { status: 'session_expired' });
});

test('최우선 보완: 기존 guest 기록이 있어도 Supabase session 오류는 guest 조회·import로 fallback하지 않는다', async () => {
  let sessionState: 'missing' | 'error' = 'missing'; const local = storageFixture();
  const auth = {
    async getSession() { return sessionState === 'missing'
      ? { data: { session: null }, error: null }
      : { data: { session: null }, error: { message: 'secure storage unavailable' } }; },
    async getUser() { return { data: { user: null }, error: null }; },
  };
  const identity = createAccountIdentityResolver(createSupabaseAccountAuthPort(auth), () => 1_000);
  const legacy = createCourseCompletionRepository({
    getItem: (key) => local.storage.getItem(`legacy:${key}`),
    setItem: (key, value) => local.storage.setItem(`legacy:${key}`, value),
    removeItem: (key) => local.storage.removeItem(`legacy:${key}`),
  });
  const runtime = createReleaseIdentityPersonalizationRuntime({
    storage: local.storage, identity, legacyCompletions: legacy, now: () => Date.UTC(2026, 8, 7, 12), createDeviceScopeId: () => 'device-auth-test',
    accountRemote: { async readGeneration() { throw new Error('unused'); }, async write() { throw new Error('unused'); }, async read() { return []; }, async deleteOne() { throw new Error('unused'); }, async deleteAll() { throw new Error('unused'); } },
    dwellRemote: { async readConsent() { throw new Error('unused'); }, async setConsent() { throw new Error('unused'); }, async reset() { throw new Error('unused'); }, async submit() { throw new Error('unused'); }, async readSamples() { return []; } },
    guestRemote: { async import(input) { return { status: 'acknowledged', importId: input.importId, acceptedSourceIds: [], rejectedSourceIds: [] }; } },
  });
  await runtime.beginCourseRun({ courseRunId: 'guest-auth-run' });
  await runtime.completeCourseRun(completion('guest-auth-run', Date.UTC(2026, 8, 7, 12)));
  assert.equal((await runtime.readDeviceCourseCompletions()).records.length, 1);
  sessionState = 'error';
  assert.deepEqual(await runtime.readDeviceCourseCompletions(), { status: 'unavailable', records: [] });
  assert.deepEqual(await runtime.readGuestImportSource({ surface: 'records' }), { status: 'unavailable', records: [] });
  assert.equal(local.values.has('@timefit/guest-completion-import-pending-v1'), false);
});

test('최우선 보완: owner local 저장 실패는 완료 성공과 원격 호출을 모두 차단한다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now);
  await f.runtime.beginCourseRun({ courseRunId: 'local-failure-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'local-failure-run', stopOrdinal: 1, confirmationEventId: 'local-failure-event' });
  const originalSetItem = f.deps.storage.setItem;
  f.deps.storage.setItem = async (key, value) => {
    if (key.includes('course-completions-owner-v1')) throw new Error('disk full');
    return originalSetItem(key, value);
  };
  assert.deepEqual(await f.runtime.completeCourseRun(completion('local-failure-run', clock.now)), {
    status: 'storage_unavailable', sync: { status: 'not_started', submittedSampleCount: 0 },
  });
  assert.deepEqual(f.calls, []);
});

test('최우선 보완: off로 폐기한 pending 표본은 재동의·재시작 뒤에도 다시 등록하지 않는다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now); f.setSampleUnavailable(true);
  await f.runtime.beginCourseRun({ courseRunId: 'off-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'off-run', stopOrdinal: 1, confirmationEventId: 'off-event' });
  await f.runtime.completeCourseRun(completion('off-run', clock.now));
  await f.runtime.retryCourseRunSync({ courseRunId: 'off-run' });
  const beforeOff = f.calls.filter((call) => call === 'sample:off-run').length;
  f.setConsent({ enabled: false, consentEpoch: null, revision: 2, updatedAt: 'off' });
  f.setSampleUnavailable(false);
  const discarded = await f.runtime.retryCourseRunSync({ courseRunId: 'off-run' });
  assert.equal('sampleSync' in discarded ? discarded.sampleSync?.status : null, 'excluded');
  f.setConsent({ enabled: true, consentEpoch: 'epoch-new', revision: 3, updatedAt: 'on' });
  const restarted = createReleaseIdentityPersonalizationRuntime(f.deps);
  await restarted.retryCourseRunSync({ courseRunId: 'off-run' });
  assert.equal(f.calls.filter((call) => call === 'sample:off-run').length, beforeOff);
});

test('최우선 보완: reset은 pending 표본만 폐기하고 방문 기록은 보존한다', async () => {
  const clock = { now: Date.UTC(2026, 8, 7, 12) }; const f = runtimeFixture(() => clock.now); f.setSampleUnavailable(true);
  await f.runtime.beginCourseRun({ courseRunId: 'reset-run' });
  await f.runtime.captureStopPersonalizationEligibility({ courseRunId: 'reset-run', stopOrdinal: 1, confirmationEventId: 'reset-event' });
  await f.runtime.completeCourseRun(completion('reset-run', clock.now));
  await f.runtime.retryCourseRunSync({ courseRunId: 'reset-run' });
  const beforeReset = f.calls.filter((call) => call === 'sample:reset-run').length;
  assert.equal((await f.runtime.resetDwellPersonalization({ requestId: 'reset-request', expectedRevision: 1 })).status, 'reset');
  const retried = await f.runtime.retryCourseRunSync({ courseRunId: 'reset-run' });
  assert.equal('sampleSync' in retried ? retried.sampleSync?.status : null, 'excluded');
  assert.equal(f.calls.filter((call) => call === 'sample:reset-run').length, beforeReset);
  assert.equal((await f.runtime.readDeviceCourseCompletions()).records.length, 1);
  assert.deepEqual(await f.runtime.readPendingCourseRunSyncs(), { status: 'empty', courseRunIds: [] });
});
