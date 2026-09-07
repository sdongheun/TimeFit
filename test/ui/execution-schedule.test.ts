import assert from "node:assert/strict";
import test from "node:test";
import type { Course, LatLon, Mode } from "../../src/engine";
import type { PlanCtx } from "../../src/ui/nav";
import {
  buildExecutionSchedule,
  kakaoRouteUrl,
  kakaoWebFallback,
  openKakaoRouteWithFallback,
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

test("DECKAKAOROUTE01: 카카오 길찾기 app·web 링크는 출발·도착과 수단을 모두 보존한다", () => {
  const stage = { from: { name: '출발', point: origin }, to: { name: '도착', point: spot } };
  assert.match(kakaoRouteUrl(origin, spot, "walk"), /sp=35\.15,129\.05&ep=35\.16,129\.06&by=foot/);
  assert.match(kakaoRouteUrl(origin, spot, "transit"), /by=publictransit/);
  assert.match(kakaoRouteUrl(origin, spot, "car"), /by=car/);
  assert.match(kakaoWebFallback(stage, 'walk'), /link\/by\/walk\/.*\/.*$/);
  assert.match(kakaoWebFallback(stage, 'transit'), /link\/by\/traffic\//);
  assert.match(kakaoWebFallback(stage, 'car'), /link\/by\/car\//);
  assert.doesNotMatch(kakaoWebFallback(stage, 'walk'), /link\/to/);
});

test("DECKAKAOROUTE01: 카카오 길찾기는 app→HTTPS→browser를 각 한 번만 시도한다", async () => {
  const schedule = buildExecutionSchedule({ course, ctx, origin });
  const departure = schedule.stops[0];
  const destination = schedule.stops[1];
  const stage = { from: { name: departure.name, point: departure.point }, to: { name: destination.name, point: destination.point } };
  const opened: string[] = [];
  const installed = await openKakaoRouteWithFallback(stage, "walk", {
    canOpenApp: async () => true,
    openApp: async (url) => { opened.push(url); },
    openWeb: async (url) => { opened.push(url); },
    openBrowser: async (url) => { opened.push(url); },
  });
  assert.equal(installed, "app_opened");
  assert.match(opened[0], /^kakaomap:\/\/route\?sp=35\.15,129\.05&ep=35\.16,129\.06/);

  opened.length = 0;
  const uninstalled = await openKakaoRouteWithFallback(stage, "walk", {
    canOpenApp: async () => false,
    openApp: async (url) => { opened.push(url); },
    openWeb: async (url) => { opened.push(url); },
    openBrowser: async (url) => { opened.push(url); },
  });
  assert.equal(uninstalled, "web_opened");
  assert.match(opened[0], /^https:\/\/map\.kakao\.com\/link\/by\/walk\//);

  const fallbackAttempts: string[] = [];
  let emitBrowserState: ((state: string) => void) | null = null;
  let dismissBrowser: ((value: unknown) => void) | null = null;
  let browserStartedResolve: (() => void) | null = null;
  const browserStarted = new Promise<void>(resolve => { browserStartedResolve = resolve; });
  const browserFallbackPromise = openKakaoRouteWithFallback(stage, "walk", {
    canOpenApp: async () => true,
    openApp: async () => { fallbackAttempts.push('app'); throw new Error("scheme failed"); },
    openWeb: async () => { fallbackAttempts.push('web'); throw new Error("web failed"); },
    openBrowser: () => new Promise(resolve => { fallbackAttempts.push('browser'); dismissBrowser = resolve; browserStartedResolve?.(); }),
    observeAppState: listener => { emitBrowserState = listener; return () => { emitBrowserState = null; }; },
  });
  let activityStarts = 0;
  const activityStart = browserFallbackPromise.then(result => { if (result === 'browser_fallback_opened') activityStarts += 1; });
  await browserStarted;
  assert.deepEqual(fallbackAttempts, ['app', 'web', 'browser']);
  (emitBrowserState as ((state: string) => void) | null)?.('background');
  const browserFallback = await browserFallbackPromise;
  await activityStart;
  assert.equal(browserFallback, 'browser_fallback_opened');
  assert.equal(activityStarts, 1, 'Activity continuation is released before the browser dismissal promise');
  (dismissBrowser as ((value: unknown) => void) | null)?.({ type: 'dismiss' });

  const dismissed = await openKakaoRouteWithFallback(stage, "walk", {
    canOpenApp: async () => false,
    openApp: async () => undefined,
    openWeb: async () => { throw new Error('web failed'); },
    openBrowser: async () => ({ type: 'cancel' }),
    observeAppState: () => () => undefined,
  });
  assert.equal(dismissed, 'browser_fallback_cancelled');
  const allFailed = await openKakaoRouteWithFallback(stage, "walk", {
    canOpenApp: async () => true,
    openApp: async () => { throw new Error("scheme failed"); },
    openWeb: async () => { throw new Error("web failed"); },
    openBrowser: async () => { throw new Error('browser failed'); },
    observeAppState: () => () => undefined,
  });
  assert.equal(allFailed, "failed");
  assert.equal(await openKakaoRouteWithFallback({ ...stage, from: { name: '잘못됨', point: { lat: Number.NaN, lon: 129 } } }, 'walk', { canOpenApp: async () => { throw new Error('must not query'); }, openApp: async () => { throw new Error('must not open'); }, openWeb: async () => { throw new Error('must not open'); }, openBrowser: async () => { throw new Error('must not open'); } }), 'invalid_stage');
});
