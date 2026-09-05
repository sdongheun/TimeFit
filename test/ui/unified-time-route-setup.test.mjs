import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
let network = 0;
beforeEach(t => { network = 0; t.mock.method(globalThis, 'fetch', async () => { network++; throw Error('network forbidden'); }); });
afterEach(() => assert.equal(network, 0));
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const O = { lat: 35.15, lon: 129.05, label: '수동 출발지', source: 'provider' };
const D = { lat: 35.16, lon: 129.06, label: '약속 장소', source: 'provider' };
function fixture(options = {}) {
  const calls = [], listeners = new Map();
  let now = options.now ?? new Date(2026, 8, 5, 12, 0), result = options.run;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now() { return now.getTime(); } }
  const auth = { session: options.auth ?? null, isLoading: options.authLoading ?? false };
  const overrides = {
    __Date: Clock, __DEV__: options.internal ?? false, __process: { env: { EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS: options.internal ? 'true' : undefined, EXPO_PUBLIC_ROUTE_PROXY_ENABLED: options.proxy ? 'true' : 'false', EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL: 'https://example.test/' } },
    '../data/busan_poi_catalog.json': { matched: { data: [] }, unmatched: { data: [] } },
    './AppFlowContext': { useAppFlow: () => ({ setLatestResults: v => calls.push(['latest', v]) }) },
    './AuthContext': { useAuth: () => auth },
    'expo-location': { Accuracy: { Balanced: 1 }, async getForegroundPermissionsAsync() { calls.push(['permission-read']); return { status: options.permission ?? 'denied' }; }, async getCurrentPositionAsync() { calls.push(['gps']); return options.gps ? options.gps() : { coords: { latitude: 35.1, longitude: 129.1 } }; }, async requestForegroundPermissionsAsync() { calls.push(['permission-prompt']); throw Error('unexpected'); } },
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ async resolve(point, reason) { calls.push(['label', reason]); return options.label ? options.label() : { source: 'address', address: '현재 위치 주소' }; } }) },
    './expoSelectionHaptic': { async requestExpoSelectionHaptic() { calls.push(['haptic']); return { status: 'requested' }; } },
    './recommendation/v1Session': { async runRecommendationSession(session, input) { calls.push(['recommend', session, input]); if (result) return result(session, input); return { representativeCourse: null, alternativeCourses: [], resultState: 'no_verified_course_within_limit' }; } },
    './MapPlacePicker': { MapPlacePicker: 'MapPlacePicker' }, './PlacePicker': { PlacePicker: 'PlacePicker' }, './CaptchaVerificationSheet': { CaptchaVerificationSheet: 'CaptchaVerificationSheet' }, './recommendation/RecommendationLoadingProgress': { RecommendationLoadingProgress: 'RecommendationLoadingProgress' },
    '@react-native-community/slider': { __esModule: true, default: 'Slider' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    '@react-navigation/native': { usePreventRemove(prevent, callback) { listeners.set('remove', () => { if (prevent) callback({ data: {} }); }); } },
  };
  if (options.realCaptcha) {
    delete overrides['./CaptchaVerificationSheet'];
    overrides['react-native-webview'] = { WebView: 'WebView' };
  }
  if (options.realPickers) {
    delete overrides['./PlacePicker']; delete overrides['./MapPlacePicker'];
    overrides['../services/kakaoLocationSearchAdapter'] = { createKakaoLocationSearchAdapter: () => ({ async search(query) { calls.push(['search', query]); return { suggestions: [{ ...O, address: 'fixture address', kind: 'place' }], attempts: [{ status: 'ok' }], diagnostics: { providerRequests: 1, fallbackCount: 0, cache: 'miss' } }; } }) };
  }
  const host = screenRuntime(overrides);
  overrides['react-native'] = { ...host.native, TextInput: 'TextInput', Modal: 'Modal', ActivityIndicator: 'ActivityIndicator', useWindowDimensions: () => ({ width: options.width ?? 375, height: options.height ?? 812, fontScale: options.fontScale ?? 1 }) };
  const navigation = { goBack() { calls.push(['back']); }, replace(...args) { calls.push(['replace', ...args]); }, navigate(...args) { calls.push(['navigate', ...args]); }, addListener(name, fn) { listeners.set(name, fn); return () => listeners.delete(name); } };
  const screen = host.mount(host.load('src/ui/TimeSetupScreen.tsx').TimeSetupScreen, { navigation, route: { params: { presetMin: 60 } } });
  const node = type => screen.nodes(n => n.type === type)[0];
  const choose = (field, place) => { screen.press(`route-${field}-field`); node('PlacePicker').props.onConfirm(place); };
  return { screen, calls, auth, listeners, choose, node, setNow: value => { now = value; }, setRun: value => { result = value; } };
}

