// 부산 TourAPI ↔ AI-Hub 매칭/폴백 장소 파라미터 (앱 번들)
import busanPoiCatalog from '../data/busan_poi_catalog.json';
import { DayType, HourBucket, MapVerificationStatus, MatchScope, OpeningHoursReliability, SpotConfidence } from './types';

type MapVerification = {
  provider: 'kakao';
  status: MapVerificationStatus;
  matchedName?: string;
  distanceM?: number;
};

type BusanMatchedRec = {
  contentId: string;
  title: string;
  aihubName?: string;
  aihubCategory?: string;
  matchType?: string;
  matchDistanceM?: number;
  subCategory?: string;
  matchScope?: MatchScope;
  dwellSourceName?: string;
  openingHoursSourceName?: string;
  openingHoursReliability?: OpeningHoursReliability;
  mapVerification?: MapVerification;
  category: string;
  dwell: { count: number; median: number; p25: number; p75: number; mean: number };
};

type BusanUnmatchedRec = {
  contentId: string;
  title: string;
  contentTypeId: string;
  category: string;
  subCategory?: string;
  matchScope?: MatchScope;
  dwellSourceName?: string;
  openingHoursSourceName?: string;
  openingHoursReliability?: OpeningHoursReliability;
  mapVerification?: MapVerification;
  lat: number;
  lon: number;
};

const catalog = busanPoiCatalog as any;
const busanMatched = catalog.matched.byContentId as Record<string, BusanMatchedRec>;
const busanUnmatched = catalog.unmatched.byContentId as Record<string, BusanUnmatchedRec>;
const categoryStats = catalog.categoryDwell as Record<string, { count: number; median: number }>;

export function resolveBusanMatched(contentId: string): BusanMatchedRec | null {
  return busanMatched[String(contentId)] ?? null;
}

export function resolveBusanDwell(
  contentId: string, _dayType: DayType, _hourBucket: HourBucket,
): {
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
  mapVerificationName?: string;
  mapVerificationDistanceM?: number;
} | null {
  const matched = busanMatched[String(contentId)];
  if (matched) {
    if (isLowConfidenceMatched(matched)) return null;
    return effectiveBusanMatchedDwell(matched);
  }

  const unmatched = busanUnmatched[String(contentId)];
  if (!unmatched) return null;
  if (unmatched.mapVerification?.status === 'not_found') return null;
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
    mapVerificationName: unmatched.mapVerification?.matchedName,
    mapVerificationDistanceM: unmatched.mapVerification?.distanceM,
  };
}

function isLowConfidenceMatched(matched: BusanMatchedRec): boolean {
  if (matched.matchScope === 'bad_match') return true;
  if (matched.mapVerification?.status === 'not_found') return true;
  if (matched.matchScope === 'area_context') return false;

  const risks = [
    matched.matchType === 'coord',
    (matched.matchDistanceM ?? 0) > 50,
    (matched.dwell?.count ?? 0) < 5,
    !!matched.aihubName && !isSimilarPlaceName(matched.title, matched.aihubName),
    !!matched.aihubCategory && matched.aihubCategory !== matched.category,
  ];
  return risks.filter(Boolean).length >= 4;
}

function isSimilarPlaceName(a: string, b: string): boolean {
  const na = normalizePlaceName(a);
  const nb = normalizePlaceName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

function normalizePlaceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\[[^\]]*]|\([^)]*\)/g, '')
    .replace(/부산|광역시|본점|지점|점|센터|관|카페|coffee|cafe/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

function effectiveBusanMatchedDwell(
  matched: BusanMatchedRec,
): {
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
  mapVerificationName?: string;
  mapVerificationDistanceM?: number;
} {
  const base = matched.dwell.median;
  const matchScope = matched.matchScope ?? 'direct_place';
  const eff = effectiveDwellByScope(matched, base);
  const dwellSourceName = matched.dwellSourceName ?? matched.aihubName ?? matched.title;
  return {
    title: matched.title,
    category: matched.category,
    eff,
    base,
    mult: 1,
    src: `AI-Hub:${dwellSourceName}(${matchScope},n=${matched.dwell.count})`,
    confidence: matchScope === 'area_context' ? 'area_context_match' : 'direct_match',
    subCategory: matched.subCategory,
    matchScope,
    dwellSourceName,
    openingHoursSourceName: matched.openingHoursSourceName ?? matched.title,
    openingHoursReliability: matched.openingHoursReliability ?? openingReliabilityFor(matched),
    mapVerificationStatus: matched.mapVerification?.status ?? 'unverified',
    mapVerificationName: matched.mapVerification?.matchedName,
    mapVerificationDistanceM: matched.mapVerification?.distanceM,
  };
}

function effectiveDwellByScope(matched: BusanMatchedRec, base: number): number {
  if (matched.matchScope !== 'area_context') return base;
  if (matched.subCategory === '개별상점') return Math.min(base, 30);
  if (matched.subCategory === '전문상가' || matched.subCategory === '거리/골목상권') return Math.min(base, 45);
  return base;
}

function openingReliabilityFor(place: { title: string; category: string; subCategory?: string }): OpeningHoursReliability {
  if (place.category === '자연관광지') return 'unknown';
  if (['전통시장', '전문상가', '거리/골목상권'].includes(place.subCategory ?? '')) return 'area_uncertain';
  if (/시장|거리|골목|상권|마을|해수욕장|해변|공원|광장|지하상가|먹자골목|로데오/.test(place.title)) {
    return 'area_uncertain';
  }
  return 'direct';
}
