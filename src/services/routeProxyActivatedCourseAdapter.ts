import type { CourseV1Point, CourseV1RouteAdapter, CourseV1RouteReceiptAdapter } from '../engine/courseV1';
import { createAuthenticatedRouteProxyInvoker, createCourseV1ProxyRouteAdapter, type CourseV1ProxyScopeResolver, type RouteProxyClientScope, type RouteProxyEdgeInvoker, type RouteProxyFunctionInvoker, type RouteProxyFunctionResponse, type RouteProxyReceipt } from './routeProxyClientAdapter';
import type { RouteProxyAnonymousAuthPort } from './routeProxyAnonymousAuth';
import { routeProxyCatalogSnapshot, type RouteProxyCatalogSnapshot } from './routeProxyCatalogSnapshot';

export type RouteProxyUnavailableReason =
  | 'captcha_token_missing'
  | 'anonymous_auth_failed'
  | 'route_proxy_transport_failed'
  | 'route_proxy_rejected'
  | 'route_proxy_limited'
  | 'route_proxy_in_flight'
  | 'route_proxy_unconfigured'
  | 'route_proxy_store_unavailable'
  | 'route_proxy_provider_failed'
  | 'route_proxy_invalid_response';

/** Safe UI-facing failure: it deliberately contains no token, JWT, coordinate, or provider detail. */
export class RouteProxyUnavailableError extends Error {
  readonly reason: RouteProxyUnavailableReason;

  constructor(reason: RouteProxyUnavailableReason = 'route_proxy_unconfigured') {
    super('route_proxy_unavailable');
    this.name = 'RouteProxyUnavailableError';
    this.reason = reason;
  }
}

type RouteProxySnapshotScope = Pick<RouteProxyCatalogSnapshot, 'version' | 'points'>;

export type ActivatedCourseV1RouteAdapterInput = {
  /** UI decides the public build flag. This service never reads an EXPO_PUBLIC flag itself. */
  enabled: boolean;
  /** One-shot CAPTCHA result supplied by the UI; it is neither retained nor requested here. */
  captchaToken?: string;
  auth: RouteProxyAnonymousAuthPort;
  edge: RouteProxyEdgeInvoker;
  /** Injectable only for tests; production uses the current representative snapshot. */
  snapshot?: RouteProxySnapshotScope;
};

const validExactPoint = (point: CourseV1Point, snapshotPoint: { lat: number; lon: number } | undefined) =>
  !!snapshotPoint && point.lat === snapshotPoint.lat && point.lon === snapshotPoint.lon;

/**
 * Public cache IDs are allowed only when both route endpoints exactly match the current immutable
 * representative snapshot. All other requests remain request-lifetime private coordinate bodies.
 */
export function createRouteProxyCatalogScopeResolver(input: { snapshot?: RouteProxySnapshotScope } = {}): CourseV1ProxyScopeResolver {
  const snapshot = input.snapshot ?? routeProxyCatalogSnapshot;
  return (from, to): RouteProxyClientScope => {
    const fromPoint = snapshot.points[from.id];
    const toPoint = snapshot.points[to.id];
    return validExactPoint(from, fromPoint) && validExactPoint(to, toPoint)
      ? { kind: 'public_segment', catalogVersion: snapshot.version, fromPoiId: from.id, toPoiId: to.id }
      : { kind: 'private_request' };
  };
}

function unavailable(reason: RouteProxyUnavailableReason = 'route_proxy_unconfigured'): never {
  throw new RouteProxyUnavailableError(reason);
}

function edgeFailureReason(status: Exclude<RouteProxyFunctionResponse['status'], 'ok'>): RouteProxyUnavailableReason {
  switch (status) {
    case 'limited': return 'route_proxy_limited';
    case 'in_flight': return 'route_proxy_in_flight';
    case 'store_unavailable': return 'route_proxy_store_unavailable';
    case 'unconfigured':
    case 'route_proxy_unavailable': return 'route_proxy_unconfigured';
    case 'http_error':
    case 'network_error': return 'route_proxy_provider_failed';
    case 'invalid_response': return 'route_proxy_invalid_response';
    case 'rejected': return 'route_proxy_rejected';
    case 'no_route': return 'route_proxy_invalid_response';
  }
}

