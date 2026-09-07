import type { AccountIdentityResolver } from './accountIdentity';

export type AccountProfileV1 = Readonly<{ nickname: string | null; nicknameUpdatedAt: string | null }>;
export type ReadAccountProfileResultV1 =
  | { status: 'ok'; profile: AccountProfileV1 }
  | { status: 'account_required' | 'session_expired' | 'not_found' | 'unavailable' };
export type UpdateAccountNicknameResultV1 =
  | { status: 'updated' | 'unchanged'; profile: AccountProfileV1 }
  | { status: 'invalid_nickname'; reason: 'empty' | 'too_long' | 'invalid_character' }
  | { status: 'account_required' | 'session_expired' | 'forbidden' | 'unavailable' };

type Dependencies = Readonly<{
  identity: AccountIdentityResolver;
  readProfile(subject: string): Promise<AccountProfileV1 | null>;
  updateNickname(nickname: string | null, mutationId: string, subject: string): Promise<AccountProfileV1>;
}>;

function normalizeNickname(value: string | null): { ok: true; value: string | null } | { ok: false; reason: 'empty' | 'too_long' | 'invalid_character' } {
  if (value === null) return { ok: true, value: null };
  if (/\p{Cc}|\p{Cf}|[\r\n\u2028\u2029]/u.test(value)) return { ok: false, reason: 'invalid_character' };
  const normalized = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!normalized) return { ok: false, reason: 'empty' };
  if ([...normalized].length > 20) return { ok: false, reason: 'too_long' };
  return { ok: true, value: normalized };
}

function identityFailure(status: 'account_required' | 'session_expired' | 'unavailable') { return { status } as const; }

export function createAccountProfileRepository(deps: Dependencies) {
  return {
    async readAccountProfile(): Promise<ReadAccountProfileResultV1> {
      const resolved = await deps.identity.resolve();
      if (resolved.status !== 'account') return identityFailure(resolved.status === 'account_required' ? 'account_required' : resolved.status);
      try {
        const profile = await deps.readProfile(resolved.identity.subject);
        return profile ? { status: 'ok', profile } : { status: 'not_found' };
      } catch { return { status: 'unavailable' }; }
    },
    async updateAccountNickname(input: Readonly<{ mutationId: string; nickname: string | null }>): Promise<UpdateAccountNicknameResultV1> {
      if (!input || typeof input.mutationId !== 'string' || !input.mutationId.trim()) return { status: 'forbidden' };
      const nickname = normalizeNickname(input.nickname);
      if (!nickname.ok) return { status: 'invalid_nickname', reason: nickname.reason };
      const resolved = await deps.identity.resolve();
      if (resolved.status !== 'account') return identityFailure(resolved.status === 'account_required' ? 'account_required' : resolved.status);
      try {
        const before = await deps.readProfile(resolved.identity.subject);
        if (!before) return { status: 'unavailable' };
        if (before.nickname === nickname.value) return { status: 'unchanged', profile: before };
        const profile = await deps.updateNickname(nickname.value, input.mutationId, resolved.identity.subject);
        return { status: 'updated', profile };
      } catch { return { status: 'unavailable' }; }
    },
  };
}
