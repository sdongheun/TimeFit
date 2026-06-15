import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { RootStackParamList } from './nav';
import { C } from './theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

export function DetailScreen({ route }: Props) {
  const { course, origin } = route.params;
  const pts = [origin, ...course.spots];
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: Math.max(0.012, (Math.max(...lats) - Math.min(...lats)) * 1.8),
    longitudeDelta: Math.max(0.012, (Math.max(...lons) - Math.min(...lons)) * 1.8),
  };
  const line = [...pts, origin].map((p) => ({ latitude: p.lat, longitude: p.lon }));

  return (
    <View style={s.root}>
      <MapView provider={PROVIDER_DEFAULT} style={s.map} initialRegion={region}>
        <Marker coordinate={{ latitude: origin.lat, longitude: origin.lon }} title="출발지" pinColor="#4cc2ff" />
        {course.spots.map((sp, i) => (
          <Marker key={i} coordinate={{ latitude: sp.lat, longitude: sp.lon }} title={`${i + 1}. ${sp.title}`} description={`${sp.category} · 체류 ${sp.dwell}분`} />
        ))}
        <Polyline coordinates={line} strokeColor="#4cc2ff" strokeWidth={3} />
      </MapView>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Text style={s.type}>{course.type}</Text>
          <Text style={s.total}>총 {course.totalMin}분 · 여유 {course.bufferLeftMin}분</Text>
        </View>

        {course.spots.map((sp, i) => (
          <View key={i} style={s.spot}>
            <Text style={s.spotName}>{i + 1}. {sp.title}</Text>
            <Text style={s.spotMeta}>{sp.category} · 체류 {sp.dwell}분 ({sp.dwellSrc}{sp.mult !== 1 ? ` ×혼잡${sp.mult}` : ''})</Text>
            <Text style={s.spotOpen}>🕒 {sp.openNote}</Text>
          </View>
        ))}

        <Text style={s.legHead}>동선 분해</Text>
        <View style={s.legBox}>
          {course.legs.map((lg, i) => (
            <Text key={i} style={s.leg}>{lg.label} — <Text style={s.legMin}>{lg.min}분</Text> <Text style={s.legSrc}>[{lg.src}]</Text></Text>
          ))}
        </View>
        <Text style={s.why}>▶ 이동+체류 합 {course.totalMin}분, 버퍼 {course.bufferLeftMin}분 여유 — 진짜 가능</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  map: { width: '100%', height: 300 },
  scroll: { padding: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  type: { color: C.green, fontWeight: '800', fontSize: 18 },
  total: { color: C.txt2, fontSize: 14 },
  spot: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  spotName: { color: C.txt, fontSize: 16, fontWeight: '700' },
  spotMeta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  spotOpen: { color: C.txt2, fontSize: 12.5, marginTop: 4 },
  legHead: { color: C.txt2, fontSize: 14, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  legBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 14 },
  leg: { color: C.txt2, fontSize: 13, marginVertical: 2 },
  legMin: { color: C.txt, fontWeight: '700' },
  legSrc: { color: '#6e7d8c', fontSize: 11 },
  why: { color: C.accent, fontSize: 13.5, marginTop: 14, fontWeight: '600' },
});
