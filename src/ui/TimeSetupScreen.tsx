import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { HourBucket, kakaoReverseGeocode, Mode, planTimeFit, reverseGeocode, timeContext } from '../engine';
import { Appointment, fmtHM, RootStackParamList } from './nav';
import { PlacePicker } from './PlacePicker';
import { C } from './theme';
import { TimeWheel } from './TimeWheel';
import { useAppFlow } from './AppFlowContext';

const MAX_MINUTES = 240;
const STEP_MINUTES = 5;
const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 / STEP_MINUTES }, (_, index) => String(index * STEP_MINUTES).padStart(2, '0'));

type Props = NativeStackScreenProps<RootStackParamList, 'TimeSetup'>;

function formatDuration(minutes: number) {
  if (minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? (rest ? `${hours}시간 ${rest}분` : `${hours}시간`) : `${rest}분`;
}

function hourBucketOf(hour: number): HourBucket {
  return hour < 11 ? '아침' : hour < 14 ? '점심' : hour < 17 ? '오후' : hour < 21 ? '저녁' : '야간';
}

function bufferFor(mode: Mode) {
  return mode === 'transit' ? 20 : mode === 'car' ? 10 : 15;
}

export function TimeSetupScreen({ navigation, route }: Props) {
  const flow = useAppFlow();
  const now = useMemo(() => timeContext(new Date()), []);
  const roundedNow = Math.min(23 * 60 + 55, Math.ceil(now.nowMin / STEP_MINUTES) * STEP_MINUTES);
  const initialDuration = route.params?.presetMin ?? 120;
  const initialEnd = Math.min(23 * 60 + 55, roundedNow + initialDuration);

  const [startHour, setStartHour] = useState(Math.floor(roundedNow / 60));
  const [startMinute, setStartMinute] = useState(roundedNow % 60);
  const [endHour, setEndHour] = useState(Math.floor(initialEnd / 60));
  const [endMinute, setEndMinute] = useState(initialEnd % 60);
  const [mode, setMode] = useState<Mode>('walk');
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [origin, setOrigin] = useState(SEOMYEON);
  const [originLabel, setOriginLabel] = useState('부산 서면(기본)');
  const [picker, setPicker] = useState<'origin' | 'appointment' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startMin = startHour * 60 + startMinute;
  const endMin = endHour * 60 + endMinute;
  const remainingMin = endMin - startMin;
  const validation = remainingMin <= 0
    ? '종료 시각이 시작 시각보다 빨라요. 종료 시각을 뒤로 옮겨 주세요.'
    : remainingMin > MAX_MINUTES
      ? '자투리 시간은 최대 4시간까지 설정할 수 있어요.'
      : '';

  const useGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('위치 권한이 허용되지 않았어요. 직접 장소를 검색해 주세요.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lon } = position.coords;
      setOrigin({ lat, lon });
      setOriginLabel('현재 위치 · 주소 확인 중');
      const address = await kakaoReverseGeocode(lat, lon) ?? await reverseGeocode(lat, lon);
      setOriginLabel(address ? `현재 위치 · ${address}` : `현재 위치 (${lat.toFixed(3)}, ${lon.toFixed(3)})`);
    } catch {
      setError('현재 위치를 가져오지 못했어요. 직접 장소를 검색해 주세요.');
    }
  };

  const run = async () => {
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const dayType = now.dayType;
      const hourBucket = hourBucketOf(startHour);
      const result = await planTimeFit({
        origin,
        destination: appointment ? { lat: appointment.lat, lon: appointment.lon } : null,
        remainingMin,
        mode,
        nowMin: startMin,
        dayType,
        hourBucket,
      });
      if (!result.courses.length) {
        setError('이 시간 안에 가능한 코스를 찾지 못했어요. 시간을 늘리거나 이동수단을 바꿔 보세요.');
        return;
      }
      const params: RootStackParamList['Results'] = {
        result,
        usedTimeLabel: `${dayType} ${fmtHM(startMin)}·${hourBucket}`,
        origin,
        ctx: {
          startMin,
          mode,
          modeLabel: mode === 'car' ? '차량' : mode === 'transit' ? '대중교통' : '도보',
          appointment,
          remainingMin,
          dayType,
          hourBucket,
          isManualTime: true,
        },
      };
      flow.setLatestResults(params);
      navigation.replace('Results', params);
    } catch (runError) {
      setError(`추천 실패: ${runError instanceof Error ? runError.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const timeCard = (
    title: string,
    hour: number,
    minute: number,
    setHour: (hour: number) => void,
    setMinute: (minute: number) => void,
    hint: string,
  ) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.cardValue}>{fmtHM(hour * 60 + minute)}</Text>
      </View>
      <View style={s.wheels}>
        <View style={s.wheelColumn}><TimeWheel values={HOURS} index={hour} onChange={setHour} /></View>
        <View style={s.wheelColumn}><TimeWheel values={MINUTES} index={minute / STEP_MINUTES} onChange={(index) => setMinute(index * STEP_MINUTES)} /></View>
      </View>
      <Text style={s.wheelHint}>{hint}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.nav}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}><Text style={s.cancel}>취소</Text></Pressable>
        <Text style={s.navTitle}>자투리 시간 설정</Text>
        <View style={s.navSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.summary}>
          <View>
            <Text style={s.summaryLabel}>쓸 수 있는 자투리</Text>
            <Text style={[s.summaryValue, validation && s.summaryValueError]}>{formatDuration(remainingMin)}</Text>
          </View>
          <View style={s.summaryRight}>
            <Text style={s.summaryTime}>{fmtHM(startMin)} → {fmtHM(endMin)}</Text>
            <Text style={s.summaryBuffer}>안전 여유 {bufferFor(mode)}분</Text>
          </View>
        </View>

        {timeCard('시작 시각', startHour, startMinute, setStartHour, setStartMinute, '위아래로 굴려서 고릅니다')}
        {timeCard('종료 시각 (약속 도착)', endHour, endMinute, setEndHour, setEndMinute, '시작 시각부터 최대 4시간까지 설정할 수 있어요')}

        <View style={s.card}>
          <Text style={s.cardTitle}>이동수단</Text>
          <View style={s.modeRow}>
            {([['walk', '도보'], ['transit', '대중교통'], ['car', '차량']] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => setMode(value)} style={[s.modeButton, mode === value && s.modeButtonSelected]}>
                <Text style={[s.modeButtonText, mode === value && s.modeButtonTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[s.card, s.placeCard]}>
          <Pressable style={s.placeRow} onPress={() => setPicker('origin')}>
            <Text style={s.placeLabel}>출발지</Text>
            <Text style={s.placeValue} numberOfLines={1}>{originLabel}</Text>
          </Pressable>
          <View style={s.separator} />
          <Pressable style={s.placeRow} onPress={() => setPicker('appointment')}>
            <Text style={s.placeLabel}>다음 일정 장소</Text>
            <Text style={s.placeValue} numberOfLines={1}>{appointment?.label ?? '없음 (왕복)'}</Text>
          </Pressable>
          <Pressable style={s.locationButton} onPress={useGps}><Text style={s.locationButtonText}>현재 위치 사용</Text></Pressable>
        </View>

        {(validation || error) ? <Text style={s.error}>{validation || error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable disabled={Boolean(validation) || loading} onPress={run} style={[s.cta, (validation || loading) && s.ctaDisabled]}>
          {loading ? <ActivityIndicator color={C.onAccent} /> : <Text style={s.ctaText}>이 시간에 갈 곳 찾기</Text>}
        </Pressable>
      </View>

      <PlacePicker
        visible={picker !== null}
        title={picker === 'origin' ? '출발지 선택' : '다음 일정 장소 선택'}
        center={picker === 'appointment' ? appointment ?? origin : origin}
        showGps={picker === 'origin'}
        onClose={() => setPicker(null)}
        onConfirm={(place) => {
          if (picker === 'appointment') setAppointment({ label: place.label, lat: place.lat, lon: place.lon });
          else {
            setOrigin({ lat: place.lat, lon: place.lon });
            setOriginLabel(place.label);
          }
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  nav: { height: 64, paddingTop: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: C.line, borderBottomWidth: 1 },
  cancel: { color: C.txt2, fontSize: 15, fontWeight: '600' },
  navTitle: { color: C.txt, fontSize: 16, fontWeight: '800' },
  navSpacer: { width: 42 },
  body: { padding: 20, paddingBottom: 28, gap: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 18 },
  summaryLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  summaryValue: { color: C.accent, fontSize: 26, fontWeight: '800', marginTop: 4 },
  summaryValueError: { color: C.red },
  summaryRight: { alignItems: 'flex-end' },
  summaryTime: { color: C.txt2, fontSize: 12.5, fontWeight: '700' },
  summaryBuffer: { color: C.muted, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: C.txt, fontSize: 15, fontWeight: '800' },
  cardValue: { color: C.accent, fontSize: 15, fontWeight: '800' },
  wheels: { flexDirection: 'row', marginTop: 8 },
  wheelColumn: { flex: 1 },
  wheelHint: { color: C.muted, fontSize: 11.5, textAlign: 'center', marginTop: 6 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  modeButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1 },
  modeButtonSelected: { borderColor: C.accent, backgroundColor: 'rgba(0,102,255,0.16)' },
  modeButtonText: { color: C.muted, fontSize: 13, fontWeight: '800' },
  modeButtonTextSelected: { color: C.txt },
  placeCard: { paddingVertical: 4 },
  placeRow: { minHeight: 60, flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  placeLabel: { color: C.muted, fontSize: 13.5, flexShrink: 0 },
  placeValue: { color: C.txt, fontSize: 14, fontWeight: '700', textAlign: 'right', flex: 1 },
  separator: { height: 1, backgroundColor: C.line },
  locationButton: { alignSelf: 'flex-end', paddingHorizontal: 2, paddingVertical: 10 },
  locationButtonText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  error: { color: C.red, fontSize: 12.5, fontWeight: '600', lineHeight: 19, paddingHorizontal: 2 },
  footer: { padding: 16, paddingBottom: 28, borderTopColor: C.line, borderTopWidth: 1, backgroundColor: C.bg },
  cta: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent },
  ctaDisabled: { backgroundColor: C.panel2 },
  ctaText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
});
