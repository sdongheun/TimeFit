import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Course, refineCourses } from '../engine';
import { RootStackParamList } from './nav';
import { C } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

function strategyLabel(course: Props['route']['params']['course']): string {
  if (course.strategy === 'destination_area') return '약속지 근처';
  if (course.strategy === 'route_area') return '가는 길 중간';
  return '출발지 근처';
}

export function DetailScreen({ route, navigation }: Props) {
  const { course, origin, ctx } = route.params;
  const [activeCourse, setActiveCourse] = useState<Course>(course);
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState('');
  const target = ctx.appointment ?? origin;
  const pts = useMemo(() => [origin, ...activeCourse.spots, target], [activeCourse.spots, origin, target]);
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: Math.max(0.012, (Math.max(...lats) - Math.min(...lats)) * 1.8),
    longitudeDelta: Math.max(0.012, (Math.max(...lons) - Math.min(...lons)) * 1.8),
  };
  const travelLegs = activeCourse.legs.filter((lg) => !lg.label.startsWith('체류'));
  // TMAP 실경로(geo) 연결 — 없으면 직선 폴백
  const geoCoords = travelLegs.flatMap((lg) => lg.geo ?? []);
  const line = (geoCoords.length > 1 ? geoCoords : pts).map((p) => ({ latitude: p.lat, longitude: p.lon }));
  const walk = activeCourse.mobility?.walk;
  const car = activeCourse.mobility?.car;
  const transit = activeCourse.mobility?.transit;

  useEffect(() => {
    let alive = true;
    const alreadyPrecise = activeCourse.legs.some((lg) => lg.src === 'TMAP');
    if (alreadyPrecise) return;
    async function run() {
      setRefining(true);
      setRefineNote('TMAP 기준으로 선택한 코스만 정밀 계산 중');
      try {
        const dest = ctx.appointment ? { lat: ctx.appointment.lat, lon: ctx.appointment.lon } : null;
        const r = await refineCourses([activeCourse], origin, dest, ctx.mode, ctx.remainingMin, 1);
        if (!alive) return;
        if (r.courses[0]) {
          setActiveCourse(r.courses[0]);
          setRefineNote(r.ok > 0 ? `TMAP 정밀 계산 완료 · 호출 ${r.ok + r.fail}건` : '추정 이동시간으로 표시 중');
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
      <MapView provider={PROVIDER_DEFAULT} style={s.map} initialRegion={region}>
        <Marker coordinate={{ latitude: origin.lat, longitude: origin.lon }} title="출발지" pinColor="#4cc2ff" />
        {activeCourse.spots.map((sp, i) => (
          <Marker key={i} coordinate={{ latitude: sp.lat, longitude: sp.lon }} title={`${i + 1}. ${sp.title}`} description={`${sp.category} · 체류 ${sp.dwell}분`} />
        ))}
        {ctx.appointment && (
          <Marker coordinate={{ latitude: target.lat, longitude: target.lon }} title={`약속 · ${ctx.appointment.label}`} pinColor="#7ee787" />
        )}
        <Polyline coordinates={line} strokeColor="#4cc2ff" strokeWidth={3} />
      </MapView>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Text style={s.type}>{strategyLabel(activeCourse)} · {activeCourse.type} {activeCourse.spots.length}곳</Text>
          <Text style={s.total}>{activeCourse.bestMode === 'car' ? '차량' : activeCourse.bestMode === 'transit' ? '대중교통' : '도보'} 추천</Text>
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
          {course.legs.map((lg, i) => (
            <Text key={i} style={s.leg}>{lg.label} — <Text style={s.legMin}>{lg.min}분</Text> <Text style={s.legSrc}>[{lg.src}]</Text></Text>
          ))}
        </View>
        <Text style={s.why}>▶ 선택한 이동수단에 따라 머물 수 있는 시간이 달라져요. 최소 30분 이상 체류 가능한 코스만 추천합니다.</Text>

        <Pressable style={s.cta} onPress={() => navigation.navigate('Execution', { course: activeCourse, origin, ctx })}>
          <Text style={s.ctaTxt}>이 코스로 갈래요</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  map: { width: '100%', height: 280 },
  scroll: { padding: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  type: { color: C.txt, fontWeight: '800', fontSize: 18 },
  total: { color: C.txt2, fontSize: 14 },
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
  cta: { marginTop: 18, backgroundColor: '#2ea043', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
