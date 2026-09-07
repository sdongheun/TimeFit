import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { InPlaceTransition } from './InPlaceTransition';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { C } from './theme';
import { personalizationSession, isPersonalizationScopeCurrent } from './personalizationComposition';
import { RootStackParamList } from './nav';
import { CourseV1Journey } from './recommendation/CourseV1Journey';
import { getPlaceDiscoveryContext } from './recommendation/courseV1DiscoveryContext';
import { startMinuteForRecommendation } from './recommendation/recommendationSessionTime';
import { CourseV1PlacePreview } from './recommendation/CourseV1PlacePreview';
import { openKakaoPlaceWithAppFallback, type CourseV1DisplayPlace } from './recommendation/courseV1PlacePreviewModel';
import { buildCourseV1CardSummary, type CourseV1CardSummary } from './recommendation/courseV1CardDetailModel';
import { CourseV1SummaryCard } from './recommendation/CourseV1SummaryCard';
import { courseV1OutcomeMessage } from './recommendation/courseV1OutcomeMessageModel';
import { RecommendationInternalDiagnosticsPanel } from './recommendation/RecommendationInternalDiagnostics';
import { recommendationDiagnosticsEnabled, recommendationInternalDiagnosticsModel } from './recommendation/recommendationInternalDiagnosticsModel';
import { recommendationInternalPolicyForEnvironment } from './recommendation/recommendationInternalBuildModel';
import { canRecordTwoStopSelectionIntent, continueReleaseRecommendationSession, getTwoStopSelectionPort, isRecommendationSessionOperationInFlight, requestConditionalManualCourse } from './recommendation/v1Session';
import { createCourseV1CandidateProvider, type CourseV1ConditionalVisitCandidate } from '../data/courseV1CandidateProvider';
import type { VerifiedCourseV1 } from '../engine';
import { conditionalManualMessage, conditionalVisitPage, createKeyedInFlightLock, isConditionalManualConfirmTime, millisecondsUntilConditionalVisibilityBoundary, runConditionalManualAction } from './recommendation/verifiedCourseResultsModel';
import { releaseOneStopDisplayResult } from './recommendation/releaseOneStopResultsModel';
import { appendReleaseOneStopPage, createReleaseOneStopMoreInFlightLock, initialReleaseOneStopMoreState, releaseOneStopMoreEndMessage, type ReleaseOneStopMoreState } from './recommendation/releaseOneStopMoreResultsModel';
import { TwoStopSelectionPanel } from './recommendation/TwoStopSelectionPanel';
import { TwoStopFixedCourseCta, TwoStopSelectionTray, type TwoStopTrayPlace } from './recommendation/TwoStopSelectionTray';
import { buildTwoStopCandidateCard, createInlineTwoStopSelectionController, createTwoStopSelectionController, resultsCourseRegionMode, type JsonValue } from './recommendation/twoStopSelectionModel';
import type { CourseV1ReleaseOneStopContinuation, CourseV1ReleaseOneStopPageState } from '../engine';
import { placeDetailSelectionHandoff, type PlaceDetailRequestIdentity } from './placeDetailModel';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;
type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const places = new Map<string, RuntimePlace>([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place]));
type ConditionalManualState = Readonly<{ loading: boolean; course?: VerifiedCourseV1; error?: string }>;
type PendingDetailSelection = Readonly<{
  request: PlaceDetailRequestIdentity;
  course: VerifiedCourseV1;
  snapshot?: Readonly<{ courses: readonly VerifiedCourseV1[]; singleContinuation: JsonValue; singlePageState: string | null; scrollOffset: number; focusedCourseId?: string }>;
}>;

