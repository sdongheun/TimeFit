import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { createRequire } from 'node:module';
import { screenRuntime } from './support/screenRuntime.mjs';
import { reselectLegacy } from './support/reselectLegacy.mjs';
const require = createRequire(import.meta.url);
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

for (const missingGeometry of [false, true]) test(`QA ODsay historical Execution geometry missing=${missingGeometry}: real travel, read-only and explicit change`, async t => {
  const http = [], keyReads = [], writes = [], saves = [], active = [], alerts = [], hydrated = [];
  t.mock.method(globalThis, 'fetch', async url => { http.push(String(url)); throw Error('network forbidden'); });
  const env = new Proxy({ EXPO_PUBLIC_ODSAY_API_KEY: 'fixture', ODSAY_API_KEY: 'fixture' }, {
    get(target, key) { if (String(key).includes('ODSAY')) keyReads.push(key); return target[key]; },
  });
  const storage = { async getItem() { return null; }, async setItem(...v) { writes.push(v); } };
  const engineHost = screenRuntime({ __process: { env },
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    './routeBaselineService': { createRouteBaselineService: () => ({}) },
    '../services/placeNameSemanticMatch': {},
  });
  const travel = engineHost.load('src/engine/travel.ts');
  const origin = { lat: 35.1, lon: 129.1 }, spot = { title: '과거 장소', lat: 35.2, lon: 129.2 };
  const params = { courseId: 'old-fixture', origin,
    ctx: { mode: 'transit', startMin: 600, remainingMin: 180, startedAtIso: '2026-12-31T10:00:00+09:00', endsAtIso: '2026-12-31T13:00:00+09:00' },
    course: { spots: [spot], totalMin: 70, bufferLeftMin: 100, legs: [
      { label: '이동', mode: 'transit', min: 20, src: 'ODsay', ...(missingGeometry ? {} : { geo: [origin, spot] }) },
      { label: '체류', min: 30 },
      { label: '복귀', mode: 'transit', min: 20, src: 'ODsay', ...(missingGeometry ? {} : { geo: [spot, origin] }) },
    ] },
  };
  const original = JSON.stringify(params);
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-12-31T10:10:00+09:00'])); } static now() { return new Clock().getTime(); } }
  const host = screenRuntime({ __Date: Clock, __process: { env },
    './PlacePicker': { PlacePicker: 'PlacePicker' }, './MapPlacePicker': { MapPlacePicker: 'MapPlacePicker' },
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ resolve() { assert.fail('no search'); } }) },
    './AppFlowContext': { useAppFlow: () => ({ setActiveCourse: p => active.push(p), saveCourse: p => saves.push(p), replaceCourse: p => saves.push(p) }) },
    '../engine/travel': travel, '../engine': { travelGeo: travel.travelGeo, timeContext: () => ({}) },
    '../services/courseNotifications': { async scheduleCourseNotifications() { return {}; }, async cancelCourseNotifications() {} },
    './execution/schedule': { ...require('../../src/ui/execution/schedule.ts'), currentMinuteOfDay: () => 610 },
    './execution/CourseProgress': { CourseProgress: 'CourseProgress' },
    './KakaoRouteMap': { KakaoRouteMap: 'KakaoRouteMap', buildRouteMapSegments: (_points, legs) => { hydrated.push(legs); return []; } },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' }, './mainTabNavigation': {},
  });
  host.native.Alert.alert = (...v) => alerts.push(v);
  const screen = host.mount(host.load('src/ui/ExecutionScreen.tsx').ExecutionScreen, { navigation: { goBack() {} }, route: { params } });
  try {
    await reselectLegacy(screen, origin); await settle();
    const progress = screen.nodes(n => n.type === 'CourseProgress')[0];
    assert.ok(progress);
    assert.equal(progress.props.stops[1].arriveMin - progress.props.stops[0].leaveMin, 20);
    const displayed = hydrated.at(-1);
    assert.equal(displayed.length, 2);
    assert.ok(displayed.every(l => l.src === 'ODsay' && l.min === 20));
    assert.equal(displayed.every(l => missingGeometry ? l.geo === undefined : l.geo.length === 2), true);
    progress.props.onChangeCourse(); await settle();
    assert.equal(alerts.at(-1)[0], '장소를 직접 선택해 주세요');
    assert.match(alerts.at(-1)[1], /코스는 그대로 유지/);
    assert.equal(JSON.stringify(params), original);
    assert.ok(active.every(p => p === params), 'existing active snapshot only, no replacement');
    assert.deepEqual(saves, []); assert.deepEqual(writes, []);
    assert.deepEqual(keyReads, []); assert.deepEqual(http, []);
  } finally { screen.unmount(); }
});
