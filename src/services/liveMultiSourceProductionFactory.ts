import type { BusanLiveEdgeInvoker, BusanLiveRequest } from './busanLiveAdapter';
import { createAuthenticatedBusanLiveInvoker, createBusanLiveAdapter } from './busanLiveAdapter';
import { createLiveMultiSourceSessionFacade } from './liveMultiSourceSessionFacade';
import type { TourApiLiveEdgeInvoker, TourApiLiveFunctionRequest } from './tourApiLiveAdapter';
import { createAuthenticatedTourApiLiveInvoker, createTourApiLiveAdapter } from './tourApiLiveAdapter';

export type LiveMultiSourceSessionAuthPort = Readonly<{
  getSession(): Promise<Readonly<{ accessToken: string; expiresAt?: number }> | null>;
}>;
export type LiveMultiSourceEdgePort = Readonly<{
  invoke(functionName: 'tourapi-live' | 'busan-live', options: Readonly<{
    body: TourApiLiveFunctionRequest | BusanLiveRequest;
    headers: Readonly<{ Authorization: string }>;
  }>): Promise<Readonly<{ data: unknown; error: unknown | null }>>;
}>;
export type LiveMultiSourceProductionUnavailable = Readonly<{
  status: 'unavailable';
  reason: 'auth_session_unavailable';
}>;

/**
 * Composes one authenticated live-source facade from an already-established
 * Supabase session. Authentication creation stays with the caller.
 */
export async function createLiveMultiSourceProductionFacade(input: Readonly<{
  auth: LiveMultiSourceSessionAuthPort;
  edge: LiveMultiSourceEdgePort;
  idFactory: () => string;
  nowEpochSeconds?: () => number;
}>) {
  let session: Awaited<ReturnType<LiveMultiSourceSessionAuthPort['getSession']>>;
  try { session = await input.auth.getSession(); } catch { return { status: 'unavailable', reason: 'auth_session_unavailable' } as const; }
  const accessToken = session?.accessToken.trim() ?? '';
  const now = input.nowEpochSeconds?.() ?? Math.floor(Date.now() / 1000);
  if (!accessToken || !Number.isFinite(now) || session?.expiresAt !== undefined && (!Number.isFinite(session.expiresAt) || session.expiresAt <= now)) {
    return { status: 'unavailable', reason: 'auth_session_unavailable' } as const;
  }

  const tourEdge: TourApiLiveEdgeInvoker = {
    invoke(functionName, options) { return input.edge.invoke(functionName, options); },
  };
  const busanEdge: BusanLiveEdgeInvoker = {
    invoke(functionName, options) { return input.edge.invoke(functionName, options); },
  };
  const tour = createTourApiLiveAdapter({ invoker: createAuthenticatedTourApiLiveInvoker({ edge: tourEdge, accessToken }) });
  const busan = createBusanLiveAdapter({ invoker: createAuthenticatedBusanLiveInvoker({ edge: busanEdge, accessToken }) });
  const facade = createLiveMultiSourceSessionFacade({ tour, busan, idFactory: input.idFactory });
  return Object.freeze({ status: 'ready' as const, facade });
}
