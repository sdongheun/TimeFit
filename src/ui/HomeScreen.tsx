import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToActivityRecord, resetToMyCourses, resetToProfile } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { activeCourse } = useAppFlow();
  return <View style={s.root}>
    <ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 26, paddingBottom: 112 }]}>
      <Text style={s.eyebrow}>TIMEFIT</Text>
      <Text style={s.title}>지금 남는 시간을{`\n`}정해볼까요?</Text>
      <Text style={s.copy}>도착 시간에 늦지 않도록,{`\n`}잠깐 들를 한 곳을 찾습니다.</Text>
      <Pressable style={s.primary} onPress={() => navigation.navigate('TimeSetup')}><Text style={s.primaryText}>자투리 시간 설정하기</Text></Pressable>
      {activeCourse ? <Pressable style={s.active} onPress={() => navigation.navigate('Execution', activeCourse)}><Text style={s.activeEyebrow}>진행 중인 코스</Text><Text style={s.activeTitle} numberOfLines={1}>{activeCourse.course.spots[0]?.title ?? '현재 코스'} ›</Text></Pressable> : <View style={s.placeholder}><Text style={s.placeholderText}>진행 중인 코스가 생기면 이곳에서 바로 이어갈 수 있습니다.</Text></View>}
    </ScrollView>
    <FloatingTabBar active="main" onMain={() => undefined} onCourse={() => resetToMyCourses(navigation)} onRecord={() => resetToActivityRecord(navigation)} onProfile={() => resetToProfile(navigation)} />
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22 }, eyebrow: { color: '#6eacff', fontSize: 13, fontWeight: '800' },
  title: { color: C.txt, fontSize: 37, lineHeight: 42, fontWeight: '800', marginTop: 10 }, copy: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 13 },
  primary: { minHeight: 54, marginTop: 32, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  placeholder: { marginTop: 18, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, placeholderText: { color: C.muted, fontSize: 13, lineHeight: 20 },
  active: { marginTop: 18, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }, activeEyebrow: { color: C.green, fontSize: 12, fontWeight: '800' }, activeTitle: { color: C.txt, fontSize: 16, fontWeight: '800', marginTop: 6 },
});
