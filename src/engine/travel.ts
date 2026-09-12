// 이동시간: TMAP REST(보행/자동차) + haversine 폴백 + 좌표쌍 캐시
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLon, Mode, RoadMode } from './types';
import type { RouteBaseline } from './actualRouteSearchScope';
import { createRouteBaselineService, type RouteBaselineResult } from './routeBaselineService';
import type { PlaceSearchObserver, PlaceSearchResult } from './kakao';
import { lineLabelsFromProviderCategoryFields, matchPlaceNameQuery } from '../services/placeNameSemanticMatch';

const TMAP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY;
const ROUTE_USAGE_KEY = 'timefit:tmap-route-usage:v1';

/** legacy route transport가 실제 HTTP 직전에만 사용하는 호출 관찰·취소 경계다. */
export type LegacyRouteTransportObserver = {
  recordProviderHttpAttempt(provider: 'tmap' | 'odsay'): boolean;
};

export async function attemptLegacyRouteHttp<T>(
  provider: 'tmap' | 'odsay',
  observer: LegacyRouteTransportObserver | undefined,
  request: () => Promise<T>,
): Promise<T | undefined> {
  if (provider === 'odsay') return undefined; // deprecated transport: never invoke a request
  if (observer && !observer.recordProviderHttpAttempt(provider)) return undefined;
  return request();
}

type RouteUsageStats = {
  date: string;
  total: number;
  ok: number;
  fail: number;
  byMode: Record<RoadMode, number>;
};
type OdsayTransitUsageStats = {
  date: string;
  total: number;
  ok: number;
  fail: number;
};

declare global {
  // 개발 중 Fast Refresh가 발생해도 같은 JS 런타임에서는 일일 카운터를 이어간다.
  // AsyncStorage에도 저장해 앱/Metro 재시작 후 같은 날짜 기준으로 유지한다.
  // eslint-disable-next-line no-var
  var __TIMEFIT_TMAP_ROUTE_USAGE__: RouteUsageStats | undefined;
}

const todayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function routeUsage(): RouteUsageStats {
  const today = todayKey();
  const current = globalThis.__TIMEFIT_TMAP_ROUTE_USAGE__;
  if (!current || current.date !== today) {
    const fresh: RouteUsageStats = {
      date: today,
      total: 0,
      ok: 0,
      fail: 0,
      byMode: { walk: 0, car: 0 },
    };
    globalThis.__TIMEFIT_TMAP_ROUTE_USAGE__ = fresh;
    return fresh;
  }
  return current;
}

async function loadRouteUsage(): Promise<RouteUsageStats> {
  const today = todayKey();
  try {
    const raw = await AsyncStorage.getItem(ROUTE_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RouteUsageStats>;
      if (
        parsed.date === today
        && Number.isFinite(parsed.total)
        && Number.isFinite(parsed.ok)
        && Number.isFinite(parsed.fail)
      ) {
        const usage: RouteUsageStats = {
          date: today,
          total: parsed.total ?? 0,
          ok: parsed.ok ?? 0,
          fail: parsed.fail ?? 0,
          byMode: {
            walk: parsed.byMode?.walk ?? 0,
            car: parsed.byMode?.car ?? 0,
          },
        };
        globalThis.__TIMEFIT_TMAP_ROUTE_USAGE__ = usage;
        return usage;
      }
    }
  } catch {
    return routeUsage();
  }

  const usage: RouteUsageStats = {
    date: today,
    total: 0,
    ok: 0,
    fail: 0,
    byMode: { walk: 0, car: 0 },
  };
  globalThis.__TIMEFIT_TMAP_ROUTE_USAGE__ = usage;
  await saveRouteUsage(usage);
  return usage;
}

