import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { accountSessionFor, authKindFor, type AuthKind } from './authStateModel';
import { personalizationSession } from './personalizationComposition';
import { liveLearningEvidence } from './liveActivity/learningEvidenceComposition';
import type { SignUpAccountInputV1 } from '../services/accountRegistrationRepository';
import { signInWithFreshCaptcha } from './passwordLoginModel';

type SignUpInput = SignUpAccountInputV1;

type AuthContextValue = {
  /** Route Proxy를 포함한 transport 소비자가 그대로 재사용하는 Supabase raw session. */
  session: Session | null;
  /** Profile·저장·개인화처럼 일반 계정 의미가 필요한 소비자용 session. */
  accountSession: Session | null;
  authKind: AuthKind;
  isLoading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const EMAIL_CONFIRM_REDIRECT_URL = 'timefit://auth/callback';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authVersion = useRef(0);
  const currentSession = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    const initialVersion = authVersion.current;
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
      if (error) console.warn('[인증] 이메일 링크 처리 실패');
    };

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) console.warn('[인증] 세션 조회 실패');
        if (mounted && initialVersion === authVersion.current) {
          currentSession.current = data.session;
          personalizationSession.setAccount(accountSessionFor(data.session, false)?.user.id ?? null);
          setSession(data.session);
          setIsLoading(false);
        }
      })
      .catch((error) => {
        console.warn('[인증] 세션 조회 실패');
        if (mounted) setIsLoading(false);
      });

    Linking.getInitialURL().then(applyAuthLink).catch((error) => {
      console.warn('[인증] 초기 딥링크 처리 실패');
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      applyAuthLink(url).catch(() => console.warn('[인증] 딥링크 처리 실패'));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const previousOwner = accountSessionFor(currentSession.current, false)?.user.id ?? null;
      const nextOwner = accountSessionFor(nextSession, false)?.user.id ?? null;
      if (_event !== 'INITIAL_SESSION' && (previousOwner !== nextOwner || _event === 'SIGNED_OUT' || _event === 'PASSWORD_RECOVERY')) {
        void liveLearningEvidence.clearInvalidatedNative().catch(() => undefined);
      }
      authVersion.current++;
      currentSession.current = nextSession;
      personalizationSession.setAccount(accountSessionFor(nextSession, false)?.user.id ?? null);
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    await signInWithFreshCaptcha(input => supabase.auth.signInWithPassword(input), email, password, captchaToken);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const { supabaseAccountRegistrationRepository } = await import('../services/releaseIdentitySupabase');
    const result = await supabaseAccountRegistrationRepository.signUpAccount(input);
    if (result.status === 'account_session_ready') return true;
    if (result.status === 'email_confirmation_pending') return false;
    throw new Error('가입 정보를 확인할 수 없어요. 잠시 후 다시 시도해주세요.');
  }, []);

  const signOut = useCallback(async () => {
    personalizationSession.setAccount(null);
    const { error } = await supabase.auth.signOut();
    if (error) { personalizationSession.setAccount(accountSessionFor(currentSession.current, false)?.user.id ?? null); throw new Error('로그아웃하지 못했어요. 다시 시도해주세요.'); }
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
