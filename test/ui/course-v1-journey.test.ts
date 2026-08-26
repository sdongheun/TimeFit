import assert from 'node:assert/strict';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import { buildCourseV1JourneySegments } from '../../src/ui/recommendation/courseV1JourneyModel';

const iso = (minute: number) => new Date(Date.UTC(2026, 7, 24, 1, minute)).toISOString();
function course(ids: string[]): VerifiedCourseV1 {
  const stops = ids.map((placeId, index) => ({ placeId, stayMin: 20 + index * 5, availabilityState: 'structured_verified' as const, arrivalAt: iso(index * 30 + 5), departureAt: iso(index * 30 + 25 + index * 5) }));
  const legs = [...ids.map((id, index) => ({ fromId: index ? ids[index - 1] : 'origin', toId: id, mode: index % 2 ? 'transit' as const : 'walk' as const, min: 5 + index })), { fromId: ids.at(-1)!, toId: 'destination', mode: 'walk' as const, min: 8 }];
  const stayMin = stops.reduce((sum, stop) => sum + stop.stayMin, 0);
  const travelMin = legs.reduce((sum, leg) => sum + leg.min, 0);
  return { id: ids.join('|'), placeIds: ids, stops, legs, stayMin, travelMin, totalMin: stayMin + travelMin + 10, arrivalBufferMin: 10, remainingAfterCourseMin: 12, remainingAfterArrivalBufferMin: 12 };
}

for (const count of [1, 2, 3]) test(`${count}곳 코스는 이동·해당 장소 체류·다음 이동 순서로 표시 모델을 만든다`, () => {
  const item = course(['a', 'b', 'c'].slice(0, count));
  const segments = buildCourseV1JourneySegments(item);
  assert.ok(segments);
  assert.deepEqual(segments.map((segment) => segment.kind), Array.from({ length: count }, () => ['leg', 'stop']).flat().concat(['leg', 'buffer', 'remaining']));
  assert.deepEqual(segments.filter((segment) => segment.kind === 'stop').map((segment) => segment.kind === 'stop' ? segment.placeId : ''), item.placeIds);
});

test('stops·legs 계약이 다르면 시간 여정을 추정하거나 보정하지 않는다', () => {
  const item = course(['a', 'b']);
  assert.equal(buildCourseV1JourneySegments({ ...item, legs: item.legs.slice(0, -1) }), null);
  assert.equal(buildCourseV1JourneySegments({ ...item, stops: [{ ...item.stops[0], placeId: 'wrong' }, item.stops[1]] }), null);
});

test.skip('철회 이력: 순차 새 추천은 다음 검증 코스로 대표를 교체했다', () => {});
