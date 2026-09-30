import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReleaseOneStopRepresentativeCourseV1, type CourseV1Candidate, type CourseV1RouteReceiptAdapter } from '../src/engine/courseV1';

const now = new Date('2026-09-02T10:00:00+09:00');
const origin = { id: 'origin', lat: 35.15, lon: 129.06 };
const destination = { id: 'destination', lat: 35.16, lon: 129.07 };
function place(id: string, extra: Partial<CourseV1Candidate> = {}): CourseV1Candidate {
  return { id, title: id, lat: 35.151, lon: 129.061, classification: 'representative_standard', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] }, ...extra };
}
function input(candidates: CourseV1Candidate[], receiptRoutes: CourseV1RouteReceiptAdapter, destinationPoint = destination) {
  return { now, origin, destination: destinationPoint, remainingMin: 90, arrivalBufferMin: 10, provider: { listRepresentativeCandidates: () => candidates }, routes: { async getRoute() { return null; } }, receiptRoutes };
}

test('2-U: release one-stop은 실제 두 legs·시간표·short 상태를 보존하고 continuation을 만들지 않는다', async () => {
  const result = await buildReleaseOneStopRepresentativeCourseV1(input([place('short')], {
    async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 30, exact: true }, newProviderAttemptCount: 1, reused: false }; },
  }));
  assert.deepEqual(result.representativeCourse?.placeIds, ['short']);
  assert.equal(result.representativeCourse?.legs.length, 2);
  assert.equal(result.representativeCourse?.stops[0]?.stayState, 'short');
  assert.equal(result.representativeCourse?.remainingAfterCourseMin, 0);
  assert.equal('continuation' in result, false);
});

test('2-U: receipt 요청은 endpoint↔candidate만 사용하며 candidate↔candidate는 0회다', async () => {
  const calls: string[] = [];
  const result = await buildReleaseOneStopRepresentativeCourseV1(input(['a', 'b', 'c'].map((id) => place(id)), {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  assert.ok(result.representativeCourse);
  assert.equal(calls.some((key) => /^a>[bc]$|^b>[ac]$|^c>[ab]$/.test(key)), false);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
});

test('REC-31-R1: 첫 8회로 4곳이 안 되면 남은 후보를 총 16회 안에서 자동 보충한다', async () => {
  const candidates = Array.from({ length: 8 }, (_, index) => place(`adaptive-${index}`));
  const failed = new Set(candidates.slice(0, 4).map((candidate) => candidate.id));
  const calls: string[] = [];
  const result = await buildReleaseOneStopRepresentativeCourseV1(input(candidates, {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      if (from.id === origin.id && failed.has(to.id)) {
        return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      }
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));

  assert.equal([result.representativeCourse, ...result.alternativeCourses].filter(Boolean).length, 4);
  assert.equal(result.diagnostics.newProviderAttemptCount, 12);
  assert.equal(calls.length, 12);
});

test('2-U: no_route/unavailable/운영시간 실패 후보는 건너뛰고 다른 single 후보만 검증한다', async () => {
  const calls: string[] = [];
  const candidates = [
    place('no-route'),
    place('closed', { availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday'], windows: [{ startMin: 600, endMin: 615 }] } }),
    place('ok'),
  ];
  const result = await buildReleaseOneStopRepresentativeCourseV1(input(candidates, {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      if (to.id === 'no-route') return { result: 'no_route', newProviderAttemptCount: 1, reused: false };
      if (to.id === 'closed') return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  assert.deepEqual(result.representativeCourse?.placeIds, ['ok']);
  assert.equal(calls.some((key) => key.startsWith('closed>')), false);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
  assert.ok((result.diagnostics.adapterCallCount ?? 0) <= 24);
});

test('2-U: endpoint와 같은 candidate ID는 public segment 요청 없이 fail-closed한다', async () => {
  const calls: string[] = [];
  const result = await buildReleaseOneStopRepresentativeCourseV1(input([place('origin')], {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  assert.equal(result.representativeCourse, null);
  assert.equal(calls.length, 0);
});

test('2-U/2-V: 18개 이상 후보에서도 다장소 진단 없이 single pool·single continuation만 만든다', async () => {
  const calls: string[] = [];
  const candidates = Array.from({ length: 20 }, (_, index) => place(`candidate-${String(index).padStart(2, '0')}`, {
    lat: 35.151 + index * 0.0001,
    lon: 129.061 + index * 0.0001,
  }));
  const result = await buildReleaseOneStopRepresentativeCourseV1(input(candidates, {
    async getRouteReceipt(from, to) {
      calls.push(`${from.id}>${to.id}`);
      return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
    },
  }));
  const cards = [result.representativeCourse, ...result.alternativeCourses].filter((course) => course !== null);

  assert.equal(result.diagnostics.providerCandidateCount, 20);
  assert.equal(result.diagnostics.preselectionCandidateCount, 20);
  assert.equal(result.diagnostics.candidatePoolCount, 18);
  assert.ok(result.diagnostics.wideSingleCandidateId);
  assert.ok(candidates.some((candidate) => candidate.id === result.diagnostics.wideSingleCandidateId));
  assert.equal(result.diagnostics.generatedOrderedCourseCount, 0);
  assert.equal(result.diagnostics.preselectionSlots, undefined);
  assert.equal(result.diagnostics.shapeDiagnostics, undefined);
  assert.ok(result.continuation);
  assert.equal(/candidateQueue|continuationQueue|lat|lon/.test(JSON.stringify(result.continuation)), false);
  assert.ok(cards.length > 0 && cards.length <= 4);
  assert.ok(cards.every((course) => course.placeIds.length === 1));
  assert.equal(calls.some((key) => /^candidate-\d+>candidate-\d+$/.test(key)), false);
  assert.ok((result.diagnostics.newProviderAttemptCount ?? 0) <= 8);
});
