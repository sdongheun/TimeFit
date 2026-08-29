export type RouteProvider = 'kakao' | 'tmap' | 'odsay';
export type RouteMode = 'walk' | 'transit';
export type RouteStatus = 'ok' | 'no_route' | 'unconfigured' | 'http_error' | 'network_error' | 'invalid_response' | 'limited' | 'disabled';
export type PublicRoutePoint = { id: string; lat: number; lon: number };
export type ProviderRouteRequest = { origin: PublicRoutePoint; destination: PublicRoutePoint; mode: RouteMode; routeVersion: string };
export type ProviderRouteStep = { min: number; distanceM?: number; instruction?: string };
export type ProviderRouteResult = {
  provider: RouteProvider;
  mode: RouteMode;
  fromId: string;
  toId: string;
  status: RouteStatus;
  totalMin?: number;
  steps?: ProviderRouteStep[];
  statusCode?: number;
};

type Fetcher = typeof fetch;
export type RouteProviderClientOptions = { fetcher?: Fetcher; kakaoRestKey?: string; tmapAppKey?: string };
export type RouteProviderClients = {
  kakaoWalk(request: ProviderRouteRequest): Promise<ProviderRouteResult>;
  kakaoTransit(request: ProviderRouteRequest): Promise<ProviderRouteResult>;
  tmapWalk(request: ProviderRouteRequest): Promise<ProviderRouteResult>;
};

const base = (provider: RouteProvider, request: ProviderRouteRequest, status: RouteStatus, extra: Partial<ProviderRouteResult> = {}): ProviderRouteResult => ({
  provider, mode: request.mode, fromId: request.origin.id, toId: request.destination.id, status, ...extra,
});
const minutes = (seconds: unknown): number | null => {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value / 60) : null;
};
const optionalStep = (value: any): ProviderRouteStep | null => {
  const min = minutes(value?.time);
  return min ? { min, ...(Number.isFinite(value?.distance) ? { distanceM: Number(value.distance) } : {}), ...(typeof value?.guidance === 'string' ? { instruction: value.guidance } : {}) } : null;
};

