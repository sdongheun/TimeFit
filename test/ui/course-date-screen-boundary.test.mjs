import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
import { reselectLegacy } from './support/reselectLegacy.mjs';
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const require = createRequire(import.meta.url);
const { buildExecutionSchedule } = require('../../src/ui/execution/schedule.ts');

for (const remainingMin of [120, 180]) for (const scenario of ['create', 'replace', 'missing', 'invalid', 'conflict', 'unavailable', 'expired', 'opening_expired', 'save_late', 'repeat']) test(`UCOURSEDATE ${remainingMin}/${scenario}: actual screen → repository`, async () => {
  const origin = { lat: 35.1, lon: 129.1 };
  const spot = { contentId: 'fixture-place', title: 'fixture-place', category: '문화시설', lat: 35.11, lon: 129.11, operatingHours: ['fixture'] };
  const course = { spots: [spot], legs: [{ label: '이동', min: 5 }, { label: '체류 가능', min: 20 }, { label: '복귀', min: 5 }], totalMin: 30 };
  const ctx = { startedAtIso: '2026-12-31T23:50:00+09:00', startMin: 1430, remainingMin, mode: 'walk', modeLabel: '도보', appointment: null };
  const originalEnd = new Date(Date.parse(ctx.startedAtIso) + remainingMin * 60000).toISOString();
  let nowMs = Date.parse(ctx.startedAtIso) + 15 * 60000;
  class Clock extends Date { constructor(...a) { super(...(a.length ? a : [nowMs])); } static now() { return nowMs; } }
  if (['replace', 'unavailable', 'expired', 'opening_expired', 'save_late', 'repeat'].includes(scenario)) ctx.endsAtIso = originalEnd;
  if (scenario === 'missing') delete ctx.startedAtIso;
  if (scenario === 'invalid') ctx.startedAtIso = '';
  if (scenario === 'conflict') ctx.courseDateIssue = 'conflict';
  const editingCourseId = ['replace', 'unavailable', 'expired', 'opening_expired', 'save_late', 'repeat'].includes(scenario) ? 'stored' : undefined;
  const navigations = [], saves = [], rpc = [], alerts = [], planned = [];
  let activations = 0;
  const supabase = { auth: { async getUser() { return { data: { user: { id: 'fixture-owner' } } }; } }, from() { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: scenario === 'unavailable' ? null : { starts_at: ctx.startedAtIso, ends_at: originalEnd, recommendation_snapshot: { ctx } } }; } }; return q; }, async rpc(name, args) { rpc.push({ name, args }); if (scenario === 'save_late') nowMs = Date.parse(originalEnd); return { data: [{ id: 'stored', created_at: '2027-01-01T00:05:00+09:00' }] }; } };
  const repository = screenRuntime({ __Date: Clock, './supabase': { supabase } }).load('src/services/courseRepository.ts');
  const flow = { activeCourse: null, savedCourses: [{ id: 'stored', title: 'saved fixture', origin, course, ctx }], async refreshSavedCourses() {}, async saveCourse(p) { saves.push('save'); return repository.saveCourseToRepository(p); }, async replaceCourse(id, p) { saves.push('replace'); return repository.replaceCoursePlanInRepository(id, p); }, setActiveCourse() { activations++; } };
  const item = { spot, status: 'recommended', mode: 'walk', approachMin: 5, onwardMin: 5, availableStayMin: 20, minimumStayMin: 10, recommendedStayMin: 20 };
  const items = [item];
  const host = screenRuntime({
    './PlacePicker': { PlacePicker: 'PlacePicker' }, './MapPlacePicker': { MapPlacePicker: 'MapPlacePicker' },
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ resolve() { throw Error('unexpected'); } }) },
    __Date: Clock,
    'expo-location': { async requestForegroundPermissionsAsync() { return { status: 'granted' }; }, async getCurrentPositionAsync() { return { coords: { latitude: origin.lat, longitude: origin.lon } }; } },
    '../engine/travel': { async precompute() {}, async precomputeTransit() {} },
    '../services/courseNotifications': { async scheduleCourseNotifications() { return {}; }, async cancelCourseNotifications() {} },
    './execution/CourseProgress': { CourseProgress: 'CourseProgress' },
    './execution/schedule': { buildExecutionSchedule, currentMinuteOfDay: () => new Clock().getHours() * 60 + new Clock().getMinutes() },
    './KakaoRouteMap': { KakaoRouteMap: 'KakaoRouteMap', buildRouteMapSegments: () => [] },
    './mainTabNavigation': {},
    '../services/courseRepository': repository,
    './AppFlowContext': { useAppFlow: () => flow }, './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' }, '@expo/vector-icons': { Feather: 'Feather' },
    './PlacePhoto': { PlacePhoto: 'PlacePhoto', PlacePhotoCredit: 'PlacePhotoCredit' }, './currentPlacePhoto': { currentPlacePhoto: () => null },
    '../engine': { travelGeo: () => [], timeContext: () => ({ dayType: '평일', hourBucket: '야간' }), async planTimeFit(input) { planned.push(input); return { spatialCandidates: [spot] }; }, travelMin: () => 5, validateCourseOpening: async () => { if (scenario === 'opening_expired') nowMs = Date.parse(originalEnd); return { ok: true }; }, createOneStopRouteService: () => ({ get: async () => ({ modes: { walk: { exact: true }, transit: { exact: false } } }) }) },
    './recommendation/oneStop': { buildOneStopRecommendations: () => items }, './recommendation/basketPlanner': { buildBasketCourse: () => course },
    './recommendation/oneStopSearchScope': { DEFAULT_ONE_STOP_SEARCH_RADIUS_M: 3000, ONE_STOP_SEARCH_STEPS_M: [3000], filterOneStopCandidatesByRadius: () => [spot] },
    './recommendation/TimeJourney': { TimeJourney: 'TimeJourney' },
    './recommendation/courseV1PlacePreviewModel': { openKakaoPlaceWithAppFallback: async () => { throw Error('must not open'); } },
    '@react-native-community/slider': { __esModule: true, default: 'Slider' },
  });
  host.native.Alert.alert = (...args) => alerts.push(args);
  const navigation = { navigate: (...args) => navigations.push(args), replace: (...args) => navigations.push(args), goBack() {} };
  const list = host.mount(host.load('src/ui/MyCoursesScreen.tsx').MyCoursesScreen, { navigation });
  list.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('saved fixture'))[0].props.onPress();
  assert.deepEqual(navigations[0][1].ctx, ctx);
  list.unmount();
  if (scenario === 'repeat') {
    let params = await repository.saveCourseToRepository({ course, origin, ctx });
    assert.equal(params.ctx.endsAtIso, originalEnd); rpc.length = 0;
    for (let i = 0; i < 2; i++) {
      const execution = host.mount(host.load('src/ui/ExecutionScreen.tsx').ExecutionScreen, { navigation, route: { params } });
      await reselectLegacy(execution, origin);
      const before = navigations.length;
      execution.nodes(n => n.type === 'CourseProgress')[0].props.onChangeCourse(); await settle();
      assert.equal(navigations.length, before); assert.equal(planned.length, 0);
      assert.equal(alerts.at(-1)[0], '장소를 직접 선택해 주세요');
      // GPS replan entry is retired. Keep date/repository regression with an explicitly injected result.
      const change = { result: { spatialCandidates: [spot] }, origin, editingCourseId: 'stored', ctx: { ...params.ctx, remainingMin: remainingMin - (i + 1) * 15 } };
      assert.equal(change.ctx.remainingMin, remainingMin - (i + 1) * 15);
      assert.equal(change.ctx.endsAtIso, originalEnd);
      assert.equal(change.ctx.startedAtIso, '2026-12-31T14:50:00.000Z');
      execution.unmount();
      const result = host.mount(host.load('src/ui/OneStopResultsScreen.tsx').OneStopResultsScreen, { navigation, route: { params: change } }); await settle();
      result.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('fixture-place'))[0].props.onPress(); await settle();
      result.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('이곳 선택하기'))[0].props.onPress();
      result.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('길찾기 시작'))[0].props.onPress(); await settle();
      assert.equal(navigations.at(-1)[0], 'Execution'); params = navigations.at(-1)[1];
      assert.equal(params.ctx.endsAtIso, originalEnd); result.unmount(); nowMs += 15 * 60000;
    }
    assert.deepEqual(saves, ['replace', 'replace']); assert.equal(planned.length, 0);
    assert.deepEqual(rpc.map(c => c.name), ['replace_course_plan', 'replace_course_plan']);
    assert.ok(rpc.every(c => !('p_ends_at' in c.args) && c.args.p_recommendation_snapshot.ctx.endsAtIso === originalEnd));
    nowMs = Date.parse(originalEnd);
    const expiredExecution = host.mount(host.load('src/ui/ExecutionScreen.tsx').ExecutionScreen, { navigation, route: { params } });
    const before = navigations.length;
    await reselectLegacy(expiredExecution, origin);
    assert.ok(expiredExecution.get('restore-error'));
    assert.equal(expiredExecution.nodes(n => n.type === 'CourseProgress').length, 0);
    assert.equal(planned.length, 0); assert.equal(navigations.length, before); assert.equal(rpc.length, 2);
    expiredExecution.unmount(); return;
  }
  const screen = host.mount(host.load('src/ui/OneStopResultsScreen.tsx').OneStopResultsScreen, { navigation, route: { params: { result: { spatialCandidates: [spot] }, origin, ctx: navigations[0][1].ctx, editingCourseId } } });
  await settle();
  screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('fixture-place'))[0].props.onPress(); await settle();
  screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('이곳 선택하기'))[0].props.onPress();
  if (scenario === 'expired') nowMs = Date.parse(originalEnd);
  screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('길찾기 시작'))[0].props.onPress(); await settle();
  if (['expired', 'opening_expired', 'save_late'].includes(scenario)) {
    assert.deepEqual(saves, scenario === 'save_late' ? ['replace'] : []); assert.equal(rpc.length, scenario === 'save_late' ? 1 : 0); assert.equal(activations, 0); assert.equal(navigations.length, 1); assert.equal(alerts.length, 1); screen.unmount(); return;
  }
  assert.deepEqual(saves, [editingCourseId ? 'replace' : 'save']);
  if (['create', 'replace', 'repeat'].includes(scenario)) {
    assert.equal(activations, 1); assert.equal(rpc.length, 1);
    assert.equal(rpc[0].name, editingCourseId ? 'replace_course_plan' : 'create_course_plan');
    assert.equal(navigations.at(-1)[1].ctx.startedAtIso, '2026-12-31T14:50:00.000Z');
    if (editingCourseId) assert.equal('p_ends_at' in rpc[0].args, false);
    else assert.equal(rpc[0].args.p_ends_at, new Date(Date.parse(ctx.startedAtIso) + remainingMin * 60000).toISOString());
  } else {
    assert.equal(activations, 0); assert.equal(rpc.length, 0); assert.equal(navigations.length, 1);
    assert.equal(flow.savedCourses.length, 1);
    assert.equal(alerts.length, 1);
    const reset = alerts[0][2].find(b => b.text === '시간 다시 설정');
    reset.onPress(); assert.equal(navigations.at(-1)[0], 'TimeSetup');
  }
  screen.unmount();
});
