import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { planTimeFit, timeContext, timeContextManual, Mode } from '../engine';
import { RootStackParamList } from './nav';
import { Chip } from './Chip';
import { C } from './theme';

const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const [remaining, setRemaining] = useState(120);
  const [mode, setMode] = useState<Mode>('walk');
  const [origin, setOrigin] = useState(SEOMYEON);
  const [locLabel, setLocLabel] = useState('부산 서면(기본)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeOverride, setTimeOverride] = useState(false);
  const [testHour, setTestHour] = useState(14);
  const [testWeekend, setTestWeekend] = useState(true);

  async function useGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocLabel('위치 권한 거부 → 서면 기본'); return; }
      const p = await Location.getCurrentPositionAsync({});
      setOrigin({ lat: p.coords.latitude, lon: p.coords.longitude });
      setLocLabel(`현재 위치 (${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)})`);
    } catch { setLocLabel('위치 실패 → 서면 기본'); }
  }

  async function run() {
    setLoading(true); setError('');
    try {
      const ctx = timeOverride ? timeContextManual(testHour, testWeekend ? '주말' : '평일') : timeContext(new Date());
      const usedTimeLabel = `${ctx.dayType} ${String(Math.floor(ctx.nowMin / 60)).padStart(2, '0')}:00·${ctx.hourBucket}`;
      const result = await planTimeFit({
        origin, destination: null, remainingMin: remaining, mode,
        nowMin: ctx.nowMin, dayType: ctx.dayType, hourBucket: ctx.hourBucket,
      });
      if (!result.courses.length) { setError('이 시간 안에 가능한 코스를 찾지 못했어요. 시간을 늘려보세요.'); return; }
      navigation.navigate('Results', { result, remainingMin: remaining, usedTimeLabel, origin });
    } catch (e: any) {
      setError('추천 실패: ' + (e?.message ?? '알 수 없음'));
    } finally { setLoading(false); }
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>TimeFit</Text>
        <Text style={s.sub}>붕 뜬 시간에 진짜 가능한 코스</Text>

        <Text style={s.label}>남은 시간</Text>
        <View style={s.row}>{[30, 60, 90, 120, 180].map((m) => (
          <Chip key={m} active={remaining === m} onPress={() => setRemaining(m)} text={m < 60 ? `${m}분` : `${m / 60}시간`} />
        ))}</View>

        <Text style={s.label}>이동수단</Text>
        <View style={s.row}>
          <Chip active={mode === 'walk'} onPress={() => setMode('walk')} text="🚶 도보" />
          <Chip active={mode === 'car'} onPress={() => setMode('car')} text="🚗 자차" />
        </View>

        <Text style={s.label}>현재 위치</Text>
        <View style={s.row}><Pressable style={s.gps} onPress={useGps}><Text style={s.gpsTxt}>📍 현재 위치 사용</Text></Pressable></View>
        <Text style={s.loc}>{locLabel}</Text>

        <Text style={s.label}>🧪 테스트 시각</Text>
        <View style={s.row}>
          <Chip active={!timeOverride} onPress={() => setTimeOverride(false)} text="실제 시각" />
          <Chip active={timeOverride} onPress={() => setTimeOverride(true)} text="직접 설정" />
        </View>
        {timeOverride && (<>
          <View style={[s.row, { marginTop: 8 }]}>{[9, 12, 14, 17, 20].map((h) => (
            <Chip key={h} active={testHour === h} onPress={() => setTestHour(h)} text={`${h}시`} />
          ))}</View>
          <View style={[s.row, { marginTop: 8 }]}>
            <Chip active={!testWeekend} onPress={() => setTestWeekend(false)} text="평일" />
            <Chip active={testWeekend} onPress={() => setTestWeekend(true)} text="주말" />
          </View>
        </>)}

        <Pressable style={[s.cta, loading && s.ctaOff]} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>가능한 코스 찾기</Text>}
        </Pressable>
        {error ? <Text style={s.err}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 22, paddingTop: 64 },
  h1: { color: C.accent, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: C.muted, fontSize: 15, marginTop: 2 },
  label: { color: C.txt2, fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gps: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  gpsTxt: { color: C.txt2, fontWeight: '600' },
  loc: { color: C.muted, fontSize: 12.5, marginTop: 6 },
  cta: { marginTop: 26, backgroundColor: '#2ea043', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaOff: { backgroundColor: '#1e3a26' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  err: { color: C.red, marginTop: 14 },
});
