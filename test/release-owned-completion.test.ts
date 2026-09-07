import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountIdentityResolver } from '../src/services/accountIdentity';
import { createAccountCourseCompletionRepository, createMemoryOwnerSnapshotStore } from '../src/services/accountCourseCompletionRepository';
import { createGuestCompletionImportRepository, createMemoryGuestImportStore } from '../src/services/guestCompletionImportRepository';
import type { CourseCompletionRecordV1 } from '../src/services/courseCompletionRepository';

const record = (run = 'run-1'): CourseCompletionRecordV1 => ({
  schemaVersion: 1, completionId: `completion-${run}`, courseRunId: run, completedAt: Date.UTC(2026, 8, 7, 12, 34, 56), trigger: 'explicit_course_finish',
  places: [{ contentId: 'place-1', title: '장소', category: '문화시설', subCategory: '전시', plannedStayMin: 30, actualDwellMin: 22 }],
});

function mutableIdentity(initial = 'account-a') {
  let subject = initial;
  const identity = createAccountIdentityResolver({
    async getSession() { return { accessToken: 'token', expiresAt: 9_999_999_999 }; },
    async getUser() { return { id: subject, email: null, isAnonymous: false }; },
  }, () => 1_000);
  return { identity, switchTo(next: string) { subject = next; } };
}

test('DB-RELEASE-IDENTITY B: 생성 당시 owner snapshot과 현재 account가 다르면 원격 완료 write 0회다', async () => {
  const auth = mutableIdentity(); const owners = createMemoryOwnerSnapshotStore(); let writes = 0;
  const repository = createAccountCourseCompletionRepository({
    identity: auth.identity, owners,
    remote: {
      async readGeneration() { return 3; },
      async write() { writes += 1; return { status: 'created' as const }; },
      async read() { return []; }, async deleteOne() { return { status: 'deleted' as const, generation: 3 }; }, async deleteAll() { return { status: 'deleted' as const, generation: 4 }; },
    },
  });
  assert.deepEqual(await repository.captureAccountCompletionOwner('run-1'), { status: 'captured', generation: 3 });
  auth.switchTo('account-b');
  assert.deepEqual(await repository.writeAccountCourseCompletion({ record: record() }), { status: 'owner_changed' });
  assert.equal(writes, 0);
});

test('DB-RELEASE-IDENTITY 보완: 같은 run owner는 반복 캡처·계정 전환으로 덮어쓰지 않는다', async () => {
  const auth = mutableIdentity(); const owners = createMemoryOwnerSnapshotStore(); let generationReads = 0;
  const repository = createAccountCourseCompletionRepository({
    identity: auth.identity, owners,
    remote: {
      async readGeneration() { generationReads += 1; return generationReads; },
      async write() { return { status: 'created' as const }; }, async read() { return []; },
      async deleteOne() { return { status: 'deleted' as const, generation: 1 }; }, async deleteAll() { return { status: 'deleted' as const, generation: 2 }; },
    },
  });
  assert.deepEqual(await repository.captureAccountCompletionOwner('immutable-run'), { status: 'captured', generation: 1 });
  assert.deepEqual(await repository.captureAccountCompletionOwner('immutable-run'), { status: 'captured', generation: 1 });
  auth.switchTo('account-b');
  assert.deepEqual(await repository.captureAccountCompletionOwner('immutable-run'), { status: 'owner_changed' });
  assert.deepEqual(await owners.read('immutable-run'), { courseRunId: 'immutable-run', ownerSubject: 'account-a', generation: 1 });
  assert.equal(generationReads, 1);
});

