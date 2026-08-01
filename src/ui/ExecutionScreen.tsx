import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList, fmtHM } from './nav';
import { C } from './theme';
import { KakaoRouteMap } from './KakaoRouteMap';

type Props = NativeStackScreenProps<RootStackParamList, 'Execution'>;

// legs → 각 지점의 도착/출발 예정시각 계산 (startMin 누적)
type Stop = { name: string; arriveMin: number; leaveMin: number; isSpot: boolean };
function buildSchedule(params: Props['route']['params']): { stops: Stop[]; alerts: { min: number; msg: string }[] } {
  const { course, ctx } = params;
  const stops: Stop[] = [{ name: '출발', arriveMin: ctx.startMin, leaveMin: ctx.startMin, isSpot: false }];
  let t = ctx.startMin, spotIdx = 0;
  for (const lg of course.legs) {
    if (lg.label.startsWith('체류')) {
      stops[stops.length - 1].leaveMin = t + lg.min; t += lg.min;
    } else {
      t += lg.min;
      const isLast = lg === course.legs[course.legs.length - 1];
      const name = isLast ? (ctx.appointment ? `약속 · ${ctx.appointment.label}` : '출발지 복귀') : course.spots[spotIdx++]?.title ?? '';
      stops.push({ name, arriveMin: t, leaveMin: t, isSpot: !isLast });
    }
  }
  // 출발 알림: 각 스팟에서 떠나야 하는 시각
  const alerts = stops.filter((st) => st.isSpot).map((st, i, arr) => ({
    min: st.leaveMin,
    msg: i === arr.length - 1
      ? (params.ctx.appointment ? `이제 ${params.ctx.appointment.label}(으)로 출발하세요` : '이제 출발지로 돌아가세요')
      : '다음 장소로 이동할 시간이에요',
  }));
  return { stops, alerts };
}

export function ExecutionScreen({ route, navigation }: Props) {
  const { course, origin, ctx } = route.params;
  const [step, setStep] = useState(0); // 현재 진행 지점 인덱스
  const { stops, alerts } = useMemo(() => buildSchedule(route.params), [route.params]);

  const target = ctx.appointment ?? origin;
  const pts = [origin, ...course.spots, target];
  const geo = course.legs.filter((lg) => !lg.label.startsWith('체류')).flatMap((lg) => lg.geo ?? []);
  const line = geo.length > 1 ? geo : pts;
  const endMin = ctx.startMin + ctx.remainingMin;

  return (
    <View style={s.root}>
      <KakaoRouteMap
        style={s.map}
        points={pts}
        line={line}
        markers={[
          { ...origin, label: '출발지', kind: 'origin' },
          ...course.spots.map((sp) => ({ ...sp, label: sp.title, kind: 'spot' as const })),
          ...(ctx.appointment ? [{ ...target, label: ctx.appointment.label, kind: 'appointment' as const }] : []),
        ]}
      />

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.banner}>
          <Text style={s.bannerTxt}>{ctx.appointment ? `${fmtHM(endMin)} ${ctx.appointment.label} 약속` : `${fmtHM(endMin)} 복귀 목표`}</Text>
          <Text style={s.bannerBig}>여유 {course.bufferLeftMin}분</Text>
        </View>

        <Text style={s.lbl}>가는 순서</Text>
        <View style={s.timeline}>
          {stops.map((st, i) => {
            const done = i < step, cur = i === step;
            return (
              <Pressable key={i} style={s.stopRow} onPress={() => setStep(i)}>
                <View style={[s.dot, done && s.dotDone, cur && s.dotCur]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.stopName, cur && { color: C.accent }]}>{st.name}</Text>
                  <Text style={s.stopMeta}>
                    {fmtHM(st.arriveMin)} 도착{st.leaveMin > st.arriveMin ? ` · ${st.leaveMin - st.arriveMin}분 체류 · ${fmtHM(st.leaveMin)} 출발` : ''}
                  </Text>
                </View>
                {done && <Text style={s.check}>✓</Text>}
              </Pressable>
            );
          })}
        </View>

        <Text style={s.lbl}>🔔 출발 알림 예정</Text>
        <View style={s.alertBox}>
          {alerts.map((a, i) => (
            <Text key={i} style={s.alert}><Text style={s.alertTime}>{fmtHM(a.min)}</Text>  {a.msg}</Text>
          ))}
          <Text style={s.alertNote}>※ 로컬 푸시 알림은 추후 연결(expo-notifications) — 지금은 예정 시각 안내</Text>
        </View>

        <View style={s.btnRow}>
          {step < stops.length - 1 ? (
            <Pressable style={[s.btn, s.btnMain]} onPress={() => setStep(step + 1)}>
              <Text style={s.btnMainTxt}>다음 지점 도착 ▸</Text>
            </Pressable>
          ) : (
            <Pressable style={[s.btn, s.btnMain]} onPress={() => navigation.navigate('Feedback', { course, ctx })}>
              <Text style={s.btnMainTxt}>코스 완료 🎉</Text>
            </Pressable>
          )}
          <Pressable style={[s.btn, s.btnSub]} onPress={() => navigation.navigate('Feedback', { course, ctx })}>
            <Text style={s.btnSubTxt}>종료</Text>
          </Pressable>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  map: { width: '100%', height: 230 },
  scroll: { padding: 18 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(227,179,65,0.08)', borderColor: 'rgba(227,179,65,0.3)', borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 6 },
  bannerTxt: { color: C.txt2, fontSize: 12.5 },
  bannerBig: { color: C.amber, fontSize: 15, fontWeight: '800' },
  lbl: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  timeline: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 6 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 10 },
  dot: { width: 14, height: 14, borderRadius: 8, backgroundColor: C.bg, borderWidth: 2, borderColor: '#3a4653' },
  dotDone: { backgroundColor: C.green, borderColor: C.green },
  dotCur: { backgroundColor: C.accent, borderColor: C.accent },
  stopName: { color: C.txt, fontSize: 14.5, fontWeight: '600' },
  stopMeta: { color: C.muted, fontSize: 12, marginTop: 1 },
  check: { color: C.green, fontWeight: '800' },
  alertBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14 },
  alert: { color: C.txt2, fontSize: 13, marginVertical: 3 },
  alertTime: { color: C.accent, fontWeight: '800' },
  alertNote: { color: '#6e7d8c', fontSize: 11, marginTop: 8 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  btn: { borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  btnMain: { flex: 1, backgroundColor: '#2ea043' },
  btnMainTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  btnSub: { paddingHorizontal: 18, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
  btnSubTxt: { color: C.txt2, fontSize: 13.5, fontWeight: '600' },
});