test('USETUP failure-first: direct fields, permanent wheel, return mode, picker cancellation and fixed CTA', async () => {
  const f = fixture(); await tick();
  assert.ok(f.screen.get('route-origin-field'));
  assert.equal(f.screen.nodes(n => n.props.accessibilityLabel === '도착 시각 시').length, 1);
  f.choose('origin', O); f.choose('destination', D);
  f.screen.press('route-origin-field'); f.node('PlacePicker').props.onOpenMap();
  f.node('MapPlacePicker').props.onClose();
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  assert.match(JSON.stringify(f.screen.get('route-destination-field')), /약속 장소/);
  f.choose('origin', { ...O, label: '새 출발지' });
  assert.match(JSON.stringify(f.screen.get('route-destination-field')), /약속 장소/);
  f.screen.press('route-return-origin');
  assert.match(JSON.stringify(f.screen.get('route-destination-field')), /출발지로 돌아오기/);
  f.choose('origin', O);
  assert.equal(f.calls.filter(c => c[0] === 'recommend').length, 0);
  assert.ok(f.screen.get('setup-footer'));
  assert.equal(JSON.stringify(f.screen.get('setup-scroll')).includes('setup-recommend'), false);
  f.screen.press('setup-recommend'); await tick();
  const session = f.calls.find(c => c[0] === 'recommend')[1];
  assert.equal(session.destination, null); assert.equal(session.origin.label, O.label);
});

test('USETUP failure-first: already-permitted GPS initializes once on unified setup; late label cannot replace manual origin', async () => {
  let resolveLabel;
  const f = fixture({ permission: 'granted', label: () => new Promise(r => { resolveLabel = r; }) });
  await tick();
  assert.equal(f.calls.filter(c => c[0] === 'gps').length, 1);
  f.choose('origin', O); resolveLabel({ source: 'address', address: '오래된 GPS 주소' }); await tick();
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  f.screen.render(); assert.equal(f.calls.filter(c => c[0] === 'gps').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'permission-prompt').length, 0);
});

