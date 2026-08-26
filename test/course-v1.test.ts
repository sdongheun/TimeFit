import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1RouteAdapter,
} from '../src/engine/courseV1';

const origin = { id: 'origin', lat: 35.1578, lon: 129.0594 };
const destination = { id: 'destination', lat: 35.153, lon: 129.118 };
const now = new Date('2026-08-24T10:00:00+09:00');

function candidate(id: string, options: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  return {
    id,
    title: id,
    lat: 35.15 + Number(id.replace(/\D/g, '') || 0) / 1000,
    lon: 129.06,
    classification: 'representative_standard',
    minStayMin: 10,
    recommendedStayMin: 15,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 0, endMin: 1440 }] },
    ...options,
  };
}

function routes(minutes: Record<string, number>): CourseV1RouteAdapter {
  return {
    async getRoute(from, to) {
      const min = minutes[`${from.id}>${to.id}`];
      return min === undefined ? null : { mode: 'walk', min, exact: true };
    },
  };
}

test('45분 왕복: 대표 1곳만 반환하고 차량·조건부 후보는 자동 추천에서 제외한다', async () => {
  const result = await buildRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    candidates: [
      candidate('one'),
      candidate('conditional', { classification: 'conditional_more' }),
      candidate('car-only'),
    ],
    routes: routes({ 'origin>one': 5, 'one>origin': 5 }),
  });

  assert.deepEqual(result.representativeCourse?.placeIds, ['one']);
  assert.equal(result.diagnostics.classificationExcluded, 1);
  assert.ok(result.diagnostics.routeRejected > 0);
  assert.equal(result.alternativeState, 'no_alternative_verified_course');
});

test('90분 별도 도착지: 실제 모든 구간과 도착 여유를 포함해 1·2곳을 비교한다', async () => {
  const result = await buildRepresentativeCourseV1({
    now, origin, destination, remainingMin: 90, arrivalBufferMin: 10,
    candidates: [candidate('one'), candidate('two')],
    routes: routes({
      'origin>one': 10, 'one>destination': 15,
      'origin>two': 12, 'two>destination': 15,
      'one>two': 5, 'two>one': 5,
    }),
  });

  assert.deepEqual(result.representativeCourse?.placeIds, ['one']);
  assert.ok(result.alternativeCourseIds.some((id) => id.includes('one') && id.includes('two')));
  assert.equal(result.representativeCourse?.arrivalBufferMin, 10);
  assert.equal(result.representativeCourse?.totalMin, 50);
});

test('180분: 1·2·3곳 순열을 모두 평가하되 3곳을 강제하지 않는다', async () => {
  const candidates = [candidate('one'), candidate('two'), candidate('three')];
  const minutes: Record<string, number> = {};
  for (const from of [origin, ...candidates]) for (const to of [...candidates, destination]) {
    if (from.id !== to.id) minutes[`${from.id}>${to.id}`] = 5;
  }
  const result = await buildRepresentativeCourseV1({
    now, origin, destination, remainingMin: 180, arrivalBufferMin: 10, candidates, routes: routes(minutes),
  });

  assert.equal(result.diagnostics.evaluatedByPlaceCount[1], 3);
  assert.equal(result.diagnostics.evaluatedByPlaceCount[2], 6);
  assert.equal(result.diagnostics.evaluatedByPlaceCount[3], 6);
  assert.equal(result.representativeCourse?.placeIds.length, 1);
});

test('운영시간 종료 직전·실경로 실패·관계 중복은 대표와 대안에서 제외한다', async () => {
  const closed = candidate('closed', {
    availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 600, endMin: 615 }] },
  });
  const groupedA = candidate('group-a', { siteGroupId: 'same' });
  const groupedB = candidate('group-b', { siteGroupId: 'same' });
  const result = await buildRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5,
    candidates: [closed, groupedA, groupedB],
    routes: routes({
      'origin>closed': 10, 'closed>origin': 10,
      'origin>group-a': 5, 'group-a>origin': 5,
      'origin>group-b': 5, 'group-b>origin': 5,
      'group-a>group-b': 5, 'group-b>group-a': 5,
    }),
  });

  assert.ok(result.representativeCourse);
  assert.notEqual(result.representativeCourse?.placeIds[0], 'closed');
  assert.ok(result.alternativeCourseIds.every((id) => !id.includes('group-a|group-b') && !id.includes('group-b|group-a')));
  assert.ok(result.diagnostics.openingRejected > 0);
  assert.ok(result.diagnostics.relationshipRejected > 0);
});

test('후보가 없거나 유효 코스가 없으면 대표 null과 결정적 상태를 반환한다', async () => {
  const empty = await buildRepresentativeCourseV1({ now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5, candidates: [], routes: routes({}) });
  assert.equal(empty.representativeCourse, null);
  assert.equal(empty.alternativeState, 'no_candidates');

  const unavailable = await buildRepresentativeCourseV1({
    now, origin, destination: null, remainingMin: 45, arrivalBufferMin: 5,
    candidates: [candidate('only')], routes: routes({}),
  });
  assert.equal(unavailable.representativeCourse, null);
  assert.equal(unavailable.alternativeState, 'no_candidates');
  assert.equal(unavailable.diagnostics.routeRejected, 1);
});

test('1~180분 이외의 입력은 즉시 거부한다', async () => {
  for (const remainingMin of [0, 181]) {
    await assert.rejects(() => buildRepresentativeCourseV1({ now, origin, destination: null, remainingMin, arrivalBufferMin: 5, candidates: [], routes: routes({}) }), /1~180/);
  }
});
