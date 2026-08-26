// 장소 선택 모달 (검색 전용, 지도 없음 — WebView 미의존이라 재빌드 불필요)
// 장소명 검색 전용: Kakao Local 우선 + TMAP POI fallback만 사용한다. 주소는 별도 정책·모드가 생길 때까지 섞지 않는다.
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  LatLon,
  Poi,
  geocodeAddr,
  kakaoGeocodeAddr,
  kakaoReverseGeocode,
  reverseGeocode,
} from '../engine';
import { kakaoPoiSearchMultiResult, type PlaceSearchResult } from '../engine/kakao';
import { tmapPoiSearchMultiResult } from '../engine/travel';
import { searchPlaceSuggestions, type PlaceSearchSuggestion } from '../services/placeSearchSuggestionAdapter';
import { C } from './theme';
import { diagnosePlaceSearchSuggestions, initialPlaceSearchSelection } from './placeSearchRanking';
import { placeSearchCompletionDiagnostic, placeSearchDisplayStateFromResults } from './placeSearchStateModel';
import { placeSuggestionLineLabel } from './placeSearchSuggestionModel';

export type Place = { label: string; lat: number; lon: number };

type Props = {
  visible: boolean;
  title: string;
  center: LatLon;              // POI 검색 가까운 순 기준
  showGps?: boolean;
  onClose: () => void;
  onConfirm: (p: Place) => void;
};

