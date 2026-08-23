import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActualRouteBaselines, LatLon, planTimeFit, timeContext } from '../engine';
import { HeaderBackButton, PrimaryButton } from './CommonButtons';
import { MapPlacePicker } from './MapPlacePicker';
import { Appointment, fmtHM, RootStackParamList } from './nav';
import { PlacePicker } from './PlacePicker';
import { C } from './theme';
import { TimeWheel } from './TimeWheel';
import { useAppFlow } from './AppFlowContext';
import { hourBucketForMinute, resolveTimeSetupClock, suggestedEndForTestClock } from './timeSetup/testClock';
import { UI_RADIUS } from './tokens';

const MAX_MINUTES = 120;
const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
type Page = 'setup' | 'origin-choice' | 'location-permission' | 'destination-choice' | 'time-picker' | 'test-clock' | 'loading';
type PickTarget = 'origin' | 'destination' | null;
type Props = NativeStackScreenProps<RootStackParamList, 'TimeSetup'>;

function to12(min: number) { const hour24 = Math.floor(min / 60); return { pm: hour24 >= 12, hour: hour24 % 12 || 12, minute: min % 60 }; }
function to24(pm: boolean, hour12: number, minute: number) { return ((pm ? 12 : 0) + (hour12 % 12)) * 60 + minute; }
function placeLabel(place: LatLon) { return `지도 선택 위치 (${place.lat.toFixed(4)}, ${place.lon.toFixed(4)})`; }
const SHOW_TEST_CLOCK = typeof __DEV__ !== 'undefined' && __DEV__;

