import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';

// Deleted legacy reader is not restored; current route/cache and active preservation remain.
for (const missingGeometry of [false, true]) test(`QA ODsay current route geometry missing=${missingGeometry}`, async t => {
  const http = [], keyReads = [], writes = [];
  t.mock.method(globalThis, 'fetch', async url => { http.push(String(url)); throw Error('network forbidden'); });
  const env = new Proxy({ EXPO_PUBLIC_ODSAY_API_KEY: 'fixture-not-a-key', ODSAY_API_KEY: 'fixture-not-a-key' }, { get(target, key) { if (String(key).includes('ODSAY')) keyReads.push(key); return target[key]; } });
  const origin = { lat: 35.1, lon: 129.1 }, spot = { contentId: 'A', title: '과거 장소', lat: 35.13, lon: 129.13 };
  const host = screenRuntime({ __process: { env },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { async getItem() { return null; }, async setItem() { writes.push('cache'); } } },
    './routeBaselineService': { createRouteBaselineService: () => ({}) }, '../services/placeNameSemanticMatch': {} });
  const travel = host.load('src/engine/travel.ts');
  await travel.precomputeTransit([[origin, spot]], { retryFallback: true });
  assert.equal(travel.travelMin(origin, spot, 'transit'), Infinity);
  assert.equal(travel.travelGeo(origin, spot, 'transit'), undefined);

  const snapshot = course(['A']);
  snapshot.legs.forEach((l, i) => { l.mode = 'transit'; if (!missingGeometry) l.geometry = { paths: [{ points: i === 0 ? [origin, spot] : [spot, session.destination] }] }; });
  const f = confirmFixture(snapshot, { __process: { env }, './courseCompletionComposition': { courseCompletionRepository: { async complete() { writes.push('complete'); return { status: 'storage_unavailable' }; } } } });
  try {
    const original = { identity: 'previous', courseRunId: 'previous-run', session, course: course(['B']), progress: { stepIndex: 1, routeOpened: false, finished: false } };
    f.flow.activeVerifiedCourse = original;
    const start = f.screen.nodes(n => n.props.testID === 'verified-course-start')[0];
    {
      assert.ok(start);
      let buttons; f.native.Alert.alert = (_title, _copy, b) => { buttons = b; };
      start.props.onPress(); await settle(); buttons.find(b => b.style === 'cancel').onPress?.();
    }
    assert.equal(f.flow.activeVerifiedCourse, original);
    assert.deepEqual(writes, []); assert.deepEqual(keyReads, []); assert.deepEqual(http, []);
  } finally { f.screen.unmount(); }
});
