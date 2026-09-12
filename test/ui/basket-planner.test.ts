import assert from "node:assert/strict";
import test from "node:test";
import type { LatLon, Spot } from "../../src/engine";
import type { PlanCtx } from "../../src/ui/nav";
import {
  buildBasketCourse,
  optimizeBasketSpotOrder,
} from "../../src/ui/recommendation/basketPlanner";

const origin: LatLon = { lat: 35.1578, lon: 129.0594 };
const appointment = { lat: 35.1796, lon: 129.0756 };
const exactRoutes = { finalMode: 'walk' as const, read: (from: LatLon, to: LatLon) => ({ min: 8, src: 'TMAP', geo: [from, to] }) };

const ctx: PlanCtx = {
  startMin: 12 * 60,
  mode: "walk",
  modeLabel: "이동수단 비교",
  appointment: { ...appointment, label: "약속 장소" },
  remainingMin: 180,
};

function spot(contentId: string, title: string, lat: number, lon: number): Spot {
  return {
    contentId,
    title,
    typeId: "12",
    category: "문화시설",
    lat,
    lon,
    dwell: 40,
    dwellBase: 40,
    dwellSrc: "test",
    mult: 1,
    openNote: "test",
    confidence: "direct_match",
    strategy: "origin_area",
  };
}

test("장바구니 코스는 선택한 도착 구간 수단을 보존하고 마지막 약속 구간을 포함한다", () => {
  const first = spot("first", "첫 장소", 35.1601, 129.0602);
  const second = spot("second", "두 번째 장소", 35.1688, 129.0668);
  const course = buildBasketCourse(
    [first, second],
    origin,
    appointment,
    ctx,
    { first: "walk", second: "car" },
    exactRoutes,
  );

  const travelLegs = course.legs.filter((leg) => leg.mode);
  assert.equal(course.type, "미니코스");
  assert.deepEqual(course.spots.map(({ contentId }) => contentId), ["first", "second"]);
  assert.equal(travelLegs.length, 3);
  assert.equal(travelLegs[0]?.mode, "walk");
  assert.equal(travelLegs[1]?.mode, "car");
  assert.match(travelLegs[2]?.label ?? "", /다음 스케줄로/);
});

test("장바구니 코스는 이동·체류 합계가 안전 여유를 제외한 입력 시간 안에 머문다", () => {
  const course = buildBasketCourse(
    [spot("one", "장소 1", 35.1601, 129.0602)],
    origin,
    appointment,
    ctx,
    {},
    exactRoutes,
  );

  assert.ok(course.totalMin <= ctx.remainingMin);
  assert.ok(course.bufferLeftMin >= 0);
  assert.ok(course.legs.some((leg) => leg.label.startsWith("체류 가능")));
});

test('실경로 없는 코스는 성공 Course를 반환하지 않는다', () => {
  assert.throws(() => buildBasketCourse([spot('one', '장소 1', 35.1601, 129.0602)], origin, appointment, ctx), /basket_route_unavailable/);
});

test('유한 근사 시간도 성공으로 승격하지 않고 마지막 누락 구간을 거절한다', () => {
  for (const missing of [{ min: Infinity, src: 'transit_fallback' }, { min: 8, src: 'haversine' }]) {
    assert.throws(() => buildBasketCourse([spot('one', '장소 1', 35.1601, 129.0602)], origin, appointment, ctx, {}, {
      read: (from, to) => to === appointment ? missing : exactRoutes.read(from, to),
    }), /basket_route_unavailable/);
  }
});

test("자동 정렬은 장소를 삭제하거나 중복하지 않고 입력 장소만 재배열한다", () => {
  const spots = [
    spot("far", "먼 장소", 35.181, 129.078),
    spot("near", "가까운 장소", 35.159, 129.060),
    spot("middle", "중간 장소", 35.168, 129.067),
  ];
  const ordered = optimizeBasketSpotOrder(spots, origin, appointment);

  assert.equal(ordered.length, spots.length);
  assert.deepEqual(
    [...ordered.map((item) => item.contentId)].sort(),
    [...spots.map((item) => item.contentId)].sort(),
  );
});
