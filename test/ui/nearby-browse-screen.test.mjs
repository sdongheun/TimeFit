import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const catalog = { matched: { data: [
  { contentId: 'near', title: '가까운 곳', lat: 35.0001, lon: 129, classification: 'representative_core', category: '문화시설', addr1: '부산 중구 가까운길', operatingHours: ['10:00~18:00'], imageUrl: 'https://example.com/near.jpg', detailDescription: '검증된 설명' },
  { contentId: 'far', title: '먼 곳', lat: 35.001, lon: 129, classification: 'conditional_more', category: '시장', addr1: '부산 중구 먼길', operatingHours: [] },
] }, unmatched: { data: [] } };

function fixture(options = {}) {
  const calls = [];
  let gpsResolve;
  let pendingAnimation;
  let pendingStop;
  let activeAnimation;
  const animationFinishes = [];
  const animatedValues = [];
  const animationEvents = [];
  const host = screenRuntime();
  class Value {
    constructor(value) { this.value = value; this.setCount = 0; animatedValues.push(this); }
    advanceTo(value) { this.value = value; }
    setValue(value) {
      if (activeAnimation?.value === this) {
        const cancelled = activeAnimation;
        activeAnimation = undefined;
        animationEvents.push({ type: 'cancel', at: this.value, target: cancelled.target });
        cancelled.callback?.({ finished: false });
      }
      this.value = value;
      this.setCount += 1;
    }
    stopAnimation(callback) {
      if (activeAnimation?.value === this) {
        const cancelled = activeAnimation;
        activeAnimation = undefined;
        animationEvents.push({ type: 'cancel', at: this.value, target: cancelled.target });
        cancelled.callback?.({ finished: false });
      }
      const finish = () => callback?.(this.value);
      if (options.manualStopAnimation) pendingStop = finish;
      else finish();
    }
  }
  const FlatList = props => ({ type: 'FlatList', props: { ...props, children: props.data.map((item, index) => props.renderItem({ item, index })) } });
  const dimensions = options.dimensions ?? { width: 390, height: 844, fontScale: 1 };
  const native = { ...host.native, ActivityIndicator: 'ActivityIndicator', FlatList, Image: 'Image', Linking: { async canOpenURL() { calls.push('can-open'); return false; }, async openURL() { calls.push('open'); } }, PanResponder: { create: handlers => ({ panHandlers: handlers }) }, Animated: { Value, View: 'AnimatedView', spring(value, config) { return { start(callback) { if (activeAnimation) { const cancelled = activeAnimation; activeAnimation = undefined; animationEvents.push({ type: 'cancel', at: cancelled.value.value, target: cancelled.target }); cancelled.callback?.({ finished: false }); } const animation = { value, target: config.toValue, callback }; activeAnimation = animation; animationEvents.push({ type: 'start', at: value.value, target: config.toValue }); const finish = () => { if (activeAnimation !== animation) return; activeAnimation = undefined; value.advanceTo(config.toValue); animationEvents.push({ type: 'finish', at: value.value, target: config.toValue }); callback?.({ finished: true }); }; if (options.manualAnimation) { pendingAnimation = finish; animationFinishes.push(finish); } else finish(); } }; } }, useWindowDimensions: () => dimensions };
  const overrides = {
    'react-native': native,
    '@expo/vector-icons': { Feather: 'Feather' },
    '../data/busan_poi_catalog.json': catalog,
    './NearbyBrowseMap': { NearbyBrowseMap: 'NearbyBrowseMap' },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './PlacePicker': { PlacePicker: 'PlacePicker' },
    './MapPlacePicker': { MapPlacePicker: 'MapPlacePicker' },
    './AnimatedPressable': { AnimatedPressable: 'Pressable' },
    './mainTabNavigation': { resetToMain() { calls.push('main'); }, resetToActivityRecord() { calls.push('record'); }, resetToProfile() { calls.push('profile'); } },
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ async resolve() { return { source: 'address', address: '부산광역시 중구 기준로 1' }; } }) },
    './locationSearchDraft': { createLocationSearchDraft: () => ({ start() {}, end() {}, resume() {} }) },
    './recommendation/courseV1PlacePreviewModel': { async openKakaoPlaceWithAppFallback() { calls.push('kakao'); return 'failed'; } },
    'expo-web-browser': { async openBrowserAsync() { calls.push('browser'); } },
    'expo-location': {
      Accuracy: { Balanced: 1 },
      async getForegroundPermissionsAsync() { calls.push('permission-read'); return { status: options.permission ?? 'granted' }; },
      async requestForegroundPermissionsAsync() { calls.push('permission-request'); return { status: options.permission ?? 'granted' }; },
      async getCurrentPositionAsync() { calls.push('gps'); if (options.pendingGps) return new Promise(resolve => { gpsResolve = resolve; }); return { coords: { latitude: 35, longitude: 129 } }; },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => options.insets ?? ({ top: 47, bottom: 34, left: 0, right: 0 }) },
  };
  const runtime = screenRuntime(overrides);
  const navigation = { addListener() { return () => {}; } };
  const screen = runtime.mount(runtime.load('src/ui/NearbyBrowseScreen.tsx').NearbyBrowseScreen, { navigation });
  return { screen, calls, animatedValues, animationEvents, finishAnimation() { pendingAnimation?.(); pendingAnimation = undefined; }, finishAnimationAt(index) { animationFinishes[index]?.(); }, finishStopAnimation() { pendingStop?.(); pendingStop = undefined; }, resolveGps(value = { coords: { latitude: 35.2, longitude: 129.2 } }) { gpsResolve(value); } };
}

