import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
import { readPublicDocuments, validPublicDocuments, samePublicDocuments } from './publicDocuments';
import { safeSignupFailure, signupFailureMessage } from './signupFailureModel';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'> & { readDocuments?: () => Promise<ReadSignupConsentDocumentsResultV1> };
const readSignupDocuments = readPublicDocuments;
const emptyForm = () => ({ email: '', password: '', passwordConfirm: '', failure: null as PasswordLoginFailure | null, error: '', touched: {} as Record<string, boolean> });

export function LoginScreen({ navigation, readDocuments = readSignupDocuments }: Props) {
  const { authKind, signIn, signUp } = useAuth();
  const [documents, setDocuments] = useState<readonly SignupConsentDocumentV1[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const openedRef = useRef<Record<string, boolean>>({});
  const documentEpoch = useRef(0);
  const [documentReload, setDocumentReload] = useState(0);
  const resetDocumentConsent = () => { documentEpoch.current++; openedRef.current = {}; setOpened({}); setAccepted({}); };
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const ageConfirmedRef = useRef(false);
  const confirmAge = (value: boolean) => { ageConfirmedRef.current = value; setAgeConfirmed(value); };
  const signupRequest = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [forms, setForms] = useState(() => ({ login: emptyForm(), signup: emptyForm() }));
  const mode = isSignUp ? 'signup' : 'login';
  const { email, password, passwordConfirm, failure: loginFailure, error: formError, touched } = forms[mode];
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const emailRef = useRef<TextInput>(null), passwordRef = useRef<TextInput>(null), passwordConfirmRef = useRef<TextInput>(null);
  const field = (key: 'email' | 'password' | 'passwordConfirm', value: string) => setForms(current => ({ ...current, [mode]: { ...current[mode], [key]: value, touched: { ...current[mode].touched, [key]: true } } }));
  const setEmail = (value: string) => field('email', value);
  const setPassword = (value: string) => field('password', value);
  const setPasswordConfirm = (value: string) => field('passwordConfirm', value);
  const setLoginFailure = (failure: PasswordLoginFailure | null) => setForms(current => ({ ...current, [mode]: { ...current[mode], failure } }));
  const setFormError = (error: string) => setForms(current => ({ ...current, [mode]: { ...current[mode], error } }));
  const clearSecrets = () => setForms(current => ({ login: { ...current.login, password: '', passwordConfirm: '' }, signup: { ...current.signup, password: '', passwordConfirm: '' } }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const attempt = useRef(0);
  const [captchaAttempt, setCaptchaAttempt] = useState<number | null>(null);
  const challengeUrl = resolveCaptchaChallengeUrl(process.env.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL);
  const activeRef = useRef(true);
  const awaitingAccountRef = useRef(false);
  const returnedRef = useRef(false);
  const switchMode = (signup: boolean) => {
    if (submitLock.current || signup === isSignUp) return;
    attempt.current++; setCaptchaAttempt(null); awaitingAccountRef.current = false;
    confirmAge(false);
    setPasswordVisible(false); setPasswordConfirmVisible(false);
    resetDocumentConsent();
    setForms(current => ({ ...current, [mode]: { ...current[mode], password: '', passwordConfirm: '', failure: null, error: '', touched: {} } }));
    setIsSignUp(signup);
  };
  useEffect(() => {
    if (!isSignUp) return;
    let active = true;
    setDocuments([]); resetDocumentConsent();
    void readDocuments().then(result => { if (active) setDocuments(validPublicDocuments(result)); }).catch(() => undefined);
    return () => { active = false; };
  }, [isSignUp, readDocuments, documentReload]);
  const signupReady = ageConfirmed && documents.length === 2 && documents.every(document => opened[document.documentId] && accepted[document.documentId]);
  const openDocument = async (document: SignupConsentDocumentV1) => {
    if (submitLock.current) return;
    const epoch = documentEpoch.current;
    openedRef.current = { ...openedRef.current, [document.documentId]: false };
    setOpened(openedRef.current); setAccepted(value => ({ ...value, [document.documentId]: false }));
    try {
      await Linking.openURL(document.url);
      if (epoch !== documentEpoch.current) return;
      openedRef.current = { ...openedRef.current, [document.documentId]: true }; setOpened(openedRef.current);
    } catch { if (epoch === documentEpoch.current) Alert.alert('안내', '문서를 열지 못했어요. 다시 시도해 주세요.'); }
  };

  useEffect(() => {
    activeRef.current = true;
    const removeFocus = navigation.addListener('focus', () => { activeRef.current = true; });
    const removeBlur = navigation.addListener('blur', () => { clearSecrets(); confirmAge(false); setPasswordVisible(false); setPasswordConfirmVisible(false); activeRef.current = false; attempt.current++; submitLock.current = false; awaitingAccountRef.current = false; setCaptchaAttempt(null); setIsSubmitting(false); });
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
    clearSecrets();
    navigation.goBack();
  }, [authKind, navigation]);

  const cancel = () => {
    clearSecrets();
    confirmAge(false);
    setPasswordVisible(false); setPasswordConfirmVisible(false);
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
      setFormError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (isSignUp) {
      if (!ageConfirmedRef.current || !signupReady || !documents.every(d => openedRef.current[d.documentId])) return;
      if (password !== passwordConfirm) { setFormError('비밀번호가 일치하지 않아요.'); return; }
    }

    submitLock.current = true;
    setLoginFailure(null);
    setFormError('');
    setIsSubmitting(true);
    setCaptchaAttempt(++attempt.current);
  };

  const submitSignup = async (token: string, signupAttempt: number) => {
    awaitingAccountRef.current = true;
    try {
      if (isSignUp) {
        if (!ageConfirmedRef.current || !signupReady || !documents.every(d => openedRef.current[d.documentId])) { awaitingAccountRef.current = false; return; }
        const fresh = validPublicDocuments(await readDocuments());
        if (!activeRef.current || attempt.current !== signupAttempt) return;
        if (!samePublicDocuments(documents, fresh)) {
          awaitingAccountRef.current = false; resetDocumentConsent(); setDocuments(fresh);
          setFormError(fresh.length ? '문서가 변경됐어요. 다시 읽고 동의해 주세요.' : '가입 문서를 확인하지 못했어요. 다시 확인해 주세요.');
          return;
        }
        signupRequest.current ??= uuid.v4();
        const terms = documents.find(d => d.documentId === 'terms-of-service')!;
        const privacy = documents.find(d => d.documentId === 'privacy-policy')!;
        const ready = await signUp({ requestId: signupRequest.current, email: email.trim(), password, captchaToken: token, requiredConsents: { terms: { documentId: terms.documentId, documentVersion: terms.documentVersion, accepted: true }, privacy: { documentId: privacy.documentId, documentVersion: privacy.documentVersion, accepted: true } } });
        if (!activeRef.current || attempt.current !== signupAttempt) return;
        clearSecrets();
        if (!ready) { awaitingAccountRef.current = false; Alert.alert('이메일 확인', '받은 이메일에서 가입을 확인한 뒤 로그인해주세요.'); }
      }
    } catch (error) {
      if (!activeRef.current || attempt.current !== signupAttempt) return;
      awaitingAccountRef.current = false;
      const failure = safeSignupFailure(error);
      if (failure.kind === 'consent') { resetDocumentConsent(); setDocumentReload(value => value + 1); }
      setFormError(signupFailureMessage(failure));
    } finally {
      if (activeRef.current && attempt.current === signupAttempt && !awaitingAccountRef.current) { submitLock.current = false; setIsSubmitting(false); }
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
    if (isSignUp) { await submitSignup(token, authAttempt); return; }
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

  const credentialsReady = Boolean(email.trim() && password);
  const passwordsMatch = Boolean(passwordConfirm) && password === passwordConfirm;
  const signupSubmitReady = credentialsReady && passwordsMatch && signupReady;
  const emailError = touched.email && !email.trim() ? '이메일을 입력해주세요.' : '';
  const passwordError = touched.password && !password ? '비밀번호를 입력해주세요.' : '';
  const passwordConfirmError = isSignUp && touched.passwordConfirm
    ? !passwordConfirm ? '비밀번호를 한 번 더 입력해주세요.' : password !== passwordConfirm ? '비밀번호가 일치하지 않아요.' : ''
    : '';
  const inlineFormError = formError === '이메일과 비밀번호를 입력해주세요.' || formError === '비밀번호가 일치하지 않아요.';

  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}>
      <View style={s.header}>
        <Pressable variant="icon" accessibilityLabel="로그인 취소" testID="login-cancel" style={s.back} onPress={cancel}><Feather name="chevron-left" size={28} color={C.txt} /></Pressable>
        <Text style={s.title}>{isSignUp ? '회원가입' : '로그인'}</Text>
        <View style={s.back} />
      </View>
      <Text testID={isSignUp ? 'auth-signup-heading' : 'auth-login-heading'} style={s.heroTitle}>{isSignUp ? '계정을 만들어요' : '다시 만나서 반가워요'}</Text>
      <Text style={s.copy}>{isSignUp ? '가입해도 현재 기기의 코스와 기록은 그대로 유지돼요.' : '기존 코스와 기록은 그대로 유지돼요.'}</Text>
      <View style={s.card}>
        <View style={s.switchRow}>
          <Pressable testID="login-mode-login" disabled={isSubmitting} accessibilityState={{ selected: !isSignUp }} style={[s.switchButton, !isSignUp && s.switchButtonOn]} onPress={() => switchMode(false)}><Text style={[s.switchText, !isSignUp && s.switchTextOn]}>로그인</Text></Pressable>
          <Pressable testID="login-mode-signup" disabled={isSubmitting} accessibilityState={{ selected: isSignUp }} style={[s.switchButton, isSignUp && s.switchButtonOn]} onPress={() => switchMode(true)}><Text style={[s.switchText, isSignUp && s.switchTextOn]}>회원가입</Text></Pressable>
        </View>
        {isSignUp ? <Text testID="auth-signup-account-section" style={s.groupTitle}>계정 정보</Text> : null}
        <Text style={s.label}>이메일</Text>
        <TextInput ref={emailRef} testID="login-email" value={email} onChangeText={value => { if (!submitLock.current) setEmail(value); }} editable={!isSubmitting} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => passwordRef.current?.focus()} placeholder="name@example.com" placeholderTextColor={C.placeholder} style={[s.input, emailError && s.inputError]} />
        {emailError ? <Text testID="login-email-error" accessibilityRole="alert" style={s.fieldError}>{emailError}</Text> : null}
        <Text style={s.label}>비밀번호</Text>
        <View style={[s.inputShell, passwordError && s.inputError]}><TextInput ref={passwordRef} testID="login-password" value={password} onChangeText={value => { if (!submitLock.current) setPassword(value); }} editable={!isSubmitting} secureTextEntry={!passwordVisible} textContentType={isSignUp ? 'newPassword' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} returnKeyType={isSignUp ? 'next' : 'done'} blurOnSubmit={!isSignUp} onSubmitEditing={() => isSignUp ? passwordConfirmRef.current?.focus() : credentialsReady && void submit()} placeholder="6자 이상" placeholderTextColor={C.placeholder} style={s.inputBare} /><Pressable variant="icon" testID="login-password-visibility" accessibilityLabel={passwordVisible ? '비밀번호 숨기기' : '비밀번호 보기'} style={s.visibility} onPress={() => setPasswordVisible(value => !value)}><Feather name={passwordVisible ? 'eye-off' : 'eye'} size={19} color={C.muted} /></Pressable></View>
        {passwordError ? <Text testID="login-password-error" accessibilityRole="alert" style={s.fieldError}>{passwordError}</Text> : null}
        {isSignUp ? <>
          <Text style={s.label}>비밀번호 확인</Text>
          <View style={[s.inputShell, passwordConfirmError && s.inputError]}><TextInput ref={passwordConfirmRef} testID="signup-password-confirm" value={passwordConfirm} onChangeText={value => { if (!submitLock.current) setPasswordConfirm(value); }} editable={!isSubmitting} secureTextEntry={!passwordConfirmVisible} textContentType="newPassword" autoComplete="new-password" returnKeyType="done" placeholder="비밀번호를 다시 입력" placeholderTextColor={C.placeholder} style={s.inputBare} /><Pressable variant="icon" testID="signup-password-visibility" accessibilityLabel={passwordConfirmVisible ? '비밀번호 확인 숨기기' : '비밀번호 확인 보기'} style={s.visibility} onPress={() => setPasswordConfirmVisible(value => !value)}><Feather name={passwordConfirmVisible ? 'eye-off' : 'eye'} size={19} color={C.muted} /></Pressable></View>
          {passwordConfirmError ? <Text testID="signup-password-confirm-error" accessibilityRole="alert" style={s.fieldError}>{passwordConfirmError}</Text> : passwordsMatch ? <Text testID="signup-password-match" style={s.matchText}>✓ 비밀번호가 일치해요.</Text> : null}
          <Text style={s.groupTitle}>가입 필수 확인</Text>
          <View testID="signup-required-card" style={s.requiredCard}>
            <Pressable testID="signup-age-confirm" disabled={isSubmitting} accessibilityRole="checkbox" accessibilityLabel="[필수] 만 14세 이상입니다" accessibilityState={{ checked: ageConfirmed, disabled: isSubmitting }} style={s.requiredRow} onPress={() => { if (!submitLock.current && activeRef.current) confirmAge(!ageConfirmedRef.current); }}>
              <CheckBox checked={ageConfirmed} /><Text style={s.requiredLabel}>만 14세 이상입니다 <Text style={s.requiredMark}>(필수)</Text></Text>
            </Pressable>
            {documents.length !== 2 ? <View style={s.documentUnavailable}><Text style={s.notice}>회원가입에 필요한 약관과 개인정보 안내를 준비하고 있어요. 지금은 로그인 없이 코스를 이용할 수 있어요.</Text><Pressable testID="signup-documents-retry" disabled={isSubmitting} style={s.retryButton} onPress={() => setDocumentReload(value => value + 1)}><Text style={s.retryText}>문서 다시 확인</Text></Pressable></View> : documents.map(document => <View key={document.documentId}>
              <View style={s.requiredDivider} />
              <View style={s.documentRow}><Pressable testID={`signup-consent-${document.documentId}`} disabled={isSubmitting || !opened[document.documentId]} accessibilityRole="checkbox" accessibilityState={{ checked: accepted[document.documentId] === true, disabled: isSubmitting || !opened[document.documentId] }} style={s.consentPart} onPress={() => { if (!submitLock.current && openedRef.current[document.documentId]) setAccepted(value => ({ ...value, [document.documentId]: !value[document.documentId] })); }}><CheckBox checked={accepted[document.documentId] === true} disabled={!opened[document.documentId]} /><Text style={[s.requiredLabel, !opened[document.documentId] && s.disabledLabel]}>{document.documentId === 'terms-of-service' ? '이용약관 (필수)' : '개인정보처리방침 (필수)'}</Text></Pressable><Pressable testID={`signup-document-${document.documentId}`} disabled={isSubmitting} accessibilityRole="link" style={s.documentLink} onPress={() => openDocument(document)}><Text style={s.documentLinkText}>내용 보기</Text><Feather name="chevron-right" size={17} color={C.accentPress} /></Pressable></View>
            </View>)}
            {documents.length === 2 && documents.some(document => !opened[document.documentId]) ? <Text style={s.requiredHelp}>내용을 확인한 뒤 동의할 수 있어요.</Text> : null}
          </View>
        </> : null}
        {formError && !inlineFormError ? <Text testID="auth-form-error" accessibilityRole="alert" style={s.errorBanner}>{formError}</Text> : null}
        {loginFailure ? <Text testID="login-error" accessibilityRole="alert" style={s.errorBanner}>{passwordLoginFailureMessage(loginFailure)}</Text> : null}
        {loginFailure && captchaDiagnosticsEnabled(process.env.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS) ? <Text testID="login-diagnostic" selectable style={s.notice}>{JSON.stringify(loginFailure)}</Text> : null}
        <Pressable testID="login-submit" busy={isSubmitting} disabled={isSubmitting || (isSignUp ? !signupSubmitReady : !credentialsReady)} style={[s.primary, (isSignUp ? !signupSubmitReady : !credentialsReady) && s.primaryDisabled]} onPress={submit}>
          {isSubmitting ? <View style={s.submitBusy}><ActivityIndicator color={C.onAccent} /><Text style={s.primaryText}>{isSignUp ? '계정 만드는 중…' : '로그인 중…'}</Text></View> : <Text style={s.primaryText}>{isSignUp ? '계정 만들기' : '로그인'}</Text>}
        </Pressable>
      </View>
    </ScrollView>
    {captchaAttempt !== null ? <CaptchaVerificationSheet key={captchaAttempt} visible challengeUrl={challengeUrl} purpose={isSignUp ? 'signup' : 'login'} onClose={() => { if (attempt.current === captchaAttempt) closeCaptcha(); }} onVerified={token => void verifiedCaptcha(token, captchaAttempt)} /> : null}
  </KeyboardAvoidingView>;
}

function CheckBox({ checked, disabled = false }: Readonly<{ checked: boolean; disabled?: boolean }>) {
  return <View style={[s.ageBox, checked && s.ageBoxOn, disabled && s.ageBoxDisabled]}><Text style={s.ageCheck}>{checked ? '✓' : ''}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flexGrow: 1, paddingHorizontal: 22 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.txt, fontSize: 20, fontWeight: '900' },
  heroTitle: { color: C.txt, fontSize: 24, lineHeight: 31, fontWeight: '900', marginTop: 20 },
  copy: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 16 },
  switchRow: { flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 12, padding: 4, marginBottom: 18 },
  switchButton: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  switchButtonOn: { backgroundColor: 'rgba(0,102,255,0.22)' },
  switchText: { color: C.muted, fontSize: 13, fontWeight: '800' },
  switchTextOn: { color: C.txt },
  groupTitle: { color: C.txt, fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 2 },
  label: { color: C.txt2, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 12 },
  input: { minHeight: 52, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, color: C.txt, fontSize: 16 },
  inputShell: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, borderRadius: 12 },
  inputBare: { flex: 1, minHeight: 50, color: C.txt, fontSize: 16, paddingLeft: 14, paddingRight: 4 },
  visibility: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputError: { borderColor: C.red },
  fieldError: { color: C.red, fontSize: 12, lineHeight: 18, marginTop: 6 },
  matchText: { color: C.green, fontSize: 12, lineHeight: 18, marginTop: 6 },
  notice: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  ageBox: { width: 24, height: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  ageBoxOn: { backgroundColor: C.accent, borderColor: C.accent },
  ageBoxDisabled: { opacity: 0.45 },
  ageCheck: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  requiredCard: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, marginTop: 10 },
  requiredRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  requiredLabel: { flex: 1, color: C.txt, fontSize: 13, fontWeight: '700' },
  requiredMark: { color: C.muted, fontWeight: '600' },
  requiredDivider: { height: 1, backgroundColor: C.line },
  documentRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8 },
  consentPart: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  disabledLabel: { color: C.muted },
  documentLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 1, paddingLeft: 6 },
  documentLinkText: { color: C.txt, fontSize: 12, fontWeight: '700' },
  requiredHelp: { color: C.muted, fontSize: 12, lineHeight: 18, paddingBottom: 12 },
  documentUnavailable: { paddingBottom: 14 },
  retryButton: { minHeight: 44, justifyContent: 'center' },
  retryText: { color: C.txt, fontSize: 13, fontWeight: '700' },
  errorBanner: { color: C.txt2, backgroundColor: 'rgba(255,79,79,0.10)', borderWidth: 1, borderColor: C.red, borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 18, marginTop: 14 },
  primary: { minHeight: 52, borderRadius: 12, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  primaryDisabled: { opacity: 0.45 },
  submitBusy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '900' },
});
