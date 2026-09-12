import { StyleSheet, Text, View } from 'react-native';
import { datedMinuteLabel as fmtHM } from '../timeSetup/datedSetupTime';
import { C } from '../theme';

type Props = {
  startMin: number;
  approachMin: number;
  activityMin: number;
  onwardMin: number;
  reserveMin: number;
  endMin: number;
  compact?: boolean;
};

/**
 * 추천의 이유를 문장으로 길게 설명하지 않고 시간 비율로 보여준다.
 * 파랑=이동, 주황=활동, 초록=도착 전 여유라는 의미는 모든 결과 화면에서 같다.
 */
export function TimeJourney({
  startMin,
  approachMin,
  activityMin,
  onwardMin,
  reserveMin,
  endMin,
  compact = false,
}: Props) {
  const departureMin = startMin + approachMin + activityMin;
  const arrivalMin = departureMin + onwardMin;
  const total = Math.max(1, approachMin + activityMin + onwardMin + reserveMin);
  const segment = (value: number) => ({ flexGrow: Math.max(value, 5), flexBasis: 0 });
  const point = (elapsedMin: number) => ({ left: `${Math.min(100, Math.max(0, (elapsedMin / total) * 100))}%` as const });

  return <View style={[s.root, compact && s.compact]} accessibilityLabel={`이동 ${approachMin + onwardMin}분, 활동 ${activityMin}분, 도착 전 여유 ${reserveMin}분`}>
    <View style={s.timeRow}><Text style={s.clock}>{fmtHM(startMin)}</Text><Text style={s.clock}>{fmtHM(endMin)}</Text></View>
    <View style={s.rail}>
      <View style={[s.segment, s.move, segment(approachMin)]} />
      <View style={[s.segment, s.activity, segment(activityMin)]} />
      <View style={[s.segment, s.move, segment(onwardMin)]} />
      <View style={[s.segment, s.reserve, segment(reserveMin)]} />
    </View>
    <View style={s.points} pointerEvents="none"><View style={[s.point, point(0)]}><View style={[s.dot, s.originDot]} /></View><View style={[s.point, point(approachMin)]}><View style={[s.dot, s.activityDot]} /></View><View style={[s.point, point(approachMin + activityMin + onwardMin)]}><View style={[s.dot, s.destinationDot]} /></View></View>
    {compact ? null : <View style={s.metaRow}>
      <View><Text style={s.metaValue}>{approachMin}분</Text><Text style={s.metaLabel}>이동</Text></View>
      <View style={s.metaCenter}><Text style={[s.metaValue, s.activityValue]}>{activityMin}분</Text><Text style={s.metaLabel}>둘러보기</Text></View>
      <View style={s.metaEnd}><Text style={[s.metaValue, s.reserveValue]}>{reserveMin}분</Text><Text style={s.metaLabel}>여유</Text></View>
    </View>}
    {compact ? null : <View style={s.departure}><Text style={s.departureLabel}>출발</Text><Text style={s.departureTime}>{fmtHM(departureMin)}</Text><Text style={s.arrivalTime}>{fmtHM(arrivalMin)} 도착</Text></View>}
  </View>;
}

const s = StyleSheet.create({
  root: { paddingVertical: 14 },
  compact: { paddingVertical: 7 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  clock: { color: C.txt2, fontSize: 12, fontWeight: '800' },
  rail: { height: 10, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', backgroundColor: C.panel2 },
  segment: { minWidth: 10 },
  move: { backgroundColor: '#4d9df5' },
  activity: { backgroundColor: '#f2ad49' },
  reserve: { backgroundColor: C.green },
  points: { height: 14, marginTop: -12, position: 'relative' },
  point: { width: 14, alignItems: 'center', position: 'absolute', marginLeft: -7 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: C.bg },
  originDot: { backgroundColor: '#4d9df5' },
  activityDot: { backgroundColor: '#f2ad49' },
  destinationDot: { backgroundColor: C.green },
  metaRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  metaCenter: { alignItems: 'center' },
  metaEnd: { alignItems: 'flex-end' },
  metaValue: { color: C.txt, fontSize: 15, fontWeight: '800' },
  activityValue: { color: '#ffd08a' },
  reserveValue: { color: C.green },
  metaLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  departure: { marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center' },
  departureLabel: { color: C.muted, fontSize: 12, marginRight: 7 },
  departureTime: { color: C.txt, fontSize: 16, fontWeight: '800' },
  arrivalTime: { marginLeft: 'auto', color: C.green, fontSize: 12, fontWeight: '800' },
});
