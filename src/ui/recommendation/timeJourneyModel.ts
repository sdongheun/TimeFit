import type { OneStopRecommendation } from './oneStop';

export type TimeJourneyModel = {
  activityMin: number;
  reserveMin: number;
  departureMin: number;
  arrivalMin: number;
};

/**
 * 추천 상태를 화면용 시간 흐름으로 정규화한다.
 * 추천은 권장 체류를, 빠듯은 최소 체류를 사용한다. 남은 시간은 항상
 * 출발 -> 이동 -> 활동 -> 이동 -> 도착 전 여유의 합으로 계산한다.
 */
export function buildTimeJourney(
  recommendation: Pick<OneStopRecommendation,
    'status' | 'approachMin' | 'onwardMin' | 'availableStayMin' | 'minimumStayMin' | 'recommendedStayMin'>,
  startMin: number,
  endMin: number,
): TimeJourneyModel {
  const wantedActivity = recommendation.status === 'recommended'
    ? recommendation.recommendedStayMin
    : recommendation.minimumStayMin;
  const activityMin = Math.max(0, Math.min(wantedActivity, recommendation.availableStayMin));
  const departureMin = startMin + recommendation.approachMin + activityMin;
  const arrivalMin = departureMin + recommendation.onwardMin;
  const reserveMin = Math.max(0, endMin - arrivalMin);

  return { activityMin, reserveMin, departureMin, arrivalMin };
}
