import { buildLimitedRepresentativeCourseV1, type CourseV1LimitedResult } from '../../engine';
import { createCourseV1CandidateProvider } from '../../data/courseV1CandidateProvider';
import { createCourseV1RouteAdapter } from '../../services/courseV1RouteAdapter';
import type { RecommendationSession } from '../nav';
import { parseRecommendationNowIso } from './recommendationSessionTime';

/** 직렬화된 navigation session을 엔진 호출 직전에만 Date로 복원한다. */
export function buildRecommendationEngineInput(session: RecommendationSession) {
  return { now: parseRecommendationNowIso(session.nowIso), origin: session.origin, destination: session.destination, remainingMin: session.remainingMin, arrivalBufferMin: session.arrivalBufferMin };
}

/** UI 컨테이너만 엔진 provider·실제 경로 adapter를 조립한다. 표시 화면은 result만 받는다. */
export async function runRecommendationSession(session: RecommendationSession): Promise<CourseV1LimitedResult> {
  return buildLimitedRepresentativeCourseV1({ ...buildRecommendationEngineInput(session), provider: createCourseV1CandidateProvider(), routes: createCourseV1RouteAdapter() });
}
