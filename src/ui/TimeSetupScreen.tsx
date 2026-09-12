import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { UnifiedSetupInputs } from './timeSetup/UnifiedSetupInputs';
import { createSetupRunGuard, unifiedSetupLayout } from './timeSetup/unifiedSetupModel';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LatLon, timeContext } from '../engine';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { MapPlacePicker } from './MapPlacePicker';
import { Appointment, fmtHM, RecommendationSession, RootStackParamList } from './nav';
import { withManualLocationProof } from './manualLocationRestoreModel';
import { PlacePicker } from './PlacePicker';
import { createLocationSearchDraft } from './locationSearchDraft';
import { C } from './theme';
import { TimeWheel } from './TimeWheel';
import { createArrivalBufferInteraction, type ArrivalBufferDecision } from './arrivalBufferInteraction';
import { dispatchSelectionHaptic } from './selectionHaptic';
import { requestExpoSelectionHaptic } from './expoSelectionHaptic';
import { useAppFlow } from './AppFlowContext';
import { hourBucketForMinute, resolveTimeSetupClock, suggestedEndForTestClock } from './timeSetup/testClock';
import { clampReleasePresetMinutes, releaseTimeSetupValidation } from './timeSetup/releaseTimeBoundary';
import { datedMinuteLabel, resolveArrivalMinute, remainingSetupMinutes, setupDeadlineIso } from './timeSetup/datedSetupTime';
import { runRecommendationSession } from './recommendation/v1Session';
import { RecommendationLoadingProgress } from './recommendation/RecommendationLoadingProgress';
import { advanceRecommendationProgress, type RecommendationProgressStage } from './recommendation/recommendationLoadingModel';
import { captureRecommendationNowIso, startMinuteForRecommendation } from './recommendation/recommendationSessionTime';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { pickerInitialCenter } from './locationPickerRecoveryModel';
import { CaptchaVerificationSheet } from './CaptchaVerificationSheet';
import { useAuth } from './AuthContext';
import { resolveCaptchaChallengeUrl } from './captchaVerificationModel';
import { recommendationFailureDisplay, recommendationGateDecision } from './captchaRecommendationGateModel';
import { QA_RELEASE_ONE_STOP_SCENARIOS, buildQaReleaseOneStopReceipt, buildQaReleaseOneStopSession, createQaReleaseOneStopRunController, nextQaReleaseOneStopScenarioId, qaReleaseOneStopLauncherEnabled, qaReleaseOneStopReceiptLine, type QaReleaseOneStopRunToken, type QaReleaseOneStopScenarioId } from './qaReleaseOneStopLauncherModel';
import { createAppLiveActivityA3CleanupController, createAppLiveActivityA3Controller } from './liveActivity/a3VerificationComposition';
import type { LiveActivityA3Result } from './liveActivity/a3VerificationModel';
import { buildA3FixturePayload } from './liveActivity/lifecyclePolicy';
import { clearLiveActivityDiagnosticReport, copyLiveActivityDiagnosticReport, liveActivityDiagnosticsEnabled, readLiveActivityDiagnosticReport } from './liveActivity/liveActivityDiagnostics';

const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
const MERIDIEMS = ['오전', '오후'] as const;
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
type Page = 'setup' | 'test-clock' | 'qa-launcher' | 'live-diagnostics' | 'loading';
type PickTarget = 'origin' | 'destination' | null;
type Props = NativeStackScreenProps<RootStackParamList, 'TimeSetup'>;
type QaCaptchaRequest = Readonly<{ runToken: QaReleaseOneStopRunToken; session: RecommendationSession }>;

function to12(min: number) { const hour24 = Math.floor(min / 60) % 24; return { pm: hour24 >= 12, hour: hour24 % 12 || 12, minute: min % 60 }; }
function to24(pm: boolean, hour12: number, minute: number) { return ((pm ? 12 : 0) + (hour12 % 12)) * 60 + minute; }
const SHOW_TEST_CLOCK = typeof __DEV__ !== 'undefined' && __DEV__;

