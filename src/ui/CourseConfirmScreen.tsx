import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import type { CompleteCourseInput } from '../services/courseCompletionRepository';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useActiveVerifiedCourseFlow } from './AppFlowContext';
import { KakaoRouteMap } from './KakaoRouteMap';
import { createActiveVerifiedCourseStartController, matchesActiveVerifiedCourse } from './activeVerifiedCourseModel';
import { buildActiveCourseStepRows } from './courseConfirmActiveModel';
import { courseCompletionRepository } from './courseCompletionComposition';
import { buildCompleteCourseInput, completionFailureMessage, createCourseCompletionFinishController, type CourseCompletionFinishState } from './courseCompletionUiModel';
import { openKakaoRouteWithFallback } from './execution/schedule';
import { resetToActivityRecord, resetToMain, resetToMyCourses } from './mainTabNavigation';
import type { RootStackParamList } from './nav';
import { appPrivateWalkConnectorPort } from './privateWalkConnectorComposition';
import { buildCourseV1DetailMarkers, buildCourseV1DetailModel } from './recommendation/courseV1CardDetailModel';
import { openKakaoPlaceWithAppFallback, type CourseV1DisplayPlace } from './recommendation/courseV1PlacePreviewModel';
import { buildCourseV1ConnectorRequests, buildCourseV1RouteGeometryModel, loadCourseV1WalkConnectors, type CourseV1LoadedConnector } from './recommendation/courseV1RouteGeometryModel';
import { CourseV1VerticalDetail } from './recommendation/CourseV1VerticalDetail';
import { advanceVerifiedCourseProgress, buildVerifiedCourseProgressSteps, createVerifiedCourseRouteOpenLock, markVerifiedCourseRouteOpened, nextVerifiedCourseTravel, requestNextVerifiedCourseRoute, verifiedCourseNextRouteLabel, type VerifiedCourseProgressStep } from './recommendation/verifiedCourseProgressModel';
import { C } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CourseConfirm'>;
type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const places = new Map<string, RuntimePlace>([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place]));
const EMPTY_CONNECTOR_STATE: Readonly<{ connectors: readonly CourseV1LoadedConnector[]; loading: boolean; failedCount: number }> = { connectors: [], loading: false, failedCount: 0 };
const time = (iso: string | undefined) => iso ? `${new Date(iso).getHours()}:${String(new Date(iso).getMinutes()).padStart(2, '0')}` : null;
const modeLabel = (mode: 'walk' | 'transit') => mode === 'walk' ? '도보' : '대중교통';

