export type AuthKind = 'loading' | 'guest' | 'account';

export type AuthSessionShape = Readonly<{
  user: Readonly<{
    id: string;
    email?: string | null;
    is_anonymous?: boolean;
  }>;
}>;

export type ProfileAuthProjection =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'guest' }>
  | Readonly<{ kind: 'account'; email: string | null }>;

export const ACCOUNT_SESSION_REQUIRED_MESSAGE = '저장과 개인화 기능을 사용하려면 일반 계정으로 로그인해 주세요.';

export class AccountSessionRequiredError extends Error {
  readonly reason = 'account_session_required' as const;

  constructor() {
    super(ACCOUNT_SESSION_REQUIRED_MESSAGE);
    this.name = 'AccountSessionRequiredError';
  }
}

/** 이메일 유무가 아니라 Supabase anonymous 표식을 계정 기능의 단일 판정 기준으로 사용한다. */
export function authKindFor(session: AuthSessionShape | null, isLoading: boolean): AuthKind {
  if (isLoading) return 'loading';
  if (!session || session.user.is_anonymous === true) return 'guest';
  return 'account';
}

export function accountSessionFor<Session extends AuthSessionShape>(session: Session | null, isLoading: boolean): Session | null {
  return authKindFor(session, isLoading) === 'account' ? session : null;
}

export function requireAccountSession<Session extends AuthSessionShape>(session: Session | null, isLoading: boolean): Session {
  const accountSession = accountSessionFor(session, isLoading);
  if (!accountSession) throw new AccountSessionRequiredError();
  return accountSession;
}

export function profileAuthProjection(session: AuthSessionShape | null, isLoading: boolean): ProfileAuthProjection {
  const kind = authKindFor(session, isLoading);
  if (kind === 'loading') return { kind };
  if (kind === 'guest') return { kind };
  return { kind, email: session?.user.email ?? null };
}