test('DB-RELEASE-IDENTITY B: account 완료는 minute 정밀도·generation·courseRunId로 멱등 투영한다', async () => {
  const auth = mutableIdentity(); const owners = createMemoryOwnerSnapshotStore(); const writes: unknown[] = [];
  const repository = createAccountCourseCompletionRepository({
    identity: auth.identity, owners,
    remote: {
      async readGeneration() { return 7; },
      async write(input) { writes.push(input); return { status: writes.length === 1 ? 'created' as const : 'already_completed' as const }; },
      async read() { return []; }, async deleteOne() { return { status: 'deleted' as const, generation: 7 }; }, async deleteAll() { return { status: 'deleted' as const, generation: 8 }; },
    },
  });
  await repository.captureAccountCompletionOwner('run-1');
  assert.equal((await repository.writeAccountCourseCompletion({ record: record() })).status, 'created');
  assert.equal((await repository.writeAccountCourseCompletion({ record: record() })).status, 'already_completed');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0], {
    courseRunId: 'run-1', completionId: 'completion-run-1', completedAtMinute: Math.floor(record().completedAt / 60_000), ownerGeneration: 7,
    places: [{ stopOrdinal: 1, contentId: 'place-1', title: '장소', category: '문화시설', subCategory: '전시' }],
  });
  assert.doesNotMatch(JSON.stringify(writes[0]), /actualDwell|plannedStay|latitude|longitude/);
});

test('DB-RELEASE-IDENTITY B: 전체 삭제 generation 뒤 이전 offline 완료는 복원되지 않는다', async () => {
  const auth = mutableIdentity(); const owners = createMemoryOwnerSnapshotStore(); let generation = 1;
  const repository = createAccountCourseCompletionRepository({
    identity: auth.identity, owners,
    remote: {
      async readGeneration() { return generation; },
      async write(input) { return input.ownerGeneration === generation ? { status: 'created' as const } : { status: 'stale_generation' as const }; },
      async read() { return []; }, async deleteOne() { return { status: 'deleted' as const, generation }; }, async deleteAll() { generation += 1; return { status: 'deleted' as const, generation }; },
    },
  });
  await repository.captureAccountCompletionOwner('old-run');
  assert.equal((await repository.deleteAllAccountCourseCompletions({ requestId: 'delete-all' })).status, 'deleted');
  assert.equal((await repository.writeAccountCourseCompletion({ record: record('old-run') })).status, 'stale_generation');
});

test('DB-RELEASE-IDENTITY B: guest import는 ack 전에 source를 지우지 않고 응답 유실을 같은 ID로 복구한다', async () => {
  const auth = mutableIdentity(); const pending = createMemoryGuestImportStore(); const removed: string[][] = []; let attempts = 0;
  const source = { async removeByIds(ids: readonly string[]) { removed.push([...ids]); } };
  const remote = { async import(input: { importId: string }) { attempts += 1; if (attempts === 1) throw new Error('response lost'); return { status: 'already_acknowledged' as const, importId: input.importId, acceptedSourceIds: ['completion-run-1'], rejectedSourceIds: [] }; } };
  const repository = createGuestCompletionImportRepository({ identity: auth.identity, pending, source, remote, createImportId: () => 'import-stable' });
  const prepared = await repository.prepareGuestCompletionImport({ records: [record()] });
  assert.deepEqual(prepared, { status: 'prepared', importId: 'import-stable' });
  assert.deepEqual(await repository.importGuestCourseCompletions({ importId: 'import-stable' }), { status: 'unavailable' });
  assert.equal(removed.length, 0);
  assert.equal((await repository.importGuestCourseCompletions({ importId: 'import-stable' })).status, 'already_acknowledged');
  assert.deepEqual(await repository.finalizeGuestCompletionImport({ importId: 'import-stable' }), { status: 'source_removed' });
  assert.deepEqual(removed, [['completion-run-1']]);
});

test('DB-RELEASE-IDENTITY B: import 준비 뒤 account 전환은 submit/source 삭제를 막는다', async () => {
  const auth = mutableIdentity(); let calls = 0; let removals = 0;
  const repository = createGuestCompletionImportRepository({
    identity: auth.identity, pending: createMemoryGuestImportStore(), createImportId: () => 'import-a',
    source: { async removeByIds() { removals += 1; } },
    remote: { async import() { calls += 1; return { status: 'acknowledged' as const, importId: 'import-a', acceptedSourceIds: [], rejectedSourceIds: [] }; } },
  });
  await repository.prepareGuestCompletionImport({ records: [record()] }); auth.switchTo('account-b');
  assert.deepEqual(await repository.importGuestCourseCompletions({ importId: 'import-a' }), { status: 'account_changed' });
  assert.deepEqual(await repository.finalizeGuestCompletionImport({ importId: 'import-a' }), { status: 'account_changed' });
  assert.deepEqual({ calls, removals }, { calls: 0, removals: 0 });
});
