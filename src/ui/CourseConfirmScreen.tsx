import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { RootStackParamList } from './nav';
import { appPrivateWalkConnectorPort } from './privateWalkConnectorComposition';
import { C } from './theme';
import { openKakaoPlaceWithAppFallback, type CourseV1DisplayPlace } from './recommendation/courseV1PlacePreviewModel';
import { buildCourseV1DetailMarkers, buildCourseV1DetailModel } from './recommendation/courseV1CardDetailModel';
import {
  buildCourseV1ConnectorRequests,
  buildCourseV1RouteGeometryModel,
  loadCourseV1WalkConnectors,
  type CourseV1LoadedConnector,
} from './recommendation/courseV1RouteGeometryModel';
import { CourseV1VerticalDetail } from './recommendation/CourseV1VerticalDetail';
import { TwoStopSecondaryAction } from './recommendation/TwoStopSelectionPanel';
import { canOfferTwoStopSelection } from './recommendation/twoStopSelectionModel';
import { canRecordTwoStopSelectionIntent, getTwoStopSelectionPort, recordTwoStopSelectionIntent } from './recommendation/v1Session';
import { KakaoRouteMap } from './KakaoRouteMap';

type Props = NativeStackScreenProps<RootStackParamList, 'CourseConfirm'>;
type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const places = new Map<string, RuntimePlace>([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place]));
const EMPTY_CONNECTOR_STATE: Readonly<{ connectors: readonly CourseV1LoadedConnector[]; loading: boolean; failedCount: number }> = { connectors: [], loading: false, failedCount: 0 };

