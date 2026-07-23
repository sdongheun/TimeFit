// 부산 TourAPI ↔ AI-Hub 매칭 장소 파라미터 (앱 번들)
import busanMatchedPoi from '../data/busan_matched_poi.json';
import { DayType, HourBucket } from './types';

type BusanMatchedRec = {
  contentId: string;
  title: string;
  category: string;
  dwell: { count: number; median: number; p25: number; p75: number; mean: number };
};

const busanMatched = (busanMatchedPoi as any).byContentId as Record<string, BusanMatchedRec>;

export function resolveBusanMatched(contentId: string): BusanMatchedRec | null {
  return busanMatched[String(contentId)] ?? null;
}

export function effectiveBusanMatchedDwell(
  matched: BusanMatchedRec, _dayType: DayType, _hourBucket: HourBucket,
): { eff: number; base: number; mult: number; src: string } {
  const base = matched.dwell.median;
  return {
    eff: base,
    base,
    mult: 1,
    src: `부산매칭(n=${matched.dwell.count})`,
  };
}
