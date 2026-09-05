import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import 'tsx/cjs';
import { createRequire } from 'node:module';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
const { createLocationSearchDraft, locationCandidateId, selectedRowScrollOffset } = require('../../src/ui/locationSearchDraft.ts');

const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const place = { kind: 'place', provider: 'kakao', label: '사상역', address: '부산 사상구', lat: 35.16, lon: 128.98, providerLineLabels: ['부산2호선'] };
const response = (suggestions = [place]) => ({ suggestions, attempts: [{ status: 'ok' }], diagnostics: { cache: 'miss', fallbackCount: 0, providerRequests: {} } });
let network;
beforeEach(t => { network = 0; t.mock.method(globalThis, 'fetch', async () => { network++; throw Error('network forbidden'); }); });
afterEach(() => assert.equal(network, 0));
function fixture(options = {}) {
  const calls = [], keyboard = new Map();
  const overrides = {
    __DEV__: false,
    '../services/kakaoLocationLabelAdapter': { createKakaoLocationLabelAdapter: () => ({ async resolve(point, purpose) { calls.push(['label', purpose]); return options.label ? options.label() : { source: 'address', address: '부산광역시 사상구 사상로 201' }; } }) },
    '../services/kakaoLocationSearchAdapter': { createKakaoLocationSearchAdapter: () => ({ async search(query) { calls.push(['search', query]); return options.search ? options.search(query) : response(); } }) },
    'expo-location': { async requestForegroundPermissionsAsync() { calls.push(['permission']); return { status: options.permission ?? 'granted' }; }, async getCurrentPositionAsync() { calls.push(['gps']); return options.gps ? options.gps() : { coords: { latitude: 35.1, longitude: 129.1 } }; } },
  };
  const host = screenRuntime(overrides);
  overrides['react-native'] = { ...host.native, useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }), Modal: 'Modal', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' }, Keyboard: { scheduleLayoutAnimation(event) { calls.push(['keyboard-animation', event]); }, dismiss() { calls.push(['dismiss']); }, addListener(name, fn) { keyboard.set(name, fn); return { remove() { keyboard.delete(name); } }; } } };
  const props = { visible: true, title: '출발지 선택', center: { lat: 35.1, lon: 129.1 }, onOpenMap() { calls.push(['map']); }, onClose() { calls.push(['close']); }, onConfirm(p) { calls.push(['confirm', p]); } };
  const screen = host.mount(host.load('src/ui/PlacePicker.tsx').PlacePicker, props);
  const edit = q => { screen.get('location-search-input').props.onChangeText(q); screen.render(); };
  const submit = () => screen.get('location-search-input').props.onSubmitEditing();
  return { screen, props, calls, keyboard, edit, submit };
}
const count = (f, name) => f.calls.filter(c => c[0] === name).length;
test('ULOC latest failure-first: will-frame owns keyboard+footer together; did events produce no second correction', async () => {
  const f = fixture(); f.edit('사상역'); f.submit(); await tick(); f.screen.press('location-suggestion-0');
  const event = { duration: 237, easing: 'keyboard', endCoordinates: { screenY: 544, height: 300 } };
  assert.ok(f.keyboard.has('keyboardWillChangeFrame'));
  f.keyboard.get('keyboardWillChangeFrame')(event);
  assert.equal(style(f.screen.get('location-keyboard-layout').props.style).paddingBottom, 300);
  assert.equal(style(f.screen.get('location-footer').props.style).paddingBottom, 8);
  assert.deepEqual(f.calls.find(c => c[0] === 'keyboard-animation')[1], event);
  const before = JSON.stringify(f.screen.get('location-keyboard-layout'));
  f.keyboard.get('keyboardDidShow')?.(event);
  assert.equal(JSON.stringify(f.screen.get('location-keyboard-layout')), before);
  assert.equal(f.screen.nodes(n => n.type === 'KeyboardAvoidingView').length, 0);
  f.screen.unmount();
});
test('ULOC latest failure-first: only name/address/state, separators between rows, no terminal separator', async () => {
  const named = { ...place, label: '사상역 부산2호선' };
  const f = fixture({ search: async () => response([named, { ...place, label: '두 번째 장소' }]) });
  f.edit('사상역'); f.submit(); await tick(); f.screen.press('location-suggestion-0');
  const row = f.screen.get('location-suggestion-0');
  assert.deepEqual(row.props.children.filter(n => n?.type === 'Text').map(n => n.props.children), [named.label, named.address, '선택됨']);
  assert.equal(row.props.accessibilityLabel.split('부산2호선').length - 1, 1);
  assert.ok(f.screen.get('location-separator-0'));
  assert.equal(style(f.screen.get('location-separator-0').props.style).height, 1);
  assert.ok(style(row.props.style).minHeight >= 44);
  assert.equal(row.props.accessibilityState.selected, true);
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-separator-1').length, 0); f.screen.unmount();
});
test('ULOC latest keyboard rapid show/hide, interactive frame, duplicate and late completion events keep one owner', async () => {
  const f = fixture(); f.edit('사상역'); f.submit(); await tick(); f.screen.press('location-suggestion-0');
  const event = (y, duration = 187) => ({ duration, easing: 'easeInEaseOut', endCoordinates: { screenY: y, height: 844 - y } });
  const frame = f.keyboard.get('keyboardWillChangeFrame');
  frame(event(500)); f.keyboard.get('keyboardWillShow')(event(500));
  assert.equal(count(f, 'keyboard-animation'), 1);
  f.keyboard.get('keyboardWillHide')(event(844));
  frame(event(544)); // rapid refocus before the old didHide
  f.keyboard.get('keyboardDidHide')?.(event(844));
  assert.equal(style(f.screen.get('location-keyboard-layout').props.style).paddingBottom, 300);
  frame(event(700, 0)); // interactive dismissal, not a fixed duration animation
  assert.equal(style(f.screen.get('location-keyboard-layout').props.style).paddingBottom, 144);
  assert.equal(f.calls.filter(c => c[0] === 'keyboard-animation').at(-1)[1].duration, 0);
  frame(event(844, 0));
  assert.equal(style(f.screen.get('location-footer').props.style).paddingBottom, 16);
  const calls = count(f, 'keyboard-animation');
  f.keyboard.get('keyboardDidShow')?.(event(500)); f.keyboard.get('keyboardDidHide')?.(event(844));
  assert.equal(count(f, 'keyboard-animation'), calls);
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 1);
  f.props.visible = false; f.screen.render(); frame(event(500));
  assert.equal(style(f.screen.get('location-keyboard-layout').props.style).paddingBottom, 0);
  f.screen.unmount();
});
test('ULOC latest map loading/address failure directs back to search, preserving retry/coordinate confirm without any search button', async () => {
  const host = screenRuntime(); let backs = 0, confirms = 0;
  const screen = host.mount(host.load('src/ui/MapPlacePicker.tsx').MapPlacePicker, { visible: true, title: '출발지 선택', center: { lat: 35, lon: 129 }, labelAdapter: { resolve: async () => { throw Error('fixture'); } }, onClose() { backs++; }, onConfirm() { confirms++; } });
  const map = () => screen.nodes(n => n.type === 'KakaoRouteMap')[0];
  map().props.onMapError();
  assert.match(JSON.stringify(screen.render()), /뒤로가서 검색/);
  screen.press('map-retry'); map().props.onMapReady(); screen.press('map-confirm'); await tick();
  assert.match(JSON.stringify(screen.render()), /좌표로 선택하거나 뒤로가서 검색/);
  assert.equal(screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('검색')).length, 0);
  const confirm = screen.get('map-coordinate-confirm').props.onPress; confirm(); confirm(); assert.equal(confirms, 1);
  screen.nodes(n => n.props.accessibilityLabel === '뒤로가기')[0].props.onPress(); assert.equal(backs, 1); screen.unmount();
});
test('ULOC current-location road address populates input without provider search or implicit confirmation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); assert.match(JSON.stringify(f.screen.get('location-current')), /현위치/);
  f.screen.press('location-current'); await tick();
  assert.equal(f.screen.get('location-search-input').props.value, '부산광역시 사상구 사상로 201');
  t.mock.timers.tick(500); await tick(); f.submit(); await tick();
  assert.equal(count(f, 'label'), 1); assert.equal(count(f, 'search'), 0); assert.equal(count(f, 'confirm'), 0);
  f.screen.press('location-confirm'); assert.equal(f.calls.find(c => c[0] === 'confirm')[1].label, '부산광역시 사상구 사상로 201'); f.screen.unmount();
});
test('ULOC map header supplies opaque dark contrast independent of white map tiles', () => {
  const host = screenRuntime();
  const screen = host.mount(host.load('src/ui/MapPlacePicker.tsx').MapPlacePicker, { visible: true, title: '출발지 선택', center: { lat: 35, lon: 129 }, labelAdapter: { resolve: async () => ({ source: 'unresolved' }) }, onClose() {}, onConfirm() {} });
  const header = screen.get('map-picker-header');
  assert.equal(style(header.props.style).backgroundColor, undefined);
  assert.equal(style(screen.get('map-picker-title').props.style).backgroundColor, '#1f2023');
  assert.equal(header.props.children.filter(n => n.type === 'Pressable').length, 1);
  assert.equal(screen.nodes(n => n.props.testID === 'map-search-alternative').length, 0);
  screen.unmount();
});
test('ULOC late current-location address never replaces edited input; address failure retains coordinate confirmation', async () => {
  let finish;
  const f = fixture({ label: () => new Promise(r => { finish = r; }) });
  f.screen.press('location-current'); await tick(); f.edit('부산역');
  finish({ source: 'address', address: '늦은 도로명 주소' }); await tick();
  assert.equal(f.screen.get('location-search-input').props.value, '부산역');
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0); f.screen.unmount();
  const failed = fixture({ label: async () => { throw Error('fixture'); } });
  failed.screen.press('location-current'); await tick();
  assert.equal(failed.screen.get('location-search-input').props.value, '현위치');
  failed.screen.press('location-confirm'); assert.equal(failed.calls.find(c => c[0] === 'confirm')[1].source, 'device'); failed.screen.unmount();
});

