import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { uuid } from 'expo-modules-core';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useActiveVerifiedCourseFlow } from './AppFlowContext';
import { useAuth } from './AuthContext';
import { loadOwnedCoursePorts } from './ownedCourseLifecycle';
import { liveLearningEvidence } from './liveActivity/learningEvidenceComposition';
import { liveCourseProgressRuntime } from './liveActivity/courseProgressComposition';
import { personalizationSession } from './personalizationComposition';
import { C } from './theme';

export function OwnedDeletionPanel({ subject, account = false, accountLabel, records = [], onChanged, getPorts = loadOwnedCoursePorts, children, interactionScope = '' }: { subject: string; account?: boolean; accountLabel?: string; interactionScope?: string; records?: readonly { completionId: string; courseRunId: string; places?: readonly { title: string }[] }[]; onChanged?: () => void; getPorts?: typeof loadOwnedCoursePorts; children?: (controls: { busy: boolean; confirm(id: string): void; confirmAll(): void; menu(id: string): void }) => ReactNode }) {
  const flow = useActiveVerifiedCourseFlow(), auth = useAuth();
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [password, setPassword] = useState(''), [reauth, setReauth] = useState(false);
  const lock = useRef(false), attempt = useRef<{ key: string; id: string } | null>(null);
  const scope = useRef(0);
  const confirming = useRef(false);
  const menuVersion = useRef(0);
  useEffect(() => { menuVersion.current++; confirming.current = false; return () => { menuVersion.current++; }; }, [subject, interactionScope]);
  const latest = useRef({ flow, subject, auth });
  latest.current = { flow, subject, auth };
  useEffect(() => { scope.current++; confirming.current = false; return () => { scope.current++; }; }, [subject]);
  const perform = async (completionId?: string) => {
    if (lock.current) return;
    const active = flow.activeVerifiedCourse;
    lock.current = true; setBusy(true);
    const version = scope.current;
    const key = account ? 'account' : completionId ?? 'all';
    if (attempt.current?.key !== key) attempt.current = { key, id: uuid.v4() };
    const requestId = attempt.current.id;
    try {
      const ports = await getPorts();
      const ownership = active ? await ports.readOwnedCourseRunOwnership({ courseRunId: active.courseRunId, viewer: { kind: 'account', subject } }) : null;
      if (active && ownership?.status !== 'found' && ownership?.status !== 'not_found') { setMessage('진행 코스의 소유를 확인하지 못했어요. 잠시 후 다시 시도해주세요.'); return; }
      const proof = ownership?.status === 'found' ? ownership.cleanupProof : null;
      const identity = await ports.supabaseAccountIdentityResolver.resolve();
      if (version !== scope.current) return;
      if (identity.status !== 'account' || identity.identity.subject !== subject) { setMessage('계정 상태를 확인하지 못했어요. 삭제 결과를 확인 중입니다.'); return; }
      if (reauth) {
        if (!auth.accountSession?.user.email || !password) return;
        await auth.signIn(auth.accountSession.user.email, password); setPassword('');
        const refreshed = await ports.supabaseAccountIdentityResolver.resolve();
        if (version !== scope.current || refreshed.status !== 'account' || refreshed.identity.subject !== subject) return;
      }
      const result = account ? await ports.deleteOwnedAccount({ requestId }) : completionId ? await ports.deleteOwnedAccountRecord({ completionId, requestId }) : await ports.deleteAllOwnedAccountRecords({ requestId });
      if (version !== scope.current) return;
      if (result.status === 'reauth_required') { setReauth(true); setMessage('계정 삭제를 위해 비밀번호를 다시 확인해주세요.'); return; }
      if (result.status !== 'deleted' && result.status !== 'not_found') {
        if (account) await ports.recheckOwnedAccountDeletion({ requestId });
        setMessage('삭제 결과 확인 중입니다. 같은 요청으로 다시 확인해주세요.'); return;
      }
      personalizationSession.invalidate();
      const canClean = () => ports.canCleanupOwnedCourseRun({ proof, currentSubject: latest.current.subject === subject ? latest.current.auth.accountSession?.user.id ?? null : null, activeCourseRunId: latest.current.flow.activeVerifiedCourse?.courseRunId ?? null });
      if (active && canClean() && (!completionId || records.some(r => r.completionId === completionId && r.courseRunId === active.courseRunId))) {
        void liveLearningEvidence.close(active.courseRunId, 'cancelled').catch(() => undefined);
        await liveCourseProgressRuntime.finish({ courseRunId: active.courseRunId, terminal: 'cancelled', occurredAtMs: Date.now(), eventId: uuid.v4() });
        if (canClean()) latest.current.flow.clearActiveVerifiedCourse(active.identity);
      }
      if ('cleanup' in result && result.cleanup.status !== 'cleaned') { setMessage('서버 삭제는 확인했지만 기기 정리가 남았어요. 다시 확인해주세요.'); return; }
      setMessage('삭제했어요. 다른 계정과 비로그인 기록은 유지됩니다.'); attempt.current = null;
      onChanged?.(); if (account) await auth.signOut();
    } catch { if (version === scope.current) setMessage('삭제 결과를 확인하지 못했어요. 기록을 임의로 지우지 않았습니다.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const confirm = (id?: string) => {
    if (lock.current || confirming.current) return;
    const version = scope.current;
    const interaction = ++menuVersion.current;
    confirming.current = true;
    const description = !account && !id ? '카테고리 필터와 관계없이 이 계정의 모든 방문 기록을 삭제합니다. 되돌릴 수 없습니다.' : [records.find(record => record.completionId === id)?.places?.map(place => place.title).join(' → '), '이 계정의 해당 기록만 삭제됩니다. 되돌릴 수 없습니다.'].filter(Boolean).join('\n');
    Alert.alert(account ? '계정을 삭제할까요?' : '계정 방문 기록을 삭제할까요?', description, [{ text: '취소', style: 'cancel', onPress: () => { if (interaction === menuVersion.current) confirming.current = false; } }, { text: '삭제', style: 'destructive', onPress: () => { if (interaction !== menuVersion.current) return; confirming.current = false; if (version === scope.current && latest.current.subject === subject) void perform(id); } }], { cancelable: true, onDismiss: () => { if (interaction === menuVersion.current) confirming.current = false; } });
  };
  const menu = (id: string) => {
    if (lock.current || confirming.current) return;
    const version = ++menuVersion.current;
    confirming.current = true;
    Alert.alert('방문 기록', undefined, [{ text: '취소', style: 'cancel', onPress: () => { if (version === menuVersion.current) confirming.current = false; } }, { text: '삭제', style: 'destructive', onPress: () => {
      if (version !== menuVersion.current) return;
      confirming.current = false; confirm(id);
    } }], { cancelable: true, onDismiss: () => { if (version === menuVersion.current) confirming.current = false; } });
  };
  return <View>{children?.({ busy, confirm, confirmAll: () => confirm(), menu })}{message ? <Text accessibilityLiveRegion="polite" style={{ color: C.muted, marginVertical: 12 }}>{message}</Text> : null}
    {children && attempt.current && message ? <Pressable testID="owned-delete-retry" disabled={busy} onPress={() => { const key = attempt.current?.key; if (key) confirm(key === 'all' ? undefined : key); }}><Text style={{ color: C.txt, paddingVertical: 12 }}>삭제 결과 다시 확인</Text></Pressable> : null}
    {reauth ? <TextInput testID="delete-account-password" secureTextEntry value={password} onChangeText={setPassword} editable={!busy} placeholder="비밀번호 재확인" placeholderTextColor={C.muted} style={{ color: C.txt, padding: 12 }} /> : null}
    {!children ? <Pressable testID="owned-delete-all" disabled={busy} style={account ? { minHeight: 52, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' } : undefined} onPress={() => confirm()}><Text style={{ color: C.red, paddingVertical: account ? 0 : 16, ...(account ? { fontSize: 16, fontWeight: '600' as const, textAlign: 'center' as const } : {}) }}>{account ? accountLabel ?? '계정 삭제 · 결과 다시 확인' : '내 계정 방문 기록 전체 삭제'}</Text></Pressable> : null}
    {!account && !children ? records.map((record, index) => <Pressable key={record.completionId} testID={`owned-delete-${record.completionId}`} disabled={busy} onPress={() => confirm(record.completionId)}><Text style={{ color: C.muted, paddingVertical: 12 }}>{index + 1}번째 방문 기록 삭제</Text></Pressable>) : null}
  </View>;
}
