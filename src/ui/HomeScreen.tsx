import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToNearbyBrowse, resetToProfile } from './mainTabNavigation';
import runtimeCatalog from '../data/busan_poi_catalog.json';
import { homeActiveCourseProjection } from './activeVerifiedCourseModel';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const placeTitles = new Map([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place.title]));

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { activeVerifiedCourse } = useAppFlow();
  const active = homeActiveCourseProjection(activeVerifiedCourse, (placeId) => placeTitles.get(placeId));
  return <View style={s.root}>
    <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 48, paddingBottom: 112 }]}>
      <Text style={s.title}>약속 전 남는 시간,{`\n`}어디 들러볼까요?</Text>
      <Text style={s.copy}>시간과 출발지를 정하면{`\n`}약속 전에 들를 코스를 찾아드려요.</Text>
      <Pressable testID="home-recommend-course" accessibilityLabel="코스 추천받기" style={s.primary} onPress={() => navigation.navigate('TimeSetup')}><Text style={s.primaryText}>코스 추천받기</Text></Pressable>
      {active.kind === 'verified' ? <Pressable
        testID="home-active-course"
        accessibilityLabel={active.accessibilityLabel}
        style={s.active}
        onPress={() => navigation.navigate(active.target, active.params)}
      >
        <Text style={s.activeEyebrow}>진행 중</Text>
        <Text style={s.activeTitle}>{active.title}</Text>
        <Text style={s.activeCopy}>중단한 단계부터 계속할 수 있어요.</Text>
        <View style={s.activeAction}><Text style={s.activeActionText}>이어서 하기</Text><Feather name="chevron-right" size={18} color={C.txt} /></View>
      </Pressable> : null}
    </ScrollView>
    <FloatingTabBar active="main" onMain={() => undefined} onCourse={() => resetToNearbyBrowse(navigation)} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => resetToProfile(navigation)} />
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22 },
  title: { color: C.txt, fontSize: 37, lineHeight: 42, fontWeight: '800' }, copy: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 14 },
  primary: { minHeight: 54, marginTop: 28, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  active: { marginTop: 32, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  activeEyebrow: { color: C.txt2, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  activeTitle: { color: C.txt, fontSize: 18, lineHeight: 25, fontWeight: '800', marginTop: 8 },
  activeCopy: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  activeAction: { minHeight: 44, marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeActionText: { color: C.txt, fontSize: 14, fontWeight: '800' },
});