test('ULOC failure-first: selection dismisses keyboard; same-query submit keeps selection and calls provider once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); f.edit('사상역'); t.mock.timers.tick(400); await tick();
  assert.equal(count(f, 'search'), 1); assert.equal(count(f, 'dismiss'), 0);
  f.screen.press('location-suggestion-0');
  assert.equal(count(f, 'dismiss'), 1); assert.equal(count(f, 'confirm'), 0);
  await f.submit(); assert.equal(count(f, 'search'), 1);
  const confirm = f.screen.get('location-confirm').props.onPress; confirm(); confirm();
  assert.equal(count(f, 'confirm'), 1); f.screen.unmount();
});
test('ULOC failure-first: unselected CTA is absent and horizontal map action stays present while searching', async () => {
  const f = fixture();
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0);
  f.edit('사상역'); await f.submit();
  assert.ok(f.screen.get('location-map')); assert.ok(f.screen.get('location-current'));
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0);
  f.screen.unmount();
});

test('ULOC 2-char/400ms debounce, explicit submit cancels duplicate auto, focus preserves selection, real edits clear it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); f.edit('사'); t.mock.timers.tick(500); await tick(); assert.equal(count(f, 'search'), 0);
  f.edit('사상'); t.mock.timers.tick(399); await tick(); assert.equal(count(f, 'search'), 0);
  f.screen.press('location-search-submit'); await tick(); f.screen.press('location-suggestion-0');
  t.mock.timers.tick(500); await tick(); assert.equal(count(f, 'search'), 1);
  f.screen.get('location-search-input').props.onFocus?.(); await f.submit(); await tick();
  assert.equal(f.screen.get('location-suggestion-0').props.accessibilityState.selected, true);
  f.edit('사상'); assert.ok(f.screen.get('location-confirm'));
  f.edit('부산'); assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0);
  assert.equal(count(f, 'confirm'), 0); f.screen.unmount();
});

