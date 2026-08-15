import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LatLon, Mode, planTimeFit, timeContext } from '../engine';
import { RootStackParamList, fmtHM } from './nav';
import { C } from './theme';
import { buildRouteMapSegments, KakaoRouteMap } from './KakaoRouteMap';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourses, resetToProfile } from './mainTabNavigation';
import {
  cancelCourseNotifications,
  scheduleCourseNotifications,
  ScheduleResult,
} from '../services/courseNotifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Execution'>;
type ExecutionParams = RootStackParamList['Execution'];

// legs → 각 지점의 도착/출발 예정시각 계산 (startMin 누적)
type Stop = { name: string; arriveMin: number; leaveMin: number; isSpot: boolean; point: LatLon; incomingMode?: Mode };
function buildSchedule(params: ExecutionParams): { stops: Stop[]; alerts: { min: number; msg: string }[] } {
  const { course, ctx, origin } = params;
  const target = ctx.appointment ?? origin;
  const stops: Stop[] = [{ name: '출발', arriveMin: ctx.startMin, leaveMin: ctx.startMin, isSpot: false, point: origin }];
  let t = ctx.startMin, spotIdx = 0;
  for (const lg of course.legs) {
    if (lg.label.startsWith('체류')) {
      stops[stops.length - 1].leaveMin = t + lg.min; t += lg.min;
    } else {
      t += lg.min;
      const isLast = lg === course.legs[course.legs.length - 1];
      const spot = isLast ? null : course.spots[spotIdx++];
      const name = isLast ? (ctx.appointment ? `약속 · ${ctx.appointment.label}` : '출발지 복귀') : spot?.title ?? '';
      const point = isLast ? target : spot ?? target;
      stops.push({ name, arriveMin: t, leaveMin: t, isSpot: !isLast, point, incomingMode: lg.mode ?? ctx.mode });
    }
  }
  // 알림은 코스를 마친 뒤 약속장소(또는 출발지)로 이동해야 하는 최종 출발 시각에만 보낸다.
  const lastSpot = [...stops].reverse().find((st) => st.isSpot);
  const alerts = lastSpot ? [{
    min: lastSpot.leaveMin,
    msg: params.ctx.appointment
      ? `${params.ctx.appointment.label}(으)로 출발하세요`
      : '출발지로 돌아가세요',
  }] : [];
  return { stops, alerts };
}

function kakaoRouteMode(mode: Mode): 'car' | 'foot' | 'publictransit' {
  if (mode === 'car') return 'car';
  if (mode === 'transit') return 'publictransit';
  return 'foot';
}

function kakaoRouteUrl(to: LatLon, mode: Mode): string {
  const by = kakaoRouteMode(mode);
  return `kakaomap://route?ep=${to.lat},${to.lon}&by=${by}`;
}

