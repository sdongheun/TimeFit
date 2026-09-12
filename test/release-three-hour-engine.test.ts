import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReleaseOneStopRepresentativeCourseV1, beginReleaseTwoStopSelectionV1, continueReleaseOneStopRepresentativeCourseV1, type CourseV1Candidate, type CourseV1LimitedInput } from '../src/engine';

const place = (id: string, extra: Partial<CourseV1Candidate> = {}): CourseV1Candidate => ({
  id, title: id, lat: 35.151, lon: 129.061, classification: 'representative_standard',
  category: '자연', subCategory: '공원', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60,
  availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] }, ...extra,
});
function input(minutes: number, candidates = [place('a'), place('b')], now = new Date(2026, 8, 8, 10)): { input: CourseV1LimitedInput; calls: string[] } {
  const calls: string[] = [];
  return { calls, input: { now, origin: { id: 'origin', lat: 35.15, lon: 129.06 }, destination: null,
    remainingMin: minutes, arrivalBufferMin: 10, provider: { listRepresentativeCandidates: () => candidates },
    routes: { async getRoute() { throw new Error('legacy forbidden'); } },
    receiptRoutes: { async getRouteReceipt(from, to) { calls.push(`${from.id}>${to.id}`); return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } },
  } };
}

test('ENGINE-RELEASE-180: 119/120 및 121~180 전체는 동일 single/pair·체류·호출 예산을 유지한다', async () => {
  for (const minutes of [119, 120, ...Array.from({ length: 60 }, (_, i) => 121 + i)]) {
    const fixture = input(minutes);
    const single = await buildReleaseOneStopRepresentativeCourseV1(fixture.input);
    assert.equal(single.representativeCourse!.placeIds.length, 1);
    assert.equal(single.representativeCourse!.stayMin, 30);
    assert.equal(fixture.calls.length, 4);
    const pair = await beginReleaseTwoStopSelectionV1({ ...fixture.input, firstCourse: single.representativeCourse!, requestId: 'three-hour',
      ledger: { version: 1, initialOneStopAttempts: 4, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 4 } });
    assert.equal(pair.courses.length, 1);
    assert.equal(pair.courses[0]!.placeIds.length, 2);
    assert.equal(pair.courses[0]!.stayMin, 60);
    assert.equal(pair.courses[0]!.totalMin, 85);
    assert.equal(pair.courses[0]!.remainingAfterCourseMin, minutes - 85);
    assert.equal(fixture.calls.length, 10);
    assert.ok(pair.ledger.automaticTwoStopAttempts <= 16);
    assert.ok(pair.ledger.totalNewProviderAttempts <= 36);
  }
});

test('ENGINE-RELEASE-180: 181은 single throw/pair unavailable이며 route 0이다', async () => {
  const valid = input(180);
  const first = (await buildReleaseOneStopRepresentativeCourseV1(valid.input)).representativeCourse!;
  const invalid = input(181);
  await assert.rejects(buildReleaseOneStopRepresentativeCourseV1(invalid.input), RangeError);
  const result = await beginReleaseTwoStopSelectionV1({ ...invalid.input, firstCourse: first, requestId: '181',
    ledger: { version: 1, initialOneStopAttempts: 4, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 4 } });
  assert.equal(result.state, 'continuation_unavailable');
  assert.equal(invalid.calls.length, 0);
});

test('ENGINE-RELEASE-180: 180분 dense 후보도 initial/page 각각8회 single만 반환한다', async () => {
  const fixture = input(180, Array.from({ length: 12 }, (_, i) => place(`p${i}`)));
  const first = await buildReleaseOneStopRepresentativeCourseV1(fixture.input);
  assert.equal(fixture.calls.length, 8);
  const next = await continueReleaseOneStopRepresentativeCourseV1({ ...fixture.input, continuation: first.continuation! });
  assert.ok(fixture.calls.length - 8 <= 8);
  assert.ok([first.representativeCourse!, ...first.alternativeCourses, ...next.appendedCourses].every(course => course.placeIds.length === 1));
});

test('ENGINE-RELEASE-180: 자정 통과 ISO 날짜를 유지하고 익일 휴무에는 최소 체류를 허용하지 않는다', async () => {
  const now = new Date(2026, 8, 11, 23, 50); // 금요일 -> 토요일
  const open = input(180, [place('a')], now);
  const course = (await buildReleaseOneStopRepresentativeCourseV1(open.input)).representativeCourse!;
  assert.equal(course.stops[0]!.departureAt, new Date(2026, 8, 12, 0, 25).toISOString());
  assert.equal(course.remainingAfterCourseMin, 130);
  const closed = input(180, [place('a', { availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday'], windows: [] } })], now);
  assert.equal((await buildReleaseOneStopRepresentativeCourseV1(closed.input)).representativeCourse, null);
});

test('ENGINE-RELEASE-180: scheduled 자정 종료는 넘기지 않고 익일 도착의 휴무를 검사한다', async () => {
  const scheduled = input(180, [place('a', { availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 0, endMin: 1440 }] } })], new Date(2026, 8, 11, 23, 35));
  const course = (await buildReleaseOneStopRepresentativeCourseV1(scheduled.input)).representativeCourse!;
  assert.equal(course.stops[0]!.stayMin, 20);
  assert.equal(course.stops[0]!.departureAt, new Date(2026, 8, 12, 0, 0).toISOString());
  const after = input(180, [place('a', { availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday'], windows: [] } })], new Date(2026, 8, 11, 23, 58));
  assert.equal((await buildReleaseOneStopRepresentativeCourseV1(after.input)).representativeCourse, null);
});

test('ENGINE-RELEASE-180: pair도 익일 날짜와 여유 포함 시간 합산을 유지한다', async () => {
  const fixture = input(180, [place('a'), place('b')], new Date(2026, 8, 11, 23, 50));
  const single = await buildReleaseOneStopRepresentativeCourseV1(fixture.input);
  const pair = await beginReleaseTwoStopSelectionV1({ ...fixture.input, firstCourse: single.representativeCourse!, requestId: 'midnight-pair',
    ledger: { version: 1, initialOneStopAttempts: 4, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 4 } });
  assert.equal(pair.courses.length, 1);
  const course = pair.courses[0]!;
  assert.equal(course.placeIds.length, 2);
  assert.equal(course.totalMin, 85);
  assert.equal(course.remainingAfterCourseMin, 95);
  assert.ok(course.stops.every(stop => new Date(stop.departureAt).getDate() === 12));
  assert.equal(fixture.calls.length, 10);
});
