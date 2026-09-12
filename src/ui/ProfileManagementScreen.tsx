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
    <View style={s.header}><Pressable variant="icon" testID="profile-management-back" accessibilityLabel="내정보로 돌아가기" style={s.back} onPress={() => navigation.goBack()}><Feather name="chevron-left" size={28} color={C.txt} /></Pressable><Text style={s.title}>프로필 관리</Text></View>
    <Text style={s.heading}>닉네임 변경하기</Text>
    <AccountPersonalizationPanel key={subject} subject={subject} profile />
    <View style={s.section}><OwnedDeletionPanel key={`delete:${subject}`} subject={subject} account accountLabel="계정 삭제" /></View>
    <Pressable testID="profile-management-logout" style={s.button} disabled={busy} busy={busy} onPress={logout}>{busy ? <ActivityIndicator color={C.txt} /> : <Text style={s.text}>로그아웃하기</Text>}</Pressable>
    {error ? <Text accessibilityRole="alert" style={s.error}>로그아웃하지 못했어요. 연결을 확인하고 다시 시도해주세요.</Text> : null}
  </ScrollView>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }, back: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, title: { color: C.txt, fontSize: 24, fontWeight: '800', flex: 1 }, heading: { color: C.txt, fontSize: 18, fontWeight: '700' }, section: { marginTop: 24 }, button: { minHeight: 52, justifyContent: 'center', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.bg, marginTop: 12 }, text: { color: C.txt, fontSize: 16, fontWeight: '600', textAlign: 'center' }, error: { color: C.muted, marginTop: 12, lineHeight: 20 } });
