import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from './nav';
import { Chip } from './Chip';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourse, resetToProfile } from './mainTabNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

// 실제 체류 선택지: 예상의 0.75× / 1× / 1.5× (10분 단위 반올림)
const dwellOptions = (d: number) => {
  const r = (x: number) => Math.max(10, Math.round(x / 10) * 10);
  return [...new Set([r(d * 0.75), r(d), r(d * 1.5)])];
};

export function FeedbackScreen({ route, navigation }: Props) {
  const { course, ctx } = route.params;
  const flow = useAppFlow();
  const [rating, setRating] = useState(0);
  const [actual, setActual] = useState<Record<number, number>>({});
  const [revisit, setRevisit] = useState<boolean | null>(null);

  const canRetry = course.bufferLeftMin >= 30; // 여유가 크면 재추천 유도

  function done() {
    // TODO(Phase2): 피드백 저장(로컬→Supabase) → 개인화 축적. 지금은 수집 UI만.
    flow.setActiveCourse(null);
    resetToMain(navigation);
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>코스 어땠어요?</Text>
        <Text style={s.sub}>{course.spots.map((sp) => sp.title).join(' + ')}</Text>

        <View style={s.card}>
          <Text style={s.lbl}>만족도</Text>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={[s.star, n <= rating && s.starOn]}>★</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.hr} />
          <Text style={s.lbl}>실제 체류 시간 <Text style={s.opt}>(선택)</Text></Text>
          {course.spots.map((sp, i) => (
            <View key={i} style={s.dwellRow}>
              <Text style={s.dwellName} numberOfLines={1}>{sp.title}</Text>
              {dwellOptions(sp.dwell).map((m) => (
                <Chip key={m} active={actual[i] === m} onPress={() => setActual({ ...actual, [i]: m })} text={`${m}분`} />
              ))}
            </View>
          ))}

          <View style={s.hr} />
          <Text style={s.lbl}>또 가고 싶나요?</Text>
          <View style={s.row}>
            <Chip active={revisit === true} onPress={() => setRevisit(true)} text="👍 예" />
            <Chip active={revisit === false} onPress={() => setRevisit(false)} text="👎 아니오" />
          </View>
        </View>

        <Pressable style={s.cta} onPress={done}>
          <Text style={s.ctaTxt}>완료</Text>
        </Pressable>

        {canRetry && (
          <Pressable style={s.retry} onPress={() => resetToMain(navigation)}>
            <Text style={s.retryTxt}>{ctx.appointment ? `약속까지 약 ${course.bufferLeftMin}분 남음` : `약 ${course.bufferLeftMin}분 남음`}</Text>
            <Text style={s.retryLink}>코스 더 보기 ›</Text>
          </Pressable>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
      <FloatingTabBar
        active="course"
        courseEnabled={!!flow.activeCourse}
        onMain={() => resetToMain(navigation)}
        onCourse={() => flow.activeCourse && resetToMyCourse(navigation, flow.activeCourse)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 24 },
  h1: { color: C.txt, fontSize: 24, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13.5, marginTop: 3 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 18 },
  lbl: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  opt: { fontWeight: '400', textTransform: 'none' },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30, color: '#3a4653' },
  starOn: { color: C.amber },
  hr: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  dwellRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' },
  dwellName: { color: C.txt2, fontSize: 12.5, width: 86 },
  row: { flexDirection: 'row', gap: 8 },
  cta: { marginTop: 18, backgroundColor: '#2ea043', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  retry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(227,179,65,0.08)', borderColor: 'rgba(227,179,65,0.3)', borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 12 },
  retryTxt: { color: C.amber, fontSize: 12.5, fontWeight: '600' },
  retryLink: { color: C.accent, fontSize: 12.5, fontWeight: '700' },
});
