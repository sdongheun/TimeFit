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
import { RecordEmptyState } from './RecordEmptyState';
import type { BusanVisitPlace } from './activity/busanVisitMapModel';
import { buildBusanVisitMap } from './activity/busanVisitMapModel';
import catalog from '../data/busan_poi_catalog.json';

const productionPorts = () => import('../services/releaseIdentitySupabase');
type RecordRow = AccountCourseCompletionV1 & { pending?: boolean };

function formatCompletedAtMinute(completedAtMinute: number) {
  const date = new Date(completedAtMinute * 60000);
  const hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${minute}`;
}

export function AccountRecordsPanel({ subject, getPorts = productionPorts, onCreateCourse, onOpenKakao }: { subject: string; getPorts?: typeof productionPorts; onCreateCourse?: () => void; onOpenKakao?: (place: BusanVisitPlace['source']) => Promise<boolean> }) {
  const [reload, setReload] = useState(0);
  const [openRecord, setOpenRecord] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [districtFilter, setDistrictFilter] = useState<{ district: string; contentIds: string[] } | null>(null);
  const [openingPlaceKey, setOpeningPlaceKey] = useState<string | null>(null);
  const [openFailedPlaceKey, setOpenFailedPlaceKey] = useState<string | null>(null);
  useEffect(() => ownedCourseLifecycle.subscribe(() => setReload(n => n + 1)), []);
  const [state, setState] = useState<{ subject: string; records: readonly RecordRow[]; loading: boolean; error: boolean }>({ subject, records: [], loading: true, error: false });
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
  const categoryFiltered = filterHistory(state.records, selectedCategory);
  const filtered = districtFilter ? categoryFiltered.filter(record => record.places.some(place => districtFilter.contentIds.includes(place.contentId))) : categoryFiltered;
  const summary = useMemo(() => summarizeOwnedRecords(state.records), [state.records]);
  const completedPlaces = useMemo(() => state.records.flatMap(record => [...record.places]), [state.records]);
  useEffect(() => { setCategory(null); setDistrictFilter(null); setOpeningPlaceKey(null); setOpenFailedPlaceKey(null); }, [subject]);
  useEffect(() => { if (category && !categories.includes(category)) setCategory(null); }, [category, state.records]);
  useEffect(() => { if (districtFilter && !state.records.some(record => record.places.some(place => districtFilter.contentIds.includes(place.contentId)))) setDistrictFilter(null); }, [districtFilter, state.records]);
  const openPlace = async (record: RecordRow, place: RecordRow['places'][number]) => {
    if (openingPlaceKey) return;
    const key = `${record.completionId}:${place.contentId}`;
    const source = buildBusanVisitMap([{ contentId: place.contentId, title: place.title }], [...catalog.matched.data, ...catalog.unmatched.data]).placeSummaries[0]?.source;
    if (!source) { setOpenFailedPlaceKey(key); return; }
    setOpeningPlaceKey(key); setOpenFailedPlaceKey(null);
    try { if (!await (onOpenKakao ?? unavailableKakaoOpen)(source)) setOpenFailedPlaceKey(key); }
    catch { setOpenFailedPlaceKey(key); }
    finally { setOpeningPlaceKey(null); }
  };
  if (state.subject !== subject) return <ActivityIndicator color={C.accent} />;
  return <View testID="account-completion-history">
    {state.records.length ? <ActivityStatistics key={`statistics:${subject}`} summary={summary} completedPlaces={completedPlaces} mapKey={`map:${subject}`} periodLabel="방문 요약" scope="현재 조회된 계정 기록 · 반복 방문 포함" onOpenKakao={onOpenKakao ?? unavailableKakaoOpen} showPlaceList={false} onDistrictFilterChange={(value) => { setDistrictFilter(value); setOpenRecord(null); setOpenFailedPlaceKey(null); }} /> : null}
    {state.error ? <Text style={s.copy}>계정 기록을 확인하지 못했어요. 기기에 저장된 기록은 유지됩니다.</Text> : null}
    <OwnedDeletionPanel key={`delete:${subject}`} subject={subject} interactionScope={`${districtFilter?.district ?? 'all'}:${selectedCategory ?? 'all'}`} records={state.records} getPorts={getPorts} onChanged={() => setReload(n => n + 1)}>
      {({ busy, confirm, confirmAll, menu }) => state.records.length ? <View>
        <View testID="history-list-header" style={s.header}><Text style={[s.listTitle, { flex: 1, minWidth: 0 }]}>{districtFilter ? `${districtFilter.district} 기록 ${filtered.length}개` : `방문 기록 ${filtered.length}개`}</Text><Pressable testID="owned-delete-all" accessibilityLabel="모든 방문 기록 삭제" disabled={busy} style={s.deleteAll} onPress={confirmAll}><Text style={{ color: C.muted, fontSize: 13, fontWeight: '700' }}>전체 삭제</Text></Pressable></View>
        <ScrollView horizontal testID="history-filters" showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>{[null, ...categories].map(value => <Pressable key={value ?? 'all'} testID={`history-filter-${value ?? 'all'}`} accessibilityRole="button" accessibilityState={{ selected: value === selectedCategory }} style={[s.filter, value === selectedCategory && { backgroundColor: C.accent, borderColor: C.accent }]} onPress={() => { setCategory(value); setOpenRecord(null); }}><Text style={{ color: C.txt }}>{value ?? '전체'}</Text></Pressable>)}</ScrollView>
        {filtered.length ? filtered.map(record => <HistorySwipeRow key={`${subject}:${record.completionId}:${selectedCategory ?? 'all'}`} id={record.completionId} open={openRecord === record.completionId} busy={busy} onOpen={() => setOpenRecord(record.completionId)} onClose={() => setOpenRecord(current => current === record.completionId ? null : current)} onDelete={() => confirm(record.completionId)} date={formatCompletedAtMinute(record.completedAtMinute)} onMenu={() => { setOpenRecord(null); menu(record.completionId); }}>
        <View style={s.row}>
          <View style={s.recordPlaces}>{record.places.map((place, index) => { const key = `${record.completionId}:${place.contentId}`; return <Pressable key={`${key}:${index}`} testID={`history-place-open-${record.completionId}-${place.contentId}`} accessibilityRole="link" disabled={busy || openingPlaceKey !== null} style={[s.recordPlace, index > 0 && s.recordPlaceDivider]} onPress={() => void openPlace(record, place)}><Text numberOfLines={2} style={s.recordPlaceName}>{place.title}</Text><Text style={s.recordPlaceAction}>{openingPlaceKey === key ? '여는 중' : '카카오맵 ›'}</Text></Pressable>; })}</View>
          {record.places.some(place => openFailedPlaceKey === `${record.completionId}:${place.contentId}`) ? <Text style={s.openError}>카카오맵을 열지 못했어요. 다시 시도해 주세요.</Text> : null}
          {record.pending || record.provenance === 'guest_import' ? <Text style={s.status}>{record.pending ? '기기에 저장됨 · 동기화 대기' : '직접 가져온 방문 기록'}</Text> : null}</View>
      </HistorySwipeRow>) : <Text style={s.filterEmpty}>이 카테고리의 기록이 없어요.</Text>}
      </View> : state.loading ? <View style={s.loading}><ActivityIndicator color={C.accent} /></View> : state.error ? null : <RecordEmptyState onCreateCourse={onCreateCourse} />}
    </OwnedDeletionPanel>
    <GuestImportPanel key={`import:${subject}`} subject={subject} surface="records" getPorts={getPorts} onChanged={() => setReload(n => n + 1)} />
  </View>;
}
const unavailableKakaoOpen = async () => false;
const s = StyleSheet.create({ listTitle: { color: C.txt, fontSize: 19, fontWeight: '900' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, row: { gap: 6 }, recordPlaces: { paddingHorizontal: 2 }, recordPlace: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }, recordPlaceDivider: { borderTopWidth: 1, borderTopColor: C.line }, recordPlaceName: { flex: 1, minWidth: 0, color: C.txt, fontSize: 15, lineHeight: 21, fontWeight: '800' }, recordPlaceAction: { color: C.txt, fontSize: 12, fontWeight: '800', flexShrink: 0 }, openError: { color: C.red, fontSize: 12, lineHeight: 18 }, status: { color: C.muted, fontSize: 12, lineHeight: 18 }, header: { marginTop: 26, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, deleteAll: { minHeight: 44, minWidth: 64, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }, filters: { gap: 8, paddingBottom: 12 }, filter: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: 22, justifyContent: 'center' }, filterEmpty: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingVertical: 28 }, loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' } });
