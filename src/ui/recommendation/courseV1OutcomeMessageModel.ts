import type { CourseV1OutcomeReason } from '../../engine';

/** Engine outcome codes are converted to stable, provider-free copy only at the results boundary. */
export function courseV1OutcomeMessage(reason?: CourseV1OutcomeReason): string | undefined {
  switch (reason) {
    case 'no_eligible_candidates': return '이 위치와 시간에 추천 조건을 통과한 장소가 부족해요.';
    case 'no_open_candidates': return '지금 운영 중인 추천 장소가 부족해요.';
    case 'time_budget_exceeded': return '이동과 머무름을 합쳐 도착 시각 안에 들어오는 코스를 찾지 못했어요.';
    case 'route_not_verified': return '실제 이동 경로로 가능한 코스를 확인하지 못했어요.';
    case 'route_verification_unavailable': return '지금은 이동 경로를 확인할 수 없어 추천하지 않았어요. 잠시 후 다시 시도해 주세요.';
    default: return undefined;
  }
}
