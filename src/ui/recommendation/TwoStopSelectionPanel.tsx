import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import { PlacePhoto, PlacePhotoCredit } from '../PlacePhoto';
import {
  twoStopSelectionReasonMessage,
  twoStopCandidateDurationLabel,
  type TwoStopCandidateCard,
  type ResultsCourseRegionMode,
  type TwoStopSelectionState,
} from './twoStopSelectionModel';

type Props = Readonly<{
  state: TwoStopSelectionState | null;
  pairEnabled: boolean;
  regionMode: ResultsCourseRegionMode;
  candidates: readonly TwoStopCandidateCard[];
  selectedPairCourse: TwoStopCandidateCard['course'] | null;
  onSelectCandidate(course: TwoStopCandidateCard['course']): void;
  onContinue(): void;
}>;

/** 동일 recommendation session의 controller 상태만 표시하며 API·ledger를 직접 소유하지 않는다. */
export function TwoStopSelectionPanel({ state, pairEnabled, regionMode, candidates, selectedPairCourse, onSelectCandidate, onContinue }: Props) {
  return <View style={s.root}>
    <View style={s.status}>
      <Text style={s.sectionTitle}>선택한 장소와 함께 가능한 곳</Text>
      {!pairEnabled ? <Text style={s.statusText}>이 장소는 한 곳 코스로 확인할 수 있어요</Text> : null}
      {pairEnabled && (!state || state.loading) ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color={C.accent} /><Text style={s.statusText}>함께 들를 곳을 찾고 있어요</Text></View> : null}
      {pairEnabled && state && !state.loading && state.reason ? <Text accessibilityRole="alert" style={s.statusText}>{twoStopSelectionReasonMessage(state.reason)}</Text> : null}
      {pairEnabled && regionMode === 'pair_terminal' && !state?.reason ? <Text style={s.statusText}>함께 갈 수 있는 다른 장소를 찾지 못했어요</Text> : null}
    </View>
    {regionMode === 'pair_loading' ? <View testID="two-stop-pair-skeletons" accessible={false} style={s.skeletonList}>{[0, 1, 2].map((slot) => <View key={slot} testID={`two-stop-pair-skeleton-${slot}`} pointerEvents="none" style={s.skeleton}><View style={s.skeletonMedia} /><View style={s.skeletonCopy}><View style={s.skeletonLineWide} /><View style={s.skeletonLine} /></View></View>)}</View> : null}
    {(regionMode === 'pair_loading' ? [] : candidates).map((candidate) => <TwoStopCandidate key={candidate.placeId} candidate={candidate} selected={candidate.course === selectedPairCourse} onPress={() => onSelectCandidate(candidate.course)} />)}
    {pairEnabled && state?.pageState === 'more_available' ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: state.loading, busy: state.loading }} disabled={state.loading} style={[s.more, state.loading && s.disabled]} onPress={onContinue}><Text style={s.moreText}>{state.loading ? '함께 갈 장소 확인 중…' : '함께 갈 장소 더 보기'}</Text></Pressable> : null}
  </View>;
}

function TwoStopCandidate({ candidate, selected, onPress }: { candidate: TwoStopCandidateCard; selected: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${candidate.accessibilityLabel}${selected ? ', 선택됨' : ''}`} accessibilityState={{ selected }} style={({ pressed }) => [s.card, selected && s.selected, pressed && s.pressed]} onPress={onPress}>
    <View style={s.media}><PlacePhoto place={candidate.place} fallback={<View accessible={false} style={s.placeholder}><Text style={s.placeholderText}>{candidate.activityLabel}</Text></View>} />
    </View>
    <PlacePhotoCredit place={candidate.place} />
    <View style={s.content}><Text style={s.cardEyebrow}>{selected ? '✓ 선택됨' : '함께 둘러볼 장소'}</Text><Text style={s.cardTitle}>{candidate.title}</Text><Text style={s.activity}>{candidate.activityLabel}</Text><Text style={s.duration}>{twoStopCandidateDurationLabel(candidate)}</Text></View>
  </Pressable>;
}

const s = StyleSheet.create({
  root: { gap: 12 },
  activity: { color: '#b9d8ff', fontSize: 13, fontWeight: '700' },
  status: { gap: 5, paddingTop: 6 },
  sectionTitle: { color: C.txt, fontSize: 18, fontWeight: '800' },
  statusText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  skeletonList: { gap: 12 },
  skeleton: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  skeletonMedia: { height: 126, backgroundColor: C.panel2 },
  skeletonCopy: { padding: 15, gap: 9 },
  skeletonLineWide: { width: '68%', height: 17, borderRadius: 6, backgroundColor: C.panel2 },
  skeletonLine: { width: '42%', height: 13, borderRadius: 6, backgroundColor: C.panel2 },
  card: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  selected: { borderWidth: 2, borderColor: C.accent },
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
