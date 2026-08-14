import type { Mode, Spot } from './types';

// 약속 지연 위험은 이동수단마다 다르므로 시간 예산에서 먼저 확보한다.
export function safetyBufferMin(mode: Mode): number {
  if (mode === 'transit') return 20;
  if (mode === 'walk') return 15;
  return 10;
}

export function isQuickBrowseSpot(spot: Spot): boolean {
  if (spot.availabilityProfile === 'outdoor') return true;
  if (spot.availabilityProfile === 'facility' || spot.availabilityProfile === 'area') return false;
  if (spot.category === '자연관광지') return true;
  if (spot.category !== '상업지구') return false;
  return /거리|골목|상권/.test(spot.subCategory ?? '') || /거리|길|골목|광장|시장/.test(spot.title);
}

// 지출 또는 입장 행위가 전제되는 장소는 짧은 체류보다 이동이 길면 추천하지 않는다.
export function isPaidFacilityLike(spot: Spot): boolean {
  if (spot.availabilityProfile === 'facility') return true;
  if (['카페', '식당', '문화시설', '레저/스포츠'].includes(spot.category)) return true;
  return spot.category === '상업지구' && /개별상점|아울렛|쇼핑복합공간/.test(spot.subCategory ?? '');
}

// 자연·거리·광장처럼 가볍게 둘러볼 수 있는 곳만 접근 시간이 짧을 때 체류 하한을 낮춘다.
export function minimumStayForSpot(spot: Spot, approachMin: number): number {
  if (!isQuickBrowseSpot(spot)) return 30;
  if (approachMin <= 10) return 15;
  if (approachMin <= 15) return 20;
  return 30;
}

export function minimumStayForCourse(spots: Spot[], approachMins: number[]): number {
  return spots.reduce((total, spot, index) => total + minimumStayForSpot(spot, approachMins[index] ?? Infinity), 0);
}

// 약속지까지의 원래 이동은 제외하고, 경유지 때문에 실제로 더해진 이동만 비교한다.
export function hasBalancedPaidVisit(spots: Spot[], allocatedStayMin: number, addedMoveMin: number): boolean {
  const paidDwell = spots
    .filter(isPaidFacilityLike)
    .reduce((total, spot) => total + spot.dwell, 0);
  if (paidDwell === 0 || addedMoveMin <= 0) return true;

  const totalDwell = Math.max(1, spots.reduce((total, spot) => total + spot.dwell, 0));
  const paidStay = allocatedStayMin * (paidDwell / totalDwell);
  return paidStay >= addedMoveMin;
}

export function isTravelHeavyBrowse(spots: Spot[], allocatedStayMin: number, addedMoveMin: number): boolean {
  return spots.some((spot) => isQuickBrowseSpot(spot)) && allocatedStayMin < addedMoveMin;
}
