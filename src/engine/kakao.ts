// Kakao Local REST API 클라이언트: 장소 검색 + 주소 지오코딩 + 역지오코딩
import { LatLon } from './types';
import { haversineKm, Poi } from './travel';

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
};

const kakaoHeaders = () => ({ Authorization: `KakaoAK ${KAKAO_REST_KEY}` });

function toPoi(doc: KakaoDocument, fallbackName: string): Poi | null {
  const lat = Number(doc.y);
  const lon = Number(doc.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const name = doc.place_name || doc.road_address_name || doc.address_name || fallbackName;
  const addr = doc.road_address_name || doc.address_name || '카카오';
  return { name, lat, lon, addr };
}

async function kakaoGet(path: string, params: Record<string, string | number>): Promise<KakaoDocument[]> {
  if (!KAKAO_REST_KEY) return [];
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/${path}?${qs}`, { headers: kakaoHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.documents) ? json.documents : [];
  } catch {
    return [];
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
  if (!keyword.trim()) return [];
  const baseParams: Record<string, string | number> = {
    query: keyword.trim(),
    size: Math.min(15, Math.max(1, count * 3)),
  };
  const params = center
    ? { ...baseParams, x: center.lon, y: center.lat, radius: 30000, sort: 'distance' }
    : baseParams;

  const docs = await kakaoGet('search/keyword.json', params);
  const pois = docs.map((doc) => toPoi(doc, keyword)).filter((p): p is Poi => !!p);
  return dedupePois(pois)
    .sort((a, b) => kakaoPoiScore(b, keyword, center) - kakaoPoiScore(a, keyword, center))
    .slice(0, count);
}

export async function kakaoGeocodeAddr(fullAddr: string, count = 3): Promise<Poi[]> {
  if (!fullAddr.trim()) return [];
  const docs = await kakaoGet('search/address.json', { query: fullAddr.trim(), size: Math.min(10, Math.max(1, count)) });
  return docs.map((doc) => toPoi(doc, fullAddr)).filter((p): p is Poi => !!p).slice(0, count);
}

export async function kakaoReverseGeocode(lat: number, lon: number): Promise<string | null> {
  const docs = await kakaoGet('geo/coord2address.json', { x: lon, y: lat });
  const doc = docs[0];
  return doc?.road_address?.address_name || doc?.address?.address_name || doc?.road_address_name || doc?.address_name || null;
}

export function hasKakaoRestKey(): boolean {
  return !!KAKAO_REST_KEY;
}
