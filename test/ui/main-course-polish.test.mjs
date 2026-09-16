import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

test('UMAIN A: home prioritizes recommendation and shows resume only for an active course', () => {
  const calls = [];
  const host = screenRuntime({
    '@expo/vector-icons': { Feather: 'Feather' },
    './AuthContext': { useAuth: () => ({ authKind: 'account' }) },
    './AppFlowContext': { useAppFlow: () => ({}) },
    './activeVerifiedCourseModel': { homeActiveCourseProjection: () => ({ kind: 'verified', accessibilityLabel: '이어가기', title: 'fixture', target: 'CourseConfirm', params: { activeId: 'fixture-run' } }) },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './mainTabNavigation': { resetToActivityRecord() {}, resetToNearbyBrowse() {}, resetToProfile() {} },
    '../data/busan_poi_catalog.json': { matched: { data: [] }, unmatched: { data: [] } },
  });
  const screen = host.mount(host.load('src/ui/HomeScreen.tsx').HomeScreen, { navigation: { navigate: (...args) => calls.push(args) } });
  const text = JSON.stringify(screen.render());
  assert.doesNotMatch(text, /TIMEFIT|정해볼까요/);
  assert.match(text, /약속 전 남는 시간,/);
  assert.match(text, /어디 들러볼까요\?/);
  assert.match(text, /시간과 출발지를 정하면.*약속 전에 들를 코스를 찾아드려요/s);
  assert.doesNotMatch(text, /home-profile-entry|자투리 시간 설정하기|진행 중인 코스가 생기면/);
  assert.match(text, /코스 추천받기/);
  assert.match(text, /진행 중.*fixture.*중단한 단계부터 계속할 수 있어요.*이어서 하기/s);
  screen.nodes(n => n.props.accessibilityLabel === '이어가기')[0].props.onPress();
  screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('코스 추천받기'))[0].props.onPress();
  assert.deepEqual(calls, [['CourseConfirm', { activeId: 'fixture-run' }], ['TimeSetup']]);
  screen.unmount();
});

test('UMAIN empty: no active course omits the instructional placeholder card', () => {
  const host = screenRuntime({
    './AppFlowContext': { useAppFlow: () => ({ activeVerifiedCourse: null }) },
    './activeVerifiedCourseModel': { homeActiveCourseProjection: () => ({ kind: 'placeholder' }) },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './mainTabNavigation': { resetToActivityRecord() {}, resetToNearbyBrowse() {}, resetToProfile() {} },
    '../data/busan_poi_catalog.json': { matched: { data: [] }, unmatched: { data: [] } },
  });
  const screen = host.mount(host.load('src/ui/HomeScreen.tsx').HomeScreen, { navigation: { navigate() {} } });
  const text = JSON.stringify(screen.render());
  assert.match(text, /코스 추천받기/);
  assert.doesNotMatch(text, /진행 중|이어가기|진행 중인 코스가 생기면/);
  screen.unmount();
});

test('UMAIN B: native current pulse starts only after preference and stops on Reduce Motion/current change', async () => {
  let preference, loops = 0, stops = 0;
  const calls = [];
  const host = screenRuntime();
  host.native.AccessibilityInfo = { isReduceMotionEnabled: async () => false, addEventListener(_name, listener) { preference = listener; return { remove() { calls.push('remove'); } }; } };
  host.native.Animated = { ...host.native.Animated, timing(_value, config) { calls.push(config); return {}; }, sequence: () => ({}), loop: () => ({ start() { loops++; }, stop() { stops++; } }) };
  const props = { status: 'current' };
  const screen = host.mount(host.load('src/ui/recommendation/CourseStepIndicator.tsx').CourseStepIndicator, props);
  assert.equal(loops, 0);
  await Promise.resolve(); screen.render(); assert.equal(loops, 1);
  assert.ok(calls.filter(v => typeof v === 'object').every(v => v.useNativeDriver && v.duration === 1000));
  preference(true); screen.render(); assert.equal(stops, 1);
  assert.equal(screen.get('course-indicator-current').props.style.at(-1).opacity, 1);
  props.status = 'future'; screen.render(); assert.equal(loops, 1);
  props.status = 'complete'; screen.render(); assert.match(JSON.stringify(screen.render()), /✓/);
  screen.unmount(); assert.ok(calls.includes('remove'));
});
