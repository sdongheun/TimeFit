import { View, Text, StyleSheet } from 'react-native';
import type { ActivitySummary } from './activitySummary';
import { CompletedPlacesMapButton } from '../CompletedPlacesMapButton';
import type { CompletedMapPlace } from './completedPlaceMapModel';
import { C } from '../theme';

export function ActivityStatistics({ summary, completedPlaces, mapKey, scope }: { summary: ActivitySummary; completedPlaces: readonly CompletedMapPlace[]; mapKey: string; scope: string }) {
  return <View testID="activity-summary" style={s.root}>
    <Text style={s.count}>방문 {summary.completedPlaceCount}회</Text>
    <Text style={s.scope}>{scope}</Text>
    <CompletedPlacesMapButton key={mapKey} places={completedPlaces} preview style={s.map} />
    <Text style={s.categories}>{summary.categories.map(item => `${item.category} ${item.count}`).join(' · ') || '아직 방문 기록이 없어요'}</Text>
  </View>;
}
const s = StyleSheet.create({ root: { gap: 10 }, count: { color: C.txt, fontSize: 32, fontWeight: '800' }, scope: { color: C.muted, fontSize: 12, lineHeight: 18 }, map: { height: 150, borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden', backgroundColor: C.panel }, categories: { color: C.txt2, fontSize: 13, lineHeight: 20 } });
