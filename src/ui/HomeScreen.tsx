import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { planTimeFit, poiSearch, timeContext, Mode } from '../engine';
import { Appointment, RootStackParamList, fmtHM } from './nav';
import { C } from './theme';

const SEOMYEON = { lat: 35.1578, lon: 129.0594 };

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// 이동수단 직접 입력 → 엔진 mode 매핑 (버스·택시는 자차 시간 기준 임시)
function parseMode(txt: string): { mode: Mode; label: string; note?: string } | null {
  const t = txt.trim();
  if (!t) return null;
  if (t.includes('도보') || t.includes('걷')) return { mode: 'walk', label: '도보' };
  if (t.includes('자차') || t === '차' || t.includes('자동차')) return { mode: 'car', label: '자차' };
  if (t.includes('택시')) return { mode: 'car', label: '택시' };
  if (t.includes('버스') || t.includes('대중')) return { mode: 'car', label: '버스', note: '버스는 자차 시간 기준 임시 계산(대중교통 API 추후)' };
  return null;
}

// "14:30" / "14" → 자정 기준 분
function parseTime(txt: string): number | null {
  const m = txt.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

import type { HourBucket } from '../engine';
const hourBucketOf = (h: number): HourBucket => (h < 11 ? '아침' : h < 14 ? '점심' : h < 17 ? '오후' : h < 21 ? '저녁' : '야간');

export function HomeScreen({ navigation }: Props) {
  // 전부 직접 입력 (테스트용)
  const [remainingTxt, setRemainingTxt] = useState('120');
  const [apptTxt, setApptTxt] = useState('');
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [apptMsg, setApptMsg] = useState('');
  const [modeTxt, setModeTxt] = useState('도보');
  const [locTxt, setLocTxt] = useState('');
  const [origin, setOrigin] = useState(SEOMYEON);
  const [locLabel, setLocLabel] = useState('부산 서면(기본)');
  const [timeTxt, setTimeTxt] = useState('');   // 비우면 실제 시각
  const [dayTxt, setDayTxt] = useState('주말');
  const [searching, setSearching] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 미리보기용 컨텍스트
  const remaining = Math.max(0, parseInt(remainingTxt, 10) || 0);
  const manualMin = parseTime(timeTxt);
  const nowMin = manualMin ?? timeContext(new Date()).nowMin;
  const endMin = nowMin + remaining;

  async function searchAppt() {
    if (!apptTxt.trim()) { setAppointment(null); setApptMsg(''); return; }
    setSearching('appt');
    const p = await poiSearch(apptTxt);
    setSearching('');
    if (p) { setAppointment({ label: p.name, lat: p.lat, lon: p.lon }); setApptMsg(`📍 ${p.name} · ${p.addr}`); }
    else { setAppointment(null); setApptMsg('검색 결과 없음 — 다른 이름으로 시도'); }
  }

  async function searchLoc() {
    if (!locTxt.trim()) return;
    setSearching('loc');
    const p = await poiSearch(locTxt);
    setSearching('');
    if (p) { setOrigin({ lat: p.lat, lon: p.lon }); setLocLabel(`📍 ${p.name} · ${p.addr}`); }
    else setLocLabel('검색 결과 없음 — 다른 이름으로 시도');
  }

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
    setError('');
    const pm = parseMode(modeTxt);
    if (!remaining) { setError('비는 시간을 분 단위 숫자로 입력하세요 (예: 120)'); return; }
    if (!pm) { setError('이동수단은 도보 / 자차 / 버스 / 택시 중 하나로 입력하세요'); return; }
    if (timeTxt.trim() && manualMin == null) { setError('테스트 시각은 HH:MM 형식으로 입력하세요 (예: 14:30)'); return; }
    if (apptTxt.trim() && !appointment) { setError('약속 장소를 검색해 확정해주세요 (입력 후 검색 버튼)'); return; }

    setLoading(true);
    try {
      const real = timeContext(new Date());
      const useMin = manualMin ?? real.nowMin;
      const dayType = manualMin != null ? (dayTxt.includes('주말') || dayTxt.includes('토') || dayTxt.includes('일') ? '주말' : '평일') : real.dayType;
      const hourBucket = hourBucketOf(Math.floor(useMin / 60));
      const usedTimeLabel = `${dayType} ${fmtHM(useMin)}·${hourBucket}`;

      const result = await planTimeFit({
        origin,
        destination: appointment ? { lat: appointment.lat, lon: appointment.lon } : null,
        remainingMin: remaining, mode: pm.mode,
        nowMin: useMin, dayType, hourBucket,
      });
      if (!result.courses.length) { setError('이 시간 안에 가능한 코스를 찾지 못했어요. 시간을 늘려보세요.'); return; }
      navigation.navigate('Results', {
        result, usedTimeLabel, origin,
        ctx: { startMin: useMin, mode: pm.mode, modeLabel: pm.label, appointment, remainingMin: remaining },
      });
    } catch (e: any) {
      setError('추천 실패: ' + (e?.message ?? '알 수 없음'));
    } finally { setLoading(false); }
  }

  const pmPreview = parseMode(modeTxt);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>TimeFit</Text>
        <Text style={s.sub}>비는 시간을 입력해보세요</Text>

        {/* 시간 카드: 남은시간 + 시작/끝 미리보기 */}
        <View style={s.timeCard}>
          <Text style={s.timeLabel}>비는 시간</Text>
          <Text style={s.timeBig}>{remaining < 60 ? `${remaining}분` : remaining % 60 === 0 ? `${remaining / 60}시간` : `${Math.floor(remaining / 60)}시간 ${remaining % 60}분`}</Text>
          <View style={s.timeRow}>
            <View style={s.timeCol}>
              <Text style={[s.timeColLbl, { color: C.green }]}>시작</Text>
              <Text style={s.timeColVal}>{fmtHM(nowMin)}</Text>
            </View>
            <View style={s.timeDiv} />
            <View style={s.timeCol}>
              <Text style={[s.timeColLbl, { color: C.accent }]}>끝{appointment ? ' / 약속' : ''}</Text>
              <Text style={s.timeColVal}>{fmtHM(endMin)}</Text>
            </View>
          </View>
        </View>

        <Text style={s.label}>비는 시간 (분)</Text>
        <TextInput style={s.input} value={remainingTxt} onChangeText={setRemainingTxt}
          placeholder="예: 120" placeholderTextColor={C.muted} keyboardType="number-pad" />

        <Text style={s.label}>약속 장소 (선택 — 비우면 왕복)</Text>
        <View style={s.searchRow}>
          <TextInput style={[s.input, s.grow]} value={apptTxt} onChangeText={(t) => { setApptTxt(t); setAppointment(null); setApptMsg(''); }}
            placeholder="예: 서면역, 부산시청" placeholderTextColor={C.muted} returnKeyType="search" onSubmitEditing={searchAppt} />
          <Pressable style={s.searchBtn} onPress={searchAppt} disabled={searching === 'appt'}>
            {searching === 'appt' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>검색</Text>}
          </Pressable>
        </View>
        {apptMsg ? <Text style={[s.hint, appointment ? { color: C.green } : { color: C.amber }]}>{apptMsg}</Text> : null}
        {appointment && <Text style={s.hint}>코스 후 {appointment.label}에 {fmtHM(endMin)}까지 도착하는 경유 코스로 계산해요</Text>}

        <Text style={s.label}>이동수단 (도보 / 자차 / 버스 / 택시)</Text>
        <TextInput style={s.input} value={modeTxt} onChangeText={setModeTxt}
          placeholder="예: 도보" placeholderTextColor={C.muted} />
        {pmPreview?.note ? <Text style={[s.hint, { color: C.amber }]}>{pmPreview.note}</Text> : null}

        <Text style={s.label}>현재 위치</Text>
        <View style={s.searchRow}>
          <TextInput style={[s.input, s.grow]} value={locTxt} onChangeText={setLocTxt}
            placeholder="예: 부산역, 전포카페거리" placeholderTextColor={C.muted} returnKeyType="search" onSubmitEditing={searchLoc} />
          <Pressable style={s.searchBtn} onPress={searchLoc} disabled={searching === 'loc'}>
            {searching === 'loc' ? <ActivityIndicator size="small" color={C.accent} /> : <Text style={s.searchBtnTxt}>검색</Text>}
          </Pressable>
          <Pressable style={s.searchBtn} onPress={useGps}><Text style={s.searchBtnTxt}>GPS</Text></Pressable>
        </View>
        <Text style={s.hint}>{locLabel}</Text>

        <Text style={s.label}>🧪 테스트 시각 (비우면 실제 시각)</Text>
        <View style={s.searchRow}>
          <TextInput style={[s.input, s.grow]} value={timeTxt} onChangeText={setTimeTxt}
            placeholder="예: 14:30" placeholderTextColor={C.muted} keyboardType="numbers-and-punctuation" />
          <TextInput style={[s.input, { width: 90 }]} value={dayTxt} onChangeText={setDayTxt}
            placeholder="평일/주말" placeholderTextColor={C.muted} />
        </View>

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
  timeCard: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 18, marginTop: 20, alignItems: 'center' },
  timeLabel: { color: C.muted, fontSize: 12, letterSpacing: 1 },
  timeBig: { color: C.txt, fontSize: 40, fontWeight: '800', marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 26, marginTop: 10 },
  timeCol: { alignItems: 'center' },
  timeColLbl: { fontSize: 11, fontWeight: '700' },
  timeColVal: { color: C.txt, fontSize: 17, fontWeight: '700', marginTop: 1 },
  timeDiv: { width: 1, height: 30, backgroundColor: C.line },
  label: { color: C.txt2, fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14, color: C.txt, fontSize: 14.5 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  grow: { flex: 1 },
  searchBtn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, minWidth: 52, alignItems: 'center' },
  searchBtnTxt: { color: C.accent, fontWeight: '700', fontSize: 13 },
  hint: { color: C.muted, fontSize: 12.5, marginTop: 6 },
  cta: { marginTop: 26, backgroundColor: '#2ea043', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaOff: { backgroundColor: '#1e3a26' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  err: { color: C.red, marginTop: 14 },
});
