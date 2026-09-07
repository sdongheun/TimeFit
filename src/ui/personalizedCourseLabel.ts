import type { VerifiedCourseV1 } from '../engine';

/** Only the engine's verified actual-vs-baseline snapshot is evidence, never sample count. */
export function personalizedCoursePlaceIds(course: VerifiedCourseV1): readonly string[] {
  return course.stops.filter(stop => {
    const value = stop.dwellPersonalization;
    return value && Number.isFinite(value.baselineStayMin) && stop.stayMin === value.targetStayMin && stop.stayMin !== value.baselineStayMin;
  }).map(stop => stop.placeId);
}