export function TimeSetupScreen({ navigation, route }: Props) {
  const flow = useAppFlow();
  const insets = useSafeAreaInsets();
  const realNow = useMemo(() => timeContext(new Date()), []);
  const [testNowMin, setTestNowMin] = useState<number | null>(null);
  const now = resolveTimeSetupClock(realNow, testNowMin);
  const initialEnd = Math.min(23 * 60 + 59, now.nowMin + Math.min(route.params?.presetMin ?? 120, MAX_MINUTES));
  const initial12 = to12(initialEnd);
  const [page, setPage] = useState<Page>('setup');
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [originLabel, setOriginLabel] = useState('내 위치 사용하기');
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
  const endMin = to24(pm, hour12, minute);
  const remainingMin = endMin - now.nowMin;
  const validation = !origin ? '출발 위치를 선택해 주세요.' : remainingMin <= 0 ? '도착 시각을 현재 시각 뒤로 설정해 주세요.' : remainingMin > MAX_MINUTES ? '현재 시각부터 최대 2시간 안에서 설정해 주세요.' : '';

  const chooseMap = (target: Exclude<PickTarget, null>) => { setMapTarget(target); };
  const applyPlace = (target: Exclude<PickTarget, null>, point: LatLon, label: string) => {
    if (target === 'origin') { setOrigin(point); setOriginLabel(label); }
    else setAppointment({ label, ...point });
  };
  const useGps = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setError('위치 권한이 허용되지 않았어요. 지도로 직접 선택할 수 있어요.'); setPage('origin-choice'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { lat: position.coords.latitude, lon: position.coords.longitude };
      applyPlace('origin', point, '현재 위치');
      setPage('setup');
    } catch { setError('현재 위치를 가져오지 못했어요. 지도로 직접 선택해 주세요.'); setPage('origin-choice'); }
  };
  const run = async () => {
    if (validation || !origin) { setError(validation); return; }
    setError('');
    setLoadingStep(0);
    setPage('loading');
    try {
      // 로딩 화면을 먼저 그린 뒤, 실제 비동기 단계가 완료될 때만 다음 상태로 전환한다.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const target = appointment ? { lat: appointment.lat, lon: appointment.lon } : null;
      setLoadingStep(1);
      const baseline = target ? await getActualRouteBaselines(origin, target) : null;
      setLoadingStep(2);
      const result = await planTimeFit({ origin, destination: target, remainingMin, mode: 'transit', candidateModes: ['walk', 'transit'], radiusM: 8000, routeBaselines: baseline?.baselines, mapExploration: true, nowMin: now.nowMin, dayType: now.dayType, hourBucket: hourBucketForMinute(now.nowMin) });
      setLoadingStep(3);
      const params: RootStackParamList['Results'] = { result, usedTimeLabel: `${fmtHM(now.nowMin)} 기준${testNowMin != null ? ' (테스트)' : ''}`, origin, ctx: { startMin: now.nowMin, mode: 'transit', modeLabel: '도보·대중교통 비교', originLabel, appointment, remainingMin, arrivalBufferMin, dayType: now.dayType, hourBucket: hourBucketForMinute(now.nowMin) } };
      flow.setLatestResults(params); navigation.replace('Results', params);
    } catch (reason) { setError(`추천을 준비하지 못했어요: ${reason instanceof Error ? reason.message : '잠시 후 다시 시도해 주세요.'}`); setPage('setup'); }
  };

  const back = () => {
    if (page === 'setup') navigation.goBack();
    else if (page === 'origin-choice' || page === 'destination-choice' || page === 'time-picker' || page === 'test-clock') setPage('setup');
    else if (page === 'location-permission') setPage('origin-choice');
  };

  const Header = ({ title }: { title: string }) => (
    <View style={s.header}>
      <HeaderBackButton onPress={back} accessibilityLabel="뒤로가기" />
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 42 }} />
    </View>
  );

  if (page === 'loading') return <View style={s.root}><View style={[s.loading, { paddingTop: insets.top + 40 }]}><Text style={s.loadingEyebrow}>{fmtHM(endMin)}까지 계산 중</Text><Text style={s.loadingTitle}>시간 안에 들를 곳을{`\n`}찾고 있어요</Text>{['현재 위치와 도착지 확인', '이동 가능한 범위 계산', '짧게 들를 장소 찾기', '운영 상태 확인'].map((label, index) => <View key={label} style={s.loadingRow}><View style={[s.dot, index < loadingStep && s.dotDone, index === loadingStep && s.dotActive]} /><Text style={[s.loadingText, index <= loadingStep && s.loadingTextActive]}>{label}</Text></View>)}</View></View>;
  if (page === 'origin-choice') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="현재 위치" /><Text style={s.smallCopy}>현재 위치를 쓰거나 지도에서 직접 출발지를 고르세요.</Text><PrimaryButton title="내 위치 사용하기" onPress={() => setPage('location-permission')} /><Pressable style={s.secondary} onPress={() => chooseMap('origin')}><Text style={s.secondaryText}>지도에서 직접 선택</Text></Pressable><Pressable style={s.link} onPress={() => setSearchTarget('origin')}><Text style={s.linkText}>장소 이름 또는 주소로 검색</Text></Pressable>{error ? <Text style={s.error}>{error}</Text> : null}</ScrollView>{pickers()}</View>;
  if (page === 'location-permission') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="현재 위치" /><View style={s.permission}><View style={s.permissionMark}><Text style={s.permissionIcon}>⌖</Text></View><Text style={s.permissionTitle}>현재 위치를{`\n`}사용할까요?</Text><Text style={s.permissionCopy}>현재 위치에서 걸을 수 있는 범위와 이동 시간을 계산하는 데만 사용합니다.</Text><PrimaryButton title="허용" onPress={useGps} /><Pressable style={s.link} onPress={() => chooseMap('origin')}><Text style={s.linkText}>지도로 직접 선택</Text></Pressable></View></ScrollView>{pickers()}</View>;
  if (page === 'destination-choice') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="도착지/복귀" /><Text style={s.smallCopy}>도착지를 비우면 현재 위치로 돌아오는 시간까지 계산합니다.</Text><Pressable style={s.secondary} onPress={() => { setAppointment(null); setPage('setup'); }}><Text style={s.secondaryText}>현재 위치로 돌아오기</Text></Pressable><PrimaryButton title="지도에서 도착지 선택" onPress={() => chooseMap('destination')} style={s.primaryBtnMargin} /><Pressable style={s.link} onPress={() => setSearchTarget('destination')}><Text style={s.linkText}>장소 이름 또는 주소로 검색</Text></Pressable></ScrollView>{pickers()}</View>;
  if (page === 'time-picker') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="도착 시각" /><Text style={s.smallCopy}>현재 시각부터 최대 2시간 안에서 분 단위로 정합니다.</Text><View style={s.wheelPanel}><View style={s.meridiem}><Pressable onPress={() => setPm(false)}><Text style={[s.meridiemText, !pm && s.meridiemOn]}>오전</Text></Pressable><Pressable onPress={() => setPm(true)}><Text style={[s.meridiemText, pm && s.meridiemOn]}>오후</Text></Pressable></View><View style={s.wheelCol}><TimeWheel values={HOURS_12} index={hour12 - 1} onChange={(index) => setHour12(index + 1)} /></View><View style={s.wheelCol}><TimeWheel values={MINUTES} index={minute} onChange={setMinute} /></View></View>{validation && origin ? <Text style={s.error}>{validation}</Text> : null}<PrimaryButton title="도착 시각 설정" onPress={() => setPage('setup')} style={s.primaryBtnMargin} /></ScrollView></View>;
  if (page === 'test-clock') return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14 }]}><Header title="테스트 현재 시각" /><Text style={s.smallCopy}>개발 테스트에서만 추천과 운영시간 판단 시각을 바꿉니다.</Text><View style={s.wheelPanel}><View style={s.meridiem}><Pressable onPress={() => setTestPm(false)}><Text style={[s.meridiemText, !testPm && s.meridiemOn]}>오전</Text></Pressable><Pressable onPress={() => setTestPm(true)}><Text style={[s.meridiemText, testPm && s.meridiemOn]}>오후</Text></Pressable></View><View style={s.wheelCol}><TimeWheel values={HOURS_12} index={testHour12 - 1} onChange={(index) => setTestHour12(index + 1)} /></View><View style={s.wheelCol}><TimeWheel values={MINUTES} index={testMinute} onChange={setTestMinute} /></View></View><PrimaryButton title="테스트 시각 적용" onPress={() => { const next = to24(testPm, testHour12, testMinute); const end = to12(suggestedEndForTestClock(next)); setTestNowMin(next); setPm(end.pm); setHour12(end.hour); setMinute(end.minute); setPage('setup'); }} style={s.primaryBtnMargin} /><Pressable style={s.secondary} onPress={() => { const end = to12(suggestedEndForTestClock(realNow.nowMin)); setTestNowMin(null); setPm(end.pm); setHour12(end.hour); setMinute(end.minute); setPage('setup'); }}><Text style={s.secondaryText}>실제 현재 시각으로 복원</Text></Pressable></ScrollView></View>;
  return <View style={s.root}><ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 32) }]}><Header title="자투리 시간 설정" /><Text style={s.smallCopy}>{testNowMin != null ? `테스트 시각 ${fmtHM(now.nowMin)} 기준` : `현재 시각 ${fmtHM(now.nowMin)}부터 최대 2시간 안에서 계산합니다.`}</Text><Pressable style={s.row} onPress={() => setPage('origin-choice')}><View><Text style={s.rowTitle}>현재 위치</Text><Text style={s.rowValue}>{originLabel}</Text></View><Text style={s.chevron}>›</Text></Pressable><Pressable style={s.row} onPress={() => setPage('destination-choice')}><View><Text style={s.rowTitle}>도착지/복귀</Text><Text style={s.rowValue}>{appointment?.label ?? '현재 위치로 돌아오기'}</Text></View><Text style={s.chevron}>›</Text></Pressable><Pressable style={s.row} onPress={() => setPage('time-picker')}><View><Text style={s.rowTitle}>도착 시각</Text><Text style={s.rowValue}>오늘 {fmtHM(endMin)}</Text></View><Text style={s.chevron}>›</Text></Pressable>{SHOW_TEST_CLOCK ? <Pressable testID="dev-test-clock" style={s.devRow} onPress={() => setPage('test-clock')}><Text style={s.devText}>개발 테스트 시각</Text><Text style={s.devText}>{fmtHM(now.nowMin)} ›</Text></Pressable> : null}<View style={s.slider}><View style={s.sliderHead}><Text style={s.rowTitle}>도착 전 남길 시간</Text><Text style={s.bufferValue}>{arrivalBufferMin}분</Text></View><Slider minimumValue={5} maximumValue={30} step={5} value={arrivalBufferMin} minimumTrackTintColor={C.accent} maximumTrackTintColor={C.line} thumbTintColor={C.accent} onValueChange={(value) => setArrivalBufferMin(Math.round(value))} /><View style={s.rangeEnds}><Text style={s.rangeText}>빠듯하게 (5분)</Text><Text style={s.rangeText}>여유롭게 (30분)</Text></View></View>{(validation || error) ? <Text style={s.error}>{validation || error}</Text> : null}<PrimaryButton title="이 시간에 할 일 찾기" onPress={run} disabled={Boolean(validation)} style={s.primaryBtnMargin} /><Text style={s.privacy}>위치 정보 이용과 저장 방식은 내 정보에서 확인할 수 있어요.</Text></ScrollView>{pickers()}</View>;
  function pickers() { return <><MapPlacePicker visible={mapTarget !== null} title={mapTarget === 'origin' ? '출발지 선택' : '도착지 선택'} center={mapTarget === 'destination' ? appointment ?? origin ?? SEOMYEON : origin ?? SEOMYEON} onClose={() => setMapTarget(null)} onSearch={() => { setSearchTarget(mapTarget); setMapTarget(null); }} onConfirm={(point) => { if (mapTarget) applyPlace(mapTarget, point, placeLabel(point)); setMapTarget(null); setPage('setup'); }} /><PlacePicker visible={searchTarget !== null} title={searchTarget === 'origin' ? '출발지 검색' : '도착지 검색'} center={origin ?? SEOMYEON} showGps={searchTarget === 'origin'} onClose={() => setSearchTarget(null)} onConfirm={(place) => { if (searchTarget) applyPlace(searchTarget, place, place.label); setSearchTarget(null); setPage('setup'); }} /></>; }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  screen: { paddingHorizontal: 22, paddingBottom: 42 },
  header: { height: 52, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: C.txt, fontSize: 17, fontWeight: '800' },
  smallCopy: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 22 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.line },
  rowTitle: { color: C.txt, fontSize: 15, fontWeight: '800' },
  rowValue: { maxWidth: 270, color: C.muted, fontSize: 13, marginTop: 5 },
  chevron: { color: C.muted, fontSize: 28 },
  devRow: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#4b85cf', backgroundColor: '#1d3045', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  devText: { color: '#83baff', fontSize: 13, fontWeight: '800' },
  slider: { marginVertical: 26 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  bufferValue: { color: '#70adff', fontSize: 20, fontWeight: '800' },
  rangeEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rangeText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  primaryBtnMargin: { marginTop: 12 },
  secondary: { minHeight: 52, marginTop: 12, borderRadius: UI_RADIUS.control, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' },
  link: { minHeight: 44, marginTop: 12, borderRadius: UI_RADIUS.control, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#75b1ff', fontSize: 14, fontWeight: '800' },
  privacy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 15 },
  error: { color: C.red, fontSize: 13, lineHeight: 19, marginTop: 10 },
  permission: { marginTop: 62, padding: 28, borderRadius: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  permissionMark: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#263e57', alignItems: 'center', justifyContent: 'center' },
  permissionIcon: { color: '#70adff', fontSize: 25 },
  permissionTitle: { color: C.txt, fontSize: 26, lineHeight: 33, fontWeight: '800', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  permissionCopy: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 11, marginBottom: 20 },
  wheelPanel: { minHeight: 210, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#171a20', overflow: 'hidden' },
  meridiem: { width: 84, alignItems: 'center', gap: 25 },
  meridiemText: { color: C.muted, fontSize: 19 },
  meridiemOn: { color: C.txt, fontSize: 24, fontWeight: '800' },
  wheelCol: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  loadingEyebrow: { color: '#6eacff', fontSize: 13, fontWeight: '800' },
  loadingTitle: { color: C.txt, fontSize: 27, lineHeight: 35, fontWeight: '800', textAlign: 'center', marginTop: 12, marginBottom: 34 },
  loadingRow: { width: 280, flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 9 },
  dot: { width: 11, height: 11, borderWidth: 2, borderColor: '#697385', borderRadius: 6 },
  dotDone: { borderColor: C.green, backgroundColor: C.green },
  dotActive: { borderColor: '#72b2ff', backgroundColor: '#72b2ff' },
  loadingText: { color: C.muted, fontSize: 14 },
  loadingTextActive: { color: C.txt2 },
});
