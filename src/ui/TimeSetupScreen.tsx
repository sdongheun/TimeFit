import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LatLon, timeContext } from '../engine';
import { MapPlacePicker } from './MapPlacePicker';
import { Appointment, fmtHM, RecommendationSession, RootStackParamList } from './nav';
import { PlacePicker } from './PlacePicker';
import { C } from './theme';
import { TimeWheel } from './TimeWheel';
import { useAppFlow } from './AppFlowContext';
import { hourBucketForMinute, resolveTimeSetupClock, suggestedEndForTestClock } from './timeSetup/testClock';
import { runRecommendationSession } from './recommendation/v1Session';
import { captureRecommendationNowIso, startMinuteForRecommendation } from './recommendation/recommendationSessionTime';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { displayLocationLabel } from './locationLabelDisplayModel';
import { pickerInitialCenter } from './locationPickerRecoveryModel';
import { CaptchaVerificationSheet } from './CaptchaVerificationSheet';
import { useAuth } from './AuthContext';
import { resolveCaptchaChallengeUrl } from './captchaVerificationModel';
import { recommendationFailureDisplay, recommendationGateDecision } from './captchaRecommendationGateModel';

const MAX_MINUTES = 180;
const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
type Page = 'setup' | 'route-setup' | 'time-picker' | 'test-clock' | 'loading';
type PickTarget = 'origin' | 'destination' | null;
type Props = NativeStackScreenProps<RootStackParamList, 'TimeSetup'>;

function to12(min: number) { const hour24 = Math.floor(min / 60); return { pm: hour24 >= 12, hour: hour24 % 12 || 12, minute: min % 60 }; }
function to24(pm: boolean, hour12: number, minute: number) { return ((pm ? 12 : 0) + (hour12 % 12)) * 60 + minute; }
const SHOW_TEST_CLOCK = typeof __DEV__ !== 'undefined' && __DEV__;

