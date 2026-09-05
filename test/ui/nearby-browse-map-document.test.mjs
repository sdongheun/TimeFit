import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

function productionDocument() {
  const runtime = screenRuntime({
    __process: { env: { EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture-key' } },
    'react-native-webview': { WebView: 'WebView' },
    './theme': { C: { panel2: '#222', txt: '#fff', muted: '#999' } },
  });
  return runtime.load('src/ui/NearbyBrowseMap.tsx').buildNearbyBrowseMapDocument({ lat: 35.1, lon: 129.1 });
}

function inlineScript(html) {
  const match = html.match(/<script>([\s\S]*)<\/script><\/body><\/html>$/);
  assert.ok(match, 'generated WebView inline script must exist');
  return match[1];
}

function executeDocument(options = {}) {
  const messages = [], overlays = [], boundsCalls = [];
  let mapCount = 0, imageRequests = 0;
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.dataset = {}; this.style = {}; this.attributes = {}; this.listeners = {}; this.className = ''; this.textContent = ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    removeChild(child) { this.children = this.children.filter(value => value !== child); child.parentNode = null; }
    addEventListener(name, fn, config = {}) { (this.listeners[name] ??= []).push({ fn, once: Boolean(config.once) }); }
    emit(name) { const active = [...(this.listeners[name] ?? [])]; active.forEach(listener => listener.fn()); this.listeners[name] = (this.listeners[name] ?? []).filter(listener => !listener.once); }
    get classList() { return { add: value => { if (!this.className.split(' ').includes(value)) this.className += ` ${value}`; } }; }
    set src(value) { this._src = value; imageRequests++; }
    get src() { return this._src; }
  }
  class LatLng { constructor(lat, lon) { this.lat = lat; this.lon = lon; } }
  class LatLngBounds { constructor() { this.points = []; } extend(point) { this.points.push(point); } }
  class MapFixture {
    constructor(element, config) { if (options.initThrows) throw Error('fixture init'); mapCount++; this.element = element; this.config = config; this.level = 6; }
    getProjection() { if (options.runtimeThrows) throw Error('fixture runtime'); return { pointFromCoords: point => ({ x: point.lon * 1000, y: point.lat * 1000 }) }; }
    setBounds(...args) { boundsCalls.push(args); }
    getLevel() { return this.level; }
  }
  class CustomOverlay { constructor(config) { this.config = config; overlays.push(this); } setMap(value) { this.map = value; } }
  const kakao = options.sdkMissing ? undefined : { maps: {
    LatLng, LatLngBounds, Map: MapFixture, CustomOverlay,
    load(callback) { if (options.loadThrows) throw Error('fixture load'); callback(); },
    event: { addListener(target, name, callback) { target.listeners ??= {}; target.listeners[name] = callback; } },
  } };
  const mapNode = new Element('div');
  const document = { createElement: tag => new Element(tag), getElementById: id => id === 'map' ? mapNode : null };
  const window = { kakao, __nearbySdkFailed: Boolean(options.sdkLoadFailed), ReactNativeWebView: { postMessage(raw) { messages.push(JSON.parse(raw)); } } };
  const context = vm.createContext({ window, kakao, document, Math, JSON, Number, String, Array, Object });
  new vm.Script(inlineScript(productionDocument()), { filename: 'nearby-webview-inline.js' }).runInContext(context);
  return { window, context, messages, overlays, boundsCalls, get mapCount() { return mapCount; }, get imageRequests() { return imageRequests; } };
}

test('UNEAR map return failure-first: actual generated inline script parses before WebView init', () => {
  const script = inlineScript(productionDocument());
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'nearby-webview-inline.js' }));
  assert.match(script, /\^https:\\\/\\\//);
});

