import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1LimitedResult } from '../../src/engine';
import { buildRecommendationExplorationPage, explorationSelectionMessage, verifyRecommendationExplorationPlace } from '../../src/ui/recommendation/v1Session';

const session = { nowIso: '2026-08-31T06:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.1578, lon: 129.0594 }, destination: null, remainingMin: 120, arrivalBufferMin: 10 };
const result = { representativeCourse: null, alternativeCourses: [], resultState: 'no_verified_course_within_limit', alternativeState: 'no_candidates', diagnostics: { providerCandidateCount: 0, preselectionCandidateCount: 0, candidatePoolCount: 0, generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0 } } as CourseV1LimitedResult;

test('UEXPLORE01-01: 탐색 첫 묶음·더 보기는 대표/conditional을 바꾸거나 route port를 소비하지 않는다', () => {
  const first = buildRecommendationExplorationPage(session, result);
  const next = first.nextCursor === null ? null : buildRecommendationExplorationPage(session, result, first.nextCursor);
  const all = [...first.places, ...(next?.places ?? [])];
  assert.ok(first.places.length > 0);
  assert.ok(all.every((place) => place.eligibility === 'representative' || place.eligibility === 'area_access'));
  assert.equal(new Set(all.map((place) => place.placeId)).size, all.length);
  assert.ok(all.every((place) => place.eligibility !== 'area_access' || place.accessEvidence?.status === 'public_outdoor_access'));
});

test('UEXPLORE01-02: receipt port가 없는 선택은 목록을 바꾸지 않는 안전한 경로 확인 실패가 된다', async () => {
  let legacyPortCalls = 0;
  const selected = await verifyRecommendationExplorationPlace(session, result, 'missing-place', { routeProxyEnabled: false }, { createLegacyRoutes: () => { legacyPortCalls += 1; throw new Error('no route port'); } });
  assert.deepEqual(selected, { state: 'rejected', reason: 'route_verification_unavailable', receipt: { adapterCallCount: 0, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 0 } });
  assert.equal(legacyPortCalls, 1);
});

test('UEXPLORE01-03: area_access 카드 선택만 한 곳의 검증 snapshot과 두 receipt 호출로 전환한다', async () => {
  let receiptCalls = 0;
  const routePort = {
    async getRoute() { return null; },
    async getRouteReceipt() {
      receiptCalls += 1;
      return { result: 'exact' as const, route: { mode: 'walk' as const, min: 5, exact: true as const }, newProviderAttemptCount: 0 as const, reused: true };
    },
  };
  const selected = await verifyRecommendationExplorationPlace(session, result, 'poi_646', { routeProxyEnabled: true }, { createLegacyRoutes: () => { throw new Error('legacy must not run'); }, createActivatedProxyRoutes: async () => routePort });
  assert.equal(selected.state, 'verified');
  assert.equal(selected.state === 'verified' ? selected.course.placeIds[0] : null, 'poi_646');
  assert.equal(receiptCalls, 2);
});

test('UEXPLORE01-04: 선택 실패 문구는 route/time/access 고정 문장만 쓴다', () => {
  assert.equal(explorationSelectionMessage('route_not_verified'), '경로를 확인하지 못했어요.');
  assert.equal(explorationSelectionMessage('route_verification_unavailable'), '경로를 확인하지 못했어요.');
  assert.equal(explorationSelectionMessage('time_budget_exceeded'), '시간이 부족해요.');
  assert.equal(explorationSelectionMessage('access_window_unavailable'), '접근 가능 시간을 확인하지 못했어요.');
});
