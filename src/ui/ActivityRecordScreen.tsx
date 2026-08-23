import { useCallback, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readPlaceFeedback } from '../services/placeFeedback';
import { ActivityDonut } from './activity/ActivityDonut';
import { ActivitySummary, summarizeCompletedActivities } from './activity/activitySummary';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourses, resetToProfile } from './mainTabNavigation';
import { RootStackParamList } from './nav';
import { C } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivityRecord'>;

const EMPTY: ActivitySummary = { completedPlaceCount: 0, completedDwellMin: 0, categories: [] };

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

export function ActivityRecordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<ActivitySummary>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsLoading(true);
    void readPlaceFeedback()
      .then((records) => { if (active) setSummary(summarizeCompletedActivities(records)); })
      .catch(() => { if (active) setSummary(EMPTY); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []));

  const hasRecords = summary.completedPlaceCount > 0;
  const topCategory = summary.categories[0];
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}>
        <Text style={s.h1}>나의 자투리 기록</Text>
        <Text style={s.sub}>이번 달 완료한 활동만 기록합니다.</Text>
        {isLoading ? <View style={s.loading}><ActivityIndicator color={C.accent} /></View> : hasRecords ? <>
          <View style={s.topGrid}>
            <View style={s.insightCard}>
              <Text style={s.cardLabel}>활동 비율</Text>
              <ActivityDonut categories={summary.categories} completedPlaceCount={summary.completedPlaceCount} />
            </View>
            <View style={s.insightCard}>
              <Text style={s.cardLabel}>활용한 시간</Text>
              <Text style={s.duration}>{formatDuration(summary.completedDwellMin)}</Text>
              <Text style={s.comment}>자투리 시간을{`\n`}알차게 채웠어요.</Text>
              <View style={s.rule} />
              <Text style={s.smallLabel}>가장 많이 한 활동</Text>
              <Text numberOfLines={2} style={s.topCategory}>{topCategory?.category}</Text>
            </View>
          </View>
          <View style={s.statsRow}>
            <View style={s.stat}><Text style={s.statValue}>{summary.completedPlaceCount}곳</Text><Text style={s.statLabel}>완료한 장소</Text></View>
            <View style={s.stat}><Text style={s.statValue}>{summary.categories.length}가지</Text><Text style={s.statLabel}>활동 유형</Text></View>
          </View>
          <View style={s.note}><Text style={s.noteText}>완료 뒤 남긴 후기와 체류 시간만 기록에 반영됩니다.</Text></View>
        </> : <View style={s.empty}>
          <Text style={s.emptyTitle}>아직 완료한 활동이 없어요</Text>
          <Text style={s.emptyCopy}>장소를 다녀온 뒤 후기를 남기면 이곳에 나의 자투리 기록이 쌓입니다.</Text>
        </View>}
        <View style={{ height: 112 }} />
      </ScrollView>
      <FloatingTabBar
        active="record"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
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
});
