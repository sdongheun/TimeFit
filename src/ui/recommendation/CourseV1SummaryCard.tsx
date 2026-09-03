import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import type { CourseV1CardSummary } from './courseV1CardDetailModel';
import { getPlacePreviewKind } from './courseV1PlacePreviewModel';

export function CourseV1SummaryCard({ summary, onPress }: { summary: CourseV1CardSummary; onPress: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getPlacePreviewKind(summary.place, imageFailed);
  return <Pressable
    testID={`verified-course-card-${summary.course.id}`}
    accessibilityRole="button"
    accessibilityLabel={summary.accessibilityLabel}
    style={({ pressed }) => [s.card, pressed && s.pressed]}
    onPress={onPress}
  >
    <View style={s.media}>
      {preview.kind === 'image'
        ? <Image accessible={false} source={{ uri: summary.place.imageUrl! }} style={s.image} onError={() => setImageFailed(true)} />
        : <View accessible={false} style={s.placeholder}><Text style={s.placeholderText}>{summary.activityLabel}</Text></View>}
    </View>
    <View style={s.content}>
      <Text style={s.eyebrow}>{summary.label}</Text>
      <Text style={s.title}>{summary.place.title}</Text>
      <Text style={s.activity}>{summary.activityLabel}{summary.short ? ' · 가볍게 둘러보기' : ''}</Text>
      <Text style={s.duration}>약 {summary.courseMin}분 코스</Text>
    </View>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  pressed: { opacity: 0.82 },
  media: { height: 150, backgroundColor: C.panel2 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#26384a' },
  placeholderText: { color: '#b9d8ff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { padding: 17, gap: 6 },
  eyebrow: { color: '#74b0ff', fontSize: 13, fontWeight: '800' },
  title: { color: C.txt, fontSize: 22, lineHeight: 29, fontWeight: '800' },
  activity: { color: '#b9d8ff', fontSize: 13, fontWeight: '700' },
  duration: { color: C.txt, fontSize: 17, fontWeight: '800', marginTop: 3 },
});
