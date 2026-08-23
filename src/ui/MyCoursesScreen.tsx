import { useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { PrimaryButton } from './CommonButtons';
import { RootStackParamList, fmtHM } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToProfile } from './mainTabNavigation';
import { UI_RADIUS } from './tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'MyCourses'>;

export function MyCoursesScreen({ navigation }: Props) {
  const flow = useAppFlow();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    flow.refreshSavedCourses();
  }, []);

  const removeCourse = async (id: string) => {
    try {
      await flow.removeSavedCourse(id);
    } catch (error) {
      Alert.alert('코스 삭제 실패', error instanceof Error ? error.message : '다시 시도해 주세요.');
    }
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 18 }]}
        refreshControl={
          <RefreshControl
            refreshing={flow.isCoursesLoading}
            onRefresh={() => void flow.refreshSavedCourses()}
            tintColor={C.accent}
          />
        }
      >
        <Text style={s.h1}>내 코스</Text>
        <Text style={s.sub}>저장한 코스를 다시 확인하고 언제든 길찾기를 시작하세요.</Text>

        {/* 현재 진행 중인 코스가 있을 때 상단 하이라이트 카드 */}
        {flow.activeCourse ? (
          <View style={s.activeCard}>
            <View style={s.activeHead}>
              <View style={s.activeBadge}>
                <View style={s.activeDot} />
                <Text style={s.activeBadgeTxt}>현재 진행 중인 코스</Text>
              </View>
              <Text style={s.activeMeta}>
                {flow.activeCourse.ctx.modeLabel} · {flow.activeCourse.course.spots.length}곳
              </Text>
            </View>
            <Text style={s.activeTitle} numberOfLines={1}>
              {flow.activeCourse.course.spots.map((s) => s.title).join(' → ')}
            </Text>
            <Pressable
              style={s.activeBtn}
              onPress={() => navigation.navigate('Execution', flow.activeCourse!)}
              accessibilityRole="button"
              accessibilityLabel="진행 중인 코스로 이동"
            >
              <Feather name="navigation" size={16} color={C.onAccent} />
              <Text style={s.activeBtnTxt}>이어서 길찾기 진행하기</Text>
            </Pressable>
          </View>
        ) : null}

        {flow.isCoursesLoading && !flow.savedCourses.length ? (
          <View style={s.loadingBox}><ActivityIndicator color={C.accent} /><Text style={s.loadingTxt}>저장한 코스를 불러오는 중입니다.</Text></View>
        ) : flow.coursesError ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>코스를 불러오지 못했습니다</Text>
            <Text style={s.emptyTxt}>{flow.coursesError}</Text>
            <PrimaryButton
              title="다시 불러오기"
              onPress={() => void flow.refreshSavedCourses()}
              style={s.emptyBtnMargin}
            />
          </View>
        ) : flow.savedCourses.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>저장한 코스가 없습니다</Text>
            <Text style={s.emptyTxt}>메인에서 장소를 담아 코스를 확정하면 여기에 저장됩니다.</Text>
            <PrimaryButton
              title="코스 만들러 가기"
              onPress={() => resetToMain(navigation)}
              style={s.emptyBtnMargin}
            />
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
                    courseId: item.id,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} 길찾기 시작`}
                >
                  <View style={s.cardHead}>
                    <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.cardAction}>길찾기 시작 ›</Text>
                  </View>
                  <Text style={s.cardMeta}>
                    {item.ctx.modeLabel} · {item.course.spots.length}곳 · {fmtHM(item.ctx.startMin)}-{fmtHM(endMin)}
                  </Text>
                  <Text style={s.cardSub}>
                    이동 {item.course.mobility?.[item.ctx.mode]?.moveMin ?? item.course.totalMin}분 · 체류 가능 {item.course.mobility?.[item.ctx.mode]?.stayMin ?? '-'}분
                  </Text>
                </Pressable>
                <Pressable
                  style={s.deleteBtn}
                  onPress={() => void removeCourse(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} 삭제`}
                  hitSlop={8}
                >
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
  emptyBox: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 18 },
  loadingBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingTxt: { color: C.muted, fontSize: 13 },
  emptyTitle: { color: C.txt, fontSize: 17, fontWeight: '900' },
  emptyTxt: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  emptyBtnMargin: { marginTop: 14 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: UI_RADIUS.panel, padding: 15, marginBottom: 11 },
  cardBody: { paddingBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '900' },
  cardAction: { color: C.accent, fontSize: 13, fontWeight: '900' },
  cardMeta: { color: C.txt2, fontSize: 13, marginTop: 7, fontWeight: '700' },
  cardSub: { color: C.muted, fontSize: 12.5, marginTop: 4 },
  deleteBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,123,114,0.45)', backgroundColor: 'rgba(255,123,114,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  deleteBtnTxt: { color: C.red, fontSize: 12.5, fontWeight: '900' },
  activeCard: {
    backgroundColor: C.panel,
    borderColor: C.accent,
    borderWidth: 1.5,
    borderRadius: UI_RADIUS.media,
    padding: 16,
    marginBottom: 18,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  activeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(76,194,255,0.12)', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8 },
  activeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent },
  activeBadgeTxt: { color: C.accent, fontSize: 12, fontWeight: '900' },
  activeMeta: { color: C.muted, fontSize: 12, fontWeight: '700' },
  activeTitle: { color: C.txt, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  activeBtn: {
    minHeight: 46,
    backgroundColor: C.accent,
    borderRadius: UI_RADIUS.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeBtnTxt: { color: C.onAccent, fontSize: 14.5, fontWeight: '800' },
});
