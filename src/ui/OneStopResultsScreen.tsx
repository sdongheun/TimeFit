import { courseReplanTiming, preserveCourseDateContext } from './courseDateContext';
import { currentPlacePhoto } from './currentPlacePhoto';
import { PlacePhoto, PlacePhotoCredit } from './PlacePhoto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isCourseDateError } from '../services/courseRepository';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Course, createOneStopRouteService, LatLon, OneStopRouteResult, Spot, travelMin, validateCourseOpening } from '../engine';
import { buildBasketCourse } from './recommendation/basketPlanner';
import { buildOneStopRecommendations, OneStopRecommendation } from './recommendation/oneStop';
import { DEFAULT_ONE_STOP_SEARCH_RADIUS_M, filterOneStopCandidatesByRadius, ONE_STOP_SEARCH_STEPS_M } from './recommendation/oneStopSearchScope';
import { TimeJourney } from './recommendation/TimeJourney';
import { buildTimeJourney } from './recommendation/timeJourneyModel';
import { KakaoRouteMap } from './KakaoRouteMap';
import { fmtHM, RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { CourseV1DisplayPlace, openKakaoPlaceWithAppFallback } from './recommendation/courseV1PlacePreviewModel';
import * as WebBrowser from 'expo-web-browser';

type Props = NativeStackScreenProps<RootStackParamList, 'LegacyResults'>;
type Page = 'results' | 'map' | 'detail' | 'hours' | 'confirm';
type DetailState = {
  item: OneStopRecommendation;
  exact: OneStopRecommendation | null;
  loading: boolean;
  failed: boolean;
  from: 'results' | 'map';
};
const statusText = (status: OneStopRecommendation['status']) => status === 'recommended' ? '추천' : status === 'short' ? '빠듯' : '불가';
const statusColor = (status: OneStopRecommendation['status']) => status === 'recommended' ? C.green : status === 'short' ? C.amber : C.muted;

function asKakaoDisplayPlace(spot: Spot): CourseV1DisplayPlace {
  return {
    title: spot.title,
    lat: spot.lat,
    lon: spot.lon,
    mapVerification: {
      status: spot.mapVerificationStatus,
      placeId: spot.kakaoPlaceId,
      placeUrl: spot.kakaoPlaceUrl,
    },
  };
}

export function OneStopResultsScreen({ route, navigation }: Props) {
  const { result, origin, ctx, editingCourseId } = route.params;
  const target = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : origin;
  const insets = useSafeAreaInsets();
  const flow = useAppFlow();
  const [page, setPage] = useState<Page>('results');
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [representative, setRepresentative] = useState<OneStopRecommendation | null>(null);
  const [representativeLoading, setRepresentativeLoading] = useState(true);
  const [representativeFailed, setRepresentativeFailed] = useState(false);
  const [searchRadiusM, setSearchRadiusM] = useState<number>(DEFAULT_ONE_STOP_SEARCH_RADIUS_M);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const routeService = useMemo(() => createOneStopRouteService(), []);
  const scopedSpots = useMemo(() => filterOneStopCandidatesByRadius({
    spots: result.spatialCandidates as Spot[], origin, destination: ctx.appointment ? target : null,
    baselines: result.routeBaselines, radiusM: searchRadiusM,
  }), [ctx.appointment, origin, result.routeBaselines, result.spatialCandidates, searchRadiusM, target]);
  const items = useMemo(() => buildOneStopRecommendations({ spots: scopedSpots, origin, target, remainingMin: ctx.remainingMin, arrivalBufferMin: ctx.arrivalBufferMin ?? 10, includeUnavailable: true, estimate: ({ spot, mode }) => ({ approachMin: travelMin(origin, spot, mode), onwardMin: travelMin(spot, target, mode) }) }), [ctx.arrivalBufferMin, ctx.remainingMin, origin, scopedSpots, target]);
  const available = useMemo(() => items.filter((item) => item.status !== 'unavailable'), [items]);
  const active = detail?.exact ?? representative;
  const endMin = ctx.startMin + ctx.remainingMin;
  const openKakao = async (spot: Spot) => {
    const result = await openKakaoPlaceWithAppFallback(asKakaoDisplayPlace(spot), {
      canOpenApp: Linking.canOpenURL,
      openApp: Linking.openURL,
      openExternal: Linking.openURL,
      openBrowser: WebBrowser.openBrowserAsync,
    });
    if (result === 'failed' || result === 'unavailable') Alert.alert('카카오맵을 열 수 없어요', '잠시 후 다시 시도해 주세요.');
  };
  const openKakaoNearby = async () => {
    try { await Linking.openURL(`https://map.kakao.com/link/search/${encodeURIComponent('카페')}`); }
    catch { Alert.alert('카카오맵을 열 수 없어요', '잠시 후 다시 시도해 주세요.'); }
  };
  const startCourse = async () => {
    if (!active || active.status === 'unavailable' || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    try {
      const expired = (context: typeof ctx) => {
        // Only a brand-new plan may derive its initial end from its original input.
        // Existing edits must use the repository-restored end, never the reduced duration.
        const initialEnd = !editingCourseId && context.endsAtIso === undefined
          ? Date.parse(context.startedAtIso ?? '') + context.remainingMin * 60_000 : NaN;
        const dated = Number.isFinite(initialEnd) ? { ...context, endsAtIso: new Date(initialEnd).toISOString() } : context;
        if (courseReplanTiming(dated, Date.now()).kind !== 'expired') return false;
        Alert.alert('코스 시간이 지났어요', '기존 기록은 그대로 유지됩니다. 시간을 다시 설정해 주세요.', [
          { text: '닫기', style: 'cancel' }, { text: '시간 다시 설정', onPress: () => navigation.navigate('TimeSetup') },
        ]);
        return true;
      };
      if (expired(ctx)) return;
      const spot = active.spot as Spot;
      const course = buildBasketCourse([spot], origin, target, ctx, { [spot.contentId]: active.mode }, { finalMode: active.mode });
      const stay = course.legs.find((leg) => leg.label.startsWith('체류 가능'))?.min ?? 0;
      const opening = await validateCourseOpening([spot], origin, target, [active.mode, active.mode], ctx.startMin, [stay]);
      if (!opening.ok) { Alert.alert('이 시간에는 담기 어려워요', opening.reason ?? '운영시간을 확인해 주세요.'); return; }
      if (expired(ctx)) return;
      const base = { course, origin, ctx: preserveCourseDateContext(ctx) };
      const params = editingCourseId
        ? await flow.replaceCourse(editingCourseId, { ...base, courseId: editingCourseId })
        : await flow.saveCourse(base);
      if (expired(params.ctx)) return;
      flow.setActiveCourse(params); navigation.replace('Execution', params);
    } catch (error) {
      if (error instanceof Error && error.message === 'basket_route_unavailable') {
        Alert.alert('실제 경로를 확인하지 못했어요', '경로 확인이 되기 전에는 이 장소를 추천하지 않습니다.', [
          { text: '닫기', style: 'cancel' },
          { text: '다시 확인', onPress: () => openDetail(active, true) },
        ]);
        return;
      }
      if (isCourseDateError(error)) {
        const message = error.code === 'course_date_unavailable' ? '원래 코스 시간을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : error.code === 'course_date_conflict' ? '저장된 코스 시간과 일치하지 않아요. 기존 기록은 그대로 유지됩니다.'
          : '코스 날짜를 확인할 수 없어요. 시간을 다시 설정해 주세요.';
        Alert.alert('코스 시간을 확인해 주세요', message, [
          { text: '닫기', style: 'cancel' },
          ...(error.code === 'course_date_unavailable' ? [{ text: '다시 시도', onPress: () => void startCourse() }] : []),
          { text: '시간 다시 설정', onPress: () => navigation.navigate('TimeSetup') },
        ]);
        return;
      }
      Alert.alert('코스를 만들지 못했어요', '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    finally { savingLock.current = false; setSaving(false); }
  };
  const Header = ({ title, back }: { title: string; back: () => void }) => <View style={s.header}><Pressable variant="icon" style={s.icon} onPress={back}><Text style={s.backIcon}>‹</Text></Pressable><Text style={s.headerTitle}>{title}</Text><View style={s.icon} /></View>;
  const statusChip = (item: OneStopRecommendation) => <View style={[s.chip, { backgroundColor: `${statusColor(item.status)}28` }]}><Text style={[s.chipText, { color: statusColor(item.status) }]}>{statusText(item.status)}</Text></View>;
  const image = (item: OneStopRecommendation, height = 116) => <View><PlacePhoto place={currentPlacePhoto(item.spot.contentId)} style={{height,flex:0}} fallback={<View style={[s.imageFallback, {height}]}><Text style={s.imageFallbackText}>{item.spot.category}</Text></View>} /><PlacePhotoCredit place={currentPlacePhoto(item.spot.contentId)} links /></View>;
  const journeyOf = (item: OneStopRecommendation) => buildTimeJourney(item, ctx.startMin, endMin);
  const exactRecommendation = (item: OneStopRecommendation, routeResult: OneStopRouteResult): OneStopRecommendation | null => {
    const modes = (['walk', 'transit'] as const).filter((mode) => routeResult.modes[mode].exact);
    if (!modes.length) return null;
    return buildOneStopRecommendations({
      spots: [item.spot], origin, target, remainingMin: ctx.remainingMin,
      arrivalBufferMin: ctx.arrivalBufferMin ?? 10, modes,
      estimate: ({ mode }) => routeResult.modes[mode],
    })[0] ?? null;
  };
  const refine = async (item: OneStopRecommendation, forceRefresh = false) => {
    const routeResult = await routeService.get({ origin, target, spot: item.spot, forceRefresh });
    return exactRecommendation(item, routeResult);
  };

  useEffect(() => {
    let cancelled = false;
    const start = available.length ? recommendationIndex % available.length : 0;
    setRepresentative(null);
    setRepresentativeFailed(false);
    setRepresentativeLoading(available.length > 0);
    if (!available.length) return () => { cancelled = true; };
    void (async () => {
      // 근사 후보가 실제 경로에서 탈락하면 최대 세 곳까지만 재검사한다.
      for (let offset = 0; offset < Math.min(3, available.length); offset += 1) {
        const item = available[(start + offset) % available.length];
        const exact = await refine(item);
        if (cancelled) return;
        if (exact && exact.status !== 'unavailable') {
          setRepresentative(exact);
          setRepresentativeLoading(false);
          return;
        }
      }
      if (!cancelled) { setRepresentativeFailed(true); setRepresentativeLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [available, recommendationIndex]);

  const openDetail = (item: OneStopRecommendation, forceRefresh = false, sourcePage?: 'results' | 'map') => {
    const from = sourcePage ?? (page === 'map' ? 'map' : 'results');
    setDetail({ item, exact: null, loading: true, failed: false, from });
    setPage('detail');
    void refine(item, forceRefresh).then((exact) => {
      setDetail((current) => current?.item.spot.contentId === item.spot.contentId
        ? { ...current, exact, loading: false, failed: !exact }
        : current);
    }).catch(() => {
      setDetail((current) => current?.item.spot.contentId === item.spot.contentId
        ? { ...current, loading: false, failed: true }
        : current);
    });
  };

  if (page === 'map') return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: 30 }]}><Header title="지도에서 더 보기" back={() => { setDetail(null); setPage('results'); }} /><Text style={s.smallCopy}>장소를 열면 실제 경로와 남은 시간을 확인합니다.</Text><View style={s.rangeControl}><View style={s.rangeHead}><Text style={s.rangeTitle}>탐색 범위</Text><Text style={s.rangeValue}>{(searchRadiusM / 1000).toFixed(searchRadiusM % 1000 ? 1 : 0)}km</Text></View><Slider minimumValue={0} maximumValue={ONE_STOP_SEARCH_STEPS_M.length - 1} step={1} value={ONE_STOP_SEARCH_STEPS_M.indexOf(searchRadiusM as typeof ONE_STOP_SEARCH_STEPS_M[number])} minimumTrackTintColor={C.accent} maximumTrackTintColor={C.line} thumbTintColor={C.accent} onValueChange={(value) => setSearchRadiusM(ONE_STOP_SEARCH_STEPS_M[Math.round(value)])} /><Text style={s.rangeHint}>기본 1km · 넓힐 때만 원거리 장소를 표시해요</Text></View><KakaoRouteMap style={s.map} points={[origin, ...available.map((item) => item.spot), target]} line={[]} markers={[{ ...origin, label: '현재 위치', kind: 'origin' }, ...available.map((item) => ({ ...item.spot, label: item.spot.title, kind: 'spot' as const, ...currentPlacePhoto(item.spot.contentId) })), ...(ctx.appointment ? [{ ...target, label: ctx.appointment.label, kind: 'appointment' as const }] : [])]} showMarkerLabels usePhotoMarkers onMarkerTap={(index) => { const item = available[index - 1]; if (item) openDetail(item); }} />
    <View style={s.candidateList}>{available.map((item) => <Pressable key={item.spot.contentId} style={s.candidateRow} onPress={() => openDetail(item)}><View style={s.candidateText}><Text style={s.candidateName}>{item.spot.title}</Text><Text style={s.candidateMeta}>실제 경로로 남은 시간 확인</Text></View>{statusChip(item)}</Pressable>)}</View></ScrollView></View>;

  if (page === 'hours') return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}><Header title="운영시간 확인 필요" back={() => setPage(detail ? 'detail' : 'results')} /><View style={s.hoursBox}><Text style={s.hoursTitle}>이 장소는 운영시간을 확인하지 못했습니다.</Text><Text style={s.hoursCopy}>TimeFit은 시간 안에 이용 가능하다고 보장하지 않습니다.</Text></View>{active ? <Pressable style={s.secondary} onPress={() => openKakao(active.spot as Spot)}><Text style={s.secondaryText}>카카오맵에서 확인</Text></Pressable> : null}</ScrollView></View>;

  if (page === 'detail' && detail) {
    if (detail.loading) return <View style={s.root}><View style={s.detailLoading}><ActivityIndicator color={C.accent} /><Text style={s.detailLoadingTitle}>실제 이동 시간을 확인하고 있어요</Text><Text style={s.detailLoadingCopy}>이 장소까지와 도착지까지의 경로를 계산합니다.</Text></View></View>;
    if (detail.failed || !detail.exact) return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}><Header title={detail.item.spot.title} back={() => setPage(detail.from)} /><View style={s.empty}><Text style={s.emptyTitle}>실제 경로를{`\n`}확인하지 못했어요</Text><Text style={s.emptyCopy}>경로 확인이 되기 전에는 이 장소를 추천하지 않습니다.</Text><Pressable style={s.secondary} onPress={() => openDetail(detail.item, true, detail.from)}><Text style={s.secondaryText}>다시 확인</Text></Pressable></View></ScrollView></View>;
    const active = detail.exact;
    const journey = journeyOf(active);
    return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: 32 }]}><Header title={active.spot.title} back={() => setPage(detail.from)} />{image(active, 156)}<View style={s.journeyCard}><TimeJourney startMin={ctx.startMin} approachMin={active.approachMin} activityMin={journey.activityMin} onwardMin={active.onwardMin} reserveMin={journey.reserveMin} endMin={endMin} /></View><View style={s.detailMeta}><Text style={s.detailMetaText}>최소 {active.minimumStayMin}분</Text><Text style={s.detailMetaText}>권장 {active.recommendedStayMin}분</Text><Text style={[s.detailMetaText, { color: statusColor(active.status) }]}>{statusText(active.status)}</Text></View>{!(active.spot as Spot).operatingHours?.length ? <Pressable style={s.link} onPress={() => setPage('hours')}><Text style={s.linkText}>운영시간 확인 필요</Text></Pressable> : null}<Pressable style={s.secondary} onPress={() => openKakao(active.spot as Spot)}><Text style={s.secondaryText}>카카오맵에서 장소 확인</Text></Pressable><Pressable disabled={active.status === 'unavailable'} style={[s.primary, active.status === 'unavailable' && s.primaryOff]} onPress={() => setPage('confirm')}><Text style={s.primaryText}>{active.status === 'unavailable' ? '이 조건에서는 선택할 수 없어요' : '이곳 선택하기'}</Text></Pressable></ScrollView></View>;
  }

  if (page === 'confirm' && active) {
    const journey = journeyOf(active);
    return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}><Header title="이 코스로 갈까요?" back={() => setPage('detail')} /><View style={s.confirmCard}><Text style={s.eyebrow}>도착 전 여유를 남기는 한 곳</Text><Text style={s.confirmName}>{active.spot.title}</Text><TimeJourney startMin={ctx.startMin} approachMin={active.approachMin} activityMin={journey.activityMin} onwardMin={active.onwardMin} reserveMin={journey.reserveMin} endMin={endMin} compact /></View><Pressable style={s.primary} onPress={startCourse} disabled={saving}>{saving ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.primaryText}>길찾기 시작</Text>}</Pressable></ScrollView></View>;
  }

  const recommendation = representative;
  const recommendedJourney = recommendation ? journeyOf(recommendation) : null;
  if (representativeLoading) return <View style={s.root}><View style={s.detailLoading}><ActivityIndicator color={C.accent} /><Text style={s.detailLoadingTitle}>실제 이동 시간을 확인하고 있어요</Text><Text style={s.detailLoadingCopy}>시간 안에 들를 수 있는 한 곳을 고르고 있습니다.</Text></View></View>;
  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: 32 }]}><View style={s.resultHeader}><Pressable variant="icon" style={s.icon} onPress={() => navigation.goBack()}><Text style={s.backIcon}>‹</Text></Pressable><Text style={s.headerTitle}>지금 할 수 있는 한 가지</Text><Pressable variant="icon" style={s.icon} onPress={() => setRecommendationIndex((value) => value + 1)}><Text style={s.refresh}>↻</Text></Pressable></View>{recommendation && recommendedJourney ? <><View style={s.budget}><Text style={s.budgetStrong}>{fmtHM(endMin)}까지 {ctx.remainingMin}분</Text><Text style={s.budgetCopy}>도착 전 {ctx.arrivalBufferMin ?? 10}분 남기기</Text></View><View style={s.journeyCard}><TimeJourney startMin={ctx.startMin} approachMin={recommendation.approachMin} activityMin={recommendedJourney.activityMin} onwardMin={recommendation.onwardMin} reserveMin={recommendedJourney.reserveMin} endMin={endMin} /></View><Pressable style={s.placeCard} onPress={() => openDetail(recommendation)}>{image(recommendation)}<View style={s.placeBody}><View style={s.topline}><Text style={s.category}>{recommendation.spot.category}</Text>{statusChip(recommendation)}</View><Text style={s.placeName}>{recommendation.spot.title}</Text><Text style={s.arrival}>{fmtHM(recommendedJourney.departureMin)}에 출발하면 {fmtHM(recommendedJourney.arrivalMin)} 도착</Text></View></Pressable></> : <View style={s.empty}><Text style={s.emptyTitle}>확신 있게 추천할{`\n`}장소를 찾지 못했어요</Text><Text style={s.emptyCopy}>{representativeFailed ? '실제 경로를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' : '시간과 운영 상태를 함께 만족하는 후보가 없습니다.'}</Text><Pressable style={s.secondary} onPress={() => navigation.goBack()}><Text style={s.secondaryText}>시간과 범위 다시 설정</Text></Pressable><Pressable style={s.secondary} onPress={() => setPage('map')}><Text style={s.secondaryText}>지도에서 더 보기</Text></Pressable><Pressable style={s.link} onPress={openKakaoNearby}><Text style={s.linkText}>카카오맵에서 주변 카페 찾기</Text></Pressable></View>}{recommendation ? <Pressable style={s.secondary} onPress={() => setPage('map')}><Text style={s.secondaryText}>지도에서 더 보기</Text></Pressable> : null}{recommendation && !(recommendation.spot as Spot).operatingHours?.length ? <Pressable style={s.link} onPress={() => setPage('hours')}><Text style={s.linkText}>운영시간 확인 필요 장소</Text></Pressable> : null}</ScrollView></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 14 }, header: { height: 52, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, resultHeader: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }, backIcon: { color: C.txt, fontSize: 32, lineHeight: 34 }, refresh: { color: C.txt, fontSize: 22 }, headerTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, smallCopy: { color: C.muted, fontSize: 13, lineHeight: 20 },
  budget: { gap: 5, marginTop: 6 }, budgetStrong: { color: C.txt, fontSize: 24, fontWeight: '800' }, budgetCopy: { color: C.muted, fontSize: 13 }, journeyCard: { paddingHorizontal: 15, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, placeCard: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, image: { width: '100%', resizeMode: 'cover', backgroundColor: C.panel2 }, imageFallback: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2 }, imageFallbackText: { color: C.muted, fontSize: 13, fontWeight: '800' }, placeBody: { padding: 15 }, topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, category: { color: '#74b0ff', fontSize: 12, fontWeight: '800' }, placeName: { color: C.txt, fontSize: 18, fontWeight: '800', marginTop: 8 }, arrival: { color: C.green, fontSize: 13, fontWeight: '800', marginTop: 12 }, detailMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }, detailMetaText: { color: C.txt2, fontSize: 13, fontWeight: '800' },
  primary: { minHeight: 52, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, primaryOff: { backgroundColor: C.panel2 }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' }, secondary: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' }, link: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, linkText: { color: '#75b1ff', fontSize: 14, fontWeight: '800' }, chip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99 }, chipText: { fontSize: 12, fontWeight: '800' },
  map: { height: 362, borderRadius: 18, overflow: 'hidden', marginTop: 3 }, candidateList: { gap: 10, marginTop: 2 }, candidateRow: { minHeight: 66, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, candidateText: { flex: 1 }, candidateName: { color: C.txt, fontSize: 15, fontWeight: '800' }, candidateMeta: { color: C.muted, fontSize: 12, marginTop: 4 },
  rangeControl: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, rangeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rangeTitle: { color: C.txt, fontSize: 14, fontWeight: '800' }, rangeValue: { color: '#70adff', fontSize: 17, fontWeight: '800' }, rangeHint: { color: C.muted, fontSize: 12, marginTop: 2 },
  hoursBox: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f0af4288', backgroundColor: C.panel }, hoursTitle: { color: '#ffd28c', fontSize: 16, fontWeight: '800' }, hoursCopy: { color: C.txt2, fontSize: 13, lineHeight: 20, marginTop: 7 }, confirmCard: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, eyebrow: { color: '#6eacff', fontSize: 13, fontWeight: '800' }, confirmName: { color: C.txt, fontSize: 26, fontWeight: '800', marginTop: 12, marginBottom: 18 }, empty: { minHeight: 380, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: C.txt, textAlign: 'center', fontSize: 26, lineHeight: 34, fontWeight: '800' }, emptyCopy: { color: C.muted, textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 10 },
  detailLoading: { flex: 1, paddingHorizontal: 34, alignItems: 'center', justifyContent: 'center' }, detailLoadingTitle: { color: C.txt, fontSize: 20, fontWeight: '800', marginTop: 18 }, detailLoadingCopy: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
});