async function saveRouteUsage(usage: RouteUsageStats) {
  try {
    await AsyncStorage.setItem(ROUTE_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // 저장소 접근이 불가능한 환경에서는 메모리 카운터만 유지한다.
  }
}

async function routeUsagePersistent(): Promise<RouteUsageStats> {
  const current = globalThis.__TIMEFIT_TMAP_ROUTE_USAGE__;
  if (current?.date === todayKey()) return current;
  return loadRouteUsage();
}

const modeLabel = (mode: RoadMode) => (mode === 'walk' ? '도보' : '자동차');

async function markRouteCall(mode: RoadMode): Promise<number> {
  const usage = await routeUsagePersistent();
  usage.total += 1;
  usage.byMode[mode] += 1;
  await saveRouteUsage(usage);
  console.log(
    `[route_request] provider=tmap mode=${mode} count=${usage.total}`,
  );
  return usage.total;
}

async function markRouteResult(callNo: number, mode: RoadMode, ok: boolean, min?: number) {
  const usage = await routeUsagePersistent();
  if (ok) usage.ok += 1;
  else usage.fail += 1;
  await saveRouteUsage(usage);
  console.log(
    `[TMAP 경로 API] 응답 #${callNo} · ${ok ? '성공' : '실패'}`
    + `${ok && Number.isFinite(min) ? ` ${min}분` : ''} · 오늘 누적 성공 ${usage.ok}, 실패 ${usage.fail}, 총 ${usage.total}건 `
    + `(${modeLabel(mode)})`,
  );
}

export async function getTmapRouteUsage(): Promise<RouteUsageStats> {
  const usage = await routeUsagePersistent();
  return { ...usage, byMode: { ...usage.byMode } };
}

/** @deprecated ODsay 신규 요청 제거. 기존 진단 호출자용 zero-only 호환이다. */
export async function getOdsayTransitUsage(): Promise<OdsayTransitUsageStats> {
  return { date: todayKey(), total: 0, ok: 0, fail: 0 };
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371, t = (d: number) => (d * Math.PI) / 180;
  const dLat = t(b.lat - a.lat), dLon = t(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const MODE: Record<Mode, { circ: number; kmh: number; fix: number }> = {
  walk: { circ: 1.25, kmh: 4.5, fix: 0 },
  car: { circ: 1.3, kmh: 25, fix: 3 },
  transit: { circ: 1.45, kmh: 18, fix: 8 },
};

export function haversineMin(a: LatLon, b: LatLon, mode: Mode): number {
  const km = haversineKm(a, b);
  if (km < 0.03) return 0;
  // 짧은 구간의 대중교통은 접근·대기보다 도보가 현실적이므로 도보 근사로 본다.
  // 차량까지 도보 시간을 재사용하면 수단 선택 UI가 모두 같은 시간으로 보인다.
  const use = mode === 'transit' && km < 0.8 ? MODE.walk : MODE[mode];
  return Math.round((km * use.circ) / use.kmh * 60 + use.fix);
}

// TMAP 경로: 소요시간 + 경로좌표(geometry) — geometry는 지도 실경로 표시용
async function tmapTravel(
  a: LatLon,
  b: LatLon,
  mode: RoadMode,
  observer?: LegacyRouteTransportObserver,
): Promise<{ min: number; geo: LatLon[] } | null> {
  if (!TMAP_KEY) return null;
  return (await attemptLegacyRouteHttp('tmap', observer, async () => {
    const callNo = await markRouteCall(mode);
    const ped = mode === 'walk';
    const url = ped
      ? 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json'
      : 'https://apis.openapi.sk.com/tmap/routes?version=1&format=json';
    const body: any = {
      startX: a.lon, startY: a.lat, endX: b.lon, endY: b.lat,
      reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
      startName: encodeURIComponent('출발'), endName: encodeURIComponent('도착'),
    };
    if (!ped) { body.searchOption = '0'; body.trafficInfo = 'N'; }
    try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { appKey: TMAP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await markRouteResult(callNo, mode, false);
      return null;
    }
    const j = await res.json();
    const sec = j?.features?.[0]?.properties?.totalTime;
    if (!Number.isFinite(sec)) {
      await markRouteResult(callNo, mode, false);
      return null;
    }
    // LineString/MultiLineString feature들의 좌표([lon,lat])를 이어붙여 실경로 구성
    const geo: LatLon[] = [];
    for (const f of j.features ?? []) {
      const geometry = f?.geometry;
      const lines = geometry?.type === 'LineString'
        ? [geometry.coordinates]
        : geometry?.type === 'MultiLineString'
          ? geometry.coordinates
          : [];
      for (const line of lines) {
        for (const c of line ?? []) {
          const lon = parseFloat(c[0]), lat = parseFloat(c[1]);
          const last = geo[geo.length - 1];
          if (!isNaN(lat) && !isNaN(lon) && (!last || last.lat !== lat || last.lon !== lon)) geo.push({ lat, lon });
        }
      }
    }
    // 시간만 있고 선형 좌표가 없으면 지도에서는 실경로를 표시할 수 없다.
    if (geo.length < 2) {
      await markRouteResult(callNo, mode, false);
      return null;
    }
    const min = Math.round(sec / 60);
    await markRouteResult(callNo, mode, true, min);
    return { min, geo };
    } catch {
      await markRouteResult(callNo, mode, false);
      return null;
    }
  })) ?? null;
}

// 기존 성능 cache의 재사용 TTL. provider 약관상 허용/물리 삭제 기한의 증명이 아니다.
const TTL_MS = 24 * 60 * 60 * 1000;
type CacheEntry = { min: number; src: string; geo?: LatLon[]; ts: number };
const cache = new Map<string, CacheEntry>();
// ⚠️ 모드 포함 필수 — 좌표만 키로 쓰면 도보 시간을 자차로 잘못 재사용
const ckey = (a: LatLon, b: LatLon, mode: Mode) => `${mode}|${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
const getCache = (k: string): CacheEntry | undefined => {
  const e = cache.get(k);
  if (e && Date.now() - e.ts > TTL_MS) { cache.delete(k); return undefined; }
  return e;
};

export type PrecomputeStat = { ok: number; fail: number; skipped?: number };

// 필요한 좌표쌍을 TMAP로 채움(실패 시 haversine 캐시) — 지연 정밀화: 최종 코스 구간에만 호출
export async function precompute(
  pairs: [LatLon, LatLon][],
  mode: RoadMode,
  options: { retryFallback?: boolean; transportObserver?: LegacyRouteTransportObserver } = {},
): Promise<PrecomputeStat> {
  let ok = 0, fail = 0;
  let cacheHit = 0;
  for (const [a, b] of pairs) {
    const k = ckey(a, b, mode);
    const cached = getCache(k);
    // TMAP 오류로 저장된 직선 추정값은 장바구니 최종 검토에서만 다시 시도한다.
    if (cached && !(options.retryFallback && cached.src === 'haversine')) { cacheHit++; continue; }
    const t = await tmapTravel(a, b, mode, options.transportObserver);
    if (t != null) { cache.set(k, { min: t.min, src: 'TMAP', geo: t.geo, ts: Date.now() }); ok++; }
    else { cache.set(k, { min: haversineMin(a, b, mode), src: 'haversine', ts: Date.now() }); fail++; }
  }
  if (ok + fail > 0 || cacheHit > 0) {
    const usage = routeUsage();
    console.log(
      `[TMAP 경로 API] 배치 완료 · ${modeLabel(mode)} 신규 ${ok + fail}건, 캐시 ${cacheHit}건 `
      + `· 오늘 총 ${usage.total}건`,
    );
  }
  return { ok, fail };
}

type TransitMeta = {
  pathType: number;
  totalTime: number;
  payment: number;
  busTransitCount: number;
  subwayTransitCount: number;
  totalWalk: number;
  firstStartStation: string;
  lastEndStation: string;
  summary: string;
  geo?: LatLon[];
};
/** @deprecated 신규 transit 공급자는 서비스의 Kakao proxy를 사용한다. 네트워크·근사 성공 없음. */
export async function precomputeTransit(
  pairs: [LatLon, LatLon][],
  _options: { retryFallback?: boolean; transportObserver?: LegacyRouteTransportObserver } = {},
): Promise<PrecomputeStat> {
  return { ok: 0, fail: pairs.length, skipped: 0 };
}

export function travelMin(a: LatLon, b: LatLon, mode: Mode): number {
  if (mode === 'transit') return Infinity;
  return getCache(ckey(a, b, mode))?.min ?? haversineMin(a, b, mode);
}
export function travelSrc(a: LatLon, b: LatLon, mode: Mode): string {
  if (mode === 'transit') return 'transit_fallback';
  return getCache(ckey(a, b, mode))?.src ?? 'haversine';
}
export function travelGeo(a: LatLon, b: LatLon, mode: Mode): LatLon[] | undefined {
  if (mode === 'transit') return undefined;
  return getCache(ckey(a, b, mode))?.geo;
}
export function transitMeta(_a: LatLon, _b: LatLon): TransitMeta | undefined {
  return undefined;
}

// 추천 후보 범위용 기준 경로. 실패한 근사 경로는 반환하지 않는다.
// 실제 호출·캐시 정책은 routeBaselineService에 있고, 이 함수는 TMAP 캐시만 어댑터로 연결한다.
async function fetchRouteBaseline(origin: LatLon, destination: LatLon, mode: Mode): Promise<RouteBaseline | null> {
  if (mode === 'transit') return null;

  await precompute([[origin, destination]], mode, { retryFallback: true });
  const geometry = travelGeo(origin, destination, mode);
  return travelSrc(origin, destination, mode) === 'TMAP' && geometry && geometry.length >= 2
    ? { mode, geometry }
    : null;
}

const routeBaselineService = createRouteBaselineService({
  fetcher: { fetch: fetchRouteBaseline },
  storage: AsyncStorage,
});

export function getActualRouteBaselines(origin: LatLon, destination: LatLon): Promise<RouteBaselineResult> {
  return routeBaselineService.get(origin, destination);
}

// TMAP POI 통합검색: 장소명 → 좌표 후보 (center 지정 시 가까운 순)
export type Poi = { name: string; lat: number; lon: number; addr: string; providerMetadata?: { placeType?: 'transit_place'; lineLabels?: string[]; labelSource: 'provider' } };
export type TmapPoiSearchOptions = { fetcher?: typeof fetch; apiKey?: string; observe?: PlaceSearchObserver };

function observeTmap(result: PlaceSearchResult, callback?: PlaceSearchObserver): PlaceSearchResult {
  const event = { provider: result.provider, status: result.status, resultCount: result.pois.length };
  callback?.(event);
  if (process.env.NODE_ENV === 'development') console.info(`[place-search] ${event.provider} ${event.status} ${event.resultCount}`);
  return result;
}

function tmapSearchMetrics(keyword: string, rawPoiCount: number, pois: readonly Poi[]) {
  const query = keyword.toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  return { rawPoiCount, mappingValidCount: pois.length, directNameMatchCount: query ? pois.filter((poi) => matchPlaceNameQuery(keyword, poi.name) !== 'none').length : 0 };
}

/** 상태형 TMAP 장소명 검색. 기존 Poi[] 호출은 poiSearchMulti를 계속 사용한다. */
export async function tmapPoiSearchMultiResult(keyword: string, center?: LatLon, count = 5, options: TmapPoiSearchOptions = {}): Promise<PlaceSearchResult> {
  const key = options.apiKey ?? TMAP_KEY;
  if (!key) return observeTmap({ provider: 'tmap', status: 'unconfigured', pois: [], metrics: tmapSearchMetrics('', 0, []) }, options.observe);
  if (!keyword.trim()) return observeTmap({ provider: 'tmap', status: 'ok', pois: [], metrics: tmapSearchMetrics('', 0, []) }, options.observe);
  const params: Record<string, string> = {
    version: '1', searchKeyword: keyword.trim(), count: String(Math.max(1, count)),
    resCoordType: 'WGS84GEO', reqCoordType: 'WGS84GEO',
  };
  // 장소명 검색은 반경 기반 주변 POI 모드와 분리한다. center는 이 API 경계에서 전송하지 않는다.
  try {
    const res = await (options.fetcher ?? fetch)(`https://apis.openapi.sk.com/tmap/pois?${new URLSearchParams(params)}`, { headers: { appKey: key } });
    if (!res.ok) return observeTmap({ provider: 'tmap', status: 'http_error', pois: [], statusCode: res.status, metrics: tmapSearchMetrics('', 0, []) }, options.observe);
    let json: any;
    try { json = await res.json(); } catch { return observeTmap({ provider: 'tmap', status: 'invalid_response', pois: [], metrics: tmapSearchMetrics('', 0, []) }, options.observe); }
    const raw = json?.searchPoiInfo?.pois?.poi;
    if (raw === undefined || raw === null) return observeTmap({ provider: 'tmap', status: 'invalid_response', pois: [], metrics: tmapSearchMetrics('', 0, []) }, options.observe);
    const list = Array.isArray(raw) ? raw : [raw];
    const pois: Poi[] = [];
    for (const p of list) {
      const lat = parseFloat(p.frontLat ?? p.noorLat), lon = parseFloat(p.frontLon ?? p.noorLon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const category = String(p.poiCateName ?? p.categoryName ?? '');
        const lineLabels = lineLabelsFromProviderCategoryFields([p.poiCateName, p.categoryName]);
        const base = { name: p.name, lat, lon, addr: [p.upperAddrName, p.middleAddrName, p.lowerAddrName].filter(Boolean).join(' ') };
        pois.push(/역|정류장|지하철|경전철/.test(category)
          ? { ...base, providerMetadata: { placeType: 'transit_place', ...(lineLabels ? { lineLabels } : {}), labelSource: 'provider' } }
          : base);
      }
    }
    return observeTmap({ provider: 'tmap', status: 'ok', pois, metrics: tmapSearchMetrics(keyword, list.length, pois) }, options.observe);
  } catch {
    return observeTmap({ provider: 'tmap', status: 'network_error', pois: [], metrics: tmapSearchMetrics('', 0, []) }, options.observe);
  }
}