test('UNEAR generated script executes SDK load, creates one map, posts ready, and renders safe default/photo markers', () => {
  const run = executeDocument();
  assert.equal(run.mapCount, 1);
  assert.deepEqual(run.messages, [{ action: 'ready' }]);
  const special = { id: `id'"\\\n</script>`, title: `이름'"\\\n</script><img>`, lat: 35.1, lon: 129.1, imageUrl: null };
  const photo = { id: 'photo', title: '사진 장소', lat: 35.2, lon: 129.2, imageUrl: `https://example.invalid/a'"\\\n</script>.jpg` };
  const payload = { center: { lat: 35.1, lon: 129.1 }, selectedId: null, bottomInset: 196, places: [special, photo] };
  new vm.Script(`window.renderNearby(${JSON.stringify(payload)});true;`).runInContext(run.context);
  assert.equal(run.overlays.length, 2);
  const defaultButton = run.overlays[0].config.content.children[0];
  const photoButton = run.overlays[1].config.content.children[0];
  assert.match(defaultButton.className, /fallback/);
  assert.equal(defaultButton.attributes['aria-label'], special.title);
  assert.equal(defaultButton.children.length, 0);
  assert.equal(photoButton.children.length, 1);
  assert.equal(photoButton.children[0].src, photo.imageUrl);
  assert.equal(run.imageRequests, 1);
  defaultButton.emit('click');
  assert.deepEqual(run.messages.at(-1), { action: 'select', id: special.id });
  const failedImage = photoButton.children[0];
  failedImage.emit('error'); failedImage.emit('error');
  assert.match(photoButton.className, /fallback/);
  assert.equal(photoButton.children.length, 0);
  assert.equal(run.imageRequests, 1);
});

test('UNEAR generated script clusters same coordinates and keeps every member ID accessible', () => {
  const run = executeDocument();
  const places = [
    { id: 'same-a', title: 'A', lat: 35.1, lon: 129.1, imageUrl: null },
    { id: 'same-b', title: 'B', lat: 35.1, lon: 129.1, imageUrl: null },
  ];
  run.window.renderNearby({ center: { lat: 35.1, lon: 129.1 }, selectedId: null, bottomInset: 196, places });
  assert.equal(run.overlays.length, 1);
  const cluster = run.overlays[0].config.content;
  assert.equal(cluster.textContent, '2');
  cluster.emit('click');
  assert.deepEqual(run.messages.at(-1), { action: 'cluster', ids: ['same-a', 'same-b'] });
});

for (const [name, options, reason] of [
  ['external SDK load failure', { sdkLoadFailed: true }, 'sdk_load'],
  ['missing SDK global', { sdkMissing: true }, 'sdk_unavailable'],
  ['SDK initialization exception', { initThrows: true }, 'sdk_init'],
  ['render runtime exception', { runtimeThrows: true }, 'runtime'],
]) test(`UNEAR generated script reports typed ${name}`, () => {
  const run = executeDocument(options);
  if (reason === 'runtime') run.window.renderNearby({ center: { lat: 35.1, lon: 129.1 }, selectedId: null, bottomInset: 0, places: [{ id: 'a', title: 'A', lat: 35.1, lon: 129.1, imageUrl: null }] });
  assert.deepEqual(run.messages.at(-1), { action: 'error', reason });
});

test('UNEAR retry document creates exactly one fresh map and ready bridge per execution', () => {
  const first = executeDocument(), retry = executeDocument();
  assert.equal(first.mapCount, 1); assert.equal(retry.mapCount, 1);
  assert.equal(first.messages.filter(message => message.action === 'ready').length, 1);
  assert.equal(retry.messages.filter(message => message.action === 'ready').length, 1);
});

test('UNEAR ready clears stale timeout and retry remount waits for a fresh ready message', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const runtime = screenRuntime({
    __DEV__: false,
    __process: { env: { EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture-key' } },
    'react-native-webview': { WebView: 'WebView' },
    './theme': { C: { panel2: '#222', txt: '#fff', muted: '#999' } },
  });
  const props = { center: { lat: 35.1, lon: 129.1 }, places: [], selectedId: null, bottomInset: 196, retryKey: 0, onSelect() {}, onCluster() {}, onReady() { calls.push('ready'); }, onError() { calls.push('error'); } };
  const screen = runtime.mount(runtime.load('src/ui/NearbyBrowseMap.tsx').NearbyBrowseMap, props);
  const webview = () => screen.nodes(node => node.type === 'WebView')[0];
  webview().props.onMessage({ nativeEvent: { data: '{"action":"ready"}' } }); screen.render();
  t.mock.timers.tick(8000);
  assert.deepEqual(calls, ['ready']);
  props.retryKey = 1; screen.render();
  assert.equal(webview().key, 1);
  webview().props.onMessage({ nativeEvent: { data: '{"action":"ready"}' } }); screen.render();
  t.mock.timers.tick(8000);
  assert.deepEqual(calls, ['ready', 'ready']);
  screen.unmount();
});
