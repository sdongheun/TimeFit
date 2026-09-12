import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { createRequire } from 'node:module';
import { screenRuntime } from './support/screenRuntime.mjs';
import { reselectLegacy } from './support/reselectLegacy.mjs';
const require = createRequire(import.meta.url);
test('EXIT03 actual Execution catches never log synthetic credential/coordinate/response errors', async t => {
  const logs = [], alerts = [];
  let routeResult = 'browser_fallback_cancelled';
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  t.mock.method(globalThis, 'fetch', () => { assert.fail('network forbidden'); });
  const error = new Error('synthetic-private token=fixture lat=35.1 url=https://fixture.invalid/?secret=fixture body=private');
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-12-31T10:10:00+09:00'])); } static now() { return new Clock().getTime(); } }
  const host = screenRuntime({ __Date: Clock,
    './PlacePicker': { PlacePicker: 'PlacePicker' }, './MapPlacePicker': { MapPlacePicker: 'MapPlacePicker' },
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ resolve() { throw Error('unexpected'); } }) },
    './AppFlowContext': { useAppFlow: () => ({ setActiveCourse() {} }) },
    '../engine/travel': { async precompute() { throw error; }, async precomputeTransit() { throw error; } },
    '../engine': { travelGeo: () => [], timeContext: () => ({ dayType: '평일', hourBucket: '주간' }) },
    'expo-location': { async requestForegroundPermissionsAsync() { return { status: 'granted' }; }, async getCurrentPositionAsync() { throw error; } },
    '../services/courseNotifications': { async scheduleCourseNotifications() { throw error; }, async cancelCourseNotifications() {} },
    './execution/schedule': { buildExecutionSchedule: require('../../src/ui/execution/schedule.ts').buildExecutionSchedule, currentMinuteOfDay: () => 610, isKakaoRouteOpenSuccess: require('../../src/ui/execution/schedule.ts').isKakaoRouteOpenSuccess, async openKakaoRouteWithFallback() { return routeResult; } },
    './execution/CourseProgress': { CourseProgress: 'CourseProgress' },
    './KakaoRouteMap': { KakaoRouteMap: 'KakaoRouteMap', buildRouteMapSegments: () => [] }, './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' }, './mainTabNavigation': {},
  });
  host.native.Alert.alert = (...args) => alerts.push(args);
  const screen = host.mount(host.load('src/ui/ExecutionScreen.tsx').ExecutionScreen, { navigation: {}, route: { params: {
    courseId: 'fixture-course', origin: { lat: 35.1, lon: 129.1 }, ctx: { startMin: 600, remainingMin: 120, mode: 'walk', startedAtIso: '2026-12-31T10:00:00+09:00', endsAtIso: '2026-12-31T03:00:00.000Z' },
    course: { spots: [{ title: 'fixture', lat: 35.11, lon: 129.11 }], legs: [{ label: '이동', min: 5 }, { label: '체류', min: 20 }, { label: '복귀', min: 5 }], bufferLeftMin: 10, totalMin: 30 },
  } } });
  try {
    await reselectLegacy(screen, { lat: 35.1, lon: 129.1 });
    for (let i = 0; i < 20; i++) await Promise.resolve();
    screen.nodes(n => n.type === 'CourseProgress')[0].props.onChangeCourse();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    assert.deepEqual(logs.map(args => args[0]).sort(), ['execution_hydration_failed', 'execution_notifications_failed']);
    assert.ok(logs.every(args => args.length === 1));
    assert.doesNotMatch(JSON.stringify([logs, alerts]), /synthetic-private|token=|lat=|secret=|body=/);
    assert.equal(alerts.at(-1)[0], '장소를 직접 선택해 주세요');
    const openRoute = screen.nodes(n => n.type === 'CourseProgress')[0].props.onPrimaryAction;
    const before = alerts.length;
    await openRoute();
    assert.equal(alerts.length, before, 'web cancellation must not produce a route failure alert');
    assert.equal(screen.nodes(n => n.type === 'CourseProgress')[0].props.step, 0, 'cancellation does not advance route state');
    assert.equal(screen.nodes(n => n.type === 'CourseProgress')[0].props.ctaLabel, '도착 완료 (다음 단계)');
    assert.ok(screen.get('execution-route-reopen'));
    routeResult = 'failed'; await openRoute();
    assert.equal(alerts.length, before + 1);
    assert.equal(alerts.at(-1)[0], '카카오맵을 열 수 없어요');
  } finally { screen.unmount(); }
});