test('UNEAR production screen uses one dataset for map/list and marker/list open the same detail without side effects', async () => {
  const f = fixture(); await tick();
  const map = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0];
  assert.deepEqual(map.props.places.map(place => place.id), ['near', 'far']);
  map.props.onError(); assert.ok(f.screen.get('nearby-map-retry')); assert.ok(f.screen.get('nearby-row-near'));
  f.screen.press('nearby-map-retry');
  assert.ok(f.screen.get('nearby-row-near'));
  map.props.onSelect('far');
  assert.match(JSON.stringify(f.screen.render()), /먼 곳/);
  assert.match(JSON.stringify(f.screen.render()), /정보 탐색 장소/);
  f.screen.get('nearby-detail-image-fallback');
  f.screen.press('nearby-detail-close');
  assert.equal(f.screen.get('nearby-row-far').props.style.flat(Infinity).filter(Boolean).at(-1).borderColor, '#0066ff');
  assert.equal(f.calls.filter(call => ['recommendation', 'route', 'save', 'dwell'].includes(call)).length, 0);
});

test('UNEAR denied entry does not prompt; explicit current does, map failure keeps empty/list recovery', async () => {
  const f = fixture({ permission: 'denied' }); await tick();
  assert.equal(f.calls.filter(call => call === 'permission-request').length, 0);
  f.screen.press('nearby-current'); await tick();
  assert.equal(f.calls.filter(call => call === 'permission-request').length, 1);
  assert.ok(f.screen.get('nearby-empty-location'));
});

test('UNEAR manual reference invalidates late GPS and labels selection honestly', async () => {
  const f = fixture({ pendingGps: true }); await tick();
  f.screen.press('nearby-change-location');
  const picker = f.screen.nodes(node => node.type === 'PlacePicker')[0];
  picker.props.onConfirm({ lat: 35, lon: 129, label: '부산역', source: 'provider' });
  f.resolveGps(); await tick();
  const location = f.screen.nodes(node => node.type === 'Text' && Array.isArray(node.props.children) && node.props.children.includes('부산역'))[0];
  assert.deepEqual(location.props.children, ['선택 위치 기준 · ', '부산역']);
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /현위치 기준/);
});

test('UNEAR same-coordinate cluster opens accessible group and returns to all rows', async () => {
  const f = fixture(); await tick();
  const map = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0];
  map.props.onCluster(['near', 'far']);
  assert.match(JSON.stringify(f.screen.render()), /겹친 장소 2곳/);
  assert.ok(f.screen.get('nearby-row-near')); assert.ok(f.screen.get('nearby-row-far'));
  f.screen.press('nearby-show-all');
  assert.match(JSON.stringify(f.screen.render()), /3km 안 장소 2곳/);
});

test('UNEAR production screen connects the sheet to every bottom edge and measures the unchanged floating tab frame', async () => {
  const f = fixture(); await tick();
  const sheet = f.screen.get('nearby-sheet');
  const style = sheet.props.style.flat(Infinity).filter(Boolean);
  assert.equal(style.at(-1).bottom, 0);
  assert.equal(style.at(-1).left, 0);
  assert.equal(style.at(-1).right, 0);
  assert.equal(style.at(-1).transform, undefined);

  const tab = f.screen.nodes(node => node.type === 'FloatingTabBar')[0];
  tab.props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const list = f.screen.get('nearby-list');
  const contentStyle = list.props.contentContainerStyle.flat(Infinity).filter(Boolean);
  assert.equal(contentStyle.at(-1).paddingBottom, 844 - 744 + 12);
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, f.screen.get('nearby-sheet').props.style.flat(Infinity).at(-1).height.value);
});