async function tmapPoiSearch(keyword: string, center?: LatLon, count = 10): Promise<Poi[]> {
  if (!TMAP_KEY || !keyword.trim()) return [];
  const params: Record<string, string> = {
    version: '1', searchKeyword: keyword.trim(), count: String(count),
    resCoordType: 'WGS84GEO', reqCoordType: 'WGS84GEO',
  };
  if (center) {
    params.centerLat = String(center.lat); params.centerLon = String(center.lon);
    params.radius = '30'; params.searchtypCd = 'R'; // 반경 30km(부산 전역 커버) 가까운 순
  }
  try {
    const res = await fetch(`https://apis.openapi.sk.com/tmap/pois?${new URLSearchParams(params)}`, { headers: { appKey: TMAP_KEY } });
    if (!res.ok) return [];
    const j = await res.json();
    let list = j?.searchPoiInfo?.pois?.poi ?? [];
    if (!Array.isArray(list)) list = [list];
    const out: Poi[] = [];
    for (const p of list) {
      const lat = parseFloat(p.frontLat ?? p.noorLat), lon = parseFloat(p.frontLon ?? p.noorLon);
      if (isNaN(lat) || isNaN(lon)) continue;
      out.push({ name: p.name, lat, lon, addr: [p.upperAddrName, p.middleAddrName, p.lowerAddrName].filter(Boolean).join(' ') });
    }
    return out;
  } catch {
    return [];
  }
}

