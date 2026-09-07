import assert from 'node:assert/strict';
import test from 'node:test';
import { createDwellPersonalizationRepository } from '../src/services/dwellPersonalizationRepository';
import { createDwellOutbox, createMemoryDwellOutboxStorage } from '../src/services/dwellPersonalizationOutbox';
import { createAccountIdentityResolver } from '../src/services/accountIdentity';

const DAY = 86_400_000;
const identity = createAccountIdentityResolver({
  async getSession() { return { accessToken: 'token', expiresAt: 9_999_999_999 }; },
  async getUser() { return { id: 'account-a', email: null, isAnonymous: false }; },
}, () => 1_000);

test('DB-DWELL-01: 완료 시각은 minute 정밀도이며 미래·180일 만료·동일 ID 다른 payload를 거절한다', async () => {
  const now = Date.UTC(2026, 8, 7, 12, 0); const calls: unknown[] = [];
  const commonRemote = {
    async readConsent() { return { enabled: true, consentEpoch: 'epoch-1', revision: 1, updatedAt: '2026-09-07T00:00:00Z' }; },
    async setConsent() { throw new Error('unused'); }, async reset() { throw new Error('unused'); },
    async readSamples() { return []; },
  };
  const repository = createDwellPersonalizationRepository({
    identity, now: () => now,
    remote: {
      ...commonRemote, async submit(input) { calls.push(input); return { status: 'accepted' as const }; },
    },
  });
  const eligibility = { ownerSubject: 'account-a', consentEpoch: 'epoch-1', consentRevision: 1 };
  const base = { completionEventId: 'run-1:1', courseRunId: 'run-1', stopOrdinal: 1 as const, contentId: 'p1', category: '문화시설', subCategory: '전시', actualDwellMin: 22, completedAt: now - 60_000, runEligibility: eligibility, stopEligibility: eligibility };
  assert.equal((await repository.submitDwellCompletionSample(base)).status, 'accepted');
  assert.equal((calls[0] as { completedAtMinute: number }).completedAtMinute, Math.floor((now - 60_000) / 60_000));
  assert.equal((await repository.submitDwellCompletionSample({ ...base, completedAt: now + 6 * 60_000 })).status, 'invalid_input');
  assert.equal((await repository.submitDwellCompletionSample({ ...base, completedAt: now - 181 * DAY })).status, 'expired');
  const conflictRepo = createDwellPersonalizationRepository({ identity, now: () => now, remote: { ...commonRemote, async submit() { return { status: 'idempotency_conflict' as const }; } } });
  assert.equal((await conflictRepo.submitDwellCompletionSample(base)).status, 'idempotency_conflict');
});

test('DB-DWELL-01: consent reset은 disabled·새 revision이고 이전 epoch submit을 막는다', async () => {
  let consent = { enabled: true, consentEpoch: 'epoch-1' as string | null, revision: 1, updatedAt: 'before' };
  let submits = 0;
  const repository = createDwellPersonalizationRepository({
    identity, now: () => Date.UTC(2026, 8, 7),
    remote: {
      async readConsent() { return consent; }, async setConsent() { return consent; },
      async reset() { consent = { enabled: false, consentEpoch: null, revision: 2, updatedAt: 'after' }; return { consent, deletedSampleCount: 3 }; },
      async submit() { submits += 1; return { status: 'accepted' as const }; }, async readSamples() { return []; },
    },
  });
  assert.equal((await repository.resetDwellPersonalization({ requestId: 'reset-1', expectedRevision: 1 })).status, 'reset');
  const old = { ownerSubject: 'account-a', consentEpoch: 'epoch-1', consentRevision: 1 };
  const result = await repository.submitDwellCompletionSample({ completionEventId: 'old:1', courseRunId: 'old', stopOrdinal: 1, contentId: 'p', category: '카페', subCategory: '카페', actualDwellMin: 20, completedAt: Date.UTC(2026, 8, 6), runEligibility: old, stopEligibility: old });
  assert.deepEqual(result, { status: 'not_eligible', reason: 'consent_off' });
  assert.equal(submits, 0);
});

