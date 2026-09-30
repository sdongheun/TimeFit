import { uuid } from 'expo-modules-core';
import { supabase } from './supabase';
import { createLiveMultiSourceProductionFacade, type LiveMultiSourceEdgePort } from './liveMultiSourceProductionFactory';
import { restoreLiveFunctionHttpError } from './liveMultiSourceProductionReceipt';

const edge: LiveMultiSourceEdgePort = {
  async invoke(functionName, options) {
    const { data, error } = await supabase.functions.invoke(functionName, options);
    const restored = error ? await restoreLiveFunctionHttpError(error, functionName) : null;
    return restored ? { data: restored, error: null } : { data: data ?? null, error };
  },
};

/** Uses only the current Supabase session and never creates another auth session. */
export function createSupabaseLiveMultiSourceFacade() {
  return createLiveMultiSourceProductionFacade({
    auth: {
      async getSession() {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ? { accessToken: data.session.access_token, expiresAt: data.session.expires_at } : null;
      },
    },
    edge,
    idFactory: () => `live-${uuid.v4()}`,
  });
}