export function TimeSetupScreen({ navigation, route }: Props) {
  const flow = useAppFlow();
  const { session: authSession, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const [footerHeight, setFooterHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const layout = unifiedSetupLayout(dimensions.height, insets.top, insets.bottom, dimensions.fontScale, footerHeight);
  const [clockDate, setClockDate] = useState(() => new Date());
  const realNow = useMemo(() => timeContext(clockDate), [clockDate]);
  const [testNowMin, setTestNowMin] = useState<number | null>(null);
  const now = resolveTimeSetupClock(realNow, testNowMin);
  const initialEnd = now.nowMin + clampReleasePresetMinutes(route.params?.presetMin);
  const initial12 = to12(initialEnd);
  const [page, setPage] = useState<Page>('setup');
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [originLabel, setOriginLabel] = useState('출발지 선택');
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [pm, setPm] = useState(initial12.pm);
  const [hour12, setHour12] = useState(initial12.hour);
  const [minute, setMinute] = useState(initial12.minute);
  const [arrivalBufferMin, setArrivalBufferMin] = useState(10);
  const arrivalBufferInteraction = useRef(createArrivalBufferInteraction(10)).current;
  const testInitial = to12(realNow.nowMin);
  const [testPm, setTestPm] = useState(testInitial.pm);
  const [testHour12, setTestHour12] = useState(testInitial.hour);
  const [testMinute, setTestMinute] = useState(testInitial.minute);
  const [mapTarget, setMapTarget] = useState<PickTarget>(null);
  const [searchTarget, setSearchTarget] = useState<PickTarget>(null);
  const pickerRequest = useRef(0);
  const locationEditingSession = useRef(createLocationSearchDraft()).current;
  const [loadingStage, setLoadingStage] = useState<RecommendationProgressStage | null>(null);
  const [loadingUntilMin, setLoadingUntilMin] = useState(initialEnd);
  const [error, setError] = useState('');
  const [captchaDiagnostic, setCaptchaDiagnostic] = useState<string | null>(null);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [qaCaptchaRequest, setQaCaptchaRequest] = useState<QaCaptchaRequest | null>(null);
  const [qaRunLocked, setQaRunLocked] = useState(false);
  const [qaLastFinishedId, setQaLastFinishedId] = useState<QaReleaseOneStopScenarioId | null>(null);
  const [a3Running, setA3Running] = useState(false);
  const [a3Status, setA3Status] = useState('');
  const [liveDiagnosticLines, setLiveDiagnosticLines] = useState<readonly string[]>([]);
  const [liveDiagnosticStatus, setLiveDiagnosticStatus] = useState<'idle' | 'loading' | 'unavailable' | 'empty' | 'ready' | 'failed'>('idle');
  const [liveDiagnosticCopyStatus, setLiveDiagnosticCopyStatus] = useState('');
  const qaRunController = useRef(createQaReleaseOneStopRunController()).current;
  const a3Controller = useRef(createAppLiveActivityA3Controller()).current;
  const a3CleanupController = useRef(createAppLiveActivityA3CleanupController()).current;
  const locationLabel = useRef(createKakaoLocationLabelAdapter()).current;
  const runGuard = useRef(createSetupRunGuard()).current;
  const recommendationEpoch = useRef(0);
  const runningQaToken = useRef<QaReleaseOneStopRunToken | null>(null);
  useEffect(() => () => { recommendationEpoch.current++; }, []);
  const endMin = resolveArrivalMinute(now.nowMin, to24(pm, hour12, minute));
  const remainingMin = endMin - now.nowMin;
  const validation = releaseTimeSetupValidation(Boolean(origin), remainingMin);
  const captchaChallengeUrl = useMemo(() => resolveCaptchaChallengeUrl(process.env.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL), []);
  const routeProxyEnabled = process.env.EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true';
  const captchaDiagnosticsEnabled = process.env.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true';
  const recommendationDiagnostics = process.env.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS;
  const liveDiagnosticsEnabled = liveActivityDiagnosticsEnabled(SHOW_TEST_CLOCK, recommendationDiagnostics);
  const qaLauncherEnabled = qaReleaseOneStopLauncherEnabled(SHOW_TEST_CLOCK, recommendationDiagnostics);
  const a3LauncherEnabled = qaLauncherEnabled;
  const qaPlaceNames = useMemo(() => qaLauncherEnabled ? new Map([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place.title])) : null, [qaLauncherEnabled]);
  const applyArrivalBufferDecision = (decision: ArrivalBufferDecision) => {
    setArrivalBufferMin(decision.value);
    dispatchSelectionHaptic(decision.haptic, requestExpoSelectionHaptic);
  };

  useEffect(() => {
    const invalidate = () => { pickerRequest.current++; locationEditingSession.end(); };
    const unsubscribe = navigation.addListener('blur', invalidate);
    return () => { invalidate(); unsubscribe(); };
  }, [navigation, locationEditingSession]);

  const applyPlace = (target: Exclude<PickTarget, null>, point: LatLon, label: string, source?: 'device' | 'provider' | 'map') => {
    if (source === 'device') return; // Retired device selections cannot re-enter manual setup.
    setError('');
    if (target === 'origin') { setOrigin(point); setOriginLabel(label); }
    else setAppointment({ label, ...point });
  };
  const emitQaReceipt = (receipt: ReturnType<typeof buildQaReleaseOneStopReceipt>) => {
    const line = qaReleaseOneStopReceiptLine(SHOW_TEST_CLOCK, recommendationDiagnostics, receipt);
    if (line) console.info(line);
  };
  const executeRecommendation = async (session: RecommendationSession, input: { captchaToken?: string; proxyEnabled: boolean; qaRunToken?: QaReleaseOneStopRunToken }) => {
    const epoch = ++recommendationEpoch.current;
    runningQaToken.current = input.qaRunToken ?? null;
    const isCurrent = () => epoch === recommendationEpoch.current;
    setError(''); setCaptchaDiagnostic(null);
    setLoadingStage(null);
    setLoadingUntilMin(startMinuteForRecommendation(session.nowIso) + session.remainingMin);
    setPage('loading');
    try {
      if (input.qaRunToken && !qaRunController.isCurrent(input.qaRunToken)) return;
      const result = await runRecommendationSession(session, {
        routeProxyEnabled: input.proxyEnabled,
        captchaToken: input.captchaToken,
        onProgress: (stage) => {
          if (!isCurrent()) return;
          if (input.qaRunToken && !qaRunController.isCurrent(input.qaRunToken)) return;
          setLoadingStage((current) => advanceRecommendationProgress(current, stage));
        },
      });
      if (!isCurrent()) return;
      if (input.qaRunToken && !qaRunController.isCurrent(input.qaRunToken)) return;
      const params: RootStackParamList['Results'] = { session, result };
      flow.setLatestResults(params);
      if (input.qaRunToken) {
        emitQaReceipt(buildQaReleaseOneStopReceipt(input.qaRunToken.scenarioId, result, (placeId) => qaPlaceNames?.get(placeId)));
        qaRunController.finish(input.qaRunToken);
        setQaLastFinishedId(input.qaRunToken.scenarioId);
        setQaRunLocked(false);
        setPage('qa-launcher');
        navigation.navigate('Results', params);
      } else {
        runGuard.reset();
        setPage('setup');
        navigation.navigate('Results', params);
      }
    } catch (reason) {
      if (!isCurrent()) return;
      if (input.qaRunToken && !qaRunController.isCurrent(input.qaRunToken)) return;
      const failure = recommendationFailureDisplay(reason, captchaDiagnosticsEnabled);
      setError(failure.message); setCaptchaDiagnostic(failure.diagnostic);
      if (input.qaRunToken) {
        emitQaReceipt(buildQaReleaseOneStopReceipt(input.qaRunToken.scenarioId, null, undefined, reason));
        qaRunController.finish(input.qaRunToken);
        setQaLastFinishedId(input.qaRunToken.scenarioId);
        setQaRunLocked(false);
        setPage('qa-launcher');
      } else { runGuard.reset(); setPage('setup'); }
    }
  };
  const startManualRecommendation = async (captchaToken?: string, proxyEnabled = routeProxyEnabled) => {
    if (validation || !origin) { runGuard.reset(); setError(validation); return; }
    const target = appointment ? { id: 'destination', lat: appointment.lat, lon: appointment.lon, label: appointment.label } : null;
    const nowIso = captureRecommendationNowIso(testNowMin == null ? new Date() : clockDate, testNowMin);
    const sessionRemainingMin = remainingSetupMinutes(setupDeadlineIso(clockDate, endMin), nowIso);
    const sessionValidation = releaseTimeSetupValidation(true, sessionRemainingMin);
    if (sessionValidation) { runGuard.reset(); setError(sessionValidation); return; }
    const session: RecommendationSession = withManualLocationProof({ nowIso, origin: { id: 'origin', ...origin, label: originLabel }, destination: target, remainingMin: sessionRemainingMin, arrivalBufferMin });
    await executeRecommendation(session, { captchaToken, proxyEnabled });
  };
  const run = () => {
    if (page !== 'setup' || searchTarget || mapTarget || runGuard.busy()) return;
    setCaptchaDiagnostic(null);
    if (validation || !origin) { setError(validation); return; }
    if (isAuthLoading) { setError('계정 상태를 확인 중이에요. 잠시 후 다시 시도해 주세요.'); return; }
    const decision = recommendationGateDecision({ routeProxyEnabled, hasSession: Boolean(authSession), hasValidChallengeUrl: Boolean(captchaChallengeUrl) });
    if (decision.kind === 'show_captcha') { if (!runGuard.begin(true)) return; setQaCaptchaRequest(null); setCaptchaVisible(true); return; }
    if (decision.kind === 'fail_missing_challenge') { setError('안전 확인을 준비하지 못했어요. 다시 시도해 주세요.'); return; }
    if (runGuard.begin(false)) void startManualRecommendation(undefined, decision.kind === 'start_proxy');
  };
  const finishQaBeforeRecommendation = (runToken: QaReleaseOneStopRunToken, reason: unknown, message: string) => {
    if (!qaRunController.beginRecommendation(runToken)) return;
    emitQaReceipt(buildQaReleaseOneStopReceipt(runToken.scenarioId, null, undefined, reason));
    qaRunController.finish(runToken);
    setQaLastFinishedId(runToken.scenarioId);
    setQaRunLocked(false);
    setError(message);
    setPage('qa-launcher');
  };
  const runQaScenario = (scenarioId: QaReleaseOneStopScenarioId) => {
    if (!qaLauncherEnabled) return;
    const runToken = qaRunController.select(scenarioId);
    if (!runToken) return;
    setQaRunLocked(true);
    setError(''); setCaptchaDiagnostic(null);
    const session = buildQaReleaseOneStopSession(scenarioId, new Date());
    if (isAuthLoading) {
      finishQaBeforeRecommendation(runToken, { reason: 'anonymous_auth_failed' }, '계정 상태를 확인 중이에요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const decision = recommendationGateDecision({ routeProxyEnabled, hasSession: Boolean(authSession), hasValidChallengeUrl: Boolean(captchaChallengeUrl) });
    if (decision.kind === 'show_captcha') { setQaCaptchaRequest({ runToken, session }); setCaptchaVisible(true); return; }
    if (decision.kind === 'fail_missing_challenge') {
      finishQaBeforeRecommendation(runToken, { reason: 'route_proxy_unconfigured' }, '안전 확인을 준비하지 못했어요. 다시 시도해 주세요.');
      return;
    }
    if (!qaRunController.beginRecommendation(runToken)) return;
    void executeRecommendation(session, { proxyEnabled: decision.kind === 'start_proxy', qaRunToken: runToken });
  };
  const describeA3Result = (result: LiveActivityA3Result): string => {
    if (result.kind === 'started') return `Live Activity 시작됨 · 전환 시 앱 ${result.applicationState ?? 'unknown'}`;
    if (result.kind === 'already_active') return `기존 Live Activity 유지 · 앱 ${result.applicationState ?? 'unknown'}`;
    if (result.kind === 'activity_disabled') return '설정에서 Live Activities를 켜 주세요.';
    if (result.kind === 'cleanup_required') return '기존 테스트 Activity를 먼저 종료해 주세요.';
    if (result.kind === 'unsupported') return '이 기기 또는 빌드에서는 Live Activity를 사용할 수 없어요.';
    if (result.kind === 'handoff_failed') return '카카오맵 전환 실패 · Live Activity를 시작하지 않았어요.';
    if (result.kind === 'opened_without_activity') return '카카오맵 전환 성공 · Live Activity 시작은 실패했어요.';
    return '이미 확인을 실행 중이에요.';
  };
  const runLiveActivityA3 = async () => {
    if (!a3LauncherEnabled || a3Running) return;
    setA3Running(true);
    setA3Status('카카오맵 전환 확인 중…');
    const result = await a3Controller.run(buildA3FixturePayload(Date.now()));
    setA3Status(describeA3Result(result));
    setA3Running(false);
  };
  const cleanupLiveActivityA3 = async () => {
    if (!a3LauncherEnabled || a3Running) return;
    setA3Running(true);
    setA3Status('테스트 Activity 종료 확인 중…');
    try {
      const result = await a3CleanupController.cleanupTestFixtures();
      if (result.status === 'ended') setA3Status('테스트 Live Activity를 종료했어요.');
      else if (result.status === 'already_ended') setA3Status('종료할 테스트 Live Activity가 없어요.');
      else setA3Status(`일부 테스트 Activity 종료 실패 · ${result.failedActivityIds.length}개 재시도 필요`);
    } catch { setA3Status('테스트 Activity 종료 실패 · 다시 시도해 주세요.'); }
    setA3Running(false);
  };
  const readLiveDiagnostics = async () => {
    if (!liveDiagnosticsEnabled) return;
    setLiveDiagnosticStatus('loading'); setLiveDiagnosticCopyStatus('');
    const report = await readLiveActivityDiagnosticReport();
    setLiveDiagnosticLines(report.lines); setLiveDiagnosticStatus(report.status);
  };
  const copyLiveDiagnostics = async () => {
    const result = await copyLiveActivityDiagnosticReport();
    setLiveDiagnosticCopyStatus(result.status === 'copied' ? `진단 ${result.entryCount}건을 복사했어요.` : '진단을 복사하지 못했어요.');
  };
  const clearLiveDiagnostics = async () => {
    try { await clearLiveActivityDiagnosticReport(); setLiveDiagnosticLines([]); setLiveDiagnosticStatus('empty'); setLiveDiagnosticCopyStatus('진단 기록만 비웠어요.'); }
    catch { setLiveDiagnosticCopyStatus('진단 기록을 비우지 못했어요.'); }
  };
  const back = () => {
    if (page === 'setup') navigation.goBack();
    else setPage('setup');
  };
  const closeCaptcha = () => {
    setCaptchaVisible(false);
    if (!qaCaptchaRequest) { runGuard.reset(); return; }
    qaRunController.cancel(qaCaptchaRequest.runToken);
    setQaCaptchaRequest(null);
    setQaRunLocked(false);
    setPage('qa-launcher');
  };
  const verifiedCaptcha = (captchaToken: string) => {
    setCaptchaVisible(false);
    const request = qaCaptchaRequest;
    setQaCaptchaRequest(null);
    if (!request) { if (runGuard.verifyCaptcha()) void startManualRecommendation(captchaToken, true); return; }
    if (!qaRunController.beginRecommendation(request.runToken)) return;
    void executeRecommendation(request.session, { captchaToken, proxyEnabled: true, qaRunToken: request.runToken });
  };
  usePreventRemove(Boolean(searchTarget || mapTarget || captchaVisible || page !== 'setup'), () => {
    if (page === 'loading') {
      recommendationEpoch.current++;
      runGuard.reset();
      if (runningQaToken.current) qaRunController.cancel(runningQaToken.current);
      runningQaToken.current = null;
      setQaRunLocked(false);
      setPage('setup');
    } else if (captchaVisible) closeCaptcha();
    else if (mapTarget) { pickerRequest.current++; locationEditingSession.resume(); setSearchTarget(mapTarget); setMapTarget(null); }
    else if (searchTarget) { pickerRequest.current++; locationEditingSession.end(); setSearchTarget(null); }
    else setPage('setup');
  });
  const captchaSheet = <CaptchaVerificationSheet visible={captchaVisible} challengeUrl={captchaChallengeUrl} onClose={closeCaptcha} onVerified={verifiedCaptcha} />;
  const Header = ({ title, compact = false }: { title: string; compact?: boolean }) => <View style={[s.header, compact && { marginBottom: 0, height: undefined, minHeight: 52 }]}><Pressable variant="icon" onPress={back} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={[s.headerTitle, compact && { flex: 1, textAlign: 'center' }]}>{title}</Text><View accessible={false} importantForAccessibility="no" style={s.headerSpacer} /></View>;
  if (page === 'loading') return <View style={s.root}><View style={[s.loading, { paddingTop: insets.top, paddingBottom: insets.bottom }]}><Text style={s.loadingEyebrow}>{datedMinuteLabel(loadingUntilMin)}까지 계산 중</Text><Text style={s.loadingTitle}>시간 안에 들를 곳을{`\n`}찾고 있어요</Text><RecommendationLoadingProgress stage={loadingStage} /></View></View>;
  if (page === 'test-clock') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="테스트 현재 시각" /><Text style={s.smallCopy}>개발 테스트에서만 추천과 운영시간 판단 시각을 바꿉니다.</Text><View style={s.wheelPanel}><View style={s.meridiem}><TimeWheel accessibilityLabel="테스트 현재 시각 오전 오후" values={MERIDIEMS} index={testPm ? 1 : 0} onChange={(index) => setTestPm(index === 1)} /></View><View style={s.wheelCol}><TimeWheel accessibilityLabel="테스트 현재 시각 시" values={HOURS_12} index={testHour12 - 1} onChange={(index) => setTestHour12(index + 1)} /></View><View style={s.wheelCol}><TimeWheel accessibilityLabel="테스트 현재 시각 분" values={MINUTES} index={testMinute} onChange={setTestMinute} /></View></View><Pressable style={s.primary} onPress={() => { const next = to24(testPm, testHour12, testMinute); const endMinute = suggestedEndForTestClock(next); const end = to12(endMinute); setClockDate(new Date()); setTestNowMin(next); setPm(end.pm); setHour12(end.hour); setMinute(end.minute); setPage('setup'); }}><Text style={s.primaryText}>테스트 시각 적용</Text></Pressable><Pressable style={s.secondary} onPress={() => { const current = new Date(); const endMinute = suggestedEndForTestClock(current.getHours() * 60 + current.getMinutes()); const end = to12(endMinute); setClockDate(current); setTestNowMin(null); setPm(end.pm); setHour12(end.hour); setMinute(end.minute); setPage('setup'); }}><Text style={s.secondaryText}>실제 현재 시각으로 복원</Text></Pressable></ScrollView></View>;
  if (page === 'qa-launcher' && qaLauncherEnabled) {
    const nextScenarioId = nextQaReleaseOneStopScenarioId(qaLastFinishedId);
    return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="출시 추천 QA" /><Text style={s.smallCopy}>같은 날짜 15:00 · 도착 전 여유 10분으로 실제 인증과 출시 추천 경로를 한 건씩 실행합니다.</Text>{nextScenarioId ? <Text testID="qa-next-scenario" style={s.qaNext}>다음 시나리오: {nextScenarioId}</Text> : <Text testID="qa-next-scenario" style={s.qaNext}>8개 시나리오를 모두 실행했어요</Text>}{QA_RELEASE_ONE_STOP_SCENARIOS.map((scenario) => <Pressable key={scenario.id} testID={`qa-scenario-${scenario.id}`} accessibilityLabel={`${scenario.id} ${scenario.origin.label}에서 ${scenario.destination?.label ?? '출발지 복귀'} ${scenario.remainingMin}분 실행`} disabled={qaRunLocked} style={[s.qaScenario, qaRunLocked && s.primaryOff]} onPress={() => runQaScenario(scenario.id)}><View><Text style={s.rowTitle}>{scenario.id}</Text><Text style={s.rowValue}>{scenario.origin.label} → {scenario.destination?.label ?? '출발지 복귀'}</Text></View><Text style={s.qaMinutes}>{scenario.remainingMin}분</Text></Pressable>)}{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{captchaDiagnostic ? <Text testID="route-proxy-diagnostic" style={s.diagnostic}>CAPTCHA 진단: {captchaDiagnostic}</Text> : null}</ScrollView>{captchaSheet}</View>;
  }
  if (page === 'live-diagnostics' && liveDiagnosticsEnabled) return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="Live Activity 버튼 진단" /><Text style={s.smallCopy}>이 기기에만 저장된 최근 버튼·앱 반영 단계입니다. 코스나 기록은 지우지 않습니다.</Text><Pressable testID="live-activity-diagnostics-refresh" style={s.devRow} onPress={() => void readLiveDiagnostics()}><Text style={s.devText}>진단 조회</Text><Text style={s.devText}>{liveDiagnosticStatus === 'loading' ? '읽는 중…' : '새로고침 ›'}</Text></Pressable>{liveDiagnosticStatus === 'unavailable' ? <Text accessibilityRole="alert" style={s.devStatus}>이 빌드에서는 진단을 조회할 수 없어요.</Text> : null}{liveDiagnosticStatus === 'failed' ? <Text accessibilityRole="alert" style={s.devStatus}>진단 조회에 실패했어요.</Text> : null}{liveDiagnosticStatus === 'empty' ? <Text style={s.devStatus}>현재 빌드 정보만 있으며 버튼 기록은 없어요.</Text> : null}{liveDiagnosticLines.length ? <View testID="live-activity-diagnostics-report" style={s.diagnosticPanel}>{liveDiagnosticLines.map((line, index) => <Text key={`${index}:${line}`} selectable style={s.diagnosticLine}>{line}</Text>)}</View> : null}<Pressable testID="live-activity-diagnostics-copy" style={s.devRow} onPress={() => void copyLiveDiagnostics()}><Text style={s.devText}>진단 복사</Text><Text style={s.devText}>허용 필드만 ›</Text></Pressable><Pressable testID="live-activity-diagnostics-clear" style={s.devRow} onPress={() => void clearLiveDiagnostics()}><Text style={s.devText}>새 관찰 시작</Text><Text style={s.devText}>진단만 비우기 ›</Text></Pressable>{liveDiagnosticCopyStatus ? <Text accessibilityRole="alert" style={s.devStatus}>{liveDiagnosticCopyStatus}</Text> : null}</ScrollView></View>;
  const openPicker = (target: Exclude<PickTarget, null>) => {
    if (runGuard.busy()) return;
    pickerRequest.current++; locationEditingSession.start(target); setMapTarget(null); setError(''); setSearchTarget(target);
  };
  return <View style={[s.root, { paddingTop: insets.top }]}>
    <ScrollView testID="setup-scroll" style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
      onLayout={({ nativeEvent }) => setViewportHeight(nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => setContentHeight(height)}
      scrollEnabled={contentHeight > (viewportHeight || layout.viewportHeight)}>
      <View pointerEvents={captchaVisible || searchTarget || mapTarget ? 'none' : 'auto'}>
        <UnifiedSetupInputs header={<Header title="자투리 시간 설정" compact />} clockLabel={testNowMin != null ? `테스트 시각 ${fmtHM(now.nowMin)} · 최대 3시간` : `현재 시각 ${fmtHM(now.nowMin)} · 최대 3시간`}
          viewportHeight={viewportHeight || layout.viewportHeight} originLabel={originLabel} destinationLabel={appointment?.label ?? '출발지로 돌아오기'} hasDestination={Boolean(appointment)} largeText={dimensions.fontScale > 1}
          onOrigin={() => openPicker('origin')} onDestination={() => openPicker('destination')} onReturn={() => { setAppointment(null); setError(''); }}
          nextDayArrival={endMin >= 1440 && remainingMin > 0 && remainingMin <= 180}
          wheel={<View style={[s.wheelPanel, { minHeight: layout.wheelRowHeight * 4 }]}><View style={s.meridiem}><TimeWheel rowHeight={layout.wheelRowHeight} accessibilityLabel="도착 시각 오전 오후" values={MERIDIEMS} index={pm ? 1 : 0} onChange={(index) => { setError(''); setPm(index === 1); }} /></View><View style={s.wheelCol}><TimeWheel rowHeight={layout.wheelRowHeight} accessibilityLabel="도착 시각 시" values={HOURS_12} index={hour12 - 1} onChange={(index) => { setError(''); setHour12(index + 1); }} /></View><View style={s.wheelCol}><TimeWheel rowHeight={layout.wheelRowHeight} accessibilityLabel="도착 시각 분" values={MINUTES} index={minute} onChange={(value) => { setError(''); setMinute(value); }} /></View></View>}
          slider={<View style={{ gap: 4 }}><View style={s.sliderHead}><Text style={s.rowTitle}>도착 전 남길 시간</Text><Text style={s.bufferValue}>{arrivalBufferMin}분</Text></View><Slider style={{ height: 44 }} minimumValue={5} maximumValue={30} step={5} value={arrivalBufferMin} accessibilityLabel="도착 전 남길 시간" accessibilityValue={{ text: `${arrivalBufferMin}분, 5분 단위` }} minimumTrackTintColor={C.accent} maximumTrackTintColor={C.line} thumbTintColor={C.accent} onSlidingStart={() => applyArrivalBufferDecision(arrivalBufferInteraction.begin(arrivalBufferMin))} onValueChange={(value) => applyArrivalBufferDecision(arrivalBufferInteraction.change(value))} onSlidingComplete={(value) => applyArrivalBufferDecision(arrivalBufferInteraction.complete(value))} /><View style={s.rangeEnds}><Text style={{ color: C.muted }}>빠듯하게</Text><Text style={{ color: C.muted }}>여유롭게</Text></View></View>} error={error || validation} />
        {SHOW_TEST_CLOCK || qaLauncherEnabled || liveDiagnosticsEnabled ? <View testID="setup-development-tools" style={{ paddingHorizontal: 22, paddingBottom: 8 }}>{SHOW_TEST_CLOCK ? <Pressable testID="dev-test-clock" style={s.devRow} onPress={() => setPage('test-clock')}><Text style={s.devText}>개발 테스트 시각</Text><Text style={s.devText}>{fmtHM(now.nowMin)} ›</Text></Pressable> : null}{qaLauncherEnabled ? <Pressable testID="qa-release-one-stop-launcher" style={s.devRow} onPress={() => { setError(''); setPage('qa-launcher'); }}><Text style={s.devText}>출시 추천 QA</Text><Text style={s.devText}>8개 시나리오 ›</Text></Pressable> : null}{a3LauncherEnabled ? <><Pressable testID="live-activity-a3-launcher" style={[s.devRow, a3Running && s.primaryOff]} disabled={a3Running} onPress={() => void runLiveActivityA3()}><Text style={s.devText}>Live Activity A3</Text><Text style={s.devText}>{a3Running ? '확인 중…' : '카카오맵 전환 ›'}</Text></Pressable><Pressable testID="live-activity-a3-cleanup" style={[s.devRow, a3Running && s.primaryOff]} disabled={a3Running} onPress={() => void cleanupLiveActivityA3()}><Text style={s.devText}>테스트 Live Activity 종료</Text><Text style={s.devText}>정확한 대상만 ›</Text></Pressable>{a3Status ? <Text testID="live-activity-a3-status" accessibilityRole="alert" style={s.devStatus}>{a3Status}</Text> : null}</> : null}{liveDiagnosticsEnabled ? <Pressable testID="live-activity-diagnostics-launcher" style={s.devRow} onPress={() => { setPage('live-diagnostics'); void readLiveDiagnostics(); }}><Text style={s.devText}>Live Activity 버튼 진단</Text><Text style={s.devText}>조회·복사 ›</Text></Pressable> : null}</View> : null}
        {captchaDiagnostic ? <Text testID="route-proxy-diagnostic" style={s.diagnostic}>CAPTCHA 진단: {captchaDiagnostic}</Text> : null}
      </View>
    </ScrollView>
    <View testID="setup-footer" onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)} style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
      <Pressable testID="setup-recommend" style={[s.primary, { marginTop: 0, paddingVertical: 12 }, Boolean(validation) && s.primaryOff]} onPress={run} disabled={Boolean(validation || searchTarget || mapTarget || captchaVisible)}><Text style={s.primaryText}>이 시간에 할 일 찾기</Text></Pressable>
    </View>
    {pickers()}{captchaSheet}
  </View>;
  function pickers() {
    const request = pickerRequest.current;
    const target = mapTarget ?? searchTarget ?? 'origin';
    const pickerCenter = pickerInitialCenter(target, origin, appointment, SEOMYEON);
    const close = () => { pickerRequest.current++; locationEditingSession.end(); setMapTarget(null); setSearchTarget(null); };
    const returnToSearch = () => { pickerRequest.current++; locationEditingSession.resume(); setSearchTarget(mapTarget); setMapTarget(null); };
    const confirm = (point: LatLon, label: string, source?: 'device' | 'provider' | 'map') => {
      if (request !== pickerRequest.current || (!mapTarget && !searchTarget)) return;
      applyPlace(target, point, label, source); close(); setPage('setup');
    };
    return <>
      <MapPlacePicker visible={mapTarget !== null} title={mapTarget === 'origin' ? '출발지 선택' : '도착지 선택'} center={pickerCenter} labelAdapter={locationLabel}
        onClose={returnToSearch}
        onConfirm={({ point, label, source }) => confirm(point, label, source)} />
      <PlacePicker visible={searchTarget !== null} title={target === 'origin' ? '출발지 선택' : '도착지 선택'} center={pickerCenter} editingSession={locationEditingSession} labelAdapter={locationLabel}
        onOpenMap={() => { pickerRequest.current++; locationEditingSession.pause(); setMapTarget(searchTarget); setSearchTarget(null); }} onClose={close}
        onConfirm={(place) => confirm(place, place.label, place.source)} />
    </>;
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, screen: { paddingHorizontal: 22, paddingBottom: 42 }, header: { height: 52, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }, headerSpacer: { width: 42, height: 42 }, backText: { color: C.txt, fontSize: 32, lineHeight: 34 }, headerTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, smallCopy: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 22 },
  rowTitle: { color: C.txt, fontSize: 15, fontWeight: '800' }, rowValue: { maxWidth: 270, color: C.muted, fontSize: 13, marginTop: 5 }, devRow: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#4b85cf', backgroundColor: '#1d3045', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, devText: { color: '#83baff', fontSize: 13, fontWeight: '800' }, devStatus: { color: C.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 12, marginTop: 6 }, sliderHead: { flexDirection: 'row', justifyContent: 'space-between' }, bufferValue: { color: '#70adff', fontSize: 20, fontWeight: '800' }, rangeEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  qaNext: { color: '#83baff', fontSize: 14, fontWeight: '800', marginBottom: 10 }, qaScenario: { minHeight: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line, backgroundColor: C.panel }, qaMinutes: { color: C.green, fontSize: 14, fontWeight: '800' },
  diagnosticPanel: { marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, diagnosticLine: { color: C.muted, fontSize: 11, lineHeight: 17, marginBottom: 5 },
  primary: { minHeight: 52, marginTop: 12, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, primaryOff: { backgroundColor: C.panel2 }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' }, secondary: { minHeight: 52, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' }, error: { color: C.red, fontSize: 13, lineHeight: 19, marginTop: 10 }, diagnostic: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  wheelPanel: { minHeight: 210, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#171a20', overflow: 'hidden' }, meridiem: { width: 84 }, wheelCol: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 }, loadingEyebrow: { color: '#6eacff', fontSize: 13, fontWeight: '800' }, loadingTitle: { color: C.txt, fontSize: 27, lineHeight: 35, fontWeight: '800', textAlign: 'center', marginTop: 12, marginBottom: 34 },
});
