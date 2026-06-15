import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import * as Location from 'expo-location';
import { planTimeFit, timeContext, timeContextManual, PlanResult, Mode } from './src/engine';

const SEOMYEON = { lat: 35.1578, lon: 129.0594 }; // 기본: 부산 서면

export default function App() {
  const [remaining, setRemaining] = useState(120);
  const [mode, setMode] = useState<Mode>('walk');
  const [origin, setOrigin] = useState(SEOMYEON);
  const [locLabel, setLocLabel] = useState('부산 서면(기본)');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState('');
  // 테스트용 현재 시각 오버라이드
  const [timeOverride, setTimeOverride] = useState(false);
  const [testHour, setTestHour] = useState(14);
  const [testWeekend, setTestWeekend] = useState(true);
  const [usedTimeLabel, setUsedTimeLabel] = useState('');

  async function useGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocLabel('위치 권한 거부 → 서면 기본'); return; }
      const p = await Location.getCurrentPositionAsync({});
      setOrigin({ lat: p.coords.latitude, lon: p.coords.longitude });
      setLocLabel(`현재 위치 (${p.coords.latitude.toFixed(3)}, ${p.coords.longitude.toFixed(3)})`);
    } catch {
      setLocLabel('위치 실패 → 서면 기본');
    }
  }

  async function run() {
    setLoading(true); setError(''); setResult(null);
    try {
      const ctx = timeOverride
        ? timeContextManual(testHour, testWeekend ? '주말' : '평일')
        : timeContext(new Date());
      setUsedTimeLabel(`${ctx.dayType} ${String(Math.floor(ctx.nowMin / 60)).padStart(2, '0')}:00·${ctx.hourBucket}`);
      const res = await planTimeFit({
        origin, destination: null, remainingMin: remaining, mode,
        nowMin: ctx.nowMin, dayType: ctx.dayType, hourBucket: ctx.hourBucket,
      });
      setResult(res);
      if (!res.courses.length) setError('이 시간 안에 가능한 코스를 찾지 못했어요. 시간을 늘려보세요.');
    } catch (e: any) {
      setError('추천 실패: ' + (e?.message ?? '알 수 없음'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>TimeFit</Text>
        <Text style={s.sub}>붕 뜬 시간에 진짜 가능한 코스</Text>

        <Text style={s.label}>남은 시간</Text>
        <View style={s.row}>
          {[30, 60, 90, 120, 180].map((m) => (
            <Chip key={m} active={remaining === m} onPress={() => setRemaining(m)} text={m < 60 ? `${m}분` : `${m / 60}시간`} />
          ))}
        </View>

        <Text style={s.label}>이동수단</Text>
        <View style={s.row}>
          <Chip active={mode === 'walk'} onPress={() => setMode('walk')} text="🚶 도보" />
          <Chip active={mode === 'car'} onPress={() => setMode('car')} text="🚗 자차" />
        </View>

        <Text style={s.label}>현재 위치</Text>
        <View style={s.row}>
          <Pressable style={s.gps} onPress={useGps}><Text style={s.gpsTxt}>📍 현재 위치 사용</Text></Pressable>
        </View>
        <Text style={s.loc}>{locLabel}</Text>

        <Text style={s.label}>🧪 테스트 시각</Text>
        <View style={s.row}>
          <Chip active={!timeOverride} onPress={() => setTimeOverride(false)} text="실제 시각" />
          <Chip active={timeOverride} onPress={() => setTimeOverride(true)} text="직접 설정" />
        </View>
        {timeOverride && (
          <>
            <View style={[s.row, { marginTop: 8 }]}>
              {[9, 12, 14, 17, 20].map((h) => (
                <Chip key={h} active={testHour === h} onPress={() => setTestHour(h)} text={`${h}시`} />
              ))}
            </View>
            <View style={[s.row, { marginTop: 8 }]}>
              <Chip active={!testWeekend} onPress={() => setTestWeekend(false)} text="평일" />
              <Chip active={testWeekend} onPress={() => setTestWeekend(true)} text="주말" />
            </View>
          </>
        )}

        <Pressable style={[s.cta, loading && s.ctaOff]} onPress={run} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>가능한 코스 찾기</Text>}
        </Pressable>

        {error ? <Text style={s.err}>{error}</Text> : null}

        {result && (
          <View style={{ marginTop: 18 }}>
            <Text style={s.meta}>
              ⏱ {usedTimeLabel} · 후보 {result.candidateCount} · 영업중 {result.gatedCount} · TMAP {result.tmapOk}/{result.tmapOk + result.tmapFail} · 가용 {result.budgetMin}분(버퍼 {result.bufferMin})
            </Text>
            {result.courses.map((c, i) => (
              <View key={i} style={s.card}>
                <View style={s.cardHead}>
                  <Text style={s.cardType}>{c.type}</Text>
                  <Text style={s.cardTotal}>총 {c.totalMin}분 · 여유 {c.bufferLeftMin}분</Text>
                </View>
                {c.spots.map((sp, k) => (
                  <View key={k} style={s.spot}>
                    <Text style={s.spotName}>{sp.title}</Text>
                    <Text style={s.spotMeta}>{sp.category} · 체류 {sp.dwell}분 · {sp.openNote}</Text>
                  </View>
                ))}
                <View style={s.legBox}>
                  {c.legs.map((lg, k) => (
                    <Text key={k} style={s.leg}>{lg.label}: <Text style={s.legMin}>{lg.min}분</Text> <Text style={s.legSrc}>[{lg.src}]</Text></Text>
                  ))}
                </View>
                <Text style={s.why}>▶ 합 {c.totalMin}분 ≤ 남은 {remaining}분 — 진짜 가능</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Chip({ active, onPress, text }: { active: boolean; onPress: () => void; text: string }) {
  return (
    <Pressable style={[s.chip, active && s.chipOn]} onPress={onPress}>
      <Text style={[s.chipTxt, active && s.chipTxtOn]}>{text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1419' },
  scroll: { padding: 22, paddingTop: 64 },
  h1: { color: '#4cc2ff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: '#9aa7b4', fontSize: 15, marginTop: 2, marginBottom: 8 },
  label: { color: '#cdd9e5', fontSize: 14, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1, borderColor: '#2a3340', backgroundColor: '#171d26' },
  chipOn: { backgroundColor: '#4cc2ff', borderColor: '#4cc2ff' },
  chipTxt: { color: '#cdd9e5', fontWeight: '600' },
  chipTxtOn: { color: '#06243a' },
  gps: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 10, borderWidth: 1, borderColor: '#2a3340', backgroundColor: '#171d26' },
  gpsTxt: { color: '#cdd9e5', fontWeight: '600' },
  loc: { color: '#9aa7b4', fontSize: 12.5, marginTop: 6 },
  cta: { marginTop: 26, backgroundColor: '#2ea043', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  ctaOff: { backgroundColor: '#1e3a26' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  err: { color: '#ff7b72', marginTop: 14 },
  meta: { color: '#9aa7b4', fontSize: 12, marginBottom: 10 },
  card: { backgroundColor: '#171d26', borderColor: '#2a3340', borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardType: { color: '#7ee787', fontWeight: '800', fontSize: 16 },
  cardTotal: { color: '#cdd9e5', fontSize: 13 },
  spot: { marginBottom: 6 },
  spotName: { color: '#e6edf3', fontSize: 16, fontWeight: '700' },
  spotMeta: { color: '#9aa7b4', fontSize: 12.5, marginTop: 1 },
  legBox: { borderTopWidth: 1, borderTopColor: '#2a3340', marginTop: 8, paddingTop: 8 },
  leg: { color: '#bcc8d4', fontSize: 12.5, marginVertical: 1 },
  legMin: { color: '#e6edf3', fontWeight: '700' },
  legSrc: { color: '#6e7d8c', fontSize: 11 },
  why: { color: '#4cc2ff', fontSize: 13, marginTop: 8, fontWeight: '600' },
});
