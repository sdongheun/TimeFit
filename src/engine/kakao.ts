// Kakao Local REST API 클라이언트: 장소 검색 + 주소 지오코딩 + 역지오코딩
import { LatLon } from './types';
import { haversineKm, Poi } from './travel';
import { lineLabelsFromProviderCategoryFields, matchPlaceNameQuery } from '../services/placeNameSemanticMatch';

const KAKAO_REST_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY
  ?? process.env.KAKAO_REST_API_KEY
  ?? process.env.KaKao_REST_API_KEY
  ?? '';

type KakaoDocument = {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  road_address?: { address_name?: string };
  address?: { address_name?: string };
  x?: string;
  y?: string;
  category_group_code?: string;
  category_name?: string;
};

export type PlaceSearchProvider = 'kakao' | 'tmap';
export type PlaceSearchStatus = 'ok' | 'unconfigured' | 'http_error' | 'network_error' | 'invalid_response';
export type PlaceSearchResult = {
  provider: PlaceSearchProvider;
  status: PlaceSearchStatus;
  pois: Poi[];
  /** HTTP 상태만 보존하며 응답 본문·키·검색어·좌표는 절대 담지 않는다. */
  statusCode?: number;
  metrics?: PlaceSearchMetrics;
};
export type PlaceSearchMetrics = { rawPoiCount: number; directNameMatchCount: number; mappingValidCount: number };

export type PlaceSearchObserver = (event: Pick<PlaceSearchResult, 'provider' | 'status'> & { resultCount: number }) => void;
export type KakaoPoiSearchOptions = { fetcher?: typeof fetch; apiKey?: string; observe?: PlaceSearchObserver };
export type KakaoReverseGeocodeResult = Pick<PlaceSearchResult, 'provider' | 'status' | 'statusCode'> & {
  /** Kakao가 제공한 도로명 또는 지번 주소만 보존한다. */
  label?: string;
  address?: string;
};

const kakaoHeaders = () => ({ Authorization: `KakaoAK ${KAKAO_REST_KEY}` });

