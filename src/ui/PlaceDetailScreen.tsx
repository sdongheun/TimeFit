import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { KakaoRouteMap } from './KakaoRouteMap';
import type { RootStackParamList } from './nav';
import {
  buildPlaceDetailMarkers,
  buildPlaceDetailModel,
  placeDetailSelectionHandoff,
  type PlaceDetailCatalogPlace,
  type PlaceDetailRequestIdentity,
} from './placeDetailModel';
import { openKakaoPlaceWithAppFallback } from './recommendation/courseV1PlacePreviewModel';
import { C } from './theme';
import { placeDetailLayout } from './placeDetailLayout';
import { PlacePhoto, PlacePhotoCredit } from './PlacePhoto';

type Props = NativeStackScreenProps<RootStackParamList, 'PlaceDetail'>;
type RuntimePlace = PlaceDetailCatalogPlace;
const places = new Map<string, RuntimePlace>(
  [...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place as RuntimePlace]),
);

/** 로컬 catalog와 이미 획득된 위치 snapshot만 표시하는 계층형 장소 상세다. */
export function PlaceDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [sheetHeight, setSheetHeight] = useState(0);
  const layout = placeDetailLayout(window.height, insets.top, insets.bottom, sheetHeight);
  const { requestId, selectionKind, placeId, course, firstCourse, session } = route.params;
  const request: PlaceDetailRequestIdentity = { requestId, selectionKind, placeId, courseId: course.id };
  const candidate = places.get(placeId);
  const firstPlaceId = firstCourse?.placeIds[0];
  const selected = selectionKind === 'pair' && firstPlaceId ? places.get(firstPlaceId) : undefined;
  const model = candidate ? buildPlaceDetailModel(candidate, selectionKind) : null;
  const markers = candidate ? buildPlaceDetailMarkers(session, candidate, selected) : [];
  const selectLock = useRef(false);
  const [linkError, setLinkError] = useState('');

  const close = () => {
    placeDetailSelectionHandoff.cancel(request);
    navigation.goBack();
  };
  const choose = () => {
    if (selectLock.current || !model) return;
    selectLock.current = true;
    if (placeDetailSelectionHandoff.select(request)) navigation.goBack();
  };
  const openKakao = async () => {
    if (!candidate) return;
    const status = await openKakaoPlaceWithAppFallback(candidate, {
      canOpenApp: Linking.canOpenURL,
      openApp: Linking.openURL,
      openExternal: Linking.openURL,
      openBrowser: WebBrowser.openBrowserAsync,
    });
    setLinkError(status === 'app_opened' || status === 'external_opened' || status === 'browser_fallback_opened'
      ? '' : '카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
  };

  if (!candidate || !model) return <View style={[s.root, { paddingTop: insets.top }]}><View style={s.invalid}><Text style={s.title}>장소 정보를 표시할 수 없어요</Text><Pressable style={s.secondary} onPress={close}><Text style={s.secondaryText}>추천 결과로 돌아가기</Text></Pressable></View></View>;

  return <View style={s.root}>
    <KakaoRouteMap
      cameraTop={72}
      points={markers.map(({ lat, lon }) => ({ lat, lon }))}
      line={[]}
      markers={markers}
      showMarkerLabels
      usePhotoMarkers
      showRouteLegend={false}
      safeErrorPresentation
      boundsPadding={layout.boundsPadding}
      style={[s.map, { marginTop: insets.top }]}
    />
    <Pressable testID="place-detail-close" variant="icon" accessibilityLabel="장소 상세 닫기" style={[s.close, { top: insets.top + 14 }]} onPress={close}><Text style={s.closeText}>×</Text></Pressable>
    <View testID="place-detail-sheet" onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)} style={[s.sheet, { maxHeight: layout.maxHeight, paddingBottom: layout.paddingBottom }]}>
      <ScrollView testID="place-detail-information" style={s.information} contentContainerStyle={s.informationContent} showsVerticalScrollIndicator>
      <View style={s.sheetHeader}>
        <PlacePhoto place={candidate} style={[s.image, {flex:0}]} fallback={<View accessibilityLabel={`${model.categoryLabel} 사진 대체 화면`} style={s.imageFallback}><Text style={s.imageFallbackText}>{model.categoryLabel}</Text></View>} />
        <View style={s.heading}><Text style={s.category}>{model.categoryLabel}</Text><Text style={s.title}>{model.title}</Text></View>
      </View>
      <Text style={s.description}>{model.description}</Text>
      <PlacePhotoCredit place={candidate} links />
      <Text testID="place-detail-hours" style={s.meta}>{model.operatingHoursLabel}</Text>
      <Text style={s.address}>{model.addressLabel}</Text>
      {linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}
      <Pressable testID="place-detail-kakao" accessibilityRole="link" style={s.link} onPress={() => void openKakao()}><Text style={s.linkText}>카카오맵에서 장소 보기</Text></Pressable>
      </ScrollView>
      <Pressable testID="place-detail-select" accessibilityLabel={model.selectionLabel} style={s.primary} onPress={choose}><Text style={s.primaryText}>{model.selectionLabel}</Text></Pressable>
    </View>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  map: { flex: 1 },
  information: { flexShrink: 1 },
  informationContent: { gap: 10 },
  close: { position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: C.txt, fontSize: 28, lineHeight: 30 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 0, gap: 10, padding: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: C.panel },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  image: { width: 76, height: 76, borderRadius: 14, backgroundColor: C.panel2 },
  imageFallback: { width: 76, height: 76, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#26384a' },
  imageFallbackText: { color: '#b9d8ff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  heading: { flex: 1, gap: 4 },
  category: { color: '#78b7ff', fontSize: 12, fontWeight: '800' },
  title: { color: C.txt, fontSize: 21, lineHeight: 27, fontWeight: '800' },
  description: { color: C.txt2, fontSize: 14, lineHeight: 20 },
  meta: { color: C.txt, fontSize: 13, fontWeight: '800' },
  address: { color: C.muted, fontSize: 13, lineHeight: 18 },
  error: { color: C.red, fontSize: 13, lineHeight: 18 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#78b7ff', fontSize: 14, fontWeight: '800' },
  primary: { minHeight: 52, flexShrink: 0, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent },
  primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2 },
  secondaryText: { color: C.txt, fontSize: 14, fontWeight: '800' },
  invalid: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
});
