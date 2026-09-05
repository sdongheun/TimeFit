import type { VerifiedCourseProgressState, VerifiedCourseProgressStep } from './recommendation/verifiedCourseProgressModel';

export type ActiveCourseStepRow = Readonly<{
  key: string;
  kind: VerifiedCourseProgressStep['kind'];
  label: string;
  actionState: 'complete' | 'current' | 'future';
}>;

/** 원본 progress step 순서를 유지하며 현재 travel 하나만 action 대상으로 표시한다. */
export function buildActiveCourseStepRows(
  steps: readonly VerifiedCourseProgressStep[],
  state: VerifiedCourseProgressState,
): readonly ActiveCourseStepRow[] {
  return steps.map((step, index) => ({
    key: step.key,
    kind: step.kind,
    label: step.kind === 'travel'
      ? `${step.target.label}까지 ${step.mode === 'walk' ? '도보' : '대중교통'} ${step.min}분`
      : `${step.target.label} ${step.stayState === 'short' ? '가볍게 둘러보기' : '장소 둘러보기'}`,
    actionState: state.finished || index < state.stepIndex
      ? 'complete'
      : index === state.stepIndex && !state.finished ? 'current' : 'future',
  }));
}
