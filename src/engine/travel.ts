// 이동시간: TMAP REST(보행/자동차) + haversine 폴백 + 좌표쌍 캐시
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLon, Mode, RoadMode } from './types';

const TMAP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY;
const ODSAY_KEY = process.env.EXPO_PUBLIC_ODSAY_API_KEY ?? process.env.ODSAY_API_KEY;
const ROUTE_USAGE_KEY = 'timefit:tmap-route-usage:v1';
const ODSAY_USAGE_KEY = 'timefit:odsay-transit-usage:v1';

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
  // eslint-disable-next-line no-var
  var __TIMEFIT_ODSAY_TRANSIT_USAGE__: OdsayTransitUsageStats | undefined;
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

function odsayUsage(): OdsayTransitUsageStats {
  const today = todayKey();
  const current = globalThis.__TIMEFIT_ODSAY_TRANSIT_USAGE__;
  if (!current || current.date !== today) {
    const fresh: OdsayTransitUsageStats = { date: today, total: 0, ok: 0, fail: 0 };
    globalThis.__TIMEFIT_ODSAY_TRANSIT_USAGE__ = fresh;
    return fresh;
  }
  return current;
}

async function loadOdsayUsage(): Promise<OdsayTransitUsageStats> {
  const today = todayKey();
  try {
    const raw = await AsyncStorage.getItem(ODSAY_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OdsayTransitUsageStats>;
      if (
        parsed.date === today
        && Number.isFinite(parsed.total)
        && Number.isFinite(parsed.ok)
        && Number.isFinite(parsed.fail)
      ) {
        const usage: OdsayTransitUsageStats = {
          date: today,
          total: parsed.total ?? 0,
          ok: parsed.ok ?? 0,
          fail: parsed.fail ?? 0,
        };
        globalThis.__TIMEFIT_ODSAY_TRANSIT_USAGE__ = usage;
        return usage;
      }
    }
  } catch {
    return odsayUsage();
  }

  const usage: OdsayTransitUsageStats = { date: today, total: 0, ok: 0, fail: 0 };
  globalThis.__TIMEFIT_ODSAY_TRANSIT_USAGE__ = usage;
  await saveOdsayUsage(usage);
  return usage;
}

