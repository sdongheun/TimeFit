import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, fmtHM } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToProfile } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'MyCourses'>;

export function MyCoursesScreen({ navigation }: Props) {
  const flow = useAppFlow();
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}>
        <Text style={s.h1}>내 코스</Text>
        <Text style={s.sub}>저장한 코스를 다시 확인하고 길찾기를 시작하세요.</Text>

        {flow.savedCourses.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>저장한 코스가 없습니다</Text>
            <Text style={s.emptyTxt}>메인에서 장소를 담아 코스를 확정하면 여기에 저장됩니다.</Text>
            <Pressable style={s.emptyBtn} onPress={() => resetToMain(navigation)}>
              <Text style={s.emptyBtnTxt}>코스 만들러 가기</Text>
            </Pressable>
          </View>
        ) : (
          flow.savedCourses.map((item) => {
            const endMin = item.ctx.startMin + item.ctx.remainingMin;
            return (
              <View key={item.id} style={s.card}>
                <Pressable
                  style={s.cardBody}
                  onPress={() => navigation.navigate('Execution', {
                    course: item.course,
                    origin: item.origin,
                    ctx: item.ctx,
                  })}
                >
                  <View style={s.cardHead}>
                    <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.cardAction}>시작</Text>
                  </View>
                  <Text style={s.cardMeta}>
                    {item.ctx.modeLabel} · {item.course.spots.length}곳 · {fmtHM(item.ctx.startMin)}-{fmtHM(endMin)}
                  </Text>
                  <Text style={s.cardSub}>
                    이동 {item.course.mobility?.[item.ctx.mode]?.moveMin ?? item.course.totalMin}분 · 체류 가능 {item.course.mobility?.[item.ctx.mode]?.stayMin ?? '-'}분
                  </Text>
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => flow.removeSavedCourse(item.id)}>
                  <Text style={s.deleteBtnTxt}>삭제</Text>
                </Pressable>
              </View>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="course"
        onMain={() => resetToMain(navigation)}
        onCourse={() => undefined}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 22 },
  h1: { color: C.txt, fontSize: 30, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 14.5, marginTop: 5, marginBottom: 18 },
  emptyBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 18 },
  emptyTitle: { color: C.txt, fontSize: 17, fontWeight: '900' },
  emptyTxt: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptyBtn: { minHeight: 52, marginTop: 14, backgroundColor: C.accent, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  emptyBtnTxt: { color: C.onAccent, fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 11 },
  cardBody: { paddingBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '900' },
  cardAction: { color: C.accent, fontSize: 12.5, fontWeight: '900' },
  cardMeta: { color: C.txt2, fontSize: 13, marginTop: 7, fontWeight: '700' },
  cardSub: { color: C.muted, fontSize: 12.5, marginTop: 4 },
  deleteBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,123,114,0.45)', backgroundColor: 'rgba(255,123,114,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  deleteBtnTxt: { color: C.red, fontSize: 12.5, fontWeight: '900' },
});
