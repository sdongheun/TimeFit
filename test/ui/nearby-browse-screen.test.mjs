import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
import { approvedPhotoEvidence } from './fixtures/approvedPhoto.mjs';

const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const catalog = { matched: { data: [
  { contentId: 'near', title: '가까운 곳', lat: 35.0001, lon: 129, classification: 'representative_core', category: '문화시설', addr1: '부산 중구 가까운길', operatingHours: ['10:00~18:00'], imageUrl: 'https://example.com/near.jpg', detailDescription: '검증된 설명' },
  { contentId: 'far', title: '먼 곳', lat: 35.001, lon: 129, classification: 'conditional_more', category: '시장', addr1: '부산 중구 먼길', operatingHours: [] },
] }, unmatched: { data: [] } };
catalog.matched.data[0].imageEvidence = approvedPhotoEvidence;

function fixture(options = {}) {
  const calls = [];
  const openedUrls = [];
  const activeCourse = Object.freeze({ courseRunId: 'fixture-active', stepIndex: 2 });
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
  const native = { ...host.native, ActivityIndicator: 'ActivityIndicator', FlatList, Image: 'Image', Linking: { async canOpenURL() { calls.push('can-open'); return false; }, async openURL(url) { calls.push('open'); openedUrls.push(url); return options.openExternal?.(url); } }, PanResponder: { create: handlers => ({ panHandlers: handlers }) }, Animated: { Value, View: 'AnimatedView', spring(value, config) { return { start(callback) { if (activeAnimation) { const cancelled = activeAnimation; activeAnimation = undefined; animationEvents.push({ type: 'cancel', at: cancelled.value.value, target: cancelled.target }); cancelled.callback?.({ finished: false }); } const animation = { value, target: config.toValue, callback }; activeAnimation = animation; animationEvents.push({ type: 'start', at: value.value, target: config.toValue }); const finish = () => { if (activeAnimation !== animation) return; activeAnimation = undefined; value.advanceTo(config.toValue); animationEvents.push({ type: 'finish', at: value.value, target: config.toValue }); callback?.({ finished: true }); }; if (options.manualAnimation) { pendingAnimation = finish; animationFinishes.push(finish); } else finish(); } }; } }, useWindowDimensions: () => dimensions };
  const overrides = {
    'react-native': native,
    '@expo/vector-icons': { Feather: 'Feather' },
    '../data/busan_poi_catalog.json': catalog,
    './AppFlowContext': { useAppFlow: () => ({ activeVerifiedCourse: activeCourse, startActiveVerifiedCourse() { calls.push('course-write'); throw Error('forbidden'); } }) },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: new Proxy({}, { get() { return () => { calls.push('lifecycle'); throw Error('forbidden'); }; } }) },
    './NearbyBrowseMap': { NearbyBrowseMap: 'NearbyBrowseMap' },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './PlacePicker': { PlacePicker: 'PlacePicker' },
    './MapPlacePicker': { MapPlacePicker: 'MapPlacePicker' },
    './AnimatedPressable': { AnimatedPressable: 'Pressable' },
    './mainTabNavigation': { resetToMain() { calls.push('main'); }, resetToActivityRecord() { calls.push('record'); }, resetToProfile() { calls.push('profile'); } },
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ async resolve() { return { source: 'address', address: '부산광역시 중구 기준로 1' }; } }) },
    './locationSearchDraft': { createLocationSearchDraft: () => ({ start() { calls.push('draft-start'); }, end() {}, resume() {} }) },
    './recommendation/courseV1PlacePreviewModel': { async openKakaoPlaceWithAppFallback() { calls.push('kakao'); return 'failed'; } },
    './nearbyLiveSession': { productionNearbyLivePorts: async () => { throw Error('must not load in fixture'); }, createNearbyLiveSessionController: () => ({
      load() { calls.push('live-load'); return Promise.resolve(options.liveResult ?? { status: 'ready', catalog: [...catalog.matched.data, ...catalog.unmatched.data] }); },
      retry() { calls.push('live-retry'); return Promise.resolve(options.liveRetryResult ?? options.liveResult ?? { status: 'ready', catalog: [...catalog.matched.data, ...catalog.unmatched.data] }); },
      cancel() { calls.push('live-cancel'); },
    }) },
    './nearbyGuestAuthGate': { productionNearbyGuestAuthPort: async () => { throw Error('must not authenticate outside fixture'); }, createNearbyGuestAuthGate: () => ({
      prepare() { calls.push('auth-prepare'); return Promise.resolve(options.authPrepare ?? 'ready'); },
      verify() { calls.push('auth-verify'); return Promise.resolve(options.authVerify ?? 'ready'); },
      cancel() { calls.push('auth-cancel'); },
      close() { calls.push('auth-close'); },
    }) },
    './captchaVerificationModel': { resolveCaptchaChallengeUrl: () => options.invalidChallenge ? null : 'https://example.test/challenge' },
    './CaptchaVerificationSheet': { CaptchaVerificationSheet: 'CaptchaVerificationSheet' },
    'expo-web-browser': { async openBrowserAsync(url) { calls.push('browser'); openedUrls.push(url); return options.openBrowser?.(url); } },
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
  if (!options.noCenter && options.permission !== 'denied' && !options.pendingGps) {
    screen.nodes(n => n.type === 'PlacePicker')[0].props.onConfirm({ lat: 35, lon: 129, label: '선택한 장소', source: 'provider' });
    // The real React renderer schedules a render after the picker updates state.
    // This hook-host test runtime is synchronous, so explicitly cross that render
    // boundary before awaiting the live controller promise.
    screen.render();
  }
  return { screen, calls, openedUrls, activeCourse, animatedValues, animationEvents, finishAnimation() { pendingAnimation?.(); pendingAnimation = undefined; }, finishAnimationAt(index) { animationFinishes[index]?.(); }, finishStopAnimation() { pendingStop?.(); pendingStop = undefined; }, resolveGps(value = { coords: { latitude: 35.2, longitude: 129.2 } }) { gpsResolve(value); } };
}

