import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { resetToMyCourses } from './mainTabNavigation';
import { RootStackParamList } from './nav';
import { openKakaoRouteWithFallback } from './execution/schedule';
import { C } from './theme';
import { advanceVerifiedCourseProgress, buildVerifiedCourseProgressSteps, createVerifiedCourseRouteOpenLock, initialVerifiedCourseProgressState, markVerifiedCourseRouteOpened, nextVerifiedCourseTravel, requestNextVerifiedCourseRoute, verifiedCourseNextRouteLabel, type VerifiedCourseProgressPoint, type VerifiedCourseProgressStep } from './recommendation/verifiedCourseProgressModel';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifiedCourseProgress'>;
type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const places = new Map<string, RuntimePlace>([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place]));
const time = (iso: string | undefined) => iso ? `${new Date(iso).getHours()}:${String(new Date(iso).getMinutes()).padStart(2, '0')}` : null;
const modeLabel = (mode: 'walk' | 'transit') => mode === 'walk' ? '도보' : '대중교통';

/** V1 검증 snapshot만 화면 메모리에서 따라간다. 위치·저장·알림·추천 재호출은 하지 않는다. */
export function VerifiedCourseProgressScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session, course } = route.params;
  const origin: VerifiedCourseProgressPoint = session.origin;
  const target: VerifiedCourseProgressPoint = session.destination ?? session.origin;
  const steps = useMemo(() => buildVerifiedCourseProgressSteps(course, origin, target, (id) => {
    const place = places.get(id);
    return place ? { id: place.contentId, label: place.title, lat: place.lat, lon: place.lon } : undefined;
  }), [course, origin, target]);
  const [state, setState] = useState(initialVerifiedCourseProgressState);
  const [linkError, setLinkError] = useState('');
  const [isOpeningRoute, setIsOpeningRoute] = useState(false);
  const routeOpenLock = useRef(createVerifiedCourseRouteOpenLock()).current;
  const current = steps?.[state.stepIndex];
  const openTravel = async (travel: Extract<VerifiedCourseProgressStep, { kind: 'travel' }>) => {
    if (!routeOpenLock.tryLock()) return false;
    setIsOpeningRoute(true);
    try {
      const result = await openKakaoRouteWithFallback({ from: { name: travel.from.label, point: travel.from }, to: { name: travel.target.label, point: travel.target } }, travel.mode, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openWeb: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
      if (result === 'failed' || result === 'invalid_stage') { setLinkError('카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.'); return false; }
      setLinkError('');
      return true;
    } finally {
      setIsOpeningRoute(false);
      routeOpenLock.release();
    }
  };
  const openCurrentRoute = async () => {
    if (!steps || !current || current.kind !== 'travel') return;
    if (await openTravel(current)) setState((value) => markVerifiedCourseRouteOpened(steps, value));
  };
  const openNextRoute = async () => {
    if (!steps || !nextVerifiedCourseTravel(steps, state)) return;
    const outcome = await requestNextVerifiedCourseRoute(steps, state, openTravel);
    if (outcome.result === 'opened') setState(outcome.state);
  };
  const advance = () => { if (steps) setState((value) => advanceVerifiedCourseProgress(steps, value)); };
  if (!steps || !current) return <View style={[s.root, { paddingTop: insets.top + 14 }]}><View style={s.header}><Pressable accessibilityLabel="내 코스로 돌아가기" style={s.icon} onPress={() => resetToMyCourses(navigation)}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>코스 진행</Text><View style={s.icon} /></View><View style={s.empty}><Text style={s.emptyTitle}>검증 코스 정보를 열지 못했어요</Text><Text style={s.copy}>내 코스에서 다시 시작해 주세요.</Text></View></View>;
  const nextTravel = nextVerifiedCourseTravel(steps, state);
  const primaryLabel = state.finished ? '코스 마치기' : current.kind === 'travel' ? state.routeOpened ? (current.isFinal ? '도착 후 코스 마치기' : '이동을 마치고 다음으로') : '카카오맵에서 길찾기' : nextTravel ? verifiedCourseNextRouteLabel(nextTravel.isFinal, Boolean(session.destination)) : '다음 장소 길찾기';
  const primaryAction = state.finished ? () => resetToMyCourses(navigation) : current.kind === 'travel' && !state.routeOpened ? () => void openCurrentRoute() : current.kind === 'travel' && current.isFinal ? () => { if (steps) setState((value) => advanceVerifiedCourseProgress(steps, value)); resetToMyCourses(navigation); } : current.kind === 'stay' ? () => void openNextRoute() : advance;
  const summary = current.kind === 'travel'
    ? `${current.target.label}까지 ${modeLabel(current.mode)} ${current.min}분${time(current.scheduledArrivalAt) ? ` · ${time(current.scheduledArrivalAt)} 도착 예정` : ''}`
    : `${current.target.label}에서 둘러본 뒤 ${primaryLabel}를 이용하세요.`;
  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}><View style={s.header}><Pressable accessibilityLabel="내 코스로 돌아가기" style={s.icon} onPress={() => resetToMyCourses(navigation)}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>코스 진행</Text><View style={s.icon} /></View><View style={s.goal}><Text style={s.goalLabel}>{session.destination ? `${session.destination.label} 도착` : '출발지 복귀'}</Text><Text style={s.goalMeta}>도착 전 여유 {course.arrivalBufferMin}분</Text></View><View style={s.card}><Text style={s.kicker}>{current.kind === 'travel' ? '지금 이동' : '지금 둘러보기'}</Text><Text style={s.currentTitle}>{current.target.label}</Text><Text style={s.copy}>{summary}</Text></View>{linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}<Pressable testID="verified-progress-primary" accessibilityLabel={primaryLabel} disabled={isOpeningRoute} style={s.primary} onPress={primaryAction}><Text style={s.primaryText}>{isOpeningRoute ? '카카오맵을 열고 있어요' : primaryLabel}</Text></Pressable><View style={s.sequence}><Text style={s.sequenceTitle}>가는 순서</Text>{steps.map((step, index) => <Text key={step.key} style={index === state.stepIndex && !state.finished ? s.currentStep : s.step}>{index + 1}. {step.kind === 'travel' ? `${step.target.label}까지 ${modeLabel(step.mode)} ${step.min}분` : `${step.target.label} ${step.stayState === 'short' ? '가볍게 둘러보기' : '장소 둘러보기'}`}</Text>)}</View></ScrollView></View>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, paddingBottom: 34, gap: 15 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, back: { color: C.txt, fontSize: 32, lineHeight: 34 }, title: { color: C.txt, fontSize: 17, fontWeight: '800' }, goal: { gap: 3 }, goalLabel: { color: C.txt, fontSize: 24, fontWeight: '800' }, goalMeta: { color: C.green, fontSize: 14, fontWeight: '800' }, card: { padding: 18, gap: 7, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, kicker: { color: '#78b7ff', fontSize: 13, fontWeight: '800' }, currentTitle: { color: C.txt, fontSize: 22, lineHeight: 30, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20 }, primary: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' }, sequence: { gap: 8, paddingTop: 8 }, sequenceTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, step: { color: C.muted, fontSize: 14, lineHeight: 20 }, currentStep: { color: C.txt, fontSize: 14, lineHeight: 20, fontWeight: '800' }, error: { color: C.red, fontSize: 13, lineHeight: 19 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }, emptyTitle: { color: C.txt, fontSize: 20, fontWeight: '800' } });