const count = (f, name) => f.calls.filter(c => c[0] === name).length;
test('ULOC TimeSetup real picker: same-edit map cancel/search restores draft, selection and list; final close/new target resets only draft', async () => {
  const f = fixture({ realPickers: true }); await tick();
  const general = JSON.stringify(f.screen.get('setup-general-inputs'));
  f.screen.press('route-origin-field'); f.screen.get('location-search-input').props.onChangeText('사상역');
  f.screen.get('location-search-input').props.onSubmitEditing(); await tick(); f.screen.press('location-suggestion-0');
  const scrolls = [];
  f.screen.get('location-results').props.ref.current = { scrollTo: value => scrolls.push(value.y) };
  f.screen.get('location-results').props.onScroll({ nativeEvent: { contentOffset: { y: 170 } } });
  f.screen.press('location-map'); f.screen.nodes(n => n.type === 'Modal' && n.props.visible)[0].props.onRequestClose();
  const modal = f.screen.nodes(n => n.type === 'Modal' && n.props.visible)[0]; modal.props.onShow();
  assert.equal(scrolls.at(-1), 170);
  assert.equal(f.screen.get('location-search-input').props.value, '사상역');
  assert.equal(f.screen.get('location-suggestion-0').props.accessibilityState.selected, true);
  assert.equal(f.screen.get('location-search-input').props.autoFocus, false);
  f.screen.press('location-map'); f.screen.nodes(n => n.props.accessibilityLabel === '뒤로가기')[0].props.onPress();
  assert.ok(f.screen.get('location-confirm')); assert.equal(count(f, 'search'), 1);
  assert.equal(JSON.stringify(f.screen.get('setup-general-inputs')), general);
  f.screen.press('location-confirm');
  f.screen.press('route-destination-field'); assert.equal(f.screen.get('location-search-input').props.value, '');
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0);
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  f.screen.get('location-search-input').props.onChangeText('다른 검색'); f.screen.press('location-close');
  f.screen.press('route-origin-field'); assert.equal(f.screen.get('location-search-input').props.value, '');
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  assert.equal(count(f, 'recommend'), 0); assert.equal(count(f, 'latest'), 0); f.screen.unmount();
});
test('ULOC real map confirmation locks adapter and parent once; search return invalidates late address and permits a fresh confirmation', async () => {
  const pending = [];
  const f = fixture({ realPickers: true, label: () => new Promise(resolve => pending.push(resolve)) }); await tick();
  f.screen.press('route-origin-field'); f.screen.press('location-map'); f.node('KakaoRouteMap').props.onMapReady();
  const press = f.screen.get('map-confirm').props.onPress; press(); press(); assert.equal(count(f, 'label'), 1);
  f.screen.nodes(n => n.props.accessibilityLabel === '뒤로가기')[0].props.onPress(); pending[0]({ source: 'address', address: '늦은 주소' }); await tick();
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /출발지 선택/);
  f.screen.press('location-map'); f.node('KakaoRouteMap').props.onMapReady();
  const next = f.screen.get('map-confirm').props.onPress; next(); next(); assert.equal(count(f, 'label'), 2);
  pending[1]({ source: 'address', address: '확정 주소' }); await tick();
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /확정 주소/);
  next(); assert.equal(count(f, 'label'), 2); // queued event from the dismissed map must stay terminal
  assert.equal(f.screen.nodes(n => n.type === 'Modal' && n.props.visible).length, 0);
  assert.equal(count(f, 'recommend'), 0); f.screen.unmount();
});
test('USETUP real search and map ports count only explicit search/confirm; cancelled pending pin label never applies', async () => {
  let resolveLabel;
  const f = fixture({ realPickers: true, label: () => new Promise(r => { resolveLabel = r; }) }); await tick();
  f.screen.press('route-origin-field');
  f.screen.get('location-search-input').props.onChangeText('사상역');
  await f.screen.get('location-search-input').props.onSubmitEditing();
  f.screen.press('location-suggestion-0'); f.screen.press('location-confirm');
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  assert.equal(count(f, 'search'), 1); assert.equal(count(f, 'label'), 0);
  f.screen.press('route-destination-field');
  f.screen.get('location-search-input').props.onChangeText(''); f.screen.press('location-map');
  f.node('KakaoRouteMap').props.onMapReady(); f.node('KakaoRouteMap').props.onMapCenterChange(D);
  assert.equal(count(f, 'label'), 0); f.screen.press('map-confirm');
  assert.equal(count(f, 'label'), 1);
  f.screen.nodes(n => n.type === 'Modal' && n.props.visible)[0].props.onRequestClose();
  resolveLabel({ source: 'address', address: '취소한 목적지' }); await tick();
  assert.match(JSON.stringify(f.screen.get('route-destination-field')), /출발지로 돌아오기/);
  f.screen.press('route-destination-field'); f.screen.press('location-map');
  f.node('KakaoRouteMap').props.onMapReady(); f.node('KakaoRouteMap').props.onMapCenterChange({ lat: D.lat, lon: D.lon });
  f.screen.press('map-confirm'); resolveLabel({ source: 'address', address: '새 확정 목적지' }); await tick();
  assert.match(JSON.stringify(f.screen.get('route-destination-field')), /새 확정 목적지/);
  assert.equal(count(f, 'label'), 2); assert.equal(count(f, 'recommend'), 0); f.screen.unmount();
});
const findChild = (node, predicate) => {
  if (Array.isArray(node)) return node.map(n => findChild(n, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return;
  return predicate(node) ? node : findChild(node.props.children, predicate);
};
function wheel(f, label, index, user = true) {
  const root = f.screen.nodes(n => n.props.accessibilityLabel === label)[0];
  const scroller = findChild(root, n => n.type === 'ScrollView');
  if (user) scroller.props.onScrollBeginDrag();
  const event = { nativeEvent: { contentOffset: { y: index * scroller.props.snapToInterval }, velocity: { y: 0 } } };
  scroller.props.onScroll(event);
  if (user) scroller.props.onScrollEndDrag(event);
  f.screen.render();
}
function arrival(f, total) {
  wheel(f, '도착 시각 오전 오후', total >= 720 ? 1 : 0);
  wheel(f, '도착 시각 시', (Math.floor(total / 60) % 12 || 12) - 1);
  wheel(f, '도착 시각 분', total % 60);
}

test('USETUP picker map→search, map confirm, close and interactive removal preserve confirmed fields', async () => {
  const f = fixture(); await tick(); f.choose('origin', O);
  f.screen.press('route-destination-field'); f.node('PlacePicker').props.onOpenMap();
  f.node('MapPlacePicker').props.onClose();
  assert.equal(f.node('PlacePicker').props.visible, true);
  f.node('PlacePicker').props.onOpenMap();
  f.node('MapPlacePicker').props.onConfirm({ point: D, label: D.label, source: 'map' });
  f.screen.press('route-origin-field');
  assert.equal(f.screen.get('setup-recommend').props.disabled, true);
  f.screen.get('setup-recommend').props.onPress();
  f.listeners.get('remove')();
  assert.equal(f.node('PlacePicker').props.visible, false);
  assert.match(JSON.stringify(f.screen.get('route-destination-field')), /약속 장소/);
  f.screen.press('route-origin-field'); f.node('PlacePicker').props.onClose();
  assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  assert.equal(count(f, 'recommend'), 0); assert.equal(count(f, 'label'), 0);
});

for (const permission of ['denied', 'undetermined', 'granted']) test(`USETUP ${permission} GPS failure/manual fallback, no rerender retries`, async () => {
  const f = fixture({ permission, gps: async () => { throw Error('GPS unavailable'); } }); await tick();
  f.screen.render(); f.screen.render(); f.choose('origin', O);
  assert.equal(count(f, 'permission-read'), 1); assert.equal(count(f, 'gps'), permission === 'granted' ? 1 : 0);
  assert.equal(count(f, 'permission-prompt'), 0);
  f.screen.press('setup-recommend'); await tick();
  assert.equal(count(f, 'recommend'), 1);
  assert.equal(f.calls.find(c => c[0] === 'recommend')[1].deviceLocationSnapshot, undefined);
});
for (const action of ['manual', 'blur', 'unmount']) test(`USETUP late coordinate ignored after ${action}`, async () => {
  let resolveGps;
  const f = fixture({ permission: 'granted', gps: () => new Promise(r => { resolveGps = r; }) }); await tick();
  if (action === 'manual') f.choose('origin', O);
  if (action === 'blur') f.listeners.get('blur')();
  if (action === 'unmount') f.screen.unmount();
  resolveGps({ coords: { latitude: 1, longitude: 2 } }); await tick();
  assert.equal(count(f, 'label'), 0);
  if (action === 'manual') assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
});

test('USETUP wheel commits immediately, inertia settles once; slider user changes only haptic; session preserves fields and device point', async () => {
  const f = fixture({ permission: 'granted' }); await tick(); f.choose('origin', O); f.choose('destination', D);
  assert.equal(count(f, 'haptic'), 0);
  const root = f.screen.nodes(n => n.props.accessibilityLabel === '도착 시각 분')[0];
  const scroll = findChild(root, n => n.type === 'ScrollView');
  scroll.props.onScrollBeginDrag(); scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 44 } } });
  scroll.props.onScrollEndDrag({ nativeEvent: { contentOffset: { y: 44 }, velocity: { y: 1 } } });
  scroll.props.onMomentumScrollBegin(); scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 88 } } });
  scroll.props.onMomentumScrollEnd();
  assert.equal(count(f, 'haptic'), 2); assert.equal(count(f, 'recommend'), 0);
  const slider = f.node('Slider'); slider.props.onValueChange(15); // programmatic, no drag
  assert.equal(count(f, 'haptic'), 2);
  slider.props.onSlidingStart(); slider.props.onValueChange(20); slider.props.onValueChange(20); slider.props.onSlidingComplete(20);
  assert.equal(count(f, 'haptic'), 3);
  f.screen.press('setup-recommend'); await tick();
  const session = f.calls.find(c => c[0] === 'recommend')[1];
  assert.equal(session.remainingMin, 62); assert.equal(session.arrivalBufferMin, 20);
  assert.equal(session.origin.label, O.label); assert.equal(session.destination.label, D.label);
  assert.deepEqual(session.deviceLocationSnapshot, { lat: 35.1, lon: 129.1 });
});

