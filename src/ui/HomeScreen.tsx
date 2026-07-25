import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { Mode, planTimeFit, reverseGeocode, timeContext } from '../engine';
import { Appointment, RootStackParamList, fmtHM } from './nav';
import { PlacePicker } from './PlacePicker';
import { C } from './theme';

const SEOMYEON = { lat: 35.1578, lon: 129.0594 };

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

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
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [origin, setOrigin] = useState(SEOMYEON);
  const [locLabel, setLocLabel] = useState('부산 서면(기본)');
  const [timeTxt, setTimeTxt] = useState('');   // 비우면 실제 시각
  const [dayTxt, setDayTxt] = useState('주말');
  const [mode, setMode] = useState<Mode>('walk');
  const [picker, setPicker] = useState<'appt' | 'loc' | null>(null); // 장소 선택 모달
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 미리보기용 컨텍스트
  const remaining = Math.max(0, parseInt(remainingTxt, 10) || 0);
  const manualMin = parseTime(timeTxt);
  const nowMin = manualMin ?? timeContext(new Date()).nowMin;
  const endMin = nowMin + remaining;

  async function useGps() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocLabel('위치 권한 거부 → 서면 기본'); return; }
      const p = await Location.getCurrentPositionAsync({});
      const lat = p.coords.latitude, lon = p.coords.longitude;
      setOrigin({ lat, lon });
      setLocLabel('📍 내 위치 · 주소 확인 중…');
      const addr = await reverseGeocode(lat, lon);
      setLocLabel(addr ? `📍 내 위치 · ${addr}` : `📍 내 위치 (${lat.toFixed(3)}, ${lon.toFixed(3)})`);
    } catch { setLocLabel('위치 실패 → 서면 기본'); }
  }

  async function run() {
    setError('');
    if (!remaining) { setError('비는 시간을 분 단위 숫자로 입력하세요 (예: 120)'); return; }
    if (remaining > 240) { setError('자투리 시간은 최대 4시간(240분)까지만 입력하세요.'); return; }
    if (timeTxt.trim() && manualMin == null) { setError('테스트 시각은 HH:MM 형식으로 입력하세요 (예: 14:30)'); return; }

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
        remainingMin: remaining, mode,
        nowMin: useMin, dayType, hourBucket,
      });
      if (!result.courses.length) { setError('이 시간 안에 가능한 코스를 찾지 못했어요. 시간을 늘려보세요.'); return; }
      navigation.navigate('Results', {
        result, usedTimeLabel, origin,
        ctx: { startMin: useMin, mode, modeLabel: mode === 'car' ? '차량' : '도보', appointment, remainingMin: remaining },
      });
    } catch (e: any) {
      setError('추천 실패: ' + (e?.message ?? '알 수 없음'));
    } finally { setLoading(false); }
  }

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
          <Pressable style={[s.input, s.grow, s.field]} onPress={() => setPicker('appt')}>
            <Text style={appointment ? s.fieldVal : s.fieldPh} numberOfLines={1}>
              {appointment ? `📍 ${appointment.label}` : 'TMAP 장소·주소 검색 (탭)'}
            </Text>
          </Pressable>
          {appointment && (
            <Pressable style={s.searchBtn} onPress={() => setAppointment(null)}><Text style={s.searchBtnTxt}>✕</Text></Pressable>
          )}
        </View>
        {appointment && <Text style={s.hint}>코스 후 {appointment.label}에 {fmtHM(endMin)}까지 도착하는 경유 코스로 계산해요</Text>}

        <Text style={s.label}>이동수단</Text>
        <View style={s.modeRow}>
          <Pressable style={[s.modeBtn, mode === 'walk' && s.modeBtnOn]} onPress={() => setMode('walk')}>
            <Text style={[s.modeTitle, mode === 'walk' && s.modeTitleOn]}>도보</Text>
            <Text style={s.modeSub}>걸어서 가능한 코스</Text>
          </Pressable>
          <Pressable style={[s.modeBtn, mode === 'car' && s.modeBtnOn]} onPress={() => setMode('car')}>
            <Text style={[s.modeTitle, mode === 'car' && s.modeTitleOn]}>차량</Text>
            <Text style={s.modeSub}>자차·택시 기준</Text>
          </Pressable>
          <Pressable style={[s.modeBtn, s.modeBtnDisabled]} onPress={() => setError('대중교통 추천은 ODsay 연동 단계에서 추가할 예정입니다.')}>
            <Text style={s.modeTitle}>대중교통</Text>
            <Text style={s.modeSub}>준비중</Text>
          </Pressable>
        </View>
        <Text style={s.hint}>추천은 선택한 이동수단 기준으로 계산하고, 상세에서 도보·차량 시간을 참고로 비교해요.</Text>

        <Text style={s.label}>현재 위치</Text>
        <View style={s.locModeRow}>
          <Pressable style={s.locModeBtn} onPress={() => setPicker('loc')}>
            <Text style={s.locModeTitle}>직접 입력</Text>
            <Text style={s.locModeSub}>장소명·주소 검색</Text>
          </Pressable>
          <Pressable style={s.locModeBtn} onPress={useGps}>
            <Text style={s.locModeTitle}>현재 위치</Text>
            <Text style={s.locModeSub}>GPS 자동 찾기</Text>
          </Pressable>
        </View>
        <View style={s.searchRow}>
          <Pressable style={[s.input, s.grow, s.field]} onPress={() => setPicker('loc')}>
            <Text style={s.fieldVal} numberOfLines={1}>{locLabel}</Text>
          </Pressable>
        </View>

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

      {/* 장소 선택 모달 (약속 장소 / 현재 위치 공용) */}
      <PlacePicker
        visible={picker !== null}
        title={picker === 'appt' ? '약속 장소 선택' : '현재 위치 선택'}
        center={picker === 'appt' ? (appointment ?? origin) : origin}
        showGps={picker === 'loc'}
        onClose={() => setPicker(null)}
        onConfirm={(p) => {
          if (picker === 'appt') setAppointment({ label: p.label, lat: p.lat, lon: p.lon });
          else { setOrigin({ lat: p.lat, lon: p.lon }); setLocLabel(`📍 ${p.label}`); }
        }}
      />
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locModeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, minHeight: 68, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 10 },
  modeBtnOn: { borderColor: C.accent, backgroundColor: 'rgba(76,194,255,0.12)' },
  modeBtnDisabled: { opacity: 0.55 },
  modeTitle: { color: C.txt, fontSize: 14, fontWeight: '800' },
  modeTitleOn: { color: C.accent },
  modeSub: { color: C.muted, fontSize: 11, marginTop: 3 },
  locModeBtn: { flex: 1, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12 },
  locModeTitle: { color: C.txt, fontSize: 14, fontWeight: '800' },
  locModeSub: { color: C.muted, fontSize: 11.5, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  field: { justifyContent: 'center' },
  fieldVal: { color: C.txt, fontSize: 14.5 },
  fieldPh: { color: C.muted, fontSize: 14.5 },
  grow: { flex: 1 },
  searchBtn: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, minWidth: 52, alignItems: 'center' },
  searchBtnTxt: { color: C.accent, fontWeight: '700', fontSize: 13 },
  hint: { color: C.muted, fontSize: 12.5, marginTop: 6 },
  cta: { marginTop: 26, backgroundColor: '#2ea043', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaOff: { backgroundColor: '#1e3a26' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  err: { color: C.red, marginTop: 14 },
});