test('DB-DWELL-01: read는 시간순 SampleV1만 반환하고 off는 빈 배열이다', async () => {
  let enabled = true;
  const repository = createDwellPersonalizationRepository({
    identity, now: () => Date.UTC(2026, 8, 7),
    remote: {
      async readConsent() { return { enabled, consentEpoch: enabled ? 'epoch' : null, revision: 1, updatedAt: 'now' }; },
      async setConsent() { throw new Error('unused'); }, async reset() { throw new Error('unused'); }, async submit() { throw new Error('unused'); },
      async readSamples() { return [{ category: '카페', subCategory: '북카페', dwellMin: 30 }, { category: '카페', subCategory: '북카페', dwellMin: 25 }]; },
    },
  });
  assert.deepEqual(await repository.readDwellPersonalizationSamples(), { status: 'ok', samples: [{ category: '카페', subCategory: '북카페', dwellMin: 30 }, { category: '카페', subCategory: '북카페', dwellMin: 25 }] });
  enabled = false;
  assert.deepEqual(await repository.readDwellPersonalizationSamples(), { status: 'not_enabled', samples: [] });
});

test('DB-DWELL-01: outbox는 32건·7일, 최소 payload, owner/epoch reset 경계를 지킨다', async () => {
  let now = 1_000_000_000;
  const outbox = createDwellOutbox(createMemoryDwellOutboxStorage(), { now: () => now, maxItems: 32, retentionMs: 7 * DAY });
  for (let index = 0; index < 33; index += 1) {
    await outbox.enqueue({ completionEventId: `run-${index}:1`, courseRunId: `run-${index}`, stopOrdinal: 1, contentId: 'p', category: '카페', subCategory: '북카페', actualDwellMin: 20, completedAtMinute: Math.floor(now / 60_000), ownerSubject: 'account-a', consentEpoch: 'epoch-1', consentRevision: 1 });
  }
  assert.equal((await outbox.readEligible({ ownerSubject: 'account-a', consentEpoch: 'epoch-1', consentRevision: 1 })).items.length, 32);
  assert.doesNotMatch(JSON.stringify(await outbox.readEligible({ ownerSubject: 'account-a', consentEpoch: 'epoch-1', consentRevision: 1 })), /title|lat|lon|arrived|departed|geometry/);
  assert.equal((await outbox.readEligible({ ownerSubject: 'account-a', consentEpoch: 'epoch-2', consentRevision: 2 })).items.length, 0);
  now += 7 * DAY + 1;
  assert.equal((await outbox.readEligible({ ownerSubject: 'account-a', consentEpoch: 'epoch-1', consentRevision: 1 })).items.length, 0);
});

test('DB-DWELL-01: outbox는 민감/추가 필드와 손상·저장 실패를 fail closed 처리한다', async () => {
  const item = { completionEventId: 'run:1', courseRunId: 'run', stopOrdinal: 1 as const, contentId: 'p', category: '카페', subCategory: '북카페', actualDwellMin: 20, completedAtMinute: 1, ownerSubject: 'account-a', consentEpoch: 'epoch', consentRevision: 1 };
  const memory = createDwellOutbox(createMemoryDwellOutboxStorage());
  assert.equal((await memory.enqueue({ ...item, latitude: 35 } as typeof item)).status, 'invalid_input');
  const failed = createDwellOutbox({ async read() { throw new Error('storage failed'); }, async write() { throw new Error('storage failed'); } });
  assert.deepEqual(await failed.enqueue(item), { status: 'unavailable' });
  assert.deepEqual(await failed.readEligible({ ownerSubject: 'account-a', consentEpoch: 'epoch', consentRevision: 1 }), { status: 'unavailable', items: [] });
});