function kakaoWebFallback(to: Stop): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(to.name)},${to.point.lat},${to.point.lon}`;
}

function currentMinuteOfDay(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function ExecutionScreen({ route, navigation }: Props) {
  const { activeCourse } = useAppFlow();
  // Fast Refresh·이전 저장 코스처럼 라우트 파라미터가 불완전한 경우에는 최근 활성 코스를 우선 복구한다.
  const params = route.params?.ctx && route.params?.course && route.params?.origin
    ? route.params
    : activeCourse;
  if (!params?.ctx || !params.course || !params.origin) {
    return (
      <View style={s.missingRoot}>
        <Text style={s.missingTitle}>코스 정보를 불러오지 못했어요</Text>
        <Text style={s.missingMeta}>내 코스에서 다시 선택해 주세요.</Text>
        <Pressable style={s.missingButton} onPress={() => resetToMyCourses(navigation)}>
          <Text style={s.missingButtonText}>내 코스로 돌아가기</Text>
        </Pressable>
      </View>
    );
  }
  return <ExecutionContent params={params} navigation={navigation} />;
}

function ExecutionContent({ params, navigation }: { params: ExecutionParams; navigation: Props['navigation'] }) {
  const { course, origin, ctx, courseId } = params;
  const flow = useAppFlow();
  const { setActiveCourse } = flow;
  const [step, setStep] = useState(0); // 현재 위치한 지점 인덱스
  const [routeOpened, setRouteOpened] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState('');
  const [actualDepartMinByStep, setActualDepartMinByStep] = useState<Record<number, number>>({});
  const [actualArriveMinByStep, setActualArriveMinByStep] = useState<Record<number, number>>({});
  const [notificationResult, setNotificationResult] = useState<ScheduleResult | null>(null);
  const [notificationError, setNotificationError] = useState(false);
  const [isChangingCourse, setIsChangingCourse] = useState(false);
  const { stops, alerts } = useMemo(() => buildSchedule(params), [params]);

  const target = ctx.appointment ?? origin;
  const pts = [origin, ...course.spots, target];
  const geo = course.legs.filter((lg) => !lg.label.startsWith('체류')).flatMap((lg) => lg.geo ?? []);
  const line = geo.length > 1 ? geo : pts;
  const routeSegments = buildRouteMapSegments(pts, course.legs.filter((lg) => !lg.label.startsWith('체류')));
  const endMin = ctx.startMin + ctx.remainingMin;
  const current = stops[Math.min(step, stops.length - 1)];
  const next = stops[step + 1];
  const isDone = step >= stops.length - 1;
  const moveMin = next ? Math.max(0, next.arriveMin - current.leaveMin) : 0;
  const actualArriveMin = actualArriveMinByStep[step];
  const actualDepartMin = actualDepartMinByStep[step];
  const effectiveArriveMin = actualArriveMin ?? current.arriveMin;
  const stayMin = current.isSpot ? Math.max(0, current.leaveMin - effectiveArriveMin) : 0;
  const delayMin = current.isSpot && actualArriveMin != null ? actualArriveMin - current.arriveMin : 0;
  const stayWarning = current.isSpot && actualArriveMin != null && stayMin < 20;
  const totalSegments = Math.max(0, stops.length - 1);
  const currentSegment = Math.min(step + 1, totalSegments);
  const ctaLabel = isDone
    ? '코스 완료'
    : routeOpened
      ? '다음 이동 준비하기'
      : `현재 위치에서 ${next.name} 길찾기`;
  const ctaKicker = isDone
    ? '마지막 지점'
    : `${currentSegment}/${totalSegments} 구간`;
  const ctaMeta = isDone
    ? '예정된 이동이 끝났습니다'
    : routeOpened
      ? '다시 TimeFit으로 돌아왔을 때 이어서 안내합니다'
      : `${current.name} → ${next.name}`;

  useEffect(() => {
    setActiveCourse(params);
  }, [setActiveCourse, params]);

  useEffect(() => {
    let alive = true;
    scheduleCourseNotifications(alerts)
      .then((result) => {
        if (alive) setNotificationResult(result);
      })
      .catch((error) => {
        console.warn('[알림] 코스 알림 예약 실패', error);
        if (alive) setNotificationError(true);
      });
    return () => { alive = false; };
  }, [alerts]);

  async function finishCourse() {
    await cancelCourseNotifications();
    setActiveCourse(null);
    navigation.navigate('Feedback', { course, ctx });
  }

  async function openCurrentRoute() {
    if (!next) return;
    const now = currentMinuteOfDay();
    setRouteOpened(true);
    setTransitionMsg('');
    setActualDepartMinByStep((prev) => ({ ...prev, [step]: now }));
    const url = kakaoRouteUrl(next.point, next.incomingMode ?? ctx.mode);
    const fallback = kakaoWebFallback(next);
    try {
      await Linking.openURL(url);
    } catch {
      await Linking.openURL(fallback);
    }
  }

  function continueToNextStep() {
    if (!next) return;
    const nextStep = Math.min(step + 1, stops.length - 1);
    const now = currentMinuteOfDay();
    setActualArriveMinByStep((prev) => ({ ...prev, [nextStep]: now }));
    setStep(nextStep);
    setRouteOpened(false);
    setTransitionMsg(nextStep >= stops.length - 1 ? '마지막 지점 기준으로 코스를 마무리합니다.' : '다음 이동 안내로 전환했어요.');
  }

  async function changeCourseFromNow() {
    if (isDone || isChangingCourse) return;
    if (!courseId) {
      Alert.alert('코스를 변경할 수 없어요', '저장된 코스에서 다시 시작해 주세요.');
      return;
    }
    setIsChangingCourse(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('현재 위치가 필요해요', '코스를 변경하려면 현재 위치 권한을 허용해 주세요.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const now = new Date();
      const nowMin = currentMinuteOfDay();
      const remainingMin = endMin - nowMin;
      if (remainingMin <= 0) {
        Alert.alert('약속 시간이 지났어요', '새 코스를 만들기보다 약속 장소로 바로 이동해 주세요.');
        return;
      }
      const time = timeContext(now);
      const currentOrigin = { lat: position.coords.latitude, lon: position.coords.longitude };
      const result = await planTimeFit({
        origin: currentOrigin,
        destination: ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : null,
        remainingMin,
        nowMin,
        dayType: time.dayType,
        hourBucket: time.hourBucket,
        mode: ctx.mode,
      });
      if (!result.courses.length) {
        Alert.alert('변경 가능한 장소가 없어요', '남은 시간에는 약속 장소로 바로 이동하는 것이 안전해요.');
        return;
      }
      navigation.replace('Results', {
        result,
        usedTimeLabel: `현재 기준 ${fmtHM(nowMin)}·${time.hourBucket}`,
        origin: currentOrigin,
        ctx: {
          ...ctx,
          startMin: nowMin,
          remainingMin,
          dayType: time.dayType,
          hourBucket: time.hourBucket,
          originLabel: '현재 위치',
          isManualTime: false,
        },
        editingCourseId: courseId,
      });
    } catch (error) {
      console.warn('[코스 변경] 현재 위치 추천 실패', error);
      Alert.alert('코스를 변경하지 못했어요', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setIsChangingCourse(false);
    }
  }

  return (
    <View style={s.root}>
      <KakaoRouteMap
        style={s.map}
        points={pts}
        line={line}
        segments={routeSegments}
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
        <View style={s.nowBox}>
          {isDone ? (
            <>
              <Text style={s.nowKicker}>코스 완료</Text>
              <Text style={s.nowTitle}>{current.name}</Text>
              <Text style={s.nowMeta}>예정된 마지막 지점에 도착했습니다.</Text>
            </>
          ) : (
            <>
              <Text style={s.nowKicker}>{current.isSpot ? '체류 중' : '이동 준비'}</Text>
              <Text style={s.nowTitle}>{next.name}</Text>
              <Text style={s.nowMeta}>
                {current.isSpot
                  ? `${current.name}에서 현재 기준 약 ${stayMin}분 머물 수 있어요. ${fmtHM(current.leaveMin)}에는 출발하세요.`
                  : `카카오맵에서 현재 위치 기준 길찾기를 열고, 도착 후 TimeFit으로 돌아오세요.`}
              </Text>
              {actualDepartMin != null ? (
                <Text style={s.actualNote}>실제 출발 {fmtHM(actualDepartMin)} 기준으로 진행 중입니다.</Text>
              ) : null}
              {current.isSpot && actualArriveMin != null ? (
                <Text style={[s.actualNote, delayMin > 0 && s.delayNote]}>
                  앱 복귀 {fmtHM(actualArriveMin)}
                  {delayMin > 0 ? ` · 예상보다 ${delayMin}분 늦게 이어가요.` : delayMin < 0 ? ` · 예상보다 ${Math.abs(delayMin)}분 빠르게 이어가요.` : ' · 예정 흐름과 같아요.'}
                </Text>
              ) : null}
              {stayWarning ? (
                <Text style={s.warnNote}>머물 시간이 짧아졌어요. 다음 장소로 바로 이동하는 것도 고려하세요.</Text>
              ) : null}
              <Pressable disabled={isChangingCourse} style={[s.adjustBtn, stayWarning && s.adjustBtnWarn, isChangingCourse && s.adjustBtnDisabled]} onPress={() => void changeCourseFromNow()}>
                <Text style={[s.adjustBtnTxt, stayWarning && s.adjustBtnWarnTxt]}>{isChangingCourse ? '현재 위치 확인 중' : '코스 변경'}</Text>
              </Pressable>
              <View style={s.nowStats}>
                <View style={s.stat}><Text style={s.statLbl}>이동</Text><Text style={s.statVal}>{moveMin}분</Text></View>
                <View style={s.stat}><Text style={s.statLbl}>체류 가능</Text><Text style={s.statVal}>{current.isSpot ? `${stayMin}분` : '-'}</Text></View>
                <View style={s.stat}><Text style={s.statLbl}>출발 마감</Text><Text style={s.statVal}>{fmtHM(current.leaveMin)}</Text></View>
              </View>
            </>
          )}
        </View>

        <View style={s.actionBox}>
          <View style={s.segmentRow}>
            {Array.from({ length: totalSegments + 1 }).map((_, i) => {
              const done = i <= step;
              const active = i === step || (!isDone && i === step + 1);
              return (
                <View key={i} style={s.segmentItem}>
                  <View style={[s.segmentDot, done && s.segmentDotDone, active && s.segmentDotActive]} />
                  {i < totalSegments ? <View style={[s.segmentLine, i < step && s.segmentLineDone]} /> : null}
                </View>
              );
            })}
          </View>
          {transitionMsg ? <Text style={s.transitionMsg}>{transitionMsg}</Text> : null}
          <View style={s.ctaInfo}>
            <Text style={s.ctaKicker}>{ctaKicker}</Text>
            <Text style={s.ctaRoute} numberOfLines={2}>{ctaMeta}</Text>
          </View>
          <Pressable
            style={[s.btn, s.btnMain, routeOpened && s.btnArriveMain]}
            onPress={isDone ? finishCourse : routeOpened ? continueToNextStep : openCurrentRoute}
          >
            <Text style={s.btnMainTxt}>{ctaLabel}</Text>
          </Pressable>
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

        <Text style={s.lbl}>🔔 약속·복귀 출발 알림</Text>
        <View style={s.alertBox}>
          {alerts.map((a, i) => (
            <Text key={i} style={s.alert}>
              <Text style={s.alertTime}>{fmtHM(a.min)}</Text>  {a.msg} · 5분 전/정각
            </Text>
          ))}
          <Text style={s.alertNote}>
            {notificationError
              ? '알림 예약에 실패했습니다. 기기 알림 설정을 확인해 주세요.'
              : notificationResult == null
                ? '알림을 예약하고 있습니다.'
                : !notificationResult.permissionGranted
                  ? '알림 권한이 꺼져 있어 예약되지 않았습니다. 기기 설정에서 TimeFit 알림을 허용해 주세요.'
                  : `${notificationResult.scheduled}건 예약 완료 · 최종 출발 5분 전과 정각에 알려드려요${notificationResult.skipped > 0 ? ` · 지난 시각 ${notificationResult.skipped}건 제외` : ''}`}
          </Text>
        </View>

        <Pressable style={[s.btn, s.btnSub]} onPress={finishCourse}>
          <Text style={s.btnSubTxt}>코스 취소·종료</Text>
        </Pressable>
        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="course"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  missingRoot: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  missingTitle: { color: C.txt, fontSize: 20, fontWeight: '800' },
  missingMeta: { color: C.muted, fontSize: 13.5, marginTop: 8 },
  missingButton: { minHeight: 48, marginTop: 24, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent },
  missingButtonText: { color: C.onAccent, fontSize: 15, fontWeight: '800' },
  map: { width: '100%', height: 230 },
  scroll: { padding: 18 },
  banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(227,179,65,0.08)', borderColor: 'rgba(227,179,65,0.3)', borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 6 },
  bannerTxt: { color: C.txt2, fontSize: 12.5 },
  bannerBig: { color: C.amber, fontSize: 15, fontWeight: '800' },
  nowBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  nowKicker: { color: C.accent, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  nowTitle: { color: C.txt, fontSize: 20, fontWeight: '900' },
  nowMeta: { color: C.txt2, fontSize: 13, lineHeight: 20, marginTop: 8 },
  actualNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  delayNote: { color: C.amber },
  warnNote: { color: C.red, fontSize: 12.5, lineHeight: 18, marginTop: 8, fontWeight: '700' },
  adjustBtn: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(76,194,255,0.5)', backgroundColor: 'rgba(76,194,255,0.1)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  adjustBtnDisabled: { opacity: 0.55 },
  adjustBtnWarn: { borderColor: 'rgba(227,179,65,0.75)', backgroundColor: 'rgba(227,179,65,0.22)' },
  adjustBtnTxt: { color: C.accent, fontSize: 13.5, fontWeight: '800' },
  adjustBtnWarnTxt: { color: C.amber },
  nowStats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 9 },
  statLbl: { color: C.muted, fontSize: 10.5, fontWeight: '700', marginBottom: 3 },
  statVal: { color: C.txt, fontSize: 13, fontWeight: '900' },
  actionBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  segmentDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.bg, borderWidth: 2, borderColor: '#3a4653' },
  segmentDotDone: { backgroundColor: C.green, borderColor: C.green },
  segmentDotActive: { borderColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 6 },
  segmentLine: { flex: 1, height: 2, backgroundColor: '#3a4653', marginHorizontal: 5 },
  segmentLineDone: { backgroundColor: C.green },
  transitionMsg: { color: C.green, fontSize: 12.5, fontWeight: '800', marginBottom: 8 },
  ctaInfo: { marginBottom: 12 },
  ctaKicker: { color: C.accent, fontSize: 11.5, fontWeight: '900', marginBottom: 4 },
  ctaRoute: { color: C.txt, fontSize: 16, lineHeight: 21, fontWeight: '800' },
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
  btn: { minHeight: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnMain: { flex: 1, backgroundColor: C.accent },
  btnArriveMain: { backgroundColor: C.accent },
  btnMainTxt: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  btnSub: { marginTop: 10, paddingHorizontal: 18, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btnSubTxt: { color: C.txt2, fontSize: 13.5, fontWeight: '600' },
});
