import policy from '../data/area_availability_policy.json';
import type { Spot } from './types';

type AvailabilityWindow = { start: string; end: string };
type AreaPolicy = { title: string; windows: AvailabilityWindow[]; sourceText: string };

const byContentId = policy.byContentId as Record<string, AreaPolicy>;

export function isAreaDependentSpot(spot: Pick<Spot, 'category' | 'subCategory' | 'availabilityProfile'>): boolean {
  if (spot.availabilityProfile === 'area') return true;
  if (spot.category !== '상업지구' && spot.category !== '문화시설') return false;
  return /시장|거리|골목|문화마을/.test(spot.subCategory ?? '');
}

export function areaAvailabilityDuring(
  spot: Pick<Spot, 'contentId' | 'title' | 'category' | 'subCategory' | 'availabilityProfile'>,
  startMin: number,
  dwellMin: number,
): { ok: boolean; note: string } | null {
  if (!isAreaDependentSpot(spot)) return null;
  const entry = byContentId[spot.contentId];
  if (!entry) return { ok: false, note: '권역형 추천 시간대 미확인' };

  const endMin = startMin + dwellMin;
  const window = entry.windows.find(({ start, end }) => {
    const open = toMinutes(start);
    const close = toMinutes(end);
    return startMin >= open && endMin <= close;
  });
  if (!window) return { ok: false, note: '권역형 추천 가능 시간대 밖' };
  return { ok: true, note: `공식 권역 시간대 ${window.start}~${window.end}` };
}

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
