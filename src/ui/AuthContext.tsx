import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { accountSessionFor, authKindFor, type AuthKind } from './authStateModel';

type SignUpInput = {
  email: string;
  password: string;
  birthYear: number;
};

type AuthContextValue = {
  /** Route Proxy를 포함한 transport 소비자가 그대로 재사용하는 Supabase raw session. */
  session: Session | null;
  /** Profile·저장·개인화처럼 일반 계정 의미가 필요한 소비자용 session. */
  accountSession: Session | null;
  authKind: AuthKind;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const EMAIL_CONFIRM_REDIRECT_URL = 'timefit://auth/callback';
// Development defaults to no email confirmation. Set this to true in the release environment.
const emailConfirmationEnabled = process.env.EXPO_PUBLIC_EMAIL_CONFIRMATION_ENABLED === 'true';

function ageBandFor(birthYear: number) {
  const age = new Date().getFullYear() - birthYear;
  if (age < 20) return 'under_20';
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  return '50_plus';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const applyAuthLink = async (url: string | null) => {
      if (!url?.startsWith(EMAIL_CONFIRM_REDIRECT_URL)) return;

      const parsed = new URL(url);
      const query = parsed.searchParams;
      const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
      const code = query.get('code');
      const tokenHash = query.get('token_hash');
      const accessToken = fragment.get('access_token') ?? query.get('access_token');
      const refreshToken = fragment.get('refresh_token') ?? query.get('refresh_token');
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : tokenHash
          ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' })
          : accessToken && refreshToken
            ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            : { error: new Error('인증 정보가 없는 링크입니다.') };
      if (error) console.warn('[인증] 이메일 링크 처리 실패', error.message);
    };

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) console.warn('[인증] 세션 조회 실패', error.message);
        if (mounted) {
          setSession(data.session);
          setIsLoading(false);
        }
      })
      .catch((error) => {
        console.warn('[인증] 세션 조회 실패', error);
        if (mounted) setIsLoading(false);
      });

    Linking.getInitialURL().then(applyAuthLink).catch((error) => {
      console.warn('[인증] 초기 딥링크 처리 실패', error);
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      applyAuthLink(url).catch((error) => console.warn('[인증] 딥링크 처리 실패', error));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password, birthYear }: SignUpInput) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        ...(emailConfirmationEnabled ? { emailRedirectTo: EMAIL_CONFIRM_REDIRECT_URL } : {}),
        data: {
          birth_year: String(birthYear),
          age_band: ageBandFor(birthYear),
          terms_agreed_at: now,
          privacy_agreed_at: now,
        },
      },
    });
    if (error) throw error;
    return Boolean(data.session);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const authKind = authKindFor(session, isLoading);
  const accountSession = accountSessionFor(session, isLoading);
  const value = useMemo<AuthContextValue>(() => ({ session, accountSession, authKind, isLoading, signIn, signUp, signOut }), [session, accountSession, authKind, isLoading, signIn, signUp, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
