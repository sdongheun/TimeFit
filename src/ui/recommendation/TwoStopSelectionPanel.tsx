import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import type { CourseV1CardSummary } from './courseV1CardDetailModel';
import { getPlacePreviewKind } from './courseV1PlacePreviewModel';
import {
  twoStopSelectionReasonMessage,
  type TwoStopCandidateCard,
  type TwoStopSelectionState,
} from './twoStopSelectionModel';

type Props = Readonly<{
  state: TwoStopSelectionState;
  firstSummary: CourseV1CardSummary;
  candidates: readonly TwoStopCandidateCard[];
  onCancel(): void;
  onStartFirst(): void;
  onSelectCandidate(course: TwoStopCandidateCard['course']): void;
  onContinue(): void;
}>;

export function TwoStopSecondaryAction({ available, onPress }: { available: boolean; onPress(): void }) {
  if (!available) return null;
  return <Pressable testID="two-stop-select-first" accessibilityRole="button" accessibilityLabel="이 장소와 함께 갈 한 곳 더 고르기" style={s.secondary} onPress={onPress}><Text style={s.secondaryText}>한 곳 더 고르기</Text></Pressable>;
}

/** 동일 recommendation session의 controller 상태만 표시하며 API·ledger를 직접 소유하지 않는다. */
export function TwoStopSelectionPanel({ state, firstSummary, candidates, onCancel, onStartFirst, onSelectCandidate, onContinue }: Props) {
  return <View style={s.root}>
    <View style={s.header}>
      <View style={s.headerCopy}><Text style={s.eyebrow}>선택한 장소</Text><Text style={s.title}>{firstSummary.place.title}</Text><Text style={s.activity}>{firstSummary.activityLabel} · 약 {firstSummary.courseMin}분 코스</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="함께 갈 장소 선택 취소" style={s.cancel} onPress={onCancel}><Text style={s.cancelText}>선택 취소</Text></Pressable>
    </View>
    <Pressable accessibilityRole="button" style={s.start} onPress={onStartFirst}><Text style={s.startText}>선택한 장소 코스 시작하기</Text></Pressable>
    <View style={s.status}>
      <Text style={s.sectionTitle}>선택한 장소와 함께 가능한 곳</Text>
      {state.loading ? <Text accessibilityLiveRegion="polite" style={s.statusText}>함께 갈 수 있는 장소 확인 중 · 현재 {candidates.length}곳</Text> : null}
      {!state.loading && state.reason ? <Text accessibilityRole="alert" style={s.statusText}>{twoStopSelectionReasonMessage(state.reason)}</Text> : null}
    </View>
    {candidates.map((candidate) => <TwoStopCandidate key={candidate.placeId} candidate={candidate} onPress={() => onSelectCandidate(candidate.course)} />)}
    {state.pageState === 'more_available' ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: state.loading, busy: state.loading }} disabled={state.loading} style={[s.more, state.loading && s.disabled]} onPress={onContinue}><Text style={s.moreText}>{state.loading ? '함께 갈 장소 확인 중…' : '함께 갈 장소 더 보기'}</Text></Pressable> : null}
  </View>;
}

function TwoStopCandidate({ candidate, onPress }: { candidate: TwoStopCandidateCard; onPress(): void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = getPlacePreviewKind(candidate.place, imageFailed);
  return <Pressable accessibilityRole="button" accessibilityLabel={candidate.accessibilityLabel} style={({ pressed }) => [s.card, pressed && s.pressed]} onPress={onPress}>
    <View style={s.media}>{preview.kind === 'image'
      ? <Image accessible={false} source={{ uri: candidate.place.imageUrl! }} style={s.image} onError={() => setImageFailed(true)} />
      : <View accessible={false} style={s.placeholder}><Text style={s.placeholderText}>{candidate.activityLabel}</Text></View>}
    </View>
    <View style={s.content}><Text style={s.cardEyebrow}>함께 둘러볼 장소</Text><Text style={s.cardTitle}>{candidate.title}</Text><Text style={s.activity}>{candidate.activityLabel}</Text><Text style={s.duration}>약 {candidate.courseMin}분 코스</Text></View>
  </Pressable>;
}

const s = StyleSheet.create({
  root: { gap: 12 },
  header: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { color: '#74b0ff', fontSize: 13, fontWeight: '800' },
  title: { color: C.txt, fontSize: 21, lineHeight: 28, fontWeight: '800' },
  activity: { color: '#b9d8ff', fontSize: 13, fontWeight: '700' },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  cancelText: { color: C.txt2, fontSize: 14, fontWeight: '800' },
  start: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent },
  startText: { color: C.onAccent, fontSize: 15, fontWeight: '800' },
  secondary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2 },
  secondaryText: { color: C.txt, fontSize: 15, fontWeight: '800' },
  status: { gap: 5, paddingTop: 6 },
  sectionTitle: { color: C.txt, fontSize: 18, fontWeight: '800' },
  statusText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  card: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  pressed: { opacity: 0.82 },
  media: { height: 126, backgroundColor: C.panel2 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#26384a' },
  placeholderText: { color: '#b9d8ff', fontSize: 15, fontWeight: '800' },
  content: { padding: 15, gap: 5 },
  cardEyebrow: { color: '#74b0ff', fontSize: 12, fontWeight: '800' },
  cardTitle: { color: C.txt, fontSize: 20, fontWeight: '800' },
  duration: { color: C.txt, fontSize: 16, fontWeight: '800', marginTop: 2 },
  more: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#4d9df5', backgroundColor: '#17283a' },
  disabled: { opacity: 0.62 },
  moreText: { color: '#9dcbff', fontSize: 15, fontWeight: '800' },
});