test('UNEAR SIMPLE failure-first: handle tap/accessibility replaces toggle, white action text and standalone destination', async () => {
  const f = fixture(); await tick();
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /기준 위치에서 가까운 순 · 직선거리|nearby-sheet-toggle/);
  let handle = f.screen.get('nearby-sheet-handle');
  assert.equal(handle.props.accessibilityState.expanded, false);
  handle.props.onPanResponderGrant(); handle.props.onPanResponderRelease(null, { dx: 0, dy: 0, vy: 0 });
  handle = f.screen.get('nearby-sheet-handle');
  assert.equal(handle.props.accessibilityState.expanded, true);
  handle.props.onAccessibilityAction({ nativeEvent: { actionName: 'collapse' } });
  assert.equal(f.screen.get('nearby-sheet-handle').props.accessibilityState.expanded, false);
  f.screen.press('nearby-row-far');
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /정보 탐색 장소 · 방문 전/);
  assert.ok(f.screen.get('nearby-directions'));
  for (const label of ['카카오맵 길찾기', '카카오맵에서 장소 정보 보기']) { // MAP02: current-location is now a camera icon.
    const text = f.screen.nodes(n => n.type === 'Text' && n.props.children === label)[0];
    assert.ok(text);
    const styles = [text.props.style].flat(Infinity).filter(Boolean);
    assert.equal(Object.assign({}, ...styles).color, '#f7f7f8');
  }
  f.screen.press('nearby-directions'); f.screen.press('nearby-directions'); await tick();
  assert.equal(f.calls.filter(c => c === 'open').length, 1);
  assert.ok(f.screen.get('nearby-detail-close'));
});

test('UNEAR visual polish: one map header, readable 80pt rows and clear sheet/detail hierarchy', async () => {
  const f = fixture(); await tick();
  const header = f.screen.get('nearby-map-header');
  const headerStyle = Object.assign({}, ...header.props.style.flat(Infinity).filter(Boolean));
  assert.equal(headerStyle.minHeight, 64);
  assert.match(JSON.stringify(header), /주변 둘러보기/);
  assert.match(JSON.stringify(header), /선택한 장소 기준/);
  assert.match(JSON.stringify(f.screen.get('nearby-change-location')), /검색/);

  assert.equal(f.screen.get('nearby-list-title').props.children, '가까운 장소');
  assert.equal(f.screen.get('nearby-list-count').props.children, '2곳');
  assert.match(f.screen.get('nearby-list-copy').props.children, /선택한 장소 기준 · 직선거리 순/);
  const row = f.screen.get('nearby-row-near');
  const rowStyle = Object.assign({}, ...row.props.style.flat(Infinity).filter(Boolean));
  assert.equal(rowStyle.minHeight, 80);
  assert.equal(rowStyle.paddingHorizontal, 12);
  const rowMeta = f.screen.nodes(n => n.type === 'Text' && Array.isArray(n.props.children) && n.props.children[0] === '문화시설')[0];
  assert.deepEqual(rowMeta.props.children, ['문화시설', ' · ', '부산 중구']);
  assert.deepEqual({ fontSize: rowMeta.props.style.fontSize, lineHeight: rowMeta.props.style.lineHeight }, { fontSize: 12.5, lineHeight: 17 });
  const rowTitle = f.screen.nodes(n => n.type === 'Text' && n.props.children === '가까운 곳')[0];
  assert.deepEqual({ fontSize: rowTitle.props.style.fontSize, lineHeight: rowTitle.props.style.lineHeight }, { fontSize: 16, lineHeight: 21 });
  const distance = f.screen.nodes(n => n.type === 'Text' && n.props.children === '10m')[0];
  assert.deepEqual({ minWidth: distance.props.style.minWidth, textAlign: distance.props.style.textAlign }, { minWidth: 44, textAlign: 'right' });
  const rowPhotoFallback = f.screen.nodes(n => n.type === 'View' && n.props.style?.width === 56 && n.props.style?.height === 56)[0];
  assert.ok(rowPhotoFallback);

  f.screen.press('nearby-row-near');
  assert.match(JSON.stringify(f.screen.get('nearby-detail-meta')), /운영시간.*주소/s);
  assert.match(JSON.stringify(f.screen.get('nearby-open-kakao')), /카카오맵에서 장소 정보 보기/);
  assert.doesNotMatch(JSON.stringify(f.screen.get('nearby-open-kakao')), /underline/);
});

