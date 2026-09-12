import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
const { buildBasketCourse } = require('../../src/ui/recommendation/basketPlanner.ts');
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

for (const editing of [false, true]) for (const scenario of ['exact', 'missing', 'lost_before_save']) {
  test(`ODSAY UI ${editing ? 'replace' : 'save'}/${scenario}: actual screen and builder`, async t => {
    const requests = [], keyReads = [];
    t.mock.method(globalThis, 'fetch', async url => { requests.push(String(url)); throw Error('network forbidden'); });
    const env = new Proxy({ EXPO_PUBLIC_ODSAY_API_KEY: 'fixture', ODSAY_API_KEY: 'fixture' }, {
      get(target, key) { if (String(key).includes('ODSAY')) keyReads.push(key); return target[key]; },
    });
    const origin = { lat: 35.1578, lon: 129.0594 }, target = { lat: 35.1796, lon: 129.0756 };
    const spot = { contentId: 'fixture-place', title: 'fixture-place', category: '문화시설', lat: 35.1601, lon: 129.0602, dwell: 40, dwellSrc: 'fixture', operatingHours: ['fixture'] };
    const ctx = { startedAtIso: '2026-09-09T12:00:00+09:00', endsAtIso: '2026-09-09T15:00:00+09:00', startMin: 720, remainingMin: 180, arrivalBufferMin: 10, appointment: target };
    class Clock extends Date { static now() { return Date.parse(ctx.startedAtIso); } }
    const saves = [], active = [], nav = [], alerts = [], reads = [];
    const flow = { async saveCourse(p) { saves.push(['save', p]); return p; }, async replaceCourse(id, p) { saves.push(['replace', p]); return p; }, setActiveCourse(p) { active.push(p); } };
    const item = { spot, mode: 'walk', status: 'recommended', approachMin: 8, onwardMin: 8, availableStayMin: 154, minimumStayMin: 20, recommendedStayMin: 40 };
    const items = [item];
    const host = screenRuntime({
      __Date: Clock, __process: { env },
      './AppFlowContext': { useAppFlow: () => flow },
      '../services/courseRepository': { isCourseDateError: () => false },
      '../engine': { travelMin: () => 8, validateCourseOpening: async () => ({ ok: true }), createOneStopRouteService: () => ({ get: async () => ({ modes: { walk: { exact: scenario !== 'missing' }, transit: { exact: false } } }) }) },
      './recommendation/basketPlanner': { buildBasketCourse: (...args) => buildBasketCourse(...args.slice(0, 5), { ...args[5], read: (from, to, mode) => {
        reads.push(mode);
        return scenario === 'lost_before_save' && to.lon === target.lon ? { min: Infinity, src: 'transit_fallback' } : { min: 8, src: 'TMAP', geo: [from, to] };
      } }) },
      './recommendation/oneStop': { buildOneStopRecommendations: () => items },
      './recommendation/oneStopSearchScope': { DEFAULT_ONE_STOP_SEARCH_RADIUS_M: 3000, ONE_STOP_SEARCH_STEPS_M: [3000], filterOneStopCandidatesByRadius: () => [spot] },
      './recommendation/TimeJourney': { TimeJourney: 'TimeJourney' }, './KakaoRouteMap': { KakaoRouteMap: 'KakaoRouteMap' },
      './PlacePhoto': { PlacePhoto: 'PlacePhoto', PlacePhotoCredit: 'PlacePhotoCredit' }, './currentPlacePhoto': { currentPlacePhoto: () => null },
      './recommendation/courseV1PlacePreviewModel': { openKakaoPlaceWithAppFallback: () => { throw Error('unexpected route'); } },
      '@react-native-community/slider': { __esModule: true, default: 'Slider' },
    });
    host.native.Alert.alert = (...a) => alerts.push(a);
    const screen = host.mount(host.load('src/ui/OneStopResultsScreen.tsx').OneStopResultsScreen, { route: { params: { result: { spatialCandidates: [spot] }, origin, ctx, editingCourseId: editing ? 'old' : undefined } }, navigation: { replace: (...a) => nav.push(a), navigate() {}, goBack() {} } });
    const press = text => screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes(text))[0].props.onPress();
    await settle();
    if (scenario !== 'missing') {
      press('fixture-place'); await settle(); press('이곳 선택하기'); press('길찾기 시작'); await settle();
    }
    if (scenario === 'exact') {
      assert.equal(saves.length, 1); assert.equal(saves[0][0], editing ? 'replace' : 'save');
      assert.deepEqual(reads, ['walk', 'walk']);
      assert.ok(saves[0][1].course.legs.filter(l => l.mode).every(l => l.src === 'TMAP' && Number.isFinite(l.min) && l.geo.length === 2));
      assert.equal(active.length, 1); assert.equal(nav[0][0], 'Execution');
    } else {
      assert.equal(saves.length, 0); assert.equal(active.length, 0); assert.equal(nav.length, 0);
      if (scenario === 'missing') assert.ok(screen.nodes(n => n.type === 'Text' && String(n.props.children).includes('실제 경로를 확인하지 못했습니다')).length > 0);
      else { assert.equal(alerts[0][0], '실제 경로를 확인하지 못했어요'); assert.ok(alerts[0][2].some(b => b.text === '다시 확인')); }
    }
    assert.deepEqual(requests, []);
    assert.deepEqual(keyReads, []);
    assert.ok(saves.every(([, p]) => p.course.legs.every(l => l.src !== 'ODsay')));
    screen.unmount();
  });
}
