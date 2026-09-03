export type RecommendationInternalPolicy = 'RELEASE_ONE_STOP' | 'B12';
export type RecommendationPublicEnvironment = { diagnostics?: string; internalB12?: string };

/** B12 is an internal comparison entry, never a user-selectable recommendation setting. */
export function recommendationInternalPolicyForEnvironment(environment: RecommendationPublicEnvironment): RecommendationInternalPolicy {
  return environment.diagnostics === 'true' && environment.internalB12 === 'true' ? 'B12' : 'RELEASE_ONE_STOP';
}

export function recommendationInternalPolicyLabel(policy: RecommendationInternalPolicy): string {
  return policy === 'B12' ? '내부 정책: B12' : '내부 정책: 출시 1곳';
}