for (const minutes of [0, 1, 120, 121]) test(`USETUP ${minutes} minute boundary executes only valid session`, async () => {
  const f = fixture(); await tick(); f.choose('origin', O); arrival(f, 720 + minutes);
  f.screen.press('setup-recommend'); await tick();
  assert.equal(count(f, 'recommend'), minutes > 0 && minutes <= 120 ? 1 : 0);
  if (minutes === 0 || minutes === 121) assert.ok(f.screen.get('setup-input-error'));
});
test('USETUP missing origin, elapsed execution and midnight do not invent a next-day duration', async () => {
  const missing = fixture(); await tick(); missing.screen.press('setup-recommend');
  assert.equal(count(missing, 'recommend'), 0); assert.ok(missing.screen.get('setup-input-error'));
  const elapsed = fixture(); await tick(); elapsed.choose('origin', O); elapsed.setNow(new Date(2026, 8, 5, 13, 1));
  elapsed.screen.press('setup-recommend'); await tick(); assert.equal(count(elapsed, 'recommend'), 0); assert.ok(elapsed.screen.get('setup-input-error'));
  const midnight = fixture({ now: new Date(2026, 8, 5, 23, 50) }); await tick(); midnight.choose('origin', O);
  midnight.setNow(new Date(2026, 8, 6, 0, 1)); midnight.screen.press('setup-recommend'); await tick();
  assert.equal(count(midnight, 'recommend'), 0); assert.match(JSON.stringify(midnight.screen.get('setup-input-error')), /120|2시간/);
});

