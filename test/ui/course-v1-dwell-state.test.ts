import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import { courseV1CourseDwellStatus, courseV1StopDwellLabel } from '../../src/ui/recommendation/courseV1DwellStateModel';
import { buildCourseV1JourneySegments } from '../../src/ui/recommendation/courseV1JourneyModel';

const iso = '2026-08-30T06:00:00.000Z';
const course = (stops: VerifiedCourseV1['stops']): VerifiedCourseV1 => ({
  id: 'dwell-fixture', placeIds: stops.map((stop) => stop.placeId), stops,
  legs: [...stops.map((stop, index) => ({ fromId: index ? stops[index - 1].placeId : 'origin', toId: stop.placeId, mode: 'walk' as const, min: 5 })), { fromId: stops.at(-1)!.placeId, toId: 'destination', mode: 'walk' as const, min: 5 }],
  stayMin: stops.reduce((total, stop) => total + stop.stayMin, 0), travelMin: 5 * (stops.length + 1), totalMin: 70, arrivalBufferMin: 10, remainingAfterCourseMin: 0, remainingAfterArrivalBufferMin: 0,
});

test('URELEASEONESTOP01: 체류 분은 숨기고 short만 숫자 없는 상태로 표시한다', () => {
  assert.equal(courseV1StopDwellLabel(30, 'recommended'), '장소 둘러보기');
  assert.equal(courseV1StopDwellLabel(20, 'short'), '가볍게 둘러보기');
  assert.equal(courseV1StopDwellLabel(undefined, 'short'), '가볍게 둘러보기');
  const mixed = course([
    { placeId: 'recommended', stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: iso, departureAt: iso },
    { placeId: 'short', stayMin: 20, stayState: 'short', availabilityState: 'structured_verified', arrivalAt: iso, departureAt: iso },
  ]);
  assert.equal(courseV1CourseDwellStatus(mixed.stops), '가볍게 둘러보기');
  assert.deepEqual(buildCourseV1JourneySegments(mixed)?.filter((segment) => segment.kind === 'stop').map((segment) => segment.kind === 'stop' ? [segment.min, segment.stayState] : null), [[30, 'recommended'], [20, 'short']]);
});

test('URELEASEONESTOP01: snapshot 체류값은 내부 model에 보존하되 사용자 label에 수치화하지 않는다', () => {
  assert.equal(courseV1StopDwellLabel(120, 'recommended'), '장소 둘러보기');
  assert.equal(courseV1CourseDwellStatus([{ stayState: 'recommended' }]), null);
});
