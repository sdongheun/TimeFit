import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import type { CourseV1DetailModel, CourseV1DetailStop } from './courseV1CardDetailModel';
import { type CourseV1DisplayPlace } from './courseV1PlacePreviewModel';
import type { ActiveCourseStepRow } from '../courseConfirmActiveModel';
import { PlacePhoto, PlacePhotoCredit } from '../PlacePhoto';
import { CourseStepIndicator } from './CourseStepIndicator';

export type CourseVerticalProgress = { rows: readonly ActiveCourseStepRow[] };
export function CourseV1VerticalDetail({ model, mode, onOpenKakao, progress, cancelAction, expansionKey = JSON.stringify(model.legs) }: { model: CourseV1DetailModel; mode: 'review' | 'active'; onOpenKakao: (place: CourseV1DisplayPlace) => void; progress?: CourseVerticalProgress; cancelAction?: React.ReactNode; expansionKey?: string }) {
  const travel = (index: number) => {
    const leg = model.legs[index];
    const stepIndex = index * 2;
    const status = progress?.rows[stepIndex]?.actionState;
    return <View key={`leg-${index}`} testID={`course-leg-${index}`} accessibilityLabel={`${leg.mode === 'walk' ? '도보' : '대중교통'} ${leg.min}분${status ? ` · ${status === 'complete' ? '완료' : status === 'current' ? '진행 중' : '이후 이동'}` : ''}`} accessibilityState={{ disabled: status === 'future' }}>
      <TimelineText kind="move" status={status} text={`${status === 'complete' ? '✓ ' : ''}${leg.mode === 'walk' ? '도보' : '대중교통'} ${leg.min}분`} />
      {status ? <Text testID={`active-step-${status}`} style={status === 'complete' ? s.bufferText : s.summarySub}>{status === 'complete' ? '완료' : status === 'current' ? '현재 구간' : '이후 구간'}</Text> : null}
    </View>;
  };
  const items: React.ReactNode[] = [<TimelineText key="origin" kind="endpoint" text={model.originLabel} first />];
  model.stops.forEach((stop, index) => {
    items.push(travel(index));
    items.push(<DetailStop key={`stop-${expansionKey}-${model.stops.map(item => item.placeId).join('-')}-${stop.placeId}-${stop.stayLabel}`} stop={stop} showPlannedStay={mode === 'review'} onOpenKakao={onOpenKakao} status={progress?.rows[index * 2 + 1]?.actionState} />);
  });
  items.push(travel(model.legs.length - 1));
  items.push(<TimelineText key="destination" kind="endpoint" text={model.destinationLabel} />);
  items.push(<TimelineText key="buffer" kind="buffer" text={`도착 전 ${model.arrivalBufferMin}분 여유`} last />);

  return <View style={s.root} accessibilityLabel={`약 ${model.courseMin}분 코스`}>
    <View style={s.summary}><View testID="course-summary-row" style={s.summaryRow}><Text style={s.summaryTitle}>약 {model.courseMin}분 코스</Text>{cancelAction}</View><Text style={s.summarySub}>도착 전 여유는 별도로 확보했어요</Text></View>
    <View style={s.timeline}>{items}</View>
  </View>;
}

function TimelineText({ kind, text, first = false, last = false, status }: { status?: ActiveCourseStepRow['actionState']; kind: 'endpoint' | 'move' | 'buffer'; text: string; first?: boolean; last?: boolean }) {
  return <View style={s.row}><TimelineMarker kind={kind} first={first} last={last} status={status} /><Text style={kind === 'endpoint' ? s.endpointText : kind === 'move' ? s.moveText : s.bufferText}>{text}</Text></View>;
}

function TimelineMarker({ kind, first = false, last = false, status }: { status?: ActiveCourseStepRow['actionState']; kind: 'endpoint' | 'move' | 'stop' | 'buffer'; first?: boolean; last?: boolean }) {
  return <View accessible={false} style={s.markerColumn}>
    <View style={[s.guide, first && s.guideFirst, last && s.guideLast]} />
    {status ? <CourseStepIndicator status={status} /> : <View style={[s.dot, kind === 'endpoint' ? s.endpointDot : kind === 'move' ? s.moveDot : kind === 'stop' ? s.stopDot : s.bufferDot]} />}
  </View>;
}

function DetailStop({ stop, showPlannedStay, onOpenKakao, status }: { stop: CourseV1DetailStop; showPlannedStay: boolean; onOpenKakao: (place: CourseV1DisplayPlace) => void; status?: ActiveCourseStepRow['actionState'] }) {
  const [expanded, setExpanded] = useState(false);
  return <View testID={`course-stop-${stop.placeId}`} style={s.stopRow}>
    <TimelineMarker kind="stop" status={status} />
    <View style={s.stopCard}>
      <View testID={`course-thumbnail-${stop.placeId}`} style={s.media}><PlacePhoto place={stop.place} fallback={<View accessibilityLabel={`${stop.activityLabel} 사진 대체 화면`} style={s.placeholder}><Text style={s.placeholderText}>{stop.activityLabel}</Text></View>} />
      </View>
      <View style={s.stopContent}>
        <Text style={s.stopTitle}>{stop.place.title}</Text>
        <PlacePhotoCredit place={stop.place} links />
        {showPlannedStay ? <Pressable testID={`course-detail-toggle-${stop.placeId}`} accessibilityRole="button" accessibilityLabel={`${stop.place.title} ${expanded ? '접기' : '상세 보기'}`} accessibilityState={{ expanded }} style={s.link} onPress={() => setExpanded(value => !value)}><Text style={s.linkText}>{expanded ? '접기' : '상세 보기'}</Text></Pressable> : null}
        {(!showPlannedStay || expanded) ? <><Text style={s.activity}>{stop.activityLabel}</Text>
        {showPlannedStay ? <Text style={s.stay}>{stop.stayLabel}</Text> : stop.stayLabel.startsWith('가볍게') ? <Text style={s.stay}>가볍게 둘러보기</Text> : null}</> : null}
        {status ? <Text testID={`active-step-${status}`} accessibilityLiveRegion={status === 'current' ? 'polite' : 'none'} style={status === 'complete' ? s.bufferText : s.summarySub}>{status === 'complete' ? '✓ 완료' : status === 'current' ? '지금 둘러보기' : '이후 방문'}</Text> : null}
        <Pressable accessibilityRole="link" accessibilityLabel={`${stop.place.title} 카카오맵에서 장소 보기`} style={s.link} onPress={() => onOpenKakao(stop.place)}><Text style={s.linkText}>카카오맵에서 장소 보기</Text></Pressable>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 16 },
  summary: { gap: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryTitle: { flex: 1, color: C.txt, fontSize: 24, fontWeight: '800' },
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
  moveText: { color: C.txt, fontSize: 14, fontWeight: '800' },
  bufferText: { color: C.muted, fontSize: 14, fontWeight: '800' },
  stopRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingVertical: 4 },
  stopCard: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', padding: 10, gap: 10, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  media: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: C.panel2 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4, backgroundColor: '#26384a' },
  placeholderText: { color: C.muted, fontSize: 10, fontWeight: '800' },
  stopContent: { flex: 1, minWidth: 0, gap: 4 },
  stopTitle: { color: C.txt, fontSize: 16, fontWeight: '800' },
  activity: { color: C.muted, fontSize: 13, fontWeight: '700' },
  stay: { color: C.txt, fontSize: 14, fontWeight: '800' },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { color: C.txt, fontSize: 13, fontWeight: '800' },
});
