import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import { advanceVerifiedCourseProgress, buildVerifiedCourseProgressSteps, createVerifiedCourseRouteOpenLock, initialVerifiedCourseProgressState, markVerifiedCourseRouteOpened, requestNextVerifiedCourseRoute, verifiedCourseNextRouteLabel } from '../../src/ui/recommendation/verifiedCourseProgressModel';

const iso = (minute: number) => new Date(Date.UTC(2026, 7, 31, 1, minute)).toISOString();
const point = (id: string, label = id) => ({ id, label, lat: 35.1 + id.length / 100, lon: 129.0 + id.length / 100 });
function course(ids: string[], states: Array<'recommended' | 'short'> = []): VerifiedCourseV1 {
  const stops = ids.map((placeId, index) => ({ placeId, stayMin: 20 + index * 5, stayState: states[index] ?? 'recommended' as const, availabilityState: 'structured_verified' as const, arrivalAt: iso(index * 35 + 5), departureAt: iso(index * 35 + 25) }));
  const legs = [...ids.map((id, index) => ({ fromId: index ? ids[index - 1] : 'origin', toId: id, mode: index % 2 ? 'transit' as const : 'walk' as const, min: 5 + index })), { fromId: ids.at(-1)!, toId: 'destination', mode: 'walk' as const, min: 8 }];
  return { id: ids.join('|'), placeIds: ids, stops, legs, stayMin: stops.reduce((sum, stop) => sum + stop.stayMin, 0), travelMin: legs.reduce((sum, leg) => sum + leg.min, 0), totalMin: 90, arrivalBufferMin: 10, remainingAfterCourseMin: 12, remainingAfterArrivalBufferMin: 12 };
}

for (const count of [1, 2, 3]) test(`UPROGRESS01: ${count}곳 snapshot은 이동·체류·마지막 이동 순서를 보존한다`, () => {
  const item = course(['a', 'bb', 'ccc'].slice(0, count), ['recommended', 'short', 'recommended']);
  const steps = buildVerifiedCourseProgressSteps(item, point('origin', '출발지'), point('destination', '약속'), (id) => point(id));
  assert.ok(steps);
  assert.deepEqual(steps.map((step) => step.kind), Array.from({ length: count }, () => ['travel', 'stay']).flat().concat('travel'));
  assert.deepEqual(steps.filter((step) => step.kind === 'travel').map((step) => step.kind === 'travel' ? [step.from.id, step.target.id] : []), [['origin', 'a'], ...item.placeIds.slice(1).map((id, index) => [item.placeIds[index], id]), [item.placeIds.at(-1), 'destination']]);
  assert.deepEqual(steps.filter((step) => step.kind === 'stay').map((step) => step.kind === 'stay' ? [step.target.id, step.stayMin, step.stayState] : []), item.stops.map((stop) => [stop.placeId, stop.stayMin, stop.stayState]));
  const final = steps.at(-1);
  assert.equal(final?.kind, 'travel');
  if (final?.kind === 'travel') assert.equal(final.isFinal, true);
});

for (const count of [1, 2, 3]) test(`UPROGRESS01-R: ${count}곳 체류의 다음 길찾기는 같은 탭에서 한 번 열고 성공 때만 다음 이동으로 전이한다`, async () => {
  const item = course(['a', 'bb', 'ccc'].slice(0, count));
  const steps = buildVerifiedCourseProgressSteps(item, point('origin'), point('destination'), (id) => point(id));
  assert.ok(steps);
  let state = markVerifiedCourseRouteOpened(steps, initialVerifiedCourseProgressState());
  state = advanceVerifiedCourseProgress(steps, state);
  assert.equal(steps[state.stepIndex].kind, 'stay');
  let calls = 0;
  const result = await requestNextVerifiedCourseRoute(steps, state, async (travel) => {
    calls += 1;
    assert.deepEqual([travel.from.id, travel.target.id], [item.placeIds[0], count === 1 ? 'destination' : item.placeIds[1]]);
    return true; // app_opened 또는 HTTPS web_opened fixture
  });
  assert.equal(calls, 1);
  assert.equal(result.result, 'opened');
  assert.equal(result.state.stepIndex, state.stepIndex + 1);
  assert.equal(result.state.routeOpened, true);
});