test('ULOC in-flight duplicate0 and rapid query ignores old results without auto-selecting new array index', async () => {
  const resolves = new Map();
  const f = fixture({ search: q => new Promise(r => resolves.set(q, r)) });
  f.edit('사상'); f.submit(); f.submit(); f.screen.press('location-search-submit');
  assert.equal(count(f, 'search'), 1);
  f.edit('부산'); f.submit(); assert.equal(count(f, 'search'), 2);
  resolves.get('부산')(response([{ ...place, label: '부산역' }])); await tick();
  f.screen.press('location-suggestion-0');
  resolves.get('사상')(response()); await tick();
  assert.match(JSON.stringify(f.screen.get('location-confirm')), /부산역/);
  assert.equal(count(f, 'confirm'), 0); f.screen.unmount();
});
for (const failure of ['throw', 'response']) test(`ULOC ${failure} failure permits explicit same-query retry, not automatic repeat`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let attempts = 0;
  const f = fixture({ search: async () => { if (++attempts > 1) return response(); if (failure === 'throw') throw Error('fixture'); return { ...response([]), attempts: [{ status: 'network_error' }] }; } });
  f.edit('사상역'); t.mock.timers.tick(400); await tick();
  t.mock.timers.tick(800); await tick(); assert.equal(count(f, 'search'), 1);
  f.submit(); f.submit(); await tick(); assert.equal(count(f, 'search'), 2);
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0);
  f.screen.press('location-suggestion-0'); assert.ok(f.screen.get('location-confirm')); f.screen.unmount();
});
test('ULOC empty success does not repeat; close and target changes discard query/results and late response', async () => {
  let finish;
  const f = fixture({ search: () => new Promise(r => { finish = r; }) }); f.edit('사상역'); f.submit();
  f.screen.press('location-close'); f.props.visible = false; f.screen.render();
  f.props.visible = true; f.props.title = '도착지 선택'; f.screen.render();
  finish(response()); await tick();
  assert.equal(f.screen.get('location-search-input').props.value, '');
  assert.equal(f.screen.nodes(n => n.props.testID?.startsWith('location-suggestion')).length, 0);
  f.edit('없음'); f.submit(); finish(response([])); await tick(); f.submit(); await tick();
  assert.equal(count(f, 'search'), 2); assert.equal(count(f, 'confirm'), 0); f.screen.unmount();
});