test('UNEAR SIMPLE manual center, delayed failure and return preserve destination/detail/active course', async () => {
  let reject;
  const f = fixture({ permission: 'denied', openExternal: () => new Promise((_, fail) => { reject = fail; }), openBrowser: async () => { throw Error('fixture failure'); } }); await tick();
  f.screen.press('nearby-change-location');
  f.screen.nodes(n => n.type === 'PlacePicker')[0].props.onConfirm({ lat: 35, lon: 129, label: '탐색 기준', source: 'provider' });
  f.screen.render(); await tick();
  f.screen.press('nearby-row-far');
  const snapshot = JSON.stringify(f.activeCourse);
  const before = f.calls.length;
  f.screen.press('nearby-directions'); f.screen.press('nearby-directions');
  assert.equal(f.calls.filter(c => c === 'open').length, 1);
  reject(Error('fixture failure')); await tick();
  assert.deepEqual(f.openedUrls, [f.openedUrls[0], f.openedUrls[0]]);
  assert.match(decodeURIComponent(f.openedUrls[0]), /\/link\/to\/먼 곳,35.001,129$/);
  assert.doesNotMatch(f.openedUrls[0], /sp=|from|탐색/);
  assert.deepEqual(f.calls.slice(before), ['open', 'browser']);
  assert.equal(JSON.stringify(f.activeCourse), snapshot);
  assert.match(JSON.stringify(f.screen.render()), /길찾기를 열지 못했어요/);
  assert.ok(f.screen.get('nearby-directions'));
  assert.match(JSON.stringify(f.screen.render()), /탐색 기준/);
});

test('UNEAR SIMPLE a drag returning to zero is not a tap and accessibility interrupts spring safely', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant();
  handle.props.onPanResponderMove(null, { dy: -80 });
  handle.props.onPanResponderMove(null, { dy: 0 });
  handle.props.onPanResponderRelease(null, { dy: 0, vy: 0 });
  assert.equal(f.screen.get('nearby-sheet-handle').props.accessibilityState.expanded, false);
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  f.finishAnimation();
  assert.equal(f.screen.get('nearby-sheet-handle').props.accessibilityState.expanded, true);
});

test('UNEAR HANDOFF browser cancel is neutral and stale errors cannot overwrite a new selection', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const f = fixture({ openExternal: async () => { throw Error(); }, openBrowser: async () => ({ type }) }); await tick();
    f.screen.press('nearby-row-far'); f.screen.press('nearby-directions'); await tick();
    assert.doesNotMatch(JSON.stringify(f.screen.render()), /길찾기를 열지 못했어요/);
    assert.equal(f.screen.get('nearby-change-location').props.accessibilityLabel, '기준 장소 변경');
    assert.match(JSON.stringify(f.screen.get('nearby-change-location')), /검색/);
    assert.equal(f.screen.get('nearby-change-location').props.variant, undefined);
  }
  let fail;
  const f = fixture({ openExternal: () => new Promise((_, reject) => { fail = reject; }), openBrowser: async () => { throw Error(); } }); await tick();
  f.screen.press('nearby-row-far'); f.screen.press('nearby-directions');
  f.screen.nodes(n => n.type === 'NearbyBrowseMap')[0].props.onSelect('near');
  fail(Error()); await tick();
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /길찾기를 열지 못했어요/);
  assert.ok(f.screen.get('nearby-directions'));
});

