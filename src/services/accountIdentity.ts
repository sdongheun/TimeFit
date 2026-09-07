export type AccountIdentityV1 = Readonly<{ kind: 'account'; subject: string }>;

export type ResolveAccountIdentityResult =
  | { status: 'account'; identity: AccountIdentityV1; accessToken: string }
  | { status: 'account_required'; reason: 'missing_session' | 'anonymous' }
  | { status: 'session_expired' }
  | { status: 'unavailable' };

export interface AccountAuthPort {
  getSession(): Promise<{ accessToken: string; expiresAt: number } | null>;
  getUser(accessToken: string): Promise<{ id: string; email: string | null; isAnonymous: boolean } | null>;
}

export type SupabaseAccountAuthLike = Readonly<{
  getSession(): Promise<Readonly<{ data: Readonly<{ session: null | Readonly<{ access_token?: unknown; expires_at?: unknown }> }>; error: unknown }>>;
  getUser(accessToken: string): Promise<Readonly<{ data: Readonly<{ user: null | Readonly<{ id?: unknown; email?: unknown; is_anonymous?: unknown }> }>; error: unknown }>>;
}>;

const invalidAuthError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const item = error as { status?: unknown; code?: unknown };
  return item.status === 401 || item.status === 403
    || item.code === 'session_not_found' || item.code === 'user_not_found' || item.code === 'bad_jwt';
};

export function createSupabaseAccountAuthPort(auth: SupabaseAccountAuthLike): AccountAuthPort {
  return {
    async getSession() {
      const { data, error } = await auth.getSession();
      if (error) throw new Error('auth_session_unavailable');
      if (data.session === null) return null;
      return { accessToken: typeof data.session.access_token === 'string' ? data.session.access_token : '', expiresAt: Number(data.session.expires_at) * 1_000 };
    },
    async getUser(accessToken) {
      const { data, error } = await auth.getUser(accessToken);
      if (error) {
        if (invalidAuthError(error)) return null;
        throw new Error('auth_user_unavailable');
      }
      if (!data.user) return null;
      return {
        id: typeof data.user.id === 'string' ? data.user.id : '',
        email: typeof data.user.email === 'string' ? data.user.email : null,
        isAnonymous: data.user.is_anonymous === true,
      };
    },
  };
}

export type AccountIdentityResolver = Readonly<{ resolve(): Promise<ResolveAccountIdentityResult> }>;

export function createAccountIdentityResolver(port: AccountAuthPort, now: () => number = Date.now): AccountIdentityResolver {
  return {
    async resolve() {
      try {
        const session = await port.getSession();
        if (!session) return { status: 'account_required', reason: 'missing_session' };
        if (typeof session.accessToken !== 'string' || !session.accessToken || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) return { status: 'session_expired' };
        const user = await port.getUser(session.accessToken);
        if (!user || typeof user.id !== 'string' || !user.id) return { status: 'session_expired' };
        if (user.isAnonymous) return { status: 'account_required', reason: 'anonymous' };
        return { status: 'account', identity: { kind: 'account', subject: user.id }, accessToken: session.accessToken };
      } catch {
        return { status: 'unavailable' };
      }
    },
  };
}
