import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readPlaceFeedback } from '../services/placeFeedback';
import { courseCompletionRepository } from '../services/courseCompletionAsyncStorage';
import { ActivityStatistics } from './activity/ActivityStatistics';
import { ActivitySummary, loadCompletionHistory } from './activity/activitySummary';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToNearbyBrowse, resetToProfile } from './mainTabNavigation';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { personalizationSession } from './personalizationComposition';
import { AccountRecordsPanel } from './AccountRecordsPanel';
import { loadOwnedCoursePorts } from './ownedCourseLifecycle';
import { LegacyCompletionPanel } from './LegacyCompletionPanel';
import { monthCompletionPlaces, type CompletedMapPlace } from './activity/completedPlaceMapModel';
import { useAuth } from './AuthContext';
import { useRecordTitle } from './useRecordTitle';
import { RecordEmptyState } from './RecordEmptyState';
import { openCompletedPlaceInKakao } from './activity/openCompletedPlaceInKakao';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityRecord'>;

const EMPTY: ActivitySummary = { completedPlaceCount: 0, completedDwellMin: 0, measuredCount: 0, unmeasuredCount: 0, dwellPresentation: { kind: 'empty' }, categories: [] };

function compactRecordTitle(title: string) {
  if (title === '나의 자투리 기록') return '나의 기록';
  return title.replace(/님의 자투리 기록$/, '님의 기록');
}

export function ActivityRecordScreen({ navigation }: Props) {
  const { accountSession } = useAuth();
  const title = useRecordTitle(accountSession?.user.id ?? null);
  const [accountVersion, setAccountVersion] = useState(personalizationSession.version());
  useEffect(() => personalizationSession.subscribe(() => setAccountVersion(personalizationSession.version())), []);
  const subject = personalizationSession.subject();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<ActivitySummary>(EMPTY);
  const [completedPlaces, setCompletedPlaces] = useState<CompletedMapPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<'storage_unavailable' | 'storage_corrupt' | null>(null);
  const [reloadSequence, setReloadSequence] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsLoading(true);
    setCompletedPlaces([]);
    setLoadError(null);
    if (subject) { setSummary(EMPTY); setIsLoading(false); return () => { active = false; }; }
    void loadCompletionHistory({
      readCompletions: async () => {
        const ports = await loadOwnedCoursePorts();
        const identity = await ports.supabaseAccountIdentityResolver.resolve();
        if (identity.status !== 'account_required') return { status: 'storage_unavailable' as const, records: [] };
        const result = await ports.readOwnedDeviceCourseCompletions();
        if (result.status === 'ok' || result.status === 'empty') {
          if (active) setCompletedPlaces(monthCompletionPlaces(result.records));
          return result;
        }
        if (result.status === 'storage_corrupt') return { status: 'storage_corrupt' as const, records: [] };
        return { status: 'storage_unavailable' as const, records: [] };
      },
      readLegacyFeedback: async () => [],
    })
      .then((result) => {
        if (!active) return;
        if (result.status === 'ready' || result.status === 'empty') setSummary(result.summary);
        else setLoadError(result.status);
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [reloadSequence, subject, accountVersion]));

  const hasRecords = summary.completedPlaceCount > 0;
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}>
        <Text style={s.h1}>{compactRecordTitle(title)}</Text>
        <Text style={s.sub}>다녀온 장소와 코스를 한눈에 확인해 보세요.</Text>
        {subject ? <AccountRecordsPanel key={subject} subject={subject} onCreateCourse={() => resetToMain(navigation)} onOpenKakao={openCompletedPlaceInKakao} /> : isLoading ? <View style={s.loading}><ActivityIndicator color={C.accent} /></View> : loadError ? <View style={s.empty}>
          <Text style={s.emptyTitle}>기기 기록을 불러오지 못했어요</Text>
          <Text style={s.emptyCopy}>{loadError === 'storage_corrupt' ? '기존 기록을 덮어쓰지 않았어요. 다시 시도해 주세요.' : '잠시 후 다시 시도해 주세요.'}</Text>
          <Pressable testID="completion-history-retry" style={s.retry} onPress={() => setReloadSequence((value) => value + 1)}><Text style={s.retryText}>다시 시도</Text></Pressable>
        </View> : hasRecords ? <>
          <ActivityStatistics summary={summary} completedPlaces={completedPlaces} mapKey={`guest:${accountVersion}`} periodLabel="이번 달" scope="이번 달 기기 기록 · 반복 방문 포함" onOpenKakao={openCompletedPlaceInKakao} />
          <View style={s.note}><Text style={s.noteText}>측정하지 않은 체류시간은 합산하지 않아요.</Text></View>
        </> : <RecordEmptyState onCreateCourse={() => resetToMain(navigation)} />}
        {!subject && !isLoading && !loadError ? <LegacyCompletionPanel /> : null}
        <View style={{ height: 112 }} />
      </ScrollView>
      <FloatingTabBar
        active="record"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToNearbyBrowse(navigation)}
        onRecord={() => undefined}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 22, paddingBottom: 32 },
  h1: { color: C.txt, fontSize: 28, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 14, marginTop: 6, marginBottom: 22 },
  loading: { minHeight: 260, justifyContent: 'center', alignItems: 'center' },
  note: { marginTop: 14, paddingHorizontal: 4 },
  noteText: { color: C.muted, fontSize: 12.5, lineHeight: 19 },
  empty: { minHeight: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { color: C.txt, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  retry: { minHeight: 52, minWidth: 128, marginTop: 18, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent },
  retryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
});
