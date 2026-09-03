import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLimitedRepresentativeCourseV1,
  continueLimitedRepresentativeCourseV1,
  type CourseV1Candidate,
  type CourseV1RouteReceiptAdapter,
} from '../src/engine/courseV1';

const now = new Date('2026-08-31T10:00:00+09:00');
const areas = [
  ['sasang', 35.1631, 128.9854],
  ['seomyeon', 35.1578, 129.0594],
  ['busan-station', 35.1151, 129.0422],
  ['nampo', 35.0979, 129.0304],
  ['gwanganri', 35.1532, 129.1187],
  ['haeundae', 35.1587, 129.1604],
] as const;
const remainingMinutes = [45, 78, 120, 180] as const;

function candidate(id: string, lat: number, lon: number): CourseV1Candidate {
  return {
    id,
    title: id,
    lat,
    lon,
    classification: 'representative_standard',
    minStayMin: 5,
    recommendedStayMin: 5,
    maxStayMin: 10,
    availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] },
  };
}

function exactReceipt(calls: string[]): CourseV1RouteReceiptAdapter {
  return {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  };
}

test('QA-RESULTS-01: 6개 생활권 × 45/78/120/180분 × 복귀/도착지 fixture는 실제 시간 여정과 첫 페이지 계수를 재현한다', async () => {
  const cases = areas.flatMap(([id, lat, lon]) => remainingMinutes.flatMap((remainingMin) => [
    { id: `${id}-${remainingMin}-return`, remainingMin, origin: { id: `${id}-origin`, lat, lon }, destination: null },
    { id: `${id}-${remainingMin}-destination`, remainingMin, origin: { id: `${id}-origin`, lat, lon }, destination: { id: `${id}-destination`, lat: lat + 0.002, lon: lon + 0.002 } },
  ]));
  assert.equal(cases.length, 48);

  for (const scenario of cases) {
    const calls: string[] = [];
    const result = await buildLimitedRepresentativeCourseV1({
      now,
      origin: scenario.origin,
      destination: scenario.destination,
      remainingMin: scenario.remainingMin,
      arrivalBufferMin: 5,
      provider: { listRepresentativeCandidates: () => ['a', 'b', 'c'].map((id, index) => candidate(`${scenario.id}-${id}`, scenario.origin.lat + (index + 1) / 10_000, scenario.origin.lon)) },
      routes: { async getRoute() { return null; } },
      receiptRoutes: exactReceipt(calls),
    });
    const courses = [result.representativeCourse, ...result.alternativeCourses].filter(Boolean);
    assert.ok(courses.length > 0, scenario.id);
    assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8, scenario.id);
    assert.ok(calls.length > 0, scenario.id);
    for (const course of courses) {
      assert.ok(course!.legs.length === course!.stops.length + 1, scenario.id);
      assert.ok(course!.totalMin <= scenario.remainingMin, scenario.id);
    }
  }
});

test('QA-RESULTS-01: 8회 뒤 보충·큐 소진·전역 불가와 이어보기 fail-closed를 receipt로 구분한다', async () => {
  const origin = { id: 'qa-results-origin', lat: 35.1578, lon: 129.0594 };
  const candidates = Array.from({ length: 8 }, (_, index) => candidate(`qa-${index}`, origin.lat + (index + 1) / 10_000, origin.lon));
  const calls: string[] = [];
  const receiptRoutes: CourseV1RouteReceiptAdapter = {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return to.id === candidates[0]?.id
        ? { result: 'no_route', newProviderAttemptCount: 1, reused: false }
        : { result: 'exact', route: { mode: 'walk', min: 1, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  };
  const input = { now, origin, destination: null, remainingMin: 90, arrivalBufferMin: 5, provider: { listRepresentativeCandidates: () => candidates }, routes: { async getRoute() { return null; } }, receiptRoutes };
  const first = await buildLimitedRepresentativeCourseV1(input);
  assert.ok((first.diagnostics.newProviderAttemptCount ?? 0) > 8);
  assert.ok((first.diagnostics.newProviderAttemptCount ?? 0) <= 16);
  assert.equal(first.continuation?.stopReason, undefined);

  const before = calls.length;
  const unavailable = await continueLimitedRepresentativeCourseV1({
    ...input,
    continuation: { ...first.continuation!, candidatePlaceIds: first.continuation!.candidatePlaceIds.slice(1) },
  });
  assert.equal(unavailable.pageState, 'continuation_unavailable');
  assert.equal(calls.length, before);

  const stopped = await buildLimitedRepresentativeCourseV1({
    ...input,
    receiptRoutes: { async getRouteReceipt() { return { result: 'unavailable', newProviderAttemptCount: 0, reused: false }; } },
  });
  assert.equal(stopped.continuation?.stopReason, 'provider_unavailable');
});
