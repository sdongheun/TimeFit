import { MapCameraButton } from './MapCameraButton';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Animated, FlatList, Linking, PanResponder, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlacePhoto, PlacePhotoCredit } from './PlacePhoto';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToMain, resetToProfile } from './mainTabNavigation';
import { NearbyBrowseMap } from './NearbyBrowseMap';
import { buildNearbyBrowseDataset, createNearbyLocationGuard, type NearbyBrowsePlace, type NearbyCatalogPlace, type NearbyPoint } from './nearbyBrowseModel';
import { resolveNearbyBrowseSheetLayout, type NearbyBrowseFrame } from './nearbyBrowseSheetLayout';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { PlacePicker } from './PlacePicker';
import { MapPlacePicker } from './MapPlacePicker';
import { createLocationSearchDraft } from './locationSearchDraft';
import { openKakaoPlaceWithAppFallback } from './recommendation/courseV1PlacePreviewModel';
import { openNearbyDirections } from './nearbyDirections';
import { createNearbyLiveSessionController, productionNearbyLivePorts, type NearbyLiveResult } from './nearbyLiveSession';
import { createNearbyGuestAuthGate, productionNearbyGuestAuthPort } from './nearbyGuestAuthGate';
import { CaptchaVerificationSheet } from './CaptchaVerificationSheet';
import { resolveCaptchaChallengeUrl } from './captchaVerificationModel';

const PICKER_FALLBACK = { lat: 35.1796, lon: 129.0756 };
const STATIC_MARKET_NOTE = '전국전통시장표준데이터 저장 정보 · 운영시간 확인 필요';
const STATIC_MARKET_LIST_NOTE = '전통시장 자료 · 운영시간 미확인';
type Props = NativeStackScreenProps<RootStackParamList, 'NearbyBrowse'>;

function compactAddress(address: string) {
  if (!address.trim() || /없음|확인 필요/.test(address)) return address.trim() || '위치 정보 없음';
  const parts = address.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ') || '위치 정보 없음';
}

