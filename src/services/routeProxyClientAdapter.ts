import { COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT, COURSE_V1_ROUTE_GEOMETRY_POINT_LIMIT, type CourseV1Point, type CourseV1RouteAdapter, type CourseV1RouteGeometry, type CourseV1RouteReceipt, type CourseV1RouteReceiptAdapter, type CourseV1RouteUnavailableReason, type CourseV1TravelMode, type ExactRoute } from '../engine/courseV1';

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
  unavailableReason?: 'limited' | 'in_flight' | 'transport' | 'store' | 'provider' | 'invalid_response' | 'rejected';
};
export type RouteProxyFunctionResponse = {
  mode?: CourseV1TravelMode;
  status: 'ok' | 'no_route' | 'limited' | 'in_flight' | 'route_proxy_unavailable' | 'store_unavailable' | 'unconfigured' | 'http_error' | 'network_error' | 'invalid_response' | 'rejected';
  totalMin?: number;
  geometry?: CourseV1RouteGeometry;
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
    if (!validPoint(from) || !validPoint(to) || budget.maxNewProviderAttemptCount === 0) return unavailableReceipt(0, false);
    const scope = input.resolveScope(from, to); const walk = await invoke(from, to, 'walk', scope); const receipts = walk.receipt ? [walk.receipt] : [];
    const walkRoute = exact('walk', walk.response); const walkAttempts = receiptCount(receipts);
    if (!walk.receipt) return unavailableReceipt(0, false);
    if (walk.receipt.result === 'unavailable') return engineReceipt('unavailable', undefined, receipts, walk.response);
    if (walkRoute && walkRoute.min <= 14) return engineReceipt('exact', walkRoute, receipts);
    if (walkAttempts >= budget.maxNewProviderAttemptCount) return unavailableReceipt(walkAttempts, false);
    const transit = await invoke(from, to, 'transit', scope); if (transit.receipt) receipts.push(transit.receipt);
    if (!transit.receipt) return unavailableReceipt(receiptCount(receipts), false);
    const transitRoute = exact('transit', transit.response);
    if (transit.receipt.result === 'unavailable') return engineReceipt('unavailable', undefined, receipts, transit.response);
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
const engineReceipt = (result: 'exact' | 'no_route' | 'unavailable', route: ExactRoute | undefined, receipts: RouteProxyReceipt[], unavailableResponse?: RouteProxyFunctionResponse): CourseV1RouteReceipt => {
  const newProviderAttemptCount = receiptCount(receipts);
  const reused = newProviderAttemptCount === 0 && receipts.length > 0 && receipts.every((receipt) => receipt.reuse === 'session_hit' || receipt.reuse === 'server_cache_hit' || receipt.reuse === 'in_flight_reuse');
  if (result === 'exact' && route) return { result, route, newProviderAttemptCount, reused };
  if (result === 'no_route') return { result, newProviderAttemptCount, reused };
  return { result: 'unavailable', reason: mapRouteProxyUnavailableReason(unavailableResponse), newProviderAttemptCount, reused };
};

const unavailableReceipt = (newProviderAttemptCount: 0 | 1 | 2, reused: boolean): CourseV1RouteReceipt => ({ result: 'unavailable', reason: 'unknown', newProviderAttemptCount, reused });
const safeUnavailableReasons = new Set<CourseV1RouteUnavailableReason>(['limited', 'in_flight', 'store', 'provider', 'transport', 'invalid_response', 'rejected', 'unknown']);
const receiptStatuses = new Set<RouteProxyFunctionResponse['status']>(['limited', 'in_flight', 'route_proxy_unavailable', 'store_unavailable', 'unconfigured', 'http_error', 'network_error', 'invalid_response', 'rejected']);

/** Maps only an existing typed unavailable response; missing/local failures never infer an API cause. */
export function mapRouteProxyUnavailableReason(response: RouteProxyFunctionResponse | undefined): CourseV1RouteUnavailableReason {
  if (!response || !receiptStatuses.has(response.status) || response.receipt?.result !== 'unavailable') return 'unknown';
  if (response.status === 'in_flight') return 'in_flight';
  return safeUnavailableReasons.has(response.receipt.unavailableReason as CourseV1RouteUnavailableReason)
    ? response.receipt.unavailableReason as CourseV1RouteUnavailableReason
    : 'unknown';
}

function exact(mode: CourseV1TravelMode, response: RouteProxyFunctionResponse): ExactRoute | null {
  if (response.status !== 'ok' || response.mode !== mode || !Number.isInteger(response.totalMin) || (response.totalMin ?? 0) <= 0) return null;
  const geometry = normalizeRouteProxyGeometry(response.geometry);
  return { mode, min: response.totalMin as number, exact: true, ...(geometry ? { geometry } : {}) };
}

/** Shared fail-closed validator for geometry returned across the Route Proxy boundary. */
export function normalizeRouteProxyGeometry(value: unknown): CourseV1RouteGeometry | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const paths = (value as { paths?: unknown }).paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > COURSE_V1_ROUTE_GEOMETRY_PATH_LIMIT) return undefined;
  let pointCount = 0;
  const normalized: Array<{ points: Array<{ lat: number; lon: number }> }> = [];
  for (const path of paths) {
    const points = path && typeof path === 'object' ? (path as { points?: unknown }).points : undefined;
    if (!Array.isArray(points) || points.length < 2) return undefined;
    const clean: Array<{ lat: number; lon: number }> = [];
    for (const item of points) {
      if (!item || typeof item !== 'object') return undefined;
      const { lat, lon } = item as { lat?: unknown; lon?: unknown };
      if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
      pointCount += 1;
      if (pointCount > COURSE_V1_ROUTE_GEOMETRY_POINT_LIMIT) return undefined;
      clean.push({ lat, lon });
    }
    normalized.push({ points: clean });
  }
  return { paths: normalized };
}
