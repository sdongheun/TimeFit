import {
  kakaoRegionCodeResult,
  kakaoReverseGeocodeResult,
  type KakaoPoiSearchOptions,
  type KakaoReverseGeocodeResult,
} from '../engine/kakao';

export type LocationLabelPurpose = 'gps_auto' | 'pin_confirm';
export type LocationLabelPoint = { lat: number; lon: number };
export type LocationLabelSource = 'address' | 'region' | 'unresolved';
export type LocationLabelCacheState = 'miss' | 'hit' | 'shared_in_flight';
export type KakaoLocationLabelResult = Pick<KakaoReverseGeocodeResult, 'provider' | 'status' | 'statusCode' | 'label' | 'address'> & {
  source: LocationLabelSource;
  diagnostics: {
    providerRequests: { address: 0 | 1; region: 0 | 1; tmap: 0 };
    cache: LocationLabelCacheState;
  };
};

type Resolver = (point: LocationLabelPoint) => Promise<KakaoReverseGeocodeResult>;
type InternalResult = Omit<KakaoLocationLabelResult, 'diagnostics'> & {
  providerRequests: { address: 0 | 1; region: 0 | 1; tmap: 0 };
  cacheable: boolean;
};
export type KakaoLocationLabelAdapterOptions = {
  now?: () => number;
  ttlMs?: number;
  maxEntries?: number;
  addressResolver?: Resolver;
  regionResolver?: Resolver;
  kakaoOptions?: KakaoPoiSearchOptions;
};

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 64;

function internalPointKey(point: LocationLabelPoint): string {
  // 앱 프로세스 메모리에서만 쓰는 정규화 key이며 결과·진단·로그에는 포함하지 않는다.
  return `${point.lat.toFixed(5)}:${point.lon.toFixed(5)}`;
}

function failure(result: KakaoReverseGeocodeResult, providerRequests: InternalResult['providerRequests']): InternalResult {
  return {
    provider: 'kakao',
    status: result.status,
    ...(result.statusCode === undefined ? {} : { statusCode: result.statusCode }),
    source: 'unresolved',
    providerRequests,
    cacheable: false,
  };
}

export function createKakaoLocationLabelAdapter(options: KakaoLocationLabelAdapterOptions = {}) {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? TTL_MS;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;
  const addressResolver = options.addressResolver
    ?? ((point: LocationLabelPoint) => kakaoReverseGeocodeResult(point.lat, point.lon, options.kakaoOptions));
  const regionResolver = options.regionResolver
    ?? ((point: LocationLabelPoint) => kakaoRegionCodeResult(point.lat, point.lon, options.kakaoOptions));
  const cache = new Map<string, { expiresAt: number; value: InternalResult }>();
  const inFlight = new Map<string, Promise<InternalResult>>();

  const present = (value: InternalResult, cacheState: LocationLabelCacheState): KakaoLocationLabelResult => ({
    provider: value.provider,
    status: value.status,
    ...(value.statusCode === undefined ? {} : { statusCode: value.statusCode }),
    ...(value.label === undefined ? {} : { label: value.label }),
    ...(value.address === undefined ? {} : { address: value.address }),
    source: value.source,
    diagnostics: { providerRequests: value.providerRequests, cache: cacheState },
  });

  const remember = (key: string, value: InternalResult) => {
    cache.delete(key);
    cache.set(key, { expiresAt: now() + ttlMs, value });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value as string);
  };

  async function resolveMiss(point: LocationLabelPoint): Promise<InternalResult> {
    const address = await addressResolver(point);
    const requests: InternalResult['providerRequests'] = {
      address: address.status === 'unconfigured' ? 0 : 1,
      region: 0,
      tmap: 0,
    };
    if (address.status !== 'ok') return failure(address, requests);
    if (address.address) {
      return { ...address, source: 'address', providerRequests: requests, cacheable: true };
    }

    const region = await regionResolver(point);
    requests.region = region.status === 'unconfigured' ? 0 : 1;
    if (region.status !== 'ok') return failure(region, requests);
    if (region.address) {
      return { ...region, source: 'region', providerRequests: requests, cacheable: true };
    }
    return { provider: 'kakao', status: 'ok', source: 'unresolved', providerRequests: requests, cacheable: true };
  }

  return {
    async resolve(point: LocationLabelPoint, purpose: LocationLabelPurpose): Promise<KakaoLocationLabelResult> {
      // purpose는 UI 호출 의도 제어값이다. 제공사·요청·cache key·결과에는 영향을 주지 않는다.
      void purpose;
      const key = internalPointKey(point);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now()) {
        cache.delete(key);
        cache.set(key, cached);
        return present(cached.value, 'hit');
      }
      if (cached) cache.delete(key);
      const shared = inFlight.get(key);
      if (shared) return present(await shared, 'shared_in_flight');
      const pending = resolveMiss(point).then((value) => {
        if (value.cacheable) remember(key, value);
        return value;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
      return present(await pending, 'miss');
    },
  };
}