/** V1 검증 snapshot을 검토한 뒤 저장 없이 진행 화면으로만 연결한다. */
export function CourseConfirmScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [linkError, setLinkError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [connectorState, setConnectorState] = useState(EMPTY_CONNECTOR_STATE);
  const course = route.params.course;
  const twoStopPort = getTwoStopSelectionPort(route.params.session);
  const canSelectOneMore = canOfferTwoStopSelection(course, twoStopPort)
    && canRecordTwoStopSelectionIntent(route.params.session, course);
  const selectOneMore = () => {
    if (!canSelectOneMore || !recordTwoStopSelectionIntent(route.params.session, course)) {
      setSelectionError('이 결과에서는 한 곳을 더 확인할 수 없어요');
      return;
    }
    navigation.goBack();
  };
  const openPlace = async (place: CourseV1DisplayPlace) => { const status = await openKakaoPlaceWithAppFallback(place, { canOpenApp: Linking.canOpenURL, openApp: Linking.openURL, openExternal: Linking.openURL, openBrowser: WebBrowser.openBrowserAsync }); setLinkError(status === 'app_opened' || status === 'external_opened' || status === 'browser_fallback_opened' ? '' : '카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.'); };
  const detail = buildCourseV1DetailModel(course, route.params.session, (id) => places.get(id));
  const markers = detail ? buildCourseV1DetailMarkers(detail, route.params.session) : null;
  const mapMarkers = markers?.map((marker) => ({ ...marker, active: false })) ?? null;
  const connectorRequests = useMemo(
    () => buildCourseV1ConnectorRequests(course, route.params.session, (id) => places.get(id)),
    [course, route.params.session],
  );
  useEffect(() => {
    let mounted = true;
    if (!detail || !mapMarkers || connectorRequests.length === 0) {
      setConnectorState(EMPTY_CONNECTOR_STATE);
      return () => { mounted = false; };
    }
    if (!appPrivateWalkConnectorPort) {
      setConnectorState({ connectors: [], loading: false, failedCount: connectorRequests.length });
      return () => { mounted = false; };
    }
    setConnectorState({ connectors: [], loading: true, failedCount: 0 });
    loadCourseV1WalkConnectors(connectorRequests, appPrivateWalkConnectorPort).then((result) => {
      if (mounted) setConnectorState({ ...result, loading: false });
    });
    return () => { mounted = false; };
  }, [Boolean(detail && mapMarkers), connectorRequests]);
  const routeGeometry = useMemo(
    () => buildCourseV1RouteGeometryModel(course, connectorState.connectors),
    [course, connectorState.connectors],
  );
  const header = <View style={s.header}><Pressable accessibilityLabel="추천 결과로 돌아가기" style={s.icon} onPress={() => navigation.goBack()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>코스 확인</Text><View style={s.icon} /></View>;
  if (!detail) return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}<View style={s.invalid}><Text style={s.invalidTitle}>코스 정보를 안전하게 표시할 수 없어요</Text><Text style={s.copy}>추천 결과로 돌아가 다시 선택해 주세요.</Text></View></ScrollView></View>;

  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}{mapMarkers ? <View style={s.mapFrame}><KakaoRouteMap points={mapMarkers.map(({ lat, lon }) => ({ lat, lon }))} line={[]} segments={routeGeometry.segments} markers={mapMarkers} showMarkerLabels showRouteLegend={false} safeErrorPresentation boundsPadding={{ top: 48, right: 38, bottom: 64, left: 38 }} style={s.map} />{routeGeometry.legend.length ? <View accessible accessibilityLabel={routeGeometry.accessibilityLabel} pointerEvents="none" style={s.routeLegend}>{routeGeometry.legend.map((item) => <View key={item.mode} style={s.routeLegendRow}><View style={[s.routeLegendLine, item.mode === 'transit' && s.routeLegendTransit]} /><Text style={s.routeLegendText}>{item.label}</Text></View>)}</View> : null}<View pointerEvents="none" style={s.routeStatus}>{connectorState.loading ? <Text accessibilityLiveRegion="polite" style={s.routeStatusText}>도보 연결을 확인하는 중이에요</Text> : null}{connectorState.failedCount > 0 ? <Text accessibilityRole="alert" style={s.routeStatusText}>일부 도보 경로선을 표시하지 못했어요</Text> : null}{routeGeometry.missingMessage ? <Text accessibilityRole="alert" style={s.routeStatusText}>{routeGeometry.missingMessage}</Text> : null}</View></View> : <View accessibilityLabel="코스 지도 위치를 표시할 수 없음" style={s.mapFallback}><Text style={s.mapFallbackTitle}>지도 위치를 표시할 수 없어요</Text><Text style={s.copy}>아래 검증 코스는 계속 확인할 수 있어요.</Text></View>}<CourseV1VerticalDetail model={detail} onOpenKakao={openPlace} />{linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}<Pressable testID="verified-course-start" accessibilityLabel="코스 시작하기" style={s.primary} onPress={() => navigation.navigate('VerifiedCourseProgress', { session: route.params.session, course })}><Text style={s.primaryText}>코스 시작하기</Text></Pressable><TwoStopSecondaryAction available={canSelectOneMore} onPress={selectOneMore} />{selectionError ? <Text accessibilityRole="alert" style={s.error}>{selectionError}</Text> : null}</ScrollView></View>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 16, paddingBottom: 30 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, back: { color: C.txt, fontSize: 32, lineHeight: 34 }, title: { color: C.txt, fontSize: 17, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20 }, mapFrame: { height: 250, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, map: { flex: 1 }, routeLegend: { position: 'absolute', right: 10, bottom: 10, gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(17,24,32,0.9)' }, routeLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, routeLegendLine: { width: 24, height: 4, borderRadius: 4, backgroundColor: C.accent }, routeLegendTransit: { height: 0, borderTopWidth: 4, borderStyle: 'dashed', borderColor: C.amber, backgroundColor: 'transparent' }, routeLegendText: { color: C.txt2, fontSize: 11, fontWeight: '700' }, routeStatus: { position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'center', gap: 6 }, routeStatusText: { paddingHorizontal: 10, paddingVertical: 7, overflow: 'hidden', borderRadius: 8, color: C.txt2, backgroundColor: 'rgba(17,24,32,0.9)', fontSize: 11, fontWeight: '700' }, mapFallback: { height: 180, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, mapFallbackTitle: { color: C.txt, fontSize: 17, fontWeight: '800' }, invalid: { minHeight: 320, alignItems: 'center', justifyContent: 'center' }, invalidTitle: { color: C.txt, fontSize: 22, lineHeight: 30, fontWeight: '800', textAlign: 'center' }, error: { color: C.red, fontSize: 13, lineHeight: 19 }, primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' } });