function validReceipt(receipt: RouteProxyReceipt | undefined): receipt is RouteProxyReceipt {
  return !!receipt
    && (receipt.result === 'exact' || receipt.result === 'no_route' || receipt.result === 'unavailable')
    && (receipt.newProviderAttemptCount === 0 || receipt.newProviderAttemptCount === 1)
    && (receipt.reuse === 'session_hit' || receipt.reuse === 'server_cache_hit' || receipt.reuse === 'provider_attempt' || receipt.reuse === 'in_flight_reuse');
}

/** Converts Edge transport, typed statuses, and malformed success bodies into fail-closed reasons. */
function createRequiredRouteProxyInvoker(input: RouteProxyFunctionInvoker, preserveRejectedReceipt = false): RouteProxyFunctionInvoker {
  return {
    async invoke(request) {
      let response;
      try {
        response = await input.invoke(request);
      } catch {
        return unavailable('route_proxy_transport_failed');
      }
      if (!validReceipt(response.receipt)) {
        if (response.status !== 'ok') return unavailable(edgeFailureReason(response.status));
        return unavailable('route_proxy_invalid_response');
      }
      if (response.receipt.result === 'no_route' && response.status === 'no_route') return response;
      // Snapshot rejection is a safe configuration/version boundary. Surface it distinctly so a
      // restored non-2xx body is never flattened into a generic SDK transport failure.
      if (response.receipt.result === 'unavailable' && response.status === 'rejected' && !preserveRejectedReceipt) return unavailable('route_proxy_rejected');
      if (response.receipt.result === 'unavailable' && response.status !== 'ok') return response;
      if (response.status !== 'ok') return unavailable(edgeFailureReason(response.status));
      if (response.receipt.result !== 'exact' || response.mode !== request.mode || !Number.isInteger(response.totalMin) || (response.totalMin ?? 0) <= 0) return unavailable('route_proxy_invalid_response');
      return response;
    },
  };
}

/**
 * Activated path only. The UI keeps ownership of legacy selection and passes enabled=false by
 * not calling this factory. No fallback transport is available after this boundary.
 */
export async function createActivatedCourseV1RouteAdapter(input: ActivatedCourseV1RouteAdapterInput): Promise<CourseV1RouteAdapter & CourseV1RouteReceiptAdapter> {
  if (!input.enabled) return unavailable('route_proxy_unconfigured');
  const existing = await input.auth.getSession().catch(() => null);
  const accessToken = existing?.accessToken || await createAnonymousSession(input);
  const rawInvoker = createAuthenticatedRouteProxyInvoker({ edge: input.edge, accessToken });
  const resolveScope = createRouteProxyCatalogScopeResolver({ snapshot: input.snapshot });
  const routeAdapter = createCourseV1ProxyRouteAdapter({ invoker: createRequiredRouteProxyInvoker(rawInvoker), resolveScope });
  const receiptAdapter = createCourseV1ProxyRouteAdapter({ invoker: createRequiredRouteProxyInvoker(rawInvoker, true), resolveScope });
  return { getRoute: routeAdapter.getRoute, getRouteReceipt: receiptAdapter.getRouteReceipt };
}

async function createAnonymousSession(input: ActivatedCourseV1RouteAdapterInput): Promise<string> {
  const captchaToken = input.captchaToken?.trim();
  if (!captchaToken) return unavailable('captcha_token_missing');
  const created = await input.auth.signInAnonymously(captchaToken).catch(() => null);
  if (!created?.accessToken) return unavailable('anonymous_auth_failed');
  return created.accessToken;
}
