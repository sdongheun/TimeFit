import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon } from '../engine';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { KakaoRouteMap } from './KakaoRouteMap';
import { C } from './theme';
import { displayLocationLabel } from './locationLabelDisplayModel';

type Props = { visible: boolean; title: string; center: LatLon; labelAdapter: ReturnType<typeof createKakaoLocationLabelAdapter>; onClose: () => void; onConfirm: (selection: { point: LatLon; label: string; source: 'map' }) => void; onSearch: () => void; };

/** 중앙 고정 핀: 이동 중에는 좌표만 갱신하고, 확정 행동 한 번에서만 API-S-6을 소비한다. */
export function MapPlacePicker({ visible, title, center, labelAdapter, onClose, onConfirm, onSearch }: Props) {
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<LatLon>(center);
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [recenterToken, setRecenterToken] = useState(0);
  const pointVersion = useRef(0);
  const confirmVersion = useRef(0);
  useEffect(() => { if (visible) { setPoint(center); setMapFailed(false); setMapReady(false); setConfirmMessage(''); pointVersion.current += 1; setRecenterToken((value) => value + 1); } }, [center, visible]);
  const updateCenter = (next: LatLon) => { pointVersion.current += 1; setPoint(next); setConfirmMessage(''); };
  const confirm = async () => {
    if (confirming) return;
    const selected = point, version = pointVersion.current;
    confirmVersion.current += 1;
    const request = confirmVersion.current;
    setConfirming(true); setConfirmMessage('');
    const result = await labelAdapter.resolve(selected, 'pin_confirm');
    if (request !== confirmVersion.current || version !== pointVersion.current) { setConfirming(false); return; }
    setConfirming(false);
    if ((result.source === 'address' || result.source === 'region') && result.address) { onConfirm({ point: selected, label: displayLocationLabel(result), source: 'map' }); return; }
    setConfirmMessage('주소를 확인하지 못했어요. 좌표로 선택하거나 검색으로 선택하세요.');
  };
  const confirmCoordinate = () => onConfirm({ point, label: `지도 선택 위치 (${point.lat.toFixed(4)}, ${point.lon.toFixed(4)})`, source: 'map' });
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={s.root}>
    <KakaoRouteMap key={mapRetryKey} style={s.map} points={[]} line={[]} markers={[]} initialCenter={center} recenterPoint={center} recenterToken={recenterToken} onMapCenterChange={updateCenter} onMapReady={() => setMapReady(true)} onMapError={() => { setMapFailed(true); setMapReady(false); }} />
    <View pointerEvents="none" style={s.pinWrap}><View style={s.pin}><View style={s.pinDot} /></View><View style={s.pinTail} /></View>
    <View style={[s.top, { top: insets.top + 8 }]}><Pressable variant="icon" accessibilityLabel="뒤로가기" onPress={onClose} style={s.close}><Text style={s.closeText}>‹</Text></Pressable><Text style={s.title}>{title}</Text><Pressable onPress={onSearch} style={s.search}><Text style={s.searchText}>검색</Text></Pressable></View>
    <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}><Text testID="map-fixed-pin" style={s.hint}>{mapReady ? '지도를 움직여 중앙 핀 위치를 맞추세요' : '지도를 불러오는 중이에요'}</Text>{mapFailed ? <Text style={s.mapError}>지도를 불러오지 못했어요. 다시 시도하거나 검색으로 선택하세요.</Text> : null}{confirmMessage ? <Text style={s.mapError}>{confirmMessage}</Text> : null}<View style={s.actions}><Pressable testID="map-retry" style={s.secondary} onPress={() => { setMapFailed(false); setMapReady(false); setMapRetryKey((value) => value + 1); }}><Text style={s.secondaryText}>지도 다시 시도</Text></Pressable><Pressable testID="map-search-alternative" style={s.secondary} onPress={onSearch}><Text style={s.secondaryText}>검색으로 선택</Text></Pressable></View>{confirmMessage ? <Pressable testID="map-coordinate-confirm" style={s.secondary} onPress={confirmCoordinate}><Text style={s.secondaryText}>좌표로 선택</Text></Pressable> : null}<Pressable testID="map-confirm" style={[s.cta, (!mapReady || confirming) && s.ctaOff]} disabled={!mapReady || confirming} onPress={() => { void confirm(); }}>{confirming ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.ctaText}>이 위치로 확정</Text>}</Pressable></View>
  </View></Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, map: { flex: 1 }, pinWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 62 }, pin: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 1 }, pinTail: { width: 18, height: 18, marginTop: -10, backgroundColor: C.accent, borderRightWidth: 3, borderBottomWidth: 3, borderColor: '#fff', transform: [{ rotate: '45deg' }] }, pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.bg },
  top: { position: 'absolute', left: 16, right: 16, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 }, close: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,32,35,.94)' }, closeText: { color: C.txt, fontSize: 34, lineHeight: 35 }, title: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '800', textAlign: 'center' }, search: { minWidth: 48, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,32,35,.94)' }, searchText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 10, backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.line }, hint: { color: C.txt2, fontSize: 13, textAlign: 'center' }, mapError: { color: '#ffb4ab', fontSize: 12, textAlign: 'center' }, actions: { flexDirection: 'row', gap: 8 }, secondary: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: C.accent, fontSize: 13, fontWeight: '700' }, cta: { minHeight: 52, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, ctaOff: { opacity: .7 }, ctaText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
});
