// @ts-nocheck
import { resolveRouteProxyDeadlineConfig, withinProviderDeadline, type ProviderDeadlineScheduler } from './deadline.ts';

type Provider = 'kakao';
type Mode = 'walk' | 'transit';
type RpcReply = { data?: any; error?: unknown };

export type RouteProxyHandlerDependencies = {
  env(name: string): string;
  fetch(input: string, init: RequestInit): Promise<Response>;
  authenticate(token: string): Promise<{ user: { aud: string; is_anonymous?: boolean } | null; error?: unknown }>;
  rpc(name: string, args: Record<string, unknown>): Promise<RpcReply>;
  now(): number;
  wait(ms: number): Promise<void>;
  consumeRate(token: string): Promise<boolean>;
  storeAvailable(): boolean;
  deadlineScheduler?: ProviderDeadlineScheduler;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// Legacy route_proxy_unavailable is retained only as a client-side compatibility reason; valid Edge requests return a receipt instead.
const numberEnv = (env: (name: string) => string, name: string, fallback: number) => {
  const value = Number(env(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const softLimitEnv = (env: (name: string) => string, name: string, hard: number) => {
  const value = Number(env(name));
  return Number.isInteger(value) && value > 0 && value <= hard ? value : Math.max(1, Math.floor(hard * 0.9));
};
const validCoord = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const point = (value: any) => value && validCoord(value.lat, -90, 90) && validCoord(value.lon, -180, 180) ? { lat: value.lat, lon: value.lon } : null;
const unavailableReason = (status: string) => ({ limited: 'limited', store_unavailable: 'store', http_error: 'provider', unconfigured: 'provider', network_error: 'transport', deadline_exceeded: 'transport', invalid_response: 'invalid_response', rejected: 'rejected' }[status] ?? 'transport');
const routeResult = (_provider: Provider, mode: Mode, status: string, totalMin?: number, steps?: unknown[], reuse: 'session_hit' | 'server_cache_hit' | 'provider_attempt' | 'in_flight_reuse' = 'provider_attempt', newProviderAttemptCount = 0) => ({ mode, status, ...(totalMin ? { totalMin } : {}), ...(steps?.length ? { steps } : {}), receipt: { result: status === 'ok' ? 'exact' : status === 'no_route' ? 'no_route' : 'unavailable', newProviderAttemptCount, reuse, ...(status === 'ok' || status === 'no_route' ? {} : { unavailableReason: unavailableReason(status) }) } });
const minute = (seconds: unknown) => Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Math.ceil(Number(seconds) / 60) : null;
export function createRouteProxyHandler(deps: RouteProxyHandlerDependencies) {
  const resolvePublicPoints = (scope: any) => {
    try {
      const snapshot = JSON.parse(deps.env('ROUTE_PROXY_CATALOG_SNAPSHOT_JSON'));
      if (!snapshot || snapshot.version !== scope.catalogVersion) return null;
      const origin = point(snapshot.points?.[scope.fromPoiId]); const destination = point(snapshot.points?.[scope.toPoiId]);
      return origin && destination ? { origin, destination } : null;
    } catch { return null; }
  };
  const requestShape = (body: any) => {
    if (!body || !['walk', 'transit'].includes(body.mode) || !body.scope || !['public_segment', 'private_request'].includes(body.scope.kind)) return null;
    if (body.scope.kind === 'public_segment') {
      if (![body.scope.catalogVersion, body.scope.fromPoiId, body.scope.toPoiId].every((value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 160)) return null;
      const resolved = resolvePublicPoints(body.scope);
      return resolved ? { mode: body.mode as Mode, scope: body.scope, ...resolved } : null;
    }
    const origin = point(body.origin); const destination = point(body.destination);
    return origin && destination ? { mode: body.mode as Mode, scope: body.scope, origin, destination } : null;
  };
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ status: 'rejected' }, 405);
    let body: unknown; try { body = await request.json(); } catch { return json({ status: 'rejected' }, 400); }
    const input = requestShape(body); if (!input) return json({ status: 'rejected' }, 400);
    if (!deps.storeAvailable()) return json(routeResult('kakao', input.mode, 'store_unavailable'), 503);
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json(routeResult('kakao', input.mode, 'rejected'), 401);
    const auth = await deps.authenticate(token);
    if (auth.error || !auth.user || auth.user.aud !== 'authenticated') return json(routeResult('kakao', input.mode, 'rejected'), 401);
    if (auth.user.is_anonymous && deps.env('ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED') !== 'true') return json(routeResult('kakao', input.mode, 'rejected'), 503);
    if (deps.env('ROUTE_PROXY_ABUSE_GUARD_APPROVED') !== 'true' || !(await deps.consumeRate(token))) return json(routeResult('kakao', input.mode, 'limited'), 429);
    const deadline = resolveRouteProxyDeadlineConfig({ leaseTtlMs: deps.env('ROUTE_PROXY_FETCH_LEASE_TTL_MS'), providerDeadlineMs: deps.env('ROUTE_PROXY_PROVIDER_DEADLINE_MS') });
    if (!deadline) return json(routeResult('kakao', input.mode, 'network_error'), 503);
    const kakaoRouteKey = deps.env('KAKAO_ROUTE_REST_API_KEY');
    if (!kakaoRouteKey) return json(routeResult('kakao', input.mode, 'unconfigured'));
    const publicScope = input.scope.kind === 'public_segment';
    const walkHard = numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT', 1000);
    const transitHard = numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT', 1000);
    const policy = {
      walk: { hard: walkHard, soft: softLimitEnv(deps.env, 'ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT', walkHard), rate: numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT', 5) },
      transit: { hard: transitHard, soft: softLimitEnv(deps.env, 'ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT', transitHard), rate: numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT', 5) },
    };
    const today = new Date(deps.now()).toISOString().slice(0, 10); const second = Math.floor(deps.now() / 1000);
    const keyArgs = (provider: Provider) => ({ p_provider: provider, p_mode: input.mode, p_from_poi_id: input.scope.fromPoiId, p_to_poi_id: input.scope.toPoiId, p_catalog_version: input.scope.catalogVersion });
    const rpc = async (name: string, args: Record<string, unknown>) => { const reply = await deps.rpc(name, args); if (reply.error) throw reply.error; return reply.data; };
    const cached = async (provider: Provider) => { if (!publicScope) return null; const data = await rpc('route_proxy_get_route', { ...keyArgs(provider), p_now: new Date(deps.now()).toISOString() }); const row = data?.[0]; return row?.total_min ? routeResult(provider, input.mode, 'ok', row.total_min, row.steps, 'server_cache_hit') : null; };
    const reserve = async (provider: Provider) => {
      const result = (await rpc('route_proxy_reserve_budget', { p_provider: provider, p_mode: input.mode, p_date_bucket: today, p_second_bucket: second, p_soft_limit: policy[input.mode].soft, p_hard_limit: policy[input.mode].hard, p_per_second_limit: policy[input.mode].rate }))?.[0];
      if (result?.granted === true) return 'granted';
      if (['soft_limit', 'daily_limit', 'rate_limit'].includes(result?.reason)) return 'limited';
      throw new Error('invalid_budget_response');
    };
    const claimLease = async (provider: Provider) => (await rpc('route_proxy_claim_fetch_lease', { ...keyArgs(provider), p_lease_ttl_ms: deadline.leaseTtlMs }))?.[0] ?? { state: 'idle', retry_after_ms: 0 };
    const releaseLease = async (provider: Provider, leaseId: string) => { await rpc('route_proxy_release_fetch_lease', { ...keyArgs(provider), p_lease_id: leaseId }); };
    const completeLease = async (result: any, leaseId: string) => { await rpc('route_proxy_complete_fetch_lease', { ...keyArgs(result.provider), p_lease_id: leaseId, p_total_min: result.totalMin, p_steps: result.steps ?? [], p_cache_expires_at: new Date(deps.now() + numberEnv(deps.env, 'ROUTE_PROXY_CACHE_TTL_MS', 900000)).toISOString() }); };
    const call = async (provider: Provider) => {
      if ((await reserve(provider)) === 'limited') return routeResult(provider, input.mode, 'limited');
      const kind = input.mode === 'walk' ? 'walk' : 'publictraffic'; const params = new URLSearchParams({ start_x: String(input.origin.lon), start_y: String(input.origin.lat), end_x: String(input.destination.lon), end_y: String(input.destination.lat), input_coord: 'WGS84', output_coord: 'WGS84' });
      const attempted = await withinProviderDeadline(deadline.providerDeadlineMs, async (signal) => { const response = await deps.fetch(`https://dapi.kakao.com/v2/routing/${kind}?${params}`, { headers: { Authorization: `KakaoAK ${kakaoRouteKey}` }, signal }); return { response, raw: await response.json() }; }, deps.deadlineScheduler);
      if (attempted.status === 'deadline_exceeded') return routeResult(provider, input.mode, 'deadline_exceeded', undefined, undefined, 'provider_attempt', 1); if (attempted.status === 'error') return routeResult(provider, input.mode, 'network_error', undefined, undefined, 'provider_attempt', 1); if (!attempted.value.response.ok) return routeResult(provider, input.mode, 'http_error', undefined, undefined, 'provider_attempt', 1);
      if (attempted.value.raw?.status !== 'OK') return routeResult(provider, input.mode, 'invalid_response', undefined, undefined, 'provider_attempt', 1);
      const route = input.mode === 'walk' ? attempted.value.raw?.route : attempted.value.raw?.routes?.[0]; const total = minute(route?.properties?.totalTime);
      return total ? routeResult(provider, input.mode, 'ok', total, undefined, 'provider_attempt', 1) : routeResult(provider, input.mode, 'no_route', undefined, undefined, 'provider_attempt', 1);
    };
    const callWithLease = async (provider: Provider) => {
      if (!publicScope) return call(provider);
      const lease = await claimLease(provider);
      // routeResult(provider, input.mode, 'in_flight') remains the lease-state contract; receipt marks reuse without exposing provider identity.
      if (lease.state !== 'claimed' || !lease.lease_id) { if (lease.state === 'in_flight' && Number(lease.retry_after_ms) > 0) await deps.wait(Math.min(2000, Number(lease.retry_after_ms))); return (await cached(provider)) ?? routeResult(provider, input.mode, 'in_flight', undefined, undefined, 'in_flight_reuse'); }
      let completed = false; let releaseStarted = false;
      const releaseOnce = async () => { if (releaseStarted) return; releaseStarted = true; await releaseLease(provider, lease.lease_id); };
      try { const result = await call(provider); if (result.status === 'ok') { await completeLease(result, lease.lease_id); completed = true; } else await releaseOnce(); return result; }
      finally { if (!completed && !releaseStarted) await releaseOnce().catch(() => undefined); }
    };
    try {
      { const hit = await cached('kakao'); if (hit) return json(hit); }
      return json(await callWithLease('kakao'));
    } catch { return json(routeResult('kakao', input.mode, 'store_unavailable'), 503); }
  };
}
