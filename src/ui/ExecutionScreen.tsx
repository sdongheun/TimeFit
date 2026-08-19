import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { getActualRouteBaselines, planTimeFit, timeContext } from '../engine';
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
import {
  buildExecutionSchedule,
  currentMinuteOfDay,
  kakaoRouteUrl,
  kakaoWebFallback,
} from './execution/schedule';
import { CourseProgress } from './execution/CourseProgress';

type Props = NativeStackScreenProps<RootStackParamList, 'Execution'>;
type ExecutionParams = RootStackParamList['Execution'];

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
  const { stops, alerts } = useMemo(
    () => buildExecutionSchedule(params),
    [params],
  );

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
      const destination = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : null;
      const baseline = destination ? await getActualRouteBaselines(currentOrigin, destination) : null;
      const result = await planTimeFit({
        origin: currentOrigin,
        destination,
        remainingMin,
        nowMin,
        dayType: time.dayType,
        hourBucket: time.hourBucket,
        mode: ctx.mode,
        candidateModes: ['walk', 'transit', 'car'],
        radiusM: 8000,
        routeBaselines: baseline?.baselines,
        mapExploration: true,
      });
      if (!result.spatialCandidates.length) {
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
        <CourseProgress
          actualArriveMin={actualArriveMin}
          actualDepartMin={actualDepartMin}
          alerts={alerts}
          appointmentLabel={ctx.appointment?.label}
          bufferLeftMin={course.bufferLeftMin}
          ctaKicker={ctaKicker}
          ctaLabel={ctaLabel}
          ctaMeta={ctaMeta}
          current={current}
          currentSegment={currentSegment}
          delayMin={delayMin}
          endMin={endMin}
          isChangingCourse={isChangingCourse}
          isDone={isDone}
          moveMin={moveMin}
          next={next}
          notificationError={notificationError}
          notificationResult={notificationResult}
          stayMin={stayMin}
          stayWarning={stayWarning}
          step={step}
          stops={stops}
          totalSegments={totalSegments}
          transitionMsg={transitionMsg}
          onChangeCourse={() => void changeCourseFromNow()}
          onFinish={finishCourse}
          onPrimaryAction={isDone ? finishCourse : routeOpened ? continueToNextStep : openCurrentRoute}
          onSelectStep={setStep}
        />
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
});
