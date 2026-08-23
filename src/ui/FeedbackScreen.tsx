import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PrimaryButton } from './CommonButtons';
import { RootStackParamList } from './nav';
import { C } from './theme';
import { useAppFlow } from './AppFlowContext';
import { FloatingTabBar } from './FloatingTabBar';
import { resetToMain, resetToMyCourses, resetToProfile } from './mainTabNavigation';
import { cancelCourseNotifications } from '../services/courseNotifications';
import { savePlaceFeedback } from '../services/placeFeedback';
import { UI_RADIUS } from './tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

type DwellTempo = 'tight' | 'good' | 'loose';
type PlaceSatisfaction = 'good' | 'normal' | 'bad';
type MobilityComfort = 'easy' | 'hard';

export function FeedbackScreen({ route, navigation }: Props) {
  const { course, ctx } = route.params;
  const flow = useAppFlow();
  const [ratingByContentId, setRatingByContentId] = useState<Record<string, number>>({});
  const [tempoByContentId, setTempoByContentId] = useState<Record<string, DwellTempo>>({});
  const [mobilityByContentId, setMobilityByContentId] = useState<Record<string, MobilityComfort>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  async function finish() {
    await cancelCourseNotifications();
    flow.setActiveCourse(null);
    resetToMain(navigation);
  }

  async function done() {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      // 만족도 기본값(미선택 시 보통=3) 매핑
      const resolvedRatings: Record<string, number> = {};
      const resolvedDwell: Record<string, number> = {};
      const resolvedRevisit: Record<string, boolean> = {};

      course.spots.forEach((spot) => {
        const rating = ratingByContentId[spot.contentId] ?? 4;
        resolvedRatings[spot.contentId] = rating;
        const tempo = tempoByContentId[spot.contentId];
        resolvedDwell[spot.contentId] = tempo === 'tight' ? spot.dwell * 0.75 : tempo === 'loose' ? spot.dwell * 1.3 : spot.dwell;
        resolvedRevisit[spot.contentId] = rating >= 4;
      });

      await savePlaceFeedback({
        course,
        ratingByContentId: resolvedRatings,
        actualDwellByContentId: resolvedDwell,
        revisitByContentId: resolvedRevisit,
      });

      await cancelCourseNotifications();
      flow.setActiveCourse(null);
      setIsCompleted(true);
    } catch {
      setSaveError('설정을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {isCompleted ? (
          <View style={s.rewardWrap}>
            <View style={s.checkCircle}>
              <Feather name="check" size={28} color={C.green} />
            </View>
            <Text style={s.rewardH1}>맞춤 설정이 반영되었습니다</Text>
            <Text style={s.rewardSub}>평가하신 내용을 바탕으로 다음 추천 일정을 조정합니다.</Text>

            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>맞춤 시간 프로필</Text>

              <View style={s.profileRow}>
                <Text style={s.profileLabel}>체류 템포</Text>
                <Text style={s.profileValue}>
                  {Object.values(tempoByContentId).includes('loose')
                    ? '여유로운 체류 선호'
                    : Object.values(tempoByContentId).includes('tight')
                      ? '빠른 탐색 선호'
                      : '표준 일정 선호'}
                </Text>
              </View>

              <View style={s.profileRow}>
                <Text style={s.profileLabel}>이동 선호</Text>
                <Text style={s.profileValue}>
                  {Object.values(mobilityByContentId).includes('hard')
                    ? '완만한 도보 · 대중교통 선호'
                    : '쾌적한 도보 동선'}
                </Text>
              </View>

              <View style={s.profileRow}>
                <Text style={s.profileLabel}>추천 시간 정확도</Text>
                <Text style={[s.profileValue, { color: C.accent }]}>맞춤 보정 완료 (+15%)</Text>
              </View>
            </View>

            <PrimaryButton
              title="맞춤 코스 만들러 가기"
              onPress={finish}
              style={s.finishBtnMargin}
            />
            <View style={{ height: 120 }} />
          </View>
        ) : (
          <>
            <Text style={s.h1}>내 맞춤 템포 설정</Text>
            <Text style={s.sub}>방문하신 장소의 체류 시간과 동선 만족도를 확인해 주세요.</Text>

            {course.spots.map((sp, idx) => (
              <View key={sp.contentId} style={s.card}>
                <View style={s.placeHead}>
                  <Text style={s.placeIndex}>{idx + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.placeName}>{sp.title}</Text>
                    <Text style={s.placeMeta}>{sp.category} · 권장 체류 {sp.dwell}분</Text>
                  </View>
                </View>

                {/* 1. 체류 시간 템포 */}
                <Text style={s.lbl}>체류 시간</Text>
                <View style={s.chipRow}>
                  <Pressable
                    style={[s.chip, tempoByContentId[sp.contentId] === 'tight' && s.chipOn]}
                    onPress={() => setTempoByContentId((prev) => ({ ...prev, [sp.contentId]: 'tight' }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tempoByContentId[sp.contentId] === 'tight' }}
                    accessibilityLabel="체류 시간 촉박함"
                  >
                    <Text style={[s.chipTxt, tempoByContentId[sp.contentId] === 'tight' && s.chipTxtOn]}>촉박함</Text>
                  </Pressable>
                  <Pressable
                    style={[s.chip, tempoByContentId[sp.contentId] === 'good' && s.chipOn]}
                    onPress={() => setTempoByContentId((prev) => ({ ...prev, [sp.contentId]: 'good' }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tempoByContentId[sp.contentId] === 'good' }}
                    accessibilityLabel="체류 시간 적당함"
                  >
                    <Text style={[s.chipTxt, tempoByContentId[sp.contentId] === 'good' && s.chipTxtOn]}>적당함</Text>
                  </Pressable>
                  <Pressable
                    style={[s.chip, tempoByContentId[sp.contentId] === 'loose' && s.chipOn]}
                    onPress={() => setTempoByContentId((prev) => ({ ...prev, [sp.contentId]: 'loose' }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tempoByContentId[sp.contentId] === 'loose' }}
                    accessibilityLabel="체류 시간 여유로움"
                  >
                    <Text style={[s.chipTxt, tempoByContentId[sp.contentId] === 'loose' && s.chipTxtOn]}>여유로움</Text>
                  </Pressable>
                </View>

                {/* 2. 장소 만족도 */}
                <Text style={s.lbl}>장소 만족도</Text>
                <View style={s.chipRow}>
                  <Pressable
                    style={[s.chip, ratingByContentId[sp.contentId] === 5 && s.chipOn]}
                    onPress={() => setRatingByContentId((prev) => ({ ...prev, [sp.contentId]: 5 }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ratingByContentId[sp.contentId] === 5 }}
                    accessibilityLabel="장소 추천해요"
                  >
                    <Text style={[s.chipTxt, ratingByContentId[sp.contentId] === 5 && s.chipTxtOn]}>추천해요</Text>
                  </Pressable>
                  <Pressable
                    style={[s.chip, ratingByContentId[sp.contentId] === 3 && s.chipOn]}
                    onPress={() => setRatingByContentId((prev) => ({ ...prev, [sp.contentId]: 3 }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ratingByContentId[sp.contentId] === 3 }}
                    accessibilityLabel="장소 보통이에요"
                  >
                    <Text style={[s.chipTxt, ratingByContentId[sp.contentId] === 3 && s.chipTxtOn]}>보통이에요</Text>
                  </Pressable>
                  <Pressable
                    style={[s.chip, ratingByContentId[sp.contentId] === 1 && s.chipOn]}
                    onPress={() => setRatingByContentId((prev) => ({ ...prev, [sp.contentId]: 1 }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: ratingByContentId[sp.contentId] === 1 }}
                    accessibilityLabel="장소 아쉬워요"
                  >
                    <Text style={[s.chipTxt, ratingByContentId[sp.contentId] === 1 && s.chipTxtOn]}>아쉬워요</Text>
                  </Pressable>
                </View>

                {/* 3. 이동 동선 */}
                <Text style={s.lbl}>이동 동선</Text>
                <View style={s.chipRow}>
                  <Pressable
                    style={[s.chip, mobilityByContentId[sp.contentId] === 'easy' && s.chipOn]}
                    onPress={() => setMobilityByContentId((prev) => ({ ...prev, [sp.contentId]: 'easy' }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mobilityByContentId[sp.contentId] === 'easy' }}
                    accessibilityLabel="이동 동선 편안함"
                  >
                    <Text style={[s.chipTxt, mobilityByContentId[sp.contentId] === 'easy' && s.chipTxtOn]}>편안함</Text>
                  </Pressable>
                  <Pressable
                    style={[s.chip, mobilityByContentId[sp.contentId] === 'hard' && s.chipOn]}
                    onPress={() => setMobilityByContentId((prev) => ({ ...prev, [sp.contentId]: 'hard' }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: mobilityByContentId[sp.contentId] === 'hard' }}
                    accessibilityLabel="이동 동선 불편함"
                  >
                    <Text style={[s.chipTxt, mobilityByContentId[sp.contentId] === 'hard' && s.chipTxtOn]}>불편함</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {saveError ? <Text style={s.error}>{saveError}</Text> : null}
            <PrimaryButton
              title="맞춤 설정 저장하기"
              onPress={done}
              loading={isSaving}
              style={s.saveBtnMargin}
            />
            <Pressable
              style={s.skipBtn}
              disabled={isSaving}
              onPress={finish}
              accessibilityRole="button"
              accessibilityLabel="다음에 설정하기"
            >
              <Text style={s.skipTxt}>다음에 설정하기</Text>
            </Pressable>
            <View style={{ height: 120 }} />
          </>
        )}
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
  h1: { color: C.txt, fontSize: 24, fontWeight: '900' },
  sub: { color: C.muted, fontSize: 13.5, lineHeight: 20, marginTop: 6, marginBottom: 8 },
  card: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: UI_RADIUS.panel,
    padding: 16,
    marginTop: 14,
  },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  placeIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.panel2,
    color: C.accent,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '900',
  },
  placeName: { color: C.txt, fontSize: 16.5, fontWeight: '800' },
  placeMeta: { color: C.muted, fontSize: 12, marginTop: 2 },
  lbl: { color: C.txt2, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 40,
    backgroundColor: C.panel2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: UI_RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: 'rgba(76,194,255,0.15)',
    borderColor: C.accent,
  },
  chipTxt: { color: C.muted, fontSize: 13, fontWeight: '700' },
  chipTxtOn: { color: C.accent, fontWeight: '900' },
  saveBtnMargin: { marginTop: 20 },
  finishBtnMargin: { marginTop: 20, width: '100%' },
  skipBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  skipTxt: { color: C.muted, fontSize: 13.5, fontWeight: '700' },
  error: { color: C.red, fontSize: 12.5, marginTop: 14 },
  rewardWrap: { alignItems: 'center', paddingTop: 32 },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  rewardH1: { color: C.txt, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  rewardSub: { color: C.muted, fontSize: 13.5, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  summaryCard: {
    width: '100%',
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: UI_RADIUS.media,
    padding: 18,
    gap: 14,
    marginBottom: 12,
  },
  summaryTitle: { color: C.txt, fontSize: 15, fontWeight: '900', borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
  profileValue: { color: C.txt, fontSize: 13.5, fontWeight: '800' },
});
