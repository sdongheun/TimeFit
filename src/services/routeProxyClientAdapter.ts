import type { CourseV1Point, CourseV1RouteAdapter, CourseV1RouteReceipt, CourseV1RouteReceiptAdapter, CourseV1TravelMode, ExactRoute } from '../engine/courseV1';

export type RouteProxyPublicScope = { kind: 'public_segment'; catalogVersion: string; fromPoiId: string; toPoiId: string };
export type RouteProxyPrivateScope = { kind: 'private_request' };
export type RouteProxyClientScope = RouteProxyPublicScope | RouteProxyPrivateScope;
export type RouteProxyFunctionRequest = {
  mode: CourseV1TravelMode;
  scope: RouteProxyClientScope;
  /** Private coordinates are sent only for the provider request; never for public cache lookup. */
  origin?: { lat: number; lon: number };
  destination?: { lat: number; lon: number };
};
export type RouteProxyReceipt = {
  result: 'exact' | 'no_route' | 'unavailable';
  newProviderAttemptCount: 0 | 1;
  reuse: 'session_hit' | 'server_cache_hit' | 'provider_attempt' | 'in_flight_reuse';
  unavailableReason?: 'limited' | 'transport' | 'store' | 'provider' | 'invalid_response' | 'rejected';
};
export type RouteProxyFunctionResponse = {
  mode?: CourseV1TravelMode;
  status: 'ok' | 'no_route' | 'limited' | 'in_flight' | 'route_proxy_unavailable' | 'store_unavailable' | 'unconfigured' | 'http_error' | 'network_error' | 'invalid_response' | 'rejected';
  totalMin?: number;
  receipt?: RouteProxyReceipt;
};
export type RouteProxyFunctionInvoker = {
  invoke(request: RouteProxyFunctionRequest): Promise<RouteProxyFunctionResponse>;
};
export type RouteProxyEdgeInvoker = {
  invoke(functionName: 'route-proxy', options: { body: RouteProxyFunctionRequest; headers: { Authorization: string } }): Promise<{ data: RouteProxyFunctionResponse | null; error: unknown | null }>;
};

/** Safe internal boundary: the original Edge error is deliberately discarded. */
export class RouteProxyTransportError extends Error {
  constructor() {
    super('route_proxy_transport_failed');
    this.name = 'RouteProxyTransportError';
  }
}

/** Binds the short-lived Auth JWT to the Edge request without exposing provider credentials. */
export function createAuthenticatedRouteProxyInvoker(input: { edge: RouteProxyEdgeInvoker; accessToken: string }): RouteProxyFunctionInvoker {
  return {
    async invoke(request) {
      let response;
      try {
        response = await input.edge.invoke('route-proxy', { body: request, headers: { Authorization: `Bearer ${input.accessToken}` } });
      } catch {
        throw new RouteProxyTransportError();
      }
      if (response.error || !response.data) throw new RouteProxyTransportError();
      return response.data;
    },
  };
}

export type CourseV1ProxyScopeResolver = (from: CourseV1Point, to: CourseV1Point) => RouteProxyClientScope;
export type RouteProxyRouteReceipt = { route: ExactRoute | null; receipts: RouteProxyReceipt[]; newProviderAttemptCount: 0 | 1 | 2 };

const validPoint = (point: CourseV1Point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180;

/**
 * Mobile boundary for the server route proxy. It never reads provider keys or falls back to ODsay,
 * TMAP transit, vehicle routes, or estimates. Public scopes intentionally omit client coordinates.
 */
export function createCourseV1ProxyRouteAdapter(input: { invoker: RouteProxyFunctionInvoker; resolveScope: CourseV1ProxyScopeResolver }): CourseV1RouteAdapter & CourseV1RouteReceiptAdapter {
  const invoke = async (from: CourseV1Point, to: CourseV1Point, mode: CourseV1TravelMode, scope: RouteProxyClientScope) => {
    const response = await input.invoker.invoke({ mode, scope, ...(scope.kind === 'private_request' ? { origin: { lat: from.lat, lon: from.lon }, destination: { lat: to.lat, lon: to.lon } } : {}) });
    const receipt = response.receipt;
    return { response, receipt: receipt && (receipt.newProviderAttemptCount === 0 || receipt.newProviderAttemptCount === 1) ? receipt : undefined };
  };
  const getRouteReceipt = async (from: CourseV1Point, to: CourseV1Point, budget: { maxNewProviderAttemptCount: 0 | 1 | 2 }): Promise<CourseV1RouteReceipt> => {
    if (!validPoint(from) || !validPoint(to) || budget.maxNewProviderAttemptCount === 0) return { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    const scope = input.resolveScope(from, to); const walk = await invoke(from, to, 'walk', scope); const receipts = walk.receipt ? [walk.receipt] : [];
    const walkRoute = exact('walk', walk.response); const walkAttempts = receiptCount(receipts);
    if (!walk.receipt) return { result: 'unavailable', newProviderAttemptCount: 0, reused: false };
    if (walk.receipt.result === 'unavailable') return engineReceipt('unavailable', undefined, receipts);
    if (walkRoute && walkRoute.min <= 14) return engineReceipt('exact', walkRoute, receipts);
    if (walkAttempts >= budget.maxNewProviderAttemptCount) return { result: 'unavailable', newProviderAttemptCount: walkAttempts, reused: false };
    const transit = await invoke(from, to, 'transit', scope); if (transit.receipt) receipts.push(transit.receipt);
    if (!transit.receipt) return { result: 'unavailable', newProviderAttemptCount: receiptCount(receipts), reused: false };
    const transitRoute = exact('transit', transit.response);
    if (transit.receipt.result === 'unavailable') return engineReceipt('unavailable', undefined, receipts);
    if (transitRoute) return engineReceipt('exact', transitRoute, receipts);
    return engineReceipt('no_route', undefined, receipts);
  };
  return {
    async getRoute(from, to) {
      if (!validPoint(from) || !validPoint(to)) return null;
      const scope = input.resolveScope(from, to); const walk = await invoke(from, to, 'walk', scope); const walkRoute = exact('walk', walk.response);
      if (walkRoute && walkRoute.min <= 14) return walkRoute;
      const transit = await invoke(from, to, 'transit', scope);
      return exact('transit', transit.response);
    },
    getRouteReceipt,
  };
}

const receiptCount = (receipts: RouteProxyReceipt[]): 0 | 1 | 2 => Math.min(2, receipts.reduce((total, receipt) => total + receipt.newProviderAttemptCount, 0)) as 0 | 1 | 2;
const engineReceipt = (result: 'exact' | 'no_route' | 'unavailable', route: ExactRoute | undefined, receipts: RouteProxyReceipt[]): CourseV1RouteReceipt => {
  const newProviderAttemptCount = receiptCount(receipts);
  const reused = newProviderAttemptCount === 0 && receipts.length > 0 && receipts.every((receipt) => receipt.reuse === 'session_hit' || receipt.reuse === 'server_cache_hit' || receipt.reuse === 'in_flight_reuse');
  if (result === 'exact' && route) return { result, route, newProviderAttemptCount, reused };
  if (result === 'no_route') return { result, newProviderAttemptCount, reused };
  return { result: 'unavailable', newProviderAttemptCount, reused };
};

function exact(mode: CourseV1TravelMode, response: RouteProxyFunctionResponse): ExactRoute | null {
  return response.status === 'ok' && response.mode === mode && Number.isInteger(response.totalMin) && (response.totalMin ?? 0) > 0
    ? { mode, min: response.totalMin as number, exact: true }
    : null;
}
