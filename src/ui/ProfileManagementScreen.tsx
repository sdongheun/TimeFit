import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from './nav';
import { useAuth } from './AuthContext';
import { AccountPersonalizationPanel } from './AccountPersonalizationPanel';
import { OwnedDeletionPanel } from './OwnedDeletionPanel';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { resetToProfile } from './mainTabNavigation';
import { C } from './theme';
import { Feather } from '@expo/vector-icons';

export function ProfileManagementScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ProfileManagement'>) {
  const { accountSession, authKind, signOut } = useAuth();
  const subject = authKind === 'account' ? accountSession?.user.id ?? null : null;
  const accountEmail = authKind === 'account' ? accountSession?.user.email?.trim() ?? '' : '';
  const owner = useRef(subject), current = useRef(subject), mounted = useRef(true), lock = useRef(false), returned = useRef(false);
  current.current = subject;
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const insets = useSafeAreaInsets();
  const leave = () => { if (!returned.current) { returned.current = true; resetToProfile(navigation); } };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (authKind !== 'loading' && (subject !== owner.current || !subject)) leave(); }, [subject, authKind, navigation]);
  const logout = async () => {
    if (lock.current || !subject || current.current !== owner.current) return;
    lock.current = true; setBusy(true); setError(false);
    try { await signOut(); if (mounted.current && (current.current === subject || current.current === null)) leave(); }
    catch { if (mounted.current && current.current === subject) setError(true); }
    finally { lock.current = false; if (mounted.current && current.current === subject) setBusy(false); }
  };
  if (!subject || subject !== owner.current) return <View style={s.root} />;
  return <ScrollView style={s.root} contentContainerStyle={{ padding: 22, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}>
    <View style={s.header}><Pressable variant="icon" testID="profile-management-back" accessibilityLabel="내정보로 돌아가기" style={s.back} onPress={() => navigation.goBack()}><Feather name="chevron-left" size={28} color={C.txt} /></Pressable><Text style={s.title}>프로필 관리</Text><View style={s.back} /></View>
    <Text style={s.sectionLabel}>현재 로그인 계정</Text>
    <View style={s.accountCard}><View style={s.accountIcon}><Feather name="mail" size={18} color={C.txt2} /></View><Text testID="profile-account-email" numberOfLines={1} style={s.accountEmail}>{accountEmail || '계정 정보를 확인하고 있어요'}</Text></View>
    <Text style={s.sectionLabel}>닉네임 변경하기</Text>
    <View style={s.editCard}><AccountPersonalizationPanel key={subject} subject={subject} profile /></View>
    <Text style={s.sectionLabel}>계정 관리</Text>
    <View testID="profile-account-danger-card" style={s.dangerCard}><OwnedDeletionPanel key={`delete:${subject}`} subject={subject} account accountLabel="계정 삭제" /></View>
    <Pressable testID="profile-management-logout" style={s.button} disabled={busy} busy={busy} onPress={logout}>{busy ? <ActivityIndicator color={C.txt} /> : <Text style={s.text}>로그아웃하기</Text>}</Pressable>
    {error ? <Text accessibilityRole="alert" style={s.error}>로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</Text> : null}
  </ScrollView>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }, back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, title: { color: C.txt, fontSize: 20, fontWeight: '900', textAlign: 'center' }, sectionLabel: { color: C.txt2, fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 9, paddingHorizontal: 2 }, accountCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 18, marginBottom: 18 }, accountIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.panel2, justifyContent: 'center', alignItems: 'center' }, accountEmail: { flex: 1, color: C.txt, fontSize: 15, fontWeight: '600' }, editCard: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16, marginBottom: 18 }, dangerCard: { backgroundColor: C.bg, borderWidth: 0, borderRadius: 18, padding: 0 }, button: { minHeight: 52, justifyContent: 'center', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.bg, marginTop: 12 }, text: { color: C.txt, fontSize: 16, fontWeight: '600', textAlign: 'center' }, error: { color: C.muted, marginTop: 12, lineHeight: 20 } });
