import { areaAvailabilityDuring } from "./areaAvailability";
import { isPaidFacilityLike, minimumStayForSpot } from "./recommendationPolicy";
import { isOpenDuringText } from "./tourapi";
import type { LatLon, Mode, Spot } from "./types";
import { travelMin } from "./travel";

/**
 * 지도 후보 단계에서는 외부 상세 API를 호출하지 않는다.
 * 정제 카탈로그의 공식 운영시간과 권역 시간대 정책만으로 닫힌 장소를 먼저 걸러낸다.
 * 운영시간 근거가 없으면 닫힌 것으로 추정하지 않는다. 해당 장소는 지도에서
 * `운영시간 확인 필요` 조건부 후보로 표시되고, 확정 직전 검증에서 자동 확정되지 않는다.
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
  if (areaAvailability) {
    // 공식 시간대가 등록된 권역은 닫힌 시간에 숨긴다. 등록 자체가 없는 권역은
    // 폐점으로 추정하지 않고 조건부 후보로만 남긴다.
    return areaAvailability.ok || areaAvailability.note === '권역형 추천 시간대 미확인';
  }

  const officialHours = spot.operatingHours?.[0];
  if (!officialHours) return true;
  const checked = isOpenDuringText(
    officialHours,
    visitStart,
    minimumStay,
    isPaidFacilityLike(spot),
  );
  return checked.ok || checked.note === '운영시간 미확인';
}