test('UNEAR expanded list and detail keep terminal touch targets above the measured tab without changing tab actions', async () => {
  const f = fixture(); await tick();
  const tab = f.screen.nodes(node => node.type === 'FloatingTabBar')[0];
  tab.props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.press('nearby-sheet-toggle');
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, f.screen.get('nearby-sheet').props.style.flat(Infinity).at(-1).height.value);

  f.screen.press('nearby-row-near');
  const detail = f.screen.nodes(node => node.type === 'ScrollView')[0];
  const detailStyle = detail.props.contentContainerStyle.flat(Infinity).filter(Boolean);
  const bottomPadding = detailStyle.at(-1).paddingBottom;
  assert.ok(844 - bottomPadding <= 744 - 12);
  f.screen.press('nearby-open-kakao'); await tick();
  tab.props.onMain(); tab.props.onRecord(); tab.props.onProfile();
  assert.deepEqual(f.calls.filter(call => ['main', 'record', 'profile'].includes(call)), ['main', 'record', 'profile']);
});

test('UNEAR FloatingTabBar relays its native parent-coordinate frame without changing its layout or handlers', () => {
  const calls = [];
  const frames = [];
  const runtime = screenRuntime({
    '@expo/vector-icons': { Feather: 'Feather' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) },
  });
  const screen = runtime.mount(runtime.load('src/ui/FloatingTabBar.tsx').FloatingTabBar, {
    active: 'course',
    onMain: () => calls.push('main'),
    onCourse: () => calls.push('course'),
    onRecord: () => calls.push('record'),
    onProfile: () => calls.push('profile'),
    onFrame: frame => frames.push(frame),
  });
  const wrapper = screen.nodes(node => node.type === 'View' && node.props.pointerEvents === 'box-none')[0];
  assert.equal(wrapper.props.style.flat(Infinity).at(-1).bottom, 34);
  const frame = { x: 16, y: 744, width: 358, height: 66 };
  wrapper.props.onLayout({ nativeEvent: { layout: frame } });
  assert.deepEqual(frames, [frame]);
  screen.nodes(node => node.type === 'Pressable').forEach(node => node.props.onPress());
  assert.deepEqual(calls, ['main', 'course', 'record', 'profile']);
});

test('UNEAR handle drag changes only visible sheet height per frame and settles map obstruction once released', async () => {
  const f = fixture(); await tick();
  const tab = f.screen.nodes(node => node.type === 'FloatingTabBar')[0];
  tab.props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const before = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset;
  const handle = f.screen.get('nearby-sheet-handle');
  assert.equal(handle.props.onMoveShouldSetPanResponder(null, { dy: 4 }), false);
  assert.equal(handle.props.onMoveShouldSetPanResponder(null, { dy: -8 }), true);
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -100 });
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, before);
  handle.props.onPanResponderRelease(null, { dy: -100, vy: -0.5 });
  assert.ok(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset > before);
});

test('UNEAR opening does not cancel the pending spring or refit the map before animation settles', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  const tab = f.screen.nodes(node => node.type === 'FloatingTabBar')[0];
  tab.props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const value = f.animatedValues[0];
  const setCountBeforeOpen = value.setCount;
  const mapInsetBeforeOpen = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset;

  f.screen.press('nearby-sheet-toggle');
  f.screen.render();
  assert.equal(value.setCount, setCountBeforeOpen, 'state synchronization must not overwrite an in-flight spring');
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, mapInsetBeforeOpen, 'map viewport work waits for settled sheet geometry');

  f.finishAnimation();
  assert.ok(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset > mapInsetBeforeOpen);
});

test('UNEAR drag regression: a re-grab during spring continues from current 318 to 326', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.press('nearby-sheet-toggle');
  f.screen.render();
  const value = f.animatedValues[0];
  value.advanceTo(318);
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -8 });
  assert.equal(value.value, 326);
  assert.deepEqual(f.animationEvents.slice(-1), [{ type: 'cancel', at: 318, target: 610 }]);
});

test('UNEAR drag regression: changed measurement preserves an in-range drag and stable responder', async () => {
  const f = fixture(); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const value = f.animatedValues[0];
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -100 });
  assert.equal(value.value, 377);

  const summary = f.screen.get('nearby-list-summary');
  const moveBeforeMeasurement = handle.props.onPanResponderMove;
  summary.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 80 } } });
  f.screen.render();
  assert.equal(value.value, 377, 'changed geometry must preserve the current in-range drag height');
  assert.equal(f.screen.get('nearby-sheet-handle').props.onPanResponderMove, moveBeforeMeasurement, 'active responder remains stable across endpoint changes');

  value.setValue(377);
  const setCountBeforeRepeat = value.setCount;
  f.screen.get('nearby-list-summary').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 80 } } });
  f.screen.render();
  assert.equal(value.value, 377);
  assert.equal(value.setCount, setCountBeforeRepeat, 'same measurement does not retrigger state or geometry synchronization');
});

