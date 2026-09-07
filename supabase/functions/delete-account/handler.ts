// @ts-nocheck
export type DeleteAccountHandlerDependencies = {
  now(): number;
  authenticate(token: string): Promise<{ id: string; isAnonymous: boolean } | null>;
  verifiedClaims(token: string): Promise<{ sub: string; is_anonymous: boolean; iat?: number; amr?: Array<{ method: string; timestamp: number }> } | null>;
  claim(userId: string, requestId: string): Promise<'claimed' | 'same_request' | 'conflict'>;
  deleteStorage(userId: string): Promise<boolean>;
  deleteAuthUser(userId: string): Promise<boolean>;
  countUserRows(userId: string): Promise<number>;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDeleteAccountHandler(deps: DeleteAccountHandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ status: 'rejected', reason: 'invalid_request' }, 405);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ status: 'rejected', reason: 'invalid_request' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !UUID.test((body as any).requestId)) return json({ status: 'rejected', reason: 'invalid_request' }, 400);
    const requestId = (body as any).requestId as string;
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json({ status: 'rejected', reason: 'account_required' }, 401);
    try {
      const user = await deps.authenticate(token);
      if (!user || user.isAnonymous) return json({ status: 'rejected', reason: 'account_required' }, 401);
      const claims = await deps.verifiedClaims(token);
      if (!claims || claims.sub !== user.id || claims.is_anonymous) return json({ status: 'rejected', reason: 'account_required' }, 401);
      const now = deps.now();
      const recentPassword = claims.amr?.some((entry) => entry.method === 'password' && Number.isInteger(entry.timestamp) && entry.timestamp <= now + 60 && now - entry.timestamp <= 600);
      if (!recentPassword) return json({ status: 'reauth_required', method: 'password_sign_in' }, 403);
      const claim = await deps.claim(user.id, requestId);
      if (claim === 'conflict') return json({ status: 'retryable_failure', stage: 'database' }, 409);
      if (!(await deps.deleteStorage(user.id))) return json({ status: 'retryable_failure', stage: 'storage' }, 503);
      if (!(await deps.deleteAuthUser(user.id))) return json({ status: 'retryable_failure', stage: 'auth' }, 503);
      if ((await deps.countUserRows(user.id)) !== 0) return json({ status: 'retryable_failure', stage: 'verification' }, 503);
      return json({ status: 'deleted', requestId, localCleanupRequired: true });
    } catch {
      return json({ status: 'retryable_failure', stage: 'database' }, 503);
    }
  };
}
