import assert from "node:assert/strict";
import test from "node:test";
import type { Course, LatLon, Mode } from "../../src/engine";
import type { PlanCtx } from "../../src/ui/nav";
import {
  buildExecutionSchedule,
  kakaoRouteUrl,
} from "../../src/ui/execution/schedule";

const origin: LatLon = { lat: 35.15, lon: 129.05 };
const spot = { ...origin, lat: 35.16, lon: 129.06, contentId: "spot-1", title: "테스트 장소" };
const ctx: PlanCtx = {
  startMin: 12 * 60,
  remainingMin: 120,
  mode: "walk",
  modeLabel: "도보",
  appointment: { lat: 35.17, lon: 129.07, label: "약속 장소" },
};

const course = {
  spots: [spot],
  legs: [
    { label: "출발 → 테스트 장소", min: 12, mode: "walk" as Mode },
    { label: "체류 가능 · 테스트 장소", min: 35 },
    { label: "다음 스케줄로", min: 18, mode: "transit" as Mode },
  ],
} as Course;

test("진행 일정은 이동·체류 구간을 누적해 마지막 약속 출발 알림을 만든다", () => {
  const schedule = buildExecutionSchedule({ course, ctx, origin });

  assert.deepEqual(
    schedule.stops.map((stop) => [stop.name, stop.arriveMin, stop.leaveMin]),
    [
      ["출발", 720, 720],
      ["테스트 장소", 732, 767],
      ["약속 · 약속 장소", 785, 785],
    ],
  );
  assert.deepEqual(schedule.alerts, [{ min: 767, msg: "약속 장소(으)로 출발하세요" }]);
});

test("카카오 길찾기 링크는 구간 이동수단을 카카오 형식으로 변환한다", () => {
  assert.match(kakaoRouteUrl(spot, "walk"), /by=foot/);
  assert.match(kakaoRouteUrl(spot, "transit"), /by=publictransit/);
  assert.match(kakaoRouteUrl(spot, "car"), /by=car/);
});
