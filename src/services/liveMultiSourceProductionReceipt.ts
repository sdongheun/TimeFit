import { FunctionsHttpError } from '@supabase/functions-js';
import type { BusanLiveFailureCode } from './busanLiveAdapter';
import type { SafeTourLiveFailure, TourLiveFailureCode, TourLiveOperation } from './tourApiLiveAdapter';

type HttpErrorContext = { json(): Promise<unknown> };
const tourOperations = new Set<TourLiveOperation>(['areaBasedList2', 'detailIntro2']);
const tourCodes = new Set<TourLiveFailureCode>(['timeout', 'network', 'http_error', 'provider_error', 'unauthorized', 'rate_limited', 'invalid_response', 'page_limit', 'request_budget_exhausted', 'identity_conflict']);
const busanCodes = new Set<BusanLiveFailureCode>(['timeout', 'network', 'http_error', 'provider_error', 'unauthorized', 'rate_limited', 'invalid_response', 'page_limit', 'request_budget_exhausted']);
const safeStatus = (value: unknown): value is number | null => value === null || Number.isInteger(value);

/** Restores only a reconstructed typed unavailable body; arbitrary fields never cross the port. */
export async function restoreLiveFunctionHttpError(error: unknown, functionName: 'tourapi-live' | 'busan-live') {
  if (!(error instanceof FunctionsHttpError)) return null;
  const context = error.context as Partial<HttpErrorContext> | undefined;
  if (!context || typeof context.json !== 'function') return null;
  try {
    const raw = await context.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    if (value.status !== 'unavailable' || !value.reason || typeof value.reason !== 'object' || Array.isArray(value.reason)) return null;
    const reason = value.reason as Record<string, unknown>;
    if (functionName === 'tourapi-live' && typeof reason.operation === 'string' && tourOperations.has(reason.operation as TourLiveOperation)
      && typeof reason.code === 'string' && tourCodes.has(reason.code as TourLiveFailureCode) && safeStatus(reason.status)) {
      const safeReason: SafeTourLiveFailure = { operation: reason.operation as TourLiveOperation, code: reason.code as TourLiveFailureCode, status: reason.status };
      return { status: 'unavailable' as const, reason: safeReason };
    }
    if (functionName === 'busan-live' && value.providerCalls === 0 && typeof reason.code === 'string'
      && busanCodes.has(reason.code as BusanLiveFailureCode) && safeStatus(reason.status)) {
      return { status: 'unavailable' as const, providerCalls: 0 as const, reason: { code: reason.code as BusanLiveFailureCode, status: reason.status } };
    }
  } catch { /* unreadable bodies stay transport-safe */ }
  return null;
}

