import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import type { CourseV1DetailModel, CourseV1DetailStop } from './courseV1CardDetailModel';
import { getPlacePreviewKind, type CourseV1DisplayPlace } from './courseV1PlacePreviewModel';
import type { ActiveCourseStepRow } from '../courseConfirmActiveModel';

export type CourseVerticalProgress = { rows: readonly ActiveCourseStepRow[]; actionStepIndex: number; action: React.ReactNode };
export function CourseV1VerticalDetail({ model, mode, onOpenKakao, progress }: { model: CourseV1DetailModel; mode: 'review' | 'active'; onOpenKakao: (place: CourseV1DisplayPlace) => void; progress?: CourseVerticalProgress }) {
  const travel = (index: number) => {
    const leg = model.legs[index];
    const stepIndex = index * 2;
    const actionable = progress?.actionStepIndex === stepIndex;
    const status = actionable ? 'current' : progress?.rows[stepIndex]?.actionState;
    return <View key={`leg-${index}`} testID={`course-leg-${index}`} accessibilityLabel={`${leg.mode === 'walk' ? '도보' : '대중교통'} ${leg.min}분${status ? ` · ${status === 'complete' ? '완료' : status === 'current' ? '진행 중' : '이후 이동'}` : ''}`} accessibilityState={{ disabled: status === 'future' }}>
      <TimelineText kind="move" text={`${status === 'complete' ? '✓ ' : ''}${leg.mode === 'walk' ? '도보' : '대중교통'} ${leg.min}분`} />
      {status ? <Text testID={`active-step-${status}`} style={status === 'complete' ? s.bufferText : s.summarySub}>{status === 'complete' ? '완료' : status === 'current' ? '현재 구간' : '이후 구간'}</Text> : null}
      {actionable ? <View testID="active-course-current" style={s.action}>{progress.action}</View> : null}
    </View>;
  };
  const items: React.ReactNode[] = [<TimelineText key="origin" kind="endpoint" text={model.originLabel} first />];
  model.stops.forEach((stop, index) => {
    items.push(travel(index));
    items.push(<DetailStop key={`stop-${stop.placeId}`} stop={stop} showPlannedStay={mode === 'review'} onOpenKakao={onOpenKakao} status={progress?.rows[index * 2 + 1]?.actionState} />);
  });
  items.push(travel(model.legs.length - 1));
  items.push(<TimelineText key="destination" kind="endpoint" text={model.destinationLabel} />);
  items.push(<TimelineText key="buffer" kind="buffer" text={`도착 전 ${model.arrivalBufferMin}분 여유`} last />);

  return <View style={s.root} accessibilityLabel={`약 ${model.courseMin}분 코스`}>
    <View style={s.summary}><Text style={s.summaryTitle}>약 {model.courseMin}분 코스</Text><Text style={s.summarySub}>도착 전 여유는 별도로 확보했어요</Text></View>
    <View style={s.timeline}>{items}</View>
  </View>;
}

function TimelineText({ kind, text, first = false, last = false }: { kind: 'endpoint' | 'move' | 'buffer'; text: string; first?: boolean; last?: boolean }) {
  return <View style={s.row}><TimelineMarker kind={kind} first={first} last={last} /><Text style={kind === 'endpoint' ? s.endpointText : kind === 'move' ? s.moveText : s.bufferText}>{text}</Text></View>;
}

function TimelineMarker({ kind, first = false, last = false }: { kind: 'endpoint' | 'move' | 'stop' | 'buffer'; first?: boolean; last?: boolean }) {
  return <View accessible={false} style={s.markerColumn}>
    <View style={[s.guide, first && s.guideFirst, last && s.guideLast]} />
    <View style={[s.dot, kind === 'endpoint' ? s.endpointDot : kind === 'move' ? s.moveDot : kind === 'stop' ? s.stopDot : s.bufferDot]} />
  </View>;
}

function DetailStop({ stop, showPlannedStay, onOpenKakao, status }: { stop: CourseV1DetailStop; showPlannedStay: boolean; onOpenKakao: (place: CourseV1DisplayPlace) => void; status?: ActiveCourseStepRow['actionState'] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getPlacePreviewKind(stop.place, imageFailed);
  return <View testID={`course-stop-${stop.placeId}`} style={s.stopRow}>
    <TimelineMarker kind="stop" />
    <View style={s.stopCard}>
      <View style={s.media}>{preview.kind === 'image'
        ? <Image source={{ uri: stop.place.imageUrl! }} style={s.image} onError={() => setImageFailed(true)} />
        : <View accessibilityLabel={`${stop.activityLabel} 사진 대체 화면`} style={s.placeholder}><Text style={s.placeholderText}>{stop.activityLabel}</Text></View>}
      </View>
      <View style={s.stopContent}>
        <Text style={s.stopTitle}>{stop.place.title}</Text>
        <Text style={s.activity}>{stop.activityLabel}</Text>
        {showPlannedStay ? <Text style={s.stay}>{stop.stayLabel}</Text> : stop.stayLabel.startsWith('가볍게') ? <Text style={s.stay}>가볍게 둘러보기</Text> : null}
        {status ? <Text style={status === 'complete' ? s.bufferText : s.summarySub}>{status === 'complete' ? '✓ 완료' : status === 'current' ? '지금 둘러보기' : '이후 방문'}</Text> : null}
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
  timeline: { gap: 0 },
  action: { marginLeft: 28, paddingVertical: 8, gap: 8 },
  row: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  markerColumn: { width: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  guide: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#3c526d' },
  guideFirst: { top: '50%' },
  guideLast: { bottom: '50%' },
  dot: { zIndex: 1, borderColor: C.bg },
  endpointDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, backgroundColor: C.accent },
  moveDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: '#4d9df5' },
  stopDot: { width: 14, height: 14, borderRadius: 4, borderWidth: 3, backgroundColor: '#f2ad49' },
  bufferDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: C.green, backgroundColor: C.bg },
  endpointText: { color: C.txt, fontSize: 15, fontWeight: '800' },
  moveText: { color: '#78b7ff', fontSize: 14, fontWeight: '800' },
  bufferText: { color: C.green, fontSize: 14, fontWeight: '800' },
  stopRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingVertical: 4 },
  stopCard: { flex: 1, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  media: { height: 96, backgroundColor: C.panel2 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#26384a' },
  placeholderText: { color: '#b9d8ff', fontSize: 15, fontWeight: '800' },
  stopContent: { padding: 12, gap: 4 },
  stopTitle: { color: C.txt, fontSize: 18, fontWeight: '800' },
  activity: { color: '#b9d8ff', fontSize: 13, fontWeight: '700' },
  stay: { color: '#ffd08a', fontSize: 14, fontWeight: '800' },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { color: '#75b1ff', fontSize: 13, fontWeight: '800' },
});
