import { areaAvailabilityDuring } from "./areaAvailability";
import { isPaidFacilityLike, minimumStayForSpot } from "./recommendationPolicy";
import { isOpenDuringText } from "./tourapi";
import type { LatLon, Mode, Spot } from "./types";
import { travelMin } from "./travel";

/**
 * 지도 후보 단계에서는 외부 상세 API를 호출하지 않는다.
 * 정제 카탈로그의 공식 운영시간과 권역 시간대 정책만으로 닫힌 장소를 먼저 걸러낸다.
 */
export function passesLocalOpeningGate(input: {
  spot: Spot;
  origin: LatLon;
  mode: Mode;
  nowMin: number;
  arrivalMarginMin: number;
}): boolean {
  const { spot, origin, mode, nowMin, arrivalMarginMin } = input;
  const approachMin = travelMin(origin, spot, mode);
  const visitStart = nowMin + approachMin + arrivalMarginMin;
  const minimumStay = minimumStayForSpot(spot, approachMin);

  const areaAvailability = areaAvailabilityDuring(spot, visitStart, minimumStay);
  if (areaAvailability) return areaAvailability.ok;

  const officialHours = spot.operatingHours?.[0];
  return isOpenDuringText(
    officialHours,
    visitStart,
    minimumStay,
    isPaidFacilityLike(spot),
  ).ok;
}