test('USETUP CAPTCHA wait captures fresh remaining time once, loading progress remains connected', async () => {
  let finish;
  const f = fixture({ proxy: true, run: (_session, input) => { input.onProgress('input_ready'); return new Promise(r => { finish = r; }); } });
  await tick(); f.choose('origin', O); f.screen.press('setup-recommend');
  f.setNow(new Date(2026, 8, 5, 12, 5)); f.node('CaptchaVerificationSheet').props.onVerified('fixture-fresh');
  assert.equal(count(f, 'recommend'), 1); assert.equal(f.calls.find(c => c[0] === 'recommend')[1].remainingMin, 55);
  assert.equal(f.node('RecommendationLoadingProgress').props.stage, 'input_ready');
  assert.equal(f.screen.nodes(n => n.props.testID === 'setup-recommend').length, 0);
  finish({ representativeCourse: null, alternativeCourses: [] }); await tick(); assert.equal(count(f, 'replace'), 1);
});

test('USETUP CAPTCHA cancel/stale verification, success and same-tick duplicate taps', async () => {
  const f = fixture({ proxy: true }); await tick(); f.choose('origin', O); f.choose('destination', D);
  const press = f.screen.get('setup-recommend').props.onPress; press(); press();
  const staleVerify = f.node('CaptchaVerificationSheet').props.onVerified;
  f.node('CaptchaVerificationSheet').props.onClose(); staleVerify('fixture-stale'); await tick();
  assert.equal(count(f, 'recommend'), 0);
  f.screen.press('setup-recommend');
  const verify = f.node('CaptchaVerificationSheet').props.onVerified; verify('fixture-token'); verify('fixture-token'); await tick();
  assert.equal(count(f, 'recommend'), 1);
  const c = f.calls.find(c => c[0] === 'recommend'); assert.equal(c[2].captchaToken, 'fixture-token'); assert.equal(c[1].destination.label, D.label);
});
test('USETUP auth loading and recommendation failure preserve input and allow one explicit retry', async () => {
  const f = fixture({ authLoading: true, run: async () => { throw Error('fixture failure'); } }); await tick(); f.choose('origin', O);
  f.screen.press('setup-recommend'); assert.equal(count(f, 'recommend'), 0); assert.match(JSON.stringify(f.screen.get('setup-input-error')), /계정 상태/);
  f.auth.isLoading = false;
  const press = f.screen.get('setup-recommend').props.onPress; press(); press(); await tick();
  assert.equal(count(f, 'recommend'), 1); assert.match(JSON.stringify(f.screen.get('route-origin-field')), /수동 출발지/);
  f.setRun(null); f.screen.press('setup-recommend'); await tick(); assert.equal(count(f, 'recommend'), 2);
});

