import type {
  CourseV1ReleaseOneStopContinuation,
  CourseV1ReleaseOneStopContinuationResult,
  CourseV1ReleaseOneStopPageState,
  VerifiedCourseV1,
} from '../../engine';
import { releaseOneStopDisplayResult, type RecommendationResult } from './releaseOneStopResultsModel';

export type ReleaseOneStopMoreState = Readonly<{
  representativeCourse: VerifiedCourseV1 | null;
  alternativeCourses: readonly VerifiedCourseV1[];
  continuation: CourseV1ReleaseOneStopContinuation | null;
  pageState: CourseV1ReleaseOneStopPageState | null;
}>;

function releaseContinuation(result: RecommendationResult): CourseV1ReleaseOneStopContinuation | null {
  const continuation = result.continuation;
  if (!continuation || !('attemptedCandidateIds' in continuation) || !('verifiedCandidateIds' in continuation)) return null;
  return continuation;
}

export function initialReleaseOneStopMoreState(result: RecommendationResult): ReleaseOneStopMoreState {
  const display = releaseOneStopDisplayResult(result);
  const continuation = releaseContinuation(result);
  return {
    representativeCourse: display.representativeCourse,
    alternativeCourses: display.alternativeCourses,
    continuation,
    pageState: continuation ? 'more_available' : null,
  };
}

const singlePlaceId = (course: VerifiedCourseV1): string | null => course.placeIds.length === 1 ? course.placeIds[0] ?? null : null;

/** 한 page의 앞 3개만 검토하고 기존 순서 뒤에 붙인다. 중복·다장소를 건너뛰어도 다음 page를 자동 호출하지 않는다. */
export function appendReleaseOneStopPage(
  state: ReleaseOneStopMoreState,
  page: CourseV1ReleaseOneStopContinuationResult,
): ReleaseOneStopMoreState {
  let representativeCourse = state.representativeCourse;
  const alternativeCourses = [...state.alternativeCourses];
  const seen = new Set<string>();
  if (representativeCourse) {
    const representativeId = singlePlaceId(representativeCourse);
    if (representativeId) seen.add(representativeId);
  }
  alternativeCourses.forEach((course) => {
    const placeId = singlePlaceId(course);
    if (placeId) seen.add(placeId);
  });

  for (const course of page.appendedCourses.slice(0, 3)) {
    const placeId = singlePlaceId(course);
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);
    if (!representativeCourse) representativeCourse = course;
    else alternativeCourses.push(course);
  }
  return {
    representativeCourse,
    alternativeCourses,
    continuation: page.continuation,
    pageState: page.pageState,
  };
}

export function releaseOneStopMoreEndMessage(state: ReleaseOneStopMoreState['pageState']): string | null {
  if (!state || state === 'more_available') return null;
  if (state === 'exhausted') return '이 조건에서 확인할 수 있는 다른 장소가 없어요';
  if (state === 'provider_unavailable') return '다른 장소를 지금 확인하지 못했어요';
  return '이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.';
}

export function createReleaseOneStopMoreInFlightLock() {
  let locked = false;
  return {
    tryLock() { if (locked) return false; locked = true; return true; },
    release() { locked = false; },
  };
}
