// 부산 TourAPI ↔ AI-Hub 매칭/폴백 장소 파라미터 (앱 번들)
import busanPoiCatalog from '../data/busan_poi_catalog.json';
import { DayType, HourBucket } from './types';

type BusanMatchedRec = {
  contentId: string;
  title: string;
  aihubName?: string;
  aihubCategory?: string;
  matchType?: string;
  matchDistanceM?: number;
  category: string;
  dwell: { count: number; median: number; p25: number; p75: number; mean: number };
};

type BusanUnmatchedRec = {
  contentId: string;
  title: string;
  contentTypeId: string;
  category: string;
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
  confidence: 'direct_match' | 'category_fallback';
} | null {
  const matched = busanMatched[String(contentId)];
  if (matched) {
    if (isLowConfidenceMatched(matched)) return null;
    return effectiveBusanMatchedDwell(matched);
  }

  const unmatched = busanUnmatched[String(contentId)];
  if (!unmatched) return null;
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
  };
}

function isLowConfidenceMatched(matched: BusanMatchedRec): boolean {
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
): { title: string; category: string; eff: number; base: number; mult: number; src: string; confidence: 'direct_match' } {
  const base = matched.dwell.median;
  return {
    title: matched.title,
    category: matched.category,
    eff: base,
    base,
    mult: 1,
    src: `부산매칭(n=${matched.dwell.count})`,
    confidence: 'direct_match',
  };
}
