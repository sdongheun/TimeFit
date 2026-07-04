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

async function tmapTravel(a: LatLon, b: LatLon, mode: Mode): Promise<number | null> {
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
    return Number.isFinite(sec) ? Math.round(sec / 60) : null;
  } catch {
    return null;
  }
}

const cache = new Map<string, { min: number; src: string }>();
const ckey = (a: LatLon, b: LatLon) => `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;

export type PrecomputeStat = { ok: number; fail: number };

// 필요한 좌표쌍을 TMAP로 미리 채움(실패 시 haversine 캐시)
export async function precompute(pairs: [LatLon, LatLon][], mode: Mode): Promise<PrecomputeStat> {
  let ok = 0, fail = 0;
  for (const [a, b] of pairs) {
    const k = ckey(a, b);
    if (cache.has(k)) continue;
    const t = await tmapTravel(a, b, mode);
    if (t != null) { cache.set(k, { min: t, src: 'TMAP' }); ok++; }
    else { cache.set(k, { min: haversineMin(a, b, mode), src: 'haversine' }); fail++; }
  }
  return { ok, fail };
}

export function travelMin(a: LatLon, b: LatLon, mode: Mode): number {
  return cache.get(ckey(a, b))?.min ?? haversineMin(a, b, mode);
}
export function travelSrc(a: LatLon, b: LatLon): string {
  return cache.get(ckey(a, b))?.src ?? 'haversine';
}

// TMAP POI 통합검색: 장소명 → 좌표 후보 (center 지정 시 가까운 순)
export type Poi = { name: string; lat: number; lon: number; addr: string };
export async function poiSearchMulti(keyword: string, center?: LatLon, count = 5): Promise<Poi[]> {
  if (!TMAP_KEY || !keyword.trim()) return [];
  const params: Record<string, string> = {
    version: '1', searchKeyword: keyword.trim(), count: String(count),
    resCoordType: 'WGS84GEO', reqCoordType: 'WGS84GEO',
  };
  if (center) {
    params.centerLat = String(center.lat); params.centerLon = String(center.lon);
    params.radius = '10'; params.searchtypCd = 'R'; // 반경 10km 내 가까운 순
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
