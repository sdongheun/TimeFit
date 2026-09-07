import type { AccountIdentityResolver } from './accountIdentity';

export type DeleteAccountResultV1 =
  | { status: 'deleted'; requestId: string; localCleanupRequired: true }
  | { status: 'reauth_required'; method: 'password_sign_in' }
  | { status: 'rejected'; reason: 'account_required' | 'invalid_request' }
  | { status: 'retryable_failure'; stage: 'storage' | 'database' | 'auth' | 'verification' };
export type RecheckAccountDeletionResultV1 = Readonly<{
  status: 'retry_ready' | 'unknown';
  requestId: string;
  retryWithSameRequestId: true;
}>;

type Dependencies = Readonly<{
  identity: AccountIdentityResolver;
  invoke(accessToken: string, requestId: string): Promise<DeleteAccountResultV1>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAccountDeletionRepository(deps: Dependencies) {
  return {
    async deleteAccount(input: Readonly<{ requestId: string }>): Promise<DeleteAccountResultV1> {
      if (!UUID.test(input?.requestId)) return { status: 'rejected', reason: 'invalid_request' };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'rejected', reason: 'account_required' };
      try { return await deps.invoke(identity.accessToken, input.requestId); }
      catch { return { status: 'retryable_failure', stage: 'database' }; }
    },
    async recheckAccountDeletion(input: Readonly<{ requestId: string }>): Promise<RecheckAccountDeletionResultV1 | { status: 'rejected'; reason: 'invalid_request' }> {
      if (!UUID.test(input?.requestId)) return { status: 'rejected', reason: 'invalid_request' };
      const identity = await deps.identity.resolve();
      if (identity.status === 'account') return { status: 'retry_ready', requestId: input.requestId, retryWithSameRequestId: true };
      return { status: 'unknown', requestId: input.requestId, retryWithSameRequestId: true };
    },
  };
}
