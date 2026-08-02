import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Course, LatLon, Mode, PlanResult, planTimeFit, timeContext } from '../engine';
import { RootStackParamList, fmtHM } from './nav';
import { C } from './theme';
import { buildRouteMapSegments, KakaoRouteMap } from './KakaoRouteMap';
import { Place, PlacePicker } from './PlacePicker';

type Props = NativeStackScreenProps<RootStackParamList, 'Execution'>;

// legs → 각 지점의 도착/출발 예정시각 계산 (startMin 누적)
type Stop = { name: string; arriveMin: number; leaveMin: number; isSpot: boolean; point: LatLon };
function buildSchedule(params: Props['route']['params']): { stops: Stop[]; alerts: { min: number; msg: string }[] } {
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
      stops.push({ name, arriveMin: t, leaveMin: t, isSpot: !isLast, point });
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

function parseClockMinute(txt: string): number | null {
  const trimmed = txt.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = m[2] ? Number(m[2]) : 0;
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function hourBucketOfMinute(min: number) {
  const h = Math.floor((((min % 1440) + 1440) % 1440) / 60);
  return h < 11 ? '아침' : h < 14 ? '점심' : h < 17 ? '오후' : h < 21 ? '저녁' : '야간';
}

function filterVisitedCourses(result: PlanResult, course: Course, step: number): PlanResult {
  const visitedIds = new Set(course.spots.slice(0, Math.max(0, step)).map((sp) => sp.contentId));
  if (!visitedIds.size) return result;
  const keep = (c: Course) => c.spots.every((sp) => !visitedIds.has(sp.contentId));
  return {
    ...result,
    courses: result.courses.filter(keep),
    pending: result.pending.filter(keep),
  };
}

export function ExecutionScreen({ route, navigation }: Props) {
  const { course, origin, ctx } = route.params;
  const [step, setStep] = useState(0); // 현재 위치한 지점 인덱스
  const [routeOpened, setRouteOpened] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState('');
  const [actualDepartMinByStep, setActualDepartMinByStep] = useState<Record<number, number>>({});
  const [actualArriveMinByStep, setActualArriveMinByStep] = useState<Record<number, number>>({});
  const [replanning, setReplanning] = useState(false);
  const [replanError, setReplanError] = useState('');
  const [replanTimeTxt, setReplanTimeTxt] = useState('');
  const [replanOrigin, setReplanOrigin] = useState<Place | null>(null);
  const [replanPickerOpen, setReplanPickerOpen] = useState(false);
  const { stops, alerts } = useMemo(() => buildSchedule(route.params), [route.params]);

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
  const canReplan = !isDone;
  const replanLabel = stayWarning ? '남은 시간으로 다시 추천' : '다른 장소 찾아보기';
  const autoReplanRemainingMin = Math.max(0, endMin - currentMinuteOfDay());
  const replanBasePoint = replanOrigin ? { lat: replanOrigin.lat, lon: replanOrigin.lon } : current.point;
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

  async function openCurrentRoute() {
    if (!next) return;
    const now = currentMinuteOfDay();
    setRouteOpened(true);
    setTransitionMsg('');
    setActualDepartMinByStep((prev) => ({ ...prev, [step]: now }));
    const url = kakaoRouteUrl(next.point, ctx.mode);
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

  async function replanFromHere() {
    if (!current) return;
    const manualNowMin = parseClockMinute(replanTimeTxt);
    const usingManualNow = manualNowMin != null;
    const now = manualNowMin ?? currentMinuteOfDay();
    const remainingMin = Math.max(0, endMin - now);
    setReplanError('');
    if (replanTimeTxt.trim() && manualNowMin == null) {
      setReplanError('재검색 기준 시각은 HH:MM 형식으로 입력하세요.');
      return;
    }
    if (remainingMin > 240) {
      setReplanError('재검색 남은 시간은 최대 240분까지 입력하세요.');
      return;
    }
    if (remainingMin < 30) {
      setReplanError('남은 시간이 30분 미만이라 새 코스보다 바로 다음 일정으로 이동하는 편이 안전해요.');
      return;
    }
    setReplanning(true);
    try {
      const real = timeContext(new Date());
      const dayType = ctx.dayType ?? real.dayType;
      const hourBucket = usingManualNow ? hourBucketOfMinute(now) : ctx.isManualTime ? (ctx.hourBucket ?? hourBucketOfMinute(now)) : real.hourBucket;
      const rawResult = await planTimeFit({
        origin: replanBasePoint,
        destination: ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : origin,
        remainingMin,
        mode: ctx.mode,
        nowMin: now,
        dayType,
        hourBucket,
      });
      const result = filterVisitedCourses(rawResult, course, step);
      if (!result.courses.length) {
        setReplanError(`남은 시간으로 가능한 다른 코스를 찾지 못했어요. 후보 ${rawResult.candidateCount}개 · 영업중 ${rawResult.gatedCount}개 기준입니다.`);
        return;
      }
      navigation.navigate('Results', {
        result,
        usedTimeLabel: `${dayType} ${fmtHM(now)}·${hourBucket}`,
        origin: replanBasePoint,
        ctx: { ...ctx, startMin: now, remainingMin, dayType, hourBucket, isManualTime: ctx.isManualTime || usingManualNow },
      });
    } catch (e: any) {
      setReplanError('재검색 실패: ' + (e?.message ?? '알 수 없음'));
    } finally {
      setReplanning(false);
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
              {canReplan ? (
                <View style={s.replanBox}>
                  <View style={s.replanInputRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.replanInputLbl}>재검색 조건</Text>
                      <Text style={s.replanAuto}>비우면 자동 {autoReplanRemainingMin}분 · 현재 지점 기준</Text>
                    </View>
                  </View>
                  <View style={s.replanSingleField}>
                    <Text style={s.replanFieldLbl}>현재 시간</Text>
                    <TextInput
                      style={s.replanInput}
                      value={replanTimeTxt}
                      onChangeText={setReplanTimeTxt}
                      placeholder="HH:MM"
                      placeholderTextColor={C.muted}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <Pressable style={s.replanPlaceBtn} onPress={() => setReplanPickerOpen(true)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.replanFieldLbl}>현재 장소</Text>
                      <Text style={s.replanPlaceTxt} numberOfLines={1}>{replanOrigin ? replanOrigin.label : current.name}</Text>
                    </View>
                    <Text style={s.replanPlaceAction}>변경</Text>
                  </Pressable>
                  <Pressable style={[s.replanBtn, stayWarning && s.replanBtnWarn, replanning && s.replanBtnOff]} onPress={replanFromHere} disabled={replanning}>
                    {replanning ? <ActivityIndicator color={stayWarning ? '#fff' : C.accent} /> : <Text style={[s.replanBtnTxt, stayWarning && s.replanBtnWarnTxt]}>{replanLabel}</Text>}
                  </Pressable>
                </View>
              ) : null}
              {replanError ? <Text style={s.replanError}>{replanError}</Text> : null}
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
            onPress={isDone ? () => navigation.navigate('Feedback', { course, ctx }) : routeOpened ? continueToNextStep : openCurrentRoute}
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

        <Text style={s.lbl}>🔔 출발 알림 예정</Text>
        <View style={s.alertBox}>
          {alerts.map((a, i) => (
            <Text key={i} style={s.alert}><Text style={s.alertTime}>{fmtHM(a.min)}</Text>  {a.msg}</Text>
          ))}
          <Text style={s.alertNote}>※ 지금은 예정 시각 안내입니다. 로컬 알림은 추후 연결합니다.</Text>
        </View>

        <Pressable style={[s.btn, s.btnSub]} onPress={() => navigation.navigate('Feedback', { course, ctx })}>
          <Text style={s.btnSubTxt}>코스 종료</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
      <PlacePicker
        visible={replanPickerOpen}
        title="재검색 현재 장소 선택"
        center={replanBasePoint}
        showGps
        onClose={() => setReplanPickerOpen(false)}
        onConfirm={(p) => setReplanOrigin(p)}
      />
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
  nowBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  nowKicker: { color: C.accent, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  nowTitle: { color: C.txt, fontSize: 20, fontWeight: '900' },
  nowMeta: { color: C.txt2, fontSize: 13, lineHeight: 20, marginTop: 8 },
  actualNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  delayNote: { color: C.amber },
  warnNote: { color: C.red, fontSize: 12.5, lineHeight: 18, marginTop: 8, fontWeight: '700' },
  replanBox: { marginTop: 12 },
  replanInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12 },
  replanInputLbl: { color: C.txt, fontSize: 12.5, fontWeight: '800' },
  replanAuto: { color: C.muted, fontSize: 11.5, marginTop: 2 },
  replanSingleField: { marginTop: 8 },
  replanFieldLbl: { color: C.muted, fontSize: 11.5, fontWeight: '800', marginBottom: 5 },
  replanInput: { width: '100%', minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, color: C.txt, textAlign: 'center', fontSize: 14.5, fontWeight: '800', paddingHorizontal: 8 },
  replanPlaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12 },
  replanPlaceTxt: { color: C.txt, fontSize: 13.5, fontWeight: '700' },
  replanPlaceAction: { color: C.accent, fontSize: 12.5, fontWeight: '900' },
  replanBtn: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(76,194,255,0.5)', backgroundColor: 'rgba(76,194,255,0.1)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  replanBtnWarn: { borderColor: 'rgba(227,179,65,0.75)', backgroundColor: 'rgba(227,179,65,0.22)' },
  replanBtnOff: { opacity: 0.55 },
  replanBtnTxt: { color: C.accent, fontSize: 13.5, fontWeight: '800' },
  replanBtnWarnTxt: { color: C.amber },
  replanError: { color: C.amber, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
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
  btn: { borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  btnMain: { flex: 1, backgroundColor: '#2ea043' },
  btnArriveMain: { backgroundColor: C.accent },
  btnMainTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  btnSub: { marginTop: 10, paddingHorizontal: 18, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btnSubTxt: { color: C.txt2, fontSize: 13.5, fontWeight: '600' },
});
