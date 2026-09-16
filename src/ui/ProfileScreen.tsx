import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { readPublicDocuments, validPublicDocuments, SUPPORT_URL } from './publicDocuments';
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
import { CValidationRecoveryPanel, cRecoveryInternalEnabled } from './CValidationRecoveryPanel';
import { CValidationPanel } from './CValidationPanel';
import { useRecordTitle } from './useRecordTitle';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'> & { readDocuments?: typeof readPublicDocuments };

const initialPermissions: ProfilePermissionSnapshot = { notification: 'unavailable', liveActivity: 'unavailable' };
const BUSAN_MAP_SOURCE_URL = 'https://commons.wikimedia.org/wiki/File:Busan_districts.svg';
const BUSAN_MAP_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0/';
const permissionLabels: Record<ProfilePermissionState, string> = {
  granted: '허용됨', denied: '거절됨', undetermined: '아직 결정하지 않음', unavailable: '지원하지 않음', error: '상태를 확인할 수 없음',
};

export function ProfileScreen({ navigation, readDocuments = readPublicDocuments }: Props) {
  const { accountSession, authKind } = useAuth();
  const accountSubject = authKind === 'account' ? accountSession?.user.id ?? null : null;
  const profileTitle = useRecordTitle(accountSubject);
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState<ProfilePermissionSnapshot>(initialPermissions);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(false);
  const [documentError, setDocumentError] = useState(false);
  const documentLock = useRef(false);
  const openExternalUrl = async (url: string) => {
    if (documentLock.current) return;
    documentLock.current = true; setDocumentError(false);
    try { await Linking.openURL(url); }
    catch { setDocumentError(true); }
    finally { documentLock.current = false; }
  };
  const openDocument = async (id: 'privacy-policy' | 'terms-of-service' | 'support') => {
    if (documentLock.current) return;
    documentLock.current = true; setDocumentError(false);
    try {
      const url = id === 'support' ? SUPPORT_URL : validPublicDocuments(await readDocuments()).find(d => d.documentId === id)?.url;
      if (!url) throw Error('document_unavailable');
      await Linking.openURL(url);
    } catch { setDocumentError(true); }
    finally { documentLock.current = false; }
  };
  const showMapAttribution = () => Alert.alert('지도 출처 및 이용조건', '부산 구·군 경계\n원작자 Kurykh · Wikimedia Commons\nCC BY-SA 3.0\n색상과 입체 표현을 수정했습니다.', [
    { text: '닫기', style: 'cancel' },
    { text: '원본 보기', onPress: () => openExternalUrl(BUSAN_MAP_SOURCE_URL) },
    { text: '이용조건 보기', onPress: () => openExternalUrl(BUSAN_MAP_LICENSE_URL) },
  ]);
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


  const openSettings = async () => {
    setSettingsError(false);
    try { await openProfileSystemSettings(); } catch { setSettingsError(true); }
  };

  const accountContent = authKind === 'loading' ? <View style={s.accountLoading}>
    <ActivityIndicator color={C.accent} /><Text style={s.value}>로그인 상태 확인 중</Text>
  </View> : authKind === 'account' && accountSession ? <>
    <Pressable testID="profile-manage-entry" accessibilityLabel={`${profileTitle}, 프로필 및 계정 관리`} style={s.accountRow} onPress={() => navigation.navigate('ProfileManagement')}>
      <Icon name="user" />
      <View style={s.accountCopy}><Text style={s.accountTitle}>{profileTitle}</Text><Text style={s.accountSubtitle}>프로필 및 계정 관리</Text></View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
    <Text style={s.accountNotice}>기존 기기 기록은 직접 가져올 때만 계정에 연결돼요.</Text>
  </> : <>
    <View style={s.accountIntro}><Icon name="user" /><View style={s.accountCopy}><Text style={s.accountTitle}>로그인하고 기록을 이어가세요</Text><Text style={s.accountSubtitle}>체류 기록에 동의하면 쌓인 기록으로 맞춤 추천을 받을 수 있어요.</Text></View></View>
    <Pressable testID="profile-login-entry" style={s.primaryButton} onPress={() => navigation.navigate('Login')}><Text style={s.primaryButtonText}>로그인</Text></Pressable>
    <Text style={s.accountNotice}>이 기기의 기록은 이 기기에만 저장돼요.</Text>
  </>;

  return <View style={s.root}>
    <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 124 }]}>
      <Text style={s.h1}>내정보</Text>
      <Text style={s.sectionLabel}>내 프로필</Text><View testID="profile-account-card" style={[s.card, s.accountCard]}>{accountContent}</View>
      <Text style={s.sectionLabel}>권한 및 맞춤 추천</Text>
      <View style={[s.card, s.listCard]}>
        <PermissionRow testID="profile-permission-notification" icon="bell" title="알림" state={permissions.notification} loading={permissionLoading} /><View style={s.insetDivider} />
        <PermissionRow testID="profile-permission-live-activity" icon="activity" title="실시간 현황" state={permissions.liveActivity ?? 'unavailable'} loading={permissionLoading} /><View style={s.insetDivider} />
        <View testID="profile-settings-row"><Pressable testID="profile-open-settings" style={s.infoRow} onPress={openSettings}><Icon name="settings" /><Text style={s.itemTitle}>{settingsError ? '설정 열기 다시 시도' : '시스템 설정 열기'}</Text><Text style={s.chevron}>›</Text></Pressable></View>
        {settingsError ? <Text accessibilityLiveRegion="polite" style={s.inlineError}>설정을 열지 못했습니다. 다시 시도해 주세요.</Text> : null}
        <View style={s.fullDivider} />
        {authKind === 'account' && accountSession ? <View testID="profile-personalization-region" style={s.personalization}><AccountPersonalizationPanel key={accountSession.user.id} subject={accountSession.user.id} compact /></View> : <View style={s.guestCapability}><Text style={s.guestCapabilityTitle}>로그인 없이도 이용할 수 있어요</Text><Text style={s.guestCapabilityCopy}>알림, 실시간 현황, 길찾기는 계정 없이 작동해요.</Text></View>}
      </View>
      <Text style={s.sectionLabel}>앱 안내</Text>
      <View style={[s.card, s.listCard]}>
        {(['privacy-policy', 'terms-of-service', 'support'] as const).map((id, index) => <View key={id}><Pressable testID={`profile-document-${id}`} accessibilityRole="link" style={s.infoRow} onPress={() => openDocument(id)}><Icon name={id === 'privacy-policy' ? 'shield' : id === 'terms-of-service' ? 'file-text' : 'help-circle'} /><Text style={s.itemTitle}>{id === 'privacy-policy' ? '개인정보처리방침' : id === 'terms-of-service' ? '이용약관' : '지원 안내'}</Text><Text style={s.chevron}>›</Text></Pressable>{index < 2 ? <View style={s.insetDivider} /> : null}</View>)}
        <View style={s.insetDivider} /><Pressable testID="profile-map-attribution" accessibilityRole="button" accessibilityLabel="지도 출처 및 이용조건 확인" style={s.infoRow} onPress={showMapAttribution}><Icon name="map" /><Text style={s.itemTitle}>지도 출처 및 이용조건</Text><Text style={s.chevron}>›</Text></Pressable>
        {documentError ? <Text accessibilityRole="alert" style={s.inlineError}>문서를 열지 못했어요. 연결을 확인하고 다시 눌러 주세요.</Text> : null}
        <View style={s.insetDivider} /><InfoRow icon="info" title="앱 버전" value={appConfig.expo.version} />
      </View>
      {cRecoveryInternalEnabled() ? <><CValidationRecoveryPanel /><CValidationPanel /></> : null}
    </ScrollView>
    <FloatingTabBar active="profile" onMain={() => resetToMain(navigation)} onCourse={() => resetToNearbyBrowse(navigation)} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => undefined} />
  </View>;
}