test('UPROGRESS01-R: app/web 길찾기 실패는 체류 단계와 재시도 가능 상태를 유지한다', async () => {
  const steps = buildVerifiedCourseProgressSteps(course(['a', 'bb']), point('origin'), point('destination'), (id) => point(id));
  assert.ok(steps);
  let state = markVerifiedCourseRouteOpened(steps, initialVerifiedCourseProgressState());
  state = advanceVerifiedCourseProgress(steps, state);
  const appFailed = await requestNextVerifiedCourseRoute(steps, state, async () => false);
  const webFailed = await requestNextVerifiedCourseRoute(steps, state, async () => { throw new Error('web failed'); });
  assert.equal(appFailed.result, 'failed');
  assert.equal(webFailed.result, 'failed');
  assert.equal(appFailed.state, state);
  assert.equal(webFailed.state, state);
});

test('UPROGRESS01-R: same-tick 다음 길찾기는 화면 lock으로 한 번만 시작한다', () => {
  const lock = createVerifiedCourseRouteOpenLock();
  const firstRelease = lock.tryLock();
  assert.equal(typeof firstRelease, 'function');
  assert.equal(lock.tryLock(), null);
  firstRelease?.();
  assert.equal(typeof lock.tryLock(), 'function');
});

test('ULA departure regression: external return invalidates only the old lock owner', () => {
  const lock = createVerifiedCourseRouteOpenLock();
  const staleRelease = lock.tryLock();
  lock.resetForExternalReturn();
  const currentRelease = lock.tryLock();
  assert.equal(typeof currentRelease, 'function');
  staleRelease?.();
  assert.equal(lock.tryLock(), null, 'a late finally from the first Kakao handoff must not unlock departure routing');
  currentRelease?.();
  assert.equal(typeof lock.tryLock(), 'function');
});

test('URELEASEONESTOP01: 1곳 체류 뒤 최종 이동 CTA는 왕복과 도착지를 구분한다', () => {
  assert.equal(verifiedCourseNextRouteLabel(true, true), '도착지 길찾기');
  assert.equal(verifiedCourseNextRouteLabel(true, false), '복귀 길찾기');
  assert.equal(verifiedCourseNextRouteLabel(false, true), '다음 장소 길찾기');
});

test('UPROGRESS01: 왕복은 출발지를 마지막 목적지로 쓰고, 코스 시간·여유를 재계산하지 않는다', () => {
  const base = course(['a']);
  const item = { ...base, legs: [...base.legs.slice(0, -1), { ...base.legs.at(-1)!, toId: 'origin' }] };
  const origin = point('origin', '출발지');
  const steps = buildVerifiedCourseProgressSteps(item, origin, origin, (id) => point(id));
  assert.ok(steps);
  const final = steps.at(-1);
  assert.equal(final?.kind, 'travel');
  if (final?.kind === 'travel') assert.equal(final.target, origin);
  assert.equal(item.arrivalBufferMin, 10);
  assert.equal(item.remainingAfterCourseMin, 12);
});

test('UPROGRESS01: 길찾기를 열기 전 이동 단계·마지막 완료는 건너뛰거나 중복 완료할 수 없다', () => {
  const steps = buildVerifiedCourseProgressSteps(course(['a']), point('origin'), point('destination'), (id) => point(id));
  assert.ok(steps);
  let state = initialVerifiedCourseProgressState();
  assert.equal(advanceVerifiedCourseProgress(steps, state), state);
  state = markVerifiedCourseRouteOpened(steps, state);
  state = advanceVerifiedCourseProgress(steps, state);
  assert.equal(steps[state.stepIndex].kind, 'stay');
  state = advanceVerifiedCourseProgress(steps, state);
  assert.equal(steps[state.stepIndex].kind, 'travel');
  assert.equal(advanceVerifiedCourseProgress(steps, state), state);
  state = markVerifiedCourseRouteOpened(steps, state);
  state = advanceVerifiedCourseProgress(steps, state);
  assert.equal(state.finished, true);
  assert.equal(advanceVerifiedCourseProgress(steps, state), state);
});

test('UPROGRESS01: 손상된 legs·장소 좌표는 보정·재조회 없이 fail-closed한다', () => {
  const item = course(['a']);
  assert.equal(buildVerifiedCourseProgressSteps({ ...item, legs: item.legs.slice(0, -1) }, point('origin'), point('destination'), (id) => point(id)), null);
  assert.equal(buildVerifiedCourseProgressSteps(item, point('origin'), point('destination'), () => undefined), null);
});
