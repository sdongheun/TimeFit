import { StyleSheet, Text, View } from 'react-native';
import type { VerifiedCourseV1 } from '../../engine';
import { C } from '../theme';
import { buildCourseV1JourneySegments } from './courseV1JourneyModel';

export function CourseV1Journey({ course, startMin }: { course: VerifiedCourseV1; startMin: number }) {
  const segments = buildCourseV1JourneySegments(course);
  if (!segments) return null;
  const segmentLabel = (segment: (typeof segments)[number]) => segment.kind === 'leg'
    ? `${segment.mode === 'walk' ? '도보' : '대중교통'} ${segment.min}분`
    : segment.kind === 'stop'
    ? (segment.stayState === 'short' ? '가볍게 둘러보기' : '장소 둘러보기')
    : segment.kind === 'buffer'
    ? `도착 전 여유 ${segment.min}분`
    : `남는 시간 ${segment.min}분`;
  return <View accessibilityLabel={segments.map(segmentLabel).join(', ')}><View style={s.clock}><Text style={s.time}>{`${Math.floor(startMin / 60)}:${String(startMin % 60).padStart(2, '0')}`}</Text><Text style={s.time}>검증 코스 {course.totalMin}분</Text></View><View style={s.rail}>{segments.map((segment) => <View key={segment.key} style={{ flexGrow: segment.min || 1, flexBasis: 0, minWidth: 8, backgroundColor: segment.kind === 'leg' ? '#4d9df5' : segment.kind === 'stop' ? '#f2ad49' : segment.kind === 'buffer' ? C.green : '#9370db' }} />)}</View><View style={s.sequence}>{segments.map((segment) => <Text key={segment.key} style={segment.kind === 'leg' ? s.move : segment.kind === 'stop' ? s.stay : segment.kind === 'buffer' ? s.buffer : s.remaining}>{segmentLabel(segment)}</Text>)}</View></View>;
}
const s = StyleSheet.create({ clock: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, time: { color: C.txt2, fontSize: 12, fontWeight: '800' }, rail: { overflow: 'hidden', flexDirection: 'row', height: 10, borderRadius: 8, backgroundColor: C.panel2 }, sequence: { gap: 4, marginTop: 11 }, move: { color: '#78b7ff', fontSize: 12, fontWeight: '800' }, stay: { color: '#ffd08a', fontSize: 12, fontWeight: '800' }, buffer: { color: C.green, fontSize: 12, fontWeight: '800' }, remaining: { color: '#c8b4ff', fontSize: 12, fontWeight: '800' } });
