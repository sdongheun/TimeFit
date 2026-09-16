import { View, Text, StyleSheet } from 'react-native';
import type { ActivitySummary } from './activitySummary';
import type { CompletedMapPlace } from './completedPlaceMapModel';
import { C } from '../theme';
import { BusanVisitVectorMap } from './BusanVisitVectorMap';
import type { BusanVisitPlace } from './busanVisitMapModel';

export function ActivityStatistics({ summary, completedPlaces, mapKey, periodLabel = '방문 요약', onOpenKakao, showPlaceList = true, onDistrictFilterChange }: { summary: ActivitySummary; completedPlaces: readonly CompletedMapPlace[]; mapKey: string; periodLabel?: string; scope: string; onOpenKakao: (place: BusanVisitPlace['source']) => Promise<boolean>; showPlaceList?: boolean; onDistrictFilterChange?: (value: { district: string; contentIds: string[] } | null) => void }) {
  return <View testID="activity-summary" style={s.root}>
    <Text style={s.eyebrow}>{periodLabel}</Text>
    <Text style={s.count}>총 {summary.completedPlaceCount}번 방문했어요</Text>
    <Text style={s.categories}>{summary.categories.map(item => `${item.category} ${item.count}`).join(' · ') || '분류된 장소 없음'}</Text>
    <BusanVisitVectorMap key={mapKey} places={completedPlaces} onOpenKakao={onOpenKakao} showPlaceList={showPlaceList} onDistrictFilterChange={onDistrictFilterChange} />
  </View>;
}
const s = StyleSheet.create({ root: { gap: 10 }, eyebrow: { color: C.accent, fontSize: 13, fontWeight: '800' }, count: { maxWidth: 300, color: C.txt, fontSize: 30, lineHeight: 38, fontWeight: '900' }, categories: { color: C.txt2, fontSize: 13, lineHeight: 19, fontWeight: '700', marginBottom: 6 } });
