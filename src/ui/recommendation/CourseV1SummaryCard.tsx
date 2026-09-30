import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import type { CourseV1CardSummary } from './courseV1CardDetailModel';
import { PlacePhoto } from '../PlacePhoto';

export function CourseV1SummaryCard({ summary, onPress }: { summary: CourseV1CardSummary; onPress: () => void }) {
  return <Pressable
    testID={`verified-course-card-${summary.course.id}`}
    accessibilityRole="button"
    accessibilityLabel={summary.accessibilityLabel}
    style={({ pressed }) => [s.card, pressed && s.pressed]}
    onPress={onPress}
  >
    <View style={s.media}>
      <PlacePhoto testID="recommendation-place-photo" place={summary.place} fallback={<View accessible={false} style={s.placeholder}><Text style={s.placeholderText}>{summary.activityLabel}</Text></View>} />
    </View>
    <View style={s.content}>
      <Text numberOfLines={2} style={s.title}>{summary.place.title}</Text>
      <Text numberOfLines={1} style={s.activity}>{summary.activityLabel}{summary.short ? ' · 가볍게 둘러보기' : ''}</Text>
      <Text style={s.duration}>약 {summary.courseMin}분 코스</Text>
    </View>
    <Text accessible={false} style={s.arrow}>›</Text>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', minHeight: 116, alignItems: 'center', gap: 12, padding: 10, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  pressed: { opacity: 0.82 },
  media: { width: 96, height: 96, flexShrink: 0, backgroundColor: C.panel },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#26384a' },
  placeholderText: { color: '#b9d8ff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  content: { flex: 1, minWidth: 0, gap: 6 },
  title: { color: C.txt, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  activity: { color: C.muted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  duration: { color: C.txt, fontSize: 14, fontWeight: '800' },
  arrow: { flexShrink: 0, color: C.muted, fontSize: 26, lineHeight: 30, paddingHorizontal: 2 },
});
