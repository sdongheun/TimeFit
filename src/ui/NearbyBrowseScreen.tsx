import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Animated, FlatList, Image, Linking, PanResponder, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToMain, resetToProfile } from './mainTabNavigation';
import { NearbyBrowseMap } from './NearbyBrowseMap';
import { buildNearbyBrowseDataset, createNearbyLocationGuard, type NearbyBrowsePlace, type NearbyCatalogPlace, type NearbyPoint } from './nearbyBrowseModel';
import { resolveNearbyBrowseSheetLayout, type NearbyBrowseFrame } from './nearbyBrowseSheetLayout';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { displayLocationLabel } from './locationLabelDisplayModel';
import { PlacePicker } from './PlacePicker';
import { MapPlacePicker } from './MapPlacePicker';
import { createLocationSearchDraft } from './locationSearchDraft';
import { openKakaoPlaceWithAppFallback } from './recommendation/courseV1PlacePreviewModel';

const PICKER_FALLBACK = { lat: 35.1796, lon: 129.0756 };
const catalog = [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data] as readonly NearbyCatalogPlace[];
type Props = NativeStackScreenProps<RootStackParamList, 'NearbyBrowse'>;

export function NearbyBrowseScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const [center, setCenter] = useState<NearbyPoint | null>(null);
  const [centerLabel, setCenterLabel] = useState('기준 위치를 선택하세요');
  const [centerKind, setCenterKind] = useState<'device' | 'manual' | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
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
  const [imageFailures, setImageFailures] = useState<ReadonlySet<string>>(new Set());
  const locationLabel = useRef(createKakaoLocationLabelAdapter()).current;
  const locationGuard = useRef(createNearbyLocationGuard()).current;
  const editingSession = useRef(createLocationSearchDraft()).current;
  const rows = useMemo(() => center ? buildNearbyBrowseDataset(center, catalog) : [], [center]);
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
      drag.current.active = false;
      drag.current.run += 1;
      sheetAnimationRun.current += 1;
    };
  }, []);

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
    const expanded = kind === 'terminate'
      ? current >= midpoint
      : vy < -0.35 || dy < -55
        ? true
        : vy > 0.35 || dy > 55
          ? false
          : current >= midpoint;
    settleSheet(expanded);
  }, [applyDragMove, settleSheet]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 7,
    onPanResponderGrant: () => {
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
      drag.current.lastDy = gesture.dy;
      applyDragMove();
    },
    onPanResponderRelease: (_, gesture) => finishDrag('release', gesture.dy, gesture.vy),
    onPanResponderTerminate: (_, gesture) => finishDrag('terminate', gesture.dy, gesture.vy),
  }), [animatedSheetHeight, applyDragMove, clampToLatestSheet, finishDrag]);

  const acceptCenter = (point: NearbyPoint, label: string, kind: 'device' | 'manual') => {
    locationGuard.invalidate();
    setLocating(false);
    setCenter(point); setCenterLabel(label); setCenterKind(kind); setSelectedId(null); setDetailId(null); setClusterIds(null); setLocationMessage(''); setMapFailed(false);
  };
  const locate = async (explicit: boolean) => {
    const token = locationGuard.begin();
    setLocating(true); setLocationMessage('');
    try {
      const permission = explicit ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        if (locationGuard.accept(token) && explicit) setLocationMessage('위치 권한이 없어 검색이나 지도로 기준 위치를 선택해 주세요.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { lat: result.coords.latitude, lon: result.coords.longitude };
      let label = '현위치';
      try { label = displayLocationLabel(await locationLabel.resolve(point, 'gps_auto'), '현위치'); } catch { /* 좌표는 유효하며 주소만 정직하게 fallback한다. */ }
      if (!locationGuard.accept(token)) return;
      setCenter(point); setCenterLabel(label); setCenterKind('device'); setSelectedId(null); setDetailId(null); setClusterIds(null);
    } catch {
      if (locationGuard.accept(token)) setLocationMessage('현위치를 가져오지 못했어요. 검색이나 지도로 선택해 주세요.');
    } finally { if (locationGuard.current(token)) setLocating(false); }
  };
  useEffect(() => { void locate(false); return () => locationGuard.invalidate(); }, []);
  useEffect(() => navigation.addListener('blur', () => locationGuard.invalidate()), [navigation]);

  const openDetail = (id: string) => {
    if (!byId.has(id)) return;
    setSelectedId(id); setDetailId(id); setClusterIds(null); settleSheet(true);
  };
  const showCluster = (ids: readonly string[]) => {
    const valid = ids.filter(id => byId.has(id));
    if (valid.length < 2) return;
    setClusterIds(valid); setDetailId(null); setSelectedId(valid[0]); settleSheet(true);
  };
  const openKakao = async (place: NearbyBrowsePlace) => {
    const result = await openKakaoPlaceWithAppFallback(place.source, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openExternal: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync });
    if (result === 'failed' || result === 'unavailable') setLocationMessage('카카오맵을 열지 못했어요. 상세 정보는 그대로 유지됩니다.');
  };

  const pickerCenter = center ?? PICKER_FALLBACK;
  return <View style={s.root}>
    {center ? <NearbyBrowseMap key={mapRetryKey} center={center} places={rows} selectedId={selectedId} bottomInset={mapBottomInset} retryKey={mapRetryKey} onSelect={openDetail} onCluster={showCluster} onReady={() => setMapFailed(false)} onError={() => setMapFailed(true)} style={s.mapFill} /> : <View style={[s.mapFill, s.noCenter]}><Feather name="map-pin" size={34} color={C.accent} /><Text style={s.noCenterTitle}>주변을 볼 기준 위치가 필요해요</Text><Text style={s.noCenterCopy}>현위치를 허용하거나 검색·지도에서 위치를 선택하세요.</Text></View>}
    <View style={[s.header, { top: insets.top + 10 }]}>
      <View style={s.heading}><Text style={s.title}>주변 둘러보기</Text><Text style={s.location} numberOfLines={1}>{centerKind === 'manual' ? '선택 위치 기준 · ' : centerKind === 'device' ? '현위치 기준 · ' : ''}{centerLabel}</Text></View>
      <Pressable testID="nearby-current" style={s.headerButton} onPress={() => void locate(true)} disabled={locating}>{locating ? <ActivityIndicator color={C.accent} /> : <Text style={s.headerButtonText}>현위치</Text>}</Pressable>
      <Pressable testID="nearby-change-location" variant="icon" accessibilityLabel="기준 위치 변경" style={s.iconButton} onPress={() => { locationGuard.invalidate(); editingSession.start('기준 위치 선택'); setSearchVisible(true); }}><Feather name="edit-2" size={17} color={C.accent} /></Pressable>
    </View>
    {locationMessage ? <View style={[s.notice, { top: insets.top + 76 }]}><Text style={s.noticeText}>{locationMessage}</Text></View> : null}
    {mapFailed ? <View style={[s.mapError, { top: insets.top + 118 }]}><Text style={s.mapErrorText}>지도를 불러오지 못했어요. 목록은 계속 볼 수 있어요.</Text><Pressable testID="nearby-map-retry" onPress={() => { setMapFailed(false); setMapRetryKey(value => value + 1); }}><Text style={s.retry}>지도 다시 시도</Text></Pressable></View> : null}

    <Animated.View testID="nearby-sheet" style={[s.sheet, { height: animatedSheetHeight, bottom: 0, left: 0, right: 0 }]}>
      <View testID="nearby-sheet-handle" onLayout={({ nativeEvent }) => setHandleHeight(nativeEvent.layout.height)} {...pan.panHandlers} style={s.handleArea}><View style={s.handle} /></View>
      {detail ? <ScrollView style={s.scroller} contentContainerStyle={[s.detail, { paddingBottom: sheetLayout.contentBottomPadding }]}>
        <View style={s.detailHead}><View style={{ flex: 1 }}><Text style={s.detailCategory}>{detail.categoryLabel} · 직선 {detail.displayDistance}</Text><Text style={s.detailTitle}>{detail.title}</Text></View><Pressable testID="nearby-detail-close" variant="icon" accessibilityLabel="장소 상세 닫기" style={s.close} onPress={() => setDetailId(null)}><Text style={s.closeText}>✕</Text></Pressable></View>
        {detail.imageUrl && !imageFailures.has(detail.id) ? <Image testID="nearby-detail-image" source={{ uri: detail.imageUrl }} style={{ width: '100%', height: 168, borderRadius: 14, marginTop: 12, backgroundColor: C.bg }} onError={() => setImageFailures(current => new Set(current).add(detail.id))} /> : <View testID="nearby-detail-image-fallback" style={s.detailImageFallback}><Feather name="image" size={24} color={C.muted} /><Text style={s.fallbackText}>{detail.categoryLabel}</Text></View>}
        {detail.informationKind === 'conditional' ? <Text style={s.conditional}>정보 탐색 장소 · 방문 전 운영시간을 확인해 주세요.</Text> : null}
        <Text style={s.meta}>{detail.addressLabel}</Text><Text style={s.meta}>{detail.hoursLabel}</Text><Text style={s.description}>{detail.description}</Text>
        <Pressable testID="nearby-open-kakao" style={s.kakao} onPress={() => void openKakao(detail)}><Text style={s.kakaoText}>카카오맵에서 장소 확인</Text></Pressable>
      </ScrollView> : <>
        <View testID="nearby-list-summary" onLayout={({ nativeEvent }) => setListHeaderHeight(nativeEvent.layout.height)}>
          <View style={s.listHead}><View><Text style={s.listTitle}>{clusterIds ? `겹친 장소 ${listedRows.length}곳` : center ? `3km 안 장소 ${rows.length}곳` : '주변 장소'}</Text><Text style={s.listCopy}>기준 위치에서 가까운 순 · 직선거리</Text></View><Pressable testID="nearby-sheet-toggle" onPress={() => settleSheet(!sheetExpanded)}><Text style={s.expand}>{sheetExpanded ? '접기' : '펼치기'}</Text></Pressable></View>
          {clusterIds ? <Pressable testID="nearby-show-all" style={s.allButton} onPress={() => setClusterIds(null)}><Text style={s.allButtonText}>3km 전체 목록 보기</Text></Pressable> : null}
        </View>
        {!center ? <Empty title="기준 위치를 선택해 주세요" action={() => setSearchVisible(true)} /> : rows.length === 0 ? <Empty title="3km 안에 등록된 장소가 없어요" action={() => setSearchVisible(true)} /> : <FlatList testID="nearby-list" style={s.scroller} data={listedRows} keyExtractor={row => row.id} contentContainerStyle={[s.list, { paddingBottom: sheetLayout.contentBottomPadding }]} initialNumToRender={8} windowSize={5} removeClippedSubviews renderItem={({ item: row, index }) => <Pressable testID={`nearby-row-${row.id}`} onLayout={index === 0 ? ({ nativeEvent }) => setFirstRowHeight(nativeEvent.layout.height) : undefined} accessibilityLabel={`${row.title}, 직선 ${row.displayDistance}`} style={[s.row, selectedId === row.id && s.rowSelected]} onPress={() => openDetail(row.id)}>
          {row.imageUrl && !imageFailures.has(row.id) ? <Image source={{ uri: row.imageUrl }} style={{ width: 50, height: 50, borderRadius: 11, backgroundColor: C.bg }} onError={() => setImageFailures(current => new Set(current).add(row.id))} /> : <View style={s.thumbFallback}><Feather name="map-pin" size={18} color={C.accent} /></View>}
          <View style={{ flex: 1 }}><Text style={s.rowTitle} numberOfLines={1}>{row.title}</Text><Text style={s.rowMeta} numberOfLines={1}>{row.categoryLabel} · {row.addressLabel}</Text></View><Text style={s.distance}>{row.displayDistance}</Text>
        </Pressable>} />}
      </>}
    </Animated.View>
    <FloatingTabBar active="course" onFrame={(frame) => setTabFrame(current => current?.x === frame.x && current.y === frame.y && current.width === frame.width && current.height === frame.height ? current : frame)} onMain={() => resetToMain(navigation)} onCourse={() => undefined} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => resetToProfile(navigation)} />
    <PlacePicker visible={searchVisible} title="기준 위치 선택" center={pickerCenter} showGps editingSession={editingSession} labelAdapter={locationLabel} onOpenMap={() => { setSearchVisible(false); setMapPickerVisible(true); }} onClose={() => setSearchVisible(false)} onConfirm={(place) => acceptCenter({ lat: place.lat, lon: place.lon }, place.label, place.source === 'device' ? 'device' : 'manual')} />
    <MapPlacePicker visible={mapPickerVisible} title="기준 위치 선택" center={pickerCenter} labelAdapter={locationLabel} onClose={() => { setMapPickerVisible(false); setSearchVisible(true); editingSession.resume(); }} onConfirm={(selection) => { setMapPickerVisible(false); setSearchVisible(false); editingSession.end(); acceptCenter(selection.point, selection.label, 'manual'); }} />
  </View>;
}

