import type { CourseV1LimitedResult, CourseV1ReleaseOneStopResult, VerifiedCourseV1 } from '../../engine';

export type RecommendationResult = CourseV1LimitedResult | CourseV1ReleaseOneStopResult;

export type ReleaseOneStopDisplayResult = Readonly<{
  representativeCourse: VerifiedCourseV1 | null;
  alternativeCourses: readonly VerifiedCourseV1[];
  resultState: RecommendationResult['resultState'];
  alternativeState: RecommendationResult['alternativeState'];
  primaryOutcomeReason?: RecommendationResult['primaryOutcomeReason'];
}>;

const singlePlaceId = (course: VerifiedCourseV1 | null | undefined): string | null => course?.placeIds.length === 1 ? course.placeIds[0] ?? null : null;

/** Never truncates a course, promotes an alternative, or starts a route call. */
export function releaseOneStopDisplayResult(result: RecommendationResult): ReleaseOneStopDisplayResult {
  const representativeId = singlePlaceId(result.representativeCourse);
  if (!representativeId || !result.representativeCourse) {
    return {
      representativeCourse: null,
      alternativeCourses: [],
      resultState: result.representativeCourse ? 'no_verified_course_within_limit' : result.resultState,
      alternativeState: result.representativeCourse ? 'no_alternative_verified_course' : result.alternativeState,
      ...(result.primaryOutcomeReason ? { primaryOutcomeReason: result.primaryOutcomeReason } : {}),
    };
  }
  const seen = new Set([representativeId]);
  const alternativeCourses = result.alternativeCourses.filter((course) => {
    const placeId = singlePlaceId(course);
    if (!placeId || seen.has(placeId)) return false;
    seen.add(placeId);
    return true;
  }).slice(0, 3);
  return {
    representativeCourse: result.representativeCourse,
    alternativeCourses,
    resultState: 'verified',
    alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course',
    ...(result.primaryOutcomeReason ? { primaryOutcomeReason: result.primaryOutcomeReason } : {}),
  };
}