test('UMANUAL polish: nearby empty state asks once for a reference place and uses one clear action', async () => {
  const f = fixture({ noCenter: true }); await tick();
  const rendered = JSON.stringify(f.screen.render());
  assert.match(rendered, /부산 어디에서 둘러볼까요/);
  assert.match(rendered, /기준 장소를 선택하면 3km 안의 장소를 가까운 순으로 보여드려요/);
  assert.match(JSON.stringify(f.screen.get('nearby-change-location')), /검색/);
  assert.equal(f.screen.get('nearby-change-location').props.accessibilityLabel, '기준 장소 선택');
  assert.match(JSON.stringify(f.screen.get('nearby-empty-location')), /장소 선택/);
  assert.doesNotMatch(rendered, /기준 위치가 필요|기준 위치를 선택/);
});

test('photo integration: nearby row/detail share approved URL, visible credit and load failure fallback', async () => {
  const f = fixture(); await tick();
  try {
    const images = () => f.screen.nodes(n => n.type === 'Image');
    assert.equal(images()[0].props.source.uri, catalog.matched.data[0].imageUrl);
    images()[0].props.onLoad();
    f.screen.press('nearby-row-near');
    assert.ok(f.screen.get('place-photo-credit'));
    assert.equal(images()[0].props.source.uri,catalog.matched.data[0].imageUrl);
    images()[0].props.onError();
    f.screen.get('nearby-detail-image-fallback');
    assert.equal(images().length,0);
    f.screen.press('nearby-detail-close');
    assert.ok(f.screen.get('nearby-row-far'));
  } finally {f.screen.unmount();}
});

test('UNEAR production screen uses one dataset for map/list and marker/list open the same detail without side effects', async () => {
  const f = fixture(); await tick();
  const map = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0];
  assert.deepEqual(map.props.places.map(place => place.id), ['near', 'far']);
  map.props.onError(); assert.ok(f.screen.get('nearby-map-retry')); assert.ok(f.screen.get('nearby-row-near'));
  f.screen.press('nearby-map-retry');
  assert.ok(f.screen.get('nearby-row-near'));
  map.props.onSelect('far');
  assert.match(JSON.stringify(f.screen.render()), /먼 곳/);
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /정보 탐색 장소 · 방문 전/);
  f.screen.get('nearby-detail-image-fallback');
  f.screen.press('nearby-detail-close');
  assert.equal(f.screen.get('nearby-row-far').props.style.flat(Infinity).filter(Boolean).at(-1).borderColor, '#0066ff');
  assert.equal(f.calls.filter(call => ['recommendation', 'route', 'save', 'dwell'].includes(call)).length, 0);
});

test('UMANUAL Nearby without reference never reads GPS or requests routes; offers manual selection', async () => {
  const f = fixture({ noCenter: true }); await tick();
  assert.equal(f.calls.filter(call => ['permission-read', 'permission-request', 'gps', 'route', 'recommendation'].includes(call)).length, 0);
  assert.equal(f.screen.nodes(n => n.props.testID === 'nearby-selected').length, 0);
  assert.ok(f.screen.get('nearby-empty-location'));
  assert.equal(f.screen.nodes(n => n.props.testID?.startsWith('nearby-row-')).length, 0);
  f.screen.press('nearby-empty-location');
  assert.equal(f.calls.filter(c => c === 'draft-start').length, 1);
  assert.equal(f.screen.nodes(n => n.type === 'PlacePicker')[0].props.visible, true);
});

test('MAP02 nearby camera callback preserves reference, list, selected detail and every route/storage port', async () => {
  const f = fixture(); await tick();
  f.screen.press('nearby-row-far');
  const before = f.screen.nodes(n => n.type === 'NearbyBrowseMap')[0].props;
  const calls = [...f.calls];
  const camera = f.screen.get('nearby-selected');
  assert.equal(camera.type, 'MapCameraButton');
  camera.props.onCamera({ lat: 35.3, lon: 129.3 });
  const after = f.screen.nodes(n => n.type === 'NearbyBrowseMap')[0].props;
  assert.deepEqual(after.center, before.center); assert.deepEqual(after.places, before.places); assert.equal(after.selectedId, before.selectedId);
  assert.deepEqual(after.cameraPoint, { lat: 35.3, lon: 129.3 }); assert.deepEqual(f.calls, calls);
});

test('UMANUAL manual reference works without starting GPS and labels selection honestly', async () => {
  const f = fixture({ pendingGps: true }); await tick();
  f.screen.press('nearby-change-location');
  const picker = f.screen.nodes(node => node.type === 'PlacePicker')[0];
  picker.props.onConfirm({ lat: 35, lon: 129, label: '부산역', source: 'provider' });
  assert.equal(f.calls.includes('gps'), false); await tick();
  const location = f.screen.nodes(node => node.type === 'Text' && node.props.children === '부산역 기준')[0];
  assert.equal(location.props.children, '부산역 기준');
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /현위치 기준/);
});

