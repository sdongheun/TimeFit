import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useAuth } from './AuthContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToMain, resetToNearbyBrowse } from './mainTabNavigation';
import type { RootStackParamList } from './nav';
import { openProfileSystemSettings, readProfilePermissionSnapshot, type ProfilePermissionSnapshot, type ProfilePermissionState } from './profileSettingsPort';
import { C } from './theme';
import { AccountPersonalizationPanel } from './AccountPersonalizationPanel';
import { OwnedDeletionPanel } from './OwnedDeletionPanel';
import { CValidationRecoveryPanel, cRecoveryInternalEnabled } from './CValidationRecoveryPanel';
import { CValidationPanel } from './CValidationPanel';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const initialPermissions: ProfilePermissionSnapshot = { location: 'unavailable', notification: 'unavailable', liveActivity: 'unavailable' };
const permissionLabels: Record<ProfilePermissionState, string> = {
  granted: '허용됨', denied: '거절됨', undetermined: '아직 결정하지 않음', unavailable: '지원하지 않음', error: '상태를 확인할 수 없음',
};

export function ProfileScreen({ navigation }: Props) {
  const { accountSession, authKind, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState<ProfilePermissionSnapshot>(initialPermissions);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const readSequence = useRef(0);

  const refreshPermissions = useCallback(async () => {
    const sequence = ++readSequence.current;
    setPermissionLoading(true);
    const next = await readProfilePermissionSnapshot();
    if (sequence !== readSequence.current) return;
    setPermissions(next);
    setPermissionLoading(false);
  }, []);

  useEffect(() => {
    void refreshPermissions();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshPermissions(); });
    return () => { readSequence.current += 1; subscription.remove(); };
  }, [refreshPermissions]);

  useEffect(() => { if (authKind !== 'account') setShowManagement(false); }, [authKind]);

  const openSettings = async () => {
    setSettingsError(false);
    try { await openProfileSystemSettings(); } catch { setSettingsError(true); }
  };

  const logout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try { await signOut(); }
    catch (error) { Alert.alert('로그아웃 실패', error instanceof Error ? error.message : '다시 시도해주세요.'); }
    finally { setIsSigningOut(false); }
  };

  const accountContent = authKind === 'loading' ? <View style={s.accountLoading}>
    <ActivityIndicator color={C.accent} /><Text style={s.value}>로그인 상태 확인 중</Text>
  </View> : authKind === 'account' && accountSession ? showManagement ? <>
    <View style={s.inlineHeader}>
      <Pressable variant="icon" accessibilityLabel="내 프로필로 돌아가기" style={s.inlineBack} onPress={() => setShowManagement(false)}><Text style={s.inlineBackText}>‹</Text></Pressable>
      <Text style={s.cardTitle}>프로필 관리</Text>
    </View>
    <Text style={s.itemTitle}>닉네임 설정하기</Text>
    <AccountPersonalizationPanel key={accountSession.user.id} subject={accountSession.user.id} profile />
    <OwnedDeletionPanel key={`delete:${accountSession.user.id}`} subject={accountSession.user.id} account />
    <Pressable busy={isSigningOut} disabled={isSigningOut} style={s.secondaryButton} onPress={logout}>
      {isSigningOut ? <ActivityIndicator color={C.txt} /> : <Text style={s.secondaryButtonText}>로그아웃</Text>}
    </Pressable>
  </> : <>
    <Text style={s.itemTitle}>닉네임 설정하기</Text>
    <Text style={s.value}>프로필 관리에서 닉네임을 설정할 수 있어요.</Text>
    <Pressable testID="profile-manage-entry" style={s.rowButton} onPress={() => setShowManagement(true)}><Text style={s.rowButtonText}>프로필 관리</Text><Text style={s.chevron}>›</Text></Pressable>
  </> : <>
    <Text style={s.itemTitle}>로그인하지 않고 이용 중</Text>
    <Text style={s.value}>권한과 앱 안내는 로그인 없이 확인할 수 있습니다.</Text>
    <Pressable testID="profile-login-entry" style={s.primaryButton} onPress={() => navigation.navigate('Login')}><Text style={s.primaryButtonText}>로그인</Text></Pressable>
  </>;

  return <View style={s.root}>
    <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 124 }]}>
      <Text style={s.h1}>내정보</Text>
      <Text style={s.sub}>계정과 기기 설정을 한곳에서 확인하세요.</Text>
      <Text style={s.sectionLabel}>내 프로필</Text><View style={s.card}>{accountContent}</View>
      <Text style={s.sectionLabel}>권한 및 맞춤 추천</Text>
      <View style={s.card}>
        <PermissionRow title="위치" state={permissions.location} loading={permissionLoading} /><View style={s.divider} />
        <PermissionRow title="알림" state={permissions.notification} loading={permissionLoading} /><View style={s.divider} />
        <PermissionRow title="실시간 현황" state={permissions.liveActivity ?? 'unavailable'} loading={permissionLoading} />
        <Pressable testID="profile-open-settings" style={s.secondaryButton} onPress={openSettings}><Text style={s.secondaryButtonText}>{settingsError ? '설정 열기 다시 시도' : '시스템 설정에서 변경'}</Text></Pressable>
        {settingsError ? <Text accessibilityLiveRegion="polite" style={s.error}>설정을 열지 못했습니다. 다시 시도해주세요.</Text> : null}
        {authKind === 'account' && accountSession ? <AccountPersonalizationPanel key={accountSession.user.id} subject={accountSession.user.id} /> : <Text style={s.value}>로그인하고 별도로 동의하면 체류 기록을 맞춤 추천에 사용할 수 있어요. 실시간 현황과 길찾기는 로그인 없이 이용할 수 있어요.</Text>}
      </View>
      <Text style={s.sectionLabel}>앱 안내</Text>
      <View style={s.card}>
        <InfoRow title="개인정보·위치정보 안내" value="안내 페이지 준비 중" /><View style={s.divider} />
        <InfoRow title="문의하기" value="문의 방법 준비 중" /><View style={s.divider} />
        <InfoRow title="앱 버전" value={appConfig.expo.version} />
      </View>
      <Text style={s.localRecordNotice}>비로그인 기록은 기기에만 저장돼요. 로그인 후 만든 기록은 내 계정에 동기화하며, 이전 기록은 직접 가져올 때만 연결합니다.</Text>
      {cRecoveryInternalEnabled() ? <><CValidationRecoveryPanel /><CValidationPanel /></> : null}
    </ScrollView>
    <FloatingTabBar active="profile" onMain={() => resetToMain(navigation)} onCourse={() => resetToNearbyBrowse(navigation)} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => undefined} />
  </View>;
}

