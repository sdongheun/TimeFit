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
import { useAuth } from './AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const placeTitles = new Map([...runtimeCatalog.matched.data, ...runtimeCatalog.unmatched.data].map((place) => [place.contentId, place.title]));

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { authKind } = useAuth();
  const { activeCourse, activeVerifiedCourse } = useAppFlow();
  const active = homeActiveCourseProjection(activeVerifiedCourse, activeCourse, (placeId) => placeTitles.get(placeId));
  return <View style={s.root}>
    <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 26, paddingBottom: 112 }]}>
      <View style={s.topRow}><Text style={s.eyebrow}>TIMEFIT</Text><Pressable
        variant="icon"
        testID="home-profile-entry"
        accessibilityLabel={authKind === 'account' ? '내정보 열기' : '로그인 열기'}
        disabled={authKind === 'loading'}
        style={s.profileButton}
        onPress={() => navigation.navigate(authKind === 'account' ? 'Profile' : 'Login')}
      ><Feather name="user" size={19} color={C.accent} /></Pressable></View>
      <Text style={s.title}>지금 남는 시간을{`\n`}정해볼까요?</Text>
      <Text style={s.copy}>도착 시간에 늦지 않도록,{`\n`}잠깐 들를 한 곳을 찾습니다.</Text>
      <Pressable style={s.primary} onPress={() => navigation.navigate('TimeSetup')}><Text style={s.primaryText}>자투리 시간 설정하기</Text></Pressable>
      {active.kind === 'verified' ? <Pressable accessibilityLabel={active.accessibilityLabel} style={s.active} onPress={() => navigation.navigate(active.target, active.params)}><Text style={s.activeEyebrow}>진행 중인 코스</Text><Text style={s.activeTitle} numberOfLines={2}>{active.title} ›</Text></Pressable>
        : active.kind === 'legacy' ? <Pressable accessibilityLabel={active.accessibilityLabel} style={s.active} onPress={() => navigation.navigate(active.target, active.params)}><Text style={s.activeEyebrow}>진행 중인 코스</Text><Text style={s.activeTitle} numberOfLines={1}>{active.title} ›</Text></Pressable>
          : <View style={s.placeholder}><Text style={s.placeholderText}>진행 중인 코스가 생기면 이곳에서 바로 이어갈 수 있습니다.</Text></View>}
    </ScrollView>
    <FloatingTabBar active="main" onMain={() => undefined} onCourse={() => resetToNearbyBrowse(navigation)} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => resetToProfile(navigation)} />
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22 }, eyebrow: { color: '#6eacff', fontSize: 13, fontWeight: '800' },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, profileButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  title: { color: C.txt, fontSize: 37, lineHeight: 42, fontWeight: '800', marginTop: 10 }, copy: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 13 },
  primary: { minHeight: 54, marginTop: 32, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  placeholder: { marginTop: 26, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, placeholderText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  active: { marginTop: 26, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, activeEyebrow: { color: C.green, fontSize: 12, fontWeight: '800' }, activeTitle: { color: C.txt, fontSize: 16, fontWeight: '800', marginTop: 6 },
});