async function saveOdsayUsage(usage: OdsayTransitUsageStats) {
  try {
    await AsyncStorage.setItem(ODSAY_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // 저장소 접근이 불가능한 환경에서는 메모리 카운터만 유지한다.
  }
}

async function odsayUsagePersistent(): Promise<OdsayTransitUsageStats> {
  const current = globalThis.__TIMEFIT_ODSAY_TRANSIT_USAGE__;
  if (current?.date === todayKey()) return current;
  return loadOdsayUsage();
}

const coordLabel = (p: LatLon) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
const modeLabel = (mode: RoadMode) => (mode === 'walk' ? '도보' : '자동차');

async function markRouteCall(mode: RoadMode, a: LatLon, b: LatLon): Promise<number> {
  const usage = await routeUsagePersistent();
  usage.total += 1;
  usage.byMode[mode] += 1;
  await saveRouteUsage(usage);
  console.log(
    `[TMAP 경로 API] 요청 #${usage.total} · 오늘 ${usage.date} 총 ${usage.total}건 `
    + `(도보 ${usage.byMode.walk}, 자동차 ${usage.byMode.car}) · ${modeLabel(mode)} `
    + `${coordLabel(a)} -> ${coordLabel(b)}`,
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

async function markOdsayCall(a: LatLon, b: LatLon): Promise<number> {
  const usage = await odsayUsagePersistent();
  usage.total += 1;
  await saveOdsayUsage(usage);
  console.log(
    `[ODsay 대중교통 API] 요청 #${usage.total} · 오늘 ${usage.date} 총 ${usage.total}건 `
    + `${coordLabel(a)} -> ${coordLabel(b)}`,
  );
  return usage.total;
}

async function markOdsayResult(callNo: number, ok: boolean, min?: number) {
  const usage = await odsayUsagePersistent();
  if (ok) usage.ok += 1;
  else usage.fail += 1;
  await saveOdsayUsage(usage);
  console.log(
    `[ODsay 대중교통 API] 응답 #${callNo} · ${ok ? '성공' : '실패'}`
    + `${ok && Number.isFinite(min) ? ` ${min}분` : ''} · 오늘 누적 성공 ${usage.ok}, 실패 ${usage.fail}, 총 ${usage.total}건`,
  );
}

export async function getOdsayTransitUsage(): Promise<OdsayTransitUsageStats> {
  const usage = await odsayUsagePersistent();
  return { ...usage };
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
  const use = km < 0.8 ? MODE.walk : MODE[mode];
  return Math.round((km * use.circ) / use.kmh * 60 + use.fix);
}

// TMAP 경로: 소요시간 + 경로좌표(geometry) — geometry는 지도 실경로 표시용
async function tmapTravel(a: LatLon, b: LatLon, mode: RoadMode): Promise<{ min: number; geo: LatLon[] } | null> {
  if (!TMAP_KEY) return null;
  const callNo = await markRouteCall(mode, a, b);
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
    // LineString feature들의 좌표([lon,lat])를 이어붙여 실경로 구성
    const geo: LatLon[] = [];
    for (const f of j.features ?? []) {
      if (f?.geometry?.type !== 'LineString') continue;
      for (const c of f.geometry.coordinates ?? []) {
        const lon = parseFloat(c[0]), lat = parseFloat(c[1]);
        if (!isNaN(lat) && !isNaN(lon)) geo.push({ lat, lon });
      }
    }
    const min = Math.round(sec / 60);
    await markRouteResult(callNo, mode, true, min);
    return { min, geo };
  } catch {
    await markRouteResult(callNo, mode, false);
    return null;
  }
}

// 캐시: 약관상 취득 데이터 24시간 이상 보관 금지 → TTL 24h
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
export async function precompute(pairs: [LatLon, LatLon][], mode: RoadMode): Promise<PrecomputeStat> {
  let ok = 0, fail = 0;
  let cacheHit = 0;
  for (const [a, b] of pairs) {
    const k = ckey(a, b, mode);
    if (getCache(k)) { cacheHit++; continue; }
    const t = await tmapTravel(a, b, mode);
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
type TransitCacheEntry = { min: number; src: string; ts: number; meta?: TransitMeta };
const transitCache = new Map<string, TransitCacheEntry>();
const transitKey = (a: LatLon, b: LatLon) => `transit|${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;

function getTransitCache(k: string): TransitCacheEntry | undefined {
  const e = transitCache.get(k);
  if (e && Date.now() - e.ts > TTL_MS) { transitCache.delete(k); return undefined; }
  return e;
}

function transitFallbackMin(a: LatLon, b: LatLon): number {
  return haversineMin(a, b, 'transit');
}

function shouldUseWalkForShortTransit(a: LatLon, b: LatLon): boolean {
  return haversineKm(a, b) <= 0.75 || haversineMin(a, b, 'walk') <= 10;
}

function transitScore(path: any): number {
  const info = path?.info ?? {};
  const time = Number(info.totalTime ?? 9999);
  const transfers = Number(info.busTransitCount ?? 0) + Number(info.subwayTransitCount ?? 0);
  const walk = Number(info.totalWalk ?? 0);
  const pathType = Number(path?.pathType ?? 0);
  const subwayBonus = pathType === 1 ? 8 : pathType === 3 ? 4 : 0;
  return time + transfers * 4 + Math.round(walk / 250) - subwayBonus;
}

function transitSummary(path: any): string {
  const sub = Array.isArray(path?.subPath) ? path.subPath : [];
  const labels = sub
    .filter((s: any) => s.trafficType === 1 || s.trafficType === 2)
    .map((s: any) => {
      const lane = Array.isArray(s.lane) ? s.lane[0] : null;
      const laneName = lane?.name ?? lane?.busNo ?? (s.trafficType === 1 ? '지하철' : '버스');
      return `${laneName} ${s.startName ?? ''}->${s.endName ?? ''}`.trim();
    });
  return labels.slice(0, 3).join(' · ');
}

function finiteCoord(lat: number, lon: number): LatLon | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < 32 || lat > 39 || lon < 124 || lon > 132) return null;
  return { lat, lon };
}

function readOdsayPoint(obj: any, xKey = 'X', yKey = 'Y'): LatLon | null {
  if (!obj) return null;
  const lon = Number(obj[xKey]);
  const lat = Number(obj[yKey]);
  return finiteCoord(lat, lon);
}

function pushPoint(points: LatLon[], p: LatLon | null) {
  if (!p) return;
  const last = points[points.length - 1];
  if (last && Math.abs(last.lat - p.lat) < 0.00001 && Math.abs(last.lon - p.lon) < 0.00001) return;
  points.push(p);
}

function collectPassStopPoints(subPath: any): LatLon[] {
  const raw =
    subPath?.passStopList?.stations
    ?? subPath?.passStopList?.stationList
    ?? subPath?.passStopList?.station
    ?? subPath?.stations
    ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  const points: LatLon[] = [];
  for (const station of list) {
    pushPoint(points, readOdsayPoint(station, 'x', 'y') ?? readOdsayPoint(station, 'X', 'Y'));
  }
  return points;
}

function transitGeo(path: any, origin: LatLon, destination: LatLon): LatLon[] | undefined {
  const sub = Array.isArray(path?.subPath) ? path.subPath : [];
  const points: LatLon[] = [];
  pushPoint(points, origin);
  for (const part of sub) {
    pushPoint(points, readOdsayPoint(part, 'startX', 'startY'));
    for (const stop of collectPassStopPoints(part)) pushPoint(points, stop);
    pushPoint(points, readOdsayPoint(part, 'endX', 'endY'));
  }
  pushPoint(points, destination);
  return points.length > 2 ? points : undefined;
}

async function odsayTransit(a: LatLon, b: LatLon): Promise<{ min: number; meta: TransitMeta } | null> {
  if (!ODSAY_KEY) return null;
  const callNo = await markOdsayCall(a, b);
  const qs = new URLSearchParams({
    SX: String(a.lon),
    SY: String(a.lat),
    EX: String(b.lon),
    EY: String(b.lat),
    SearchType: '0',
    apiKey: ODSAY_KEY,
  });
  try {
    const res = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${qs}`);
    if (!res.ok) {
      await markOdsayResult(callNo, false);
      return null;
    }
    const j = await res.json();
    const paths = j?.result?.path;
    if (!Array.isArray(paths) || paths.length === 0) {
      await markOdsayResult(callNo, false);
      return null;
    }
    const best = [...paths].sort((aPath, bPath) => transitScore(aPath) - transitScore(bPath))[0];
    const info = best.info ?? {};
    const totalTime = Number(info.totalTime);
    if (!Number.isFinite(totalTime)) {
      await markOdsayResult(callNo, false);
      return null;
    }
    const min = Math.round(totalTime);
    await markOdsayResult(callNo, true, min);
    return {
      min,
      meta: {
        pathType: Number(best.pathType ?? 0),
        totalTime: min,
        payment: Number(info.payment ?? 0),
        busTransitCount: Number(info.busTransitCount ?? 0),
        subwayTransitCount: Number(info.subwayTransitCount ?? 0),
        totalWalk: Number(info.totalWalk ?? 0),
        firstStartStation: info.firstStartStation ?? '',
        lastEndStation: info.lastEndStation ?? '',
        summary: transitSummary(best),
        geo: transitGeo(best, a, b),
      },
    };
  } catch {
    await markOdsayResult(callNo, false);
    return null;
  }
}

export async function precomputeTransit(pairs: [LatLon, LatLon][]): Promise<PrecomputeStat> {
  let ok = 0, fail = 0;
  let cacheHit = 0;
  let skipped = 0;
  for (const [a, b] of pairs) {
    const k = transitKey(a, b);
    if (getTransitCache(k)) { cacheHit++; continue; }
    if (shouldUseWalkForShortTransit(a, b)) {
      transitCache.set(k, { min: haversineMin(a, b, 'walk'), src: 'walk_short', ts: Date.now() });
      skipped++;
      continue;
    }
    const t = await odsayTransit(a, b);
    if (t) { transitCache.set(k, { min: t.min, src: 'ODsay', meta: t.meta, ts: Date.now() }); ok++; }
    else { transitCache.set(k, { min: transitFallbackMin(a, b), src: 'transit_fallback', ts: Date.now() }); fail++; }
  }
  if (ok + fail > 0 || cacheHit > 0 || skipped > 0) {
    const usage = odsayUsage();
    console.log(
      `[ODsay 대중교통 API] 배치 완료 · 신규 ${ok + fail}건, 짧은구간 ${skipped}건, 캐시 ${cacheHit}건 `
      + `· 오늘 총 ${usage.total}건`,
    );
  }
  return { ok, fail, skipped };
}

export function travelMin(a: LatLon, b: LatLon, mode: Mode): number {
  if (mode === 'transit') return getTransitCache(transitKey(a, b))?.min ?? transitFallbackMin(a, b);
  return getCache(ckey(a, b, mode))?.min ?? haversineMin(a, b, mode);
}
export function travelSrc(a: LatLon, b: LatLon, mode: Mode): string {
  if (mode === 'transit') return getTransitCache(transitKey(a, b))?.src ?? 'transit_fallback';
  return getCache(ckey(a, b, mode))?.src ?? 'haversine';
}
export function travelGeo(a: LatLon, b: LatLon, mode: Mode): LatLon[] | undefined {
  if (mode === 'transit') {
    const entry = getTransitCache(transitKey(a, b));
    if (entry?.meta?.geo && entry.meta.geo.length > 1) return entry.meta.geo;
    if (entry?.src === 'walk_short' || entry?.src === 'transit_fallback') return [a, b];
    return undefined;
  }
  return getCache(ckey(a, b, mode))?.geo;
}
export function transitMeta(a: LatLon, b: LatLon): TransitMeta | undefined {
  return getTransitCache(transitKey(a, b))?.meta;
}

// TMAP POI 통합검색: 장소명 → 좌표 후보 (center 지정 시 가까운 순)
export type Poi = { name: string; lat: number; lon: number; addr: string };
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

// TMAP 역지오코딩: 좌표 → 주소 (지도 롱프레스 핀용)
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!TMAP_KEY) return null;
  const qs = new URLSearchParams({
    version: '1', lat: String(lat), lon: String(lon), coordType: 'WGS84GEO', addressType: 'A03',
  }).toString();
  try {
    const res = await fetch(`https://apis.openapi.sk.com/tmap/geo/reversegeocoding?${qs}`, { headers: { appKey: TMAP_KEY } });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j?.addressInfo;
    return a?.fullAddress || [a?.city_do, a?.gu_gun, a?.legalDong].filter(Boolean).join(' ') || null;
  } catch {
    return null;
  }
}
