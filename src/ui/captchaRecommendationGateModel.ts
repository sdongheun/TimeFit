import { RouteProxyUnavailableError } from '../services/routeProxyActivatedCourseAdapter';

export type RecommendationGateDecision =
  | { kind: 'start_legacy' }
  | { kind: 'start_proxy' }
  | { kind: 'show_captcha' }
  | { kind: 'fail_missing_challenge' };

/** Public proxy flag decides the UI path; it never contains credentials or a token. */
export function recommendationGateDecision(input: { routeProxyEnabled: boolean; hasSession: boolean; hasValidChallengeUrl: boolean }): RecommendationGateDecision {
  if (!input.routeProxyEnabled) return { kind: 'start_legacy' };
  if (input.hasSession) return { kind: 'start_proxy' };
  return input.hasValidChallengeUrl ? { kind: 'show_captcha' } : { kind: 'fail_missing_challenge' };
}

export function recommendationFailureMessage(error: unknown): string {
  return error instanceof RouteProxyUnavailableError
    ? '안전 확인 또는 경로 연결을 완료하지 못했어요. 다시 시도해 주세요.'
    : `추천을 준비하지 못했어요: ${error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'}`;
}

/** Diagnostics builds may expose only the service's fixed reason, never an arbitrary Error detail. */
export function recommendationFailureDisplay(error: unknown, diagnosticsEnabled: boolean): { message: string; diagnostic: string | null } {
  return {
    message: recommendationFailureMessage(error),
    diagnostic: diagnosticsEnabled && error instanceof RouteProxyUnavailableError ? error.reason : null,
  };
}
