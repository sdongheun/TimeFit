import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import type { RecommendationSession } from '../../src/ui/nav';
import {
  buildCourseV1CardSummary,
  buildCourseV1DetailMarkers,
  buildCourseV1DetailModel,
  hasValidCourseV1DisplaySnapshot,
} from '../../src/ui/recommendation/courseV1CardDetailModel';
import { getPlacePreviewKind } from '../../src/ui/recommendation/courseV1PlacePreviewModel';

const session = (destination: RecommendationSession['destination']): RecommendationSession => ({
  nowIso: '2026-09-02T01:00:00.000Z',
  origin: { id: 'origin', label: '사상역', lat: 35.162, lon: 128.984 },
  destination,
  remainingMin: 80,
  arrivalBufferMin: 10,
});
const places = {
  A: { title: '부산근현대역사관', lat: 35.102, lon: 129.031, category: '문화시설', shortStay: { type: 'compact_culture' }, imageUrl: 'https://example.com/a.jpg' },
  B: { title: '책방 골목', lat: 35.101, lon: 129.029, category: '상업지구', shortStay: { type: 'quick_browse' }, imageUrl: null },
  C: { title: '해변 산책로', lat: 35.159, lon: 129.16, category: '자연관광지', shortStay: { type: 'scenic_pause' }, imageUrl: 'broken' },
  D: { title: '잠깐 쉼터', lat: 35.16, lon: 129.15, category: '카페', shortStay: { type: 'quick_rest' } },
} as const;

function course(placeId = 'A', stayMin = 30, stayState: 'recommended' | 'short' = 'recommended'): VerifiedCourseV1 {
  return {
    id: `course-${placeId}`,
    placeIds: [placeId],
    legs: [
      { fromId: 'origin', toId: placeId, mode: 'walk', min: 9 },
      { fromId: placeId, toId: 'destination', mode: 'transit', min: 13 },
    ],
    stops: [{ placeId, stayMin, stayState, availabilityState: 'structured_verified', arrivalAt: '2026-09-02T01:09:00.000Z', departureAt: '2026-09-02T01:39:00.000Z' }],
    travelMin: 22,
    stayMin,
    arrivalBufferMin: 10,
    totalMin: 22 + stayMin + 10,
    remainingAfterCourseMin: 18,
    remainingAfterArrivalBufferMin: 18,
  };
}
const getPlace = (id: string) => places[id as keyof typeof places];

test('UCOURSECARDDETAIL01: 대표·대안 요약은 원본 identity와 사진·활동·이동+체류 합계만 만든다', () => {
  const courses = ['A', 'B', 'C', 'D'].map((id) => course(id));
  const summaries = courses.map((item, index) => buildCourseV1CardSummary(item, index ? `다른 추천 ${index}` : '대표 추천', getPlace));
  assert.equal(summaries.every(Boolean), true);
  assert.deepEqual(summaries.map((item) => item?.course), courses);
  assert.deepEqual(summaries.map((item) => [item?.place.title, item?.activityLabel, item?.courseMin]), [
    ['부산근현대역사관', '문화 공간 관람', 52], ['책방 골목', '둘러보기', 52], ['해변 산책로', '풍경 감상', 52], ['잠깐 쉼터', '잠깐 쉬기', 52],
  ]);
});

test('UCOURSECARDDETAIL01: 상세는 52분 코스·두 실제 leg·체류 30분·도착 여유 10분을 분리한다', () => {
  const detail = buildCourseV1DetailModel(course(), session({ id: 'destination', label: '부산역', lat: 35.115, lon: 129.041 }), getPlace);
  assert.ok(detail);
  assert.equal(detail.courseMin, 52);
  assert.deepEqual(detail.legs.map(({ mode, min }) => [mode, min]), [['walk', 9], ['transit', 13]]);
  assert.equal(detail.stops[0].stayLabel, '둘러보기 약 30분');
  assert.equal(detail.arrivalBufferMin, 10);
  assert.equal(detail.destinationLabel, '부산역');
});

