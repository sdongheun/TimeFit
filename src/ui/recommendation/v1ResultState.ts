import type { CourseV1LimitedResult } from '../../engine';

/** 이미 검증한 대안만 소비한다. 이 순수 상태 전환은 엔진·adapter를 다시 호출하지 않는다. */
export function advanceVerifiedAlternative(result: CourseV1LimitedResult): CourseV1LimitedResult {
  const next = result.alternativeCourses[0];
  if (!next) return result;
  const rest = result.alternativeCourses.slice(1);
  return { ...result, representativeCourse: next, alternativeCourses: rest, alternativeState: rest.length ? 'alternatives_available' : 'no_alternative_verified_course' };
}
