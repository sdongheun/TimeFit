import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import catalog from '../../data/busan_poi_catalog.json';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import type { CompletedMapPlace } from './completedPlaceMapModel';
import { BUSAN_DISTRICT_PATHS } from './busanDistrictPaths';
import { buildBusanVisitMap, type BusanVisitPlace, type BusanVisitPlaceSummary } from './busanVisitMapModel';

function districtFill(count: number) {
  if (count >= 5) return '#0A84FF';
  if (count >= 3) return '#1674D1';
  if (count >= 1) return '#205B91';
  return '#292D35';
}

function DistrictLayers({ selectedId, counts }: { selectedId: string | null; counts: ReadonlyMap<string, number> }) {
  return <>
    {BUSAN_DISTRICT_PATHS.map(row => <Path key={`shadow:${row.id}`} d={row.d} fill="#06080C" opacity={0.68} transform="translate(0 7)" />)}
    {BUSAN_DISTRICT_PATHS.map(row => <Path key={`side:${row.id}`} d={row.d} fill={counts.get(row.id) ? '#0B3157' : '#171A20'} stroke="#0D0F13" strokeWidth={1} transform="translate(0 4)" />)}
    {BUSAN_DISTRICT_PATHS.map(row => <Path key={`mid:${row.id}`} d={row.d} fill={counts.get(row.id) ? '#104A7E' : '#20242B'} transform="translate(0 2)" />)}
    {BUSAN_DISTRICT_PATHS.map(row => <Path key={`top:${row.id}`} testID={`busan-district-fill-${row.id}`} d={row.d} fill={districtFill(counts.get(row.id) ?? 0)} stroke={row.id === selectedId ? '#F2F8FF' : '#747D89'} strokeWidth={row.id === selectedId ? 2.5 : 1.25} />)}
  </>;
}

