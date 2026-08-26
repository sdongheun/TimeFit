import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { CourseV1Journey } from './recommendation/CourseV1Journey';
import { getPlaceDiscoveryContext } from './recommendation/courseV1DiscoveryContext';
import { startMinuteForRecommendation } from './recommendation/recommendationSessionTime';
import { CourseV1PlacePreview } from './recommendation/CourseV1PlacePreview';
import { openKakaoPlace, type CourseV1DisplayPlace } from './recommendation/courseV1PlacePreviewModel';

type Props = NativeStackScreenProps<RootStackParamList, 'CourseConfirm'>;
type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const places = new Map<string, RuntimePlace>([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place]));

/** 저장 계약 전 V1 코스를 읽기 전용으로 검토한다. 확정 CTA는 의도적으로 없다. */
export function CourseConfirmScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [linkError, setLinkError] = useState('');
  const course = route.params.course;
  const startMin = startMinuteForRecommendation(route.params.session.nowIso);
  const openPlace = async (place: CourseV1DisplayPlace) => { const status = await openKakaoPlace(place, Linking.openURL); setLinkError(status === 'failed' ? '카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.' : ''); };
  const displayPlace = (id: string): CourseV1DisplayPlace => places.get(id) ?? { title: id, lat: Number.NaN, lon: Number.NaN };
  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}><View style={s.header}><Pressable accessibilityLabel="추천 결과로 돌아가기" style={s.icon} onPress={() => navigation.goBack()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>코스 확인</Text><View style={s.icon} /></View><Text style={s.copy}>엔진이 정한 방문 순서와 실제 이동시간입니다.</Text><View style={s.card}><CourseV1Journey course={course} startMin={startMin} />{course.placeIds.map((id, index) => <CourseV1PlacePreview key={id} place={displayPlace(id)} context={getPlaceDiscoveryContext(places.get(id))} stayMin={course.stops[index]?.stayMin} onOpenKakao={openPlace} />)}</View>{linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}</ScrollView></View>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 16 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, back: { color: C.txt, fontSize: 32, lineHeight: 34 }, title: { color: C.txt, fontSize: 17, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20 }, card: { padding: 17, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, error: { color: C.red, fontSize: 13, lineHeight: 19 } });