async function kakaoRoute(kind: 'walk' | 'publictraffic', request: ProviderRouteRequest, options: RouteProviderClientOptions): Promise<ProviderRouteResult> {
  const key = options.kakaoRestKey;
  const provider = 'kakao' as const;
  if (!key) return base(provider, request, 'unconfigured');
  const params = new URLSearchParams({
    start_x: String(request.origin.lon), start_y: String(request.origin.lat), end_x: String(request.destination.lon), end_y: String(request.destination.lat),
    input_coord: 'WGS84', output_coord: 'WGS84',
  });
  try {
    const res = await (options.fetcher ?? fetch)(`https://dapi.kakao.com/v2/routing/${kind}?${params}`, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return base(provider, request, 'http_error', { statusCode: res.status });
    let json: any;
    try { json = await res.json(); } catch { return base(provider, request, 'invalid_response'); }
    if (json?.status !== 'OK') return typeof json?.status === 'string' ? base(provider, request, 'no_route') : base(provider, request, 'invalid_response');
    const route = kind === 'walk' ? json.route : json.routes?.[0];
    const totalMin = minutes(route?.properties?.totalTime);
    if (!totalMin) return base(provider, request, 'invalid_response');
    const sourceSteps = kind === 'walk' ? route?.legs?.flatMap((leg: any) => leg?.steps ?? []) : route?.steps ?? [];
    const steps = Array.isArray(sourceSteps) ? sourceSteps.map((step: any) => optionalStep(step?.properties)).filter((step: ProviderRouteStep | null): step is ProviderRouteStep => !!step) : [];
    return base(provider, request, 'ok', { totalMin, ...(steps.length > 0 ? { steps } : {}) });
  } catch { return base(provider, request, 'network_error'); }
}

async function tmapWalkRoute(request: ProviderRouteRequest, options: RouteProviderClientOptions): Promise<ProviderRouteResult> {
  if (!options.tmapAppKey) return base('tmap', request, 'unconfigured');
  try {
    const res = await (options.fetcher ?? fetch)('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json', {
      method: 'POST', headers: { appKey: options.tmapAppKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startX: request.origin.lon, startY: request.origin.lat, endX: request.destination.lon, endY: request.destination.lat, reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO' }),
    });
    if (!res.ok) return base('tmap', request, 'http_error', { statusCode: res.status });
    let json: any;
    try { json = await res.json(); } catch { return base('tmap', request, 'invalid_response'); }
    const totalMin = minutes(json?.features?.[0]?.properties?.totalTime);
    if (!totalMin) return Array.isArray(json?.features) ? base('tmap', request, 'no_route') : base('tmap', request, 'invalid_response');
    return base('tmap', request, 'ok', { totalMin });
  } catch { return base('tmap', request, 'network_error'); }
}

/** API-4-A 서버 proxy가 key를 주입해 소비할 실제 request/response 변환 경계. */
export function createRouteProviderClients(options: RouteProviderClientOptions = {}): RouteProviderClients {
  return {
    kakaoWalk: (request) => kakaoRoute('walk', { ...request, mode: 'walk' }, options),
    kakaoTransit: (request) => kakaoRoute('publictraffic', { ...request, mode: 'transit' }, options),
    tmapWalk: (request) => tmapWalkRoute({ ...request, mode: 'walk' }, options),
  };
}

export type ProviderBudget = { used: number; hardLimit: number; softLimit?: number; softLimitRatio?: number };
export type WalkProviderSelection = { provider: 'kakao' | 'tmap'; reason: 'cache_hit' | 'lower_usage_ratio' | 'deterministic_tie' } | { provider: null; reason: 'hard_limited' };
export function effectiveSoftLimit(budget: ProviderBudget): number { return budget.softLimit ?? Math.max(1, Math.floor(budget.hardLimit * (budget.softLimitRatio ?? 0.9))); }
export function chooseWalkProvider(input: { request: ProviderRouteRequest; kakao: ProviderBudget; tmap: ProviderBudget; cachedProvider?: 'kakao' | 'tmap' }): WalkProviderSelection {
  if (input.cachedProvider) return { provider: input.cachedProvider, reason: 'cache_hit' };
  const choices = (['kakao', 'tmap'] as const).filter((provider) => input[provider].used < input[provider].hardLimit);
  if (choices.length === 0) return { provider: null, reason: 'hard_limited' };
  if (choices.length === 1) return { provider: choices[0], reason: 'lower_usage_ratio' };
  const kr = input.kakao.used / effectiveSoftLimit(input.kakao), tr = input.tmap.used / effectiveSoftLimit(input.tmap);
  if (kr !== tr) return { provider: kr < tr ? 'kakao' : 'tmap', reason: 'lower_usage_ratio' };
  const key = `${input.request.origin.id}|${input.request.destination.id}|walk|${input.request.routeVersion}`;
  const hash = [...key].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 0);
  return { provider: hash % 2 === 0 ? 'kakao' : 'tmap', reason: 'deterministic_tie' };
}

export async function resolveWalkRoute(input: { request: ProviderRouteRequest; kakao: ProviderBudget; tmap: ProviderBudget; cachedProvider?: 'kakao' | 'tmap'; cachedResult?: ProviderRouteResult; clients: RouteProviderClients }): Promise<{ result: ProviderRouteResult; attempts: RouteProvider[]; selection: WalkProviderSelection }> {
  const selection = chooseWalkProvider(input);
  if (!selection.provider) return { result: base('kakao', { ...input.request, mode: 'walk' }, 'limited'), attempts: [], selection };
  if (input.cachedResult?.status === 'ok' && input.cachedResult.provider === selection.provider) {
    return { result: input.cachedResult, attempts: [], selection };
  }
  const first = selection.provider === 'kakao' ? await input.clients.kakaoWalk(input.request) : await input.clients.tmapWalk(input.request);
  if (first.status === 'ok') return { result: first, attempts: [selection.provider], selection };
  const secondProvider = selection.provider === 'kakao' ? 'tmap' : 'kakao';
  const secondBudget = input[secondProvider];
  if (secondBudget.used >= secondBudget.hardLimit) return { result: first, attempts: [selection.provider], selection };
  const second = secondProvider === 'kakao' ? await input.clients.kakaoWalk(input.request) : await input.clients.tmapWalk(input.request);
  return { result: second, attempts: [selection.provider, secondProvider], selection };
}

export async function resolveTransitRoute(input: { request: ProviderRouteRequest; kakao: ProviderBudget; clients: RouteProviderClients }): Promise<{ result: ProviderRouteResult; attempts: RouteProvider[] }> {
  const request = { ...input.request, mode: 'transit' as const };
  if (input.kakao.used >= input.kakao.hardLimit) return { result: base('kakao', request, 'limited'), attempts: [] };
  return { result: await input.clients.kakaoTransit(request), attempts: ['kakao'] };
}

/** 새 자동 선택에서 ODsay·TMAP transit은 호출 대상이 아님을 명시한다. */
export function disabledRouteProvider(provider: 'odsay' | 'tmap', request: ProviderRouteRequest): ProviderRouteResult {
  return base(provider, request, 'disabled');
}
