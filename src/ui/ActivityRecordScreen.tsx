import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readPlaceFeedback } from '../services/placeFeedback';
import { courseCompletionRepository } from '../services/courseCompletionAsyncStorage';
import { ActivityDonut } from './activity/ActivityDonut';
import { ActivitySummary, loadCompletionHistory } from './activity/activitySummary';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToNearbyBrowse, resetToProfile } from './mainTabNavigation';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { personalizationSession } from './personalizationComposition';
import { AccountRecordsPanel } from './AccountRecordsPanel';
import { loadOwnedCoursePorts } from './ownedCourseLifecycle';
import { LegacyCompletionPanel } from './LegacyCompletionPanel';
import { CompletedPlacesMapButton } from './CompletedPlacesMapButton';
import { monthCompletionPlaces, type CompletedMapPlace } from './activity/completedPlaceMapModel';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityRecord'>;

const EMPTY: ActivitySummary = { completedPlaceCount: 0, completedDwellMin: 0, measuredCount: 0, unmeasuredCount: 0, dwellPresentation: { kind: 'empty' }, categories: [] };

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

export function ActivityRecordScreen({ navigation }: Props) {
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
  const topCategory = summary.categories[0];
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}>
        <Text style={s.h1}>나의 자투리 기록</Text>
        <Text style={s.sub}>{subject ? '로그인한 계정의 기록입니다. 기기의 이전 기록은 자동으로 합치지 않아요.' : '이 기기의 이번 달 완료 기록입니다.'}</Text>
        {subject ? <AccountRecordsPanel key={subject} subject={subject} /> : isLoading ? <View style={s.loading}><ActivityIndicator color={C.accent} /></View> : loadError ? <View style={s.empty}>
          <Text style={s.emptyTitle}>기기 기록을 불러오지 못했어요</Text>
          <Text style={s.emptyCopy}>{loadError === 'storage_corrupt' ? '기존 기록을 덮어쓰지 않았어요. 다시 시도해 주세요.' : '잠시 후 다시 시도해 주세요.'}</Text>
          <Pressable testID="completion-history-retry" style={s.retry} onPress={() => setReloadSequence((value) => value + 1)}><Text style={s.retryText}>다시 시도</Text></Pressable>
        </View> : hasRecords ? <>
          <View style={s.topGrid}>
            <View style={s.insightCard}>
              <Text style={s.cardLabel}>활동 비율</Text>
              <ActivityDonut categories={summary.categories} completedPlaceCount={summary.completedPlaceCount} />
            </View>
            <View style={s.insightCard}>
              <Text style={s.cardLabel}>활용한 시간</Text>
              <Text style={summary.dwellPresentation.kind === 'unmeasured' ? s.unmeasured : s.duration}>{summary.dwellPresentation.kind === 'unmeasured' ? '체류시간 미측정' : formatDuration(summary.completedDwellMin)}</Text>
              <Text style={s.comment}>{summary.dwellPresentation.kind === 'partial' ? `측정 ${summary.measuredCount}곳 · 미측정 ${summary.unmeasuredCount}곳` : summary.dwellPresentation.kind === 'measured' ? `${summary.measuredCount}곳에서 측정했어요.` : '완료 장소는 기록하고 체류시간은 추정하지 않아요.'}</Text>
              <View style={s.rule} />
              <Text style={s.smallLabel}>가장 많이 한 활동</Text>
              <Text numberOfLines={2} style={s.topCategory}>{topCategory?.category}</Text>
            </View>
          </View>
          <View style={s.statsRow}>
            <CompletedPlacesMapButton key={`guest:${accountVersion}`} places={completedPlaces} style={s.stat}><Text style={s.statValue}>{summary.completedPlaceCount}곳</Text><Text style={s.statLabel}>완료한 장소</Text></CompletedPlacesMapButton>
            <View style={s.stat}><Text style={s.statValue}>{summary.categories.length}가지</Text><Text style={s.statLabel}>활동 유형</Text></View>
          </View>
          <View style={s.note}><Text style={s.noteText}>비로그인 상태에서 코스 마치기로 남긴 기록입니다. 이전 방식의 기록은 계정으로 직접 가져올 때 구분해 확인할 수 있어요. 측정하지 않은 체류시간은 합산하지 않습니다.</Text></View>
        </> : <View style={s.empty}>
          <Text style={s.emptyTitle}>아직 완료한 활동이 없어요</Text>
          <Text style={s.emptyCopy}>코스를 마치면 후기 없이도 이 기기에 자투리 기록이 쌓입니다.</Text>
        </View>}
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
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  h1: { color: C.txt, fontSize: 28, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 14, marginTop: 6, marginBottom: 22 },
  loading: { minHeight: 260, justifyContent: 'center', alignItems: 'center' },
  topGrid: { flexDirection: 'row', gap: 10 },
  insightCard: { flex: 1, minHeight: 266, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14 },
  cardLabel: { color: C.muted, fontSize: 12, fontWeight: '900', marginBottom: 14 },
  duration: { color: C.txt, fontSize: 30, fontWeight: '900', lineHeight: 37 },
  unmeasured: { color: C.txt, fontSize: 20, fontWeight: '900', lineHeight: 28 },
  comment: { color: C.green, fontSize: 14, fontWeight: '800', lineHeight: 21, marginTop: 12 },
  rule: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  smallLabel: { color: C.muted, fontSize: 11, fontWeight: '800' },
  topCategory: { color: C.txt2, fontSize: 14, lineHeight: 20, fontWeight: '800', marginTop: 5 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, minHeight: 86, justifyContent: 'center', alignItems: 'center', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14 },
  statValue: { color: C.txt, fontSize: 21, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 12, fontWeight: '800', marginTop: 5 },
  note: { marginTop: 14, paddingHorizontal: 4 },
  noteText: { color: C.muted, fontSize: 12.5, lineHeight: 19 },
  empty: { minHeight: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { color: C.txt, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  retry: { minHeight: 46, minWidth: 128, marginTop: 18, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent },
  retryText: { color: C.onAccent, fontSize: 14, fontWeight: '800' },
});
