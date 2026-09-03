import { FunctionsHttpError } from '@supabase/functions-js';
import type { RouteProxyFunctionResponse, RouteProxyReceipt } from './routeProxyClientAdapter';

type RouteProxyHttpErrorContext = { json(): Promise<unknown> };

const statuses = new Set<RouteProxyFunctionResponse['status']>(['ok', 'no_route', 'limited', 'in_flight', 'route_proxy_unavailable', 'store_unavailable', 'unconfigured', 'http_error', 'network_error', 'invalid_response', 'rejected']);
const unavailableReasons = new Set<NonNullable<RouteProxyReceipt['unavailableReason']>>(['limited', 'in_flight', 'transport', 'store', 'provider', 'invalid_response', 'rejected']);

function isReceipt(value: unknown): value is RouteProxyReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Record<string, unknown>;
  return (receipt.result === 'exact' || receipt.result === 'no_route' || receipt.result === 'unavailable')
    && (receipt.newProviderAttemptCount === 0 || receipt.newProviderAttemptCount === 1)
    && (receipt.reuse === 'session_hit' || receipt.reuse === 'server_cache_hit' || receipt.reuse === 'provider_attempt' || receipt.reuse === 'in_flight_reuse')
    && (receipt.unavailableReason === undefined || typeof receipt.unavailableReason === 'string' && unavailableReasons.has(receipt.unavailableReason as NonNullable<RouteProxyReceipt['unavailableReason']>));
}

function isSafeRouteProxyResponse(value: unknown): value is RouteProxyFunctionResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  if (typeof response.mode !== 'string' || (response.mode !== 'walk' && response.mode !== 'transit') || typeof response.status !== 'string' || !statuses.has(response.status as RouteProxyFunctionResponse['status']) || !isReceipt(response.receipt)) return false;
  if (response.status === 'ok') return response.receipt.result === 'exact' && Number.isInteger(response.totalMin) && Number(response.totalMin) > 0;
  if (response.status === 'no_route') return response.receipt.result === 'no_route';
  return response.receipt.result === 'unavailable';
}

/** Restores only a schema-valid typed non-2xx Function body; all other errors remain transport-safe. */
export async function restoreRouteProxyHttpError(error: unknown): Promise<RouteProxyFunctionResponse | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  const context = error.context as Partial<RouteProxyHttpErrorContext> | undefined;
  if (!context || typeof context.json !== 'function') return null;
  try {
    const body = await context.json();
    return isSafeRouteProxyResponse(body) ? body : null;
  } catch {
    return null;
  }
}
