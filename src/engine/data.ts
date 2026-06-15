// 정적 체류/혼잡 파라미터 (AI-Hub 동부권 집계, 빌드 번들)
import categoryDwell from '../data/category_dwell.json';
import congestion from '../data/congestion_matrix.json';
import poiDwell from '../data/poi_dwell.json';
import { DayType, HourBucket } from './types';

type CatRec = { count: number; median: number; p25: number; p75: number; mean: number };
type PoiRec = { name: string; category: string; count: number; median: number; x: number; y: number };

const catData = (categoryDwell as any).data as Record<string, CatRec>;
const congData = (congestion as any).data as Record<string, Record<string, Record<string, number | null>>>;
const poiData = (poiDwell as any).data as Record<string, PoiRec>;

const norm = (s: string) => (s || '').replace(/\s+/g, '').toLowerCase();
const CAFE_RE = /카페|커피|coffee|cafe|베이커리|제과|디저트|빵|브런치|로스터리/i;

// TourAPI contentTypeId → 우리 카테고리 (null = 추천대상 아님)
export function mapCategory(typeId: string, title: string): string | null {
  switch (String(typeId)) {
    case '12': return '자연관광지';
    case '14': return '문화시설';
    case '15': return '지역축제/행사';
    case '28': return '레저/스포츠';
    case '38': return '상업지구';
    case '39': return CAFE_RE.test(title) ? '카페' : '식당';
    default: return null;
  }
}

// 체류시간: POI 실측(표본충분) → 카테고리 폴백
export function resolveDwell(title: string, category: string): { base: number; src: string } {
  const hit = poiData[norm(title)];
  if (hit && hit.count >= 5) return { base: hit.median, src: `POI실측(n=${hit.count})` };
  const c = catData[category];
  return c ? { base: c.median, src: '카테고리' } : { base: 30, src: '기본값' };
}

// 유효 체류 = 기본 × 혼잡배수
export function effectiveDwell(
  title: string, category: string, dayType: DayType, hourBucket: HourBucket,
): { eff: number; base: number; mult: number; src: string } {
  const { base, src } = resolveDwell(title, category);
  const mult = congData[category]?.[dayType]?.[hourBucket] ?? 1.0;
  return { eff: Math.round(base * mult), base, mult, src };
}
