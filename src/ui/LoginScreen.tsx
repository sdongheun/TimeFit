import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { uuid } from 'expo-modules-core';
import type { SignupConsentDocumentV1, ReadSignupConsentDocumentsResultV1 } from '../services/accountRegistrationRepository';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useAuth } from './AuthContext';
import type { RootStackParamList } from './nav';
import { C } from './theme';
import { CaptchaVerificationSheet } from './CaptchaVerificationSheet';
import { resolveCaptchaChallengeUrl, captchaDiagnosticsEnabled } from './captchaVerificationModel';
import { safePasswordLoginFailure, passwordLoginFailureMessage, type PasswordLoginFailure } from './passwordLoginModel';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'> & { readDocuments?: () => Promise<ReadSignupConsentDocumentsResultV1> };
const readSignupDocuments = async () => (await import('../services/releaseIdentitySupabase')).readSignupConsentDocuments();

export function LoginScreen({ navigation, readDocuments = readSignupDocuments }: Props) {
  const { authKind, signIn, signUp } = useAuth();
  const [documents, setDocuments] = useState<readonly SignupConsentDocumentV1[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const signupRequest = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const attempt = useRef(0);
  const [captchaAttempt, setCaptchaAttempt] = useState<number | null>(null);
  const [loginFailure, setLoginFailure] = useState<PasswordLoginFailure | null>(null);
  const challengeUrl = resolveCaptchaChallengeUrl(process.env.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL);
  const activeRef = useRef(true);
  const awaitingAccountRef = useRef(false);
  const returnedRef = useRef(false);
  useEffect(() => {
    if (!isSignUp) return;
    let active = true;
    setDocuments([]); setAccepted({});
    void readDocuments().then(result => { if (active && result.status === 'ok') setDocuments(result.documents); }).catch(() => undefined);
    return () => { active = false; };
  }, [isSignUp, readDocuments]);
  const signupReady = documents.length === 2 && documents.every(document => accepted[document.documentId]);

  useEffect(() => {
    activeRef.current = true;
    const removeFocus = navigation.addListener('focus', () => { activeRef.current = true; });
    const removeBlur = navigation.addListener('blur', () => { activeRef.current = false; attempt.current++; submitLock.current = false; awaitingAccountRef.current = false; setCaptchaAttempt(null); setIsSubmitting(false); });
    return () => {
      activeRef.current = false;
      attempt.current++;
      removeFocus();
      removeBlur();
    };
  }, [navigation]);

  useEffect(() => {
    if (authKind !== 'account' || !awaitingAccountRef.current || !activeRef.current || returnedRef.current) return;
    returnedRef.current = true;
    navigation.goBack();
  }, [authKind, navigation]);

  const cancel = () => {
    attempt.current++;
    submitLock.current = false;
    setCaptchaAttempt(null);
    activeRef.current = false;
    awaitingAccountRef.current = false;
    navigation.goBack();
  };

  const submit = async () => {
    if (submitLock.current || !activeRef.current) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      Alert.alert('입력 확인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (isSignUp) {
      if (!signupReady) return;
      if (password !== passwordConfirm) { Alert.alert('입력 확인', '비밀번호가 일치하지 않아요.'); return; }
    }

    submitLock.current = true;
    setLoginFailure(null);
    setIsSubmitting(true);
    if (!isSignUp) {
      setCaptchaAttempt(++attempt.current);
      return;
    }
    awaitingAccountRef.current = true;
    try {
      if (isSignUp) {
        signupRequest.current ??= uuid.v4();
        const terms = documents.find(d => d.documentId === 'terms-of-service')!;
        const privacy = documents.find(d => d.documentId === 'privacy-policy')!;
        const ready = await signUp({ requestId: signupRequest.current, email: normalizedEmail, password, requiredConsents: { terms: { documentId: terms.documentId, documentVersion: terms.documentVersion, accepted: true }, privacy: { documentId: privacy.documentId, documentVersion: privacy.documentVersion, accepted: true } } });
        if (!ready) { awaitingAccountRef.current = false; Alert.alert('이메일 확인', '받은 이메일에서 가입을 확인한 뒤 로그인해주세요.'); }
      }
    } catch (error) {
      awaitingAccountRef.current = false;
      if (activeRef.current) Alert.alert(isSignUp ? '회원가입 실패' : '로그인 실패', '입력과 연결 상태를 확인하고 다시 시도해주세요.');
    } finally {
      if (activeRef.current && !awaitingAccountRef.current) { submitLock.current = false; setIsSubmitting(false); }
    }
  };

  const closeCaptcha = () => {
    attempt.current++;
    setCaptchaAttempt(null);
    submitLock.current = false;
    awaitingAccountRef.current = false;
    setIsSubmitting(false);
  };
  const verifiedCaptcha = async (token: string, expected: number) => {
    if (!activeRef.current || !submitLock.current || attempt.current !== expected) return;
    const authAttempt = ++attempt.current;
    setCaptchaAttempt(null);
    awaitingAccountRef.current = true;
    try { await signIn(email.trim(), password, token); }
    catch (error) {
      if (!activeRef.current || attempt.current !== authAttempt) return;
      awaitingAccountRef.current = false;
      submitLock.current = false;
      setIsSubmitting(false);
      setLoginFailure(safePasswordLoginFailure(error, Boolean(token)));
    }
  };

  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}>
      <View style={s.header}>
        <Pressable variant="icon" accessibilityLabel="로그인 취소" testID="login-cancel" style={s.back} onPress={cancel}><Text style={s.backText}>‹</Text></Pressable>
        <Text style={s.title}>{isSignUp ? '회원가입' : '로그인'}</Text>
        <View style={s.back} />
      </View>
      <Text style={s.copy}>로그인해도 현재 기기의 코스 진행과 완료 기록은 그대로 유지됩니다.</Text>
      <View style={s.card}>
        <View style={s.switchRow}>
          <Pressable testID="login-mode-login" disabled={isSubmitting} accessibilityState={{ selected: !isSignUp }} style={[s.switchButton, !isSignUp && s.switchButtonOn]} onPress={() => { if (!submitLock.current) setIsSignUp(false); }}><Text style={[s.switchText, !isSignUp && s.switchTextOn]}>로그인</Text></Pressable>
          <Pressable testID="login-mode-signup" disabled={isSubmitting} accessibilityState={{ selected: isSignUp }} style={[s.switchButton, isSignUp && s.switchButtonOn]} onPress={() => { if (!submitLock.current) setIsSignUp(true); }}><Text style={[s.switchText, isSignUp && s.switchTextOn]}>회원가입</Text></Pressable>
        </View>
        <Text style={s.label}>이메일</Text>
        <TextInput testID="login-email" value={email} onChangeText={value => { if (!submitLock.current) setEmail(value); }} editable={!isSubmitting} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="name@example.com" placeholderTextColor={C.placeholder} style={s.input} />
        <Text style={s.label}>비밀번호</Text>
        <TextInput testID="login-password" value={password} onChangeText={value => { if (!submitLock.current) setPassword(value); }} editable={!isSubmitting} secureTextEntry placeholder="6자 이상" placeholderTextColor={C.placeholder} style={s.input} />
        {isSignUp ? <>
          <Text style={s.label}>비밀번호 확인</Text>
          <TextInput testID="signup-password-confirm" value={passwordConfirm} onChangeText={value => { if (!submitLock.current) setPasswordConfirm(value); }} editable={!isSubmitting} secureTextEntry placeholder="비밀번호를 다시 입력" placeholderTextColor={C.placeholder} style={s.input} />
          {documents.length !== 2 ? <Text style={s.notice}>회원가입에 필요한 약관과 개인정보 안내를 준비하고 있어요. 지금은 로그인 없이 코스를 이용할 수 있어요.</Text> : documents.map(document => <View key={document.documentId}>
            <Pressable testID={`signup-document-${document.documentId}`} onPress={() => { if (document.url.startsWith('https://')) void Linking.openURL(document.url).catch(() => Alert.alert('안내', '문서를 열지 못했어요.')); }}><Text style={s.notice}>{document.documentId === 'terms-of-service' ? '이용약관 읽기' : '개인정보 처리방침 읽기'}</Text></Pressable>
            <Pressable testID={`signup-consent-${document.documentId}`} disabled={isSubmitting} accessibilityRole="checkbox" accessibilityState={{ checked: accepted[document.documentId] === true }} onPress={() => setAccepted(value => ({ ...value, [document.documentId]: !value[document.documentId] }))}><Text style={s.label}>{accepted[document.documentId] ? '☑' : '☐'} 필수 동의</Text></Pressable>
          </View>)}
        </> : null}
        {loginFailure ? <Text testID="login-error" accessibilityRole="alert" style={s.notice}>{passwordLoginFailureMessage(loginFailure)}</Text> : null}
        {loginFailure && captchaDiagnosticsEnabled(process.env.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS) ? <Text testID="login-diagnostic" selectable style={s.notice}>{JSON.stringify(loginFailure)}</Text> : null}
        <Pressable testID="login-submit" busy={isSubmitting} disabled={isSubmitting || (isSignUp && !signupReady)} style={s.primary} onPress={submit}>
          {isSubmitting ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.primaryText}>{isSignUp ? '계정 만들기' : '로그인'}</Text>}
        </Pressable>
      </View>
    </ScrollView>
    {captchaAttempt !== null ? <CaptchaVerificationSheet key={captchaAttempt} visible challengeUrl={challengeUrl} purpose="login" onClose={() => { if (attempt.current === captchaAttempt) closeCaptcha(); }} onVerified={token => void verifiedCaptcha(token, captchaAttempt)} /> : null}
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flexGrow: 1, paddingHorizontal: 22 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.txt, fontSize: 34, lineHeight: 36 },
  title: { color: C.txt, fontSize: 20, fontWeight: '900' },
  copy: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 18, marginBottom: 18 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16 },
  switchRow: { flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 10, padding: 4, marginBottom: 12 },
  switchButton: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  switchButtonOn: { backgroundColor: 'rgba(0,102,255,0.22)' },
  switchText: { color: C.muted, fontSize: 13, fontWeight: '800' },
  switchTextOn: { color: C.txt },
  label: { color: C.txt2, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 12 },
  input: { minHeight: 50, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 13, color: C.txt, fontSize: 16 },
  notice: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  primary: { minHeight: 52, borderRadius: 12, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '900' },
});
