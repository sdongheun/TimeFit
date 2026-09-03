import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConfirmedConditionalManualCourseV1, type ConditionalManualCourseV1Input, type CourseV1Candidate, type CourseV1RouteReceiptAdapter } from '../src/engine/courseV1';

const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const now = new Date('2026-08-24T10:00:00+09:00');
const conditional = (id = 'market'): CourseV1Candidate => ({
  id, title: id, lat: 35.151, lon: 129.061, classification: 'conditional_more', minStayMin: 10, recommendedStayMin: 20, maxStayMin: 30,
  availability: { status: 'needs_review', alwaysAccessible: false, dayTypes: [], windows: [] },
  conditionalVisit: { kind: 'market_or_street', displayWindow: { start: '10:00', end: '18:00' }, requiresUserHoursConfirmation: true },
});
function adapter(calls: string[], outcome: 'exact' | 'no_route' | 'unavailable' = 'exact'): CourseV1RouteReceiptAdapter {
  return { async getRouteReceipt(from, to) {
    calls.push(`${from.id}>${to.id}`);
    if (outcome === 'unavailable') return { result: 'unavailable', newProviderAttemptCount: 1, reused: false };
    if (outcome === 'no_route') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
  } };
}
function input(overrides: Partial<ConditionalManualCourseV1Input> = {}, calls: string[] = []): ConditionalManualCourseV1Input {
  return { now, origin, destination: null, remainingMin: 60, arrivalBufferMin: 5, conditionalCandidates: [conditional()], selectedPlaceId: 'market', userConfirmedHours: true, receiptRoutes: adapter(calls), ...overrides };
}

test('2-R: 명시 확인 조건부 시장은 실제 두 legs와 사용자 확인 상태를 유지한다', async () => {
  const calls: string[] = [];
  const result = await buildConfirmedConditionalManualCourseV1(input({}, calls));
  assert.equal(result.state, 'conditional_manual_course');
  if (result.state !== 'conditional_manual_course') return;
  assert.equal(result.hoursStatus, 'hours_confirmation_required_user_confirmed');
  assert.equal(result.course.stops[0]?.stayState, 'recommended');
  assert.equal(result.receipt.newProviderAttemptCount, 2);
  assert.deepEqual(calls, ['origin>market', 'market>origin']);
  assert.equal(JSON.stringify(result).includes('conditional_more'), false);
});

test('2-R: 확인 시각 창·확인값·대표/시설 후보는 receipt 호출 없이 거절한다', async () => {
  for (const [override, reason] of [
    [{ now: new Date('2026-08-24T09:59:00+09:00') }, 'conditional_display_window_unavailable'],
    [{ now: new Date('2026-08-24T18:00:00+09:00') }, 'conditional_display_window_unavailable'],
    [{ userConfirmedHours: false } as unknown as Partial<ConditionalManualCourseV1Input>, 'conditional_confirmation_required'],
    [{ selectedPlaceId: 'missing' }, 'conditional_candidate_not_eligible'],
    [{ conditionalCandidates: [{ ...conditional(), classification: 'representative_standard' }] }, 'conditional_candidate_not_eligible'],
    [{ conditionalCandidates: [{ ...conditional(), conditionalVisit: undefined }] }, 'conditional_candidate_not_eligible'],
  ] as const) {
    const calls: string[] = [];
    const result = await buildConfirmedConditionalManualCourseV1(input(override, calls));
    assert.equal(result.state, 'rejected');
    if (result.state === 'rejected') assert.equal(result.reason, reason);
    assert.equal(calls.length, 0);
  }
});

test('2-R: 이미 CTA 시각 기준으로 차감된 remainingMin만 소비하며 10:00·17:59는 두 leg를 허용한다', async () => {
  // UI가 confirmedAt까지의 경과 시간을 차감한 remainingMin을 준다. 엔진은 session 시작 시각을 받거나 다시 계산하지 않는다.
  for (const confirmedAt of ['2026-08-24T10:00:00+09:00', '2026-08-24T17:59:00+09:00']) {
    const calls: string[] = [];
    const result = await buildConfirmedConditionalManualCourseV1(input({ now: new Date(confirmedAt), remainingMin: 60 }, calls));
    assert.equal(result.state, 'conditional_manual_course');
    assert.equal(calls.length, 2);
  }
});

test('2-R: 두 구간의 새 provider attempt는 최대 4이며 reused receipt는 attempt 0으로 보존한다', async () => {
  const budgets: number[] = [];
  const highCost: CourseV1RouteReceiptAdapter = { async getRouteReceipt(_from, _to, budget) {
    budgets.push(budget.maxNewProviderAttemptCount);
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 2, reused: false };
  } };
  const expensive = await buildConfirmedConditionalManualCourseV1(input({ receiptRoutes: highCost }));
  assert.equal(expensive.state, 'conditional_manual_course');
  if (expensive.state === 'conditional_manual_course') assert.deepEqual(expensive.receipt, { adapterCallCount: 2, newProviderAttemptCount: 4, cacheOrSessionReuseCount: 0 });
  assert.deepEqual(budgets, [2, 2]);

  const reused = await buildConfirmedConditionalManualCourseV1(input({ receiptRoutes: { async getRouteReceipt() {
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 0, reused: true };
  } } }));
  assert.equal(reused.state, 'conditional_manual_course');
  if (reused.state === 'conditional_manual_course') assert.deepEqual(reused.receipt, { adapterCallCount: 2, newProviderAttemptCount: 0, cacheOrSessionReuseCount: 2 });
});

test('2-R: 성공 공개 반환은 후보 배열·좌표·사용자/카카오 원문을 노출하지 않는다', async () => {
  const result = await buildConfirmedConditionalManualCourseV1(input({ conditionalCandidates: [conditional('market'), conditional('other')], selectedPlaceId: 'market' }));
  const serialized = JSON.stringify(result);
  assert.equal(/conditionalCandidates|userId|kakao|openingHours|\"lat\"|\"lon\"/i.test(serialized), false);
  assert.equal(result.state, 'conditional_manual_course');
  if (result.state === 'conditional_manual_course') assert.equal(result.hoursStatus, 'hours_confirmation_required_user_confirmed');
});

test('2-R: 권장 불가면 최소 체류, 최소도 불가/no-route/unavailable은 typed rejection이다', async () => {
  const short = await buildConfirmedConditionalManualCourseV1(input({ remainingMin: 30 }));
  assert.equal(short.state, 'conditional_manual_course');
  if (short.state === 'conditional_manual_course') assert.equal(short.course.stops[0]?.stayState, 'short');
  const budget = await buildConfirmedConditionalManualCourseV1(input({ remainingMin: 24 }));
  assert.deepEqual(budget.state === 'rejected' ? budget.reason : null, 'time_budget_exceeded');
  const noRoute = await buildConfirmedConditionalManualCourseV1(input({ receiptRoutes: adapter([], 'no_route') }));
  assert.deepEqual(noRoute.state === 'rejected' ? noRoute.reason : null, 'route_not_verified');
  const unavailable = await buildConfirmedConditionalManualCourseV1(input({ receiptRoutes: adapter([], 'unavailable') }));
  assert.deepEqual(unavailable.state === 'rejected' ? unavailable.reason : null, 'route_verification_unavailable');
});
