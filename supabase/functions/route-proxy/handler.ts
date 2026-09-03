// @ts-nocheck
import { resolveRouteProxyDeadlineConfig, withinProviderDeadline, type ProviderDeadlineScheduler } from './deadline.ts';
import { buildKakaoRouteRequest } from './kakaoRouteRequest.ts';

type Provider = 'kakao';
type Mode = 'walk' | 'transit';
type RpcReply = { data?: any; error?: unknown };
type GeometryPoint = { lat: number; lon: number };
type RouteGeometry = { paths: Array<{ points: GeometryPoint[] }> };
export type KakaoTransitGeometrySegment = { mode: 'walk' | 'transit'; paths: Array<{ points: GeometryPoint[] }> };
export type KakaoTransitSegmentResult = {
  segments: KakaoTransitGeometrySegment[];
  allStepsMapped: boolean;
  endpointDistanceM?: { start: number; end: number };
};

const ROUTE_GEOMETRY_PATH_LIMIT = 32;
const ROUTE_GEOMETRY_POINT_LIMIT = 512;

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
const routeResult = (_provider: Provider, mode: Mode, status: string, totalMin?: number, geometry?: RouteGeometry, reuse: 'session_hit' | 'server_cache_hit' | 'provider_attempt' | 'in_flight_reuse' = 'provider_attempt', newProviderAttemptCount = 0) => ({ mode, status, ...(totalMin ? { totalMin } : {}), ...(status === 'ok' && geometry ? { geometry } : {}), receipt: { result: status === 'ok' ? 'exact' : status === 'no_route' ? 'no_route' : 'unavailable', newProviderAttemptCount, reuse, ...(status === 'ok' || status === 'no_route' ? {} : { unavailableReason: unavailableReason(status) }) } });
const minute = (seconds: unknown) => Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Math.ceil(Number(seconds) / 60) : null;

