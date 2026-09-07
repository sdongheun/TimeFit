import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAccountIdentityResolver,
  type AccountAuthPort,
} from '../src/services/accountIdentity';
import { createAccountRegistrationRepository } from '../src/services/accountRegistrationRepository';
import { createAccountProfileRepository } from '../src/services/accountProfileRepository';
import { createAccountDeletionRepository } from '../src/services/accountDeletionRepository';

const account = (subject = 'account-a') => ({ id: subject, email: `${subject}@example.invalid`, isAnonymous: false });

function authPort(user = account(), expiresAt = 10_000): AccountAuthPort {
  return {
    async getSession() { return { accessToken: 'verified-token', expiresAt }; },
    async getUser() { return user; },
  };
}

test('DB-RELEASE-IDENTITY B: identity는 anonymous·만료를 account로 승격하지 않는다', async () => {
  assert.equal((await createAccountIdentityResolver(authPort(), () => 1_000).resolve()).status, 'account');
  assert.deepEqual(await createAccountIdentityResolver(authPort({ ...account(), isAnonymous: true }), () => 1_000).resolve(), { status: 'account_required', reason: 'anonymous' });
  assert.deepEqual(await createAccountIdentityResolver(authPort(account(), 999), () => 1_000).resolve(), { status: 'session_expired' });
});

test('DB-RELEASE-IDENTITY B: 가입은 exact registry·명시 동의만 받고 나이 metadata를 보내지 않는다', async () => {
  const calls: unknown[] = [];
  const repository = createAccountRegistrationRepository({
    async readDocuments() {
      return [
        { documentId: 'terms-of-service', documentVersion: '2026-09', url: 'https://policy.example.invalid/terms' },
        { documentId: 'privacy-policy', documentVersion: '2026-09', url: 'https://policy.example.invalid/privacy' },
      ];
    },
    async signUp(input) { calls.push(input); return { sessionReady: false }; },
  });
  const consent = (documentId: 'terms-of-service' | 'privacy-policy') => ({ documentId, documentVersion: '2026-09', accepted: true as const });
  assert.deepEqual(await repository.readSignupConsentDocuments(), {
    status: 'ok',
    documents: [
      { documentId: 'terms-of-service', documentVersion: '2026-09', url: 'https://policy.example.invalid/terms' },
      { documentId: 'privacy-policy', documentVersion: '2026-09', url: 'https://policy.example.invalid/privacy' },
    ],
  });
  assert.deepEqual(await repository.signUpAccount({
    requestId: '11111111-1111-4111-8111-111111111111', email: 'new@example.invalid', password: 'fixture-password',
    requiredConsents: { terms: consent('terms-of-service'), privacy: consent('privacy-policy') },
  }), { status: 'email_confirmation_pending' });
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(calls[0]), /birth|age_band|agreed_at/);

  const stale = await repository.signUpAccount({
    requestId: '22222222-2222-4222-8222-222222222222', email: 'new@example.invalid', password: 'fixture-password',
    requiredConsents: { terms: { ...consent('terms-of-service'), documentVersion: 'old' }, privacy: consent('privacy-policy') },
  });
  assert.deepEqual(stale, { status: 'rejected', reason: 'document_version_stale' });
  assert.equal(calls.length, 1);
});

test('DB-RELEASE-IDENTITY B: 공개 문서 registry가 비면 가입 호출은 0회다', async () => {
  let calls = 0;
  const repository = createAccountRegistrationRepository({ async readDocuments() { return []; }, async signUp() { calls += 1; return { sessionReady: true }; } });
  const result = await repository.signUpAccount({
    requestId: '11111111-1111-4111-8111-111111111111', email: 'new@example.invalid', password: 'fixture-password',
    requiredConsents: {
      terms: { documentId: 'terms-of-service', documentVersion: 'fixture', accepted: true },
      privacy: { documentId: 'privacy-policy', documentVersion: 'fixture', accepted: true },
    },
  });
  assert.deepEqual(result, { status: 'rejected', reason: 'signup_unavailable' });
  assert.deepEqual(await repository.readSignupConsentDocuments(), { status: 'not_configured', documents: [] });
  assert.equal(calls, 0);
});

test('DB-RELEASE-IDENTITY B: nickname은 선택·중복 허용이며 trim 뒤 1/20/21 code point 경계를 지킨다', async () => {
  const updates: Array<string | null> = [];
  let current: string | null = null;
  const repository = createAccountProfileRepository({
    identity: createAccountIdentityResolver(authPort(), () => 1_000),
    async readProfile() { return { nickname: current, nicknameUpdatedAt: null }; },
    async updateNickname(nickname) { current = nickname; updates.push(nickname); return { nickname, nicknameUpdatedAt: '2026-09-07T00:00:00Z' }; },
  });
  assert.equal((await repository.updateAccountNickname({ mutationId: 'm-1', nickname: '' })).status, 'invalid_nickname');
  assert.equal((await repository.updateAccountNickname({ mutationId: 'm-2', nickname: ' 가 ' })).status, 'updated');
  assert.equal(updates.at(-1), '가');
  assert.equal((await repository.updateAccountNickname({ mutationId: 'm-3', nickname: '😀'.repeat(20) })).status, 'updated');
  assert.equal((await repository.updateAccountNickname({ mutationId: 'm-4', nickname: '😀'.repeat(21) })).status, 'invalid_nickname');
  assert.equal((await repository.updateAccountNickname({ mutationId: 'm-5', nickname: 'a\nb' })).status, 'invalid_nickname');
  assert.equal((await repository.updateAccountNickname({ mutationId: 'm-6', nickname: null })).status, 'updated');
});

test('DB-RELEASE-IDENTITY 보완: 삭제 응답 유실은 deleted로 합성하지 않고 동일 requestId 재시도를 지시한다', async () => {
  let unavailable = false;
  const port = authPort();
  const identity = createAccountIdentityResolver({
    async getSession() { return unavailable ? null : port.getSession(); },
    async getUser(token) { return port.getUser(token); },
  }, () => 1_000);
  const repository = createAccountDeletionRepository({ identity, async invoke() { throw new Error('response_lost'); } });
  const requestId = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(await repository.deleteAccount({ requestId }), { status: 'retryable_failure', stage: 'database' });
  assert.deepEqual(await repository.recheckAccountDeletion({ requestId }), { status: 'retry_ready', requestId, retryWithSameRequestId: true });
  unavailable = true;
  assert.deepEqual(await repository.recheckAccountDeletion({ requestId }), { status: 'unknown', requestId, retryWithSameRequestId: true });
});