export function PlacePicker({ visible, title, center, showGps = true, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [cands, setCands] = useState<PlaceSearchSuggestion[]>([]);
  const [sel, setSel] = useState(initialPlaceSearchSelection);
  const [busy, setBusy] = useState<'search' | 'gps' | ''>('');
  const [msg, setMsg] = useState('장소 이름으로 검색하세요');
  const requestId = useRef(0);

  function changeQuery(value: string) {
    requestId.current += 1;
    setQ(value);
    setCands([]);
    setSel(initialPlaceSearchSelection);
    setBusy('');
    setMsg(value.trim() ? '검색 버튼을 눌러 장소를 찾으세요' : '장소 이름으로 검색하세요');
  }

  async function search() {
    const query = q.trim();
    if (!query) return;
    const searchId = requestId.current + 1;
    requestId.current = searchId;
    setBusy('search'); setSel(initialPlaceSearchSelection);
    // API-S-4 제안 계약만 소비한다. 주소 결과는 기본 장소명 목록에 절대 섞지 않는다.
    const response = await searchPlaceSuggestions({
      query,
      searchers: {
        kakao: (nextQuery) => kakaoPoiSearchMultiResult(nextQuery, undefined, 5),
        tmap: (nextQuery) => tmapPoiSearchMultiResult(nextQuery, undefined, 5),
      },
    });
    const diagnostic = diagnosePlaceSearchSuggestions(query, response.suggestions);
    const staleIgnored = searchId !== requestId.current;
    const kakao = response.results.filter((result) => result.provider === 'kakao').at(-1) as PlaceSearchResult;
    const tmap = response.results.filter((result) => result.provider === 'tmap').at(-1) as PlaceSearchResult;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[place-search-complete]', placeSearchCompletionDiagnostic({
        kakao,
        tmap,
        rankingCounts: diagnostic.counts,
        staleIgnored,
        fallbackCalls: response.diagnostics.fallbackCalls,
        rawPoiCount: response.results.reduce((sum, result) => sum + (result.metrics?.rawPoiCount ?? result.pois.length), 0),
      }));
    }
    if (staleIgnored) return;
    setBusy('');
    const list = diagnostic.results;
    setCands(list);
    const state = placeSearchDisplayStateFromResults(response.results, list.length);
    setMsg(state === 'empty' ? '장소명 결과가 없어요' : state === 'retry' ? '장소 검색을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.' : '목록에서 위치를 선택하세요');
  }

  // 내 위치(GPS) → 주소 라벨로 바로 선택 가능
  async function useMyLocation() {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setMsg('위치 권한이 거부됐어요'); return; }
      const p = await Location.getCurrentPositionAsync({});
      const lat = p.coords.latitude, lon = p.coords.longitude;
      const addr = await kakaoReverseGeocode(lat, lon) ?? await reverseGeocode(lat, lon);
      const geocoded = addr ? (await kakaoGeocodeAddr(addr, 1))[0] ?? (await geocodeAddr(addr, 1))[0] : null;
      const targetLat = geocoded ? geocoded.lat : lat;
      const targetLon = geocoded ? geocoded.lon : lon;
      const me: Poi = { name: addr ? `내 위치 · ${addr}` : `내 위치 (${lat.toFixed(4)}, ${lon.toFixed(4)})`, lat: targetLat, lon: targetLon, addr: 'GPS' };
      setCands([{ poi: me, match: 'direct', label: me.name, labelSource: 'provider_name' }]); setSel(0); setMsg('');
    } catch { setMsg('위치를 가져오지 못했어요'); }
    finally { setBusy(''); }
  }

  const choice: Place | null = sel >= 0 && cands[sel]
    ? { label: cands[sel].label, lat: cands[sel].poi.lat, lon: cands[sel].poi.lon } : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.head, { paddingTop: insets.top + 12 }]}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        </View>

        <View style={s.searchRow}>
          <TextInput style={s.input} value={q} onChangeText={changeQuery} autoFocus
            placeholder="예: 부산역 / 벡스코 / 사상역" placeholderTextColor={C.muted}
            returnKeyType="search" onSubmitEditing={search} />
          <Pressable style={s.searchBtn} onPress={search} disabled={busy === 'search'}>
            {busy === 'search' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>검색</Text>}
          </Pressable>
        </View>
        {showGps && (
          <View style={s.searchRow}>
            <Pressable style={[s.searchBtn, { flex: 1 }]} onPress={useMyLocation} disabled={busy === 'gps'}>
              {busy === 'gps' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>📍 현재 위치 사용</Text>}
            </Pressable>
          </View>
        )}

        {msg ? <Text style={s.msg}>{msg}</Text> : null}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14 }} keyboardShouldPersistTaps="handled">
          {cands.map((p, i) => (
            <Pressable key={i} style={[s.row, i === sel && s.rowOn]} onPress={() => setSel(i)}>
              <Text style={[s.rowDot, i === sel && { color: C.accent }]}>{i === sel ? '●' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{p.label}</Text>
                <Text style={s.rowAddr} numberOfLines={1}>{p.poi.addr}</Text>
              </View>
              {placeSuggestionLineLabel(p) && <Text style={s.tag}>{placeSuggestionLineLabel(p)}</Text>}
              {p.poi.addr === 'GPS' && <Text style={[s.tag, { color: C.green, borderColor: C.green }]}>GPS</Text>}
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            style={[s.cta, !choice && s.ctaOff]}
            disabled={!choice}
            onPress={() => { if (choice) { onConfirm(choice); onClose(); } }}
          >
            <Text style={s.ctaTxt} numberOfLines={1}>{choice ? `이 위치로 확정 — ${choice.label}` : '위치를 선택하세요'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { color: C.txt, fontSize: 18, fontWeight: '800' },
  close: { color: C.muted, fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  input: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14, color: C.txt, fontSize: 14.5 },
  searchBtn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  searchBtnTxt: { color: C.accent, fontWeight: '700', fontSize: 13 },
  msg: { color: C.muted, fontSize: 12.5, paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2 },
  rowOn: { backgroundColor: C.panel },
  rowDot: { color: '#5a6672', fontSize: 13 },
  rowName: { color: C.txt, fontSize: 14.5, fontWeight: '600' },
  rowAddr: { color: C.muted, fontSize: 12, marginTop: 1 },
  tag: { color: C.muted, fontSize: 10.5, fontWeight: '700', borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  footer: { padding: 14, paddingBottom: 28, borderTopWidth: 1, borderTopColor: C.line },
  cta: { minHeight: 52, backgroundColor: C.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ctaOff: { backgroundColor: C.panel2 },
  ctaTxt: { color: C.onAccent, fontSize: 15, fontWeight: '800' },
});