/** 엔진의 exact snapshot 하나를 review와 active 상태에서 함께 표시한다. */
export function CourseConfirmScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const flow = useActiveVerifiedCourseFlow();
  const { session, course } = route.params;
  const [activeId, setActiveId] = useState(route.params.activeId);
  const activeIdRef = useRef(route.params.activeId);
  const active = activeId && matchesActiveVerifiedCourse(flow.activeVerifiedCourse, activeId, session, course) ? flow.activeVerifiedCourse : null;
  const mode = activeId ? 'active' : 'review';
  const [exitTarget, setExitTarget] = useState<'home' | 'record' | 'courses' | null>(null);
  usePreventRemove(Boolean(active) && exitTarget === null, () => setExitTarget('home'));
  useEffect(() => {
    if (exitTarget === 'home') resetToMain(navigation);
    else if (exitTarget === 'record') resetToActivityRecord(navigation);
    else if (exitTarget === 'courses') resetToMyCourses(navigation);
  }, [exitTarget, navigation]);
  const [linkError, setLinkError] = useState('');
  const [isOpeningRoute, setIsOpeningRoute] = useState(false);
  const [finishState, setFinishState] = useState<CourseCompletionFinishState>({ kind: 'idle' });
  const completionInput = useRef<CompleteCourseInput | null>(null);
  const routeOpenLock = useRef(createVerifiedCourseRouteOpenLock()).current;
  const startController = useRef(createActiveVerifiedCourseStartController({
    start: (request) => flow.startActiveVerifiedCourse(request),
    navigate: (next) => {
      if (next.session === session && next.course === course) {
        activeIdRef.current = next.identity;
        setActiveId(next.identity);
      } else navigation.replace('CourseConfirm', { session: next.session, course: next.course, activeId: next.identity });
    },
    confirm: (model) => Alert.alert('진행 중인 코스가 있어요', '새 코스를 시작하면 기존 진행 상태가 종료됩니다.', [
      { text: '취소', style: 'cancel', onPress: model.actions.cancel },
      { text: '기존 코스 이어가기', onPress: model.actions.continueExisting },
      { text: '새 코스로 시작', style: 'destructive', onPress: model.actions.startNew },
    ], { cancelable: false }),
    onError: () => setLinkError('코스를 시작하지 못했어요. 다시 시도해 주세요.'),
  })).current;
  const finishController = useRef(createCourseCompletionFinishController({
    complete: (input) => courseCompletionRepository.complete(input),
    onStateChange: setFinishState,
    onFinish: ({ recorded }) => {
      const identity = activeIdRef.current;
      if (identity) flow.clearActiveVerifiedCourse(identity);
      setExitTarget(recorded ? 'record' : 'courses');
    },
  })).current;
  const [connectorState, setConnectorState] = useState(EMPTY_CONNECTOR_STATE);
  const detail = buildCourseV1DetailModel(course, session, (id) => places.get(id));
  const markers = detail ? buildCourseV1DetailMarkers(detail, session) : null;
  const mapMarkers = markers?.map((marker) => ({ ...marker, active: false })) ?? null;
  // Valid one/two-stop snapshots produce only missing endpoints (at most 4/6).
  const connectorRequests = useMemo(() => buildCourseV1ConnectorRequests(course, session, (id) => places.get(id)), [course, session]);
  const steps = useMemo(() => buildVerifiedCourseProgressSteps(course, session.origin, session.destination ?? session.origin, (id) => {
    const place = places.get(id);
    return place ? { id: place.contentId, label: place.title, lat: place.lat, lon: place.lon } : undefined;
  }), [course, session]);

  useEffect(() => {
    let mounted = true;
    if (!detail || !mapMarkers || connectorRequests.length === 0) {
      setConnectorState(EMPTY_CONNECTOR_STATE);
      return () => { mounted = false; };
    }
    if (!appPrivateWalkConnectorPort) {
      setConnectorState({ connectors: [], loading: false, failedCount: connectorRequests.length });
      return () => { mounted = false; };
    }
    setConnectorState({ connectors: [], loading: true, failedCount: 0 });
    loadCourseV1WalkConnectors(connectorRequests, appPrivateWalkConnectorPort).then((result) => { if (mounted) setConnectorState({ ...result, loading: false }); });
    return () => { mounted = false; };
  }, [Boolean(detail && mapMarkers), connectorRequests]);
  useEffect(() => navigation.addListener('focus', startController.reset), [navigation, startController]);

  const routeGeometry = useMemo(() => buildCourseV1RouteGeometryModel(course, connectorState.connectors), [course, connectorState.connectors]);
  const state = active?.progress;
  const current = steps?.[state?.stepIndex ?? -1];
  const stepRows = steps && state ? buildActiveCourseStepRows(steps, state) : [];
  const completionFailed = finishState.kind === 'failure';
  const completionSaving = finishState.kind === 'saving';
  const openPlace = async (place: CourseV1DisplayPlace) => {
    const status = await openKakaoPlaceWithAppFallback(place, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openExternal: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
    setLinkError(status === 'app_opened' || status === 'external_opened' || status === 'browser_fallback_opened' ? '' : '카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
  };
  const openTravel = async (travel: Extract<VerifiedCourseProgressStep, { kind: 'travel' }>) => {
    if (!routeOpenLock.tryLock()) return false;
    setIsOpeningRoute(true);
    try {
      const result = await openKakaoRouteWithFallback({ from: { name: travel.from.label, point: travel.from }, to: { name: travel.target.label, point: travel.target } }, travel.mode, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openWeb: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
      if (result === 'failed' || result === 'invalid_stage') { setLinkError('카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.'); return false; }
      setLinkError(''); return true;
    } finally { setIsOpeningRoute(false); routeOpenLock.release(); }
  };
  const openCurrentRoute = async () => {
    if (!steps || !state || !current || current.kind !== 'travel' || !activeId) return;
    if (await openTravel(current)) flow.updateActiveVerifiedCourse(activeId, (value) => value === state ? markVerifiedCourseRouteOpened(steps, value) : value);
  };
  const openNextRoute = async () => {
    if (!steps || !state || !nextVerifiedCourseTravel(steps, state) || !activeId) return;
    const outcome = await requestNextVerifiedCourseRoute(steps, state, openTravel);
    if (outcome.result === 'opened') flow.updateActiveVerifiedCourse(activeId, (value) => value === state ? outcome.state : value);
  };
  const advance = () => { if (steps && activeId) flow.updateActiveVerifiedCourse(activeId, (value) => value === state ? advanceVerifiedCourseProgress(steps, value) : value); };
  const finish = () => {
    if (!active) return;
    if (!completionInput.current) {
      const projected = buildCompleteCourseInput(active, (id) => places.get(id), Date.now());
      if (projected.status !== 'ready') { finishController.failInvalidSnapshot(); return; }
      completionInput.current = projected.input;
    }
    void finishController.finish(completionInput.current);
  };
  const finishFinalTravel = () => { if (steps && state && advanceVerifiedCourseProgress(steps, state).finished) finish(); };
  const cancelActive = () => {
    if (!activeId) return;
    Alert.alert('코스를 취소할까요?', '현재 진행 상태가 삭제됩니다.', [
      { text: '계속 진행', style: 'cancel' },
      { text: '코스 취소', style: 'destructive', onPress: () => { flow.clearActiveVerifiedCourse(activeId); setExitTarget('home'); } },
    ]);
  };

  const header = <View style={s.header}><Pressable variant="icon" accessibilityLabel={mode === 'active' ? '메인으로 돌아가기' : '추천 결과로 돌아가기'} style={s.icon} onPress={() => mode === 'active' ? setExitTarget('home') : navigation.goBack()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>{mode === 'active' ? '코스 진행' : '코스 확인'}</Text><View accessible={false} importantForAccessibility="no" style={s.headerSpacer} /></View>;
  if (!detail || !steps) return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}<View style={s.invalid}><Text style={s.invalidTitle}>코스 정보를 안전하게 표시할 수 없어요</Text><Text style={s.copy}>추천 결과로 돌아가 다시 선택해 주세요.</Text></View></ScrollView></View>;

  const nextTravel = state ? nextVerifiedCourseTravel(steps, state) : null;
  const primaryLabel = completionFailed ? '다시 시도' : state?.finished ? '코스 마치기' : current?.kind === 'travel'
    ? state?.routeOpened ? (current.isFinal ? '도착 후 코스 마치기' : '이동을 마치고 다음으로') : '카카오맵에서 길찾기'
    : nextTravel ? verifiedCourseNextRouteLabel(nextTravel.isFinal, Boolean(session.destination)) : '다음 장소 길찾기';
  const primaryAction = completionFailed ? finish : state?.finished ? finish : current?.kind === 'travel' && !state?.routeOpened
    ? () => void openCurrentRoute() : current?.kind === 'travel' && current.isFinal ? finishFinalTravel : current?.kind === 'stay' ? () => void openNextRoute() : advance;

  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}
    {mapMarkers ? <View style={s.mapFrame}><KakaoRouteMap points={mapMarkers.map(({ lat, lon }) => ({ lat, lon }))} line={[]} segments={routeGeometry.segments} markers={mapMarkers} showMarkerLabels showRouteLegend={false} safeErrorPresentation boundsPadding={{ top: 48, right: 38, bottom: 64, left: 38 }} style={s.map} />{routeGeometry.legend.length ? <View accessible accessibilityLabel={routeGeometry.accessibilityLabel} pointerEvents="none" style={s.routeLegend}>{routeGeometry.legend.map((item) => <View key={item.mode} style={s.routeLegendRow}><View style={[s.routeLegendLine, item.mode === 'transit' && s.routeLegendTransit]} /><Text style={s.routeLegendText}>{item.label}</Text></View>)}</View> : null}<View pointerEvents="none" style={s.routeStatus}>{connectorState.loading ? <Text accessibilityLiveRegion="polite" style={s.routeStatusText}>도보 연결을 확인하는 중이에요</Text> : null}{connectorState.failedCount > 0 ? <Text accessibilityRole="alert" style={s.routeStatusText}>일부 도보 경로선을 표시하지 못했어요</Text> : null}{routeGeometry.missingMessage ? <Text accessibilityRole="alert" style={s.routeStatusText}>{routeGeometry.missingMessage}</Text> : null}</View></View> : <View accessibilityLabel="코스 지도 위치를 표시할 수 없음" style={s.mapFallback}><Text style={s.mapFallbackTitle}>지도 위치를 표시할 수 없어요</Text><Text style={s.copy}>아래 검증 코스는 계속 확인할 수 있어요.</Text></View>}
    <CourseV1VerticalDetail model={detail} mode={mode} onOpenKakao={openPlace} progress={state && current ? {
      rows: stepRows,
      actionStepIndex: current.kind === 'stay' ? state.stepIndex + 1 : state.stepIndex,
      action: <>{completionFailed ? <Text accessibilityRole="alert" style={s.error}>{completionFailureMessage(finishState.reason)}</Text> : null}<Pressable testID="verified-progress-primary" accessibilityLabel={primaryLabel} disabled={isOpeningRoute || completionSaving} style={[s.primary, (isOpeningRoute || completionSaving) && s.disabled]} onPress={primaryAction}><Text style={s.primaryText}>{isOpeningRoute ? '카카오맵을 열고 있어요' : completionSaving ? '기록 저장 중' : primaryLabel}</Text></Pressable></>,
    } : undefined} />
    {linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}
    {mode === 'review' ? <Pressable testID="verified-course-start" accessibilityLabel="코스 시작하기" style={s.primary} onPress={() => startController.request(flow.activeVerifiedCourse, { session, course })}><Text style={s.primaryText}>코스 시작하기</Text></Pressable> : state && current ? completionFailed ? <Pressable testID="finish-without-record" accessibilityLabel="기록 없이 마치기" style={s.secondary} onPress={finishController.finishWithoutRecord}><Text style={s.secondaryText}>기록 없이 마치기</Text></Pressable> : <Pressable testID="active-course-cancel" accessibilityLabel="진행 중인 코스 취소" style={s.secondary} onPress={cancelActive}><Text style={s.secondaryText}>코스 취소</Text></Pressable> : <View style={s.invalid}><Text style={s.invalidTitle}>진행 상태를 열지 못했어요</Text><Text style={s.copy}>메인에서 진행 중인 코스를 다시 열어 주세요.</Text></View>}
  </ScrollView></View>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 16, paddingBottom: 34 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, headerSpacer: { width: 42, height: 42 }, back: { color: C.txt, fontSize: 32, lineHeight: 34 }, title: { color: C.txt, fontSize: 17, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20 }, mapFrame: { height: 280, marginHorizontal: -22, overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.panel }, map: { flex: 1 }, routeLegend: { position: 'absolute', right: 10, bottom: 10, gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(17,24,32,0.9)' }, routeLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, routeLegendLine: { width: 24, height: 4, borderRadius: 4, backgroundColor: C.accent }, routeLegendTransit: { height: 0, borderTopWidth: 4, borderStyle: 'dashed', borderColor: C.amber, backgroundColor: 'transparent' }, routeLegendText: { color: C.txt2, fontSize: 11, fontWeight: '700' }, routeStatus: { position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'center', gap: 6 }, routeStatusText: { paddingHorizontal: 10, paddingVertical: 7, overflow: 'hidden', borderRadius: 8, color: C.txt2, backgroundColor: 'rgba(17,24,32,0.9)', fontSize: 11, fontWeight: '700' }, mapFallback: { height: 180, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, mapFallbackTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, invalid: { minHeight: 260, alignItems: 'center', justifyContent: 'center' }, invalidTitle: { color: C.txt, fontSize: 22, lineHeight: 30, fontWeight: '800', textAlign: 'center' }, primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' }, disabled: { opacity: 0.62 }, secondary: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, secondaryText: { color: C.txt2, fontSize: 14, fontWeight: '800' }, currentCard: { padding: 18, gap: 7, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, kicker: { color: '#78b7ff', fontSize: 13, fontWeight: '800' }, currentTitle: { color: C.txt, fontSize: 22, lineHeight: 30, fontWeight: '800' }, sequence: { gap: 8 }, sequenceTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, stepRow: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.panel }, currentRow: { borderWidth: 1, borderColor: C.accent }, completeStep: { color: C.green, fontSize: 14, fontWeight: '800' }, currentStep: { color: C.txt, fontSize: 14, fontWeight: '800' }, futureStep: { color: C.muted, fontSize: 14 }, error: { color: C.red, fontSize: 13, lineHeight: 19 } });
