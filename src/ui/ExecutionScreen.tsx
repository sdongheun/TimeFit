import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import * as WebBrowser from 'expo-web-browser';
import { LatLon, Mode, timeContext, travelGeo } from '../engine';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { buildRouteMapSegments, KakaoRouteMap } from './KakaoRouteMap';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToMain, resetToMyCourses, resetToNearbyBrowse, resetToProfile } from './mainTabNavigation';
import { precompute, precomputeTransit } from '../engine/travel';
import {
  cancelCourseNotifications,
  scheduleCourseNotifications,
  ScheduleResult,
} from '../services/courseNotifications';
import {
  buildExecutionSchedule,
  currentMinuteOfDay,
  isKakaoRouteOpenSuccess,
  openKakaoRouteWithFallback,
} from './execution/schedule';
import { CourseProgress } from './execution/CourseProgress';
import { ManualLocationRestoreGate } from './ManualLocationRestoreGate';

type Props = NativeStackScreenProps<RootStackParamList, 'Execution'>;
type ExecutionParams = RootStackParamList['Execution'];

export function ExecutionScreen({ route, navigation }: Props) {
  const { activeCourse } = useAppFlow();
  const [confirmedParams, setConfirmedParams] = useState<ExecutionParams | null>(null);
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
  if (confirmedParams !== params) return <ManualLocationRestoreGate key={params.courseId ?? params.ctx.startedAtIso ?? 'legacy'} origin={params.origin} destination={params.ctx.appointment ?? null} endsAtMs={params.ctx.endsAtIso ? Date.parse(params.ctx.endsAtIso) : NaN} titles={params.course.spots.map(p=>p.title)} onCancel={()=>navigation.goBack()} onConfirm={()=>{setConfirmedParams(params);return true;}}/>;
  return <ExecutionContent params={params} navigation={navigation} />;
}