const normalizeKeyword = (s: string) => s.replace(/\[[^\]]+\]|\([^)]*\)|\s/g, '').toLowerCase();

function poiScore(p: Poi, keyword: string, center?: LatLon): number {
  const q = normalizeKeyword(keyword);
  const name = normalizeKeyword(p.name);
  let score = 0;
  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 700;
  else if (name.includes(q)) score += 350;
  if (/역$/.test(q) && /역(\[|\(|$)/.test(p.name)) score += 180;
  if (/주차장|호텔|진료소|점$|\[.+\]/.test(p.name) && name !== q) score -= 120;
  if (p.addr.startsWith('부산 ')) score += 50;
  if (center) score -= Math.min(120, haversineKm(center, p) * 2);
  return score;
}

function dedupePois(list: Poi[]): Poi[] {
  const seen = new Set<string>();
  const out: Poi[] = [];
  for (const p of list) {
    const key = `${normalizeKeyword(p.name)}|${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export async function poiSearchMulti(keyword: string, center?: LatLon, count = 5): Promise<Poi[]> {
  if (!TMAP_KEY || !keyword.trim()) return [];
  const [global, nearby] = await Promise.all([
    tmapPoiSearch(keyword, undefined, Math.max(10, count * 2)),
    center ? tmapPoiSearch(keyword, center, Math.max(10, count * 2)) : Promise.resolve([]),
  ]);
  return dedupePois([...global, ...nearby])
    .sort((a, b) => poiScore(b, keyword, center) - poiScore(a, keyword, center))
    .slice(0, count);
}

export async function poiSearch(keyword: string): Promise<Poi | null> {
  return (await poiSearchMulti(keyword, undefined, 1))[0] ?? null;
}

// TMAP 주소 지오코딩: 주소 문자열 → 좌표 후보 (도로명 우선)
export async function geocodeAddr(fullAddr: string, count = 3): Promise<Poi[]> {
  if (!TMAP_KEY || !fullAddr.trim()) return [];
  const qs = new URLSearchParams({
    version: '1', format: 'json', coordType: 'WGS84GEO', fullAddr: fullAddr.trim(),
  }).toString();
  try {
    const res = await fetch(`https://apis.openapi.sk.com/tmap/geo/fullAddrGeo?${qs}`, { headers: { appKey: TMAP_KEY } });
    if (!res.ok) return [];
    const j = await res.json();
    let list = j?.coordinateInfo?.coordinate ?? [];
    if (!Array.isArray(list)) list = [list];
    const out: Poi[] = [];
    for (const c of list.slice(0, count)) {
      const lat = parseFloat(c.newLat || c.lat), lon = parseFloat(c.newLon || c.lon);
      if (isNaN(lat) || isNaN(lon)) continue;
      const label = [c.city_do, c.gu_gun, c.eup_myun, c.newRoadName || c.legalDong, c.newBuildingIndex || c.bunji, c.buildingName]
        .filter(Boolean).join(' ').trim();
      out.push({ name: label || fullAddr.trim(), lat, lon, addr: '주소' });
    }
    return out;
  } catch {
    return [];
  }
}

// TMAP 역지오코딩: 좌표 → 도로명 주소 우선 변환
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!TMAP_KEY) return null;
  const qs = new URLSearchParams({
    version: '1', lat: String(lat), lon: String(lon), coordType: 'WGS84GEO', addressType: 'A04',
  }).toString();
  try {
    const res = await fetch(`https://apis.openapi.sk.com/tmap/geo/reversegeocoding?${qs}`, { headers: { appKey: TMAP_KEY } });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j?.addressInfo;
    const road = [a?.city_do, a?.gu_gun, a?.roadName, a?.buildingIndex].filter(Boolean).join(' ');
    return road || a?.fullAddress || [a?.city_do, a?.gu_gun, a?.legalDong].filter(Boolean).join(' ') || null;
  } catch {
    return null;
  }
}
