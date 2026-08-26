import type { VerifiedCourseV1 } from '../../engine';

export type CourseV1JourneySegment =
  | { kind: 'leg'; key: string; min: number; mode: 'walk' | 'transit'; fromId: string; toId: string }
  | { kind: 'stop'; key: string; min: number; placeId: string; arrivalAt: string; departureAt: string; availabilityState: 'structured_verified' }
  | { kind: 'buffer'; key: 'arrival-buffer'; min: number }
  | { kind: 'remaining'; key: 'remaining-after-course'; min: number };

/** 엔진 스냅샷을 재계산하지 않고 UI 순서만 만든다. 계약이 깨지면 시간 여정을 표시하지 않는다. */
export function buildCourseV1JourneySegments(course: VerifiedCourseV1): CourseV1JourneySegment[] | null {
  if (course.legs.length !== course.stops.length + 1 || course.stops.length !== course.placeIds.length) return null;
  const segments: CourseV1JourneySegment[] = [];
  for (let index = 0; index < course.stops.length; index += 1) {
    const leg = course.legs[index];
    const stop = course.stops[index];
    if (leg.toId !== stop.placeId || stop.placeId !== course.placeIds[index]) return null;
    segments.push({ kind: 'leg', key: `leg-${index}-${leg.fromId}-${leg.toId}`, min: leg.min, mode: leg.mode, fromId: leg.fromId, toId: leg.toId });
    segments.push({ kind: 'stop', key: `stop-${index}-${stop.placeId}`, min: stop.stayMin, placeId: stop.placeId, arrivalAt: stop.arrivalAt, departureAt: stop.departureAt, availabilityState: stop.availabilityState });
  }
  const lastLeg = course.legs.at(-1);
  if (!lastLeg || lastLeg.fromId !== course.placeIds.at(-1)) return null;
  segments.push({ kind: 'leg', key: `leg-last-${lastLeg.fromId}-${lastLeg.toId}`, min: lastLeg.min, mode: lastLeg.mode, fromId: lastLeg.fromId, toId: lastLeg.toId });
  segments.push({ kind: 'buffer', key: 'arrival-buffer', min: course.arrivalBufferMin });
  // 역호환 fixture에는 값이 없을 수 있다. UI가 남은 시간을 추정하지 않도록 그 경우 구간도 생략한다.
  if (Number.isInteger(course.remainingAfterCourseMin) && course.remainingAfterCourseMin! >= 0) {
    segments.push({ kind: 'remaining', key: 'remaining-after-course', min: course.remainingAfterCourseMin! });
  }
  return segments;
}