test('UNEAR same-coordinate cluster opens accessible group and returns to all rows', async () => {
  const f = fixture(); await tick();
  const map = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0];
  map.props.onCluster(['near', 'far']);
  assert.match(JSON.stringify(f.screen.render()), /이 위치의 장소.*2곳/s);
  assert.ok(f.screen.get('nearby-row-near')); assert.ok(f.screen.get('nearby-row-far'));
  f.screen.press('nearby-show-all');
  assert.match(JSON.stringify(f.screen.render()), /가까운 장소.*2곳/s);
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
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
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
  const host = screenRuntime();
  class TabValue {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; }
    stopAnimation(callback) { callback?.(this.value); }
    interpolate() { return this.value; }
  }
  const runtime = screenRuntime({
    'react-native': {
      ...host.native,
      PanResponder: { create: handlers => ({ panHandlers: handlers }) },
      Animated: {
        ...host.native.Animated,
        Value: TabValue,
        View: 'AnimatedView',
        spring(value, config) { return { start() { value.setValue(config.toValue); } }; },
      },
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-blur': { BlurView: 'BlurView' },
    'expo-glass-effect': { GlassView: 'GlassView', isGlassEffectAPIAvailable: () => true, isLiquidGlassAvailable: () => true },
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
  assert.ok(screen.get('floating-tab-liquid-glass'));
  const wrapper = screen.nodes(node => node.type === 'View' && node.props.pointerEvents === 'box-none')[0];
  assert.equal(wrapper.props.style.flat(Infinity).at(-1).bottom, 34);
  const frame = { x: 16, y: 744, width: 358, height: 66 };
  wrapper.props.onLayout({ nativeEvent: { layout: frame } });
  assert.deepEqual(frames, [frame]);
  const strip = screen.nodes(node => node.type === 'View' && typeof node.props.onPanResponderMove === 'function')[0];
  strip.props.onLayout({ nativeEvent: { layout: { width: 360, height: 64 } } });
  assert.ok(screen.get('floating-tab-selection-lens'));
  assert.equal(strip.props.onMoveShouldSetPanResponder(null, { dx: 8, dy: 1 }), true);
  assert.equal(strip.props.onMoveShouldSetPanResponder(null, { dx: 3, dy: 12 }), false);
  const tabs = screen.nodes(node => node.type === 'Pressable');
  tabs[1].props.onPressIn();
  strip.props.onPanResponderGrant();
  strip.props.onPanResponderMove(null, { dx: 174 });
  assert.deepEqual(calls, []);
  strip.props.onPanResponderRelease(null, { dx: 174 });
  assert.deepEqual(calls, ['profile']);
  tabs[3].props.onPressIn();
  strip.props.onPanResponderGrant();
  strip.props.onPanResponderMove(null, { dx: -87 });
  strip.props.onPanResponderRelease(null, { dx: -87 });
  assert.deepEqual(calls, ['profile', 'record']);
  tabs[2].props.onPressIn();
  strip.props.onPanResponderGrant();
  strip.props.onPanResponderMove(null, { dx: -87 });
  strip.props.onPanResponderTerminate();
  assert.deepEqual(calls, ['profile', 'record']);
  tabs.forEach(node => node.props.onPress());
  assert.deepEqual(calls, ['profile', 'record', 'main', 'course', 'record', 'profile']);
});

test('FloatingTabBar regular tap animates selection position once across navigation remount', () => {
  const springs = [];
  let valueOrder = 0;
  const host = screenRuntime();
  class TapValue {
    constructor(value) { this.value = value; this.kind = valueOrder++ % 2 === 0 ? 'position' : 'lift'; }
    setValue(value) { this.value = value; }
    stopAnimation(callback) { callback?.(this.value); }
    interpolate() { return this.value; }
  }
  const runtime = screenRuntime({
    'react-native': {
      ...host.native,
      AccessibilityInfo: {
        isReduceTransparencyEnabled: async () => false,
        isReduceMotionEnabled: async () => false,
        addEventListener: () => ({ remove() {} }),
      },
      PanResponder: { create: handlers => ({ panHandlers: handlers }) },
      Animated: {
        ...host.native.Animated,
        Value: TapValue,
        View: 'AnimatedView',
        spring(value, config) {
          springs.push({ kind: value.kind, target: config.toValue });
          return { start() { value.setValue(config.toValue); } };
        },
      },
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-blur': { BlurView: 'BlurView' },
    'expo-glass-effect': { GlassView: 'GlassView', isGlassEffectAPIAvailable: () => true, isLiquidGlassAvailable: () => true },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) },
  });
  const FloatingTabBar = runtime.load('src/ui/FloatingTabBar.tsx').FloatingTabBar;
  let selected = '';
  const handlers = { onMain() {}, onCourse() {}, onRecord() { selected = 'record'; }, onProfile() {} };
  const first = runtime.mount(FloatingTabBar, { active: 'main', ...handlers });
  springs.length = 0;
  const record = first.nodes(node => node.type === 'Pressable')[2];
  record.props.onPressIn();
  record.props.onPressOut();
  record.props.onPress();
  assert.equal(selected, 'record');
  first.unmount();
  runtime.mount(FloatingTabBar, { active: 'record', ...handlers });
  assert.equal(springs.filter(item => item.kind === 'position' && item.target === 2).length, 1);
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

  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  f.screen.render();
  assert.equal(value.setCount, setCountBeforeOpen, 'state synchronization must not overwrite an in-flight spring');
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, mapInsetBeforeOpen, 'map viewport work waits for settled sheet geometry');

  f.finishAnimation();
  assert.ok(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset > mapInsetBeforeOpen);
});