test('UNEAR drag regression: cumulative moves reverse correctly and termination settles once', async () => {
  const f = fixture(); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const value = f.animatedValues[0];
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -20 });
  assert.equal(value.value, 297);
  handle.props.onPanResponderMove(null, { dy: -40 });
  assert.equal(value.value, 317);
  handle.props.onPanResponderMove(null, { dy: -10 });
  assert.equal(value.value, 287);
  handle.props.onPanResponderTerminate(null, { dy: -10, vy: 0 });
  assert.equal(value.value, 277, 'a native responder cancellation settles the transient height to the nearest endpoint');
});

test('UNEAR diagnostic fake distinguishes cancellation, completion, and stale completion', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const collapsedInset = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset;
  f.screen.press('nearby-sheet-toggle');
  f.screen.render();
  f.animatedValues[0].advanceTo(318);
  f.screen.press('nearby-sheet-toggle');
  f.screen.render();
  assert.deepEqual(f.animationEvents.slice(-2), [
    { type: 'cancel', at: 318, target: 610 },
    { type: 'start', at: 318, target: 277 },
  ]);
  f.finishAnimationAt(0);
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, collapsedInset, 'stale expand completion has no effect');
  f.finishAnimationAt(1);
  assert.deepEqual(f.animationEvents.at(-1), { type: 'finish', at: 277, target: 277 });
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, collapsedInset);
});

test('UNEAR drag regression: release before asynchronous grant baseline settles safely after callback', async () => {
  const f = fixture({ manualStopAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -100, vy: -0.5 });
  handle.props.onPanResponderRelease(null, { dy: -100, vy: -0.5 });
  assert.equal(f.animatedValues[0].value, 277);
  f.finishStopAnimation();
  assert.equal(f.animatedValues[0].value, 610);
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, 610);
});

test('UNEAR drag regression: range clamp rebases cumulative dy before the next move', async () => {
  const f = fixture(); await tick();
  const tab = f.screen.nodes(node => node.type === 'FloatingTabBar')[0];
  tab.props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -100, vy: 0 });
  assert.equal(f.animatedValues[0].value, 377);
  tab.props.onFrame({ x: 16, y: 500, width: 358, height: 66 });
  f.screen.render();
  assert.equal(f.animatedValues[0].value, 521);
  f.screen.get('nearby-sheet-handle').props.onPanResponderMove(null, { dy: -110, vy: 0 });
  assert.equal(f.animatedValues[0].value, 531);
});

test('UNEAR drag regression: expanded downward swipe settles collapsed and unmount blocks pending completion', async () => {
  const f = fixture(); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.press('nearby-sheet-toggle');
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: 100, vy: 0.5 });
  assert.equal(f.animatedValues[0].value, 510);
  handle.props.onPanResponderRelease(null, { dy: 100, vy: 0.5 });
  assert.equal(f.animatedValues[0].value, 277);

  const pending = fixture({ manualAnimation: true }); await tick();
  pending.screen.press('nearby-sheet-toggle');
  pending.screen.unmount();
  assert.doesNotThrow(() => pending.finishAnimation());
  assert.equal(pending.calls.filter(call => ['main', 'record', 'profile', 'kakao'].includes(call)).length, 0);
});

test('UNEAR drag regression: a re-grab during collapsing spring continues downward from its current height', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.press('nearby-sheet-toggle');
  f.finishAnimationAt(0);
  assert.equal(f.animatedValues[0].value, 610);
  f.screen.press('nearby-sheet-toggle');
  f.screen.render();
  f.animatedValues[0].advanceTo(500);
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: 8, vy: 0 });
  assert.equal(f.animatedValues[0].value, 492);
  assert.deepEqual(f.animationEvents.at(-1), { type: 'cancel', at: 500, target: 277 });
});

test('UNEAR drag regression: grant immediately followed by release waits for baseline and settles nearest endpoint once', async () => {
  const f = fixture({ manualStopAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderRelease(null, { dy: 0, vy: 0 });
  assert.equal(f.animationEvents.filter(event => event.type === 'start').length, 0);
  f.finishStopAnimation();
  assert.equal(f.animatedValues[0].value, 277);
  assert.equal(f.animationEvents.filter(event => event.type === 'start' && event.target === 277).length, 1);
});
