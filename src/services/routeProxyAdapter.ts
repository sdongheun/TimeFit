import {
  chooseWalkProvider,
  type ProviderBudget,
  type ProviderRouteRequest,
  type ProviderRouteResult,
  type RouteProvider,
} from './routeProviderAdapter';

/** Server-only provider port. It deliberately does not expose provider keys. */
export type RouteProxyClients = {
  kakaoWalk(request: ProviderRouteRequest): Promise<ProviderRouteResult>;
  kakaoTransit(request: ProviderRouteRequest): Promise<ProviderRouteResult>;
  tmapWalk(request: ProviderRouteRequest): Promise<ProviderRouteResult>;
};

export type RouteProxyCacheScope =
  | { kind: 'public_segment'; catalogVersion: string; fromPoiId: string; toPoiId: string }
  | { kind: 'private_request' };

export type RouteProxyRequest = { route: ProviderRouteRequest; cacheScope: RouteProxyCacheScope };
export type RouteProxyPolicy = {
  cacheTtlMs: number;
  budgets: Record<'kakao' | 'tmap', ProviderBudget & { perSecondLimit: number }>;
};
export type RouteProxyDiagnostics = {
  cache: 'hit' | 'miss' | 'private';
  providerAttempts: RouteProvider[];
  providerRequests: Partial<Record<RouteProvider, number>>;
  cacheWrites: number;
};
export type RouteProxyResponse = {
  result: ProviderRouteResult;
  diagnostics: RouteProxyDiagnostics;
  cacheKey?: string;
};
export type RouteCacheEntry = { result: ProviderRouteResult; expiresAtMs: number };
export type BudgetReservation = { granted: boolean; used: number; reason?: 'daily_limit' | 'rate_limit' };

/**
 * Implement this at the server boundary using an atomic database transaction.
 * No user ID, IP address, raw coordinates, request body, or API key belongs in it.
 */
export interface RouteProxyStore {
  getRoute(key: string, nowMs: number): Promise<RouteCacheEntry | null>;
  putRoute(key: string, entry: RouteCacheEntry): Promise<void>;
  readBudget(provider: 'kakao' | 'tmap', dateBucket: string): Promise<number>;
  reserveBudget(input: { provider: 'kakao' | 'tmap'; dateBucket: string; secondBucket: string; hardLimit: number; perSecondLimit: number }): Promise<BudgetReservation>;
}

const dateBucket = (nowMs: number) => new Date(nowMs).toISOString().slice(0, 10);
const secondBucket = (nowMs: number) => Math.floor(nowMs / 1000).toString();
const routeKey = (provider: RouteProvider, mode: ProviderRouteRequest['mode'], scope: Extract<RouteProxyCacheScope, { kind: 'public_segment' }>) =>
  `${provider}|${mode}|${scope.fromPoiId}|${scope.toPoiId}|${scope.catalogVersion}`;

const validPublicScope = (input: RouteProxyRequest): input is RouteProxyRequest & { cacheScope: Extract<RouteProxyCacheScope, { kind: 'public_segment' }> } =>
  input.cacheScope.kind === 'public_segment'
  && input.route.origin.id === input.cacheScope.fromPoiId
  && input.route.destination.id === input.cacheScope.toPoiId
  && input.route.routeVersion === input.cacheScope.catalogVersion;

const failed = (provider: RouteProvider, request: ProviderRouteRequest, status: ProviderRouteResult['status']): ProviderRouteResult => ({
  provider, mode: request.mode, fromId: request.origin.id, toId: request.destination.id, status,
});

const validCached = (entry: RouteCacheEntry | null, provider: RouteProvider, request: ProviderRouteRequest, nowMs: number): ProviderRouteResult | null => {
  const result = entry?.result;
  return entry && entry.expiresAtMs > nowMs && result?.status === 'ok'
    && result.provider === provider && result.mode === request.mode
    && result.fromId === request.origin.id && result.toId === request.destination.id
    ? result : null;
};