export function ResultsScreen({ route, navigation }: Props) {
  const [, setPersonalizationVersion] = useState(personalizationSession.version());
  useEffect(() => personalizationSession.subscribe(() => setPersonalizationVersion(personalizationSession.version())), []);
  const { result: engineResult, session } = route.params;
  const result = releaseOneStopDisplayResult(engineResult);
  const initialMoreState = useMemo(() => initialReleaseOneStopMoreState(engineResult), [engineResult]);
  const [moreState, setMoreState] = useState<ReleaseOneStopMoreState>(initialMoreState);
  const [moreLoading, setMoreLoading] = useState(false);
  const [sharedExpansionExhausted, setSharedExpansionExhausted] = useState(false);
  const moreLock = useRef(createReleaseOneStopMoreInFlightLock()).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const focusedCourseIdRef = useRef<string | undefined>(undefined);
  const twoStopPort = useMemo(() => getTwoStopSelectionPort(session), [session]);
  const twoStopController = useMemo(() => twoStopPort ? createTwoStopSelectionController(twoStopPort) : null, [twoStopPort]);
  const inlineSelection = useMemo(() => createInlineTwoStopSelectionController(
    twoStopController,
    (selected) => canRecordTwoStopSelectionIntent(session, selected),
  ), [session, twoStopController]);
  const [, setTwoStopRevision] = useState(0);
  const forwardNavigationRef = useRef(false);
  const pendingDetailSelectionRef = useRef<PendingDetailSelection | null>(null);
  const insets = useSafeAreaInsets();
  const [linkError, setLinkError] = useState('');
  const alternativeCourses = moreState.alternativeCourses;
  const course = moreState.representativeCourse;
  const renderedCourseCount = (course ? 1 : 0) + alternativeCourses.length;
  const diagnosticsEnabled = recommendationDiagnosticsEnabled(process.env.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS);
  const diagnosticsPanel = diagnosticsEnabled
    ? <RecommendationInternalDiagnosticsPanel diagnostics={recommendationInternalDiagnosticsModel(engineResult, renderedCourseCount)} policy={recommendationInternalPolicyForEnvironment({ diagnostics: process.env.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS, internalB12: process.env.EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12 })} /> : null;
  const displayPlace = (id: string): CourseV1DisplayPlace => places.get(id) ?? { title: id, lat: Number.NaN, lon: Number.NaN };
  const openPlace = async (place: CourseV1DisplayPlace) => {
    const status = await openKakaoPlaceWithAppFallback(place, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openExternal: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
    setLinkError(status === 'app_opened' || status === 'external_opened' || status === 'browser_fallback_opened' ? '' : '카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
  };
  const conditionalCandidates = useMemo(() => createCourseV1CandidateProvider().listConditionalVisitCandidates(new Date(session.nowIso)), [session.nowIso]);
  const [conditionalActualNow, setConditionalActualNow] = useState(() => new Date());
  const initialConditionalPage = useMemo(() => conditionalVisitPage(conditionalCandidates, session, conditionalActualNow), [conditionalActualNow, conditionalCandidates, session]);
  const [conditionalPlaces, setConditionalPlaces] = useState<readonly CourseV1ConditionalVisitCandidate[]>(initialConditionalPage.places);
  const [conditionalCursor, setConditionalCursor] = useState(initialConditionalPage.nextCursor);
  const [conditionalManual, setConditionalManual] = useState<Readonly<Record<string, ConditionalManualState>>>({});
  const conditionalManualLocks = useRef(createKeyedInFlightLock()).current;
  const conditionalVisible = isConditionalManualConfirmTime(conditionalActualNow);
  useEffect(() => {
    const unsubscribe = inlineSelection.subscribe(() => setTwoStopRevision((value) => value + 1));
    return () => {
      unsubscribe();
      inlineSelection.cancelFirst();
      const pending = pendingDetailSelectionRef.current;
      if (pending) placeDetailSelectionHandoff.cancel(pending.request);
      pendingDetailSelectionRef.current = null;
    };
  }, [inlineSelection]);
  useFocusEffect(useCallback(() => {
    forwardNavigationRef.current = false;
    const pending = pendingDetailSelectionRef.current;
    if (!pending) return;
    const consumed = placeDetailSelectionHandoff.consume(pending.request);
    pendingDetailSelectionRef.current = null;
    placeDetailSelectionHandoff.cancel(pending.request);
    if (!consumed) return;
    if (pending.request.selectionKind === 'first' && pending.snapshot) {
      void inlineSelection.selectFirst(pending.course, pending.snapshot);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
    } else if (pending.request.selectionKind === 'pair') inlineSelection.selectPair(pending.course);
  }, [inlineSelection]));
  useEffect(() => {
    const refreshActualNow = () => setConditionalActualNow(new Date());
    const timer = setTimeout(refreshActualNow, millisecondsUntilConditionalVisibilityBoundary(conditionalActualNow));
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') refreshActualNow(); });
    return () => { clearTimeout(timer); appState.remove(); };
  }, [conditionalActualNow]);
  useEffect(() => {
    if (!conditionalVisible) return;
    const page = conditionalVisitPage(conditionalCandidates, session, conditionalActualNow);
    setConditionalPlaces(page.places);
    setConditionalCursor(page.nextCursor);
  }, [conditionalActualNow, conditionalCandidates, conditionalVisible, session]);
  const showMoreConditionalPlaces = () => {
    if (!conditionalVisible || conditionalCursor === null) return;
    const next = conditionalVisitPage(conditionalCandidates, session, conditionalActualNow, conditionalCursor);
    setConditionalPlaces((current) => [...current, ...next.places.filter((place) => !current.some((shown) => shown.id === place.id))]);
    setConditionalCursor(next.nextCursor);
  };
  const confirmConditionalPlace = async (placeId: string) => {
    if (!conditionalManualLocks.tryLock(placeId)) return;
    const confirmedAt = new Date();
    setConditionalManual((current) => ({ ...current, [placeId]: { loading: true } }));
    try {
      const manual = await runConditionalManualAction(confirmedAt, () => requestConditionalManualCourse(session, placeId, confirmedAt));
      if (manual.state === 'success') {
        setConditionalManual((current) => ({ ...current, [placeId]: { loading: false, course: manual.course } }));
        return;
      }
      const error = manual.state === 'after_window'
        ? '조건부 장소는 오후 6시 전 확인 후 계산할 수 있어요. 다시 추천해 주세요.'
        : manual.state === 'unavailable'
        ? conditionalManualMessage('unavailable')
        : conditionalManualMessage(manual.reason === 'conditional_confirmation_required' ? 'conditional_candidate_not_eligible' : manual.reason);
      setConditionalManual((current) => ({ ...current, [placeId]: { loading: false, error } }));
    } catch {
      setConditionalManual((current) => ({ ...current, [placeId]: { loading: false, error: conditionalManualMessage('unavailable') } }));
    } finally {
      conditionalManualLocks.release(placeId);
    }
  };
  const showMoreVerifiedPlaces = async () => {
    if (moreLoading || isRecommendationSessionOperationInFlight(session) || moreState.pageState !== 'more_available' || !moreState.continuation || !moreLock.tryLock()) return;
    setMoreLoading(true);
    try {
      const page = await continueReleaseRecommendationSession(session, moreState.continuation);
      if (page?.pageState === 'shared_attempt_limit') {
        setSharedExpansionExhausted(true);
        setMoreState((current) => ({ ...current, pageState: 'exhausted' }));
      } else {
        setMoreState((current) => page
          ? appendReleaseOneStopPage(current, page)
          : { ...current, pageState: 'continuation_unavailable' });
      }
    } catch {
      setMoreState((current) => ({ ...current, pageState: 'provider_unavailable' }));
    } finally {
      moreLock.release();
      setMoreLoading(false);
    }
  };
  const openFirstPlaceDetail = (selected: VerifiedCourseV1) => {
    if (pendingDetailSelectionRef.current || moreLoading || isRecommendationSessionOperationInFlight(session)) return;
    focusedCourseIdRef.current = selected.id;
    const snapshot = {
      courses: [moreState.representativeCourse, ...moreState.alternativeCourses].filter((item): item is VerifiedCourseV1 => Boolean(item)),
      singleContinuation: (moreState.continuation ?? null) as unknown as JsonValue,
      singlePageState: sharedExpansionExhausted ? 'shared_attempt_limit' : moreState.pageState,
      scrollOffset: scrollOffsetRef.current,
      ...(focusedCourseIdRef.current ? { focusedCourseId: focusedCourseIdRef.current } : {}),
    };
    const placeId = selected.placeIds[0];
    if (!placeId) return;
    const request = placeDetailSelectionHandoff.issue({ selectionKind: 'first', courseId: selected.id, placeId });
    pendingDetailSelectionRef.current = { request, course: selected, snapshot };
    forwardNavigationRef.current = true;
    navigation.navigate('PlaceDetail', { ...request, session, course: selected });
  };
  const openPairPlaceDetail = (pairCourse: VerifiedCourseV1, firstCourse: VerifiedCourseV1) => {
    if (pendingDetailSelectionRef.current) return;
    const firstPlaceId = firstCourse.placeIds[0];
    const placeId = pairCourse.placeIds.find((id) => id !== firstPlaceId);
    if (!firstPlaceId || !placeId) return;
    const request = placeDetailSelectionHandoff.issue({ selectionKind: 'pair', courseId: pairCourse.id, placeId });
    pendingDetailSelectionRef.current = { request, course: pairCourse };
    forwardNavigationRef.current = true;
    navigation.navigate('PlaceDetail', { ...request, session, course: pairCourse, firstCourse });
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; };
  const cancelTwoStopSelection = () => {
    const snapshot = inlineSelection.cancelFirst();
    if (!snapshot) return;
    const sharedAttemptLimit = snapshot.singlePageState === 'shared_attempt_limit';
    const pageState = sharedAttemptLimit ? 'exhausted' : snapshot.singlePageState as CourseV1ReleaseOneStopPageState | null;
    setMoreState({
      representativeCourse: snapshot.courses[0] ?? null,
      alternativeCourses: snapshot.courses.slice(1),
      continuation: snapshot.singleContinuation as unknown as CourseV1ReleaseOneStopContinuation | null,
      pageState,
    });
    setSharedExpansionExhausted(sharedAttemptLimit);
    focusedCourseIdRef.current = snapshot.focusedCourseId;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: snapshot.scrollOffset, animated: false }));
  };
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (forwardNavigationRef.current || inlineSelection.getState().mode === 'idle') return;
    event.preventDefault();
    cancelTwoStopSelection();
  }), [inlineSelection, navigation]);
  const confirmSelection = () => {
    const selected = inlineSelection.getSelectedCourse();
    if (!selected) return;
    forwardNavigationRef.current = true;
    navigation.navigate('CourseConfirm', { session, course: selected });
  };
  const header = <View style={s.header}><Pressable variant="icon" accessibilityLabel="시간 설정으로 돌아가기" style={s.icon} onPress={() => navigation.goBack()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>시간의 추천</Text><View style={s.icon} /></View>;
  if (!isPersonalizationScopeCurrent(session)) return <View style={[s.root, { paddingTop: insets.top + 14 }]}>{header}<View style={s.empty}><Text style={s.emptyTitle}>추천 설정이 바뀌었어요</Text><Text style={s.copy}>현재 계정과 동의 상태로 새 추천을 받아주세요. 진행 중인 코스는 그대로 유지됩니다.</Text><Pressable testID="personalization-recalculate" style={s.secondary} onPress={() => navigation.navigate('TimeSetup')}><Text style={s.secondaryText}>새 추천 받기</Text></Pressable></View></View>;
  if (!course) {
    if (moreState.pageState === 'more_available') {
      return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}<View style={s.empty}><Text style={s.emptyTitle}>아직 확인된 장소가 없어요</Text><Text style={s.copy}>남은 후보를 실제 경로로 더 확인할 수 있어요.</Text><VerifiedCourseMoreControl loading={moreLoading} onPress={showMoreVerifiedPlaces} /></View>{conditionalVisible ? <ConditionalVisitSection places={conditionalPlaces} nextCursor={conditionalCursor} displayPlace={displayPlace} onOpenKakao={openPlace} onMore={showMoreConditionalPlaces} manualStates={conditionalManual} onConfirm={confirmConditionalPlace} session={session} /> : null}{diagnosticsPanel}</ScrollView></View>;
    }
    const exhausted = result.resultState === 'no_verified_course_within_limit';
    const noRepresentativeCandidates = result.resultState === 'no_representative_candidates';
    const outcomeMessage = courseV1OutcomeMessage(result.primaryOutcomeReason);
    return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}<View style={s.empty}><Text style={s.emptyTitle}>{exhausted ? '실제 경로로 확인할 수 있는\n코스를 찾지 못했어요' : '이 조건에서 확신 있게 추천할\n코스를 찾지 못했어요'}</Text><Text style={s.copy}>{outcomeMessage ?? (exhausted ? '경로를 확인한 코스가 시간 안에 들어오지 않았어요.' : '시간과 운영 상태를 함께 만족하는 후보가 없어요.')}</Text><Pressable style={s.secondary} onPress={() => navigation.goBack()}><Text style={s.secondaryText}>{noRepresentativeCandidates ? '조건 다시 설정' : '시간과 위치 다시 설정'}</Text></Pressable></View>{conditionalVisible ? <ConditionalVisitSection places={conditionalPlaces} nextCursor={conditionalCursor} displayPlace={displayPlace} onOpenKakao={openPlace} onMore={showMoreConditionalPlaces} manualStates={conditionalManual} onConfirm={confirmConditionalPlace} session={session} /> : null}{diagnosticsPanel}</ScrollView></View>;
  }
  const representative = buildCourseV1CardSummary(course, '대표 추천', (id) => places.get(id));
  const alternatives = alternativeCourses
    .map((alternative, index) => buildCourseV1CardSummary(alternative, `다른 추천 ${index + 1}`, (id) => places.get(id)))
    .filter((item): item is CourseV1CardSummary => item !== null);
  if (!representative) {
    return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}<View style={s.empty}><Text style={s.emptyTitle}>코스 정보를 안전하게 표시할 수 없어요</Text><Text style={s.copy}>시간과 위치를 다시 설정해 추천을 받아 주세요.</Text><Pressable style={s.secondary} onPress={() => navigation.goBack()}><Text style={s.secondaryText}>시간과 위치 다시 설정</Text></Pressable></View>{diagnosticsPanel}</ScrollView></View>;
  }
  const inlineState = inlineSelection.getState();
  const selection = inlineSelection.getPairSelection();
  const selected = inlineState.mode !== 'idle';
  const firstSummary = selected ? buildCourseV1CardSummary(inlineState.firstCourse, '선택한 장소', (id) => places.get(id)) : null;
  const candidates = selected ? (selection?.courses ?? [])
    .map((item) => buildTwoStopCandidateCard(item, inlineState.firstCourse, (id) => places.get(id)))
    .filter((item): item is NonNullable<typeof item> => item !== null) : [];
  const selectedCandidate = selected ? candidates.find((item) => item.course === inlineState.selectedPairCourse) ?? null : null;
  const regionMode = resultsCourseRegionMode(inlineState, selection);
  const trayRows: TwoStopTrayPlace[] = firstSummary ? [{
    key: `first-${firstSummary.course.id}`,
    title: firstSummary.place.title,
    activityLabel: firstSummary.activityLabel,
    imageUrl: firstSummary.place.imageUrl,
    imageEvidence: firstSummary.place.imageEvidence,
    imageSource: firstSummary.place.imageSource,
    removeAccessibilityLabel: `${firstSummary.place.title} 선택 취소`,
    onRemove: cancelTwoStopSelection,
  }] : [];
  if (selectedCandidate) trayRows.push({
    key: `second-${selectedCandidate.placeId}`,
    title: selectedCandidate.title,
    activityLabel: selectedCandidate.activityLabel,
    imageUrl: selectedCandidate.place.imageUrl,
    imageEvidence: selectedCandidate.place.imageEvidence,
    imageSource: selectedCandidate.place.imageSource,
    removeAccessibilityLabel: `${selectedCandidate.title}만 선택 취소`,
    onRemove: () => { inlineSelection.clearPair(); },
  });
  const announcement = selectedCandidate
    ? `${selectedCandidate.title} 추가 선택됨`
    : firstSummary ? `${firstSummary.place.title} 선택됨. 함께 갈 장소를 확인합니다` : '';
  const moreEndMessage = sharedExpansionExhausted
    ? '이번 추천의 추가 확인 횟수를 모두 사용했어요'
    : releaseOneStopMoreEndMessage(moreState.pageState);
  const cardsBusy = moreLoading || isRecommendationSessionOperationInFlight(session);
  return <View style={s.root}>
    <View style={[s.persistentTop, { paddingTop: insets.top + 14 }]}>{header}<View style={s.budget}><Text style={s.budgetTitle}>{session.remainingMin}분 안에</Text><Text style={s.copy}>도착 전 {course.arrivalBufferMin}분 여유를 포함해 검증한 장소</Text></View></View>
    <View style={s.traySlot}>{selected && firstSummary ? <TwoStopSelectionTray rows={trayRows} announcement={announcement} /> : null}</View>
    <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={[s.body, { paddingTop: 10, paddingBottom: selected ? 86 + Math.max(insets.bottom, 10) : 34 }]}>
      <InPlaceTransition transitionKey={regionMode}>
        {regionMode === 'one_stop' ? <><VerifiedCourseCard summary={representative} busy={cardsBusy} onConfirm={() => openFirstPlaceDetail(representative.course)} />{linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}<View style={s.exploration}><Text accessibilityLiveRegion="polite" style={s.sectionTitle}>이 시간에 가능한 다른 장소</Text>{alternatives.map((alternative) => <VerifiedCourseCard key={alternative.course.id} summary={alternative} busy={cardsBusy} onConfirm={() => openFirstPlaceDetail(alternative.course)} />)}{moreState.pageState === 'more_available' ? <VerifiedCourseMoreControl loading={moreLoading} onPress={showMoreVerifiedPlaces} /> : moreEndMessage ? <Text accessibilityLiveRegion="polite" style={s.moreEnd}>{moreEndMessage}</Text> : alternatives.length === 0 ? <Text style={s.copy}>이 조건에서 확인된 다른 장소는 없어요.</Text> : null}</View>{conditionalVisible ? <ConditionalVisitSection places={conditionalPlaces} nextCursor={conditionalCursor} displayPlace={displayPlace} onOpenKakao={openPlace} onMore={showMoreConditionalPlaces} manualStates={conditionalManual} onConfirm={confirmConditionalPlace} session={session} /> : null}{diagnosticsPanel}</> : selected && firstSummary ? <TwoStopSelectionPanel state={selection} pairEnabled={inlineState.pairEnabled} regionMode={regionMode} candidates={candidates} selectedPairCourse={inlineState.selectedPairCourse} onSelectCandidate={(pairCourse) => openPairPlaceDetail(pairCourse, inlineState.firstCourse)} onContinue={() => void twoStopController?.continue()} /> : null}
      </InPlaceTransition>
    </ScrollView>
    <View style={s.ctaSlot}>{selected ? <TwoStopFixedCourseCta pairSelected={inlineState.mode === 'pair_selected'} bottomInset={insets.bottom} onPress={confirmSelection} /> : null}</View>
  </View>;
}

