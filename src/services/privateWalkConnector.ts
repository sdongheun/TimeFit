import type { CourseV1RouteGeometry } from '../engine/courseV1';
import type { RouteProxyAnonymousAuthPort } from './routeProxyAnonymousAuth';
import {
  createAuthenticatedRouteProxyInvoker,
  normalizeRouteProxyGeometry,
  type RouteProxyEdgeInvoker,
  type RouteProxyFunctionResponse,
  type RouteProxyReceipt,
} from './routeProxyClientAdapter';

export type PrivateWalkConnectorPoint = { lat: number; lon: number };
export type PrivateWalkConnectorReceipt = {
  newRequestStarted: boolean;
  reuse: 'new_request' | 'in_flight' | 'memory' | 'none';
};
export type PrivateWalkConnectorResult =
  | { status: 'exact_geometry'; geometry: CourseV1RouteGeometry; receipt: PrivateWalkConnectorReceipt }
  | { status: 'no_route'; receipt: PrivateWalkConnectorReceipt }
  | {
      status: 'unavailable';
      reason: 'invalid_request' | 'session_unavailable' | 'transport' | 'route_unavailable' | 'invalid_response' | 'capacity';
      receipt: PrivateWalkConnectorReceipt;
    };
export type PrivateWalkConnectorPort = {
  getConnector(from: PrivateWalkConnectorPoint, to: PrivateWalkConnectorPoint): Promise<PrivateWalkConnectorResult>;
  /** Clears only this port instance's process-memory entries; it does not cancel provider work. */
  reset(): void;
};
/** Test seam only. Keys and entries remain process memory and must never be persisted or logged. */
export type PrivateWalkConnectorMemoryCache = Map<string, unknown>;

type Outcome = PrivateWalkConnectorResult extends infer Result
  ? Result extends { receipt: PrivateWalkConnectorReceipt }
    ? Omit<Result, 'receipt'>
    : never
  : never;
type CacheEntry =
  | { kind: 'in_flight'; promise: Promise<{ outcome: Outcome; cacheable: boolean }> }
  | { kind: 'result'; outcome: Outcome; expiresAt: number };

const TTL_MS = 10 * 60 * 1_000;
const MAX_ENTRIES = 64;
const validPoint = (point: PrivateWalkConnectorPoint) => Number.isFinite(point.lat)
  && Number.isFinite(point.lon)
  && point.lat >= -90
  && point.lat <= 90
  && point.lon >= -180
  && point.lon <= 180;
const keyOf = (from: PrivateWalkConnectorPoint, to: PrivateWalkConnectorPoint) => `${from.lat},${from.lon}>${to.lat},${to.lon}`;
const receipt = (newRequestStarted: boolean, reuse: PrivateWalkConnectorReceipt['reuse']): PrivateWalkConnectorReceipt => ({ newRequestStarted, reuse });

function validReceipt(value: unknown, result: RouteProxyReceipt['result']): value is RouteProxyReceipt {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RouteProxyReceipt>;
  return candidate.result === result
    && (candidate.newProviderAttemptCount === 0 || candidate.newProviderAttemptCount === 1)
    && (candidate.reuse === 'session_hit' || candidate.reuse === 'server_cache_hit' || candidate.reuse === 'provider_attempt' || candidate.reuse === 'in_flight_reuse');
}

function normalizeOutcome(response: RouteProxyFunctionResponse): Outcome {
  if (response.status === 'ok'
    && response.mode === 'walk'
    && Number.isInteger(response.totalMin)
    && (response.totalMin ?? 0) > 0
    && validReceipt(response.receipt, 'exact')) {
    const geometry = normalizeRouteProxyGeometry(response.geometry);
    if (geometry) return { status: 'exact_geometry', geometry };
  }
  if (response.status === 'no_route' && response.mode === 'walk' && validReceipt(response.receipt, 'no_route')) {
    return { status: 'no_route' };
  }
  if (response.mode === 'walk' && validReceipt(response.receipt, 'unavailable')) {
    return { status: 'unavailable', reason: 'route_unavailable' };
  }
  return { status: 'unavailable', reason: 'invalid_response' };
}

export function createPrivateWalkConnectorPort(input: {
  auth: Pick<RouteProxyAnonymousAuthPort, 'getSession'>;
  edge: RouteProxyEdgeInvoker;
  clock?: { now(): number };
  memoryCache?: PrivateWalkConnectorMemoryCache;
}): PrivateWalkConnectorPort {
  const clock = input.clock ?? { now: () => Date.now() };
  const entries = (input.memoryCache ?? new Map<string, unknown>()) as Map<string, CacheEntry>;

  const prune = () => {
    const now = clock.now();
    for (const [key, entry] of entries) {
      if (entry.kind === 'result' && entry.expiresAt <= now) entries.delete(key);
    }
  };
  const makeRoom = () => {
    if (entries.size < MAX_ENTRIES) return true;
    for (const [key, entry] of entries) {
      if (entry.kind === 'result') {
        entries.delete(key);
        return true;
      }
    }
    return false;
  };
  const execute = async (from: PrivateWalkConnectorPoint, to: PrivateWalkConnectorPoint): Promise<{ outcome: Outcome; cacheable: boolean }> => {
    const session = await input.auth.getSession().catch(() => null);
    const accessToken = session?.accessToken.trim();
    const expired = session?.expiresAt !== undefined && session.expiresAt <= Math.floor(clock.now() / 1_000);
    if (!accessToken || expired) return { outcome: { status: 'unavailable', reason: 'session_unavailable' }, cacheable: false };
    try {
      const invoker = createAuthenticatedRouteProxyInvoker({ edge: input.edge, accessToken });
      const response = await invoker.invoke({
        mode: 'walk',
        scope: { kind: 'private_request' },
        origin: { lat: from.lat, lon: from.lon },
        destination: { lat: to.lat, lon: to.lon },
      });
      return { outcome: normalizeOutcome(response), cacheable: true };
    } catch {
      return { outcome: { status: 'unavailable', reason: 'transport' }, cacheable: true };
    }
  };

  return {
    async getConnector(from, to) {
      if (!validPoint(from) || !validPoint(to)) {
        return { status: 'unavailable', reason: 'invalid_request', receipt: receipt(false, 'none') };
      }
      prune();
      const key = keyOf(from, to);
      const existing = entries.get(key);
      if (existing?.kind === 'result') return { ...existing.outcome, receipt: receipt(false, 'memory') } as PrivateWalkConnectorResult;
      if (existing?.kind === 'in_flight') {
        const settled = await existing.promise;
        return { ...settled.outcome, receipt: receipt(false, 'in_flight') } as PrivateWalkConnectorResult;
      }
      if (!makeRoom()) return { status: 'unavailable', reason: 'capacity', receipt: receipt(false, 'none') };

      const promise = execute(from, to);
      const entry: CacheEntry = { kind: 'in_flight', promise };
      entries.set(key, entry);
      const settled = await promise;
      if (entries.get(key) === entry) {
        if (settled.cacheable) entries.set(key, { kind: 'result', outcome: settled.outcome, expiresAt: clock.now() + TTL_MS });
        else entries.delete(key);
      }
      return { ...settled.outcome, receipt: receipt(settled.cacheable, settled.cacheable ? 'new_request' : 'none') } as PrivateWalkConnectorResult;
    },
    reset() {
      entries.clear();
    },
  };
}