export function createServerRouteProxy(input: { clients: RouteProxyClients; store: RouteProxyStore; policy: RouteProxyPolicy; now?: () => number }) {
  const now = input.now ?? Date.now;
  const inFlight = new Map<string, Promise<RouteProxyResponse>>();

  const invoke = async (provider: 'kakao' | 'tmap', request: ProviderRouteRequest, diagnostics: RouteProxyDiagnostics): Promise<ProviderRouteResult> => {
    const current = now();
    const budget = input.policy.budgets[provider];
    const reservation = await input.store.reserveBudget({ provider, dateBucket: dateBucket(current), secondBucket: secondBucket(current), hardLimit: budget.hardLimit, perSecondLimit: budget.perSecondLimit });
    if (!reservation.granted) return failed(provider, request, 'limited');
    diagnostics.providerAttempts.push(provider);
    diagnostics.providerRequests[provider] = (diagnostics.providerRequests[provider] ?? 0) + 1;
    return provider === 'kakao'
      ? request.mode === 'transit' ? input.clients.kakaoTransit(request) : input.clients.kakaoWalk(request)
      : input.clients.tmapWalk(request);
  };

  const resolve = async (request: RouteProxyRequest): Promise<RouteProxyResponse> => {
    const diagnostics: RouteProxyDiagnostics = { cache: request.cacheScope.kind === 'public_segment' ? 'miss' : 'private', providerAttempts: [], providerRequests: {}, cacheWrites: 0 };
    if (request.cacheScope.kind === 'public_segment' && !validPublicScope(request)) {
      return { result: failed(request.route.mode === 'transit' ? 'kakao' : 'kakao', request.route, 'invalid_response'), diagnostics };
    }
    const scope = validPublicScope(request) ? request.cacheScope : null;
    const candidates: ('kakao' | 'tmap')[] = request.route.mode === 'transit' ? ['kakao'] : ['kakao', 'tmap'];
    if (scope) {
      for (const provider of candidates) {
        const cached = validCached(await input.store.getRoute(routeKey(provider, request.route.mode, scope), now()), provider, request.route, now());
        if (cached) return { result: cached, diagnostics: { ...diagnostics, cache: 'hit' }, cacheKey: routeKey(provider, request.route.mode, scope) };
      }
    }

    const bucket = dateBucket(now());
    const kakaoUsed = await input.store.readBudget('kakao', bucket);
    const tmapUsed = request.route.mode === 'walk' ? await input.store.readBudget('tmap', bucket) : 0;
    const first = request.route.mode === 'transit'
      ? 'kakao'
      : chooseWalkProvider({ request: request.route, kakao: { ...input.policy.budgets.kakao, used: kakaoUsed }, tmap: { ...input.policy.budgets.tmap, used: tmapUsed } }).provider;
    if (!first) return { result: failed('kakao', request.route, 'limited'), diagnostics };
    let result = await invoke(first, request.route, diagnostics);
    if (request.route.mode === 'walk' && result.status !== 'ok' && result.status !== 'limited') {
      const second = first === 'kakao' ? 'tmap' : 'kakao';
      result = await invoke(second, request.route, diagnostics);
    }
    const key = scope ? routeKey(result.provider, request.route.mode, scope) : undefined;
    if (key && result.status === 'ok') {
      await input.store.putRoute(key, { result, expiresAtMs: now() + input.policy.cacheTtlMs });
      diagnostics.cacheWrites = 1;
    }
    return { result, diagnostics, ...(key ? { cacheKey: key } : {}) };
  };

  return {
    resolve(request: RouteProxyRequest): Promise<RouteProxyResponse> {
      if (!validPublicScope(request)) return resolve(request);
      const key = `${request.route.mode}|${request.cacheScope.fromPoiId}|${request.cacheScope.toPoiId}|${request.cacheScope.catalogVersion}`;
      const pending = inFlight.get(key);
      if (pending) return pending;
      const task = resolve(request).finally(() => inFlight.delete(key));
      inFlight.set(key, task);
      return task;
    },
  };
}

/** Fixture-only store. Production must provide a DB-backed atomic RouteProxyStore. */
export function createMemoryRouteProxyStore(): RouteProxyStore {
  const routes = new Map<string, RouteCacheEntry>();
  const daily = new Map<string, number>();
  const perSecond = new Map<string, number>();
  return {
    async getRoute(key, nowMs) {
      const entry = routes.get(key) ?? null;
      if (entry && entry.expiresAtMs <= nowMs) routes.delete(key);
      return routes.get(key) ?? null;
    },
    async putRoute(key, entry) { routes.set(key, entry); },
    async readBudget(provider, bucket) { return daily.get(`${provider}|${bucket}`) ?? 0; },
    async reserveBudget({ provider, dateBucket: day, secondBucket: second, hardLimit, perSecondLimit }) {
      const dayKey = `${provider}|${day}`;
      const secondKey = `${provider}|${day}|${second}`;
      const used = daily.get(dayKey) ?? 0;
      if (used >= hardLimit) return { granted: false, used, reason: 'daily_limit' };
      const rate = perSecond.get(secondKey) ?? 0;
      if (rate >= perSecondLimit) return { granted: false, used, reason: 'rate_limit' };
      daily.set(dayKey, used + 1);
      perSecond.set(secondKey, rate + 1);
      return { granted: true, used: used + 1 };
    },
  };
}