test('UNEAR drag regression: a re-grab during spring continues from current 318 to 326', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
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
  assert.equal(value.value, 382);

  const summary = f.screen.get('nearby-list-summary');
  const moveBeforeMeasurement = handle.props.onPanResponderMove;
  summary.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 80 } } });
  f.screen.render();
  assert.equal(value.value, 382, 'changed geometry must preserve the current in-range drag height');
  assert.equal(f.screen.get('nearby-sheet-handle').props.onPanResponderMove, moveBeforeMeasurement, 'active responder remains stable across endpoint changes');

  value.setValue(382);
  const setCountBeforeRepeat = value.setCount;
  f.screen.get('nearby-list-summary').props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 80 } } });
  f.screen.render();
  assert.equal(value.value, 382);
  assert.equal(value.setCount, setCountBeforeRepeat, 'same measurement does not retrigger state or geometry synchronization');
});

test('UNEAR drag regression: cumulative moves reverse correctly and termination settles once', async () => {
  const f = fixture(); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const value = f.animatedValues[0];
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -20 });
  assert.equal(value.value, 302);
  handle.props.onPanResponderMove(null, { dy: -40 });
  assert.equal(value.value, 322);
  handle.props.onPanResponderMove(null, { dy: -10 });
  assert.equal(value.value, 292);
  handle.props.onPanResponderTerminate(null, { dy: -10, vy: 0 });
  assert.equal(value.value, 282, 'a native responder cancellation settles the transient height to the nearest endpoint');
});

test('UNEAR diagnostic fake distinguishes cancellation, completion, and stale completion', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const collapsedInset = f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset;
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  f.screen.render();
  f.animatedValues[0].advanceTo(318);
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  f.screen.render();
  assert.deepEqual(f.animationEvents.slice(-2), [
    { type: 'cancel', at: 318, target: 610 },
    { type: 'start', at: 318, target: 282 },
  ]);
  f.finishAnimationAt(0);
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, collapsedInset, 'stale expand completion has no effect');
  f.finishAnimationAt(1);
  assert.deepEqual(f.animationEvents.at(-1), { type: 'finish', at: 282, target: 282 });
  assert.equal(f.screen.nodes(node => node.type === 'NearbyBrowseMap')[0].props.bottomInset, collapsedInset);
});

test('UNEAR drag regression: release before asynchronous grant baseline settles safely after callback', async () => {
  const f = fixture({ manualStopAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: -100, vy: -0.5 });
  handle.props.onPanResponderRelease(null, { dy: -100, vy: -0.5 });
  assert.equal(f.animatedValues[0].value, 282);
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
  assert.equal(f.animatedValues[0].value, 382);
  tab.props.onFrame({ x: 16, y: 500, width: 358, height: 66 });
  f.screen.render();
  assert.equal(f.animatedValues[0].value, 526);
  f.screen.get('nearby-sheet-handle').props.onPanResponderMove(null, { dy: -110, vy: 0 });
  assert.equal(f.animatedValues[0].value, 536);
});

test('UNEAR drag regression: expanded downward swipe settles collapsed and unmount blocks pending completion', async () => {
  const f = fixture(); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: 100, vy: 0.5 });
  assert.equal(f.animatedValues[0].value, 510);
  handle.props.onPanResponderRelease(null, { dy: 100, vy: 0.5 });
  assert.equal(f.animatedValues[0].value, 282);

  const pending = fixture({ manualAnimation: true }); await tick();
  pending.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  pending.screen.unmount();
  assert.doesNotThrow(() => pending.finishAnimation());
  assert.equal(pending.calls.filter(call => ['main', 'record', 'profile', 'kakao'].includes(call)).length, 0);
});

