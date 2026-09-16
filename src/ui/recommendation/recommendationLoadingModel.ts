export const RECOMMENDATION_PROGRESS_STAGES = [
  'input_ready',
  'route_port_ready',
  'verifying',
  'complete',
] as const;

export type RecommendationProgressStage = (typeof RECOMMENDATION_PROGRESS_STAGES)[number];
export type RecommendationProgressItemState = 'done' | 'current' | 'pending';

const LABELS: Readonly<Record<RecommendationProgressStage, string>> = {
  input_ready: '시간과 장소 확인',
  route_port_ready: '이동 시간 확인',
  verifying: '장소 찾기',
  complete: '코스 정리',
};

export function advanceRecommendationProgress(
  current: RecommendationProgressStage | null,
  next: RecommendationProgressStage,
): RecommendationProgressStage | null {
  if (current === 'complete') return current;
  const currentIndex = current === null ? -1 : RECOMMENDATION_PROGRESS_STAGES.indexOf(current);
  const nextIndex = RECOMMENDATION_PROGRESS_STAGES.indexOf(next);
  return nextIndex === currentIndex + 1 ? next : current;
}

export function recommendationProgressItems(current: RecommendationProgressStage | null) {
  const currentIndex = current === null ? -1 : RECOMMENDATION_PROGRESS_STAGES.indexOf(current);
  return RECOMMENDATION_PROGRESS_STAGES.map((stage, index) => ({
    stage,
    label: LABELS[stage],
    state: (current === 'complete' || index < currentIndex
      ? 'done'
      : index === currentIndex
        ? 'current'
        : 'pending') as RecommendationProgressItemState,
  }));
}