const samePoint = (left: GeometryPoint, right: GeometryPoint) => left.lat === right.lat && left.lon === right.lon;
const selectPathPoints = (points: GeometryPoint[], targetCount: number) => {
  if (points.length <= targetCount) return points;
  return Array.from({ length: targetCount }, (_, index) => points[Math.round(index * (points.length - 1) / (targetCount - 1))]);
};
const cleanPath = (rawPath: unknown): GeometryPoint[] | null => {
  if (!Array.isArray(rawPath)) return null;
  const clean: GeometryPoint[] = [];
  for (const rawPoint of rawPath) {
    if (!Array.isArray(rawPoint) || rawPoint.length !== 2 || !validCoord(rawPoint[0], -180, 180) || !validCoord(rawPoint[1], -90, 90)) continue;
    const next = { lon: rawPoint[0], lat: rawPoint[1] } as GeometryPoint;
    if (!clean.length || !samePoint(clean[clean.length - 1], next)) clean.push(next);
  }
  return clean.length >= 2 ? clean : null;
};
const boundedCleanPaths = (paths: GeometryPoint[][]): GeometryPoint[][] | undefined => {
  if (!paths.length || paths.length > ROUTE_GEOMETRY_PATH_LIMIT) return undefined;
  const pointCount = paths.reduce((total, path) => total + path.length, 0);
  if (pointCount <= ROUTE_GEOMETRY_POINT_LIMIT) return paths;

  const baseline = paths.length * 2;
  const remaining = ROUTE_GEOMETRY_POINT_LIMIT - baseline;
  const interiorTotal = paths.reduce((total, path) => total + path.length - 2, 0);
  const allocations = paths.map((path) => {
    const exact = interiorTotal > 0 ? remaining * (path.length - 2) / interiorTotal : 0;
    return { count: 2 + Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let unallocated = ROUTE_GEOMETRY_POINT_LIMIT - allocations.reduce((total, allocation) => total + allocation.count, 0);
  const order = allocations.map((allocation, index) => ({ index, remainder: allocation.remainder })).sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const allocation of order) {
    if (unallocated <= 0) break;
    if (allocations[allocation.index].count < paths[allocation.index].length) {
      allocations[allocation.index].count += 1;
      unallocated -= 1;
    }
  }
  return paths.map((path, index) => selectPathPoints(path, allocations[index].count));
};
const boundedGeometry = (rawPaths: unknown[]): RouteGeometry | undefined => {
  const paths = boundedCleanPaths(rawPaths.map(cleanPath).filter((path): path is GeometryPoint[] => !!path));
  return paths ? { paths: paths.map((points) => ({ points })) } : undefined;
};

const kakaoTransitMode = (value: unknown): Mode | null => value === 'WALKING' ? 'walk' : value === 'BUS' || value === 'SUBWAY' ? 'transit' : null;
const distanceMeters = (left: GeometryPoint, right: GeometryPoint) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(right.lat - left.lat); const lonDelta = radians(right.lon - left.lon);
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(left.lat)) * Math.cos(radians(right.lat)) * Math.sin(lonDelta / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
};

/** Diagnostic-only pure boundary. Production geometry remains unchanged until downstream contracts are accepted. */
export function sanitizeKakaoTransitSegments(route: any, endpoints?: { origin: GeometryPoint; destination: GeometryPoint }): KakaoTransitSegmentResult {
  const steps = Array.isArray(route?.steps) ? route.steps : [];
  let allStepsMapped = steps.length > 0;
  const mapped: Array<{ mode: Mode; points: GeometryPoint[] }> = [];
  for (const step of steps) {
    const mode = kakaoTransitMode(step?.properties?.type);
    const points = cleanPath(step?.path?.points);
    if (!mode || !points) { allStepsMapped = false; continue; }
    mapped.push({ mode, points });
  }
  const bounded = boundedCleanPaths(mapped.map((item) => item.points));
  if (!bounded) return { segments: [], allStepsMapped: false };
  const segments = mapped.map((item, index) => ({ mode: item.mode, paths: [{ points: bounded[index] }] }));
  const origin = endpoints ? point(endpoints.origin) : null; const destination = endpoints ? point(endpoints.destination) : null;
  const first = bounded[0]?.[0]; const lastPath = bounded[bounded.length - 1]; const last = lastPath?.[lastPath.length - 1];
  const endpointDistanceM = origin && destination && first && last ? { start: distanceMeters(origin, first), end: distanceMeters(destination, last) } : undefined;
  return { segments, allStepsMapped, ...(endpointDistanceM ? { endpointDistanceM } : {}) };
}

/** Extracts only the selected Kakao route's WGS84 path points; provider guidance/body stays server-side. */
export function sanitizeKakaoRouteGeometry(mode: Mode, route: any): RouteGeometry | undefined {
  const steps = mode === 'walk'
    ? (Array.isArray(route?.legs) ? route.legs.flatMap((leg: any) => Array.isArray(leg?.steps) ? leg.steps : []) : [])
    : (Array.isArray(route?.steps) ? route.steps : []);
  return boundedGeometry(steps.map((step: any) => step?.path?.points));
}

const geometryFromCacheSteps = (steps: unknown): RouteGeometry | undefined => {
  if (!Array.isArray(steps)) return undefined;
  return boundedGeometry(steps.flatMap((step: any) => Array.isArray(step?.paths) ? step.paths : []));
};
const cacheSteps = (totalMin: number, geometry: RouteGeometry | undefined) => geometry
  ? [{ min: totalMin, paths: geometry.paths.map((path) => path.points.map((item) => [item.lon, item.lat])) }]
  : [];
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
    const maxNewProviderAttemptCount = body.maxNewProviderAttemptCount === undefined ? 1 : body.maxNewProviderAttemptCount;
    if (maxNewProviderAttemptCount !== 0 && maxNewProviderAttemptCount !== 1) return { mode: body.mode as Mode, rejectedAttemptAllowance: true };
    if (body.scope.kind === 'public_segment') {
      if (![body.scope.catalogVersion, body.scope.fromPoiId, body.scope.toPoiId].every((value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 160)) return null;
      const resolved = resolvePublicPoints(body.scope);
      // A syntactically valid public scope that cannot be resolved is a stale/missing server
      // snapshot, not a malformed client request. Return a safe receipt below without auth,
      // store, cache, or provider work so mobile can preserve `route_proxy_rejected`.
      return resolved ? { mode: body.mode as Mode, scope: body.scope, maxNewProviderAttemptCount, ...resolved } : { mode: body.mode as Mode, rejectedPublicSnapshot: true };
    }
    const origin = point(body.origin); const destination = point(body.destination);
    return origin && destination ? { mode: body.mode as Mode, scope: body.scope, maxNewProviderAttemptCount, origin, destination } : null;
  };
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return json({ status: 'rejected' }, 405);
    let body: unknown; try { body = await request.json(); } catch { return json({ status: 'rejected' }, 400); }
    const input = requestShape(body); if (!input) return json({ status: 'rejected' }, 400);
    if (input.rejectedAttemptAllowance) return json(routeResult('kakao', input.mode, 'rejected'), 400);
    if (input.rejectedPublicSnapshot) return json(routeResult('kakao', input.mode, 'rejected', undefined, undefined, 'session_hit'), 400);
    if (!deps.storeAvailable()) return json(routeResult('kakao', input.mode, 'store_unavailable'), 503);
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json(routeResult('kakao', input.mode, 'rejected'), 401);
    const auth = await deps.authenticate(token);
    if (auth.error || !auth.user || auth.user.aud !== 'authenticated') return json(routeResult('kakao', input.mode, 'rejected'), 401);
    if (auth.user.is_anonymous && deps.env('ROUTE_PROXY_ANONYMOUS_AUTH_ENABLED') !== 'true') return json(routeResult('kakao', input.mode, 'rejected'), 503);
    if (deps.env('ROUTE_PROXY_ABUSE_GUARD_APPROVED') !== 'true' || !(await deps.consumeRate(token))) return json(routeResult('kakao', input.mode, 'limited'), 429);
    const deadline = resolveRouteProxyDeadlineConfig({ leaseTtlMs: deps.env('ROUTE_PROXY_FETCH_LEASE_TTL_MS'), providerDeadlineMs: deps.env('ROUTE_PROXY_PROVIDER_DEADLINE_MS') });
    const kakaoRouteKey = deps.env('KAKAO_ROUTE_REST_API_KEY').trim();
    const publicScope = input.scope.kind === 'public_segment';
    const walkHard = numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_WALK_DAILY_HARD_LIMIT', 1000);
    const transitHard = numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_TRANSIT_DAILY_HARD_LIMIT', 1000);
    const policy = {
      walk: { hard: walkHard, soft: softLimitEnv(deps.env, 'ROUTE_PROXY_KAKAO_WALK_DAILY_SOFT_LIMIT', walkHard), rate: numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_WALK_PER_SECOND_LIMIT', 5) },
      transit: { hard: transitHard, soft: softLimitEnv(deps.env, 'ROUTE_PROXY_KAKAO_TRANSIT_DAILY_SOFT_LIMIT', transitHard), rate: numberEnv(deps.env, 'ROUTE_PROXY_KAKAO_TRANSIT_PER_SECOND_LIMIT', 5) },
    };
    const today = new Date(deps.now()).toISOString().slice(0, 10); const second = Math.floor(deps.now() / 1000);
    let providerAttemptStarted: 0 | 1 = 0;
    const keyArgs = (provider: Provider) => ({ p_provider: provider, p_mode: input.mode, p_from_poi_id: input.scope.fromPoiId, p_to_poi_id: input.scope.toPoiId, p_catalog_version: input.scope.catalogVersion });
    const rpc = async (name: string, args: Record<string, unknown>) => { const reply = await deps.rpc(name, args); if (reply.error) throw reply.error; return reply.data; };
    const cached = async (provider: Provider) => { if (!publicScope) return null; const data = await rpc('route_proxy_get_route', { ...keyArgs(provider), p_now: new Date(deps.now()).toISOString() }); const row = data?.[0]; return row?.total_min ? routeResult(provider, input.mode, 'ok', row.total_min, geometryFromCacheSteps(row.steps), 'server_cache_hit') : null; };
    const reserve = async (provider: Provider) => {
      const result = (await rpc('route_proxy_reserve_budget', { p_provider: provider, p_mode: input.mode, p_date_bucket: today, p_second_bucket: second, p_soft_limit: policy[input.mode].soft, p_hard_limit: policy[input.mode].hard, p_per_second_limit: policy[input.mode].rate }))?.[0];
      if (result?.granted === true) return 'granted';
      if (['soft_limit', 'daily_limit', 'rate_limit'].includes(result?.reason)) return 'limited';
      throw new Error('invalid_budget_response');
    };
    const claimLease = async (provider: Provider) => (await rpc('route_proxy_claim_fetch_lease', { ...keyArgs(provider), p_lease_ttl_ms: deadline.leaseTtlMs }))?.[0] ?? { state: 'idle', retry_after_ms: 0 };
    const releaseLease = async (provider: Provider, leaseId: string) => { await rpc('route_proxy_release_fetch_lease', { ...keyArgs(provider), p_lease_id: leaseId }); };
    const completeLease = async (provider: Provider, result: any, leaseId: string) => { await rpc('route_proxy_complete_fetch_lease', { ...keyArgs(provider), p_lease_id: leaseId, p_total_min: result.totalMin, p_steps: cacheSteps(result.totalMin, result.geometry), p_cache_expires_at: new Date(deps.now() + numberEnv(deps.env, 'ROUTE_PROXY_CACHE_TTL_MS', 900000)).toISOString() }); };
    const call = async (provider: Provider) => {
      if ((await reserve(provider)) === 'limited') return routeResult(provider, input.mode, 'limited');
      const kind = input.mode === 'walk' ? 'walk' : 'publictraffic';
      const providerRequest = buildKakaoRouteRequest(kind, { origin: input.origin, destination: input.destination, key: kakaoRouteKey });
      const attempted = await withinProviderDeadline(deadline.providerDeadlineMs, async (signal) => { providerAttemptStarted = 1; const response = await deps.fetch(providerRequest.url, { method: providerRequest.method, headers: providerRequest.headers, signal }); return { response, raw: await response.json() }; }, deps.deadlineScheduler);
      if (attempted.status === 'deadline_exceeded') return routeResult(provider, input.mode, 'deadline_exceeded', undefined, undefined, 'provider_attempt', 1); if (attempted.status === 'error') return routeResult(provider, input.mode, 'network_error', undefined, undefined, 'provider_attempt', 1); if (!attempted.value.response.ok) return routeResult(provider, input.mode, 'http_error', undefined, undefined, 'provider_attempt', 1);
      if (attempted.value.raw?.status !== 'OK') return routeResult(provider, input.mode, 'invalid_response', undefined, undefined, 'provider_attempt', 1);
      const route = input.mode === 'walk' ? attempted.value.raw?.route : attempted.value.raw?.routes?.[0]; const total = minute(route?.properties?.totalTime);
      return total ? routeResult(provider, input.mode, 'ok', total, sanitizeKakaoRouteGeometry(input.mode, route), 'provider_attempt', 1) : routeResult(provider, input.mode, 'no_route', undefined, undefined, 'provider_attempt', 1);
    };
    const callWithLease = async (provider: Provider) => {
      if (!publicScope) return call(provider);
      const lease = await claimLease(provider);
      // routeResult(provider, input.mode, 'in_flight') remains the lease-state contract; receipt marks reuse without exposing provider identity.
      if (lease.state !== 'claimed' || !lease.lease_id) { if (lease.state === 'in_flight' && Number(lease.retry_after_ms) > 0) await deps.wait(Math.min(2000, Number(lease.retry_after_ms))); return (await cached(provider)) ?? routeResult(provider, input.mode, 'in_flight', undefined, undefined, 'in_flight_reuse'); }
      let completed = false; let releaseStarted = false;
      const releaseOnce = async () => { if (releaseStarted) return; releaseStarted = true; await releaseLease(provider, lease.lease_id); };
      try { const result = await call(provider); if (result.status === 'ok') { await completeLease(provider, result, lease.lease_id); completed = true; } else await releaseOnce(); return result; }
      finally { if (!completed && !releaseStarted) await releaseOnce().catch(() => undefined); }
    };
    try {
      { const hit = await cached('kakao'); if (hit) return json(hit); }
      if (input.maxNewProviderAttemptCount === 0) return json(routeResult('kakao', input.mode, 'limited'));
      if (!deadline) return json(routeResult('kakao', input.mode, 'network_error'), 503);
      if (!kakaoRouteKey) return json(routeResult('kakao', input.mode, 'unconfigured'));
      return json(await callWithLease('kakao'));
    } catch { return json(routeResult('kakao', input.mode, 'store_unavailable', undefined, undefined, 'provider_attempt', providerAttemptStarted), 503); }
  };
}