function Icon({ name }: Readonly<{ name: ComponentProps<typeof Feather>['name'] }>) {
  return <View style={s.icon}><Feather name={name} size={18} color={C.txt2} /></View>;
}

function PermissionRow({ testID, icon, title, state, loading }: Readonly<{ testID: string; icon: ComponentProps<typeof Feather>['name']; title: string; state: ProfilePermissionState; loading: boolean }>) {
  const active = state === 'granted';
  return <View testID={testID} style={s.infoRow}><Icon name={icon} /><Text style={s.itemTitle}>{title}</Text>{loading ? <ActivityIndicator size="small" color={C.accent} /> : <View style={[s.statusPill, active && s.statusPillActive, state === 'error' && s.statusPillError]}><Text style={[s.statusText, active && s.statusTextActive, state === 'error' && s.errorText]}>{permissionLabels[state]}</Text></View>}</View>;
}

function InfoRow({ icon, title, value }: Readonly<{ icon: ComponentProps<typeof Feather>['name']; title: string; value: string }>) {
  return <View style={s.infoRow}><Icon name={icon} /><Text style={s.itemTitle}>{title}</Text><Text style={s.infoValue}>{value}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: 22 }, h1: { color: C.txt, fontSize: 30, fontWeight: '900', marginBottom: 22 },
  sectionLabel: { color: C.txt2, fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 9, paddingHorizontal: 2 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 18, marginBottom: 18, overflow: 'hidden' }, accountCard: { padding: 16 }, listCard: { paddingHorizontal: 16 },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, accountRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, accountCopy: { flex: 1 }, accountTitle: { color: C.txt, fontSize: 16, lineHeight: 22, fontWeight: '800' }, accountSubtitle: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }, accountNotice: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 13 },
  itemTitle: { flex: 1, color: C.txt, fontSize: 15, fontWeight: '700' }, value: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }, accountLoading: { minHeight: 92, justifyContent: 'center', alignItems: 'center', gap: 8 },
  chevron: { color: C.muted, fontSize: 25, lineHeight: 28 },
  infoRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }, infoValue: { flexShrink: 1, color: C.muted, fontSize: 13, textAlign: 'right' }, insetDivider: { height: 1, backgroundColor: C.line, marginLeft: 46 }, fullDivider: { height: 1, backgroundColor: C.line },
  statusPill: { maxWidth: '47%', backgroundColor: C.panel2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, statusPillActive: { backgroundColor: 'rgba(0,102,255,0.16)' }, statusPillError: { backgroundColor: 'rgba(255,79,79,0.12)' }, statusText: { color: C.txt2, fontSize: 12, fontWeight: '700', textAlign: 'right' }, statusTextActive: { color: C.accentPress },
  primaryButton: { minHeight: 52, borderRadius: 12, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', marginTop: 16 }, primaryButtonText: { color: C.onAccent, fontSize: 16, fontWeight: '900' },
  inlineError: { color: C.red, fontSize: 12, lineHeight: 18, paddingBottom: 12, paddingLeft: 46 }, errorText: { color: C.red }, personalization: { paddingVertical: 16 }, guestCapability: { paddingVertical: 15 }, guestCapabilityTitle: { color: C.txt, fontSize: 14, fontWeight: '700' }, guestCapabilityCopy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
});
