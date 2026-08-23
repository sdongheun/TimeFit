import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getActualRouteBaselines, geocodeAddr, getNearbyPopularPlaces, HourBucket, kakaoGeocodeAddr, kakaoReverseGeocode, LatLon, planTimeFit, reverseGeocode, timeContext } from '../engine';
import { HeaderBackButton, PrimaryButton } from './CommonButtons';
import { Appointment, fmtHM, RootStackParamList } from './nav';
import { PlacePicker } from './PlacePicker';
import { C } from './theme';
import { TimeWheel } from './TimeWheel';
import { useAppFlow } from './AppFlowContext';

const MAX_MINUTES = 120;
const STEP_MINUTES = 5;
const DURATION_PRESETS = [30, 45, 60, 90, 120];
const SEOMYEON = { lat: 35.1578, lon: 129.0594 };
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 / STEP_MINUTES }, (_, index) => String(index * STEP_MINUTES).padStart(2, '0'));

type Props = NativeStackScreenProps<RootStackParamList, 'TimeSetup'>;

async function resolveLocationRoadAddress(lat: number, lon: number): Promise<{ coords: LatLon; label: string }> {
  // 1. 카카오 도로명 역지오코딩
  const kakaoRoad = await kakaoReverseGeocode(lat, lon);

  // 2. 네이티브 OS(iOS/Android) 역지오코딩
  let nativeRoad: string | null = null;
  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (addr) {
      const parts = [
        addr.region,
        addr.district || addr.city,
        addr.street,
        addr.streetNumber,
      ].filter(Boolean);
      if (parts.length >= 2) {
        nativeRoad = parts.join(' ');
      }
    }
  } catch {
    // 네이티브 지오코딩 실패 무시
  }

  // 3. TMAP 도로명 역지오코딩
  const tmapRoad = await reverseGeocode(lat, lon);

  const roadAddress = kakaoRoad || nativeRoad || tmapRoad;

  if (roadAddress) {
    // 도로명 주소 기반 정규화 좌표 조회
    const geocoded = (await kakaoGeocodeAddr(roadAddress, 1))[0] ?? (await geocodeAddr(roadAddress, 1))[0];
    return {
      coords: geocoded ? { lat: geocoded.lat, lon: geocoded.lon } : { lat, lon },
      label: `현재 위치 · ${roadAddress}`,
    };
  }

  return {
    coords: { lat, lon },
    label: `현재 위치 (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
  };
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? (rest ? `${hours}시간 ${rest}분` : `${hours}시간`) : `${rest}분`;
}

function hourBucketOf(hour: number): HourBucket {
  return hour < 11 ? '아침' : hour < 14 ? '점심' : hour < 17 ? '오후' : hour < 21 ? '저녁' : '야간';
}

export function TimeSetupScreen({ navigation, route }: Props) {
  const flow = useAppFlow();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => timeContext(new Date()), []);
  const roundedNow = Math.min(23 * 60 + 55, Math.ceil(now.nowMin / STEP_MINUTES) * STEP_MINUTES);
  const initialDuration = Math.min(MAX_MINUTES, route.params?.presetMin ?? 120);
  const initialEnd = Math.min(23 * 60 + 55, roundedNow + initialDuration);

  const [startHour, setStartHour] = useState(Math.floor(roundedNow / 60));
  const [startMinute, setStartMinute] = useState(roundedNow % 60);
  const [endHour, setEndHour] = useState(Math.floor(initialEnd / 60));
  const [endMinute, setEndMinute] = useState(initialEnd % 60);
  const [arrivalBufferMin, setArrivalBufferMin] = useState(10);
  const [showDevTimeOverride, setShowDevTimeOverride] = useState(false);
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [origin, setOrigin] = useState(SEOMYEON);
  const [originLabel, setOriginLabel] = useState('부산 서면(기본)');
  const [picker, setPicker] = useState<'origin' | 'appointment' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 현재 위치 기준 반경 3km 내 자주 찾는 인기 장소 상위 5개
  const popularPlaces = useMemo(() => getNearbyPopularPlaces(origin, 5), [origin]);

  // 화면 진입 시 위치 권한이 허용되어 있으면 자동으로 현재 위치 좌표를 도로명 주소로 변환하여 설정
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && active) {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!active) return;
          const { latitude: lat, longitude: lon } = position.coords;
          const resolved = await resolveLocationRoadAddress(lat, lon);
          if (!active) return;
          setOrigin(resolved.coords);
          setOriginLabel(resolved.label);
        }
      } catch {
        // 초기 자동 감지 실패 시 기본값(서면) 유지
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const startMin = startHour * 60 + startMinute;
  const endMin = endHour * 60 + endMinute;
  const remainingMin = endMin - startMin;
  const validation = remainingMin <= 0
    ? '종료 시각이 시작 시각보다 빨라요. 종료 시각을 뒤로 옮겨 주세요.'
    : remainingMin > MAX_MINUTES
      ? '자투리 시간은 최대 2시간까지 설정할 수 있어요.'
      : '';

  const setDurationPreset = (minutes: number) => {
    const nextEnd = Math.min(23 * 60 + 55, startMin + minutes);
    setEndHour(Math.floor(nextEnd / 60));
    setEndMinute(nextEnd % 60);
  };

  const useGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('위치 권한이 허용되지 않았어요. 직접 장소를 검색해 주세요.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lon } = position.coords;
      setOriginLabel('현재 위치 · 도로명 주소 확인 중');
      const resolved = await resolveLocationRoadAddress(lat, lon);
      setOrigin(resolved.coords);
      setOriginLabel(resolved.label);
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
      const destination = appointment ? { lat: appointment.lat, lon: appointment.lon } : null;
      const baseline = destination ? await getActualRouteBaselines(origin, destination) : null;
      const result = await planTimeFit({
        origin,
        destination,
        remainingMin,
        // 초기 지도는 세 이동수단 중 하나라도 가능한 장소를 수집한다.
        // 특정 수단을 미리 고정하지 않고, 실제 구간 수단은 장소 선택 뒤 비교한다.
        mode: 'transit',
        candidateModes: ['walk', 'transit', 'car'],
        radiusM: 8000,
        routeBaselines: baseline?.baselines,
        mapExploration: true,
        nowMin: startMin,
        dayType,
        hourBucket,
      });
      if (!result.spatialCandidates.length) {
        setError('이 시간 안에 들를 수 있는 장소를 찾지 못했어요. 약속 시각이나 장소를 다시 확인해 주세요.');
        return;
      }
      const params: RootStackParamList['Results'] = {
        result,
        usedTimeLabel: `${dayType} ${fmtHM(startMin)}·${hourBucket}`,
        origin,
        ctx: {
          startMin,
          // 코스 확정 전에는 특정 수단을 고정하지 않는다. 기존 단일 모드 엔진과의 호환을 위해
          // 기본 계산값은 대중교통으로 두고, 지도에서는 수단별 가능성을 별도 비교한다.
          mode: 'transit',
          modeLabel: '이동수단 비교',
          originLabel,
          appointment,
          remainingMin,
          dayType,
          hourBucket,
          isManualTime: showDevTimeOverride,
        },
      };
      flow.setLatestResults(params);
      // 결과에서 뒤로가면 입력값을 유지한 시간 설정 화면으로 돌아간다.
      navigation.navigate('Results', params);
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
      <View style={[s.nav, { height: insets.top + 58, paddingTop: insets.top + 6 }]}>
        <HeaderBackButton
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Home');
          }}
          accessibilityLabel="메인으로 돌아가기"
        />
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
            <Text style={s.summaryTime}>{fmtHM(startMin)} 출발 → {fmtHM(endMin)}</Text>
            <Text style={s.summaryBuffer}>도착 전 {arrivalBufferMin}분 여유 반영</Text>
          </View>
        </View>

        {/* 빠른 자투리 시간 프리셋 */}
        <View style={s.presetRow}>
          {DURATION_PRESETS.map((preset) => {
            const isSelected = remainingMin === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => setDurationPreset(preset)}
                style={[s.presetChip, isSelected && s.presetChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`${preset}분 자투리 시간 선택`}
              >
                <Text style={[s.presetChipText, isSelected && s.presetChipTextActive]}>
                  {preset < 60 ? `${preset}분` : `${preset / 60}시간`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 종료 시각 (약속 시각 / 복귀 시각) 설정 */}
        {timeCard('종료 시각 (약속 도착 / 복귀)', endHour, endMinute, setEndHour, setEndMinute, '현재 시각부터 최대 2시간(120분)까지 설정할 수 있어요')}

        {/* 약속 전 남길 시간 (도착 전 여유) 슬라이더 */}
        <View style={s.marginCard}>
          <View style={s.marginHeader}>
            <Text style={s.marginTitle}>약속 전 남길 시간 (도착 전 여유)</Text>
            <Text style={s.marginValue}>{arrivalBufferMin}분</Text>
          </View>
          <Slider
            accessibilityLabel="약속 전 남길 여유 시간 슬라이더"
            minimumValue={5}
            maximumValue={30}
            step={5}
            value={arrivalBufferMin}
            minimumTrackTintColor={C.accent}
            maximumTrackTintColor={C.line}
            thumbTintColor={C.accent}
            onValueChange={(value) => setArrivalBufferMin(Math.round(value))}
            style={s.marginSlider}
          />
          <View style={s.marginLabels}>
            <Text style={s.marginLabelText}>빠듯하게 (5분)</Text>
            <Text style={s.marginLabelText}>여유롭게 (30분)</Text>
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

        {/* TIME-01.1 개발/테스트용 시작 시각 수동 설정 토글 */}
        <View style={s.devSection}>
          <Pressable
            onPress={() => setShowDevTimeOverride((prev) => !prev)}
            style={s.devToggle}
          >
            <Text style={s.devToggleText}>
              {showDevTimeOverride ? '▼ 테스트 시작 시각 닫기' : '▶ [테스트] 시작 시각 직접 변경하기'}
            </Text>
          </Pressable>
          {showDevTimeOverride ? (
            <View style={s.devCardWrapper}>
              {timeCard('시작 시각 (테스트용)', startHour, startMinute, setStartHour, setStartMinute, '새벽, 운영시간 경계 등 테스트 시각을 직접 지정합니다')}
            </View>
          ) : null}
        </View>

        {/* 현재 위치 기준 반경 3km 내 자주 찾는 인기 장소 5개 */}
        {popularPlaces.length > 0 ? (
          <View style={s.popularSection}>
            <View style={s.popularHeader}>
              <Text style={s.popularTitle}>내 주변 자주 찾는 장소</Text>
              <Text style={s.popularSubtitle}>
                {origin.lat >= 34.8 && origin.lat <= 35.4 && origin.lon >= 128.7 && origin.lon <= 129.4
                  ? '반경 3km 내 자투리 시간에 많이 들르는 곳이에요'
                  : '부산 서면 주변 자투리 시간에 많이 들르는 인기 장소예요'}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.popularScroll}
            >
              {popularPlaces.map((place) => (
                <Pressable
                  key={place.contentId}
                  style={s.popularCard}
                  onPress={() => {
                    setAppointment({ label: place.title, lat: place.lat, lon: place.lon });
                  }}
                  accessibilityLabel={`${place.title}을 다음 일정 장소로 선택`}
                >
                  {place.imageUrl ? (
                    <Image source={{ uri: place.imageUrl }} style={s.popularImage} />
                  ) : (
                    <View style={s.popularFallbackImage}>
                      <Text style={s.popularCategoryText}>{place.category}</Text>
                    </View>
                  )}
                  <View style={s.popularInfo}>
                    <Text style={s.popularPlaceName} numberOfLines={1}>{place.title}</Text>
                    <Text style={s.popularMeta}>
                      {place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)}m` : `${place.distanceKm}km`} · 권장 {place.dwellMin}분
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {(validation || error) ? <Text style={s.error}>{validation || error}</Text> : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <PrimaryButton
          title="이 시간에 갈 곳 찾기"
          onPress={run}
          disabled={Boolean(validation)}
          loading={loading}
        />
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
  nav: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: C.line,
    borderBottomWidth: 1,
  },
  navTitle: { color: C.txt, fontSize: 16, fontWeight: '800' },
  navSpacer: { width: 42 },
  body: { padding: 20, paddingBottom: 28, gap: 12 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  summaryLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  summaryValue: { color: C.accent, fontSize: 26, fontWeight: '800', marginTop: 4 },
  summaryValueError: { color: C.red },
  summaryRight: { alignItems: 'flex-end' },
  summaryTime: { color: C.txt2, fontSize: 12.5, fontWeight: '700' },
  summaryBuffer: { color: C.muted, fontSize: 12, marginTop: 4 },
  presetRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  presetChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  presetChipText: { color: C.txt2, fontSize: 12.5, fontWeight: '700' },
  presetChipTextActive: { color: C.onAccent, fontWeight: '800' },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: C.txt, fontSize: 15, fontWeight: '800' },
  cardValue: { color: C.accent, fontSize: 15, fontWeight: '800' },
  wheels: { flexDirection: 'row', marginTop: 8 },
  wheelColumn: { flex: 1 },
  wheelHint: { color: C.muted, fontSize: 11.5, textAlign: 'center', marginTop: 6 },
  marginCard: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  marginHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  marginTitle: { color: C.txt, fontSize: 14.5, fontWeight: '800' },
  marginValue: { color: C.accent, fontSize: 15, fontWeight: '800' },
  marginSlider: { height: 36, marginHorizontal: -4 },
  marginLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  marginLabelText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  placeCard: { paddingVertical: 4 },
  placeRow: { minHeight: 60, flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  placeLabel: { color: C.muted, fontSize: 13.5, flexShrink: 0 },
  placeValue: { color: C.txt, fontSize: 14, fontWeight: '700', textAlign: 'right', flex: 1 },
  separator: { height: 1, backgroundColor: C.line },
  locationButton: { alignSelf: 'flex-end', paddingHorizontal: 2, paddingVertical: 10 },
  locationButtonText: { color: C.accent, fontSize: 13, fontWeight: '800' },
  devSection: { marginTop: 4 },
  devToggle: { paddingVertical: 6, paddingHorizontal: 4 },
  devToggleText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  devCardWrapper: { marginTop: 8 },
  popularSection: { marginTop: 6, marginBottom: 4 },
  popularHeader: { marginBottom: 10, paddingHorizontal: 2 },
  popularTitle: { color: C.txt, fontSize: 15, fontWeight: '900' },
  popularSubtitle: { color: C.muted, fontSize: 12, marginTop: 3 },
  popularScroll: { gap: 12, paddingRight: 8 },
  popularCard: {
    width: 148,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  popularImage: { width: '100%', height: 94, backgroundColor: C.panel2 },
  popularFallbackImage: { width: '100%', height: 94, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  popularCategoryText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  popularInfo: { padding: 10 },
  popularPlaceName: { color: C.txt, fontSize: 13.5, fontWeight: '800' },
  popularMeta: { color: C.muted, fontSize: 11.5, marginTop: 3 },
  error: { color: C.red, fontSize: 12.5, fontWeight: '600', lineHeight: 19, paddingHorizontal: 2 },
  footer: { padding: 16, borderTopColor: C.line, borderTopWidth: 1, backgroundColor: C.bg },
});