export function TimeSetupScreen({ navigation, route }: Props) {
  const flow = useAppFlow();
  const { session: authSession, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const realNow = useMemo(() => timeContext(new Date()), []);
  const [testNowMin, setTestNowMin] = useState<number | null>(null);
  const now = resolveTimeSetupClock(realNow, testNowMin);
  const initialEnd = Math.min(23 * 60 + 59, now.nowMin + Math.min(route.params?.presetMin ?? 120, MAX_MINUTES));
  const initial12 = to12(initialEnd);
  const [page, setPage] = useState<Page>('setup');
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [originLabel, setOriginLabel] = useState('출발지 선택');
  const [devicePoint, setDevicePoint] = useState<LatLon | null>(null);
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [pm, setPm] = useState(initial12.pm);
  const [hour12, setHour12] = useState(initial12.hour);
  const [minute, setMinute] = useState(initial12.minute);
  const [arrivalBufferMin, setArrivalBufferMin] = useState(10);
  const testInitial = to12(realNow.nowMin);
  const [testPm, setTestPm] = useState(testInitial.pm);
  const [testHour12, setTestHour12] = useState(testInitial.hour);
  const [testMinute, setTestMinute] = useState(testInitial.minute);
  const [mapTarget, setMapTarget] = useState<PickTarget>(null);
  const [searchTarget, setSearchTarget] = useState<PickTarget>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [captchaDiagnostic, setCaptchaDiagnostic] = useState<string | null>(null);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const locationLabel = useRef(createKakaoLocationLabelAdapter()).current;
  const gpsLabelRequest = useRef(0);
  const endMin = to24(pm, hour12, minute);
  const remainingMin = endMin - now.nowMin;
  const validation = !origin ? '출발 위치를 선택해 주세요.' : remainingMin <= 0 ? '도착 시각을 현재 시각 뒤로 설정해 주세요.' : remainingMin > MAX_MINUTES ? '현재 시각부터 최대 3시간 안에서 설정해 주세요.' : '';
  const captchaChallengeUrl = useMemo(() => resolveCaptchaChallengeUrl(process.env.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL), []);
  const routeProxyEnabled = process.env.EXPO_PUBLIC_ROUTE_PROXY_ENABLED === 'true';
  const captchaDiagnosticsEnabled = process.env.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS === 'true';

  // route setup을 연 경우에만 이미 허용된 권한을 조회한다. 이 경로에서 권한 팝업을 띄우지 않는다.
  useEffect(() => {
    if (page !== 'route-setup' || origin) return;
    let active = true;
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!active || permission.status !== 'granted') return;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        const point = { lat: position.coords.latitude, lon: position.coords.longitude };
        const request = gpsLabelRequest.current + 1;
        gpsLabelRequest.current = request;
        setDevicePoint(point);
        setOrigin(point); setOriginLabel('현재 위치 확인 중');
        const label = await locationLabel.resolve(point, 'gps_auto');
        if (!active || request !== gpsLabelRequest.current) return;
        setOriginLabel(displayLocationLabel(label));
      } catch { /* 자동 GPS 실패는 명시 picker 행동으로만 재시도한다. */ }
    })();
    return () => { active = false; };
  }, [page, locationLabel]);

  const applyPlace = (target: Exclude<PickTarget, null>, point: LatLon, label: string, source?: 'device' | 'provider' | 'map') => {
    if (source === 'device') setDevicePoint(point);
    if (target === 'origin') { gpsLabelRequest.current += 1; setOrigin(point); setOriginLabel(label); }
    else setAppointment({ label, ...point });
  };
  const startRecommendation = async (captchaToken?: string, proxyEnabled = routeProxyEnabled) => {
    if (validation || !origin) { setError(validation); return; }
    setError(''); setCaptchaDiagnostic(null);
    setLoadingStep(0);
    setPage('loading');
    try {
      // 로딩 화면을 먼저 그린 뒤, 실제 비동기 단계가 완료될 때만 다음 상태로 전환한다.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const target = appointment ? { id: 'destination', lat: appointment.lat, lon: appointment.lon, label: appointment.label } : null;
      setLoadingStep(1);
      setLoadingStep(2);
      const nowIso = captureRecommendationNowIso(new Date(), testNowMin);
      const sessionRemainingMin = endMin - startMinuteForRecommendation(nowIso);
      if (sessionRemainingMin <= 0 || sessionRemainingMin > MAX_MINUTES) throw new Error('도착 시각을 현재 시각부터 최대 3시간 안에서 다시 설정해 주세요.');
      const session: RecommendationSession = { nowIso, origin: { id: 'origin', ...origin, label: originLabel }, destination: target, remainingMin: sessionRemainingMin, arrivalBufferMin };
      const result = await runRecommendationSession(session, { routeProxyEnabled: proxyEnabled, captchaToken });
      setLoadingStep(3);
      const params: RootStackParamList['Results'] = { session, result };
      flow.setLatestResults(params); navigation.replace('Results', params);
    } catch (reason) {
      const failure = recommendationFailureDisplay(reason, captchaDiagnosticsEnabled);
      setError(failure.message); setCaptchaDiagnostic(failure.diagnostic); setPage('setup');
    }
  };
  const run = () => {
    setCaptchaDiagnostic(null);
    if (validation || !origin) { setError(validation); return; }
    if (isAuthLoading) { setError('계정 상태를 확인 중이에요. 잠시 후 다시 시도해 주세요.'); return; }
    const decision = recommendationGateDecision({ routeProxyEnabled, hasSession: Boolean(authSession), hasValidChallengeUrl: Boolean(captchaChallengeUrl) });
    if (decision.kind === 'show_captcha') { setCaptchaVisible(true); return; }
    if (decision.kind === 'fail_missing_challenge') { setError('안전 확인을 준비하지 못했어요. 다시 시도해 주세요.'); return; }
    void startRecommendation(undefined, decision.kind === 'start_proxy');
  };
  const back = () => {
    if (page === 'setup') navigation.goBack();
    else setPage('setup');
  };
  const Header = ({ title }: { title: string }) => <View style={s.header}><Pressable onPress={back} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.headerTitle}>{title}</Text><View style={s.back} /></View>;
  if (page === 'loading') return <View style={s.root}><View style={[s.loading, { paddingTop: insets.top + 40 }]}><Text style={s.loadingEyebrow}>{fmtHM(endMin)}까지 계산 중</Text><Text style={s.loadingTitle}>시간 안에 들를 곳을{`\n`}찾고 있어요</Text>{['현재 위치와 도착지 확인', '이동 가능한 범위 계산', '짧게 들를 장소 찾기', '운영 상태 확인'].map((label, index) => <View key={label} style={s.loadingRow}><View style={[s.dot, index < loadingStep && s.dotDone, index === loadingStep && s.dotActive]} /><Text style={[s.loadingText, index <= loadingStep && s.loadingTextActive]}>{label}</Text></View>)}</View></View>;
  if (page === 'route-setup') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="경로 설정" /><Text style={s.smallCopy}>출발지와 도착지를 한 번에 설정하세요. 도착지를 비우면 출발지로 돌아와요.</Text><Pressable testID="route-origin-field" style={s.routeField} onPress={() => setSearchTarget('origin')}><Text style={s.routeLabel}>출발지</Text><Text style={s.routeValue}>{originLabel}</Text></Pressable><View style={s.routeLine} /><Pressable testID="route-destination-field" style={s.routeField} onPress={() => setSearchTarget('destination')}><Text style={s.routeLabel}>도착지</Text><Text style={s.routeValue}>{appointment?.label ?? '출발지로 돌아오기'}</Text></Pressable>{error ? <Text style={s.error}>{error}</Text> : null}<Pressable testID="route-apply" style={[s.primary, !origin && s.primaryOff]} disabled={!origin} onPress={() => setPage('setup')}><Text style={s.primaryText}>경로 적용</Text></Pressable></ScrollView>{pickers()}</View>;
  if (page === 'time-picker') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="도착 시각" /><Text style={s.smallCopy}>현재 시각부터 최대 3시간 안에서 분 단위로 정합니다.</Text><View style={s.wheelPanel}><View style={s.meridiem}><Pressable onPress={() => setPm(false)}><Text style={[s.meridiemText, !pm && s.meridiemOn]}>오전</Text></Pressable><Pressable onPress={() => setPm(true)}><Text style={[s.meridiemText, pm && s.meridiemOn]}>오후</Text></Pressable></View><View style={s.wheelCol}><TimeWheel values={HOURS_12} index={hour12 - 1} onChange={(index) => setHour12(index + 1)} /></View><View style={s.wheelCol}><TimeWheel values={MINUTES} index={minute} onChange={setMinute} /></View></View>{validation && origin ? <Text style={s.error}>{validation}</Text> : null}<Pressable style={s.primary} onPress={() => setPage('setup')}><Text style={s.primaryText}>도착 시각 설정</Text></Pressable></ScrollView></View>;
  if (page === 'test-clock') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="테스트 현재 시각" /><Text style={s.smallCopy}>개발 테스트에서만 추천과 운영시간 판단 시각을 바꿉니다.</Text><View style={s.wheelPanel}><View style={s.meridiem}><Pressable onPress={() => setTestPm(false)}><Text style={[s.meridiemText, !testPm && s.meridiemOn]}>오전</Text></Pressable><Pressable onPress={() => setTestPm(true)}><Text style={[s.meridiemText, testPm && s.meridiemOn]}>오후</Text></Pressable></View><View style={s.wheelCol}><TimeWheel values={HOURS_12} index={testHour12 - 1} onChange={(index) => setTestHour12(index + 1)} /></View><View style={s.wheelCol}><TimeWheel values={MINUTES} index={testMinute} onChange={setTestMinute} /></View></View><Pressable style={s.primary} onPress={() => { const next = to24(testPm, testHour12, testMinute); const end = to12(suggestedEndForTestClock(next)); setTestNowMin(next); setPm(end.pm); setHour12(end.hour); setMinute(end.minute); setPage('setup'); }}><Text style={s.primaryText}>테스트 시각 적용</Text></Pressable><Pressable style={s.secondary} onPress={() => { const end = to12(suggestedEndForTestClock(realNow.nowMin)); setTestNowMin(null); setPm(end.pm); setHour12(end.hour); setMinute(end.minute); setPage('setup'); }}><Text style={s.secondaryText}>실제 현재 시각으로 복원</Text></Pressable></ScrollView></View>;
  return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="자투리 시간 설정" /><Text style={s.smallCopy}>{testNowMin != null ? `테스트 시각 ${fmtHM(now.nowMin)} 기준` : `현재 시각 ${fmtHM(now.nowMin)}부터 최대 3시간 안에서 계산합니다.`}</Text><Pressable testID="route-setup-entry" style={s.row} onPress={() => setPage('route-setup')}><View><Text style={s.rowTitle}>경로 설정하기</Text><Text style={s.rowValue}>{origin ? `${originLabel}${appointment ? ` → ${appointment.label}` : ' · 출발지로 돌아오기'}` : '출발지와 도착지를 설정하세요'}</Text></View><Text style={s.chevron}>›</Text></Pressable><Pressable style={s.row} onPress={() => setPage('time-picker')}><View><Text style={s.rowTitle}>도착 시각</Text><Text style={s.rowValue}>오늘 {fmtHM(endMin)}</Text></View><Text style={s.chevron}>›</Text></Pressable>{SHOW_TEST_CLOCK ? <Pressable testID="dev-test-clock" style={s.devRow} onPress={() => setPage('test-clock')}><Text style={s.devText}>개발 테스트 시각</Text><Text style={s.devText}>{fmtHM(now.nowMin)} ›</Text></Pressable> : null}<View style={s.slider}><View style={s.sliderHead}><Text style={s.rowTitle}>도착 전 남길 시간</Text><Text style={s.bufferValue}>{arrivalBufferMin}분</Text></View><Slider minimumValue={5} maximumValue={30} step={5} value={arrivalBufferMin} minimumTrackTintColor={C.accent} maximumTrackTintColor={C.line} thumbTintColor={C.accent} onValueChange={(value) => setArrivalBufferMin(Math.round(value))} /><View style={s.rangeEnds}><Text>빠듯하게</Text><Text>여유롭게</Text></View></View>{(validation || error) ? <Text style={s.error}>{validation || error}</Text> : null}{captchaDiagnostic ? <Text testID="route-proxy-diagnostic" style={s.diagnostic}>CAPTCHA 진단: {captchaDiagnostic}</Text> : null}<Pressable style={[s.primary, Boolean(validation) && s.primaryOff]} onPress={run} disabled={Boolean(validation)}><Text style={s.primaryText}>이 시간에 할 일 찾기</Text></Pressable><Text style={s.privacy}>위치 정보 이용과 저장 방식은 내 정보에서 확인할 수 있어요.</Text></ScrollView>{pickers()}<CaptchaVerificationSheet visible={captchaVisible} challengeUrl={captchaChallengeUrl} onClose={() => setCaptchaVisible(false)} onVerified={(token) => { setCaptchaVisible(false); void startRecommendation(token, true); }} /></View>;
  function pickers() { const target = mapTarget ?? searchTarget ?? 'origin'; const pickerCenter = pickerInitialCenter(target, origin, devicePoint, SEOMYEON); return <><MapPlacePicker visible={mapTarget !== null} title={mapTarget === 'origin' ? '출발지 선택' : '도착지 선택'} center={pickerCenter} labelAdapter={locationLabel} onClose={() => setMapTarget(null)} onSearch={() => { setSearchTarget(mapTarget); setMapTarget(null); }} onConfirm={({ point, label, source }) => { if (mapTarget) applyPlace(mapTarget, point, label, source); setMapTarget(null); setPage('route-setup'); }} /><PlacePicker visible={searchTarget !== null} title={searchTarget === 'origin' ? '출발지 선택' : '도착지 선택'} center={pickerCenter} showGps onOpenMap={() => { setMapTarget(searchTarget); setSearchTarget(null); }} onClose={() => setSearchTarget(null)} onConfirm={(place) => { if (searchTarget) applyPlace(searchTarget, place, place.label, place.source); setSearchTarget(null); setPage('route-setup'); }} /></>; }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, screen: { paddingHorizontal: 22, paddingBottom: 42 }, header: { height: 52, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }, backText: { color: C.txt, fontSize: 32, lineHeight: 34 }, headerTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, smallCopy: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 22 },
  routeField: { minHeight: 72, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: C.panel }, routeLabel: { color: C.muted, fontSize: 12, fontWeight: '700' }, routeValue: { color: C.txt, fontSize: 15, fontWeight: '800', marginTop: 5 }, routeLine: { width: 1, height: 16, alignSelf: 'center', backgroundColor: C.line },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line }, rowTitle: { color: C.txt, fontSize: 15, fontWeight: '800' }, rowValue: { maxWidth: 270, color: C.muted, fontSize: 13, marginTop: 5 }, chevron: { color: C.muted, fontSize: 28 }, devRow: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#4b85cf', backgroundColor: '#1d3045', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, devText: { color: '#83baff', fontSize: 13, fontWeight: '800' }, slider: { marginVertical: 26 }, sliderHead: { flexDirection: 'row', justifyContent: 'space-between' }, bufferValue: { color: '#70adff', fontSize: 20, fontWeight: '800' }, rangeEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  primary: { minHeight: 52, marginTop: 12, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, primaryOff: { backgroundColor: C.panel2 }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' }, secondary: { minHeight: 52, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' }, link: { minHeight: 44, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, linkText: { color: '#75b1ff', fontSize: 14, fontWeight: '800' }, privacy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 15 }, error: { color: C.red, fontSize: 13, lineHeight: 19, marginTop: 10 }, diagnostic: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  wheelPanel: { minHeight: 210, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#171a20', overflow: 'hidden' }, meridiem: { width: 84, alignItems: 'center', gap: 25 }, meridiemText: { color: C.muted, fontSize: 19 }, meridiemOn: { color: C.txt, fontSize: 24, fontWeight: '800' }, wheelCol: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 }, loadingEyebrow: { color: '#6eacff', fontSize: 13, fontWeight: '800' }, loadingTitle: { color: C.txt, fontSize: 27, lineHeight: 35, fontWeight: '800', textAlign: 'center', marginTop: 12, marginBottom: 34 }, loadingRow: { width: 280, flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 9 }, dot: { width: 11, height: 11, borderWidth: 2, borderColor: '#697385', borderRadius: 6 }, dotDone: { borderColor: C.green, backgroundColor: C.green }, dotActive: { borderColor: '#72b2ff', backgroundColor: '#72b2ff' }, loadingText: { color: C.muted, fontSize: 14 }, loadingTextActive: { color: C.txt2 },
});
