// 통합 위치 선택: 빈 입력에서는 GPS/지도, 두 글자 입력 뒤에는 Kakao 장소·주소 제안을 소비한다.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  LatLon,
} from '../engine';
import { createKakaoLocationSearchAdapter, type LocationSuggestion } from '../services/kakaoLocationSearchAdapter';
import { C } from './theme';
import { initialPlaceSearchSelection } from './placeSearchRanking';
import { shouldDebounceLocationSearch } from './locationSelectionModel';

export type Place = { label: string; lat: number; lon: number; source: 'device' | 'provider' };

type Props = {
  visible: boolean;
  title: string;
  center: LatLon;              // POI 검색 가까운 순 기준
  showGps?: boolean;
  onOpenMap: () => void;
  onClose: () => void;
  onConfirm: (p: Place) => void;
};

export function PlacePicker({ visible, title, center, showGps = true, onOpenMap, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [cands, setCands] = useState<LocationSuggestion[]>([]);
  const [deviceLocation, setDeviceLocation] = useState<Place | null>(null);
  const [sel, setSel] = useState(initialPlaceSearchSelection);
  const [busy, setBusy] = useState<'search' | 'gps' | ''>('');
  const [msg, setMsg] = useState('장소 이름으로 검색하세요');
  const requestId = useRef(0);
  const submittedQuery = useRef<string | null>(null);
  const locationSearch = useRef(createKakaoLocationSearchAdapter()).current;

  function changeQuery(value: string) {
    requestId.current += 1;
    submittedQuery.current = null;
    setQ(value);
    setCands([]);
    setDeviceLocation(null);
    setSel(initialPlaceSearchSelection);
    setBusy('');
    setMsg(value.trim() ? '검색 버튼을 눌러 장소를 찾으세요' : '장소 이름으로 검색하세요');
  }

  useEffect(() => {
    const query = q.trim();
    if (!shouldDebounceLocationSearch(query)) return;
    const timer = setTimeout(() => {
      // 키보드/버튼으로 이미 같은 입력을 보냈다면 debounce 호출을 중복하지 않는다.
      if (submittedQuery.current !== query) void search();
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  async function search() {
    const query = q.trim();
    if (!query) return;
    submittedQuery.current = query;
    const searchId = requestId.current + 1;
    requestId.current = searchId;
    setBusy('search'); setSel(initialPlaceSearchSelection);
    setDeviceLocation(null);
    // API-S-5의 단일 Kakao 위치검색/TTL 계약만 소비한다. UI는 주소·노선·추가 제공사를 보정하지 않는다.
    const response = await locationSearch.search(query);
    const staleIgnored = searchId !== requestId.current;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[location-search-complete]', { attempts: response.attempts.map((attempt) => attempt.status), providerRequests: response.diagnostics.providerRequests, fallbackCount: response.diagnostics.fallbackCount, cache: response.diagnostics.cache, resultCount: response.suggestions.length, staleIgnored });
    }
    if (staleIgnored) return;
    setBusy('');
    const list = response.suggestions;
    setCands(list);
    const allOk = response.attempts.every((attempt) => attempt.status === 'ok');
    setMsg(list.length ? '목록에서 위치를 선택하세요' : allOk ? '장소 또는 주소 결과가 없어요' : '위치 검색을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }

  // 기기 GPS는 제공사 장소/주소 제안과 다른 선택 상태로 보존한다.
  async function useMyLocation() {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setMsg('위치 권한이 거부됐어요'); return; }
      const p = await Location.getCurrentPositionAsync({});
      const lat = p.coords.latitude, lon = p.coords.longitude;
      setCands([]); setSel(initialPlaceSearchSelection); setDeviceLocation({ label: '현재 위치', lat, lon, source: 'device' }); setMsg('기기 위치를 확정하세요');
    } catch { setMsg('위치를 가져오지 못했어요'); }
    finally { setBusy(''); }
  }

  const choice: Place | null = deviceLocation ?? (sel >= 0 && cands[sel]
    ? { label: cands[sel].label, lat: cands[sel].lat, lon: cands[sel].lon, source: 'provider' } : null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.head, { paddingTop: insets.top + 12 }]}>
          <Text style={s.title}>{title}</Text>
          <Pressable variant="icon" onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        </View>

        <View style={s.searchRow}>
          <TextInput testID="location-search-input" style={s.input} value={q} onChangeText={changeQuery} autoFocus
            placeholder="예: 부산역 / 벡스코 / 사상역" placeholderTextColor={C.muted}
            returnKeyType="search" onSubmitEditing={search} />
          <Pressable style={s.searchBtn} onPress={search} disabled={busy === 'search'}>
            {busy === 'search' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>검색</Text>}
          </Pressable>
        </View>
        {showGps && (
          <View style={s.searchRow}>
            <Pressable testID="location-current" style={[s.searchBtn, { flex: 1 }]} onPress={useMyLocation} disabled={busy === 'gps'}>
              {busy === 'gps' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>📍 현재 위치 사용</Text>}
            </Pressable>
          </View>
        )}
        {!q.trim() && <View style={s.searchRow}><Pressable testID="location-map" style={[s.searchBtn, { flex: 1 }]} onPress={onOpenMap}><Text style={s.searchBtnTxt}>지도에서 선택</Text></Pressable></View>}

        {msg ? <Text style={s.msg}>{msg}</Text> : null}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 14 }} keyboardShouldPersistTaps="handled">
          {deviceLocation ? <View testID="device-location-selection" style={[s.row, s.rowOn]}><Text style={[s.rowDot, { color: C.accent }]}>●</Text><View style={{ flex: 1 }}><Text style={s.rowName}>현재 위치</Text><Text style={s.rowAddr}>기기 위치</Text></View><Text style={s.tag}>기기 위치</Text></View> : null}
          {cands.map((p, i) => (
            <Pressable testID={`location-suggestion-${i}`} key={i} style={[s.row, i === sel && s.rowOn]} onPress={() => { setDeviceLocation(null); setSel(i); }}>
              <Text style={[s.rowDot, i === sel && { color: C.accent }]}>{i === sel ? '●' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{p.label}</Text>
                <Text style={s.rowAddr} numberOfLines={1}>{p.address}</Text>
              </View>
              <Text style={s.tag}>{p.kind === 'address' ? '주소' : p.providerLineLabels?.join(' · ') ?? (p.address === 'GPS' ? 'GPS' : '장소')}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.footer}>
          <Pressable
            style={[s.cta, !choice && s.ctaOff]}
            testID="location-confirm" disabled={!choice}
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
