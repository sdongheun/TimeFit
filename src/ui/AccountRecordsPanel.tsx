import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AccountCourseCompletionV1 } from '../services/accountCourseCompletionRepository';
import { C } from './theme';
import { mergeOwnedRecords, summarizeOwnedRecords } from './ownedRecordsModel';
import { GuestImportPanel } from './GuestImportPanel';
import { OwnedDeletionPanel } from './OwnedDeletionPanel';
import { ownedCourseLifecycle } from './ownedCourseLifecycle';
import { ActivityStatistics } from './activity/ActivityStatistics';
import { HistorySwipeRow } from './HistorySwipeRow';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { filterHistory, historyCategories } from './historyCategoryFilter';

const productionPorts = () => import('../services/releaseIdentitySupabase');
export function AccountRecordsPanel({ subject, getPorts = productionPorts }: { subject: string; getPorts?: typeof productionPorts }) {
  const [reload, setReload] = useState(0);
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  useEffect(() => ownedCourseLifecycle.subscribe(() => setReload(n => n + 1)), []);
  const [state, setState] = useState<{ subject: string; records: readonly (AccountCourseCompletionV1 & { pending?: boolean })[]; loading: boolean; error: boolean }>({ subject, records: [], loading: true, error: false });
  useEffect(() => {
    let active = true;
    setState(current => ({ subject, records: current.subject === subject ? current.records : [], loading: true, error: false }));
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
  useEffect(() => { setOpenRecord(null); }, [subject, state.records]);
  const categories = historyCategories(state.records);
  const selectedCategory = category && categories.includes(category) ? category : null;
  const filtered = filterHistory(state.records, selectedCategory);
  const summary = useMemo(() => summarizeOwnedRecords(state.records), [state.records]);
  const completedPlaces = useMemo(() => state.records.flatMap(record => [...record.places]), [state.records]);
  useEffect(() => { setCategory(null); }, [subject]);
  useEffect(() => { if (category && !categories.includes(category)) setCategory(null); }, [category, state.records]);
  if (state.subject !== subject) return <ActivityIndicator color={C.accent} />;
  return <View testID="account-completion-history">
    {state.records.length ? <ActivityStatistics key={`statistics:${subject}`} summary={summary} completedPlaces={completedPlaces} mapKey={`map:${subject}`} scope="현재 조회된 계정 기록 · 반복 방문 포함" /> : null}
    {state.error ? <Text style={s.copy}>계정 기록을 확인하지 못했어요. 기기에 저장된 기록은 유지됩니다.</Text> : null}
    <OwnedDeletionPanel key={`delete:${subject}`} subject={subject} interactionScope={selectedCategory ?? 'all'} records={state.records} getPorts={getPorts} onChanged={() => setReload(n => n + 1)}>
      {({ busy, confirm, confirmAll, menu }) => <View>
        <View style={s.header}><Text style={[s.title, { flex: 1, minWidth: 0 }]}>내 계정의 방문 기록</Text><Pressable testID="owned-delete-all" disabled={busy || state.records.length === 0} style={s.deleteAll} onPress={confirmAll}><Text style={{ color: state.records.length ? C.txt : C.muted }}>전체 삭제</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{[null, ...categories].map(value => <Pressable key={value ?? 'all'} testID={`history-filter-${value ?? 'all'}`} accessibilityRole="button" accessibilityState={{ selected: value === selectedCategory }} style={[s.filter, value === selectedCategory && { backgroundColor: C.accent, borderColor: C.accent }]} onPress={() => { setCategory(value); setOpenRecord(null); }}><Text style={{ color: C.txt }}>{value ?? '전체'}</Text></Pressable>)}</ScrollView>
        {filtered.length ? filtered.map(record => <HistorySwipeRow key={`${subject}:${record.completionId}:${selectedCategory ?? 'all'}`} id={record.completionId} open={openRecord === record.completionId} busy={busy} onOpen={() => setOpenRecord(record.completionId)} onClose={() => setOpenRecord(current => current === record.completionId ? null : current)} onDelete={() => confirm(record.completionId)} date={new Date(record.completedAtMinute * 60000).toLocaleDateString()} onMenu={() => { setOpenRecord(null); menu(record.completionId); }}>
        <View style={s.row}><Text style={s.title}>{record.places.map(p => p.title).join(' → ')}</Text>{record.pending || record.provenance === 'guest_import' ? <Text style={s.copy}>{record.pending ? '기기에 저장됨 · 동기화 대기' : '직접 가져온 방문 기록'}</Text> : null}</View>
      </HistorySwipeRow>) : state.loading ? <ActivityIndicator color={C.accent} /> : <Text style={s.copy}>이 계정에 저장된 방문 기록이 없어요.</Text>}
      </View>}
    </OwnedDeletionPanel>
    <GuestImportPanel key={`import:${subject}`} subject={subject} surface="records" getPorts={getPorts} onChanged={() => setReload(n => n + 1)} />
  </View>;
}
const s = StyleSheet.create({ title: { color: C.txt, fontSize: 16, fontWeight: '700' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, row: {}, header: { marginTop: 24, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, deleteAll: { minHeight: 44, minWidth: 64, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }, filters: { gap: 8, paddingBottom: 12 }, filter: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: 14, justifyContent: 'center' } });