test('ULOC GPS success is selected draft only; keyboard closes and explicit confirmation is once', async () => {
  const f = fixture(); f.screen.press('location-current'); await tick();
  assert.equal(count(f, 'dismiss'), 1); assert.equal(count(f, 'gps'), 1); assert.equal(count(f, 'confirm'), 0);
  assert.equal(f.screen.nodes(n => n.props.testID === 'device-location-selection').length, 0);
  assert.equal(f.screen.get('location-search-input').props.value, '부산광역시 사상구 사상로 201');
  const confirm = f.screen.get('location-confirm').props.onPress; confirm(); confirm();
  assert.equal(count(f, 'confirm'), 1); assert.equal(f.calls.find(c => c[0] === 'confirm')[1].source, 'device'); f.screen.unmount();
});
for (const type of ['denied', 'failed']) test(`ULOC GPS ${type} keeps equal-width search/map alternatives`, async () => {
  const f = fixture({ permission: type === 'denied' ? 'denied' : 'granted', gps: async () => { throw Error('GPS'); } });
  f.screen.press('location-current'); await tick(); assert.equal(count(f, 'gps'), type === 'denied' ? 0 : 1);
  assert.ok(f.screen.get('location-map')); assert.ok(f.screen.get('location-search-input'));
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 0); f.screen.unmount();
});
for (const action of ['edit', 'map', 'target', 'search']) test(`ULOC GPS pending then ${action} invalidates late coordinate`, async () => {
  let finish;
  const f = fixture({ gps: () => new Promise(r => { finish = r; }) });
  f.edit('사상역'); f.submit(); await tick();
  f.screen.press('location-current'); await tick();
  if (action === 'edit') f.edit('부산역');
  if (action === 'map') f.screen.press('location-map');
  if (action === 'target') { f.props.title = '도착지 선택'; f.screen.render(); }
  if (action === 'search') f.submit();
  finish({ coords: { latitude: 1, longitude: 2 } }); await tick();
  assert.equal(f.screen.nodes(n => n.props.testID === 'device-location-selection').length, 0);
  assert.equal(count(f, 'confirm'), 0); f.screen.unmount();
});

