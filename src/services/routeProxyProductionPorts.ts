import { supabase } from './supabase';
import type { RouteProxyAnonymousAuthPort } from './routeProxyAnonymousAuth';
import type { RouteProxyEdgeInvoker, RouteProxyFunctionResponse } from './routeProxyClientAdapter';
import { restoreRouteProxyHttpError } from './routeProxyProductionReceipt';

/** Production-only Supabase wrapper. It exposes neither provider credentials nor build flags. */
export function createSupabaseRouteProxyPorts(): { auth: RouteProxyAnonymousAuthPort; edge: RouteProxyEdgeInvoker } {
  return {
    auth: {
      async getSession() {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ? { accessToken: data.session.access_token, expiresAt: data.session.expires_at } : null;
      },
      async signInAnonymously(captchaToken) {
        const { data, error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
        return !error && data.session?.access_token ? { accessToken: data.session.access_token } : null;
      },
    },
    edge: {
      async invoke(functionName, options) {
        const { data, error } = await supabase.functions.invoke(functionName, options);
        const restored = error ? await restoreRouteProxyHttpError(error) : null;
        if (restored) return { data: restored, error: null };
        return { data: (data ?? null) as RouteProxyFunctionResponse | null, error };
      },
    },
  };
}
