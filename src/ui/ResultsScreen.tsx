import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { C } from './theme';
import { RootStackParamList } from './nav';
import { CourseV1Journey } from './recommendation/CourseV1Journey';
import { getPlaceDiscoveryContext } from './recommendation/courseV1DiscoveryContext';
import { startMinuteForRecommendation } from './recommendation/recommendationSessionTime';
import { CourseV1PlacePreview } from './recommendation/CourseV1PlacePreview';
import { openKakaoPlace, type CourseV1DisplayPlace } from './recommendation/courseV1PlacePreviewModel';
import { buildCourseV1AlternativeList, buildCourseV1ResultListItem, selectedCourseForConfirm } from './recommendation/courseV1ResultListModel';
import { courseV1OutcomeMessage } from './recommendation/courseV1OutcomeMessageModel';
import { RecommendationInternalDiagnosticsPanel } from './recommendation/RecommendationInternalDiagnostics';
import { recommendationDiagnosticsEnabled, recommendationInternalDiagnosticsModel } from './recommendation/recommendationInternalDiagnosticsModel';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;
type RuntimePlace = (typeof runtimeCatalog.matched.data)[number] | (typeof runtimeCatalog.unmatched.data)[number];
const places = new Map<string, RuntimePlace>([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place]));

export function ResultsScreen({ route, navigation }: Props) {
  const { result, session } = route.params;
  const insets = useSafeAreaInsets();
  const [linkError, setLinkError] = useState('');
  const course = result.representativeCourse;
  const renderedCourseCount = (course ? 1 : 0) + result.alternativeCourses.length;
  const diagnosticsPanel = recommendationDiagnosticsEnabled(process.env.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS)
    ? <RecommendationInternalDiagnosticsPanel diagnostics={recommendationInternalDiagnosticsModel(result, renderedCourseCount)} /> : null;
  const displayPlace = (id: string): CourseV1DisplayPlace => places.get(id) ?? { title: id, lat: Number.NaN, lon: Number.NaN };
  const openPlace = async (place: CourseV1DisplayPlace) => {
    const status = await openKakaoPlace(place, Linking.openURL);
    setLinkError(status === 'failed' ? '카카오맵을 열지 못했어요. 잠시 후 다시 시도해 주세요.' : '');
  };
  const header = <View style={s.header}><Pressable accessibilityLabel="시간 설정으로 돌아가기" style={s.icon} onPress={() => navigation.goBack()}><Text style={s.back}>‹</Text></Pressable><Text style={s.title}>시간의 추천</Text><View style={s.icon} /></View>;
  if (!course) {
    const exhausted = result.resultState === 'no_verified_course_within_limit';
    const noRepresentativeCandidates = result.resultState === 'no_representative_candidates';
    const outcomeMessage = courseV1OutcomeMessage(result.primaryOutcomeReason);
    return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14 }]}>{header}<View style={s.empty}><Text style={s.emptyTitle}>{exhausted ? '실제 경로로 확인할 수 있는\n코스를 찾지 못했어요' : '이 조건에서 확신 있게 추천할\n코스를 찾지 못했어요'}</Text><Text style={s.copy}>{outcomeMessage ?? (exhausted ? '경로를 확인한 코스가 시간 안에 들어오지 않았어요.' : '시간과 운영 상태를 함께 만족하는 후보가 없어요.')}</Text><Pressable style={s.secondary} onPress={() => navigation.goBack()}><Text style={s.secondaryText}>{noRepresentativeCandidates ? '조건 다시 설정' : '시간과 위치 다시 설정'}</Text></Pressable></View>{diagnosticsPanel}</ScrollView></View>;
  }
  const representative = buildCourseV1ResultListItem(course, (id) => places.get(id));
  const alternatives = buildCourseV1AlternativeList(result, (id) => places.get(id));
  const courseSummary = (item: typeof representative) => `${item.placeNames.join(' → ')} · ${item.totalMin}분`;
  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: 34 }]}>{header}<View style={s.budget}><Text style={s.budgetTitle}>{session.remainingMin}분 안에</Text><Text style={s.copy}>도착 전 {course.arrivalBufferMin}분 여유를 포함해 검증한 코스</Text></View><View style={s.card}><Text style={s.eyebrow}>대표 추천 · {course.placeIds.length}곳</Text><Text style={s.courseName}>{representative.placeNames.join(' → ')}</Text>{representative.context ? <Text style={s.discoveryContext}>{representative.context}</Text> : null}<CourseV1Journey course={course} startMin={startMinuteForRecommendation(session.nowIso)} /><View style={s.placeList}>{course.placeIds.map((id, index) => <CourseV1PlacePreview key={id} place={displayPlace(id)} context={getPlaceDiscoveryContext(places.get(id))} stayMin={course.stops[index]?.stayMin} onOpenKakao={openPlace} />)}</View></View>{linkError ? <Text accessibilityRole="alert" style={s.error}>{linkError}</Text> : null}<Pressable accessibilityLabel={`${courseSummary(representative)} 코스 확인`} style={s.secondary} onPress={() => navigation.navigate('CourseConfirm', { session, course: selectedCourseForConfirm(representative) })}><Text style={s.secondaryText}>코스 확인</Text></Pressable><View style={s.alternatives}><Text style={s.sectionTitle}>이 시간에 가능한 다른 코스</Text>{alternatives.length ? alternatives.map((item) => <Pressable key={item.course.id} accessibilityLabel={`${courseSummary(item)}${item.context ? `, ${item.context}` : ''}${item.remainingAfterCourseMin !== null ? `, 남는 시간 ${item.remainingAfterCourseMin}분` : ''} 코스 확인`} style={s.alternativeCard} onPress={() => navigation.navigate('CourseConfirm', { session, course: selectedCourseForConfirm(item) })}><Text style={s.alternativeTitle}>{courseSummary(item)}</Text>{item.context ? <Text style={s.discoveryContext}>{item.context}</Text> : null}{item.remainingAfterCourseMin !== null ? <Text style={s.remaining}>남는 시간 {item.remainingAfterCourseMin}분</Text> : null}</Pressable>) : <View style={s.exhausted}><Text style={s.copy}>이 조건에서 다른 검증 코스가 없어요</Text></View>}</View>{diagnosticsPanel}</ScrollView></View>;
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 14 }, header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, back: { color: C.txt, fontSize: 32, lineHeight: 34 }, title: { color: C.txt, fontSize: 17, fontWeight: '800' }, budget: { marginTop: 8 }, budgetTitle: { color: C.txt, fontSize: 26, fontWeight: '800' }, copy: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 5 }, card: { padding: 17, gap: 13, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, eyebrow: { color: '#74b0ff', fontSize: 13, fontWeight: '800' }, courseName: { color: C.txt, fontSize: 22, lineHeight: 30, fontWeight: '800' }, discoveryContext: { color: '#b9d8ff', fontSize: 13, fontWeight: '700', marginTop: -6 }, placeList: { paddingTop: 3, gap: 5 }, remaining: { color: '#c8b4ff', fontSize: 13, fontWeight: '800' }, error: { color: C.red, fontSize: 13, lineHeight: 19 }, secondary: { minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 }, secondaryText: { color: C.txt, fontSize: 16, fontWeight: '800' }, alternatives: { gap: 10, paddingTop: 10 }, sectionTitle: { color: C.txt, fontSize: 18, fontWeight: '800' }, alternativeCard: { padding: 15, gap: 7, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, alternativeTitle: { color: C.txt, fontSize: 16, lineHeight: 23, fontWeight: '800' }, exhausted: { alignItems: 'center', paddingTop: 8 }, empty: { minHeight: 400, justifyContent: 'center', alignItems: 'center' }, emptyTitle: { color: C.txt, fontSize: 25, lineHeight: 34, fontWeight: '800', textAlign: 'center' } });