function toPoi(doc: KakaoDocument, fallbackName: string): Poi | null {
  const lat = Number(doc.y);
  const lon = Number(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const name = doc.place_name || doc.road_address_name || doc.address_name || fallbackName;
  const addr = doc.road_address_name || doc.address_name || '카카오';
  const transit = doc.category_group_code === 'SW8' || /지하철|역|정류장/.test(doc.category_name ?? '');
  const lineLabels = lineLabelsFromProviderCategoryFields([doc.category_name, doc.category_group_code]);
  return transit
    ? { name, lat, lon, addr, providerMetadata: { placeType: 'transit_place', ...(lineLabels ? { lineLabels } : {}), labelSource: 'provider' } }
    : { name, lat, lon, addr };
}

function observe(result: PlaceSearchResult, callback?: PlaceSearchObserver): PlaceSearchResult {
  const event = { provider: result.provider, status: result.status, resultCount: result.pois.length };
  callback?.(event);
  if (process.env.NODE_ENV === 'development') console.info(`[place-search] ${event.provider} ${event.status} ${event.resultCount}`);
  return result;
}

export function placeSearchMetrics(keyword: string, rawPoiCount: number, pois: readonly Poi[]): PlaceSearchMetrics {
  const normalizedKeyword = keyword.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  return {
    rawPoiCount,
    mappingValidCount: pois.length,
    directNameMatchCount: normalizedKeyword ? pois.filter((poi) => matchPlaceNameQuery(keyword, poi.name) !== 'none').length : 0,
  };
}

async function kakaoGet(path: string, params: Record<string, string | number>, options: KakaoPoiSearchOptions = {}): Promise<PlaceSearchResult & { documents?: KakaoDocument[] }> {
  const key = options.apiKey ?? KAKAO_REST_KEY;
  if (!key) return observe({ provider: 'kakao', status: 'unconfigured', pois: [], metrics: placeSearchMetrics('', 0, []) }, options.observe);
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  try {
    const res = await (options.fetcher ?? fetch)(`https://dapi.kakao.com/v2/local/${path}?${qs}`, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return observe({ provider: 'kakao', status: 'http_error', pois: [], statusCode: res.status, metrics: placeSearchMetrics('', 0, []) }, options.observe);
    let json: unknown;
    try { json = await res.json(); } catch { return observe({ provider: 'kakao', status: 'invalid_response', pois: [], metrics: placeSearchMetrics('', 0, []) }, options.observe); }
    if (!Array.isArray((json as { documents?: unknown })?.documents)) return observe({ provider: 'kakao', status: 'invalid_response', pois: [], metrics: placeSearchMetrics('', 0, []) }, options.observe);
    return { provider: 'kakao', status: 'ok', pois: [], documents: (json as { documents: KakaoDocument[] }).documents };
  } catch {
    return observe({ provider: 'kakao', status: 'network_error', pois: [], metrics: placeSearchMetrics('', 0, []) }, options.observe);
  }
}

function dedupePois(list: Poi[]): Poi[] {
  const seen = new Set<string>();
  const out: Poi[] = [];
  for (const p of list) {
    const key = `${p.name.replace(/\s/g, '').toLowerCase()}|${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function kakaoPoiScore(p: Poi, keyword: string, center?: LatLon): number {
  const q = keyword.replace(/\s/g, '').toLowerCase();
  const name = p.name.replace(/\s/g, '').toLowerCase();
  let score = 0;
  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 700;
  else if (name.includes(q)) score += 400;
  if (p.addr.startsWith('부산')) score += 80;
  if (center) score -= Math.min(160, haversineKm(center, p) * 3);
  return score;
}

export async function kakaoPoiSearchMulti(keyword: string, center?: LatLon, count = 5): Promise<Poi[]> {
  return (await kakaoPoiSearchMultiResult(keyword, center, count)).pois;
}

export async function kakaoPoiSearchMultiResult(keyword: string, center?: LatLon, count = 5, options: KakaoPoiSearchOptions = {}): Promise<PlaceSearchResult> {
  if (!keyword.trim()) return observe({ provider: 'kakao', status: 'ok', pois: [], metrics: placeSearchMetrics('', 0, []) }, options.observe);
  const baseParams: Record<string, string | number> = {
    query: keyword.trim(),
    size: Math.min(15, Math.max(1, count * 3)),
  };
  // 장소명 선택은 중심좌표 기반 주변 정렬과 분리한다. 관련성은 제공사 keyword 결과와 UI 이름 필터만 사용한다.
  const params = baseParams;

  const response = await kakaoGet('search/keyword.json', params, options);
  if (response.status !== 'ok') return response;
  const pois = (response.documents ?? []).map((doc) => toPoi(doc, keyword)).filter((p): p is Poi => !!p);
  const result = dedupePois(pois)
    .sort((a, b) => kakaoPoiScore(b, keyword, center) - kakaoPoiScore(a, keyword, center))
    .slice(0, count);
  return observe({ provider: 'kakao', status: 'ok', pois: result, metrics: placeSearchMetrics(keyword, response.documents?.length ?? 0, pois) }, options.observe);
}

export async function kakaoGeocodeAddr(fullAddr: string, count = 3): Promise<Poi[]> {
  return (await kakaoAddressSearchResult(fullAddr, count)).pois;
}

/** 상태형 Kakao 주소 검색. 위치 선택 adapter가 keyword 검색과 같은 실패 경계를 사용한다. */
export async function kakaoAddressSearchResult(fullAddr: string, count = 3, options: KakaoPoiSearchOptions = {}): Promise<PlaceSearchResult> {
  if (!fullAddr.trim()) return observe({ provider: 'kakao', status: 'ok', pois: [], metrics: placeSearchMetrics('', 0, []) }, options.observe);
  const result = await kakaoGet('search/address.json', { query: fullAddr.trim(), size: Math.min(10, Math.max(1, count)) }, options);
  if (result.status !== 'ok') return result;
  const pois = (result.documents ?? []).map((doc) => toPoi(doc, fullAddr)).filter((p): p is Poi => !!p).slice(0, count);
  return observe({ provider: 'kakao', status: 'ok', pois, metrics: placeSearchMetrics(fullAddr, result.documents?.length ?? 0, pois) }, options.observe);
}

export async function kakaoReverseGeocode(lat: number, lon: number): Promise<string | null> {
  return (await kakaoReverseGeocodeResult(lat, lon)).address ?? null;
}

/** 핀 확정용 상태형 Kakao 역지오코딩. 좌표와 원문 응답은 반환하지 않는다. */
export async function kakaoReverseGeocodeResult(lat: number, lon: number, options: KakaoPoiSearchOptions = {}): Promise<KakaoReverseGeocodeResult> {
  const result = await kakaoGet('geo/coord2address.json', { x: lon, y: lat }, options);
  if (result.status !== 'ok') {
    return result.statusCode === undefined
      ? { provider: 'kakao', status: result.status }
      : { provider: 'kakao', status: result.status, statusCode: result.statusCode };
  }
  const docs = result.documents ?? [];
  const doc = docs[0];
  const address = doc?.road_address?.address_name || doc?.address?.address_name || doc?.road_address_name || doc?.address_name;
  return address ? { provider: 'kakao', status: 'ok', label: address, address } : { provider: 'kakao', status: 'ok' };
}

/** 주소가 없는 좌표의 행정구역 fallback. provider address_name 외에는 라벨로 쓰지 않는다. */
export async function kakaoRegionCodeResult(lat: number, lon: number, options: KakaoPoiSearchOptions = {}): Promise<KakaoReverseGeocodeResult> {
  const result = await kakaoGet('geo/coord2regioncode.json', { x: lon, y: lat }, options);
  if (result.status !== 'ok') {
    return result.statusCode === undefined
      ? { provider: 'kakao', status: result.status }
      : { provider: 'kakao', status: result.status, statusCode: result.statusCode };
  }
  const address = result.documents?.[0]?.address_name;
  return address ? { provider: 'kakao', status: 'ok', label: address, address } : { provider: 'kakao', status: 'ok' };
}

export function hasKakaoRestKey(): boolean {
  return !!KAKAO_REST_KEY;
}