test('UCOURSECARDDETAIL01: short는 카드에서 상태만, 상세에서 선택 체류 분을 정확히 표시한다', () => {
  const shortCourse = course('A', 20, 'short');
  const summary = buildCourseV1CardSummary(shortCourse, '대표 추천', getPlace);
  const detail = buildCourseV1DetailModel(shortCourse, session(null), getPlace);
  assert.equal(summary?.courseMin, 42);
  assert.equal(summary?.short, true);
  assert.match(summary?.accessibilityLabel ?? '', /가볍게 둘러보기/);
  assert.equal(detail?.stops[0].stayLabel, '가볍게 둘러보기 약 20분');
});

test('UCOURSECARDDETAIL01: 사진 없음과 로드 실패는 모두 활동 카테고리 placeholder로 닫힌다', () => {
  assert.deepEqual(getPlacePreviewKind(places.B, false), { kind: 'placeholder' });
  assert.deepEqual(getPlacePreviewKind(places.A, true), { kind: 'placeholder' });
  assert.deepEqual(getPlacePreviewKind(places.C, false), { kind: 'placeholder' });
});

test('UCOURSECARDDETAIL01: 왕복은 출발·복귀 한 핀이고 별도 목적지는 순서 끝에 남는다', () => {
  const returnSession = session(null);
  const returnDetail = buildCourseV1DetailModel(course(), returnSession, getPlace)!;
  const returnMarkers = buildCourseV1DetailMarkers(returnDetail, returnSession)!;
  assert.equal(returnDetail.destinationLabel, '출발지로 복귀');
  assert.equal(returnMarkers.length, 2);
  assert.equal(returnMarkers[0].label, '출발·복귀');

  const destinationSession = session({ id: 'destination', label: '부산역', lat: 35.115, lon: 129.041 });
  const destinationDetail = buildCourseV1DetailModel(course(), destinationSession, getPlace)!;
  assert.deepEqual(buildCourseV1DetailMarkers(destinationDetail, destinationSession)?.map(({ label }) => label), ['사상역', '부산근현대역사관', '부산역']);
});

test('UCOURSECARDDETAIL01: 손상 snapshot은 부분 표시나 합계 보정 없이 모두 거부한다', () => {
  const valid = course();
  const corruptions: VerifiedCourseV1[] = [
    { ...valid, legs: valid.legs.slice(0, 1) },
    { ...valid, stops: [{ ...valid.stops[0], placeId: 'wrong' }] },
    { ...valid, travelMin: 23 },
    { ...valid, stayMin: 29 },
    { ...valid, totalMin: 61 },
    { ...valid, arrivalBufferMin: -1 },
    { ...valid, legs: [{ ...valid.legs[0], min: 9.5 }, valid.legs[1]] },
  ];
  for (const corrupted of corruptions) {
    assert.equal(hasValidCourseV1DisplaySnapshot(corrupted), false);
    assert.equal(buildCourseV1CardSummary(corrupted, '대표 추천', getPlace), null);
    assert.equal(buildCourseV1DetailModel(corrupted, session(null), getPlace), null);
  }
});

test('UCOURSECARDDETAIL01: 결과 카드와 상세는 전용 표시 경계만 쓰며 새 route 호출을 만들지 않는다', () => {
  const card = fs.readFileSync('src/ui/recommendation/CourseV1SummaryCard.tsx', 'utf8');
  const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf8');
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  assert.equal((card.match(/<Pressable/g) ?? []).length, 1);
  assert.doesNotMatch(card, /CourseV1Journey|카카오맵|arrivalBuffer|remaining|sourceLabel|추천 확인/);
  assert.match(results, /<CourseV1SummaryCard summary=\{summary\} onPress=\{onConfirm\}/);
  assert.match(confirm, /line=\{\[\]\}/);
  assert.match(confirm, /segments=\{routeGeometry\.segments\}/);
  assert.match(confirm, /showRouteLegend=\{false\}/);
  assert.match(confirm, /<CourseV1VerticalDetail/);
  assert.match(confirm, /testID="verified-course-start"/);
  assert.doesNotMatch(`${card}\n${confirm}`, /runRecommendationSession|requestConditionalManualCourse|RouteProxy|fetch\(/);
});
