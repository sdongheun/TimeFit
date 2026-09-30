import type { RouteProxyAnonymousAuthPort } from '../services/routeProxyAnonymousAuth';

/** Existing Route Proxy auth adapter; no UI-owned Supabase SDK or duplicate auth implementation. */
export async function productionNearbyGuestAuthPort(): Promise<RouteProxyAnonymousAuthPort> {
  const { createSupabaseRouteProxyPorts } = await import('../services/routeProxyProductionPorts');
  return createSupabaseRouteProxyPorts().auth;
}

type PrepareResult = 'ready' | 'captcha_required' | 'failed' | 'cancelled';
type VerifyResult = 'ready' | 'failed' | 'ignored';
const usable = (session: Awaited<ReturnType<RouteProxyAnonymousAuthPort['getSession']>>) => Boolean(session?.accessToken
  && (session.expiresAt === undefined || Number.isFinite(session.expiresAt) && session.expiresAt > Math.floor(Date.now() / 1000)));

/** A fresh challenge authorizes one anonymous attempt only; its token is never retained. */
export function createNearbyGuestAuthGate(authPort: RouteProxyAnonymousAuthPort | (() => Promise<RouteProxyAnonymousAuthPort>)) {
  let generation = 0;
  let challengePending = false;
  let verifying = false;
  let closed = false;
  let portPromise: Promise<RouteProxyAnonymousAuthPort> | null = null;
  const port = () => portPromise ??= typeof authPort === 'function' ? authPort() : Promise.resolve(authPort);
  return Object.freeze({
    async prepare(): Promise<PrepareResult> {
      if (closed) return 'cancelled';
      const request = ++generation;
      challengePending = false;
      verifying = false;
      try {
        const auth = await port();
        const session = await auth.getSession();
        if (closed || request !== generation) return 'cancelled';
        if (usable(session)) return 'ready';
        challengePending = true;
        return 'captcha_required';
      } catch { return closed || request !== generation ? 'cancelled' : 'failed'; }
    },
    async verify(token: string): Promise<VerifyResult> {
      if (closed || !challengePending || verifying) return 'ignored';
      challengePending = false;
      verifying = true;
      const request = generation;
      if (!token?.trim()) return 'failed';
      try {
        const auth = await port();
        const session = await auth.getSession();
        if (closed || request !== generation) return 'ignored';
        if (usable(session)) return 'ready';
        const created = await auth.signInAnonymously(token);
        if (closed || request !== generation) return 'ignored';
        return usable(created) ? 'ready' : 'failed';
      } catch { return closed || request !== generation ? 'ignored' : 'failed'; }
    },
    cancel(): void { generation += 1; challengePending = false; verifying = false; },
    close(): void { closed = true; generation += 1; challengePending = false; verifying = false; portPromise = null; },
  });
}
