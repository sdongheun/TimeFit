// 장소 선택 모달: TMAP 지도(WebView) + POI 검색(가까운 순 5곳) + 지도 탭 핀(역지오코딩) + 내 위치(GPS)
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { LatLon, Poi, poiSearchMulti, reverseGeocode } from '../engine';
import { TmapWebMap } from './TmapWebMap';
import { C } from './theme';

export type Place = { label: string; lat: number; lon: number };

type Props = {
  visible: boolean;
  title: string;
  center: LatLon;              // 초기 지도 중심(검색 가까운 순 기준)
  onClose: () => void;
  onConfirm: (p: Place) => void;
};

export function PlacePicker({ visible, title, center, onClose, onConfirm }: Props) {
  const regionRef = useRef<LatLon>(center);
  const [q, setQ] = useState('');
  const [cands, setCands] = useState<Poi[]>([]);
  const [sel, setSel] = useState(-1);
  const [pin, setPin] = useState<Place | null>(null);
  const [focus, setFocus] = useState<LatLon | null>(null);
  const [busy, setBusy] = useState<'search' | 'gps' | ''>('');
  const [msg, setMsg] = useState('검색하거나, 지도를 탭해 핀을 찍으세요');

  async function search() {
    if (!q.trim()) return;
    setBusy('search'); setPin(null); setSel(-1);
    const list = await poiSearchMulti(q, regionRef.current, 5);
    setBusy('');
    setCands(list);
    if (!list.length) { setMsg('검색 결과 없음 — 다른 이름으로 시도해보세요'); return; }
    setMsg(''); setSel(0);
  }

  async function tapPin(lat: number, lon: number) {
    setSel(-1);
    setPin({ label: '주소 확인 중…', lat, lon });
    const addr = await reverseGeocode(lat, lon);
    setPin({ label: addr ?? `지정 위치 (${lat.toFixed(4)}, ${lon.toFixed(4)})`, lat, lon });
  }

  // 내 위치(GPS) → 핀 + 주소 라벨 (테스트 시 현재 위치 바로 선택)
  async function useMyLocation() {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setMsg('위치 권한이 거부됐어요'); return; }
      const p = await Location.getCurrentPositionAsync({});
      const lat = p.coords.latitude, lon = p.coords.longitude;
      setSel(-1); setCands([]);
      setPin({ label: '주소 확인 중…', lat, lon });
      const addr = await reverseGeocode(lat, lon);
      setPin({ label: addr ? `내 위치 · ${addr}` : `내 위치 (${lat.toFixed(4)}, ${lon.toFixed(4)})`, lat, lon });
      setMsg('');
    } catch { setMsg('위치를 가져오지 못했어요'); }
    finally { setBusy(''); }
  }

  function pick(i: number) {
    setPin(null); setSel(i);
    const p = cands[i];
    if (p) setFocus({ lat: p.lat, lon: p.lon });
  }

  const choice: Place | null = pin ?? (sel >= 0 && cands[sel]
    ? { label: cands[sel].name, lat: cands[sel].lat, lon: cands[sel].lon } : null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.head}>
          <Text style={s.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={s.close}>✕</Text></Pressable>
        </View>

        <View style={s.searchRow}>
          <TextInput style={s.input} value={q} onChangeText={setQ}
            placeholder="예: 서면역, 카페, 부산시청" placeholderTextColor={C.muted}
            returnKeyType="search" onSubmitEditing={search} />
          <Pressable style={s.searchBtn} onPress={search} disabled={busy === 'search'}>
            {busy === 'search' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>검색</Text>}
          </Pressable>
          <Pressable style={s.searchBtn} onPress={useMyLocation} disabled={busy === 'gps'}>
            {busy === 'gps' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>📍 내 위치</Text>}
          </Pressable>
        </View>

        {/* TMAP 지도 (WebView) — 마커 탭=선택, 빈 지도 탭=핀 */}
        <TmapWebMap
          style={s.map}
          center={center}
          markers={cands.map((p) => ({ lat: p.lat, lon: p.lon, label: p.name }))}
          pin={pin ? { lat: pin.lat, lon: pin.lon } : null}
          focus={focus}
          onMarkerTap={pick}
          onMapTap={tapPin}
          onCenterChange={(lat, lon) => { regionRef.current = { lat, lon }; }}
        />

        <View style={s.listWrap}>
          {msg ? <Text style={s.msg}>{msg}</Text> : null}
          <ScrollView style={{ maxHeight: 190 }} keyboardShouldPersistTaps="handled">
            {cands.map((p, i) => (
              <Pressable key={i} style={[s.row, i === sel && !pin && s.rowOn]} onPress={() => pick(i)}>
                <Text style={[s.rowDot, i === sel && !pin && { color: C.accent }]}>{i === sel && !pin ? '●' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>{i + 1}. {p.name}</Text>
                  <Text style={s.rowAddr} numberOfLines={1}>{p.addr}</Text>
                </View>
              </Pressable>
            ))}
            {pin && (
              <View style={[s.row, s.rowOn]}>
                <Text style={[s.rowDot, { color: C.green }]}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName} numberOfLines={1}>직접 지정</Text>
                  <Text style={s.rowAddr} numberOfLines={1}>{pin.label}</Text>
                </View>
              </View>
            )}
          </ScrollView>
          <Pressable
            style={[s.cta, !choice && s.ctaOff]}
            disabled={!choice}
            onPress={() => { if (choice) { onConfirm(choice); onClose(); } }}
          >
            <Text style={s.ctaTxt}>{choice ? `이 위치로 확정 — ${choice.label}` : '위치를 선택하세요'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 60, paddingBottom: 10 },
  title: { color: C.txt, fontSize: 18, fontWeight: '800' },
  close: { color: C.muted, fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  input: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14, color: C.txt, fontSize: 14.5 },
  searchBtn: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  searchBtnTxt: { color: C.accent, fontWeight: '700', fontSize: 13 },
  map: { flex: 1 },
  listWrap: { padding: 14, paddingBottom: 28, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  msg: { color: C.muted, fontSize: 12.5, marginBottom: 8, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10 },
  rowOn: { backgroundColor: C.panel },
  rowDot: { color: '#5a6672', fontSize: 13 },
  rowName: { color: C.txt, fontSize: 14, fontWeight: '600' },
  rowAddr: { color: C.muted, fontSize: 12, marginTop: 1 },
  cta: { marginTop: 10, backgroundColor: '#2ea043', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  ctaOff: { backgroundColor: C.panel2 },
  ctaTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
});
