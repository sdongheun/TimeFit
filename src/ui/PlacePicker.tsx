// 장소 선택 모달 (검색 전용, 지도 없음 — WebView 미의존이라 재빌드 불필요)
// 검색어 하나로 Kakao Local 우선 + TMAP 폴백 POI/주소 지오코딩을 조회해 합쳐 보여준다.
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import {
  LatLon,
  Poi,
  geocodeAddr,
  kakaoGeocodeAddr,
  kakaoPoiSearchMulti,
  kakaoReverseGeocode,
  poiSearchMulti,
  reverseGeocode,
} from '../engine';
import { C } from './theme';

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
  const [cands, setCands] = useState<Poi[]>([]);
  const [sel, setSel] = useState(-1);
  const [busy, setBusy] = useState<'search' | 'gps' | ''>('');
  const [msg, setMsg] = useState('카카오 장소 이름 또는 주소로 검색하세요');

  async function search() {
    if (!q.trim()) return;
    setBusy('search'); setSel(-1);
    // Kakao Local 우선. 결과가 부족하면 기존 TMAP 검색을 폴백으로 섞는다.
    let [pois, addrs] = await Promise.all([
      kakaoPoiSearchMulti(q, center, 5),
      kakaoGeocodeAddr(q, 3),
    ]);
    if (!pois.length) pois = await kakaoPoiSearchMulti(q, undefined, 5);
    if (pois.length < 3) {
      const tmapPois = await poiSearchMulti(q, center, 5 - pois.length);
      pois = mergePois([...pois, ...tmapPois]);
    }
    if (addrs.length < 1) addrs = await geocodeAddr(q, 3);
    setBusy('');
    const list = mergePois([...pois, ...addrs]);
    setCands(list);
    if (!list.length) { setMsg('검색 결과 없음 — 다른 이름/주소로 시도해보세요'); return; }
    setMsg(''); setSel(0);
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
      const me: Poi = { name: addr ? `내 위치 · ${addr}` : `내 위치 (${lat.toFixed(4)}, ${lon.toFixed(4)})`, lat, lon, addr: 'GPS' };
      setCands([me]); setSel(0); setMsg('');
    } catch { setMsg('위치를 가져오지 못했어요'); }
    finally { setBusy(''); }
  }

  const choice: Place | null = sel >= 0 && cands[sel]
    ? { label: cands[sel].name, lat: cands[sel].lat, lon: cands[sel].lon } : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={[s.head, { paddingTop: insets.top + 12 }]}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        </View>

        <View style={s.searchRow}>
          <TextInput style={s.input} value={q} onChangeText={setQ} autoFocus
            placeholder="예: 부산역 / 벡스코 / 부산진구 중앙대로 672" placeholderTextColor={C.muted}
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
                <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.rowAddr} numberOfLines={1}>{p.addr}</Text>
              </View>
              {p.addr === '주소' && <Text style={s.tag}>주소</Text>}
              {p.addr === 'GPS' && <Text style={[s.tag, { color: C.green, borderColor: C.green }]}>GPS</Text>}
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

function mergePois(list: Poi[]): Poi[] {
  const seen = new Set<string>();
  const out: Poi[] = [];
  for (const p of list) {
    const key = `${p.name.replace(/\s/g, '').toLowerCase()}|${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
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