function ExecutionContent({ params, navigation }: { params: ExecutionParams; navigation: Props['navigation'] }) {
  const { course, origin, ctx, courseId } = params;
  const flow = useAppFlow();
  const { setActiveCourse } = flow;
  const [step, setStep] = useState(0); // 현재 위치한 지점 인덱스
  const [routeOpened, setRouteOpened] = useState(false);
  const routeOpening = useRef(false);
  const routeGeneration = useRef(0);
  const routePosition = useRef({ step, courseId, routeOpened });
  routePosition.current = { step, courseId, routeOpened };
  useEffect(() => () => { routeGeneration.current++; }, []);
  const [transitionMsg, setTransitionMsg] = useState('');
  const [actualDepartMinByStep, setActualDepartMinByStep] = useState<Record<number, number>>({});
  const [actualArriveMinByStep, setActualArriveMinByStep] = useState<Record<number, number>>({});
  const [notificationResult, setNotificationResult] = useState<ScheduleResult | null>(null);
  const [notificationError, setNotificationError] = useState(false);
  const [isChangingCourse, setIsChangingCourse] = useState(false);
  const [nowMin, setNowMin] = useState<number>(currentMinuteOfDay());

  const target = useMemo(() => ctx.appointment ?? origin, [ctx.appointment, origin]);

  // 하이브리드 실경로 Hydration (로컬 캐시 즉시 렌더링 + 캐시 누락 시 백그라운드 1회 자동 복원)
  const [hydratedTravelLegs, setHydratedTravelLegs] = useState<Array<{ geo?: LatLon[]; src?: string; mode?: Mode }>>(() => {
    return course.legs.filter((lg) => !lg.label.startsWith('체류'));
  });

  useEffect(() => {
    const travelLegs = course.legs.filter((lg) => !lg.label.startsWith('체류'));
    const needsHydration = travelLegs.some((lg) => !lg.geo || lg.geo.length <= 1);
    if (!needsHydration) return;

    let alive = true;
    async function restoreRouteGeo() {
      try {
        const pairs: Array<{ from: LatLon; to: LatLon; mode: Mode }> = [];
        let curr: LatLon = origin;
        for (let i = 0; i < course.spots.length; i++) {
          const sp = course.spots[i];
          const mode = travelLegs[i]?.mode ?? ctx.mode;
          pairs.push({ from: curr, to: sp, mode });
          curr = sp;
        }
        pairs.push({ from: curr, to: target, mode: travelLegs[course.spots.length]?.mode ?? ctx.mode });

        await Promise.all(
          pairs.map((p) =>
            p.mode === 'transit'
              ? precomputeTransit([[p.from, p.to]], { retryFallback: true })
              : precompute([[p.from, p.to]], p.mode, { retryFallback: true }),
          ),
        );

        if (!alive) return;
        const updatedLegs = travelLegs.map((lg, i) => {
          const pair = pairs[i];
          if (!pair) return lg;
          const restoredGeo = travelGeo(pair.from, pair.to, pair.mode);
          return {
            ...lg,
            geo: restoredGeo && restoredGeo.length > 1 ? restoredGeo : lg.geo,
            src: lg.src ?? 'TMAP',
          };
        });

        setHydratedTravelLegs(updatedLegs);
      } catch {
        console.warn('execution_hydration_failed');
      }
    }

    void restoreRouteGeo();
    return () => { alive = false; };
  }, [course, origin, target, ctx.mode]);

  // 1분 주기 타이머 + 앱 복귀(AppState active) 자동 동기화 (배터리 누수 방지)
  useEffect(() => {
    const updateNow = () => setNowMin(currentMinuteOfDay());
    updateNow();

    const interval = setInterval(updateNow, 30_000); // 30초마다 분 단위 최신화

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        updateNow();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const { stops, alerts } = useMemo(
    () => buildExecutionSchedule(params),
    [params],
  );

  const pts = useMemo(() => [origin, ...course.spots, target], [origin, course.spots, target]);
  const routeSegments = useMemo(
    () => buildRouteMapSegments(pts, hydratedTravelLegs),
    [pts, hydratedTravelLegs],
  );
  const geo = useMemo(
    () => hydratedTravelLegs.flatMap((lg) => lg.geo ?? []),
    [hydratedTravelLegs],
  );
  const line = useMemo(() => geo.length > 1 ? geo : pts, [geo, pts]);
  const endMin = ctx.startMin + ctx.remainingMin;
  const current = stops[Math.min(step, stops.length - 1)];
  const next = stops[step + 1];
  const isDone = step >= stops.length - 1;
  const moveMin = next ? Math.max(0, next.arriveMin - current.leaveMin) : 0;
  const actualArriveMin = actualArriveMinByStep[step];
  const actualDepartMin = actualDepartMinByStep[step];

  // 실시간 동적 시간 계산 (음수 방어 및 초과 시각 계산)
  const remainingStayMin = current.isSpot ? Math.max(0, current.leaveMin - nowMin) : 0;
  const overdueMin = current.isSpot && nowMin > current.leaveMin ? nowMin - current.leaveMin : 0;
  const stayWarning = current.isSpot && (overdueMin > 0 || remainingStayMin < 15);
  const remainingMoveMin = !current.isSpot && next ? Math.max(0, (actualDepartMin != null ? actualDepartMin + moveMin : current.leaveMin) - nowMin) : moveMin;
  const dynamicBufferLeftMin = Math.max(0, Math.round(course.bufferLeftMin));

  const totalSegments = Math.max(0, stops.length - 1);
  const currentSegment = Math.min(step + 1, totalSegments);
  const ctaLabel = isDone
    ? '코스 완료'
    : routeOpened
      ? '도착 완료 (다음 단계)'
      : `${next.name} 길찾기`;
  const ctaKicker = isDone
    ? '마지막 지점'
    : `${currentSegment}/${totalSegments} 구간`;
  const ctaMeta = isDone
    ? '예정된 이동이 끝났습니다'
    : routeOpened
      ? '목적지에 도착하셨다면 탭해 주세요'
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
      .catch(() => {
        console.warn('execution_notifications_failed');
        if (alive) setNotificationError(true);
      });
    return () => { alive = false; };
  }, [alerts]);

  async function finishCourse() {
    routeGeneration.current++;
    await cancelCourseNotifications();
    setActiveCourse(null);
    navigation.navigate('Feedback', { course, ctx });
  }

  async function openCurrentRoute() {
    if (!next || routeOpening.current || routePosition.current.step !== step || routePosition.current.courseId !== courseId) return;
    routeOpening.current = true;
    const generation = routeGeneration.current;
    const openedBefore = routePosition.current.routeOpened;
    const now = currentMinuteOfDay();
    setTransitionMsg('');
    setRouteOpened(true);
    if (!openedBefore) setActualDepartMinByStep(prev => ({ ...prev, [step]: now }));
    try {
    const result = await openKakaoRouteWithFallback({ from: { name: current.name, point: current.point }, to: { name: next.name, point: next.point } }, next.incomingMode ?? ctx.mode, {
      canOpenApp: Linking.canOpenURL,
      openApp: Linking.openURL,
      openWeb: Linking.openURL,
      openBrowser: WebBrowser.openBrowserAsync,
      observeAppState: listener => { const subscription = AppState.addEventListener('change', listener); return () => subscription.remove(); },
    });
    if (result === 'browser_fallback_cancelled' || isKakaoRouteOpenSuccess(result)) return;
    throw Error('route_open_failed');
    } catch {
      if (routeGeneration.current !== generation || routePosition.current.step !== step || routePosition.current.courseId !== courseId) return;
      if (!openedBefore) {
        setRouteOpened(false);
        setActualDepartMinByStep(prev => { const restored = { ...prev }; delete restored[step]; return restored; });
      }
      Alert.alert('카카오맵을 열 수 없어요', '잠시 후 다시 시도해 주세요.');
    } finally { routeOpening.current = false; }
  }

  function continueToNextStep() {
    if (!next) return;
    routeGeneration.current++;
    const nextStep = Math.min(step + 1, stops.length - 1);
    const now = currentMinuteOfDay();
    setActualArriveMinByStep((prev) => ({ ...prev, [nextStep]: now }));
    setStep(nextStep);
    setRouteOpened(false);
    setTransitionMsg(nextStep >= stops.length - 1 ? '마지막 지점 기준으로 코스를 마무리합니다.' : '다음 이동 안내로 전환했어요.');
  }

  async function changeCourseFromNow() {
    Alert.alert('장소를 직접 선택해 주세요', '이 코스는 그대로 유지됩니다. 메인의 시간 설정에서 출발지와 도착지를 직접 선택해 새 코스를 만들 수 있어요.');
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
          bufferLeftMin={dynamicBufferLeftMin}
          ctaKicker={ctaKicker}
          ctaLabel={ctaLabel}
          ctaMeta={ctaMeta}
          current={current}
          currentSegment={currentSegment}
          delayMin={0}
          endMin={endMin}
          isChangingCourse={isChangingCourse}
          isDone={isDone}
          moveMin={remainingMoveMin}
          next={next}
          notificationError={notificationError}
          notificationResult={notificationResult}
          overdueMin={overdueMin}
          stayMin={remainingStayMin}
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
        {routeOpened && !isDone ? <Pressable testID="execution-route-reopen" accessibilityLabel="길찾기 다시 보기" style={s.missingButton} onPress={() => void openCurrentRoute()}><Text style={s.missingButtonText}>길찾기 다시 보기</Text></Pressable> : null}
        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="course"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToNearbyBrowse(navigation)}
        onRecord={() => resetToActivityRecord(navigation)}
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