test('USETUP actual CAPTCHA WebView failure blocks late bridge, retry succeeds once; anonymous proxy session bypass is preserved', async () => {
  const f = fixture({ proxy: true, realCaptcha: true }); await tick(); f.choose('origin', O); f.screen.press('setup-recommend');
  const web = f.screen.get('captcha-webview'); web.props.onError();
  web.props.onMessage({ nativeEvent: { url: 'https://example.test/', data: JSON.stringify({ type: 'token', token: 'fixture-late' }) } });
  assert.ok(f.screen.get('captcha-error')); assert.equal(count(f, 'recommend'), 0);
  assert.equal(f.screen.get('setup-recommend').props.disabled, true);
  f.screen.press('captcha-retry');
  const onMessage = f.screen.get('captcha-webview').props.onMessage;
  onMessage({ nativeEvent: { url: 'https://example.test/', data: JSON.stringify({ type: 'token', token: 'fixture-ok' }) } });
  await tick(); assert.equal(count(f, 'recommend'), 1);
  const anonymous = fixture({ proxy: true, auth: { user: { is_anonymous: true } } }); await tick(); anonymous.choose('origin', O); anonymous.screen.press('setup-recommend'); await tick();
  assert.equal(count(anonymous, 'recommend'), 1); assert.equal(anonymous.calls.find(c => c[0] === 'recommend')[2].routeProxyEnabled, true);
});

test('USETUP production hides dev tools, internal test-clock restore is silent and all 8 launcher entries remain actionable', async () => {
  const prod = fixture(); await tick(); assert.equal(prod.screen.nodes(n => ['dev-test-clock', 'qa-release-one-stop-launcher'].includes(n.props.testID)).length, 0);
  const f = fixture({ internal: true }); await tick(); f.choose('origin', O);
  f.screen.press('dev-test-clock');
  const apply = f.screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('테스트 시각 적용'))[0]; apply.props.onPress();
  assert.equal(count(f, 'haptic'), 0); assert.ok(f.screen.get('route-origin-field'));
  f.screen.press('dev-test-clock');
  f.screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('실제 현재 시각으로 복원'))[0].props.onPress();
  assert.equal(count(f, 'haptic'), 0);
  f.screen.press('qa-release-one-stop-launcher');
  const scenarios = f.screen.nodes(n => n.props.testID?.startsWith('qa-scenario-')).map(n => n.props.testID);
  assert.equal(scenarios.length, 8);
  for (const id of scenarios) { f.screen.press(id); await tick(); }
  assert.equal(count(f, 'recommend'), 8);
});

