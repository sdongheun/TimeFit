/**
 * M-01~04의 고정 receipt matrix만 사용하는 test-only 경계다.
 * production/UI는 `src/engine` barrel의 A8 또는 고정 B12 entry만 소비한다.
 */
export { buildLimitedRepresentativeCourseV1ForTestOnlyReceiptEvaluation } from './courseV1';
