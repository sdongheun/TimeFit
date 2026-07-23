// 이동시간: TMAP REST(보행/자동차) + haversine 폴백 + 좌표쌍 캐시
import { LatLon, Mode } from './types';

const TMAP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY;

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371, t = (d: number) => (d * Math.PI) / 180;
  const dLat = t(b.lat - a.lat), dLon = t(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const MODE: Record<Mode, { circ: number; kmh: number; fix: number }> = {
  walk: { circ: 1.25, kmh: 4.5, fix: 0 },
  car: { circ: 1.3, kmh: 25, fix: 3 },
};

export function haversineMin(a: LatLon, b: LatLon, mode: Mode): number {
  const km = haversineKm(a, b);
  const use = km < 0.8 ? MODE.walk : MODE[mode];
  return Math.round((km * use.circ) / use.kmh * 60 + use.fix);
}

// TMAP 경로: 소요시간 + 경로좌표(geometry) — geometry는 지도 실경로 표시용
async function tmapTravel(a: LatLon, b: LatLon, mode: Mode): Promise<{ min: number; geo: LatLon[] } | null> {
  if (!TMAP_KEY) return null;
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
    if (!res.ok) return null;
    const j = await res.json();
    const sec = j?.features?.[0]?.properties?.totalTime;
    if (!Number.isFinite(sec)) return null;
    // LineString feature들의 좌표([lon,lat])를 이어붙여 실경로 구성
    const geo: LatLon[] = [];
    for (const f of j.features ?? []) {
      if (f?.geometry?.type !== 'LineString') continue;
      for (const c of f.geometry.coordinates ?? []) {
        const lon = parseFloat(c[0]), lat = parseFloat(c[1]);
        if (!isNaN(lat) && !isNaN(lon)) geo.push({ lat, lon });
      }
    }
    return { min: Math.round(sec / 60), geo };
  } catch {
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

export type PrecomputeStat = { ok: number; fail: number };

// 필요한 좌표쌍을 TMAP로 채움(실패 시 haversine 캐시) — 지연 정밀화: 최종 코스 구간에만 호출
export async function precompute(pairs: [LatLon, LatLon][], mode: Mode): Promise<PrecomputeStat> {
  let ok = 0, fail = 0;
  for (const [a, b] of pairs) {
    const k = ckey(a, b, mode);
    if (getCache(k)) continue;
    const t = await tmapTravel(a, b, mode);
    if (t != null) { cache.set(k, { min: t.min, src: 'TMAP', geo: t.geo, ts: Date.now() }); ok++; }
    else { cache.set(k, { min: haversineMin(a, b, mode), src: 'haversine', ts: Date.now() }); fail++; }
  }
  return { ok, fail };
}

export function travelMin(a: LatLon, b: LatLon, mode: Mode): number {
  return getCache(ckey(a, b, mode))?.min ?? haversineMin(a, b, mode);
}
export function travelSrc(a: LatLon, b: LatLon, mode: Mode): string {
  return getCache(ckey(a, b, mode))?.src ?? 'haversine';
}
export function travelGeo(a: LatLon, b: LatLon, mode: Mode): LatLon[] | undefined {
  return getCache(ckey(a, b, mode))?.geo;
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