test('UNEAR drag regression: a re-grab during collapsing spring continues downward from its current height', async () => {
  const f = fixture({ manualAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  f.finishAnimationAt(0);
  assert.equal(f.animatedValues[0].value, 610);
  f.screen.get('nearby-sheet-handle').props.onAccessibilityTap();
  f.screen.render();
  f.animatedValues[0].advanceTo(500);
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderMove(null, { dy: 8, vy: 0 });
  assert.equal(f.animatedValues[0].value, 492);
  assert.deepEqual(f.animationEvents.at(-1), { type: 'cancel', at: 500, target: 282 });
});

test('UNEAR drag regression: tap release waits for baseline and toggles exactly once', async () => {
  const f = fixture({ manualStopAnimation: true }); await tick();
  f.screen.nodes(node => node.type === 'FloatingTabBar')[0].props.onFrame({ x: 16, y: 744, width: 358, height: 66 });
  const handle = f.screen.get('nearby-sheet-handle');
  handle.props.onPanResponderGrant(null, { dy: 0, vy: 0 });
  handle.props.onPanResponderRelease(null, { dy: 0, vy: 0 });
  assert.equal(f.animationEvents.filter(event => event.type === 'start').length, 0);
  f.finishStopAnimation();
  assert.equal(f.animatedValues[0].value, 610);
  assert.equal(f.animationEvents.filter(event => event.type === 'start' && event.target === 610).length, 1);
});

test('LIVE-NEARBY: public screen shows only confirmed memory snapshot and center reselection never reloads it', async () => {
    const f = fixture({ liveResult: { status: 'partial', catalog: [{ contentId: 'live', title: '실시간 장소', lat: 35.0002, lon: 129, classification: 'representative_core', category: '관광지' }] } });
    f.screen.render();
    await tick();
    assert.equal(f.calls.filter(call => call === 'live-load').length, 1);
    assert.equal(f.screen.nodes(n => n.props?.testID === 'nearby-row-live').length, 1);
    assert.equal(f.screen.nodes(n => n.props?.testID === 'nearby-row-near').length, 0);
    assert.ok(f.screen.get('nearby-live-partial'));
    f.screen.nodes(n => n.type === 'PlacePicker')[0].props.onConfirm({ lat: 35.0001, lon: 129, label: '다시 선택', source: 'provider' });
    await tick();
    assert.equal(f.calls.filter(call => call === 'live-load').length, 1);
    f.screen.unmount();
    assert.equal(f.calls.filter(call => call === 'live-cancel').length, 1);
});

test('LIVE-NEARBY: public default loads live snapshot and never reads bundled fallback rows', async () => {
  const f = fixture({ liveResult: { status: 'ready', catalog: [{ contentId: 'live-default', title: '실시간 기본', lat: 35.0002, lon: 129, classification: 'representative_core', category: '관광지' }] } });
  await tick();
  assert.equal(f.calls.filter(call => call === 'live-load').length, 1);
  assert.ok(f.screen.get('nearby-row-live-default'));
  assert.equal(f.screen.nodes(n => n.props?.testID === 'nearby-row-near').length, 0);
  f.screen.unmount();
});

test('LIVE-NEARBY: public screen waits for an explicit manual center before loading a snapshot', async () => {
    const f = fixture({ noCenter: true, liveResult: { status: 'ready', catalog: [{ contentId: 'live', title: '실시간 장소', lat: 35.0002, lon: 129, classification: 'representative_core', category: '관광지' }] } });
    f.screen.render(); await tick();
    assert.equal(f.calls.includes('live-load'), false);
    assert.equal(f.screen.nodes(n => n.props?.testID === 'nearby-row-near').length, 0);
    f.screen.nodes(n => n.type === 'PlacePicker')[0].props.onConfirm({ lat: 35, lon: 129, label: '수동 선택', source: 'provider' });
    f.screen.render();
    await tick();
    assert.equal(f.calls.filter(call => call === 'live-load').length, 1);
    assert.equal(f.screen.nodes(n => n.props?.testID === 'nearby-row-live').length, 1);
    f.screen.unmount();
});

test('LIVE-NEARBY: unavailable session shows retry and no static place', async () => {
    const f = fixture({ liveResult: { status: 'failed', catalog: [] } }); f.screen.render(); await tick();
    assert.equal(f.screen.nodes(n => n.props?.testID === 'nearby-row-near').length, 0);
    assert.ok(f.screen.get('nearby-empty-location'));
    assert.equal(f.calls.filter(call => call === 'live-load').length, 1);
    f.screen.press('nearby-empty-location'); await tick();
    assert.equal(f.calls.filter(call => call === 'live-retry').length, 1);
    f.screen.unmount();
});

test('LIVE-NEARBY guest: no session waits for explicit CAPTCHA, then loads once despite duplicate callback', async () => {
    const f = fixture({ authPrepare: 'captcha_required', liveResult: { status: 'ready', catalog: [] } });
    f.screen.render(); await tick(); f.screen.render();
    assert.equal(f.calls.filter(call => call === 'live-load').length, 0);
    const sheet = f.screen.nodes(node => node.type === 'CaptchaVerificationSheet')[0];
    assert.equal(sheet.props.visible, true);
    sheet.props.onVerified('fixture-token'); sheet.props.onVerified('duplicate-token');
    await tick(); f.screen.render();
    assert.equal(f.calls.filter(call => call === 'auth-verify').length, 1);
    assert.equal(f.calls.filter(call => call === 'live-load').length, 1);
    assert.equal(f.screen.nodes(node => node.type === 'CaptchaVerificationSheet')[0].props.visible, false);
    f.screen.unmount();
});

test('LIVE-NEARBY guest: cancel and auth failure never call provider; retry asks for a fresh challenge', async () => {
    const cancelled = fixture({ authPrepare: 'captcha_required' });
    cancelled.screen.render(); await tick(); cancelled.screen.render();
    cancelled.screen.nodes(node => node.type === 'CaptchaVerificationSheet')[0].props.onClose();
    await tick(); cancelled.screen.render();
    assert.equal(cancelled.calls.filter(call => call === 'live-load').length, 0);
    cancelled.screen.press('nearby-empty-location'); await tick(); cancelled.screen.render();
    assert.equal(cancelled.calls.filter(call => call === 'auth-prepare').length, 2);
    assert.equal(cancelled.screen.nodes(node => node.type === 'CaptchaVerificationSheet')[0].props.visible, true);
    cancelled.screen.unmount();

    const failed = fixture({ authPrepare: 'captcha_required', authVerify: 'failed' });
    failed.screen.render(); await tick(); failed.screen.render();
    failed.screen.nodes(node => node.type === 'CaptchaVerificationSheet')[0].props.onVerified('fixture-token');
    await tick(); failed.screen.render();
    assert.equal(failed.calls.filter(call => call === 'live-load').length, 0);
    assert.ok(failed.screen.get('nearby-empty-location'));
    failed.screen.unmount();
});

test('LIVE-NEARBY guest: invalid challenge config fails closed', async () => {
    const invalid = fixture({ authPrepare: 'captcha_required', invalidChallenge: true });
    invalid.screen.render(); await tick(); invalid.screen.render();
    assert.equal(invalid.calls.filter(call => call === 'live-load').length, 0);
    assert.equal(invalid.screen.nodes(node => node.type === 'CaptchaVerificationSheet')[0].props.visible, false);
    assert.ok(invalid.screen.get('nearby-empty-location'));
    invalid.screen.unmount();

});

test('LIVE-NEARBY market: static-only partial names its source, unknown hours and keeps directions available', async () => {
    const market = { contentId: 'market', title: '저장된 시장', lat: 35.0002, lon: 129, classification: 'conditional_more', category: '시장', addr1: '부산 중구 시장길 1', sourceKind: 'traditional_market_standard_static', operatingHoursStatus: 'unverified' };
    const f = fixture({ liveResult: { status: 'partial', staticMarketOnly: true, catalog: [market] } });
    f.screen.render(); await tick(); f.screen.render();
    assert.match(JSON.stringify(f.screen.get('nearby-live-partial')), /실시간 장소는 확인하지 못했어요/);
    assert.match(JSON.stringify(f.screen.get('nearby-row-market')), /전통시장 자료 · 운영시간 미확인/);
    f.screen.press('nearby-row-market');
    assert.match(JSON.stringify(f.screen.get('nearby-static-market-detail')), /전국전통시장표준데이터 저장 정보/);
    assert.match(JSON.stringify(f.screen.render()), /운영시간 확인 필요/);
    assert.match(JSON.stringify(f.screen.render()), /영업·출입을 확인/);
    assert.equal(f.screen.nodes(node => node.type === 'Image' && node.props?.source?.uri).length, 0);
    f.screen.press('nearby-directions'); await tick();
    assert.equal(f.calls.filter(call => call === 'open').length, 1);
    assert.match(decodeURIComponent(f.openedUrls[0]), /저장된 시장,35\.0002,129/);
    assert.equal(f.calls.filter(call => call === 'course-write' || call === 'lifecycle').length, 0);
    f.screen.unmount();
});
