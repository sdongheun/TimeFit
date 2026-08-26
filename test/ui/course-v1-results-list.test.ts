import assert from 'node:assert/strict';
import test from 'node:test';
import type { CourseV1LimitedResult, VerifiedCourseV1 } from '../../src/engine';
import { buildCourseV1AlternativeList, buildCourseV1ResultListItem, selectedCourseForConfirm } from '../../src/ui/recommendation/courseV1ResultListModel';

const iso = (minute: number) => new Date(Date.UTC(2026, 7, 24, 1, minute)).toISOString();
function course(ids: string[], remainingAfterCourseMin: number): VerifiedCourseV1 {
  const stops = ids.map((placeId, index) => ({ placeId, stayMin: 20 + index * 5, availabilityState: 'structured_verified' as const, arrivalAt: iso(index * 30 + 5), departureAt: iso(index * 30 + 25 + index * 5) }));
  const legs = [...ids.map((id, index) => ({ fromId: index ? ids[index - 1] : 'origin', toId: id, mode: 'walk' as const, min: 5 })), { fromId: ids.at(-1)!, toId: 'destination', mode: 'walk' as const, min: 8 }];
  const stayMin = stops.reduce((total, stop) => total + stop.stayMin, 0);
  const travelMin = legs.reduce((total, leg) => total + leg.min, 0);
  return { id: ids.join('|'), placeIds: ids, stops, legs, stayMin, travelMin, totalMin: stayMin + travelMin + 10, arrivalBufferMin: 10, remainingAfterCourseMin, remainingAfterArrivalBufferMin: remainingAfterCourseMin };
}
function result(representativeCourse: VerifiedCourseV1, alternativeCourses: VerifiedCourseV1[]): CourseV1LimitedResult {
  return { representativeCourse, alternativeCourses, resultState: 'verified', alternativeState: alternativeCourses.length ? 'alternatives_available' : 'no_alternative_verified_course', diagnostics: { providerCandidateCount: 0, preselectionCandidateCount: 0, candidatePoolCount: 0, generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0, routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0 } };
}
const places = (id: string) => ({ title: `장소 ${id}`, addr1: '부산광역시 부산진구 중앙대로', shortStay: { type: 'quick_browse' } });

test('대표 1곳과 비중첩 대안 2·3곳을 같은 스냅샷으로 비교 표시한다', () => {
  const first = course(['a'], 35);
  const alternatives = [course(['b', 'c'], 20), course(['d', 'e', 'f'], 5)];
  const shown = buildCourseV1AlternativeList(result(first, alternatives), places);
  assert.deepEqual(shown.map((item) => [item.course.placeIds.length, item.remainingAfterCourseMin]), [[2, 20], [3, 5]]);
  assert.equal(buildCourseV1ResultListItem(first, places).context, '부산진구 · 둘러보기');
});

test('2곳 대표와 3곳 대안, 3곳 fallback 대표, 대안 없음도 숨기거나 오류로 다루지 않는다', () => {
  const representativeTwo = course(['a', 'b'], 18);
  assert.deepEqual(buildCourseV1AlternativeList(result(representativeTwo, [course(['c', 'd', 'e'], 7)]), places).map((item) => item.course.placeIds.length), [3]);
  const fallbackThree = course(['f', 'g', 'h'], 11);
  assert.equal(buildCourseV1ResultListItem(fallbackThree, places).course.placeIds.length, 3);
  assert.deepEqual(buildCourseV1AlternativeList(result(fallbackThree, []), places), []);
});

test('넓은 한 곳 대표·대안도 장소 수나 시간값을 추정하지 않고 원본 스냅샷으로 표시한다', () => {
  const wideOne = course(['가로로 아주 긴 장소명도 그대로 보이는 대표 장소'], 41);
  const alternative = course(['대안 장소'], 17);
  const representative = buildCourseV1ResultListItem(wideOne, places);
  const alternatives = buildCourseV1AlternativeList(result(wideOne, [alternative]), places);
  assert.deepEqual(representative.placeNames, ['장소 가로로 아주 긴 장소명도 그대로 보이는 대표 장소']);
  assert.equal(representative.totalMin, wideOne.totalMin);
  assert.equal(representative.remainingAfterCourseMin, 41);
  assert.equal(alternatives[0].course, alternative);
  assert.equal(alternatives[0].remainingAfterCourseMin, 17);
});

test('목록 표시와 선택은 엔진·어댑터를 호출하지 않고 선택한 원본 legs/stops/remaining을 유지한다', () => {
  const selected = course(['a', 'b'], 29);
  let engineOrAdapterCalls = 0;
  const getPlace = (id: string) => { engineOrAdapterCalls += 0; return places(id); };
  const item = buildCourseV1AlternativeList(result(course(['x'], 8), [selected]), getPlace)[0];
  const confirm = selectedCourseForConfirm(item);
  assert.equal(engineOrAdapterCalls, 0);
  assert.equal(confirm, selected);
  assert.equal(confirm.legs, selected.legs);
  assert.equal(confirm.stops, selected.stops);
  assert.equal(confirm.remainingAfterCourseMin, 29);
});

test('VoiceOver용 대안 요약은 장소·실제 총 소요·남는 시간만 사용한다', () => {
  const item = buildCourseV1ResultListItem(course(['긴 이름의 장소'], 23), places);
  assert.deepEqual([item.placeNames, item.totalMin, item.remainingAfterCourseMin], [['장소 긴 이름의 장소'], 43, 23]);
});