const style = v => Object.assign({}, ...[v].flat(Infinity).filter(Boolean));
test('ULOC selection×keyboard four states have one/no footer; measured row needs only minimal scroll, large text is not clipped', async () => {
  const f = fixture(); const scrolls = [];
  f.screen.get('location-results').props.ref.current = { scrollTo: p => scrolls.push(p.y) };
  const setViewport = height => f.screen.get('location-results').props.onLayout({ nativeEvent: { layout: { height } } });
  const keyboardEvent = { duration: 200, easing: 'keyboard', endCoordinates: { screenY: 544, height: 300 } };
  for (const event of ['keyboardWillShow', 'keyboardWillHide']) { f.keyboard.get(event)(keyboardEvent); assert.equal(f.screen.nodes(n => n.props.testID === 'location-footer').length, 0); }
  f.edit('사상역'); f.submit(); await tick(); setViewport(600);
  f.screen.get('location-suggestion-0').props.onLayout({ nativeEvent: { layout: { y: 400, height: 100 } } });
  scrolls.length = 0; f.screen.press('location-suggestion-0'); assert.deepEqual(scrolls, []);
  assert.equal(style(f.screen.get('location-footer').props.style).paddingBottom, 16);
  f.keyboard.get('keyboardWillShow')(keyboardEvent); setViewport(250);
  assert.equal(style(f.screen.get('location-footer').props.style).paddingBottom, 8);
  assert.deepEqual(scrolls, [250]); setViewport(250); assert.deepEqual(scrolls, [250]);
  f.keyboard.get('keyboardWillHide')(keyboardEvent); setViewport(600); assert.deepEqual(scrolls, [250]);
  assert.equal(f.screen.nodes(n => n.props.testID === 'location-confirm').length, 1);
  assert.equal(f.screen.get('location-keyboard-layout').type, 'View');
  assert.equal(style(f.screen.get('location-keyboard-layout').props.style).paddingBottom, 0);
  assert.equal(f.screen.get('location-results').props.automaticallyAdjustKeyboardInsets, false);
  assert.equal(style(f.screen.get('location-alternatives').props.style).flexDirection, 'row');
  for (const id of ['location-current', 'location-map']) { assert.equal(style(f.screen.get(id).props.style).flex, 1); assert.ok(style(f.screen.get(id).props.style).minHeight >= 44); }
  assert.match(f.screen.get('location-suggestion-0').props.accessibilityLabel, /사상역.*선택됨/);
  assert.equal(JSON.stringify(f.screen.get('location-suggestion-0')).includes('numberOfLines'), false);
  assert.equal(selectedRowScrollOffset(100, 50, { y: 400, height: 150 }), 400);
  f.screen.unmount();
});

test('ULOC production draft identity, map pause/resume, scroll retention and stale confirm epoch', () => {
  const d = createLocationSearchDraft(); d.start('origin'); d.changeQuery('사상역');
  const r = d.beginSearch(true); d.resolveSearch(r, response()); d.select(locationCandidateId(place)); d.rememberScroll(280);
  const epoch = d.get().epoch; d.pause(); d.rememberScroll(0); assert.equal(d.get().scrollY, 280);
  d.resume(); assert.equal(d.choice().label, place.label); assert.equal(d.get().query, '사상역');
  d.start('destination'); assert.equal(d.choice(), null); assert.equal(d.get().scrollY, 0); assert.equal(d.resolveSearch(r, response()), false);
  d.changeQuery('사상역'); d.resolveSearch(d.beginSearch(true), response()); d.select(locationCandidateId(place));
  assert.equal(d.claimConfirmation(epoch), null); assert.equal(d.claimConfirmation().label, '사상역'); assert.equal(d.claimConfirmation(), null);
});