function Empty({ title, action }: { title: string; action(): void }) {
  return <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text><Pressable testID="nearby-empty-location" style={s.allButton} onPress={action}><Text style={s.allButtonText}>위치 변경</Text></Pressable></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, mapFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, noCenter: { alignItems: 'center', justifyContent: 'center', paddingBottom: 150, backgroundColor: C.panel2 }, noCenterTitle: { color: C.txt, fontSize: 18, fontWeight: '900', marginTop: 12 }, noCenterCopy: { color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  header: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }, heading: { flex: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: 'rgba(23,23,25,.94)' }, title: { color: C.txt, fontSize: 18, fontWeight: '900' }, location: { color: C.txt2, fontSize: 11.5, marginTop: 2 }, headerButton: { minWidth: 62, minHeight: 48, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(23,23,25,.94)', alignItems: 'center', justifyContent: 'center' }, headerButtonText: { color: C.accent, fontSize: 13, fontWeight: '800' }, iconButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(23,23,25,.94)', alignItems: 'center', justifyContent: 'center' },
  notice: { position: 'absolute', left: 18, right: 18, backgroundColor: C.panel, padding: 9, borderRadius: 10 }, noticeText: { color: '#ffb4ab', fontSize: 12, textAlign: 'center' }, mapError: { position: 'absolute', left: 18, right: 18, padding: 10, backgroundColor: C.panel, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, mapErrorText: { flex: 1, color: C.txt2, fontSize: 12 }, retry: { color: C.accent, fontSize: 12, fontWeight: '800' },
  sheet: { position: 'absolute', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: .35, shadowRadius: 18, shadowOffset: { width: 0, height: -5 }, elevation: 6 }, handleArea: { minHeight: 32, alignItems: 'center', justifyContent: 'center' }, handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: C.placeholder }, scroller: { flex: 1 }, listHead: { paddingHorizontal: 16, paddingBottom: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, listTitle: { color: C.txt, fontSize: 17, fontWeight: '900' }, listCopy: { color: C.muted, fontSize: 11.5, marginTop: 3 }, expand: { color: C.accent, fontSize: 13, fontWeight: '800', padding: 8 }, list: { paddingHorizontal: 10 }, row: { minHeight: 68, borderRadius: 13, padding: 9, marginBottom: 7, backgroundColor: C.panel2, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'transparent' }, rowSelected: { borderColor: C.accent }, thumbFallback: { width: 50, height: 50, borderRadius: 11, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: C.txt, fontSize: 15, fontWeight: '800' }, rowMeta: { color: C.muted, fontSize: 11.5, marginTop: 4 }, distance: { color: C.accent, fontSize: 12, fontWeight: '800' }, allButton: { alignSelf: 'center', minHeight: 38, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', marginBottom: 8 }, allButtonText: { color: C.accent, fontSize: 12.5, fontWeight: '800' }, empty: { alignItems: 'center', padding: 20 }, emptyTitle: { color: C.txt2, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  detail: { paddingHorizontal: 16 }, detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, detailCategory: { color: C.accent, fontSize: 12, fontWeight: '800' }, detailTitle: { color: C.txt, fontSize: 22, fontWeight: '900', marginTop: 3 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: C.txt2, fontSize: 17 }, detailImageFallback: { height: 130, borderRadius: 14, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2 }, fallbackText: { color: C.muted, fontSize: 12, marginTop: 7 }, conditional: { color: C.amber, fontSize: 12, lineHeight: 18, marginTop: 12 }, meta: { color: C.txt2, fontSize: 13, lineHeight: 19, marginTop: 9 }, description: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 10 }, kakao: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.accent, alignItems: 'center', justifyContent: 'center', marginTop: 16 }, kakaoText: { color: C.accent, fontSize: 14, fontWeight: '800' },
});
