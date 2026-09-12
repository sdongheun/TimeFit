import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
const { startActiveVerifiedCourse } = require('../../src/ui/activeVerifiedCourseModel.ts');
const { isKakaoRouteOpenSuccess, isValidKakaoRouteStage } = require('../../src/ui/execution/schedule.ts');
const { createLiveCourseProgressController } = require('../../src/ui/liveActivity/courseProgressRuntimeModel.ts');

test('QA release: failed handoff must restore an existing Live Activity update', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw Error('network forbidden'); });
  const session = require('../../src/ui/manualLocationRestoreModel.ts').withManualLocationProof({ nowIso: '2026-09-07T06:00:00Z', remainingMin: 120, arrivalBufferMin: 10, origin: { id: 'origin', label: 'O', lat: 35.1, lon: 129.1 }, destination: null });
  const course = { id: 'A', placeIds: ['A'], stops: [{ placeId: 'A', stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-07T06:05:00Z', departureAt: '2026-09-07T06:35:00Z' }], legs: [{ fromId: 'origin', toId: 'A', mode: 'walk', min: 5 }, { fromId: 'A', toId: 'origin', mode: 'walk', min: 5 }], travelMin: 10, stayMin: 30, totalMin: 50, arrivalBufferMin: 10, remainingAfterCourseMin: 80, remainingAfterArrivalBufferMin: 70 };
  const before = { schemaVersion: 1, courseRunId: 'run', revision: 1, phase: 'traveling', finalArrivalAtMs: Date.parse(session.nowIso) + 120 * 60000, arrivalBufferMin: 10, activeStopId: 'stop:0:A', route: null, stops: [{ stopId: 'stop:0:A', placeId: 'A', title: 'A', plannedStayMin: 30, arrivedAtMs: null, departedAtMs: null, snoozeUsed: false }], processedEventIds: [], updatedAtMs: Date.parse(session.nowIso), terminalAtMs: null };
  let local = before;
  const order = [];
  const controller = createLiveCourseProgressController({
    storage: { async read() { return local ? JSON.stringify(local) : null; }, async write(raw) { local = JSON.parse(raw); order.push('prepare'); }, async clear() { local = null; }, async listReceipts() { return []; }, async acknowledgeReceipt() {} },
    activity: { async start() {}, async update() {}, async end() {} },
    notification: { async sync() { throw Error('success notification forbidden'); }, async cancelOwned() {} },
  });
  const flow = { activeVerifiedCourse: null, pendingNavigationAction: null, isActiveVerifiedCourseRun(run) { return this.activeVerifiedCourse?.courseRunId === run; }, startActiveVerifiedCourse() { return this.activeVerifiedCourse = startActiveVerifiedCourse(session, course, () => 'active', undefined, () => 'run'); }, updateActiveVerifiedCourse() {}, clearActiveVerifiedCourse() {} };
  const runtime = screenRuntime({
    '@react-navigation/native': { usePreventRemove() {} },
    '../data/busan_poi_catalog.json': { matched: { data: [{ contentId: 'A', title: 'A', lat: 35.11, lon: 129.11, category: '문화시설' }] }, unmatched: { data: [] } },
    './AppFlowContext': { useActiveVerifiedCourseFlow: () => flow },
    './mainTabNavigation': { resetToMain() {}, resetToActivityRecord() {}, resetToMyCourses() {} },
    './privateWalkConnectorComposition': { appPrivateWalkConnectorPort: null },
    './courseCompletionComposition': { courseCompletionRepository: { async complete() { throw Error('completion forbidden'); } } },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: controller },
    './liveActivity/courseProgressNotifications': { async prepareLiveCourseNotifications() {} },
    './liveActivity/liveActivityDiagnostics': { createDiagnosticAttemptId: () => 'fixture', async recordLiveActivityAppDiagnostic() {} },
    './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: { async read() { return null; } } },
    './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback() { order.push('external-failed'); return 'failed'; } },
  });
  runtime.native.AppState = { addEventListener() { return { remove() {} }; } };
  const { CourseConfirmScreen } = runtime.load('src/ui/CourseConfirmScreen.tsx');
  const screen = runtime.mount(CourseConfirmScreen, { route: { params: { session, course } }, navigation: { setParams() {}, addListener() { return () => {}; } } });
  screen.press('verified-course-start');
  screen.press('verified-progress-primary');
  for (let i = 0; i < 100; i++) await Promise.resolve();
  assert.deepEqual(order.slice(0, 2), ['prepare', 'external-failed']);
  assert.equal(flow.activeVerifiedCourse.progress.routeOpened, false);
  assert.deepEqual({ ...local, revision: before.revision }, before, 'restore content, not a recyclable revision');
  assert.ok(local.revision > before.revision);
});
