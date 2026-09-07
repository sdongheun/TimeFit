import { useEffect, useRef, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { C } from './theme';
import { loadOwnedCoursePorts } from './ownedCourseLifecycle';

export function GuestImportPanel({ subject, surface, onChanged, getPorts = loadOwnedCoursePorts }: { subject: string; surface: 'login' | 'records'; onChanged?: () => void; getPorts?: typeof loadOwnedCoursePorts }) {
  const [ids, setIds] = useState<string[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const scope = useRef(0), lock = useRef(false), pending = useRef<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const version = ++scope.current; setIds([]); setMessage(''); pending.current = null;
    void getPorts().then(async ports => {
      const result = await ports.readGuestCompletionImportSource({ surface });
      if (version === scope.current && result.status === 'available') setIds(result.records.map(record => record.completionId));
    }).catch(() => undefined);
    return () => { scope.current++; };
  }, [subject, surface, getPorts, reload]);
  const act = async (approve: boolean) => {
    if (lock.current) return; lock.current = true; setBusy(true);
    const version = scope.current;
    try {
      const ports = await getPorts();
      const identity = await ports.supabaseAccountIdentityResolver.resolve();
      if (version !== scope.current || identity.status !== 'account' || identity.identity.subject !== subject) return;
      if (!approve) {
        const result = await ports.dismissGuestCompletionImportOffer();
        if (version === scope.current && result.status === 'dismissed') setIds([]);
        return;
      }
      if (!pending.current) {
        const prepared = await ports.approveGuestCompletionImport({ sourceCompletionIds: ids });
        if (version !== scope.current) return;
        if (prepared.status !== 'prepared') { setMessage('가져오기를 준비하지 못했어요. 원본 기록은 유지됩니다.'); return; }
        pending.current = prepared.importId;
      }
      const result = await ports.continueGuestCompletionImport({ importId: pending.current });
      if (version !== scope.current) return;
      if (result.status === 'source_removed') {
        const remaining = await ports.readGuestCompletionImportSource({ surface: 'records' });
        if (version !== scope.current) return;
        setIds(remaining.records.map(record => record.completionId)); pending.current = null;
        setMessage(remaining.records.length ? '일부 기록은 가져오지 못했어요. 남은 원본은 유지됩니다.' : '가져왔어요. 체류 학습에는 사용하지 않습니다.'); onChanged?.();
      } else setMessage('가져오기 결과를 확인하지 못했어요. 원본을 유지하며 같은 요청으로 재시도합니다.');
    } catch { if (version === scope.current) setMessage('연결을 확인한 뒤 다시 시도해주세요.'); }
    finally { lock.current = false; if (version === scope.current) setBusy(false); }
  };
  const body = <View style={{ padding: 20, gap: 12, backgroundColor: C.panel, borderRadius: 16 }}>
    <Text style={{ color: C.txt }}>이 기기의 비로그인·이전 기록 {ids.length}개를 계정으로 가져올까요?</Text>
    <Text style={{ color: C.muted }}>성공한 방문 기록만 옮기며 과거 체류는 학습하지 않습니다.</Text>
    {message ? <Text style={{ color: C.muted }}>{message}</Text> : null}
    <Pressable testID="guest-import-approve" disabled={busy || !ids.length} onPress={() => void act(true)}><Text style={{ color: C.accent, padding: 12 }}>{busy ? '확인 중…' : '가져오기 · 재시도'}</Text></Pressable>
    <Pressable testID="guest-import-dismiss" disabled={busy} onPress={() => void act(false)}><Text style={{ color: C.txt, padding: 12 }}>나중에</Text></Pressable>
  </View>;
  if (surface === 'login') return <Modal transparent visible={ids.length > 0} onRequestClose={() => void act(false)}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' }}>{body}</View></Modal>;
  return ids.length ? body : <Pressable testID="guest-import-refresh" onPress={() => setReload(n => n + 1)}><Text style={{ color: C.muted, paddingVertical: 14 }}>{message || '이 기기의 이전 기록 가져오기 확인'}</Text></Pressable>;
}
