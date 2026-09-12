import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);

for (const minutes of [120, 180]) for (const stopCount of [1, 2]) test(`URELEASE180 ${minutes} minutes/${stopCount} stops: restored snapshot → native payload and dated notification`, async () => {
  const start = new Date(2026, 11, 31, 23, 59).getTime(), unit = 60000;
  const values = new Map(), payloads = [], notices = [];
  const storage = { async getItem(k) { return values.get(k) ?? null; }, async setItem(k, v) { values.set(k, v); }, async removeItem(k) { values.delete(k); } };
  const overrides = {
    '@react-native-async-storage/async-storage': storage,
    'expo-notifications': { SchedulableTriggerInputTypes: { DATE: 'date' }, async getPermissionsAsync() { return { granted: true }; }, async setNotificationCategoryAsync() {}, async scheduleNotificationAsync(v) { notices.push(v); return `n${notices.length}`; }, async cancelScheduledNotificationAsync() {} },
    './lifecyclePolicy': { createLiveActivityLifecycleController: () => ({ async startCourseProgress(p) { payloads.push(p); return { status: 'started' }; } }) },
    './nativeLiveActivityPort': { nativeLiveActivityLifecyclePort: {}, nativeLiveProgressStoragePort: {} },
    './courseProgressRuntimeModel': { createLiveCourseProgressController: deps => deps },
    './liveActivityDiagnostics': { recordLiveActivityAppDiagnostic: async () => {} },
    './learningEvidenceComposition': { liveLearningEvidence: {} },
  };
  const runtime = screenRuntime(overrides);
  overrides['./courseProgressNotifications'] = runtime.load('src/ui/liveActivity/courseProgressNotifications.ts');
  const { buildLiveCoursePlan } = require('../../src/ui/liveActivity/courseProgressRuntimeModel.ts');
  const { buildLocalProgressState, reduceLocalProgressEvent } = require('../../src/ui/liveActivity/localProgressModel.ts');
  const { decodePersistedActiveVerifiedCourse } = runtime.load('src/ui/activeVerifiedCourseStorage.ts');
  const points = Array.from({ length: stopCount + 2 }, (_, i) => ({ id: `p${i}`, label: `fixture ${i}`, lat: 35.1 + i * .01, lon: 129.1 }));
  const stops = points.slice(1, -1).map((p, i) => ({ placeId: p.id, stayMin: 20, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: new Date(start + (10 + i * 30) * unit).toISOString(), departureAt: new Date(start + (30 + i * 30) * unit).toISOString() }));
  const legs = points.slice(0, -1).map((p, i) => ({ fromId: p.id, toId: points[i + 1].id, mode: 'walk', min: 10 }));
  const session = { nowIso: new Date(start).toISOString(), remainingMin: minutes, arrivalBufferMin: 10, origin: points[0], destination: points.at(-1) };
  const original = { identity: 'active-fixed', courseRunId: 'run-fixed', session, course: { id: 'course', placeIds: stops.map(s => s.placeId), stops, legs, travelMin: legs.length * 10, stayMin: stopCount * 20, totalMin: legs.length * 10 + stopCount * 20 + 10, arrivalBufferMin: 10 }, progress: { stepIndex: 0, routeOpened: true, finished: false } };
  const restored = decodePersistedActiveVerifiedCourse(JSON.stringify(original));
  assert.deepEqual(restored, original);
  assert.equal(decodePersistedActiveVerifiedCourse(JSON.stringify({ ...original, session: { ...session, remainingMin: 181 } })), null);
  const steps = legs.flatMap((leg, i) => [{ kind: 'travel', key: `t${i}`, from: points[i], target: points[i + 1], mode: 'walk', min: 10, isFinal: i === stopCount }, ...(i < stopCount ? [{ kind: 'stay', key: `s${i}`, target: points[i + 1], stayMin: 20, arrivalAt: stops[i].arrivalAt, departureAt: stops[i].departureAt }] : [])]);
  const built = buildLiveCoursePlan(restored, steps);
  assert.equal(built.status, 'ready');
  assert.equal(built.snapshot.finalArrivalAtMs, start + minutes * unit);
  assert.deepEqual(built.snapshot.stops.map(s => s.plannedStayMin), Array(stopCount).fill(20));
  const route = built.routes[0];
  const state = buildLocalProgressState(built.snapshot, { ...route, type: 'handoff_succeeded', eventId: 'open', source: 'app_handoff', courseRunId: original.courseRunId, baseRevision: 0, occurredAtMs: start });
  const arrived = reduceLocalProgressEvent(state, { type: 'arrival_confirmed', eventId: 'arrive', source: 'app', courseRunId: original.courseRunId, baseRevision: 1, occurredAtMs: start + 10 * unit, stopId: built.snapshot.stops[0].stopId }).state;
  const { liveCourseProgressRuntime: ports } = runtime.load('src/ui/liveActivity/courseProgressComposition.ts');
  await ports.activity.start(state);
  await ports.notification.sync(arrived);
  assert.equal(payloads[0].arrivalPromptAtMs, start + 13 * unit); // grace stays 3 minutes
  const expected = start + (minutes - 10 - stopCount * 10 - (stopCount - 1) * 20 - 5) * unit;
  assert.equal(payloads[0].departureReminderAtMs, expected);
  assert.equal(payloads[0].nextBoundaryAtMs, expected + 5 * unit);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].trigger.date.getTime(), expected);
  assert.equal(notices[0].trigger.date.getFullYear(), 2027);
});
