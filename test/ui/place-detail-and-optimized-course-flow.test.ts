import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import type { RecommendationSession } from '../../src/ui/nav';
import {
  buildPlaceDetailModel,
  buildPlaceDetailMarkers,
  createPlaceDetailSelectionHandoff,
} from '../../src/ui/placeDetailModel';
import { buildActiveCourseStepRows } from '../../src/ui/courseConfirmActiveModel';
import { buildVerifiedCourseProgressSteps, initialVerifiedCourseProgressState, markVerifiedCourseRouteOpened } from '../../src/ui/recommendation/verifiedCourseProgressModel';

const course: VerifiedCourseV1 = {
  id: 'exact-b-a',
  placeIds: ['B', 'A'],
  stops: [
    { placeId: 'B', stayMin: 20, stayState: 'short', availabilityState: 'structured_verified', arrivalAt: '2026-09-05T06:10:00.000Z', departureAt: '2026-09-05T06:30:00.000Z' },
    { placeId: 'A', stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-05T06:40:00.000Z', departureAt: '2026-09-05T07:10:00.000Z' },
  ],
  legs: [
    { fromId: 'origin', toId: 'B', mode: 'walk', min: 10 },
    { fromId: 'B', toId: 'A', mode: 'transit', min: 10 },
    { fromId: 'A', toId: 'destination', mode: 'walk', min: 10 },
  ],
  stayMin: 50,
  travelMin: 30,
  totalMin: 90,
  arrivalBufferMin: 10,
  remainingAfterCourseMin: 20,
  remainingAfterArrivalBufferMin: 10,
};

const session: RecommendationSession = {
  nowIso: '2026-09-05T06:00:00.000Z',
  origin: { id: 'origin', label: '설정한 출발지', lat: 35.15, lon: 129.05 },
  destination: { id: 'destination', label: '약속 장소', lat: 35.2, lon: 129.1 },
  remainingMin: 100,
  arrivalBufferMin: 10,
  deviceLocationSnapshot: { lat: 35.14, lon: 129.04 },
};

const place = (id: string, overrides: Record<string, unknown> = {}) => ({
  contentId: id,
  title: `장소 ${id}`,
  lat: id === 'A' ? 35.16 : 35.17,
  lon: id === 'A' ? 129.06 : 129.07,
  category: '문화시설',
  subCategory: '전시',
  addr1: '부산광역시 부산진구 중앙대로 1',
  imageUrl: 'https://example.test/place.jpg',
  operatingHours: ['10:00~18:00'],
  detailDescription: '공식 근거가 연결된 설명',
  ...overrides,
});

test('UPLACECOURSEFLOW01 failure-first: 상세 선택 handoff는 명시 선택만 정확히 한 번 소비하고 stale·연타를 닫는다', () => {
  const handoff = createPlaceDetailSelectionHandoff(() => 'request-1');
  const request = handoff.issue({ selectionKind: 'first', courseId: 'one-A', placeId: 'A' });
  assert.equal(handoff.consume(request), null);
  assert.equal(handoff.select({ ...request, requestId: 'stale' }), false);
  assert.equal(handoff.select(request), true);
  assert.equal(handoff.select(request), false);
  assert.deepEqual(handoff.consume(request), request);
  assert.equal(handoff.consume(request), null);
  const cancelled = handoff.issue({ selectionKind: 'pair', courseId: 'exact-b-a', placeId: 'B' });
  handoff.cancel(cancelled);
  assert.equal(handoff.select(cancelled), false);
  assert.equal(handoff.consume(cancelled), null);
});

test('UPLACECOURSEFLOW01: navigation params는 JSON-safe다 (호출 검증은 production screen-runtime fixture)', () => {
  const handoff = createPlaceDetailSelectionHandoff(() => 'json-safe');
  const request = handoff.issue({ selectionKind: 'first', courseId: 'one-A', placeId: 'A' });
  const params = { ...request, session, course: { ...course, id: 'one-A', placeIds: ['A'], stops: [course.stops[1]], legs: [course.legs[0], course.legs[2]] } };
  assert.deepEqual(JSON.parse(JSON.stringify(params)), params);
  handoff.cancel(request);
  assert.equal(handoff.select(request), false);
});

test('UMANUAL: origin/candidate/A marker만 전달하고 과거 device 좌표는 제외한다', () => {
  const markers = buildPlaceDetailMarkers(session, place('B'), place('A'));
  assert.deepEqual(markers.map(({ kind, label }) => ({ kind, label })), [
    { kind: 'origin', label: '설정한 출발지' },
    { kind: 'selected', label: '선택한 장소 · 장소 A' },
    { kind: 'candidate', label: '선택 후보 · 장소 B' },
  ]);
  const same = buildPlaceDetailMarkers({ ...session, deviceLocationSnapshot: { lat: session.origin.lat, lon: session.origin.lon } }, place('B'));
  assert.equal(same.length, 2);
  assert.doesNotMatch(same[0].label, /현재 위치/);
  assert.match(same[0].label, /설정한 출발지/);
  const fallback = buildPlaceDetailMarkers({ ...session, deviceLocationSnapshot: undefined }, place('B'));
  assert.equal(fallback.some((marker) => marker.kind === 'current'), false);
});

test('UPLACECOURSEFLOW01 failure-first: 상세 정보는 원천 값만 쓰고 설명·시간·사진 fallback을 명시한다', () => {
  const full = buildPlaceDetailModel(place('A'), 'first');
  assert.equal(full.description, '공식 근거가 연결된 설명');
  assert.equal(full.operatingHoursLabel, '10:00~18:00');
  assert.equal(full.selectionLabel, '이 장소 선택하기');
  const empty = buildPlaceDetailModel(place('A', { detailDescription: undefined, operatingHours: [], imageUrl: undefined }), 'pair');
  assert.equal(empty.description, '상세 설명 없음');
  assert.equal(empty.operatingHoursLabel, '운영시간 확인 필요');
  assert.equal(empty.image.kind, 'category_fallback');
  assert.equal(empty.selectionLabel, '함께 선택하기');
});

test('UPLACECOURSEFLOW01 failure-first: 엔진 B→A 순서는 active 행에서 재정렬 없이 유지되고 현재 travel만 활성이다', () => {
  const steps = buildVerifiedCourseProgressSteps(course, session.origin, session.destination!, (id) => {
    const item = place(id);
    return { id, label: item.title, lat: item.lat, lon: item.lon };
  });
  assert.ok(steps);
  const initialRows = buildActiveCourseStepRows(steps, initialVerifiedCourseProgressState());
  assert.deepEqual(initialRows.filter((row) => row.kind === 'travel').map((row) => row.actionState), ['current', 'future', 'future']);
  assert.deepEqual(steps.filter((step) => step.kind === 'stay').map((step) => step.target.id), ['B', 'A']);
  const openedRows = buildActiveCourseStepRows(steps, markVerifiedCourseRouteOpened(steps, initialVerifiedCourseProgressState()));
  assert.equal(openedRows[0].actionState, 'current', '외부 앱을 열어도 아직 실제 이동 완료가 아니다');
});

test('UPLACECOURSEFLOW01 failure-first: production은 상세 후 선택과 CourseConfirm 단일 review/active를 연결한다', () => {
  const app = fs.readFileSync('App.tsx', 'utf8');
  const nav = fs.readFileSync('src/ui/nav.ts', 'utf8');
  const results = fs.readFileSync('src/ui/ResultsScreen.tsx', 'utf8');
  const detail = fs.readFileSync('src/ui/PlaceDetailScreen.tsx', 'utf8');
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const home = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf8');
  assert.match(app, /name="PlaceDetail"/);
  assert.doesNotMatch(app, /name="VerifiedCourseProgress"/);
  assert.match(nav, /PlaceDetail:/);
  assert.doesNotMatch(nav, /VerifiedCourseProgress:/);
  assert.match(results, /navigation\.navigate\('PlaceDetail'/);
  assert.match(results, /placeDetailSelectionHandoff\.consume/);
  assert.ok(results.indexOf('placeDetailSelectionHandoff.consume') < results.indexOf('inlineSelection.selectFirst'));
  assert.match(results, /pendingDetailSelectionRef\.current/);
  assert.doesNotMatch(results, /onConfirm=\{\(\) => selectFirstCourse/);
  assert.match(detail, /openKakaoPlaceWithAppFallback/);
  assert.doesNotMatch(detail, /expo-location|requestForegroundPermissions|fetch\(|RouteProxy/);
  assert.match(confirm, /mode === 'active'/);
  assert.match(confirm, /buildActiveCourseStepRows/);
  assert.match(confirm, /courseCompletionRepository\.complete/);
  assert.doesNotMatch(confirm, /navigate\('VerifiedCourseProgress'/);
  assert.match(home, /navigation\.navigate\(active\.target, active\.params\)/);
});
