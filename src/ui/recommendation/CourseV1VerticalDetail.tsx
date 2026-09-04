import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import type { CourseV1DetailModel, CourseV1DetailStop } from './courseV1CardDetailModel';
import { getPlacePreviewKind, type CourseV1DisplayPlace } from './courseV1PlacePreviewModel';

export function CourseV1VerticalDetail({ model, onOpenKakao }: { model: CourseV1DetailModel; onOpenKakao: (place: CourseV1DisplayPlace) => void }) {
  const items: React.ReactNode[] = [<TimelineText key="origin" kind="endpoint" text={model.originLabel} />];
  model.stops.forEach((stop, index) => {
    const leg = model.legs[index];
    items.push(<TimelineText key={`leg-${index}`} kind="move" text={`${leg.mode === 'walk' ? '도보' : '대중교통'} ${leg.min}분`} />);
    items.push(<DetailStop key={`stop-${stop.placeId}`} stop={stop} onOpenKakao={onOpenKakao} />);
  });
  const finalLeg = model.legs.at(-1)!;
  items.push(<TimelineText key="final-leg" kind="move" text={`${finalLeg.mode === 'walk' ? '도보' : '대중교통'} ${finalLeg.min}분`} />);
  items.push(<TimelineText key="destination" kind="endpoint" text={model.destinationLabel} />);
  items.push(<TimelineText key="buffer" kind="buffer" text={`도착 전 ${model.arrivalBufferMin}분 여유`} />);

  return <View style={s.root} accessibilityLabel={`약 ${model.courseMin}분 코스`}>
    <View style={s.summary}><Text style={s.summaryTitle}>약 {model.courseMin}분 코스</Text><Text style={s.summarySub}>도착 전 여유는 별도로 확보했어요</Text></View>
    <View style={s.timeline}>{items}</View>
  </View>;
}

function TimelineText({ kind, text }: { kind: 'endpoint' | 'move' | 'buffer'; text: string }) {
  return <View style={s.row}><View style={[s.dot, kind === 'move' ? s.moveDot : kind === 'buffer' ? s.bufferDot : s.endpointDot]} /><Text style={kind === 'endpoint' ? s.endpointText : kind === 'move' ? s.moveText : s.bufferText}>{text}</Text></View>;
}

function DetailStop({ stop, onOpenKakao }: { stop: CourseV1DetailStop; onOpenKakao: (place: CourseV1DisplayPlace) => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getPlacePreviewKind(stop.place, imageFailed);
  return <View style={s.stopRow}>
    <View style={[s.dot, s.stopDot]} />
    <View style={s.stopCard}>
      <View style={s.media}>{preview.kind === 'image'
        ? <Image source={{ uri: stop.place.imageUrl! }} style={s.image} onError={() => setImageFailed(true)} />
        : <View accessibilityLabel={`${stop.activityLabel} 사진 대체 화면`} style={s.placeholder}><Text style={s.placeholderText}>{stop.activityLabel}</Text></View>}
      </View>
      <View style={s.stopContent}>
        <Text style={s.stopTitle}>{stop.place.title}</Text>
        <Text style={s.activity}>{stop.activityLabel}</Text>
        <Text style={s.stay}>{stop.stayLabel}</Text>
        <Pressable accessibilityRole="link" accessibilityLabel={`${stop.place.title} 카카오맵에서 장소 보기`} style={s.link} onPress={() => onOpenKakao(stop.place)}><Text style={s.linkText}>카카오맵에서 장소 보기</Text></Pressable>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 16 },
  summary: { gap: 4 },
  summaryTitle: { color: C.txt, fontSize: 24, fontWeight: '800' },
  summarySub: { color: C.muted, fontSize: 13 },
  timeline: { gap: 11 },
  row: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: C.bg },
  endpointDot: { backgroundColor: C.accent },
  moveDot: { backgroundColor: '#4d9df5' },
  stopDot: { backgroundColor: '#f2ad49', marginTop: 18 },
  bufferDot: { backgroundColor: C.green },
  endpointText: { color: C.txt, fontSize: 15, fontWeight: '800' },
  moveText: { color: '#78b7ff', fontSize: 14, fontWeight: '800' },
  bufferText: { color: C.green, fontSize: 14, fontWeight: '800' },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stopCard: { flex: 1, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  media: { height: 130, backgroundColor: C.panel2 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#26384a' },
  placeholderText: { color: '#b9d8ff', fontSize: 15, fontWeight: '800' },
  stopContent: { padding: 14, gap: 5 },
  stopTitle: { color: C.txt, fontSize: 18, fontWeight: '800' },
  activity: { color: '#b9d8ff', fontSize: 13, fontWeight: '700' },
  stay: { color: '#ffd08a', fontSize: 14, fontWeight: '800' },
  link: { alignSelf: 'flex-start', minHeight: 34, justifyContent: 'center', marginTop: 2 },
  linkText: { color: '#75b1ff', fontSize: 13, fontWeight: '800' },
});
