import {
  kakaoAddressSearchResult,
  kakaoPoiSearchMultiResult,
  type PlaceSearchResult,
} from '../engine/kakao';
import type { Poi } from '../engine/travel';

export type LocationSearchKind = 'place' | 'address';
export type LocationSuggestion = {
  kind: LocationSearchKind;
  provider: 'kakao';
  label: string;
  lat: number;
  lon: number;
  address: string;
  labelSource: 'provider';
  addressSource: 'provider';
  /** Kakao 원문 카테고리에서 변환된 노선 근거만 보존한다. */
  providerLineLabels?: string[];
};
export type LocationSearchCacheState = 'miss' | 'hit' | 'shared_in_flight';
export type LocationSearchDiagnostics = {
  providerRequests: { kakao: Record<LocationSearchKind, number>; tmap: 0 };
  fallbackCount: number;
  cache: LocationSearchCacheState;
};
export type KakaoLocationSearchResult = {
  suggestions: LocationSuggestion[];
  attempts: Array<Pick<PlaceSearchResult, 'provider' | 'status' | 'statusCode'>>;
  diagnostics: LocationSearchDiagnostics;
};

type Searcher = (query: string) => Promise<PlaceSearchResult>;
type InternalResult = Omit<KakaoLocationSearchResult, 'diagnostics'>
  & Omit<LocationSearchDiagnostics, 'cache'>
  & { cacheable: boolean };
export type KakaoLocationSearchAdapterOptions = {
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
  searchers?: Partial<Record<LocationSearchKind, Searcher>>;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;

export function classifyLocationQuery(query: string): LocationSearchKind {
  const compact = query.toLowerCase().replace(/\s/g, '');
  if (!compact) return 'place';
  const hasRoad = /[0-9a-z가-힣]+(?:대로|로|길)/.test(compact);
  const hasLotNumber = /\d+(?:-\d+)?번지/.test(compact);
  const hasDongOrRi = query.trim().split(/\s+/).some((token) => /^[가-힣]+(?:동|리)$/.test(token));
  return hasRoad || hasLotNumber || hasDongOrRi ? 'address' : 'place';
}

function normalizedCacheQuery(query: string): string {
  return query.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function toSuggestion(kind: LocationSearchKind, poi: Poi): LocationSuggestion {
  return {
    kind,
    provider: 'kakao',
    label: poi.name,
    lat: poi.lat,
    lon: poi.lon,
    address: poi.addr,
    labelSource: 'provider',
    addressSource: 'provider',
    ...(poi.providerMetadata?.lineLabels ? { providerLineLabels: [...poi.providerMetadata.lineLabels] } : {}),
  };
}

function publicAttempt(result: PlaceSearchResult) {
  return result.statusCode === undefined
    ? { provider: result.provider, status: result.status }
    : { provider: result.provider, status: result.status, statusCode: result.statusCode };
}

export function createKakaoLocationSearchAdapter(options: KakaoLocationSearchAdapterOptions = {}) {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const searchers: Record<LocationSearchKind, Searcher> = {
    place: options.searchers?.place ?? ((query) => kakaoPoiSearchMultiResult(query, undefined, 10)),
    address: options.searchers?.address ?? ((query) => kakaoAddressSearchResult(query, 10)),
  };
  const cache = new Map<string, { expiresAt: number; value: InternalResult }>();
  const inFlight = new Map<string, Promise<InternalResult>>();

  const remember = (key: string, value: InternalResult) => {
    cache.delete(key);
    cache.set(key, { expiresAt: now() + ttlMs, value });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
  };

  const withDiagnostics = (value: InternalResult, cacheState: LocationSearchCacheState): KakaoLocationSearchResult => ({
    suggestions: value.suggestions.map((suggestion) => ({ ...suggestion, ...(suggestion.providerLineLabels ? { providerLineLabels: [...suggestion.providerLineLabels] } : {}) })),
    attempts: value.attempts.map((attempt) => ({ ...attempt })),
    diagnostics: { providerRequests: { kakao: { ...value.providerRequests.kakao }, tmap: 0 }, fallbackCount: value.fallbackCount, cache: cacheState },
  });

  async function perform(query: string, firstKind: LocationSearchKind): Promise<InternalResult> {
    const first = await searchers[firstKind](query);
    const providerRequests: InternalResult['providerRequests'] = { kakao: { place: 0, address: 0 }, tmap: 0 };
    providerRequests.kakao[firstKind] += 1;
    const attempts = [publicAttempt(first)];
    let suggestions = first.pois.map((poi) => toSuggestion(firstKind, poi));
    let fallbackCount = 0;
    if (first.status === 'ok' && suggestions.length === 0) {
      const fallbackKind: LocationSearchKind = firstKind === 'place' ? 'address' : 'place';
      const fallback = await searchers[fallbackKind](query);
      providerRequests.kakao[fallbackKind] += 1;
      fallbackCount = 1;
      attempts.push(publicAttempt(fallback));
      suggestions = fallback.pois.map((poi) => toSuggestion(fallbackKind, poi));
    }
    return {
      suggestions,
      attempts,
      providerRequests,
      fallbackCount,
      // 실패는 UI의 명시 재시도를 막지 않는다. ok + 0건은 정상 검색 결과이므로 cache할 수 있다.
      cacheable: attempts.every((attempt) => attempt.status === 'ok'),
    };
  }

  return {
    async search(query: string): Promise<KakaoLocationSearchResult> {
      const firstKind = classifyLocationQuery(query);
      const cacheKey = `${firstKind}:${normalizedCacheQuery(query)}`;
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > now()) {
        cache.delete(cacheKey);
        cache.set(cacheKey, cached);
        return withDiagnostics(cached.value, 'hit');
      }
      if (cached) cache.delete(cacheKey);
      const existing = inFlight.get(cacheKey);
      if (existing) return withDiagnostics(await existing, 'shared_in_flight');
      const pending = perform(query, firstKind).then((value) => {
        if (value.cacheable) remember(cacheKey, value);
        return value;
      }).finally(() => inFlight.delete(cacheKey));
      inFlight.set(cacheKey, pending);
      return withDiagnostics(await pending, 'miss');
    },
  };
}
