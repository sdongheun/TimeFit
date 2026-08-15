import { LatLon, Mode, Spot } from './types';
import { travelMin } from './travel';

export type AutomaticTravelLeg = { from: LatLon; to: LatLon; mode: Mode };

// 도보로 약 14분 안에 연결되는 장소는 걷고, 그보다 먼 구간은 대중교통을 기본으로 한다.
// 차량은 택시와 자차의 지속성 정책이 분리되기 전까지 자동으로 선택하지 않는다.
export const AUTO_WALK_LIMIT_MIN = 14;

export function automaticLegMode(from: LatLon, to: LatLon): Mode {
  return travelMin(from, to, 'walk') <= AUTO_WALK_LIMIT_MIN ? 'walk' : 'transit';
}

// `arrivalModes`는 각 장소에 도착하는 구간만 사용자가 명시적으로 고른 수단이다.
// 마지막 약속 장소(또는 복귀 지점) 구간은 별도 선택 전까지 자동 추천을 유지한다.
export function automaticTravelLegs(
  spots: Spot[],
  origin: LatLon,
  target: LatLon,
  arrivalModes: Partial<Record<string, Mode>> = {},
): AutomaticTravelLeg[] {
  const out: AutomaticTravelLeg[] = [];
  let current = origin;
  for (const spot of spots) {
    out.push({
      from: current,
      to: spot,
      mode: arrivalModes[spot.contentId] ?? automaticLegMode(current, spot),
    });
    current = spot;
  }
  out.push({ from: current, to: target, mode: automaticLegMode(current, target) });
  return out;
}
