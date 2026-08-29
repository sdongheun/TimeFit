export const ROUTE_PROXY_LEASE_TTL_MIN_MS = 1_000;
export const ROUTE_PROXY_LEASE_TTL_MAX_MS = 30_000;
export const ROUTE_PROXY_DEADLINE_SAFETY_MS = 250;

export type RouteProxyDeadlineConfig = {
  leaseTtlMs: number;
  providerDeadlineMs: number;
};

/** 설정값이 없거나 lease보다 충분히 짧지 않으면 provider 호출을 허용하지 않는다. */
export function resolveRouteProxyDeadlineConfig(values: {
  leaseTtlMs: unknown;
  providerDeadlineMs: unknown;
}): RouteProxyDeadlineConfig | null {
  const leaseTtlMs = Number(values.leaseTtlMs);
  const providerDeadlineMs = Number(values.providerDeadlineMs);
  if (!Number.isInteger(leaseTtlMs) || leaseTtlMs < ROUTE_PROXY_LEASE_TTL_MIN_MS || leaseTtlMs > ROUTE_PROXY_LEASE_TTL_MAX_MS) return null;
  if (!Number.isInteger(providerDeadlineMs) || providerDeadlineMs < 1) return null;
  if (providerDeadlineMs > leaseTtlMs - ROUTE_PROXY_DEADLINE_SAFETY_MS) return null;
  return { leaseTtlMs, providerDeadlineMs };
}

export type ProviderDeadlineResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'deadline_exceeded' }
  | { status: 'error'; error: unknown };

export type ProviderDeadlineScheduler = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

/** request와 response body parse를 같은 deadline/AbortSignal로 묶는다. */
export async function withinProviderDeadline<T>(
  deadlineMs: number,
  request: (signal: AbortSignal) => Promise<T>,
  scheduler: ProviderDeadlineScheduler = globalThis,
): Promise<ProviderDeadlineResult<T>> {
  const controller = new AbortController();
  const timer = scheduler.setTimeout(() => controller.abort(), deadlineMs);
  try {
    const value = await request(controller.signal);
    return controller.signal.aborted ? { status: 'deadline_exceeded' } : { status: 'ok', value };
  } catch (error) {
    return controller.signal.aborted ? { status: 'deadline_exceeded' } : { status: 'error', error };
  } finally {
    scheduler.clearTimeout(timer);
  }
}
