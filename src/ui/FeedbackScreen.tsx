import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from './nav';
import { Chip } from './Chip';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourses, resetToProfile } from './mainTabNavigation';
import { cancelCourseNotifications } from '../services/courseNotifications';
import { savePlaceFeedback } from '../services/placeFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

// 실제 체류 선택지: 예상의 0.75× / 1× / 1.5× (10분 단위 반올림)
const dwellOptions = (d: number) => {
  const r = (x: number) => Math.max(10, Math.round(x / 10) * 10);
  return [...new Set([r(d * 0.75), r(d), r(d * 1.5)])];
};

export function FeedbackScreen({ route, navigation }: Props) {
  const { course, ctx } = route.params;
  const flow = useAppFlow();
  const [ratingByContentId, setRatingByContentId] = useState<Record<string, number>>({});
  const [actualDwellByContentId, setActualDwellByContentId] = useState<Record<string, number>>({});
  const [revisitByContentId, setRevisitByContentId] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCount, setSavedCount] = useState(0);

  const canRetry = course.bufferLeftMin >= 30; // 여유가 크면 재추천 유도

  async function finish() {
    await cancelCourseNotifications();
    flow.setActiveCourse(null);
    resetToMain(navigation);
  }

  async function done() {
    if (isSaving || Object.keys(ratingByContentId).length === 0) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const count = await savePlaceFeedback({
        course,
        ratingByContentId,
        actualDwellByContentId,
        revisitByContentId,
      });
      await cancelCourseNotifications();
      flow.setActiveCourse(null);
      setSavedCount(count);
    } catch {
      setSaveError('피드백을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {savedCount > 0 ? (
          <View style={s.savedWrap}>
            <Text style={s.h1}>평가를 저장했어요</Text>
            <Text style={s.sub}>{savedCount}곳의 피드백이 이 기기에 저장되었습니다.</Text>
            <View style={s.savedBox}>
              <Text style={s.savedTitle}>다음 추천에는 바로 반영하지 않습니다.</Text>
              <Text style={s.savedTxt}>후기가 충분히 쌓인 뒤에만 장소 매력 점수에 반영해, 적은 표본으로 순위가 흔들리지 않게 합니다.</Text>
            </View>
            <Pressable style={s.cta} onPress={finish}>
              <Text style={s.ctaTxt}>메인으로 돌아가기</Text>
            </Pressable>
            <View style={{ height: 120 }} />
          </View>
        ) : <>
        <Text style={s.h1}>방문한 장소를 평가해 주세요</Text>
        <Text style={s.sub}>평가한 장소만 다음 추천 품질 개선을 위한 데이터로 저장합니다.</Text>

        {course.spots.map((sp) => (
          <View key={sp.contentId} style={s.card}>
            <Text style={s.placeName}>{sp.title}</Text>
            <Text style={s.placeMeta}>{sp.category} · 권장 체류 {sp.dwell}분</Text>

            <Text style={s.lbl}>만족도</Text>
            <View style={s.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRatingByContentId((prev) => ({ ...prev, [sp.contentId]: n }))}>
                  <Text style={[s.star, n <= (ratingByContentId[sp.contentId] ?? 0) && s.starOn]}>★</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.hr} />
            <Text style={s.lbl}>실제 체류 시간 <Text style={s.opt}>(선택)</Text></Text>
            <View style={s.row}>
              {dwellOptions(sp.dwell).map((m) => (
                <Chip key={m} active={actualDwellByContentId[sp.contentId] === m} onPress={() => setActualDwellByContentId((prev) => ({ ...prev, [sp.contentId]: m }))} text={`${m}분`} />
              ))}
            </View>

            <View style={s.hr} />
            <Text style={s.lbl}>또 가고 싶나요? <Text style={s.opt}>(선택)</Text></Text>
            <View style={s.row}>
              <Chip active={revisitByContentId[sp.contentId] === true} onPress={() => setRevisitByContentId((prev) => ({ ...prev, [sp.contentId]: true }))} text="예" />
              <Chip active={revisitByContentId[sp.contentId] === false} onPress={() => setRevisitByContentId((prev) => ({ ...prev, [sp.contentId]: false }))} text="아니오" />
            </View>
          </View>
        ))}

        {saveError ? <Text style={s.error}>{saveError}</Text> : null}
        <Pressable style={[s.cta, (!Object.keys(ratingByContentId).length || isSaving) && s.ctaOff]} disabled={!Object.keys(ratingByContentId).length || isSaving} onPress={done}>
          <Text style={s.ctaTxt}>{isSaving ? '저장 중...' : '평가 저장하고 마치기'}</Text>
        </Pressable>
        <Pressable style={s.skipBtn} disabled={isSaving} onPress={finish}>
          <Text style={s.skipTxt}>평가 없이 마치기</Text>
        </Pressable>

        {canRetry && (
          <Pressable style={s.retry} onPress={() => resetToMain(navigation)}>
            <Text style={s.retryTxt}>{ctx.appointment ? `약속까지 약 ${course.bufferLeftMin}분 남음` : `약 ${course.bufferLeftMin}분 남음`}</Text>
            <Text style={s.retryLink}>코스 더 보기 ›</Text>
          </Pressable>
        )}
        <View style={{ height: 120 }} />
        </>}
      </ScrollView>
      <FloatingTabBar
        active="course"
        onMain={() => resetToMain(navigation)}
        onCourse={() => resetToMyCourses(navigation)}
        onProfile={() => resetToProfile(navigation)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingTop: 24 },
  h1: { color: C.txt, fontSize: 23, fontWeight: '800' },
  sub: { color: C.muted, fontSize: 13.5, lineHeight: 20, marginTop: 5 },
  savedWrap: { paddingTop: 16 },
  savedBox: { backgroundColor: 'rgba(126,231,135,0.08)', borderColor: 'rgba(126,231,135,0.32)', borderWidth: 1, borderRadius: 14, padding: 15, marginTop: 18 },
  savedTitle: { color: C.green, fontSize: 14, fontWeight: '900' },
  savedTxt: { color: C.txt2, fontSize: 12.5, lineHeight: 19, marginTop: 7 },
  card: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 18 },
  placeName: { color: C.txt, fontSize: 17, fontWeight: '900' },
  placeMeta: { color: C.muted, fontSize: 12.5, marginTop: 4, marginBottom: 16 },
  lbl: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  opt: { fontWeight: '400', textTransform: 'none' },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30, color: '#3a4653' },
  starOn: { color: C.amber },
  hr: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  row: { flexDirection: 'row', gap: 8 },
  cta: { minHeight: 52, marginTop: 18, backgroundColor: C.accent, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  ctaOff: { backgroundColor: C.panel2 },
  ctaTxt: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
  error: { color: C.red, fontSize: 12.5, marginTop: 14 },
  skipBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  skipTxt: { color: C.muted, fontSize: 13, fontWeight: '700' },
  retry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(227,179,65,0.08)', borderColor: 'rgba(227,179,65,0.3)', borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 12 },
  retryTxt: { color: C.amber, fontSize: 12.5, fontWeight: '600' },
  retryLink: { color: C.accent, fontSize: 12.5, fontWeight: '700' },
});
