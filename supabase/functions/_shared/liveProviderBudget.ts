export type LiveProviderBudgetScope = 'tourapi' | 'busan_public_data';
export type LiveProviderBudgetOperation = 'catalog_page' | 'detail_intro' | 'attractions_page' | 'food_page' | 'shopping_page';
export type LiveProviderBudgetDecision = 'granted' | 'limit' | 'unconfigured' | 'unavailable';

type RpcPort = Readonly<{
  rpc(name: 'reserve_live_provider_attempt', args: Readonly<{
    p_credential_scope: LiveProviderBudgetScope;
    p_operation: LiveProviderBudgetOperation;
  }>): Promise<Readonly<{ data: unknown; error: unknown | null }>>;
}>;

/** A committed, single-row grant is the only condition that permits provider HTTP. */
export function createLiveProviderBudgetPort(input: RpcPort) {
  return Object.freeze({
    async reserve(scope: LiveProviderBudgetScope, operation: LiveProviderBudgetOperation): Promise<LiveProviderBudgetDecision> {
      try {
        const { data, error } = await input.rpc('reserve_live_provider_attempt', { p_credential_scope: scope, p_operation: operation });
        if (error || !Array.isArray(data) || data.length !== 1 || !data[0] || typeof data[0] !== 'object') return 'unavailable';
        const row = data[0] as Record<string, unknown>;
        if (row.granted === true && row.reason === 'granted') return 'granted';
        if (row.granted === false && row.reason === 'limit') return 'limit';
        if (row.granted === false && row.reason === 'unconfigured') return 'unconfigured';
      } catch { /* service-role RPC failure must not permit provider HTTP */ }
      return 'unavailable';
    },
  });
}
