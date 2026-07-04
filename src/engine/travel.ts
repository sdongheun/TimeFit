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

// TMAP POI 통합검색: 장소명 → 좌표 (약속장소/현재위치 직접 입력용)
export type Poi = { name: string; lat: number; lon: number; addr: string };
export async function poiSearch(keyword: string): Promise<Poi | null> {
  if (!TMAP_KEY || !keyword.trim()) return null;
  const qs = new URLSearchParams({
    version: '1', searchKeyword: keyword.trim(), count: '1',
    resCoordType: 'WGS84GEO', reqCoordType: 'WGS84GEO',
  }).toString();
  try {
    const res = await fetch(`https://apis.openapi.sk.com/tmap/pois?${qs}`, { headers: { appKey: TMAP_KEY } });
    if (!res.ok) return null;
    const j = await res.json();
    const p = j?.searchPoiInfo?.pois?.poi?.[0];
    if (!p) return null;
    const lat = parseFloat(p.frontLat ?? p.noorLat), lon = parseFloat(p.frontLon ?? p.noorLon);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { name: p.name, lat, lon, addr: [p.upperAddrName, p.middleAddrName, p.lowerAddrName].filter(Boolean).join(' ') };
  } catch {
    return null;
  }
}
