import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Course, refineCourses } from '../engine';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { buildRouteMapSegments, KakaoRouteMap } from './KakaoRouteMap';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToBasket, resetToMain, resetToMyCourses, resetToProfile } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

function strategyLabel(course: Props['route']['params']['course']): string {
  if (course.strategy === 'destination_area') return '약속지 근처';
  if (course.strategy === 'route_area') return '가는 길 중간';
  return '출발지 근처';
}

export function DetailScreen({ route, navigation }: Props) {
  const { course, origin, ctx, source = 'builder' } = route.params;
  const flow = useAppFlow();
  const [activeCourse, setActiveCourse] = useState<Course>(course);
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState('');
  const target = ctx.appointment ?? origin;
  const pts = useMemo(() => [origin, ...activeCourse.spots, target], [activeCourse.spots, origin, target]);
  const travelLegs = activeCourse.legs.filter((lg) => !lg.label.startsWith('체류'));
  // TMAP 실경로(geo) 연결 — 없으면 직선 폴백
  const geoCoords = travelLegs.flatMap((lg) => lg.geo ?? []);
  const line = geoCoords.length > 1 ? geoCoords : pts;
  const routeSegments = buildRouteMapSegments(pts, travelLegs);
  const walk = activeCourse.mobility?.walk;
  const car = activeCourse.mobility?.car;
  const transit = activeCourse.mobility?.transit;

  function cancelBuilderCourse() {
    flow.setActiveCourse(null);
    if (flow.latestResults) {
      resetToBasket(navigation, {
        ...flow.latestResults,
        selectedIds: activeCourse.spots.map((sp) => sp.contentId),
        initialPage: 'basket',
      });
      return;
    }
    resetToMain(navigation);
  }

  function saveCurrentCourse() {
    flow.saveCourse({ course: activeCourse, origin, ctx });
    resetToMyCourses(navigation);
  }

  function startCourse() {
    const params = { course: activeCourse, origin, ctx };
    flow.setActiveCourse(params);
    navigation.navigate('Execution', params);
  }

  useEffect(() => {
    let alive = true;
    const movementLegs = course.legs.filter((lg) => !lg.label.startsWith('체류'));
    // 한 구간만 TMAP 경로여도 나머지 구간은 직선 폴백일 수 있다.
    // 코스의 모든 도로 이동 구간에 실경로 좌표가 있을 때만 정밀화를 생략한다.
    const hasCompleteRoadGeometry = ctx.mode !== 'transit'
      && movementLegs.length > 0
      && movementLegs.every((leg) => leg.src === 'TMAP' && (leg.geo?.length ?? 0) >= 4);
    if (hasCompleteRoadGeometry) return;
    async function run() {
      setRefining(true);
      setRefineNote('TMAP 기준으로 실경로가 없는 구간을 정밀 계산 중');
      try {
        const dest = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : null;
        const r = await refineCourses([activeCourse], origin, dest, ctx.mode, ctx.remainingMin, 1);
        if (!alive) return;
        if (r.courses[0]) {
          setActiveCourse(r.courses[0]);
          setRefineNote(r.ok > 0
            ? `TMAP 실경로 ${r.ok}구간 반영${r.fail ? ` · ${r.fail}구간은 직선 추정` : ''}`
            : 'TMAP 실경로를 받지 못해 직선 추정으로 표시 중');
        } else {
          setRefineNote('정밀 계산 후 시간이 부족해질 수 있어요');
        }
      } finally {
        if (alive) setRefining(false);
      }
    }
    run();
    return () => { alive = false; };
  }, []);

  return (
    <View style={s.root}>
      <KakaoRouteMap
        style={s.map}
        points={pts}
        line={line}
        segments={routeSegments}
        markers={[
          { ...origin, label: '출발지', kind: 'origin' },
          ...activeCourse.spots.map((sp) => ({ ...sp, label: sp.title, kind: 'spot' as const })),
          ...(ctx.appointment ? [{ ...target, label: ctx.appointment.label, kind: 'appointment' as const }] : []),
        ]}
      />

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.type}>{source === 'saved' ? '내 코스' : '코스 상세'} · {activeCourse.type} {activeCourse.spots.length}곳</Text>
            <Text style={s.total}>{strategyLabel(activeCourse)} · {activeCourse.bestMode === 'car' ? '차량' : activeCourse.bestMode === 'transit' ? '대중교통' : '도보'} 기준</Text>
          </View>
          {source === 'builder' ? (
            <Pressable style={s.cancelBtn} onPress={cancelBuilderCourse}>
              <Text style={s.cancelBtnTxt}>선택 취소</Text>
            </Pressable>
          ) : (
            <Pressable style={s.listBtn} onPress={() => resetToMyCourses(navigation)}>
              <Text style={s.listBtnTxt}>목록</Text>
            </Pressable>
          )}
        </View>
        {refineNote ? (
          <View style={s.preciseBox}>
            {refining ? <ActivityIndicator size="small" color={C.accent} /> : null}
            <Text style={s.preciseTxt}>{refineNote}</Text>
          </View>
        ) : null}

        {activeCourse.spots.map((sp, i) => (
          <View key={i} style={s.spot}>
            <View style={s.badge}><Text style={s.badgeTxt}>{i + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.spotName}>{sp.title}</Text>
              <Text style={s.spotMeta}>{sp.category} · 권장 체류 {sp.dwell}분 ({sp.dwellSrc}{sp.mult !== 1 ? ` ×혼잡${sp.mult}` : ''})</Text>
              <Text style={s.spotOpen}>🕒 {sp.openNote}</Text>
            </View>
          </View>
        ))}

        {walk || transit || car ? (
          <View style={s.mobilityBox}>
            {walk ? (
              <View style={s.mobilityRow}>
                <Text style={s.mobilityMode}>도보</Text>
                <Text style={s.mobilityTime}>이동 {walk.moveMin}분 · 약 {walk.stayMin}분 체류 가능</Text>
              </View>
            ) : null}
            {transit ? (
              <View style={s.mobilityRow}>
                <Text style={s.mobilityMode}>대중교통</Text>
                <Text style={s.mobilityTime}>이동 {transit.moveMin}분 · 약 {transit.stayMin}분 체류 가능</Text>
              </View>
            ) : null}
            {car ? (
              <View style={s.mobilityRow}>
                <Text style={s.mobilityMode}>차량</Text>
                <Text style={s.mobilityTime}>이동 {car.moveMin}분 · 약 {car.stayMin}분 체류 가능</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={s.legRow}>{travelLegs.map((lg) => `${lg.min}분`).join('  ·  ')}</Text>

        <Text style={s.legHead}>동선 분해</Text>
        <View style={s.legBox}>
          {activeCourse.legs.map((lg, i) => (
            <Text key={i} style={s.leg}>{lg.label} — <Text style={s.legMin}>{lg.min}분</Text> <Text style={s.legSrc}>[{lg.src}]</Text></Text>
          ))}
        </View>
        <Text style={s.why}>▶ 선택한 이동수단에 따라 머물 수 있는 시간이 달라져요. 최소 30분 이상 체류 가능한 코스만 추천합니다.</Text>

        {source === 'builder' ? (
          <Pressable style={s.saveBtn} onPress={saveCurrentCourse}>
            <Text style={s.saveBtnTxt}>내 코스에 저장</Text>
          </Pressable>
        ) : null}
        <Pressable style={s.cta} onPress={startCourse}>
          <Text style={s.ctaTxt}>길찾기 시작</Text>
        </Pressable>
        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active={source === 'saved' ? 'course' : 'main'}
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  map: { width: '100%', height: 280 },
  scroll: { padding: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  type: { color: C.txt, fontWeight: '800', fontSize: 18 },
  total: { color: C.txt2, fontSize: 14, marginTop: 3 },
  cancelBtn: { borderWidth: 1, borderColor: 'rgba(255,123,114,0.45)', backgroundColor: 'rgba(255,123,114,0.08)', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 11 },
  cancelBtnTxt: { color: C.red, fontSize: 12.5, fontWeight: '900' },
  listBtn: { borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12 },
  listBtnTxt: { color: C.accent, fontSize: 12.5, fontWeight: '900' },
  preciseBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(76,194,255,0.08)', borderColor: 'rgba(76,194,255,0.22)', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  preciseTxt: { color: C.txt2, fontSize: 12.5, flex: 1 },
  spot: { flexDirection: 'row', gap: 11, alignItems: 'center', backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 9 },
  badge: { width: 26, height: 26, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: C.bg, fontWeight: '800', fontSize: 13 },
  spotName: { color: C.txt, fontSize: 15.5, fontWeight: '600' },
  spotMeta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  spotOpen: { color: C.txt2, fontSize: 12.5, marginTop: 2 },
  legRow: { color: C.muted, fontSize: 13, marginTop: 2, marginBottom: 10, paddingHorizontal: 2 },
  mobilityBox: { backgroundColor: 'rgba(76,194,255,0.08)', borderColor: 'rgba(76,194,255,0.25)', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  mobilityRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginVertical: 3 },
  mobilityMode: { color: C.accent, fontSize: 13, fontWeight: '800', width: 70 },
  mobilityTime: { color: C.txt, fontSize: 13, flex: 1, textAlign: 'right' },
  legHead: { color: C.txt2, fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 6 },
  legBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 14 },
  leg: { color: C.txt2, fontSize: 13, marginVertical: 2 },
  legMin: { color: C.txt, fontWeight: '700' },
  legSrc: { color: '#6e7d8c', fontSize: 11 },
  why: { color: C.accent, fontSize: 13.5, marginTop: 12, fontWeight: '600' },
  saveBtn: { marginTop: 18, backgroundColor: 'rgba(76,194,255,0.12)', borderColor: 'rgba(76,194,255,0.45)', borderWidth: 1, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  saveBtnTxt: { color: C.accent, fontSize: 15, fontWeight: '900' },
  cta: { marginTop: 18, backgroundColor: '#2ea043', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
