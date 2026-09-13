import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';

// Retired Execution UI is not restored. Read legacy records through the preserved repository.
for (const missingGeometry of [false, true]) test(`QA ODsay preserved reader/current route geometry missing=${missingGeometry}`, async t => {
  const http = [], keyReads = [], writes = [];
  t.mock.method(globalThis, 'fetch', async url => { http.push(String(url)); throw Error('network forbidden'); });
  const env = new Proxy({ EXPO_PUBLIC_ODSAY_API_KEY: 'fixture-not-a-key', ODSAY_API_KEY: 'fixture-not-a-key' }, { get(target, key) { if (String(key).includes('ODSAY')) keyReads.push(key); return target[key]; } });
  const origin = { lat: 35.1, lon: 129.1 }, spot = { contentId: 'A', title: '과거 장소', lat: 35.13, lon: 129.13 };
  const legs = [{ label: '이동', mode: 'transit', min: 20, src: 'ODsay', ...(missingGeometry ? {} : { geo: [origin, spot] }) }, { label: '체류', min: 30 }, { label: '복귀', mode: 'transit', min: 20, src: 'ODsay', ...(missingGeometry ? {} : { geo: [spot, origin] }) }];
  const row = { id: 'old', status: 'saved', origin_lat: origin.lat, origin_lon: origin.lon, mode: 'transit', starts_at: session.nowIso, ends_at: '2026-09-05T08:00:00Z', created_at: session.nowIso,
    recommendation_snapshot: { course: { spots: [spot], legs, totalMin: 70 }, ctx: { startedAtIso: session.nowIso, startMin: 900, remainingMin: 120, mode: 'transit' } } };
  const before = JSON.stringify(row);
  const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'fixture' } } }) },
    from(table) { return { select() { return this; }, in() { return this; }, async order() { return { data: table === 'courses' ? [row] : [{ course_id: 'old', stop_order: 0, place_content_id: 'A', title: spot.title, lat: spot.lat, lon: spot.lon, planned_dwell_min: 30 }] }; } }; },
    async rpc() { writes.push('rpc'); throw Error('write forbidden'); } };
  const host = screenRuntime({ __process: { env }, './supabase': { supabase },
    '@react-native-async-storage/async-storage': { __esModule: true, default: { async getItem() { return null; }, async setItem() { writes.push('cache'); } } },
    './routeBaselineService': { createRouteBaselineService: () => ({}) }, '../services/placeNameSemanticMatch': {} });
  const saved = await host.load('src/services/courseRepository.ts').listSavedCoursesFromRepository();
  assert.equal(saved.length, 1); assert.deepEqual(saved[0].course.legs, legs); assert.equal(JSON.stringify(row), before);
  const travel = host.load('src/engine/travel.ts');
  await travel.precomputeTransit([[origin, spot]], { retryFallback: true });
  assert.equal(travel.travelMin(origin, spot, 'transit'), Infinity);
  assert.equal(travel.travelGeo(origin, spot, 'transit'), undefined);

  const snapshot = course(['A']);
  snapshot.legs.forEach(l => { l.mode = 'transit'; });
  const f = confirmFixture(snapshot, { __process: { env }, '../services/courseRepository': {
    saveCourseToRepository() { writes.push('save'); }, replaceCoursePlanInRepository() { writes.push('replace'); },
  } });
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
