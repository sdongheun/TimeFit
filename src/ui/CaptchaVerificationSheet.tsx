import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { captchaAllowedOrigins, captchaDiagnosticsEnabled, captchaNavigationFailure, captchaStateFor, firstCaptchaFailure, isTrustedCaptchaMessageSource, parseCaptchaMessage, resolveCaptchaChallengeUrl, type CaptchaFailure, type CaptchaVerificationState } from './captchaVerificationModel';
import { C } from './theme';

type Props = {
  visible: boolean;
  challengeUrl: string | null;
  onVerified: (token: string) => void;
  onClose: () => void;
  purpose?: 'recommendation' | 'login' | 'signup';
};

/** Token은 성공 callback으로 한 번만 넘기며 React state·로그·알림에 보관하지 않는다. */
export function CaptchaVerificationSheet({ visible, challengeUrl, onVerified, onClose, purpose = 'recommendation' }: Props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<CaptchaVerificationState>('idle');
  const [diagnostic, setDiagnostic] = useState<CaptchaFailure | null>(null);
  const [webViewKey, setWebViewKey] = useState(0);
  const firstFailure = useRef<CaptchaFailure | null>(null);
  const terminal = useRef(false);
  const attempt = useRef(0);
  const validChallengeUrl = useMemo(() => resolveCaptchaChallengeUrl(challengeUrl), [challengeUrl]);
  const showDiagnostics = captchaDiagnosticsEnabled(process.env.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS);

  const beginAttempt = (hasValidChallengeUrl: boolean) => {
    terminal.current = !hasValidChallengeUrl;
    attempt.current += 1;
    setWebViewKey(attempt.current);
    const initialFailure = hasValidChallengeUrl ? null : 'invalid_config';
    firstFailure.current = initialFailure;
    setDiagnostic(initialFailure);
  };
  const fail = (failure: CaptchaFailure) => {
    terminal.current = true;
    const first = firstCaptchaFailure(firstFailure.current, failure);
    firstFailure.current = first;
    setDiagnostic(first);
    setState('failed');
  };

  useEffect(() => {
    if (!visible) { terminal.current = true; attempt.current += 1; firstFailure.current = null; setDiagnostic(null); setState('idle'); return; }
    beginAttempt(Boolean(validChallengeUrl));
    setState(validChallengeUrl ? captchaStateFor('open') : 'failed');
    return () => { terminal.current = true; attempt.current += 1; };
  }, [validChallengeUrl, visible]);

  const retry = () => {
    beginAttempt(Boolean(validChallengeUrl));
    if (!validChallengeUrl) { setState('failed'); return; }
    setState(captchaStateFor('retry'));
  };
  const cancel = () => {
    if (attempt.current !== webViewKey || (terminal.current && !firstFailure.current)) return;
    terminal.current = true; attempt.current += 1; setState(captchaStateFor('cancelled')); onClose();
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
    <View style={s.scrim}><View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} accessibilityViewIsModal>
      <View style={s.handle} />
      <Text accessibilityRole="header" style={s.title}>안전 확인 중</Text>
      <Text style={s.copy}>{purpose === 'signup' ? '회원가입을 위해 안전 확인을 완료해 주세요.' : purpose === 'login' ? '로그인을 위해 안전 확인을 완료해 주세요.' : '추천을 시작하기 전에 안전 확인이 필요할 수 있어요.'}</Text>
      {state === 'loading' && validChallengeUrl ? <View testID="captcha-webview-wrap" style={s.webWrap}>
        <WebView
          key={webViewKey}
          testID="captcha-webview"
          source={{ uri: validChallengeUrl }}
          originWhitelist={captchaAllowedOrigins(validChallengeUrl)}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => {
            if (attempt.current !== webViewKey || terminal.current) return false;
            const failure = captchaNavigationFailure(request.url, validChallengeUrl, request.isTopFrame);
            if (failure) { fail(failure); return false; }
            return true;
          }}
          onError={() => { if (attempt.current === webViewKey && !terminal.current) fail('webview_network_error'); }}
          onHttpError={() => { if (attempt.current === webViewKey && !terminal.current) fail('webview_http_error'); }}
          onMessage={(event) => {
            // A later bridge event must not turn a failed attempt into a verified request.
            if (terminal.current || attempt.current !== webViewKey || firstFailure.current) return;
            if (!isTrustedCaptchaMessageSource(event.nativeEvent.url, validChallengeUrl)) { fail('message_source_rejected'); return; }
            const message = parseCaptchaMessage(event.nativeEvent.data);
            if (!message) { fail('message_payload_rejected'); return; }
            if (message.type === 'token') { terminal.current = true; setState(captchaStateFor('token')); onVerified(message.token); return; }
            if (message.type === 'error') { fail('widget_error'); return; }
            cancel();
          }}
        />
      </View> : null}
      {state === 'failed' ? <Text accessibilityRole="alert" testID="captcha-error" style={s.error}>안전 확인에 실패했거나 만료됐어요. 다시 시도해 주세요.</Text> : null}
      {state === 'failed' && showDiagnostics && diagnostic ? <Text testID="captcha-diagnostic" style={s.diagnostic}>CAPTCHA 진단: {diagnostic}</Text> : null}
      {state === 'cancelled' ? <Text accessibilityRole="alert" style={s.error}>안전 확인을 취소했어요.</Text> : null}
      <View style={s.actions}>
        <Pressable accessibilityLabel="안전 확인 닫기" style={s.secondary} onPress={cancel}><Text style={s.secondaryText}>닫기</Text></Pressable>
        {state === 'failed' || state === 'cancelled' ? <Pressable testID="captcha-retry" accessibilityLabel="안전 확인 다시 시도" style={s.primary} onPress={retry}><Text style={s.primaryText}>다시 시도</Text></Pressable> : null}
      </View>
      {state === 'loading' ? <View style={s.loading}><ActivityIndicator color={C.accent} /><Text style={s.loadingText}>확인 화면을 불러오는 중이에요</Text></View> : null}
    </View></View>
  </Modal>;
}

const s = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
  sheet: { minHeight: 300, paddingHorizontal: 22, paddingTop: 12, backgroundColor: C.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: C.line, marginBottom: 22 },
  title: { color: C.txt, fontSize: 20, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 16 },
  webWrap: { height: 160, overflow: 'hidden', borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.bg },
  loading: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 }, loadingText: { color: C.muted, fontSize: 12 },
  error: { color: '#ffb4ab', fontSize: 13, lineHeight: 19, marginTop: 6 }, diagnostic: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { minHeight: 52, flexDirection: 'row', gap: 10, marginTop: 16 }, secondary: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 12 }, secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' }, primary: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
});
