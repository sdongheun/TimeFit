import {
  automaticLegMode,
  automaticTravelLegs,
  hasBalancedPaidVisit,
  minimumStayForCourse,
  safetyBufferMin,
  travelGeo,
  travelMin,
  travelSrc,
  type Course,
  type LatLon,
  type Mode,
  type Spot,
} from "../../engine";
import type { PlanCtx } from "../nav";

function routeMoveMin(
  spots: Spot[],
  origin: LatLon,
  target: LatLon,
  mode: Course["bestMode"],
): number {
  let current: LatLon = origin;
  let total = 0;
  for (const spot of spots) {
    total += travelMin(current, spot, mode ?? automaticLegMode(current, spot));
    current = spot;
  }
  return total + travelMin(current, target, mode ?? automaticLegMode(current, target));
}

function courseApproachMins(
  spots: Spot[],
  origin: LatLon,
  mode: Course["bestMode"],
): number[] {
  let current = origin;
  return spots.map((spot) => {
    const min = travelMin(current, spot, mode ?? automaticLegMode(current, spot));
    current = spot;
    return min;
  });
}

// 장바구니 편집 중에는 경로 API를 호출하지 않고 캐시/거리 근사값으로만 순서를 정한다.
export function optimizeBasketSpotOrder(
  spots: Spot[],
  origin: LatLon,
  target: LatLon,
  mode: Course["bestMode"] = undefined,
): Spot[] {
  if (spots.length < 2) return spots;
  const remaining = [...spots];
  const ordered: Spot[] = [];
  let current: LatLon = origin;

  while (remaining.length) {
    remaining.sort((a, b) => {
      const aMode = mode ?? automaticLegMode(current, a);
      const bMode = mode ?? automaticLegMode(current, b);
      const aCost =
        travelMin(current, a, aMode) +
        travelMin(a, target, mode ?? automaticLegMode(a, target)) * 0.15;
      const bCost =
        travelMin(current, b, bMode) +
        travelMin(b, target, mode ?? automaticLegMode(b, target)) * 0.15;
      return aCost - bCost || a.title.localeCompare(b.title, "ko");
    });
    const next = remaining.shift();
    if (!next) break;
    ordered.push(next);
    current = next;
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let start = 0; start < ordered.length - 1 && !improved; start++) {
      for (let end = start + 1; end < ordered.length; end++) {
        const trial = [
          ...ordered.slice(0, start),
          ...ordered.slice(start, end + 1).reverse(),
          ...ordered.slice(end + 1),
        ];
        if (routeMoveMin(trial, origin, target, mode) < routeMoveMin(ordered, origin, target, mode)) {
          ordered.splice(0, ordered.length, ...trial);
          improved = true;
          break;
        }
      }
    }
  }
  return ordered;
}

export function buildBasketCourse(
  selected: Spot[],
  origin: LatLon,
  target: LatLon,
  ctx: PlanCtx,
  arrivalModes: Partial<Record<string, Mode>> = {},
): Course {
  const travelPlan = automaticTravelLegs(selected, origin, target, arrivalModes);
  const buffer = Math.max(...travelPlan.map((leg) => safetyBufferMin(leg.mode)));
  const budget = ctx.remainingMin - buffer;
  const moveMin = travelPlan.reduce(
    (sum, leg) => sum + travelMin(leg.from, leg.to, leg.mode),
    0,
  );
  const stayPool = Math.max(0, budget - moveMin);
  const dwellTotal = selected.reduce((total, spot) => total + spot.dwell, 0);
  let allocatedLeft = stayPool;
  let current: LatLon = origin;
  const legs: Course["legs"] = [];

  selected.forEach((spot, index) => {
    const travel = travelPlan[index];
    const stay =
      index === selected.length - 1
        ? Math.max(0, allocatedLeft)
        : Math.min(
            allocatedLeft,
            Math.round(stayPool * (spot.dwell / Math.max(dwellTotal, 1))),
          );
    allocatedLeft -= stay;
    legs.push({
      label: `${index === 0 ? "출발" : "이동"} → ${spot.title}`,
      min: travelMin(current, spot, travel.mode),
      src: travelSrc(current, spot, travel.mode),
      mode: travel.mode,
      geo: travelGeo(current, spot, travel.mode),
    });
    legs.push({ label: `체류 가능 · ${spot.title}`, min: stay, src: spot.dwellSrc });
    current = spot;
  });

  const finalTravel = travelPlan[travelPlan.length - 1];
  const lastMove = travelMin(current, target, finalTravel.mode);
  legs.push({
    label: ctx.appointment ? "다음 스케줄로" : "출발지로 복귀",
    min: lastMove,
    src: travelSrc(current, target, finalTravel.mode),
    mode: finalTravel.mode,
    geo: travelGeo(current, target, finalTravel.mode),
  });

  const totalStay = stayPool - allocatedLeft;
  const directMove = ctx.appointment ? travelMin(origin, target, automaticLegMode(origin, target)) : 0;
  const addedMove = Math.max(0, moveMin - directMove);
  const minStay = minimumStayForCourse(selected, courseApproachMins(selected, origin, undefined));
  const mobility = {
    transit: {
      mode: "transit",
      moveMin,
      stayMin: stayPool,
      totalMin: moveMin + totalStay,
      bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
      ok: stayPool >= minStay && hasBalancedPaidVisit(selected, totalStay, addedMove),
      legs,
    },
  } as Course["mobility"];

  return {
    type: selected.length >= 2 ? "미니코스" : "단일",
    spots: selected,
    totalMin: moveMin + totalStay,
    legs,
    bufferLeftMin: ctx.remainingMin - moveMin - totalStay,
    bestMode: travelPlan.some((leg) => leg.mode === "transit") ? "transit" : "walk",
    mobility,
    why: `구간별 자동 이동 · 이동 ${moveMin}분 · 체류 가능 ${Math.round(stayPool)}분`,
  };
}
