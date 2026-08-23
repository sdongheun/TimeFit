import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './CommonButtons';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToMain, resetToMyCourses } from './mainTabNavigation';
import { useAuth } from './AuthContext';
import { UI_RADIUS } from './tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { session, isLoading, signIn, signOut, signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      Alert.alert('입력 확인', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (isSignUp) {
      const year = Number(birthYear);
      const currentYear = new Date().getFullYear();
      if (password !== passwordConfirm) {
        Alert.alert('입력 확인', '비밀번호 확인이 일치하지 않습니다.');
        return;
      }
      if (!Number.isInteger(year) || year < 1900 || currentYear - year < 14) {
        Alert.alert('가입 불가', '만 14세 이상만 가입할 수 있습니다. 출생연도를 확인해주세요.');
        return;
      }
      setIsSubmitting(true);
      try {
        const signedIn = await signUp({ email: normalizedEmail, password, birthYear: year });
        Alert.alert(
          signedIn ? '가입 완료' : '인증 메일 발송',
          signedIn ? '테스트 계정으로 로그인되었습니다.' : '이메일 인증을 완료한 뒤 로그인해주세요.',
        );
        if (!signedIn) setIsSignUp(false);
      } catch (error) {
        Alert.alert('회원가입 실패', error instanceof Error ? error.message : '다시 시도해주세요.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(normalizedEmail, password);
    } catch (error) {
      Alert.alert('로그인 실패', error instanceof Error ? error.message : '이메일과 비밀번호를 확인해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    setIsSubmitting(true);
    try {
      await signOut();
    } catch (error) {
      Alert.alert('로그아웃 실패', error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}>
        <Text style={s.h1}>{session ? '내정보' : '로그인'}</Text>
        <Text style={s.sub}>{session ? '테스트 계정이 연결되어 있습니다.' : '저장과 개인화 기능을 사용하려면 로그인하세요.'}</Text>

        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={C.accent} /><Text style={s.value}>로그인 상태 확인 중</Text></View>
        ) : session ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>로그인됨</Text>
            <Text style={s.row}>이메일</Text>
            <Text style={s.email}>{session.user.email ?? '이메일 없음'}</Text>
            <Text style={s.value}>현재는 인증 연결만 테스트합니다. 코스 저장 동기화는 다음 단계에서 연결합니다.</Text>
            <Pressable
              disabled={isSubmitting}
              style={[s.secondaryButton, isSubmitting && s.buttonDisabled]}
              onPress={logout}
              accessibilityRole="button"
              accessibilityLabel="로그아웃"
            >
              <Text style={s.secondaryButtonText}>로그아웃</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.card}>
            <View style={s.switchRow}>
              <Pressable
                style={[s.switchButton, !isSignUp && s.switchButtonOn]}
                onPress={() => setIsSignUp(false)}
                accessibilityRole="tab"
                accessibilityState={{ selected: !isSignUp }}
              >
                <Text style={[s.switchText, !isSignUp && s.switchTextOn]}>로그인</Text>
              </Pressable>
              <Pressable
                style={[s.switchButton, isSignUp && s.switchButtonOn]}
                onPress={() => setIsSignUp(true)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSignUp }}
              >
                <Text style={[s.switchText, isSignUp && s.switchTextOn]}>테스트 회원가입</Text>
              </Pressable>
            </View>
            <Text style={s.label}>이메일</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor={C.muted}
              style={s.input}
            />
            <Text style={s.label}>비밀번호</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="6자 이상"
              placeholderTextColor={C.muted}
              style={s.input}
            />
            {isSignUp && (
              <>
                <Text style={s.label}>비밀번호 확인</Text>
                <TextInput
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  secureTextEntry
                  placeholder="비밀번호를 다시 입력"
                  placeholderTextColor={C.muted}
                  style={s.input}
                />
                <Text style={s.label}>출생연도</Text>
                <TextInput
                  value={birthYear}
                  onChangeText={setBirthYear}
                  keyboardType="number-pad"
                  placeholder="예: 1998"
                  placeholderTextColor={C.muted}
                  style={s.input}
                />
                <Text style={s.notice}>가입하면 이용약관 및 개인정보·개인화 데이터 이용에 동의한 것으로 처리합니다. 현재는 인증 연결 확인용 화면입니다.</Text>
              </>
            )}
            <PrimaryButton
              title={isSignUp ? '테스트 계정 만들기' : '로그인'}
              onPress={submit}
              loading={isSubmitting}
              style={s.submitBtnMargin}
            />
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="profile"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
        onRecord={() => resetToActivityRecord(navigation)}
        onProfile={() => undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 22 },
  h1: { color: C.txt, fontSize: 30, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 5, marginBottom: 18 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 16, marginBottom: 12 },
  cardTitle: { color: C.accent, fontSize: 15, fontWeight: '900', marginBottom: 10 },
  row: { color: C.txt2, fontSize: 13, fontWeight: '800', marginTop: 10 },
  value: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  email: { color: C.txt, fontSize: 16, fontWeight: '800', marginTop: 4 },
  loading: { minHeight: 160, justifyContent: 'center', alignItems: 'center', gap: 10 },
  switchRow: { flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 10, padding: 4, marginBottom: 18 },
  switchButton: { flex: 1, minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 7 },
  switchButtonOn: { backgroundColor: 'rgba(76,194,255,0.16)' },
  switchText: { color: C.muted, fontSize: 13, fontWeight: '800' },
  switchTextOn: { color: C.accent },
  label: { color: C.txt2, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 12 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    borderRadius: UI_RADIUS.control,
    paddingHorizontal: 13,
    color: C.txt,
    fontSize: 15,
  },
  notice: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 14 },
  submitBtnMargin: { marginTop: 20 },
  secondaryButton: {
    minHeight: 46,
    borderRadius: UI_RADIUS.control,
    borderWidth: 1,
    borderColor: C.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  secondaryButtonText: { color: C.txt2, fontSize: 14, fontWeight: '800' },
  buttonDisabled: { opacity: 0.55 },
});