const flattenStyle = style => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
// Deterministic intrinsic-height budget from rendered production styles. Not a Yoga/native claim.
function intrinsic(node, fontScale = 1) {
  if (node == null || typeof node === 'boolean') return 0;
  if (Array.isArray(node)) return node.reduce((sum, n) => sum + intrinsic(n, fontScale), 0);
  if (typeof node !== 'object') return 0;
  const s = flattenStyle(node.props.style);
  if (s.position === 'absolute') return 0;
  if (s.height != null) return s.height;
  if (node.type === 'Text') return (s.lineHeight ?? (s.fontSize ?? 14) * 1.3) * fontScale;
  const children = [node.props.children].flat(Infinity).filter(n => n && typeof n === 'object');
  const heights = children.map(n => intrinsic(n, fontScale));
  const content = s.flexDirection === 'row' ? Math.max(0, ...heights) : heights.reduce((a, b) => a + b, 0) + (s.gap ?? 0) * Math.max(0, heights.length - 1);
  return Math.max(s.minHeight ?? 0, content + (s.paddingTop ?? s.paddingVertical ?? 0) + (s.paddingBottom ?? s.paddingVertical ?? 0)) + (s.marginTop ?? 0) + (s.marginBottom ?? 0);
}
for (const [width, height] of [[375, 812], [390, 844], [402, 874]]) test(`USETUP general ${width}×${height} non-scroll layout budget, measured footer and picker keyboard isolation`, async t => {
  const f = fixture({ width, height }); await tick();
  const footer = intrinsic(f.screen.get('setup-footer'));
  const content = intrinsic(f.screen.get('setup-general-inputs'));
  const viewport = height - 59 - footer;
  t.diagnostic(`production style budget: content=${content.toFixed(1)}, viewport=${viewport}, footer=${footer}, safeTop=59, safeBottom=34; native measurement pending`);
  assert.ok(content <= viewport, `${content} <= ${viewport}`);
  assert.ok(flattenStyle(f.screen.get('route-origin-field').props.style).minHeight >= 44);
  assert.ok(flattenStyle(f.screen.get('setup-recommend').props.style).minHeight >= 48);
  f.screen.get('setup-footer').props.onLayout({ nativeEvent: { layout: { height: footer } } });
  f.screen.get('setup-scroll').props.onLayout({ nativeEvent: { layout: { height: viewport } } });
  f.screen.get('setup-scroll').props.onContentSizeChange(width, content);
  assert.equal(f.screen.get('setup-scroll').props.scrollEnabled, false);
  f.screen.press('route-origin-field'); assert.equal(f.node('PlacePicker').props.visible, true);
  assert.equal(f.screen.get('setup-recommend').props.disabled, true);
  assert.equal(JSON.stringify(f.screen.get('setup-scroll')).includes('setup-footer'), false);
});
test('USETUP general region uses the whole viewport independently of developer tools; internal tools extend below it', async () => {
  for (const height of [812, 844, 874]) {
    const prod = fixture({ height }), internal = fixture({ height, internal: true }); await tick();
    const viewport = height - 59 - 94;
    for (const f of [prod, internal]) {
      f.screen.get('setup-scroll').props.onLayout({ nativeEvent: { layout: { height: viewport } } });
      const style = flattenStyle(f.screen.get('setup-general-inputs').props.style);
      assert.equal(style.minHeight, viewport);
      assert.equal(style.justifyContent, 'space-between');
    }
    assert.equal(JSON.stringify(prod.screen.get('setup-general-inputs')), JSON.stringify(internal.screen.get('setup-general-inputs')));
    assert.equal(prod.screen.nodes(n => n.props.testID === 'setup-development-tools').length, 0);
    const toolsHeight = intrinsic(internal.screen.get('setup-development-tools'));
    assert.ok(toolsHeight >= 88);
    internal.screen.get('setup-scroll').props.onContentSizeChange(375, viewport + toolsHeight);
    assert.equal(internal.screen.get('setup-scroll').props.scrollEnabled, true);
    prod.screen.get('setup-scroll').props.onContentSizeChange(375, viewport);
    assert.equal(prod.screen.get('setup-scroll').props.scrollEnabled, false);
  }
});
test('USETUP small screen/large type and keyboard-sized viewport overflow without clipping footer or shrinking fields', async () => {
  const f = fixture({ width: 320, height: 568, fontScale: 2 }); await tick();
  f.choose('origin', { ...O, label: '매우 긴 출발지 이름 '.repeat(8) });
  assert.equal(findChild(f.screen.get('route-origin-field'), n => n.type === 'Text' && n.props.style?.flex === 1).props.numberOfLines, undefined);
  const content = intrinsic(f.screen.get('setup-general-inputs'), 2) + 8;
  f.screen.get('setup-scroll').props.onLayout({ nativeEvent: { layout: { height: 200 } } });
  f.screen.get('setup-scroll').props.onContentSizeChange(320, content);
  assert.equal(f.screen.get('setup-scroll').props.scrollEnabled, true); assert.ok(f.screen.get('setup-footer'));
  const root = f.screen.nodes(n => n.props.accessibilityLabel === '도착 시각 시')[0];
  assert.ok(flattenStyle(root.props.style).height >= 4 * 56);
});
