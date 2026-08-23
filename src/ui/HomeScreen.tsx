import { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyPopularPlaces, LatLon } from '../engine';
import { PrimaryButton } from './CommonButtons';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMyCourses, resetToProfile } from './mainTabNavigation';
import { UI_RADIUS, UI_SIZE } from './tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const QUICK_TIMES = [30, 45, 60, 90, 120];
const SEOMYEON = { lat: 35.1578, lon: 129.0594 };

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  return minutes % 60 === 0 ? `${minutes / 60}시간` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

export function HomeScreen({ navigation }: Props) {
  const { activeCourse } = useAppFlow();
  const insets = useSafeAreaInsets();
  const [currentOrigin, setCurrentOrigin] = useState<LatLon>(SEOMYEON);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted' && active) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (active && pos?.coords) {
            setCurrentOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          }
        }
      } catch {
        // 위치 실패 시 기본 서면 유지
      }
    })();
    return () => { active = false; };
  }, []);

  const popularPlaces = useMemo(() => getNearbyPopularPlaces(currentOrigin, 5), [currentOrigin]);

  const openSetup = (presetMin?: number) => navigation.navigate('TimeSetup', presetMin ? { presetMin } : undefined);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.h1}>약속까지 남은 시간,{`\n`}어떻게 쓸까요?</Text>

        <View style={s.primaryCard}>
          <Text style={s.primaryTitle}>자투리 시간을 정하면{`\n`}그 안에 다녀올 곳만 보여 드려요</Text>
          <Text style={s.primaryDescription}>이동과 체류를 더해 약속에 늦지 않는 코스를 만듭니다.</Text>
          <PrimaryButton
            title="자투리 시간 설정하기"
            onPress={() => openSetup()}
            style={s.primaryButtonMargin}
          />
        </View>

        {activeCourse ? (
          <View style={s.activeCard}>
            <View style={s.activeTextWrap}>
              <Text style={s.activeLabel}>진행 중</Text>
              <Text style={s.activeTitle} numberOfLines={1}>{activeCourse.course.spots.map((spot) => spot.title).join(' → ')}</Text>
            </View>
            <Pressable style={s.resumeButton} onPress={() => navigation.navigate('Execution', activeCourse)}>
              <Text style={s.resumeText}>이어서</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={s.sectionLabel}>지금 시각부터 바로 시작</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {QUICK_TIMES.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => openSetup(minutes)}
              style={s.quickChip}
              accessibilityRole="button"
              accessibilityLabel={`${durationLabel(minutes)} 코스 만들기`}
            >
              <Text style={s.quickChipText}>{durationLabel(minutes)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.featuredHeader}>
          <Text style={[s.sectionLabel, s.featuredLabel]}>부산에서 자주 담기는 곳</Text>
          <Text style={s.featuredSub}>
            {currentOrigin.lat >= 34.8 && currentOrigin.lat <= 35.4 && currentOrigin.lon >= 128.7 && currentOrigin.lon <= 129.4
              ? '내 주변 반경 3km 인기 장소'
              : '부산 서면 주변 인기 장소'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featuredRow}>
          {popularPlaces.map((place) => (
            <Pressable
              key={place.contentId}
              onPress={() => openSetup()}
              style={s.featuredCard}
              accessibilityLabel={`${place.title} 인기 장소`}
            >
              <View style={s.featuredVisual}>
                {place.imageUrl ? (
                  <Image source={{ uri: place.imageUrl }} style={s.featuredImage} />
                ) : (
                  <View style={s.featuredFallback}>
                    <Text style={s.featuredVisualText}>{place.category}</Text>
                  </View>
                )}
              </View>
              <Text style={s.featuredTitle} numberOfLines={1}>{place.title}</Text>
              <Text style={s.featuredCaption}>
                {place.category} · {place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)}m` : `${place.distanceKm}km`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ height: 124 }} />
      </ScrollView>
      <FloatingTabBar
        active="main"
        onMain={() => undefined}
        onCourse={() => resetToMyCourses(navigation)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20 },
  h1: { color: C.txt, fontSize: 28, lineHeight: 37, fontWeight: '800' },
  primaryCard: {
    marginTop: 20,
    borderRadius: UI_RADIUS.media,
    padding: 20,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  primaryTitle: { color: C.txt, fontSize: 18, lineHeight: 27, fontWeight: '800' },
  primaryDescription: { color: C.muted, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  primaryButtonMargin: { marginTop: 18 },
  activeCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: UI_RADIUS.media,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.line,
  },
  activeTextWrap: { flex: 1, minWidth: 0 },
  activeLabel: { color: C.green, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  activeTitle: { color: C.txt, fontSize: 15, fontWeight: '700' },
  resumeButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: UI_RADIUS.control,
    justifyContent: 'center',
    backgroundColor: C.panel2,
    borderColor: C.line,
    borderWidth: 1,
  },
  resumeText: { color: C.txt, fontSize: 13, fontWeight: '800' },
  sectionLabel: { color: C.muted, fontSize: 13, fontWeight: '700', marginTop: 26, marginBottom: 10 },
  chipRow: { gap: 8, paddingRight: 20 },
  quickChip: {
    minHeight: 40,
    paddingHorizontal: 17,
    borderRadius: UI_RADIUS.pill,
    justifyContent: 'center',
    borderColor: C.line,
    borderWidth: 1,
    backgroundColor: C.panel,
  },
  quickChipText: { color: C.txt2, fontSize: 14, fontWeight: '700' },
  featuredHeader: { marginTop: 28, marginBottom: 12 },
  featuredLabel: { marginTop: 0, marginBottom: 3, color: C.txt, fontSize: 15, fontWeight: '900' },
  featuredSub: { color: C.muted, fontSize: 12, fontWeight: '600' },
  featuredRow: { gap: 12, paddingRight: 20 },
  featuredCard: {
    width: 148,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: UI_RADIUS.panel,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  featuredVisual: { width: '100%', height: 96, backgroundColor: C.panel2, overflow: 'hidden' },
  featuredImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  featuredFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  featuredVisualText: { color: C.muted, fontSize: 12, fontWeight: '800' },
  featuredTitle: { color: C.txt, fontSize: 13.5, fontWeight: '800', marginTop: 8, paddingHorizontal: 10 },
  featuredCaption: { color: C.muted, fontSize: 11.5, marginTop: 3, paddingHorizontal: 10 },
});
