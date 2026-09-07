import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { AccountCourseCompletionV1 } from '../services/accountCourseCompletionRepository';
import { C } from './theme';
import { mergeOwnedRecords } from './ownedRecordsModel';
import { GuestImportPanel } from './GuestImportPanel';
import { OwnedDeletionPanel } from './OwnedDeletionPanel';
import { ownedCourseLifecycle } from './ownedCourseLifecycle';
import { CompletedPlacesMapButton } from './CompletedPlacesMapButton';

const productionPorts = () => import('../services/releaseIdentitySupabase');
export function AccountRecordsPanel({ subject, getPorts = productionPorts }: { subject: string; getPorts?: typeof productionPorts }) {
  const [reload, setReload] = useState(0);
  useEffect(() => ownedCourseLifecycle.subscribe(() => setReload(n => n + 1)), []);
  const [state, setState] = useState<{ subject: string; records: readonly (AccountCourseCompletionV1 & { pending?: boolean })[]; loading: boolean; error: boolean }>({ subject, records: [], loading: true, error: false });
  useEffect(() => {
    let active = true;
    setState({ subject, records: [], loading: true, error: false });
    void getPorts().then(async ports => {
      const identity = await ports.supabaseAccountIdentityResolver.resolve();
      if (!active) return;
      if (identity.status !== 'account' || identity.identity.subject !== subject) { setState({ subject, records: [], loading: false, error: true }); return; }
      const local = await ports.readOwnedDeviceCourseCompletions();
      if (!active) return;
      if (local.status !== 'ok' && local.status !== 'empty') { setState({ subject, records: [], loading: false, error: true }); return; }
      setState({ subject, records: mergeOwnedRecords(local.records, []), loading: false, error: false });
      const result = await ports.supabaseAccountCourseCompletionRepository.readAccountCourseCompletions();
      if (active) setState({ subject, records: mergeOwnedRecords(local.records, result.records), loading: false, error: result.status !== 'ok' && result.status !== 'empty' });
    }).catch(() => { if (active) setState(current => ({ ...current, loading: false, error: true })); });
    return () => { active = false; };
  }, [subject, getPorts, reload]);
  if (state.subject !== subject || state.loading) return <ActivityIndicator color={C.accent} />;
  return <View testID="account-completion-history"><Text style={s.title}>내 계정의 방문 기록</Text>{state.error ? <Text style={s.copy}>계정 기록을 확인하지 못했어요. 기기에 저장된 기록은 유지됩니다.</Text> : null}{state.records.length ? state.records.map(record => <View key={record.completionId} style={s.row}><Text style={s.title}>{record.places.map(p => p.title).join(' → ')}</Text><Text style={s.copy}>{new Date(record.completedAtMinute * 60000).toLocaleDateString()} · {record.pending ? '기기에 저장됨 · 동기화 대기' : record.provenance === 'guest_import' ? '직접 가져온 방문 기록' : '코스 완료 기록'}</Text></View>) : <Text style={s.copy}>이 계정에 저장된 방문 기록이 없어요.</Text>}
    {state.records.length ? <CompletedPlacesMapButton key={subject} places={state.records.flatMap(record => [...record.places])} /> : null}
    <GuestImportPanel key={subject} subject={subject} surface="records" getPorts={getPorts} onChanged={() => setReload(n => n + 1)} />
    <OwnedDeletionPanel key={`delete:${subject}`} subject={subject} records={state.records} getPorts={getPorts} onChanged={() => setReload(n => n + 1)} />
  </View>;
}
const s = StyleSheet.create({ title: { color: C.txt, fontSize: 16, fontWeight: '700' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: C.line } });
