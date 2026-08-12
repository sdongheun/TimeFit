// 부산 정제 후보 카탈로그와 체류시간 정책. 앱은 이 로컬 카탈로그를 좌표 반경으로 탐색한다.
import busanPoiCatalog from '../data/busan_poi_catalog.json';
import { DayType, HourBucket, MapVerificationStatus, MatchScope, OpeningHoursReliability, SpotConfidence, LatLon } from './types';

type MapVerification = {
  provider: 'kakao';
  status: MapVerificationStatus;
  placeId?: string;
  placeUrl?: string;
  matchedName?: string;
  distanceM?: number;
};

export type BusanCatalogPlace = {
  contentId: string;
  title: string;
  contentTypeId: string;
  category: string;
  subCategory?: string;
  addr1: string;
  lat: number;
  lon: number;
  matchScope: MatchScope;
  dwellSourceName?: string;
  openingHoursSourceName?: string;
  openingHoursReliability?: OpeningHoursReliability;
  operatingHours?: string[];
  mapVerification?: MapVerification;
  tourapiContentId?: string;
  tourapiContentTypeId?: string;
  aihubName?: string;
  aihubCategory?: string;
  matchType?: string;
  matchDistanceM?: number;
  dwell?: { count: number; median: number; p25?: number | null; p75?: number | null; mean?: number | null };
};

export type ResolvedBusanDwell = {
  title: string;
  category: string;
  eff: number;
  base: number;
  mult: number;
  src: string;
  confidence: SpotConfidence;
  subCategory?: string;
  matchScope: MatchScope;
  dwellSourceName: string;
  openingHoursSourceName: string;
  openingHoursReliability: OpeningHoursReliability;
  mapVerificationStatus: MapVerificationStatus;
  kakaoPlaceId?: string;
  kakaoPlaceUrl?: string;
  mapVerificationName?: string;
  mapVerificationDistanceM?: number;
  tourapiContentId?: string;
  tourapiContentTypeId?: string;
  operatingHours?: string[];
};

const catalog = busanPoiCatalog as any;
const busanMatched = catalog.matched.byContentId as Record<string, BusanCatalogPlace>;
const busanUnmatched = catalog.unmatched.byContentId as Record<string, BusanCatalogPlace>;
const allPlaces = [...Object.values(busanMatched), ...Object.values(busanUnmatched)];
const categoryStats = catalog.categoryDwell as Record<string, { count: number; median: number }>;

export function resolveBusanMatched(contentId: string): BusanCatalogPlace | null {
  return busanMatched[String(contentId)] ?? null;
}

export function listBusanPoiCandidatesNear(center: LatLon, radiusM: number): Array<{ place: BusanCatalogPlace; dwell: ResolvedBusanDwell }> {
  return allPlaces.flatMap((place) => {
    if (distanceM(center, place) > radiusM) return [];
    const dwell = resolveBusanDwell(place.contentId, '평일', '오후');
    return dwell ? [{ place, dwell }] : [];
  });
}

export function resolveBusanDwell(
  contentId: string, _dayType: DayType, _hourBucket: HourBucket,
): ResolvedBusanDwell | null {
  const matched = busanMatched[String(contentId)];
  if (matched) {
    if (isLowConfidenceMatched(matched)) return null;
    return effectiveBusanMatchedDwell(matched);
  }

  const unmatched = busanUnmatched[String(contentId)];
  if (!unmatched || unmatched.mapVerification?.status === 'not_found') return null;
  const stat = categoryStats[unmatched.category];
  if (!stat?.median) return null;
  return {
    title: unmatched.title,
    category: unmatched.category,
    eff: stat.median,
    base: stat.median,
    mult: 1,
    src: `카테고리폴백:${unmatched.category}(n=${stat.count})`,
    confidence: 'category_fallback',
    subCategory: unmatched.subCategory,
    matchScope: 'category_fallback',
    dwellSourceName: unmatched.dwellSourceName ?? `카테고리:${unmatched.category}`,
    openingHoursSourceName: unmatched.openingHoursSourceName ?? unmatched.title,
    openingHoursReliability: unmatched.openingHoursReliability ?? openingReliabilityFor(unmatched),
    mapVerificationStatus: unmatched.mapVerification?.status ?? 'unverified',
    kakaoPlaceId: unmatched.mapVerification?.placeId,
    kakaoPlaceUrl: unmatched.mapVerification?.placeUrl,
    mapVerificationName: unmatched.mapVerification?.matchedName,
    mapVerificationDistanceM: unmatched.mapVerification?.distanceM,
    tourapiContentId: unmatched.tourapiContentId,
    tourapiContentTypeId: unmatched.tourapiContentTypeId,
    operatingHours: unmatched.operatingHours,
  };
}

function isLowConfidenceMatched(matched: BusanCatalogPlace): boolean {
  // 최종 매칭은 독립 장소의 이름+좌표 또는 포괄 장소의 지역 맥락으로 이미 정제됐다.
  // 기존 카카오 검증에서 명확히 찾지 못한 TourAPI 장소만 추천 후보에서 막는다.
  return matched.mapVerification?.status === 'not_found';
}

function effectiveBusanMatchedDwell(matched: BusanCatalogPlace): ResolvedBusanDwell {
  const base = matched.dwell?.median;
  if (!base) throw new Error(`${matched.title}: matched place must have dwell median`);
  const matchScope = matched.matchScope;
  const dwellSourceName = matched.dwellSourceName ?? matched.aihubName ?? matched.title;
  return {
    title: matched.title,
    category: matched.category,
    eff: base,
    base,
    mult: 1,
    src: `AI-Hub:${dwellSourceName}(${matchScope},n=${matched.dwell?.count ?? 0})`,
    confidence: matchScope === 'area_context' ? 'area_context_match' : 'direct_match',
    subCategory: matched.subCategory,
    matchScope,
    dwellSourceName,
    openingHoursSourceName: matched.openingHoursSourceName ?? matched.title,
    openingHoursReliability: matched.openingHoursReliability ?? openingReliabilityFor(matched),
    mapVerificationStatus: matched.mapVerification?.status ?? 'unverified',
    kakaoPlaceId: matched.mapVerification?.placeId,
    kakaoPlaceUrl: matched.mapVerification?.placeUrl,
    mapVerificationName: matched.mapVerification?.matchedName,
    mapVerificationDistanceM: matched.mapVerification?.distanceM,
    tourapiContentId: matched.tourapiContentId,
    tourapiContentTypeId: matched.tourapiContentTypeId,
    operatingHours: matched.operatingHours,
  };
}

function openingReliabilityFor(place: Pick<BusanCatalogPlace, 'category' | 'matchScope' | 'operatingHours'>): OpeningHoursReliability {
  if (place.category === '자연관광지') return 'unknown';
  if (place.matchScope === 'area_context') return 'area_uncertain';
  return place.operatingHours?.length ? 'direct' : 'unknown';
}

function distanceM(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