export function BusanVisitVectorMap({ places, onOpenKakao, showPlaceList = true, onDistrictFilterChange }: { places: readonly CompletedMapPlace[]; onOpenKakao: (place: BusanVisitPlace['source']) => Promise<boolean>; showPlaceList?: boolean; onDistrictFilterChange?: (value: { district: string; contentIds: string[] } | null) => void }) {
  const data = useMemo(() => buildBusanVisitMap(places, [...catalog.matched.data, ...catalog.unmatched.data]), [places]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openFailedId, setOpenFailedId] = useState<string | null>(null);
  const reduceMotion = useRef(false);
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) reduceMotion.current = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotion.current = value; });
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const counts = useMemo(() => new Map(data.districts.map(row => [row.id, row.count])), [data.districts]);
  const selectedDistrict = selectedDistrictId ? data.districts.find(row => row.id === selectedDistrictId) ?? null : null;
  const selectedPath = selectedDistrict ? BUSAN_DISTRICT_PATHS.find(row => row.id === selectedDistrict.id) ?? null : null;
  const visitedDistricts = useMemo(() => data.districts.filter(row => row.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')), [data.districts]);
  const districtPlaces = useMemo(() => selectedDistrict ? data.placeSummaries.filter(place => place.district === selectedDistrict.name) : data.placeSummaries, [data.placeSummaries, selectedDistrict]);
  const categories = useMemo(() => [...new Set(districtPlaces.map(place => place.category))], [districtPlaces]);
  const activeCategory = selectedCategory && categories.includes(selectedCategory) ? selectedCategory : null;
  const visiblePlaces = useMemo(() => activeCategory ? districtPlaces.filter(place => place.category === activeCategory) : districtPlaces, [activeCategory, districtPlaces]);
  const scopeVisitCount = districtPlaces.reduce((sum, place) => sum + place.visitCount, 0);
  const selectDistrict = (id: string | null) => {
    setSelectedDistrictId(id);
    setOpenFailedId(null);
    const district = id ? data.districts.find(row => row.id === id) ?? null : null;
    onDistrictFilterChange?.(district ? { district: district.name, contentIds: data.placeSummaries.filter(place => place.district === district.name).map(place => place.contentId) } : null);
    if (reduceMotion.current) { reveal.setValue(id ? 1 : 0); return; }
    reveal.setValue(id ? 0.25 : 1);
    Animated.timing(reveal, { toValue: id ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  };
  const openKakao = async (place: BusanVisitPlaceSummary) => {
    if (openingId) return;
    setOpeningId(place.contentId);
    setOpenFailedId(null);
    try { if (!await onOpenKakao(place.source)) setOpenFailedId(place.contentId); }
    catch { setOpenFailedId(place.contentId); }
    finally { setOpeningId(null); }
  };
  return <View style={s.root}>
    <View testID="busan-visit-vector-map" accessibilityRole="image" accessibilityLabel={selectedDistrict ? `${selectedDistrict.name} 외곽선이 강조된 부산 구군별 방문 현황` : '부산 구군별 방문 현황'} style={s.map}>
      <View style={s.mapLayer}>
        <Svg viewBox="-5.5 4.5 600 462" width="100%" height="100%">
          <DistrictLayers selectedId={selectedDistrict?.id ?? null} counts={counts} />
          {data.districts.filter(row => row.count > 0).map(row => <ViewCount key={row.id} x={row.labelX} y={row.labelY} count={row.count} />)}
        </Svg>
        {selectedPath ? <Animated.View pointerEvents="none" style={[s.selectionOverlay, { opacity: reveal }]}> 
          <Svg viewBox="-5.5 4.5 600 462" width="100%" height="100%">
            <Path testID="busan-district-focus-glow" d={selectedPath.d} fill="none" stroke="#72B9FF" strokeWidth={8} opacity={0.34} />
            <Path testID="busan-district-focus" d={selectedPath.d} fill="none" stroke="#F5FAFF" strokeWidth={3.2} />
          </Svg>
        </Animated.View> : null}
      </View>
    </View>
    <View style={s.legend}><View style={s.legendDot} /><Text style={s.legendText}>{selectedDistrict ? `${selectedDistrict.name} 외곽선만 강조했어요 · 색은 방문량을 유지해요` : '색이 밝을수록 방문이 많아요'}</Text></View>
    {data.unlocatedCount ? <Text style={s.missing}>지역을 확인할 수 없는 방문 {data.unlocatedCount}회는 기록에 그대로 보존돼요.</Text> : null}
    <View style={s.sectionHeader}><Text style={s.sectionTitle}>지역 필터</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.regions}>
      <Pressable testID="busan-region-all" accessibilityRole="button" accessibilityState={{ selected: selectedDistrictId === null }} style={[s.region, selectedDistrictId === null && s.regionSelected]} onPress={() => selectDistrict(null)}>
        <Text style={[s.regionName, selectedDistrictId === null && s.regionNameSelected]}>전체</Text>
      </Pressable>
      {visitedDistricts.map(district => <Pressable key={district.id} testID={`busan-region-card-${district.id}`} accessibilityRole="button" accessibilityState={{ selected: selectedDistrictId === district.id }} style={[s.region, selectedDistrictId === district.id && s.regionSelected]} onPress={() => selectDistrict(district.id)}>
        <Text style={[s.regionName, selectedDistrictId === district.id && s.regionNameSelected]}>{district.name}</Text><Text style={[s.regionCount, selectedDistrictId === district.id && s.regionCountSelected]}>{district.count}</Text>
      </Pressable>)}
    </ScrollView>
    {showPlaceList ? <View style={s.placeSection}>
      <Text testID="busan-place-list-heading" style={s.sectionTitle}>{selectedDistrict ? `${selectedDistrict.name}에서 다녀간 장소` : '다녀간 장소'}</Text>
      <Text testID="busan-place-scope" style={s.scope}>{`${selectedDistrict?.name ?? '전체 지역'} · 방문 ${scopeVisitCount}회 · ${districtPlaces.length}곳`}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>
        {[null, ...categories].map(category => <Pressable key={category ?? 'all'} testID={`busan-place-category-${category ?? 'all'}`} accessibilityRole="button" accessibilityState={{ selected: category === activeCategory }} style={[s.category, category === activeCategory && s.categorySelected]} onPress={() => { setSelectedCategory(category); setOpenFailedId(null); }}><Text style={[s.categoryText, category === activeCategory && s.categoryTextSelected]}>{category ?? '전체'}</Text></Pressable>)}
      </ScrollView>
      {visiblePlaces.length ? <View testID="busan-place-list" style={s.places}>
        {visiblePlaces.map(place => <View key={place.contentId} testID={`busan-visit-place-${place.contentId}`} style={s.place}>
          <Text numberOfLines={1} style={s.placeText}>{place.title}</Text>
          <Text style={s.placeMeta}>{place.neighborhood ?? place.district} · {place.category}</Text>
          <Text style={s.visitCount}>방문 {place.visitCount}회</Text>
          <Pressable testID={`busan-visit-open-kakao-${place.contentId}`} accessibilityRole="link" disabled={openingId !== null} style={s.kakao} onPress={() => void openKakao(place)}><Text style={s.kakaoText}>{openingId === place.contentId ? '여는 중' : '카카오맵에서 보기'}</Text></Pressable>
          {openFailedId === place.contentId ? <Text style={s.error}>카카오맵을 열지 못했어요. 다시 시도해 주세요.</Text> : null}
        </View>)}
      </View> : <Text style={s.guide}>선택한 지역과 카테고리에 해당하는 장소가 없어요.</Text>}
    </View> : null}
  </View>;
}

function ViewCount({ x, y, count }: { x: number; y: number; count: number }) {
  return <>
    <Circle cx={x} cy={y} r={14} fill="#10151C" stroke="#6BAEFF" strokeWidth={2} />
    <SvgText x={x} y={y + 5} textAnchor="middle" fontSize={13} fontWeight="800" fill="#FFFFFF">{count}</SvgText>
  </>;
}

const s = StyleSheet.create({
  root: { gap: 10 },
  map: { height: 244, borderRadius: 18, overflow: 'hidden', backgroundColor: '#171A20', borderWidth: 1, borderColor: C.line },
  mapLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  legendText: { color: C.muted, fontSize: 12 },
  missing: { color: C.muted, fontSize: 12, lineHeight: 18 },
  sectionHeader: { marginTop: 12 },
  sectionTitle: { color: C.txt, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  regions: { gap: 8, paddingBottom: 2 },
  region: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  regionSelected: { borderColor: C.accent, backgroundColor: C.accent },
  regionName: { color: C.txt2, fontSize: 13, fontWeight: '800' },
  regionNameSelected: { color: C.onAccent },
  regionCount: { color: C.accent, fontSize: 12, fontWeight: '900' },
  regionCountSelected: { color: C.onAccent },
  placeSection: { gap: 10, marginTop: 14 },
  scope: { color: C.txt2, fontSize: 13, lineHeight: 19 },
  categories: { gap: 8, paddingBottom: 2 },
  category: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  categorySelected: { borderColor: C.accent, backgroundColor: C.accent },
  categoryText: { color: C.txt2, fontSize: 13, fontWeight: '700' },
  categoryTextSelected: { color: C.onAccent },
  places: { gap: 10, paddingBottom: 2 },
  place: { width: '100%', minHeight: 146, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  placeText: { color: C.txt, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  placeMeta: { color: C.txt2, fontSize: 12, lineHeight: 18, marginTop: 5 },
  visitCount: { color: C.accent, fontSize: 12, fontWeight: '800', marginTop: 5, marginBottom: 12 },
  kakao: { minHeight: 44, paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#29303A', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  kakaoText: { color: C.onAccent, fontSize: 13, fontWeight: '800' },
  guide: { color: C.muted, fontSize: 13, lineHeight: 19 },
  error: { color: C.red, fontSize: 12, lineHeight: 18, marginTop: 8 },
  selectionOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