export function NearbyBrowseScreen({ navigation }: Props) {
  const liveController = useRef<ReturnType<typeof createNearbyLiveSessionController> | null>(null);
  if (!liveController.current) liveController.current = createNearbyLiveSessionController(productionNearbyLivePorts);
  const guestAuthGate = useRef<ReturnType<typeof createNearbyGuestAuthGate> | null>(null);
  if (!guestAuthGate.current) guestAuthGate.current = createNearbyGuestAuthGate(productionNearbyGuestAuthPort);
  const challengeUrl = useMemo(() => resolveCaptchaChallengeUrl(process.env.EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL), []);
  const [liveResult, setLiveResult] = useState<NearbyLiveResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const liveBusy = useRef(false);
  const liveAttempt = useRef(0);
  const providerAttempted = useRef(false);
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const [center, setCenter] = useState<NearbyPoint | null>(null);
  const [centerLabel, setCenterLabel] = useState('기준 장소를 선택하세요');
  const [locationMessage, setLocationMessage] = useState('');
  const [cameraPoint, setCameraPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [clusterIds, setClusterIds] = useState<readonly string[] | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [tabFrame, setTabFrame] = useState<NearbyBrowseFrame | null>(null);
  const [handleHeight, setHandleHeight] = useState(0);
  const [listHeaderHeight, setListHeaderHeight] = useState(0);
  const [firstRowHeight, setFirstRowHeight] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const externalBusy = useRef(false);
  const externalEpoch = useRef(0);
  const [openingExternal, setOpeningExternal] = useState(false);
  const handleMoved = useRef(false);
  const locationLabel = useRef(createKakaoLocationLabelAdapter()).current;
  const locationGuard = useRef(createNearbyLocationGuard()).current;
  const editingSession = useRef(createLocationSearchDraft()).current;
  const rows = useMemo(() => center ? buildNearbyBrowseDataset(center, liveResult?.status === 'ready' || liveResult?.status === 'partial' ? liveResult.catalog : []) : [], [center, liveResult]);
  const byId = useMemo(() => new Map(rows.map(row => [row.id, row])), [rows]);
  const detail = detailId ? byId.get(detailId) ?? null : null;
  const listedRows = clusterIds ? clusterIds.map(id => byId.get(id)).filter((row): row is NearbyBrowsePlace => Boolean(row)) : rows;
  const sheetLayout = useMemo(() => resolveNearbyBrowseSheetLayout({
    screenHeight: height,
    safeTop: insets.top,
    safeBottom: insets.bottom,
    fontScale,
    rowCount: listedRows.length,
    tabFrame,
    measured: { handleHeight, listHeaderHeight, firstRowHeight },
  }), [height, insets.top, insets.bottom, fontScale, listedRows.length, tabFrame, handleHeight, listHeaderHeight, firstRowHeight]);
  const [mapBottomInset, setMapBottomInset] = useState(sheetLayout.collapsedHeight);
  const animatedSheetHeight = useRef(new Animated.Value(sheetLayout.collapsedHeight)).current;
  const sheetAnimationRun = useRef(0);
  const sheetAnimationActive = useRef(false);
  const sheetLayoutRef = useRef(sheetLayout);
  const sheetExpandedRef = useRef(sheetExpanded);
  const currentSheetHeight = useRef(sheetLayout.collapsedHeight);
  const mounted = useRef(true);
  const drag = useRef({ run: 0, active: false, baselineReady: false, baseline: sheetLayout.collapsedHeight, lastDy: 0, pendingSettle: null as null | { kind: 'release' | 'terminate'; dy: number; vy: number } });
  sheetLayoutRef.current = sheetLayout;
  sheetExpandedRef.current = sheetExpanded;

  const writeSheetHeight = useCallback((heightValue: number) => {
    currentSheetHeight.current = heightValue;
    animatedSheetHeight.setValue(heightValue);
  }, [animatedSheetHeight]);

  const settleSheet = useCallback((expanded: boolean) => {
    const run = ++sheetAnimationRun.current;
    drag.current.active = false;
    drag.current.run += 1;
    sheetExpandedRef.current = expanded;
    setSheetExpanded(expanded);
    const layout = sheetLayoutRef.current;
    const target = expanded ? layout.expandedHeight : layout.collapsedHeight;
    sheetAnimationActive.current = true;
    Animated.spring(animatedSheetHeight, { toValue: target, useNativeDriver: false, damping: 24, stiffness: 240, mass: 0.8, isInteraction: false }).start(({ finished }) => {
      if (!mounted.current || sheetAnimationRun.current !== run) return;
      sheetAnimationActive.current = false;
      if (!finished) return;
      const latest = sheetLayoutRef.current;
      const settledHeight = expanded ? latest.expandedHeight : latest.collapsedHeight;
      currentSheetHeight.current = settledHeight;
      setMapBottomInset(settledHeight);
    });
  }, [animatedSheetHeight]);

  useEffect(() => {
    const heightForState = sheetExpanded ? sheetLayout.expandedHeight : sheetLayout.collapsedHeight;
    const state = drag.current;
    if (state.active) {
      if (!state.baselineReady) return;
      const clamped = Math.max(sheetLayout.collapsedHeight, Math.min(sheetLayout.expandedHeight, currentSheetHeight.current));
      if (clamped === currentSheetHeight.current) return;
      writeSheetHeight(clamped);
      state.baseline = clamped + state.lastDy;
      return;
    }
    if (sheetAnimationActive.current) {
      settleSheet(sheetExpandedRef.current);
      return;
    }
    if (currentSheetHeight.current !== heightForState) writeSheetHeight(heightForState);
    setMapBottomInset(heightForState);
  }, [sheetLayout.expandedHeight, sheetLayout.collapsedHeight]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      liveAttempt.current += 1;
      guestAuthGate.current?.close();
      liveController.current?.cancel();
      drag.current.active = false;
      drag.current.run += 1;
      sheetAnimationRun.current += 1;
    };
  }, []);

  const liveFailed = (attempt: number) => {
    if (!mounted.current || attempt !== liveAttempt.current) return;
    liveBusy.current = false;
    setLiveLoading(false);
    setCaptchaVisible(false);
    setLiveResult({ status: 'failed', catalog: [] });
  };
  const loadLiveAfterAuth = async (attempt: number) => {
    if (!mounted.current || attempt !== liveAttempt.current || !liveController.current) return;
    const repeat = providerAttempted.current;
    providerAttempted.current = true;
    try {
      const result = await (repeat ? liveController.current.retry() : liveController.current.load());
      if (!mounted.current || attempt !== liveAttempt.current) return;
      liveBusy.current = false;
      setLiveLoading(false);
      setLiveResult(result);
    } catch { liveFailed(attempt); }
  };
  const prepareLive = async () => {
    if (!guestAuthGate.current || !liveController.current || liveBusy.current || captchaVisible) return;
    const attempt = ++liveAttempt.current;
    liveBusy.current = true;
    setLiveResult(null);
    setLiveLoading(true);
    try {
      const status = await guestAuthGate.current.prepare();
      if (!mounted.current || attempt !== liveAttempt.current) return;
      if (status === 'ready') { await loadLiveAfterAuth(attempt); return; }
      if (status === 'captcha_required' && challengeUrl) {
        liveBusy.current = false;
        setLiveLoading(false);
        setCaptchaVisible(true);
        return;
      }
      liveFailed(attempt);
    } catch { liveFailed(attempt); }
  };
  useEffect(() => {
    if (!center) return;
    void prepareLive();
  }, [Boolean(center)]);

  const verifyNearbyCaptcha = async (token: string) => {
    if (!captchaVisible || liveBusy.current || !guestAuthGate.current) return;
    const attempt = ++liveAttempt.current;
    liveBusy.current = true;
    setCaptchaVisible(false);
    setLiveLoading(true);
    try {
      const status = await guestAuthGate.current.verify(token);
      if (!mounted.current || attempt !== liveAttempt.current) return;
      if (status === 'ready') { await loadLiveAfterAuth(attempt); return; }
      liveFailed(attempt);
    } catch { liveFailed(attempt); }
  };
  const cancelNearbyCaptcha = () => {
    const attempt = ++liveAttempt.current;
    guestAuthGate.current?.cancel();
    liveFailed(attempt);
  };
  const retryLive = () => { if (!liveBusy.current) void prepareLive(); };

  const clampToLatestSheet = useCallback((heightValue: number) => {
    const layout = sheetLayoutRef.current;
    return Math.max(layout.collapsedHeight, Math.min(layout.expandedHeight, heightValue));
  }, []);

  const applyDragMove = useCallback(() => {
    const state = drag.current;
    if (!state.active || !state.baselineReady) return;
    writeSheetHeight(clampToLatestSheet(state.baseline - state.lastDy));
  }, [clampToLatestSheet, writeSheetHeight]);

  const finishDrag = useCallback((kind: 'release' | 'terminate', dy: number, vy: number) => {
    const state = drag.current;
    if (!state.active) return;
    state.lastDy = dy;
    if (!state.baselineReady) {
      state.pendingSettle = { kind, dy, vy };
      return;
    }
    applyDragMove();
    const layout = sheetLayoutRef.current;
    const midpoint = (layout.collapsedHeight + layout.expandedHeight) / 2;
    const current = currentSheetHeight.current;
    const expanded = kind === 'release' && !handleMoved.current && Math.abs(dy) <= 7
      ? !sheetExpandedRef.current
      : kind === 'terminate'
      ? current >= midpoint
      : vy < -0.35 || dy < -55
        ? true
        : vy > 0.35 || dy > 55
          ? false
          : current >= midpoint;
    settleSheet(expanded);
  }, [applyDragMove, settleSheet]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 7,
    onPanResponderGrant: () => {
      handleMoved.current = false;
      const state = drag.current;
      const run = ++state.run;
      state.active = true;
      state.baselineReady = false;
      state.lastDy = 0;
      state.pendingSettle = null;
      sheetAnimationRun.current += 1;
      sheetAnimationActive.current = false;
      animatedSheetHeight.stopAnimation((value) => {
        if (!mounted.current || !state.active || state.run !== run) return;
        state.baseline = clampToLatestSheet(value);
        currentSheetHeight.current = state.baseline;
        state.baselineReady = true;
        applyDragMove();
        const pending = state.pendingSettle;
        state.pendingSettle = null;
        if (pending) finishDrag(pending.kind, pending.dy, pending.vy);
      });
    },
    onPanResponderMove: (_, gesture) => {
      if (!drag.current.active) return;
      if (Math.abs(gesture.dy) > 7 || Math.abs(gesture.dx ?? 0) > 7) handleMoved.current = true;
      drag.current.lastDy = gesture.dy;
      applyDragMove();
    },
    onPanResponderRelease: (_, gesture) => finishDrag('release', gesture.dy, gesture.vy),
    onPanResponderTerminate: (_, gesture) => finishDrag('terminate', gesture.dy, gesture.vy),
  }), [animatedSheetHeight, applyDragMove, clampToLatestSheet, finishDrag]);

  const acceptCenter = (point: NearbyPoint, label: string) => {
    externalEpoch.current++;
    locationGuard.invalidate();
    setCameraPoint(null); setCenter(point); setCenterLabel(label); setSelectedId(null); setDetailId(null); setClusterIds(null); setLocationMessage(''); setMapFailed(false);
  };
  const openDetail = (id: string) => {
    if (!byId.has(id)) return;
    externalEpoch.current++; setLocationMessage('');
    setSelectedId(id); setDetailId(id); setClusterIds(null); settleSheet(true);
  };
  const showCluster = (ids: readonly string[]) => {
    externalEpoch.current++;
    const valid = ids.filter(id => byId.has(id));
    if (valid.length < 2) return;
    setClusterIds(valid); setDetailId(null); setSelectedId(valid[0]); settleSheet(true);
  };
  const openKakao = async (place: NearbyBrowsePlace) => {
    if (externalBusy.current) return;
    externalBusy.current = true; setOpeningExternal(true);
    const epoch = externalEpoch.current;
    try {
    const result = await openKakaoPlaceWithAppFallback(place.source, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openExternal: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
    if (mounted.current && epoch === externalEpoch.current && (result === 'failed' || result === 'unavailable')) setLocationMessage('카카오맵을 열지 못했어요. 상세 정보는 그대로 유지됩니다.');
    } finally { externalBusy.current = false; setOpeningExternal(false); }
  };
  const openDirections = async (place: NearbyBrowsePlace) => {
    if (externalBusy.current) return;
    externalBusy.current = true; setOpeningExternal(true); setLocationMessage('');
    const epoch = externalEpoch.current;
    try {
      const result = await openNearbyDirections(place.source, { openExternal: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
      if (mounted.current && epoch === externalEpoch.current && result === 'failed') setLocationMessage('길찾기를 열지 못했어요. 다시 시도해 주세요.');
    } finally { externalBusy.current = false; setOpeningExternal(false); }
  };

  const openLocationSearch = () => { locationGuard.invalidate(); editingSession.start('기준 장소 선택'); setSearchVisible(true); };
  const pickerCenter = center ?? PICKER_FALLBACK;
  return <View style={s.root}>
    {center ? <NearbyBrowseMap cameraPoint={cameraPoint} key={mapRetryKey} center={center} places={rows} selectedId={selectedId} bottomInset={mapBottomInset} retryKey={mapRetryKey} onSelect={openDetail} onCluster={showCluster} onReady={() => setMapFailed(false)} onError={() => setMapFailed(true)} style={s.mapFill} /> : <View style={[s.mapFill, s.noCenter]}><Feather name="map-pin" size={34} color={C.accent} /><Text style={s.noCenterTitle}>부산 어디에서 둘러볼까요?</Text></View>}
    <View testID="nearby-map-header" style={[s.header, { top: insets.top + 10 }]}>
      <View style={s.heading}><Text style={s.title} numberOfLines={1}>주변 둘러보기</Text><Text style={s.location} numberOfLines={1}>{center ? `${centerLabel} 기준` : centerLabel}</Text></View>
      {center ? <MapCameraButton point={center} testID="nearby-selected" style={s.cameraButton} onCamera={setCameraPoint} /> : null}
      <Pressable testID="nearby-change-location" accessibilityLabel={center ? '기준 장소 변경' : '기준 장소 선택'} style={s.searchButton} onPress={openLocationSearch}><Feather name="search" size={15} color={C.txt} /><Text style={s.headerButtonText}>검색</Text></Pressable>
    </View>
    {locationMessage && !detail ? <View style={[s.notice, { top: insets.top + 84 }]}><Text style={s.noticeText}>{locationMessage}</Text></View> : null}
    {mapFailed ? <View style={[s.mapError, { top: insets.top + 118 }]}><Text style={s.mapErrorText}>지도를 불러오지 못했어요. 목록은 계속 볼 수 있어요.</Text><Pressable testID="nearby-map-retry" onPress={() => { setMapFailed(false); setMapRetryKey(value => value + 1); }}><Text style={s.retry}>지도 다시 시도</Text></Pressable></View> : null}

    <Animated.View testID="nearby-sheet" style={[s.sheet, { height: animatedSheetHeight, bottom: 0, left: 0, right: 0 }]}>
      <View testID="nearby-sheet-handle" accessible accessibilityRole="button" accessibilityLabel="주변 장소 시트" accessibilityHint="두 번 탭하거나 위아래로 밀어 크기를 바꿀 수 있어요" accessibilityState={{ expanded: sheetExpanded }} accessibilityActions={[{ name: 'expand', label: '펼치기' }, { name: 'collapse', label: '접기' }]} onAccessibilityTap={() => settleSheet(!sheetExpandedRef.current)} onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'expand') settleSheet(true); else if (nativeEvent.actionName === 'collapse') settleSheet(false); }} onLayout={({ nativeEvent }) => setHandleHeight(nativeEvent.layout.height)} {...pan.panHandlers} style={s.handleArea}><View style={s.handle} /></View>
      {detail ? <ScrollView style={s.scroller} contentContainerStyle={[s.detail, { paddingBottom: sheetLayout.contentBottomPadding }]}>
        <View style={s.detailHead}><View style={{ flex: 1 }}><Text style={s.detailCategory}>{detail.categoryLabel} · 직선 {detail.displayDistance}</Text><Text style={s.detailTitle}>{detail.title}</Text></View><Pressable testID="nearby-detail-close" variant="icon" accessibilityLabel="장소 상세 닫기" style={s.close} onPress={() => { externalEpoch.current++; setDetailId(null); setLocationMessage(''); }}><Text style={s.closeText}>✕</Text></Pressable></View>
        <PlacePhoto testID="nearby-detail-image" place={detail.source} style={{ flex:0, width:'100%', height:168, marginTop:12 }} fallback={<View testID="nearby-detail-image-fallback" style={s.detailImageFallback}><Feather name="image" size={24} color={C.muted} /><Text style={s.fallbackText}>{detail.categoryLabel}</Text></View>} />
        <PlacePhotoCredit place={detail.source} links linkTextColor={C.txt} />
        <View testID="nearby-detail-meta" style={s.detailMeta}><View style={s.metaRow}><Feather name="clock" size={16} color={C.txt2} /><View style={s.metaCopy}><Text style={s.metaLabel}>운영시간</Text><Text style={s.metaValue}>{detail.hoursLabel}</Text></View></View><View style={s.metaRow}><Feather name="map-pin" size={16} color={C.txt2} /><View style={s.metaCopy}><Text style={s.metaLabel}>주소</Text><Text style={s.metaValue}>{detail.addressLabel}</Text></View></View></View>
        {detail.source.sourceKind === 'traditional_market_standard_static' ? <View testID="nearby-static-market-detail" style={s.staticMarketDetail}><Text style={s.staticMarketTitle}>{STATIC_MARKET_NOTE}</Text><Text style={s.staticMarketCopy}>저장된 정보예요. 길찾기 전에 영업·출입을 확인해 주세요.</Text></View> : null}
        <Text style={s.description}>{detail.description}</Text>
        <Pressable testID="nearby-directions" disabled={openingExternal} accessibilityState={{ busy: openingExternal, disabled: openingExternal }} style={[s.kakao, openingExternal && { opacity: 0.6 }]} onPress={() => void openDirections(detail)}><Text style={s.kakaoText}>카카오맵 길찾기</Text></Pressable>
        <Pressable testID="nearby-open-kakao" disabled={openingExternal} style={s.placeLink} onPress={() => void openKakao(detail)}><Text style={s.placeLinkText}>카카오맵에서 장소 정보 보기</Text></Pressable>
        {locationMessage ? <Text accessibilityRole="alert" style={s.detailError}>{locationMessage}</Text> : null}
      </ScrollView> : <>
        <View testID="nearby-list-summary" onLayout={({ nativeEvent }) => setListHeaderHeight(nativeEvent.layout.height)}>
          <View style={s.listHead}><View style={s.listHeading}><View style={s.listTitleRow}><Text testID="nearby-list-title" style={s.listTitle}>{clusterIds ? '이 위치의 장소' : '가까운 장소'}</Text><Text testID="nearby-list-count" style={s.listCount}>{center ? `${listedRows.length}곳` : ''}</Text></View><Text testID="nearby-list-copy" accessibilityLabel="기준 장소에서 가까운 순, 직선거리" numberOfLines={1} style={s.listCopy}>{center ? `${centerLabel} 기준 · 직선거리 순` : '기준 장소를 선택해 주세요'}</Text></View></View>
          {liveResult?.status === 'partial' ? <Text testID="nearby-live-partial" style={s.liveNotice}>{liveResult.staticMarketOnly ? '실시간 장소는 확인하지 못했어요. 저장된 전통시장 정보만 보여드려요.' : '일부 장소만 확인했어요. 확인된 장소만 보여드려요.'}</Text> : null}
          {clusterIds ? <Pressable testID="nearby-show-all" style={s.allButton} onPress={() => setClusterIds(null)}><Text style={s.allButtonText}>3km 전체 목록 보기</Text></Pressable> : null}
        </View>
        {!center ? <Empty title="기준 장소를 선택하면 3km 안의 장소를 가까운 순으로 보여드려요" actionLabel="장소 선택" action={openLocationSearch} /> : liveLoading ? <View testID="nearby-live-loading" style={s.empty}><ActivityIndicator color={C.accent} /><Text style={s.emptyCopy}>장소 정보를 확인하고 있어요</Text></View> : liveResult?.status === 'failed' ? <Empty title="장소 정보를 확인하지 못했어요" copy="잠시 후 다시 시도해 주세요." actionLabel="다시 시도" action={retryLive} /> : rows.length === 0 ? <Empty title="3km 안에서 확인된 장소가 없어요" copy="다른 장소를 기준으로 다시 둘러볼 수 있어요." actionLabel="장소 변경" action={openLocationSearch} /> : <FlatList testID="nearby-list" style={s.scroller} data={listedRows} keyExtractor={row => row.id} contentContainerStyle={[s.list, { paddingBottom: sheetLayout.contentBottomPadding }]} initialNumToRender={8} windowSize={5} removeClippedSubviews renderItem={({ item: row, index }) => <Pressable testID={`nearby-row-${row.id}`} onLayout={index === 0 ? ({ nativeEvent }) => setFirstRowHeight(nativeEvent.layout.height) : undefined} accessibilityLabel={`${row.title}, 직선 ${row.displayDistance}`} style={[s.row, selectedId === row.id && s.rowSelected]} onPress={() => openDetail(row.id)}>
          <PlacePhoto place={row.source} style={{ flex: 0, width: 56, height: 56, backgroundColor: C.panel2 }} fallback={<View style={s.thumbFallback}><Feather name="map-pin" size={18} color={C.accent} /></View>} />
          <View style={s.rowCopy}><Text style={s.rowTitle} numberOfLines={1}>{row.title}</Text><Text style={s.rowMeta} numberOfLines={1}>{row.categoryLabel} · {compactAddress(row.addressLabel)}</Text>{row.source.sourceKind === 'traditional_market_standard_static' ? <Text testID={`nearby-static-market-${row.id}`} style={s.rowProvenance} numberOfLines={1}>{STATIC_MARKET_LIST_NOTE}</Text> : null}</View><Text style={s.distance}>{row.displayDistance}</Text>
        </Pressable>} />}
      </>}
    </Animated.View>
    <FloatingTabBar active="course" onFrame={(frame) => setTabFrame(current => current?.x === frame.x && current.y === frame.y && current.width === frame.width && current.height === frame.height ? current : frame)} onMain={() => resetToMain(navigation)} onCourse={() => undefined} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => resetToProfile(navigation)} />
    <PlacePicker visible={searchVisible} title="기준 장소 선택" center={pickerCenter} editingSession={editingSession} labelAdapter={locationLabel} onOpenMap={() => { setSearchVisible(false); setMapPickerVisible(true); }} onClose={() => setSearchVisible(false)} onConfirm={(place) => { if (place.source !== 'device') acceptCenter({ lat: place.lat, lon: place.lon }, place.label); }} />
    <MapPlacePicker visible={mapPickerVisible} title="기준 장소 선택" center={pickerCenter} labelAdapter={locationLabel} onClose={() => { setMapPickerVisible(false); setSearchVisible(true); editingSession.resume(); }} onConfirm={(selection) => { setMapPickerVisible(false); setSearchVisible(false); editingSession.end(); acceptCenter(selection.point, selection.label); }} />
    <CaptchaVerificationSheet visible={captchaVisible} challengeUrl={challengeUrl} purpose="nearby" onVerified={(token) => void verifyNearbyCaptcha(token)} onClose={cancelNearbyCaptcha} />
  </View>;
}