function VerifiedCourseCard({ summary, busy, onConfirm }: { summary: CourseV1CardSummary; busy: boolean; onConfirm: () => void }) {
  return <View accessibilityState={{ disabled: busy, busy }} pointerEvents={busy ? 'none' : 'auto'}><CourseV1SummaryCard summary={summary} onPress={onConfirm} /></View>;
}

function VerifiedCourseMoreControl({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return <Pressable testID="verified-course-more" accessibilityRole="button" accessibilityLabel={loading ? '다른 장소 확인 중' : '다른 장소 더 보기'} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} style={({ pressed }) => [s.moreButton, pressed && !loading && s.morePressed, loading && s.moreDisabled]} onPress={() => void onPress()}><Text style={s.moreButtonText}>{loading ? '다른 장소 확인 중…' : '다른 장소 더 보기'}</Text></Pressable>;
}

function ConditionalVisitSection({ places: conditionalPlaces, nextCursor, displayPlace, onOpenKakao, onMore, manualStates, onConfirm, session }: { places: readonly CourseV1ConditionalVisitCandidate[]; nextCursor: number | null; displayPlace: (id: string) => CourseV1DisplayPlace; onOpenKakao: (place: CourseV1DisplayPlace) => void; onMore: () => void; manualStates: Readonly<Record<string, ConditionalManualState>>; onConfirm: (placeId: string) => void; session: Props['route']['params']['session'] }) {
  if (!conditionalPlaces.length) return null;
  return <View style={s.exploration}><Text style={s.sectionTitle}>운영시간 확인 후 들러볼 곳</Text>{conditionalPlaces.map((place) => { const display = displayPlace(place.id); const manual = manualStates[place.id]; const manualCourse = manual?.course; return <View key={place.id} style={s.card}><Text style={s.courseName}>{place.title}</Text><Text style={s.copy}>운영시간을 카카오맵에서 확인해 주세요</Text><Pressable style={s.secondary} onPress={() => void onOpenKakao(display)}><Text style={s.secondaryText}>카카오맵에서 확인</Text></Pressable><Pressable testID={`conditional-manual-${place.id}`} disabled={manual?.loading} style={s.secondary} onPress={() => void onConfirm(place.id)}><Text style={s.secondaryText}>{manual?.loading ? '실제 경로를 확인하고 있어요' : '확인했어요, 이 장소로 코스 계산'}</Text></Pressable>{manual?.error ? <Text accessibilityRole="alert" style={s.error}>{manual.error}</Text> : null}{manualCourse ? <View style={s.manualResult}><Text style={s.manualLabel}>운영시간 확인 필요(사용자 확인)</Text><CourseV1Journey course={manualCourse} startMin={startMinuteForRecommendation(session.nowIso)} /><View style={s.placeList}>{manualCourse.placeIds.map((id) => <CourseV1PlacePreview key={id} place={displayPlace(id)} context={getPlaceDiscoveryContext(places.get(id))} onOpenKakao={onOpenKakao} />)}</View></View> : null}</View>; })}{nextCursor !== null ? <Pressable testID="conditional-visit-more" style={s.secondary} onPress={onMore}><Text style={s.secondaryText}>더 보기</Text></Pressable> : null}</View>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 14 }, persistentTop: { paddingHorizontal: 22, paddingBottom: 8 }, traySlot: {}, ctaSlot: {}, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, back: { color: C.txt, fontSize: 32, lineHeight: 34 }, title: { color: C.txt, fontSize: 17, fontWeight: '800' }, budget: { marginTop: 8 }, budgetTitle: { color: C.txt, fontSize: 26, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, card: { padding: 17, gap: 13, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, eyebrow: { color: '#74b0ff', fontSize: 13, fontWeight: '800' }, shortState: { color: '#ffd08a', fontSize: 13, fontWeight: '800', marginTop: -6 }, courseName: { color: C.txt, fontSize: 22, lineHeight: 30, fontWeight: '800' }, discoveryContext: { color: '#b9d8ff', fontSize: 13, fontWeight: '700', marginTop: -6 }, placeList: { paddingTop: 3, gap: 5 }, manualResult: { gap: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }, manualLabel: { color: '#ffd08a', fontSize: 14, fontWeight: '800' }, remaining: { color: '#c8b4ff', fontSize: 13, fontWeight: '800' }, error: { color: C.red, fontSize: 13, lineHeight: 19 }, secondary: { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' }, moreButton: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#4d9df5', backgroundColor: '#17283a' }, morePressed: { opacity: 0.82 }, moreDisabled: { opacity: 0.62 }, moreButtonText: { color: '#9dcbff', fontSize: 15, fontWeight: '800' }, moreEnd: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 10 }, exploration: { gap: 10, paddingTop: 10, paddingBottom: 20 }, sectionTitle: { color: C.txt, fontSize: 18, fontWeight: '800' }, exhausted: { alignItems: 'center', paddingTop: 8 }, empty: { minHeight: 400, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { color: C.txt, fontSize: 25, lineHeight: 34, fontWeight: '800', textAlign: 'center' } });
