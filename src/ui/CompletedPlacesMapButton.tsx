import { useState } from 'react';
import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import catalog from '../data/busan_poi_catalog.json';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { KakaoRouteMap } from './KakaoRouteMap';
import { completedPlaceMarkers, type CompletedMapPlace } from './activity/completedPlaceMapModel';
import { C } from './theme';

export function CompletedPlacesMapButton({ places, children, style }: { places: readonly CompletedMapPlace[]; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const markers = completedPlaceMarkers(places, [...catalog.matched.data, ...catalog.unmatched.data]);
  const missing = new Set(places.map(place => place.contentId)).size - markers.length;
  return <>
    <Pressable testID="completed-places-map-open" accessibilityRole="button" accessibilityLabel="완료한 장소 지도에서 보기" style={style} onPress={() => setVisible(true)}>{children ?? <Text style={s.link}>완료한 장소 지도에서 보기</Text>}</Pressable>
    {visible ? <Modal visible animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.header}><Text style={s.title}>다녀간 장소</Text><Pressable testID="completed-places-map-close" accessibilityRole="button" accessibilityLabel="방문 지도 닫기" onPress={() => setVisible(false)} style={s.close}><Text style={s.link}>닫기</Text></Pressable></View>
        {markers.length ? <KakaoRouteMap points={markers.map(({ lat, lon }) => ({ lat, lon }))} line={[]} markers={markers} showMarkerLabels showRouteLegend={false} safeErrorPresentation style={{ flex: 1 }} /> : <View style={s.empty}><Text style={s.copy}>표시할 장소 위치 정보가 없어요.</Text></View>}
        {missing > 0 ? <Text style={s.copy}>위치 정보를 확인할 수 없는 {missing}곳은 지도에서 제외했어요. 방문 기록은 유지됩니다.</Text> : null}
      </View>
    </Modal> : null}
  </>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }, title: { color: C.txt, fontSize: 20, fontWeight: '800' }, close: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' }, link: { color: C.accent, fontSize: 14, paddingVertical: 12 }, copy: { color: C.muted, padding: 20, lineHeight: 20 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
