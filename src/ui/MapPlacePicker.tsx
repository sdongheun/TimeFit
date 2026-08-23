import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon } from '../engine';
import { KakaoRouteMap } from './KakaoRouteMap';
import { C } from './theme';

type Props = {
  visible: boolean;
  title: string;
  center: LatLon;
  onClose: () => void;
  onConfirm: (point: LatLon) => void;
  onSearch: () => void;
};

// 검색 결과가 애매하거나 GPS가 틀린 경우의 명시적 수동 좌표 선택 경로.
export function MapPlacePicker({ visible, title, center, onClose, onConfirm, onSearch }: Props) {
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState<LatLon>(center);
  useEffect(() => {
    if (visible) setPoint(center);
  }, [center, visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <KakaoRouteMap style={s.map} points={[point]} line={[]} markers={[{ ...point, label: '선택 위치', kind: 'origin', active: true }]} onMapTap={setPoint} />
        <View style={[s.top, { top: insets.top + 8 }]}><Pressable onPress={onClose} style={s.close}><Text style={s.closeText}>‹</Text></Pressable><Text style={s.title}>{title}</Text><Pressable onPress={onSearch} style={s.search}><Text style={s.searchText}>검색</Text></Pressable></View>
        <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={s.hint}>지도를 탭해 위치를 선택하세요</Text>
          <Pressable style={s.cta} onPress={() => onConfirm(point)}><Text style={s.ctaText}>이 위치로 선택</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, map: { flex: 1 },
  top: { position: 'absolute', left: 16, right: 16, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,32,35,.94)' }, closeText: { color: C.txt, fontSize: 34, lineHeight: 35 },
  title: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '800', textAlign: 'center' }, search: { minWidth: 48, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,32,35,.94)' }, searchText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 10, backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.line }, hint: { color: C.txt2, fontSize: 13, textAlign: 'center' }, cta: { minHeight: 52, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, ctaText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
});
