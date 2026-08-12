import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMyCourses, resetToProfile } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const QUICK_TIMES = [30, 60, 90, 120, 180, 240];
const FEATURED_PLACES = [
  { title: '전포카페거리', caption: '카페 · 거리' },
  { title: '광안리해수욕장', caption: '자연관광' },
  { title: 'F1963', caption: '문화시설' },
];

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  return minutes % 60 === 0 ? `${minutes / 60}시간` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

export function HomeScreen({ navigation }: Props) {
  const { activeCourse } = useAppFlow();
  const openSetup = (presetMin?: number) => navigation.navigate('TimeSetup', presetMin ? { presetMin } : undefined);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.h1}>약속까지 남은 시간,{`\n`}어떻게 쓸까요?</Text>

        <View style={s.primaryCard}>
          <Text style={s.primaryTitle}>자투리 시간을 정하면{`\n`}그 안에 다녀올 곳만 보여 드려요</Text>
          <Text style={s.primaryDescription}>이동과 체류를 더해 약속에 늦지 않는 코스를 만듭니다.</Text>
          <Pressable style={s.primaryButton} onPress={() => openSetup()}>
            <Text style={s.primaryButtonText}>자투리 시간 설정하기</Text>
          </Pressable>
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
            <Pressable key={minutes} onPress={() => openSetup(minutes)} style={s.quickChip}>
              <Text style={s.quickChipText}>{durationLabel(minutes)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[s.sectionLabel, s.featuredLabel]}>부산에서 자주 담기는 곳</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featuredRow}>
          {FEATURED_PLACES.map((place, index) => (
            <Pressable key={place.title} onPress={() => openSetup()} style={s.featuredCard}>
              <View style={[s.featuredVisual, index === 1 && s.featuredVisualNature, index === 2 && s.featuredVisualCulture]}>
                <Text style={s.featuredVisualText}>{place.caption}</Text>
              </View>
              <Text style={s.featuredTitle} numberOfLines={1}>{place.title}</Text>
              <Text style={s.featuredCaption}>{place.caption}</Text>
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
  scroll: { paddingTop: 68, paddingHorizontal: 20 },
  h1: { color: C.txt, fontSize: 28, lineHeight: 37, fontWeight: '800' },
  primaryCard: { marginTop: 20, borderRadius: 16, padding: 20, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  primaryTitle: { color: C.txt, fontSize: 18, lineHeight: 27, fontWeight: '800' },
  primaryDescription: { color: C.muted, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  primaryButton: { minHeight: 52, marginTop: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: C.accent },
  primaryButtonText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  activeCard: { marginTop: 12, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  activeTextWrap: { flex: 1, minWidth: 0 },
  activeLabel: { color: C.green, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  activeTitle: { color: C.txt, fontSize: 15, fontWeight: '700' },
  resumeButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', backgroundColor: C.panel2, borderColor: C.line, borderWidth: 1 },
  resumeText: { color: C.txt, fontSize: 13, fontWeight: '800' },
  sectionLabel: { color: C.muted, fontSize: 13, fontWeight: '700', marginTop: 26, marginBottom: 10 },
  chipRow: { gap: 8, paddingRight: 20 },
  quickChip: { minHeight: 40, paddingHorizontal: 17, borderRadius: 20, justifyContent: 'center', borderColor: C.line, borderWidth: 1, backgroundColor: C.panel },
  quickChipText: { color: C.txt2, fontSize: 14, fontWeight: '700' },
  featuredLabel: { marginTop: 28 },
  featuredRow: { gap: 12, paddingRight: 20 },
  featuredCard: { width: 150 },
  featuredVisual: { width: 150, height: 108, borderRadius: 12, backgroundColor: '#26364f', justifyContent: 'flex-end', padding: 12, overflow: 'hidden' },
  featuredVisualNature: { backgroundColor: '#243b36' },
  featuredVisualCulture: { backgroundColor: '#41322b' },
  featuredVisualText: { color: C.txt, fontSize: 12, fontWeight: '800' },
  featuredTitle: { color: C.txt, fontSize: 14, fontWeight: '800', marginTop: 9 },
  featuredCaption: { color: C.muted, fontSize: 12, marginTop: 3 },
});