function PermissionRow({ title, state, loading }: Readonly<{ title: string; state: ProfilePermissionState; loading: boolean }>) {
  return <View style={s.infoRow}><Text style={s.itemTitle}>{title}</Text>{loading ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={[s.infoValue, state === 'error' && s.errorText]}>{permissionLabels[state]}</Text>}</View>;
}

function InfoRow({ title, value }: Readonly<{ title: string; value: string }>) {
  return <View style={s.infoRow}><Text style={s.itemTitle}>{title}</Text><Text style={s.infoValue}>{value}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: 22 }, h1: { color: C.txt, fontSize: 30, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 14.5, lineHeight: 21, marginTop: 5, marginBottom: 22 }, sectionLabel: { color: C.txt2, fontSize: 14, fontWeight: '900', marginTop: 10, marginBottom: 9 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 }, cardTitle: { flex: 1, color: C.txt, fontSize: 17, fontWeight: '900' },
  itemTitle: { color: C.txt, fontSize: 15, fontWeight: '800' }, value: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }, accountLoading: { minHeight: 92, justifyContent: 'center', alignItems: 'center', gap: 8 },
  inlineHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, inlineBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12 }, inlineBackText: { color: C.txt, fontSize: 32, lineHeight: 34 },
  rowButton: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: C.line }, rowButtonText: { color: C.txt2, fontSize: 14, fontWeight: '800' }, chevron: { color: C.muted, fontSize: 24 },
  infoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, infoValue: { flexShrink: 1, color: C.muted, fontSize: 13, textAlign: 'right' }, divider: { height: 1, backgroundColor: C.line },
  primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginTop: 16 }, primaryButtonText: { color: C.onAccent, fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: C.line, justifyContent: 'center', alignItems: 'center', marginTop: 14 }, secondaryButtonText: { color: C.txt2, fontSize: 14, fontWeight: '800' },
  error: { color: C.red, fontSize: 12, lineHeight: 18, marginTop: 8 }, errorText: { color: C.red }, localRecordNotice: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 2, paddingHorizontal: 4 },
});