function Empty({ title, copy, actionLabel, action }: { title: string; copy?: string; actionLabel: string; action(): void }) {
  return <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text>{copy ? <Text style={s.emptyCopy}>{copy}</Text> : null}<Pressable testID="nearby-empty-location" accessibilityLabel={actionLabel} style={s.emptyButton} onPress={action}><Text style={s.emptyButtonText}>{actionLabel}</Text></Pressable></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, mapFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, noCenter: { alignItems: 'center', justifyContent: 'center', paddingBottom: 150, backgroundColor: C.panel2 }, noCenterTitle: { color: C.txt, fontSize: 18, fontWeight: '900', marginTop: 12 },
  header: { position: 'absolute', left: 14, right: 14, minHeight: 64, paddingLeft: 14, paddingRight: 6, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.10)', backgroundColor: 'rgba(23,23,25,.94)', flexDirection: 'row', alignItems: 'center', gap: 4 }, heading: { flex: 1, minWidth: 0, paddingVertical: 9 }, title: { color: C.txt, fontSize: 18, fontWeight: '900' }, location: { color: C.txt2, fontSize: 11.5, marginTop: 3 }, cameraButton: { flexShrink: 0, width: 44, minWidth: 44, minHeight: 44, borderWidth: 0, backgroundColor: 'transparent' }, searchButton: { flexShrink: 0, minWidth: 68, minHeight: 44, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.panel2, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, headerButtonText: { color: C.txt, fontSize: 13, fontWeight: '800' },
  notice: { position: 'absolute', left: 18, right: 18, backgroundColor: C.panel, padding: 9, borderRadius: 10 }, noticeText: { color: C.red, fontSize: 12, textAlign: 'center' }, mapError: { position: 'absolute', left: 18, right: 18, padding: 10, backgroundColor: C.panel, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, mapErrorText: { flex: 1, color: C.txt2, fontSize: 12 }, retry: { color: C.txt, fontSize: 12, fontWeight: '800' },
  liveNotice: { color: C.txt2, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 8 },
  rowProvenance: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  staticMarketDetail: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: C.panel2 }, staticMarketTitle: { color: C.txt2, fontSize: 12, lineHeight: 18, fontWeight: '800' }, staticMarketCopy: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sheet: { position: 'absolute', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 18, shadowOffset: { width: 0, height: -5 }, elevation: 6 }, handleArea: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: C.placeholder }, scroller: { flex: 1 }, listHead: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, listHeading: { flex: 1, minWidth: 0 }, listTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, listTitle: { color: C.txt, fontSize: 19, fontWeight: '900' }, listCount: { color: C.txt2, fontSize: 13, fontWeight: '800' }, listCopy: { color: C.muted, fontSize: 11.5, marginTop: 4 }, list: { paddingHorizontal: 12 }, row: { minHeight: 80, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: C.panel2, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: 'transparent' }, rowSelected: { borderColor: C.accent }, thumbFallback: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { color: C.txt, fontSize: 16, lineHeight: 21, fontWeight: '800' }, rowMeta: { color: C.muted, fontSize: 12.5, lineHeight: 17, marginTop: 4 }, distance: { alignSelf: 'flex-start', minWidth: 44, color: C.txt, fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'right', paddingTop: 2 }, allButton: { alignSelf: 'flex-start', minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', marginLeft: 16, marginBottom: 10 }, allButtonText: { color: C.txt, fontSize: 12.5, fontWeight: '800' }, empty: { alignItems: 'center', paddingHorizontal: 26, paddingTop: 12, paddingBottom: 20 }, emptyTitle: { color: C.txt2, fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center' }, emptyCopy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 }, emptyButton: { minHeight: 44, borderRadius: 12, backgroundColor: C.accent, paddingHorizontal: 22, justifyContent: 'center', marginTop: 14 }, emptyButtonText: { color: C.txt, fontSize: 13, fontWeight: '900' },
  detail: { paddingHorizontal: 16 }, detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, detailCategory: { color: C.txt2, fontSize: 12, fontWeight: '800' }, detailTitle: { color: C.txt, fontSize: 22, lineHeight: 29, fontWeight: '900', marginTop: 4 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: C.txt2, fontSize: 17 }, detailImageFallback: { height: 168, borderRadius: 14, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2 }, fallbackText: { color: C.muted, fontSize: 12, marginTop: 7 }, detailMeta: { marginTop: 14, gap: 12 }, metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, metaCopy: { flex: 1, minWidth: 0 }, metaLabel: { color: C.muted, fontSize: 11, fontWeight: '700' }, metaValue: { color: C.txt2, fontSize: 13, lineHeight: 19, marginTop: 2 }, description: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 14 }, placeLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }, placeLinkText: { color: C.txt, fontSize: 13, fontWeight: '800' }, kakao: { backgroundColor: C.accent, minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, kakaoText: { color: C.txt, fontSize: 16, fontWeight: '900' }, detailError: { color: C.red, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
