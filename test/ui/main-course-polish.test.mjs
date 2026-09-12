import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

test('UMAIN A: home has approved copy and preserves profile/setup/resume callbacks', () => {
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
  assert.match(text, /약속 시간에 맞춰 들를 만한 곳을 찾아드려요/);
  screen.press('home-profile-entry');
  screen.nodes(n => n.props.accessibilityLabel === '이어가기')[0].props.onPress();
  screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('자투리 시간 설정하기'))[0].props.onPress();
  assert.deepEqual(calls, [['Profile'], ['CourseConfirm', { activeId: 'fixture-run' }], ['TimeSetup']]);
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
