// 부산 TourAPI ↔ AI-Hub 매칭/폴백 장소 파라미터 (앱 번들)
import busanPoiCatalog from '../data/busan_poi_catalog.json';
import { DayType, HourBucket } from './types';

type BusanMatchedRec = {
  contentId: string;
  title: string;
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
  if (matched) return effectiveBusanMatchedDwell(matched);

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
