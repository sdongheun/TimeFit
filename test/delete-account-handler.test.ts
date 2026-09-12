import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler';

const token = 'header.payload.signature';
const request = (body: unknown, authorization = `Bearer ${token}`) => new Request('https://fixture.invalid', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function harness(amr: Array<{ method: string; timestamp: number }>, options: { anonymous?: boolean; now?: number; bodyUserRows?: number } = {}) {
  const calls: string[] = []; const now = options.now ?? 1_000_000;
  const handler = createDeleteAccountHandler({
    now: () => now,
    async authenticate() { calls.push('authenticate'); return { id: 'account-a', isAnonymous: options.anonymous ?? false }; },
    async verifiedClaims() { calls.push('claims'); return { sub: 'account-a', is_anonymous: options.anonymous ?? false, iat: now - 1, amr }; },
    async claim() { calls.push('claim'); return 'claimed'; },
    async deleteStorage() { calls.push('storage'); return true; },
    async deleteAuthUser() { calls.push('auth-delete'); return true; },
    async countUserRows() { calls.push('verify'); return options.bodyUserRows ?? 0; },
  });
  return { handler, calls, now };
}

test('DB-RELEASE-IDENTITY B: 서버 검증 password AMR 10분 안에서만 계정을 삭제한다', async () => {
  const h = harness([{ method: 'password', timestamp: 1_000_000 - 599 }]);
  const response = await h.handler(request({ requestId: '11111111-1111-4111-8111-111111111111' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'deleted', requestId: '11111111-1111-4111-8111-111111111111', localCleanupRequired: true });
  assert.deepEqual(h.calls, ['authenticate', 'claims', 'claim', 'storage', 'auth-delete', 'verify']);
});

test('DB-RELEASE-IDENTITY B: 600초 초과·refresh iat·미래 AMR은 재인증으로 인정하지 않는다', async () => {
  for (const amr of [
    [{ method: 'password', timestamp: 1_000_000 - 601 }, { method: 'token_refresh', timestamp: 999_999 }],
    [{ method: 'token_refresh', timestamp: 999_999 }],
    [{ method: 'password', timestamp: 1_000_061 }],
  ]) {
    const h = harness(amr);
    const response = await h.handler(request({ requestId: '11111111-1111-4111-8111-111111111111' }));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { status: 'reauth_required', method: 'password_sign_in' });
    assert.deepEqual(h.calls, ['authenticate', 'claims']);
  }
});

test('DB-RELEASE-IDENTITY B: anonymous·body userId 위조는 삭제 전 거절한다', async () => {
  const anonymous = harness([{ method: 'password', timestamp: 1_000_000 }], { anonymous: true });
  assert.equal((await anonymous.handler(request({ requestId: '11111111-1111-4111-8111-111111111111' }))).status, 401);
  assert.equal(anonymous.calls.includes('auth-delete'), false);
  const forged = harness([{ method: 'password', timestamp: 1_000_000 }]);
  assert.equal((await forged.handler(request({ requestId: '11111111-1111-4111-8111-111111111111', userId: 'victim' }))).status, 400);
  assert.deepEqual(forged.calls, []);
});

test('DB-RELEASE-IDENTITY B: 삭제 뒤 연결행이 남으면 deleted 성공을 반환하지 않는다', async () => {
  const h = harness([{ method: 'password', timestamp: 1_000_000 }], { bodyUserRows: 1 });
  const response = await h.handler(request({ requestId: '11111111-1111-4111-8111-111111111111' }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'retryable_failure', stage: 'verification' });
});

test('DELETE-FIX-04: exactly 600 seconds is accepted without changing password AMR policy', async () => {
  const h = harness([{ method: 'password', timestamp: 1_000_000 - 600 }]);
  assert.equal((await h.handler(request({ requestId: '11111111-1111-4111-8111-111111111111' }))).status, 200);
});

test('DELETE-FIX-04: claim conflict and storage/auth partial failures never run later deletion stages', async () => {
  for (const failure of ['conflict', 'storage', 'auth', 'database'] as const) {
    const calls: string[] = [];
    const handler = createDeleteAccountHandler({
      now: () => 1_000_000,
      async authenticate() { return { id: 'fixture-owner', isAnonymous: false }; },
      async verifiedClaims() { return { sub: 'fixture-owner', is_anonymous: false, amr: [{ method: 'password', timestamp: 1_000_000 }] }; },
      async claim() { calls.push('claim'); if (failure === 'database') throw new Error('SYNTHETIC_PRIVATE'); return failure === 'conflict' ? 'conflict' : 'same_request'; },
      async deleteStorage() { calls.push('storage'); return failure !== 'storage'; },
      async deleteAuthUser() { calls.push('auth'); return failure !== 'auth'; },
      async countUserRows() { calls.push('verify'); return 0; },
    });
    const response = await handler(request({ requestId: '11111111-1111-4111-8111-111111111111' }));
    assert.equal(response.status, failure === 'conflict' ? 409 : 503);
    assert.deepEqual(await response.json(), { status: 'retryable_failure', stage: failure === 'conflict' ? 'database' : failure });
    assert.deepEqual(calls, failure === 'auth' ? ['claim', 'storage', 'auth'] : failure === 'storage' ? ['claim', 'storage'] : ['claim']);
  }
});
