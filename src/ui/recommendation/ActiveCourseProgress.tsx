import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ActiveCourseStepRow } from '../courseConfirmActiveModel';
import { C } from '../theme';
import { CourseStepIndicator } from './CourseStepIndicator';
import type { VerifiedCourseProgressState, VerifiedCourseProgressStep } from './verifiedCourseProgressModel';

type Props = Readonly<{
  rows: readonly ActiveCourseStepRow[];
  steps: readonly VerifiedCourseProgressStep[];
  state: VerifiedCourseProgressState;
  current: VerifiedCourseProgressStep;
  map: ReactNode;
  cancelAction: ReactNode;
  startedFeedback: boolean;
}>;

/** 진행 중에는 장소 탐색 정보 대신 현재 행동과 완료 순서만 표시한다. */
export function ActiveCourseProgress({ rows, steps, state, current, map, cancelAction, startedFeedback }: Props) {
  const totalStops = steps.filter(step => step.kind === 'stay').length;
  const completedStops = rows.filter(row => row.kind === 'stay' && row.actionState === 'complete').length;
  const targetStop = Math.min(totalStops, completedStops + 1);
  const positionLabel = current.kind === 'travel' && current.isFinal
    ? '마지막 이동'
    : `${Math.max(1, targetStop)} / ${totalStops}번째 장소`;
  const statusLabel = current.kind === 'stay'
    ? '도착을 확인했어요'
    : state.routeOpened ? '이동 중이에요' : '다음 이동을 준비해요';
  const detailLabel = current.kind === 'travel'
    ? `${current.mode === 'walk' ? '도보' : '대중교통'} 약 ${current.min}분`
    : '다음 길찾기는 아래 버튼에서 시작할 수 있어요';
  const progress = state.finished ? 1 : Math.max(0, Math.min(1, state.stepIndex / Math.max(1, steps.length)));

  return <View testID="active-course-progress" style={s.root}>
    <View testID="active-course-started-banner" accessibilityLiveRegion="polite" style={s.startedBanner}>
      <View accessible={false} style={s.startedDot} />
      <Text style={s.startedText}>{startedFeedback ? '코스가 시작됐어요' : '코스 진행 중'}</Text>
    </View>
    <View style={s.progressHeading}>
      <View style={s.positionRow}><Text testID="active-course-position" style={s.position}>{positionLabel}</Text>{cancelAction}</View>
      <Text style={s.count}>{completedStops}곳 완료</Text>
      <View accessible={false} style={s.track}><View style={[s.fill, { width: `${progress * 100}%` }]} /></View>
    </View>
    {map}
    <View testID="active-course-current" accessibilityLabel={`${statusLabel}, ${current.target.label}, ${detailLabel}`} style={s.currentCard}>
      <Text style={s.kicker}>{statusLabel}</Text>
      <Text style={s.currentTitle}>{current.target.label}</Text>
      <Text style={s.currentDetail}>{detailLabel}</Text>
    </View>
    <View style={s.timelineBlock}>
      <Text style={s.timelineTitle}>코스 순서</Text>
      <View style={s.timeline}>{rows.map(row => <View key={row.key} testID={`active-course-step-${row.actionState}`} accessibilityLabel={`${row.label}, ${stateLabel(row.actionState)}`} style={[s.step, row.actionState === 'current' && s.currentStep]}>
        <View accessible={false} style={s.guide} />
        <CourseStepIndicator status={row.actionState} />
        <View style={s.stepCopy}><Text style={[s.stepLabel, row.actionState === 'future' && s.futureLabel]}>{row.label}</Text><Text style={[s.stepState, row.actionState === 'current' && s.currentState]}>{stateLabel(row.actionState)}</Text></View>
      </View>)}</View>
    </View>
  </View>;
}

function stateLabel(state: ActiveCourseStepRow['actionState']) {
  return state === 'complete' ? '완료' : state === 'current' ? '현재 단계' : '예정';
}

const s = StyleSheet.create({
  root: { gap: 16 },
  startedBanner: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: '#17283a' },
  startedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  startedText: { color: '#9dcbff', fontSize: 14, fontWeight: '800' },
  progressHeading: { gap: 9 },
  positionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  position: { flex: 1, color: C.txt, fontSize: 25, lineHeight: 32, fontWeight: '900' },
  count: { color: C.muted, fontSize: 13, fontWeight: '700' },
  track: { height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: C.panel2 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: C.accent },
  currentCard: { padding: 18, gap: 6, borderRadius: 16, borderWidth: 1, borderColor: C.accent, backgroundColor: '#17283a' },
  kicker: { color: '#9dcbff', fontSize: 13, fontWeight: '800' },
  currentTitle: { color: C.txt, fontSize: 22, lineHeight: 29, fontWeight: '900' },
  currentDetail: { color: C.txt2, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  timelineBlock: { gap: 10 },
  timelineTitle: { color: C.txt, fontSize: 18, fontWeight: '900' },
  timeline: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  step: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  currentStep: { borderLeftWidth: 3, borderLeftColor: C.accent, backgroundColor: '#17283a' },
  guide: { position: 'absolute', left: 24, top: 0, bottom: 0, width: 2, backgroundColor: '#3c526d' },
  stepCopy: { flex: 1, minWidth: 0, gap: 3 },
  stepLabel: { color: C.txt, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  futureLabel: { color: C.muted, fontWeight: '700' },
  stepState: { color: C.muted, fontSize: 12, fontWeight: '700' },
  currentState: { color: '#9dcbff' },
});
