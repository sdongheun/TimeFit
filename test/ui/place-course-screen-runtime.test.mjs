import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
import { approvedPhotoEvidence } from './fixtures/approvedPhoto.mjs';
const require = createRequire(import.meta.url);
const { homeActiveCourseProjection, startActiveVerifiedCourse, updateActiveVerifiedCourse } = require('../../src/ui/activeVerifiedCourseModel.ts');
// Match the module instance required by the production TSX hook host.
const { placeDetailSelectionHandoff } = require('../../src/ui/placeDetailModel.ts');
const { createPrivateWalkConnectorPort } = require('../../src/services/privateWalkConnector.ts');
const { placeDetailLayout } = require('../../src/ui/placeDetailLayout.ts');
const { openKakaoRouteWithFallback, isKakaoRouteOpenSuccess, isValidKakaoRouteStage } = require('../../src/ui/execution/schedule.ts');
const { createLiveCourseProgressController, projectVerifiedProgressFromLocal } = require('../../src/ui/liveActivity/courseProgressRuntimeModel.ts');
const { ownedCourseFixture } = require('./fixtures/ownedCoursePorts.ts');
const { createOwnedCourseLifecycle } = require('../../src/ui/ownedCourseLifecycle.ts');
let networkAttempts = 0;
beforeEach((context) => {
  networkAttempts = 0;
  context.mock.method(globalThis, 'fetch', async () => { networkAttempts++; throw Error('real network forbidden in PF fixtures'); });
});
afterEach(() => assert.equal(networkAttempts, 0));

const session = { nowIso: '2026-09-05T06:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.1 }, destination: { id: 'destination', label: '도착', lat: 35.2, lon: 129.2 }, remainingMin: 120, arrivalBufferMin: 10 };
const places = ['A', 'B'].map((id, i) => ({ contentId: id, title: `긴 장소 이름 ${id}`, category: '문화시설', subCategory: '전시', imageUrl: `https://example.test/${id}.jpg`, imageEvidence: approvedPhotoEvidence, lat: 35.13 + i * .01, lon: 129.13 + i * .01, addr1: '부산 긴 주소 '.repeat(8), detailDescription: '설명'.repeat(120), operatingHours: ['평일 10~18', '주말 10~19'] }));
function course(ids = ['B', 'A']) { return { id: ids.join('-'), placeIds: ids, stops: ids.map(placeId => ({ placeId, stayMin: 20, stayState: 'short', availabilityState: 'structured_verified', arrivalAt: '2026-09-05T06:10:00Z', departureAt: '2026-09-05T06:30:00Z' })), legs: Array.from({ length: ids.length + 1 }, (_, i) => ({ fromId: i ? ids[i - 1] : 'origin', toId: ids[i] ?? 'destination', mode: 'walk', min: 5 })), travelMin: (ids.length + 1) * 5, stayMin: ids.length * 20, totalMin: (ids.length + 1) * 5 + ids.length * 20 + 10, arrivalBufferMin: 10, remainingAfterCourseMin: 20, remainingAfterArrivalBufferMin: 10 }; }
const catalog = { matched: { data: places }, unmatched: { data: [] } };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

for (const ids of [['A'], ['B', 'A']]) test(`B actual CourseConfirm ${ids.join('→')} writes through production owner service and clears before remote sync`, async () => {
  const factory = ownedCourseFixture(), ports = factory.make();
  const lifecycle = createOwnedCourseLifecycle(async () => ports);
  const f = confirmFixture(course(ids), {
    './courseCompletionComposition': { courseCompletionRepository: { complete: lifecycle.complete } },
    './ownedCourseLifecycle': { ownedCourseLifecycle: { async sync(id) { assert.equal(f.flow.activeVerifiedCourse, null); return lifecycle.sync(id); } } },
  });
  f.screen.press('verified-course-start');
  const run = f.flow.activeVerifiedCourse.courseRunId;
  await lifecycle.begin(run);
  f.setRoute('app_opened');
  for (let i = 0; i < ids.length * 2 + 1; i++) { f.screen.press('verified-progress-primary'); for (let n = 0; n < 6; n++) await settle(); }
  f.screen.press('verified-progress-primary');
  for (let n = 0; n < 20; n++) await settle();
  assert.equal(f.flow.activeVerifiedCourse, null);
  assert.equal((await ports.readOwnedDeviceCourseCompletions()).records[0].places.length, ids.length);
  assert.equal(factory.samples.length, 0, 'unconfirmed dwell cannot become a sample');
});
function confirmFixture(value = course(), overrides = {}) {
  overrides = { './ownedCourseLifecycle': { ownedCourseLifecycle: { async sync() {} } }, ...overrides };
  overrides = { ...overrides, './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
    async prepareHandoff() { return { status: 'prepared' }; }, async settleHandoff() {},
    async afterHandoff() {}, async confirmArrival() {}, async readState() { return null; }, async readActualDwell() { return {}; }, async finish() {},
    ...overrides['./liveActivity/courseProgressComposition']?.liveCourseProgressRuntime,
  } } };
  const calls = [], listeners = new Map(), appStateListeners = new Set();
  let routeResult = 'failed', resolveRoute;
  const flow = { activeVerifiedCourse: null, pendingNavigationAction: null, startActiveVerifiedCourse({ session, course }) { calls.push('start'); return this.activeVerifiedCourse = startActiveVerifiedCourse(session, course, () => 'active', undefined, () => 'run'); }, updateActiveVerifiedCourse(id, fn) { this.activeVerifiedCourse = updateActiveVerifiedCourse(this.activeVerifiedCourse, id, fn); }, clearActiveVerifiedCourse() { calls.push('clear'); this.activeVerifiedCourse = null; }, async refreshPendingNavigationAction() { return this.pendingNavigationAction; } };
  const navigation = { addListener(name, fn) { listeners.set(name, fn); return () => listeners.delete(name); }, replace(...args) { calls.push(['replace', ...args]); }, goBack() { calls.push('back'); } };
  const runtime = screenRuntime({ '@react-navigation/native': { usePreventRemove(prevent, callback) { listeners.set('beforeRemove', event => { if (prevent) { event.preventDefault(); callback({ data: {} }); } }); } }, '../data/busan_poi_catalog.json': catalog, './AppFlowContext': { useActiveVerifiedCourseFlow: () => flow }, './privateWalkConnectorComposition': { appPrivateWalkConnectorPort: null }, './courseCompletionComposition': { courseCompletionRepository: { async complete(input) { calls.push(['complete', input]); return { status: 'created' }; } } }, './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: { async afterHandoff() {}, async confirmArrival() {}, async readState() { return null; }, async readActualDwell() { return {}; }, async finish() {} } }, './liveActivity/courseProgressNotifications': { async prepareLiveCourseNotifications() {} }, './liveActivity/liveActivityDiagnostics': { createDiagnosticAttemptId: () => 'fixture-attempt', async recordLiveActivityAppDiagnostic(value) { calls.push(['diagnostic', value]); } }, './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: { async read() { return null; }, async transition() { return false; }, async clear() {} } }, './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback(input) { calls.push(['route', input]); return routeResult === 'pending' ? new Promise(r => { resolveRoute = r; }) : routeResult; } }, './mainTabNavigation': { resetToMain() { calls.push('home'); }, resetToActivityRecord() { calls.push('record'); }, resetToMyCourses() { calls.push('courses'); } }, ...overrides });
  runtime.native.AppState = { addEventListener(_name, listener) { appStateListeners.add(listener); return { remove() { appStateListeners.delete(listener); } }; } };
  const { CourseConfirmScreen } = runtime.load('src/ui/CourseConfirmScreen.tsx');
  const screen = runtime.mount(CourseConfirmScreen, { route: { params: { session, course: value } }, navigation });
  return { screen, flow, calls, listeners, emitAppState: state => appStateListeners.forEach(listener => listener(state)), resume() { const projection = homeActiveCourseProjection(flow.activeVerifiedCourse, null, id => id); screen.unmount(); return runtime.mount(CourseConfirmScreen, { route: { params: projection.params }, navigation }); }, setRoute: v => { routeResult = v; }, resolve: v => resolveRoute(v) };
}

test('PF remediation failure-first: actual CourseConfirm keeps identical vertical cards/map through start and external handoff', async () => {
  const f = confirmFixture();
  const cards = () => f.screen.nodes(n => n.props.accessibilityRole === 'link' && n.props.accessibilityLabel?.includes('카카오맵에서 장소 보기')).map(n => n.props.accessibilityLabel);
  assert.equal(f.screen.nodes(n => n.props.testID === 'place-photo-credit').length, 2);
  const expected = ['긴 장소 이름 B 카카오맵에서 장소 보기', '긴 장소 이름 A 카카오맵에서 장소 보기'];
  assert.deepEqual(cards(), expected);
  const photos = f.screen.nodes(n => n.type === 'Image').map(n => n.props.source.uri);
  assert.deepEqual(photos, ['https://example.test/B.jpg', 'https://example.test/A.jpg']);
  const map = f.screen.nodes(n => n.type === 'KakaoRouteMap')[0];
  const start = f.screen.get('verified-course-start').props.onPress;
  start(); start();
  assert.deepEqual(cards(), expected);
  assert.deepEqual(f.screen.nodes(n => n.type === 'Image').map(n => n.props.source.uri), photos);
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /둘러보기 약 \d+분/);
  assert.deepEqual(f.screen.nodes(n => n.type === 'KakaoRouteMap')[0].props.markers, map.props.markers);
  assert.deepEqual(f.calls, ['start']);
  f.screen.press('verified-progress-primary'); await settle();
  assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened, false);
  f.setRoute('pending');
  f.screen.press('verified-progress-primary'); f.screen.press('verified-progress-primary');
  await settle();
  f.resolve('app_opened'); await settle();
  assert.equal(f.calls.filter(c => c[0] === 'route').length, 2);
  assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex, 0);
  assert.equal(f.screen.get('course-leg-0').props.accessibilityLabel.includes('진행 중'), true);
  f.screen.press('verified-progress-primary');
  assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex, 1);
  assert.deepEqual(cards(), expected);
});

test('ULA regression failure-first: first route prepares Live Activity before iOS external handoff and rolls it back on route failure', async () => {
  const order = [];
  const f = confirmFixture(course(['A']), {
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
      async prepareHandoff() { order.push('activity'); return { status: 'prepared' }; },
      async settleHandoff(input) { assert.equal(input.opened, false); order.push('rollback'); },
      async confirmArrival() {}, async readState() { return null; }, async readActualDwell() { return {}; },
      async finish() { throw Error('preparation is not course cancellation'); },
    } },
    './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback() { order.push('route'); return 'failed'; } },
  });
  f.screen.press('verified-course-start');
  f.screen.press('verified-progress-primary');
  await settle();
  assert.deepEqual(order, ['activity', 'route', 'rollback']);
  assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened, false);
});

for (const ids of [['A'], ['B', 'A']]) for (const result of ['app_opened', 'failed', 'throw']) {
  test(`release A real screen/runtime: ${ids.join('-')} ${result}, preparation/background/duplicate/settlement`, async () => {
    let raw = null, resolve, reject;
    const calls = [];
    const dependencies = {
      storage: { async read() { return raw; }, async write(value) { raw = value; }, async clear() { raw = null; }, async listReceipts() { return []; }, async acknowledgeReceipt() {} },
      activity: { async start(state) { calls.push('activity-prepare'); assert.equal(state.route, null); }, async update() { calls.push('activity-update'); }, async end() { calls.push('activity-end'); } },
      notification: { async sync() { calls.push('notification'); }, async cancelOwned() {} },
    };
    const controller = createLiveCourseProgressController(dependencies);
    const f = confirmFixture(course(ids), {
      './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: controller },
      './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback() { calls.push('external'); return new Promise((yes, no) => { resolve = yes; reject = no; }); } },
    });
    f.screen.press('verified-course-start');
    f.screen.press('verified-progress-primary');
    for (let i = 0; i < 100; i++) await Promise.resolve();
    f.screen.press('verified-progress-primary');
    f.emitAppState('background');
    const cold = await createLiveCourseProgressController(dependencies).readState();
    assert.deepEqual(calls, ['activity-prepare', 'external']);
    assert.equal(cold.route, null);
    assert.deepEqual(cold.processedEventIds, []);
    assert.equal(projectVerifiedProgressFromLocal(cold).routeOpened, false);
    if (result === 'throw') reject(Error('external failure')); else resolve(result);
    for (let i = 0; i < 100; i++) await Promise.resolve();
    f.screen.render();
    const state = await controller.readState();
    assert.equal(calls.filter(call => call === 'external').length, 1);
    assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened, result === 'app_opened');
    assert.equal(calls.includes('notification'), result === 'app_opened');
    assert.equal(state.route !== null, result === 'app_opened');
    if (result !== 'app_opened') {
      assert.equal(state.handoffPreparation.status, 'failed');
      assert.ok(calls.includes('activity-end'));
    }
  });
}

test('ULA lock handoff actual screen: native departure 복구 뒤 추가 CTA 없이 snapshot 다음 구간을 한 번 연다', async () => {
  let pendingStore = null; let localState = null; const nativeCalls = [];
  const overrides = {
    './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: {
      async read() { return pendingStore; },
      async transition(action, from, to) {
        nativeCalls.push(`transition:${from}:${to}`);
        if (!pendingStore || pendingStore.actionId !== action.actionId || pendingStore.state !== from) return false;
        pendingStore = { ...pendingStore, state: to }; return true;
      },
      async clear() { nativeCalls.push('clear'); pendingStore = null; },
    } },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
      async afterHandoff() { nativeCalls.push('progress'); }, async confirmArrival() {}, async readState() { return localState; }, async readActualDwell() { return {}; }, async finish() {},
    } },
  };
  const f = confirmFixture(course(), overrides);
  f.screen.press('verified-course-start');
  f.flow.activeVerifiedCourse.progress = { stepIndex: 1, routeOpened: false, finished: false };
  pendingStore = f.flow.pendingNavigationAction = { schemaVersion: 1, purpose: 'course_progress_navigation', actionId: 'native-departure', courseRunId: 'run', stopId: 'stop:0:B', baseRevision: 2, state: 'pending' };
  localState = { schemaVersion: 1, courseRunId: 'run', revision: 3, phase: 'traveling', finalArrivalAtMs: 1, arrivalBufferMin: 10, activeStopId: 'stop:0:B', route: null, processedEventIds: ['native-departure'], updatedAtMs: 2, terminalAtMs: null,
    stops: [{ stopId: 'stop:0:B', placeId: 'B', title: 'B', plannedStayMin: 20, snoozeUsed: false, arrivedAtMs: 1, departedAtMs: 2 }, { stopId: 'stop:1:A', placeId: 'A', title: 'A', plannedStayMin: 20, snoozeUsed: false, arrivedAtMs: null, departedAtMs: null }] };
  f.setRoute('app_opened');
  f.screen.render(); await settle(); f.screen.render(); await settle();
  assert.equal(f.calls.filter(value => value[0] === 'route').length, 1);
  assert.equal(f.calls.find(value => value[0] === 'route')[1].to.name, '긴 장소 이름 A');
  assert.deepEqual(f.flow.activeVerifiedCourse.progress, { stepIndex: 2, routeOpened: true, finished: false });
  assert.deepEqual(nativeCalls, ['transition:pending:executing', 'progress', 'transition:executing:success', 'clear']);
});

test('ULA departure regression failure-first: suspended first Kakao handoff lock cannot block Live Activity departure auto-route', async () => {
  let pendingStore = null; let localState = null; let routeAttempt = 0; const opened = [];
  const f = confirmFixture(course(), {
    './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: {
      async read() { return pendingStore; },
      async transition(action, from, to) {
        if (!pendingStore || pendingStore.actionId !== action.actionId || pendingStore.state !== from) return false;
        pendingStore = { ...pendingStore, state: to }; return true;
      },
      async clear() { pendingStore = null; },
    } },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
      async afterHandoff() { return { status: routeAttempt === 0 ? 'started' : 'updated' }; },
      async confirmArrival() {}, async readState() { return localState; }, async readActualDwell() { return {}; }, async finish() {},
    } },
    './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback(input) {
      routeAttempt += 1; opened.push(input.to.name);
      if (routeAttempt === 1) return new Promise(() => undefined);
      return 'app_opened';
    } },
  });
  f.screen.press('verified-course-start');
  f.screen.press('verified-progress-primary');
  await settle();
  assert.deepEqual(opened, ['긴 장소 이름 B']);

  f.flow.activeVerifiedCourse.progress = { stepIndex: 1, routeOpened: false, finished: false };
  pendingStore = f.flow.pendingNavigationAction = { schemaVersion: 1, purpose: 'course_progress_navigation', actionId: 'depart-while-first-suspended', courseRunId: 'run', stopId: 'stop:0:B', baseRevision: 2, state: 'pending' };
  localState = { schemaVersion: 1, courseRunId: 'run', revision: 3, phase: 'traveling', finalArrivalAtMs: 1, arrivalBufferMin: 10, activeStopId: 'stop:0:B', route: null, processedEventIds: ['depart-while-first-suspended'], updatedAtMs: 2, terminalAtMs: null,
    stops: [{ stopId: 'stop:0:B', placeId: 'B', title: 'B', plannedStayMin: 20, snoozeUsed: false, arrivedAtMs: 1, departedAtMs: 2 }, { stopId: 'stop:1:A', placeId: 'A', title: 'A', plannedStayMin: 20, snoozeUsed: false, arrivedAtMs: null, departedAtMs: null }] };
  f.emitAppState('background');
  f.emitAppState('active');
  f.screen.render(); await settle(); f.screen.render(); await settle();

  assert.deepEqual(opened, ['긴 장소 이름 B', '긴 장소 이름 A']);
  assert.equal(pendingStore, null);
  assert.deepEqual(f.flow.activeVerifiedCourse.progress, { stepIndex: 2, routeOpened: true, finished: false });
});

test('ULA departure regression: one-stop final destination also auto-routes after TimeFit activation', async () => {
  let pendingStore = null; let localState = null; let routeAttempt = 0; const opened = [];
  const f = confirmFixture(course(['A']), {
    './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: {
      async read() { return pendingStore; },
      async transition(action, from, to) {
        if (!pendingStore || pendingStore.actionId !== action.actionId || pendingStore.state !== from) return false;
        pendingStore = { ...pendingStore, state: to }; return true;
      },
      async clear() { pendingStore = null; },
    } },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
      async afterHandoff() { return { status: routeAttempt === 0 ? 'started' : 'updated' }; },
      async confirmArrival() {}, async readState() { return localState; }, async readActualDwell() { return {}; }, async finish() {},
    } },
    './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback(input) {
      routeAttempt += 1; opened.push(input.to.name);
      if (routeAttempt === 1) return new Promise(() => undefined);
      return 'app_opened';
    } },
  });
  f.screen.press('verified-course-start');
  f.screen.press('verified-progress-primary');
  await settle();
  f.flow.activeVerifiedCourse.progress = { stepIndex: 1, routeOpened: false, finished: false };
  pendingStore = f.flow.pendingNavigationAction = { schemaVersion: 1, purpose: 'course_progress_navigation', actionId: 'depart-one-stop', courseRunId: 'run', stopId: 'stop:0:A', baseRevision: 2, state: 'pending' };
  localState = { schemaVersion: 1, courseRunId: 'run', revision: 3, phase: 'traveling', finalArrivalAtMs: 1, arrivalBufferMin: 10, activeStopId: 'stop:0:A', route: null, processedEventIds: ['depart-one-stop'], updatedAtMs: 2, terminalAtMs: null,
    stops: [{ stopId: 'stop:0:A', placeId: 'A', title: 'A', plannedStayMin: 20, snoozeUsed: false, arrivedAtMs: 1, departedAtMs: 2 }] };
  f.emitAppState('background');
  f.emitAppState('active');
  f.screen.render(); await settle(); f.screen.render(); await settle();
  assert.deepEqual(opened, ['긴 장소 이름 A', '도착']);
  assert.equal(pendingStore, null);
  assert.deepEqual(f.flow.activeVerifiedCourse.progress, { stepIndex: 2, routeOpened: true, finished: false });
});

test('PF remediation failure-first: actual PlaceDetail measured panel pads map, caps small screen and keeps CTA outside information scroll', () => {
  const runtime = screenRuntime({ '../data/busan_poi_catalog.json': catalog });
  const { PlaceDetailScreen } = runtime.load('src/ui/PlaceDetailScreen.tsx');
  const screen = runtime.mount(PlaceDetailScreen, { route: { params: { session, course: course(['A']), placeId: 'A', requestId: 'layout', selectionKind: 'first' } }, navigation: { goBack() {} } });
  const sheet = screen.get('place-detail-sheet');
  assert.equal(typeof sheet.props.onLayout, 'function');
  sheet.props.onLayout({ nativeEvent: { layout: { height: 310 } } });
  const map = screen.nodes(n => n.type === 'KakaoRouteMap')[0];
  assert.equal(map.props.boundsPadding.bottom, 326);
  assert.ok(Object.assign({}, ...screen.get('place-detail-sheet').props.style).maxHeight < 420);
  const scroll = screen.get('place-detail-information');
  assert.ok(scroll);
  assert.equal(JSON.stringify(scroll).includes('place-detail-select'), false);
});

test('PF actual Results + PlaceDetail: open/close/back/stale, explicit A focus-once, B selection/delete and late pair restoration', async () => {
  const calls = [], routes = [], scrolls = [];
  let focus, pairInput, resolvePair;
  const first = course(['A']), pair = course();
  const forbidden = name => () => { calls.push(name); throw Error(`unexpected ${name}`); };
  const port = { begin(input) { pairInput = input; calls.push('pair'); return new Promise(r => { resolvePair = r; }); }, continue: forbidden('continue') };
  const overrides = {
    '../data/busan_poi_catalog.json': catalog,
    '@react-navigation/native': { useFocusEffect(fn) { focus = fn; } },
    './recommendation/v1Session': { getTwoStopSelectionPort: () => port, canRecordTwoStopSelectionIntent: () => true, isRecommendationSessionOperationInFlight: () => false, continueReleaseRecommendationSession: forbidden('recommendation'), requestConditionalManualCourse: forbidden('route') },
    '../data/courseV1CandidateProvider': { createCourseV1CandidateProvider: () => ({ listConditionalVisitCandidates: () => [] }) },
    'expo-location': { requestForegroundPermissionsAsync: forbidden('permission'), getCurrentPositionAsync: forbidden('gps') },
    './privateWalkConnectorComposition': { appPrivateWalkConnectorPort: { getConnector: forbidden('connector') } },
    './courseCompletionComposition': { courseCompletionRepository: { complete: forbidden('completion') } },
    './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, openKakaoRouteWithFallback: forbidden('route') },
    './InPlaceTransition': { InPlaceTransition: 'InPlaceTransition' },
    './recommendation/CourseV1SummaryCard': { CourseV1SummaryCard: 'CourseV1SummaryCard' },
    './recommendation/TwoStopSelectionPanel': { TwoStopSelectionPanel: 'TwoStopSelectionPanel' },
    './recommendation/TwoStopSelectionTray': { TwoStopSelectionTray: 'TwoStopSelectionTray', TwoStopFixedCourseCta: 'TwoStopFixedCourseCta' },
  };
  const runtime = screenRuntime(overrides);
  overrides['react-native'] = { ...runtime.native, Linking: { async canOpenURL() { return true; }, async openURL() { calls.push('external-place'); } } };
  const navigation = { navigate(name, params) { routes.push({ name, params }); }, addListener: () => () => {}, goBack() { calls.push('pop'); } };
  const result = { representativeCourse: first, alternativeCourses: [course(['B'])], resultState: 'verified', alternativeState: 'alternatives_available', continuation: { attemptedCandidateIds: ['A'], verifiedCandidateIds: ['A'], cursor: 1 } };
  const { ResultsScreen } = runtime.load('src/ui/ResultsScreen.tsx');
  const results = runtime.mount(ResultsScreen, { route: { params: { session, result } }, navigation });
  const node = type => results.nodes(n => n.type === type)[0];
  const cards = () => results.nodes(n => n.type === 'CourseV1SummaryCard');
  const list = results.nodes(n => n.type === 'ScrollView')[0];
  list.props.ref.current = { scrollTo: v => scrolls.push(v.y) };
  list.props.onScroll({ nativeEvent: { contentOffset: { y: 720 } } });
  const open = () => cards()[0].props.onPress();
  const detail = () => { const host = screenRuntime(overrides); return host.mount(host.load('src/ui/PlaceDetailScreen.tsx').PlaceDetailScreen, { route: { params: routes.at(-1).params }, navigation }); };
  try {
    open(); open();
    assert.equal(routes.length, 1); assert.deepEqual(calls, []);
    const firstRequest = { ...routes[0].params, courseId: first.id };
    const info = detail(); info.press('place-detail-kakao'); await settle();
    assert.deepEqual(calls, ['external-place']);
    info.press('place-detail-close'); focus();
    assert.equal(cards().length, 2); assert.deepEqual(calls, ['external-place', 'pop']);
    open(); focus(); // native interactive pop: Results focus without explicit selection
    assert.equal(placeDetailSelectionHandoff.select({ ...routes.at(-1).params, courseId: first.id }), false);
    assert.equal(cards().length, 2); assert.equal(scrolls.length, 0);
    open();
    assert.equal(placeDetailSelectionHandoff.select(firstRequest), false);
    const d = detail(); const choose = d.get('place-detail-select').props.onPress; choose(); choose(); focus(); focus();
    assert.equal(calls.filter(c => c === 'pair').length, 1);
    assert.equal(pairInput.firstCourse, first);
    assert.equal(pairInput.signal.aborted, false);
    resolvePair({ requestId: pairInput.requestId, firstPlaceId: 'A', courses: [pair], pageState: 'exhausted' }); await settle();
    const panel = node('TwoStopSelectionPanel');
    panel.props.onSelectCandidate(pair); detail().press('place-detail-close'); focus();
    assert.equal(node('TwoStopSelectionTray').props.rows.length, 1);
    node('TwoStopSelectionPanel').props.onSelectCandidate(pair); detail().press('place-detail-select'); focus(); focus();
    assert.equal(node('TwoStopSelectionTray').props.rows.length, 2);
    node('TwoStopFixedCourseCta').props.onPress();
    assert.equal(routes.at(-1).name, 'CourseConfirm'); assert.equal(routes.at(-1).params.course, pair); assert.equal(routes.at(-1).params.session, session);
    node('TwoStopSelectionTray').props.rows[1].onRemove();
    assert.equal(node('TwoStopSelectionTray').props.rows.length, 1);
    node('TwoStopSelectionTray').props.rows[0].onRemove();
    assert.deepEqual(cards().map(n => n.props.summary.course.id), ['A', 'B']); assert.equal(scrolls.at(-1), 720);
    // New branch cancelled before its pending response; stale response cannot replace A0.
    cards()[1].props.onPress(); detail().press('place-detail-select'); focus();
    assert.equal(calls.filter(c => c === 'pair').length, 2);
    node('TwoStopSelectionTray').props.rows[0].onRemove();
    assert.equal(pairInput.signal.aborted, true);
    resolvePair({ requestId: pairInput.requestId, firstPlaceId: 'B', courses: [pair], pageState: 'exhausted' }); await settle();
    assert.equal(cards().length, 2);
    assert.ok(calls.every(c => ['pair', 'pop', 'external-place'].includes(c)), calls.join(','));
    open();
    const abandoned = { ...routes.at(-1).params, courseId: first.id };
    results.unmount();
    assert.equal(placeDetailSelectionHandoff.select(abandoned), false);
  } finally { results.unmount(); }
});

for (const ids of [['A'], ['B', 'A']]) test(`PF actual CourseConfirm ${ids.join('→')}: Home same run, final leg, completion duplicate/failure/retry`, async () => {
  const writes = []; let status = 'storage_unavailable';
  const f = confirmFixture(course(ids), { './courseCompletionComposition': { courseCompletionRepository: { async complete(input) { writes.push(input); return { status }; } } } });
  f.screen.press('verified-course-start'); f.setRoute('app_opened');
  f.screen.press('verified-progress-primary'); await settle();
  const beforeHome = f.flow.activeVerifiedCourse;
  f.screen.nodes(n => n.props.accessibilityLabel === '메인으로 돌아가기')[0].props.onPress();
  assert.equal(f.flow.activeVerifiedCourse, beforeHome); assert.equal(writes.length, 0);
  const screen = f.resume();
  assert.equal(f.flow.activeVerifiedCourse.courseRunId, beforeHome.courseRunId);
  assert.equal(screen.nodes(n => n.props.testID === 'verified-course-start').length, 0);
  // Explicit arrival -> stay; stay CTA opens precisely the next optimized leg.
  for (let i = 0; i < ids.length; i++) {
    const arrive = screen.get('verified-progress-primary').props.onPress; arrive(); arrive();
    assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex, i * 2 + 1);
    f.setRoute('failed'); screen.press('verified-progress-primary'); await settle();
    assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex, i * 2 + 1);
    f.setRoute('app_opened'); screen.press('verified-progress-primary'); await settle();
    assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex, i * 2 + 2);
    assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened, true);
  }
  assert.equal(screen.get('verified-progress-primary').props.accessibilityLabel, '도착 후 코스 마치기');
  assert.equal(writes.length, 0);
  const finish = screen.get('verified-progress-primary').props.onPress; finish(); finish(); await settle();
  assert.equal(writes.length, 1); assert.ok(f.flow.activeVerifiedCourse);
  assert.equal(screen.get('verified-progress-primary').props.accessibilityLabel, '다시 시도');
  status = 'created'; screen.press('verified-progress-primary'); await settle();
  screen.render(); assert.equal(writes.length, 2); assert.equal(writes[0], writes[1]);
  assert.equal(f.flow.activeVerifiedCourse, null); assert.equal(f.calls.filter(c => c === 'record').length, 1);
  assert.deepEqual(writes[0].places.map(p => p.contentId), ids);
  assert.doesNotMatch(JSON.stringify(writes), /lat|lon|userId/);
  assert.deepEqual(f.calls.filter(c => c[0] === 'route').map(c => c[1].to.name), [places.find(p => p.contentId === ids[0]).title, ...ids.slice(1).flatMap(id => [places.find(p => p.contentId === id).title, places.find(p => p.contentId === id).title]), '도착', '도착']);
});

// Restored contract: the former all-courses-four assertion was based on withdrawn instructions.
for (const ids of [['A'], ['B', 'A']]) for (const partial of [false, true]) test(`PF restore connector ${ids.join('→')} partial=${partial}: last leg geometry, concurrency, cache and TTL`, async () => {
  let clock = 1, inFlight = 0, peak = 0;
  const requests = [];
  const expectedCount = (ids.length + 1) * 2;
  const value = course(ids);
  value.legs = value.legs.map((leg, i) => ({ ...leg, mode: 'transit', geometry: { paths: [{ points: [{ lat: 35.3 + i * .01, lon: 129.3 }, { lat: 35.31 + i * .01, lon: 129.31 }] }] } }));
  const snapshot = JSON.stringify(value);
  const port = createPrivateWalkConnectorPort({ clock: { now: () => clock }, auth: { async getSession() { return { accessToken: 'fixture-only' }; } }, edge: { async invoke(_name, { body }) {
    requests.push(body); inFlight++; peak = Math.max(peak, inFlight);
    const fail = partial && requests.length % expectedCount === 1;
    await settle(); inFlight--;
    return { data: fail ? { status: 'no_route', mode: 'walk', receipt: { result: 'no_route', newProviderAttemptCount: 1, reuse: 'provider_attempt' } } : { status: 'ok', mode: 'walk', totalMin: 7, geometry: { paths: [{ points: [body.origin, body.destination] }] }, receipt: { result: 'exact', newProviderAttemptCount: 1, reuse: 'provider_attempt' } }, error: null };
  } } });
  const f = confirmFixture(value, { './privateWalkConnectorComposition': { appPrivateWalkConnectorPort: port } });
  const flush = async () => { for (let i = 0; i < 18; i++) await settle(); };
  await flush();
  assert.equal(requests.length, expectedCount);
  assert.equal(peak, 2);
  const segments = f.screen.nodes(n => n.type === 'KakaoRouteMap')[0].props.segments;
  const finalIndex = ids.length;
  const last = segments.filter(s => s.legIndex === finalIndex);
  assert.deepEqual(last.map(s => s.connectorKey ?? s.mode), [`${finalIndex}:start`, 'transit', `${finalIndex}:end`]);
  assert.deepEqual(last[0].points, [requests.at(-2).origin, requests.at(-2).destination]);
  assert.deepEqual(last[2].points, [requests.at(-1).origin, requests.at(-1).destination]);
  assert.deepEqual(last[2].points.at(-1), { lat: session.destination.lat, lon: session.destination.lon });
  assert.equal(segments.filter(s => s.connectorKey).length, expectedCount - Number(partial));
  assert.equal(JSON.stringify(f.screen.render()).includes('일부 도보 경로선을 표시하지 못했어요'), partial);
  assert.ok(segments.every(s => s.quality === 'precise'));
  assert.equal(JSON.stringify(value), snapshot, 'connector minutes must not change recommendation totals');
  f.screen.render(); f.screen.press('verified-course-start'); f.screen.render(); await flush();
  assert.equal(requests.length, expectedCount);
  f.resume(); await flush(); assert.equal(requests.length, expectedCount);
  clock += 10 * 60 * 1000 + 1;
  f.resume(); await flush(); assert.equal(requests.length, expectedCount * 2);
  assert.deepEqual(f.calls, ['start']);
});

test('PF restore failure-first: explicit review shows snapshot short20/recommended35; active and Home reentry hide minutes', () => {
  const value = course();
  value.stops[1] = { ...value.stops[1], stayMin: 35, stayState: 'recommended' };
  value.stayMin += 15; value.totalMin += 15;
  const f = confirmFixture(value);
  assert.match(JSON.stringify(f.screen.get('course-stop-B')), /가볍게 둘러보기 약 20분/);
  assert.match(JSON.stringify(f.screen.get('course-stop-A')), /둘러보기 약 35분/);
  f.screen.press('verified-course-start');
  assert.doesNotMatch(JSON.stringify(f.screen.render()), /둘러보기 약 \d+분/);
  assert.match(JSON.stringify(f.screen.get('course-stop-B')), /가볍게 둘러보기/);
  assert.doesNotMatch(JSON.stringify(f.screen.get('course-stop-A')), /가볍게 둘러보기/);
  const resumed = f.resume();
  assert.doesNotMatch(JSON.stringify(resumed.render()), /둘러보기 약 \d+분/);
  f.flow.activeVerifiedCourse = null;
  assert.doesNotMatch(JSON.stringify(resumed.render()), /둘러보기 약 \d+분/, 'missing active progress must not imply review');
});

test('PF restore: missing display mode/progress is not review; Results summary and PlaceDetail B never show planned stay', () => {
  const { buildCourseV1DetailModel, buildCourseV1CardSummary } = require('../../src/ui/recommendation/courseV1CardDetailModel.ts');
  const value = course(['A']);
  const resolve = id => places.find(p => p.contentId === id);
  const model = buildCourseV1DetailModel(value, session, resolve);
  for (const mode of [undefined, 'active']) {
    const host = screenRuntime();
    const screen = host.mount(host.load('src/ui/recommendation/CourseV1VerticalDetail.tsx').CourseV1VerticalDetail, { model, mode, onOpenKakao() {} });
    assert.doesNotMatch(JSON.stringify(screen.render()), /둘러보기 약 \d+분/);
    assert.ok(screen.get('course-stop-A'));
  }
  const host = screenRuntime({ '../data/busan_poi_catalog.json': catalog });
  const summary = host.mount(host.load('src/ui/recommendation/CourseV1SummaryCard.tsx').CourseV1SummaryCard, { summary: buildCourseV1CardSummary(value, '대표 추천', resolve), onPress() {} });
  assert.doesNotMatch(JSON.stringify(summary.render()), /둘러보기 약 \d+분/);
  summary.unmount();
  const detail = host.mount(host.load('src/ui/PlaceDetailScreen.tsx').PlaceDetailScreen, { route: { params: { session, course: value, selectionKind: 'first', placeId: 'A', requestId: 'no-stay' } }, navigation: { goBack() {} } });
  assert.doesNotMatch(JSON.stringify(detail.render()), /둘러보기 약 \d+분/);
});

test('PF restore: production only calls needed transit gaps; walk, intact and damaged snapshots never fill a quota', async () => {
  for (const kind of ['walk', 'intact', 'single-gap', 'damaged']) {
    const value = course();
    const points = [session.origin, ...value.placeIds.map(id => places.find(p => p.contentId === id)), session.destination];
    value.legs = value.legs.map((leg, i) => ({ ...leg, mode: kind === 'walk' ? 'walk' : 'transit', geometry: { paths: [{ points: [points[i], points[i + 1]].map(p => ({ lat: p.lat, lon: p.lon })) }] } }));
    if (kind === 'single-gap' || kind === 'walk') value.legs[2].geometry.paths[0].points[1].lat += .002;
    if (kind === 'damaged') value.legs[1].fromId = 'wrong';
    const requests = [];
    const f = confirmFixture(value, { './privateWalkConnectorComposition': { appPrivateWalkConnectorPort: { async getConnector(from, to) { requests.push({ from, to }); return { status: 'no_route' }; } } } });
    await settle();
    assert.equal(requests.length, kind === 'single-gap' ? 1 : 0, kind);
    if (kind === 'single-gap') assert.deepEqual(requests[0].to, session.destination);
    assert.equal(f.calls.length, 0);
  }
});

test('PF layout matrix: 320×568 / 375×667 / 390×844, fonts 1/1.6/2, content/fallback/error preserve visible map and safe CTA', async () => {
  let cases = 0;
  for (const [width, height, top, bottom] of [[320, 568, 20, 0], [375, 667, 20, 0], [390, 844, 47, 34]]) for (const fontScale of [1, 1.6, 2]) for (const long of [false, true]) for (const fallback of [false, true]) for (const error of [false, true]) {
    const geometry = placeDetailLayout(height, top, bottom, 0);
    // Deterministic native onLayout input, not a claim of Yoga/device text measurement.
    const measured = Math.min(geometry.maxHeight, (long ? 650 : 240) * fontScale + (fallback ? 54 : 0) + (error ? 40 : 0));
    const layout = placeDetailLayout(height, top, bottom, measured);
    assert.equal(layout.boundsPadding.bottom, measured + 16);
    assert.ok(height - top - layout.boundsPadding.top - layout.boundsPadding.bottom >= Math.min(160, (height - top) * .28) - .01);
    assert.ok(layout.paddingBottom > bottom);
    assert.ok(layout.maxHeight - layout.paddingBottom - Math.max(52, 20 * fontScale + 24) - 26 > 60, `${width}/${fontScale}`);
    const overrides = {};
    const host = screenRuntime(overrides);
    overrides['react-native'] = { ...host.native, useWindowDimensions: () => ({ width, height, fontScale }), Linking: { async canOpenURL() { return false; }, async openURL() { throw Error('fixture'); } } };
    overrides['react-native-safe-area-context'] = { useSafeAreaInsets: () => ({ top, bottom, left: 0, right: 0 }) };
    overrides['../data/busan_poi_catalog.json'] = { matched: { data: [{ ...places[0], detailDescription: long ? places[0].detailDescription : undefined, operatingHours: long ? places[0].operatingHours : [] }] }, unmatched: { data: [] } };
    const actualSession = fallback ? session : { ...session, deviceLocationSnapshot: { lat: 35.12, lon: 129.12 } };
    const screen = host.mount(host.load('src/ui/PlaceDetailScreen.tsx').PlaceDetailScreen, { route: { params: { session: actualSession, course: course(['A']), placeId: 'A', requestId: 'layout', selectionKind: 'first' } }, navigation: { goBack() {} } });
    if (error) { screen.press('place-detail-kakao'); await settle(); }
    assert.equal(JSON.stringify(screen.render()).includes('카카오맵을 열지 못했어요'), error);
    assert.equal(JSON.stringify(screen.render()).includes('현재 위치를 확인하지 못했어요'), fallback);
    screen.get('place-detail-sheet').props.onLayout({ nativeEvent: { layout: { height: measured } } });
    assert.deepEqual(screen.nodes(n => n.type === 'KakaoRouteMap')[0].props.boundsPadding, layout.boundsPadding);
    assert.equal(JSON.stringify(screen.get('place-detail-information')).includes('place-detail-select'), false);
    assert.ok(screen.get('place-detail-select'));
    screen.unmount();
    cases++;
  }
  assert.equal(cases, 72);
});

test('PF failure-first: active native back returns Home without clearing run; pending external result cannot overwrite a newer confirmed step', async () => {
  const f = confirmFixture(); f.screen.press('verified-course-start');
  f.setRoute('pending'); f.screen.press('verified-progress-primary');
  await settle();
  const original = f.flow.activeVerifiedCourse;
  f.flow.updateActiveVerifiedCourse(original.identity, () => ({ stepIndex: 1, routeOpened: false, finished: false }));
  f.resolve('app_opened'); await settle();
  assert.equal(f.flow.activeVerifiedCourse.progress.stepIndex, 1);
  assert.equal(f.flow.activeVerifiedCourse.progress.routeOpened, false);
  f.screen.render();
  let prevented = 0;
  assert.equal(typeof f.listeners.get('beforeRemove'), 'function');
  f.listeners.get('beforeRemove')({ preventDefault() { prevented++; } }); f.screen.render();
  assert.equal(prevented, 1); assert.equal(f.calls.at(-1), 'home'); assert.equal(f.flow.activeVerifiedCourse.courseRunId, original.courseRunId);
});

test('PF actual completion failure: explicit without-record clears once without a second repository attempt', async () => {
  let attempts = 0;
  const f = confirmFixture(course(['A']), { './courseCompletionComposition': { courseCompletionRepository: { async complete() { attempts++; return { status: 'storage_corrupt' }; } } } });
  f.screen.press('verified-course-start');
  f.flow.updateActiveVerifiedCourse('active', () => ({ stepIndex: 2, routeOpened: true, finished: false }));
  f.screen.press('verified-progress-primary'); await settle();
  const without = f.screen.get('finish-without-record').props.onPress; without(); without(); f.screen.render();
  assert.equal(attempts, 1); assert.equal(f.flow.activeVerifiedCourse, null);
  assert.equal(f.calls.filter(c => c === 'clear').length, 1); assert.equal(f.calls.filter(c => c === 'courses').length, 1);
});

test('B-remediation actual screen: floor 체류값을 기존 완료 input에 그대로 한 번 전달한다', async () => {
  const writes = [];
  const f = confirmFixture(course(['A']), {
    './courseCompletionComposition': { courseCompletionRepository: { async complete(input) { writes.push(input); return { status: 'created' }; } } },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
      async afterHandoff() {}, async confirmArrival() {}, async readActualDwell() { return { A: 1 }; }, async finish() {},
    } },
  });
  f.screen.press('verified-course-start');
  f.flow.updateActiveVerifiedCourse('active', () => ({ stepIndex: 2, routeOpened: true, finished: false }));
  f.screen.press('verified-progress-primary'); await settle();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].places[0].actualDwellMin, 1);
});

test('PF actual KakaoRouteMap document/bridge: ordinary render preserves pan; only changed geometry or measured padding refits', () => {
  const runtime = screenRuntime({ __process: { env: { EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture-not-a-key' } }, 'react-native-webview': { WebView: 'WebView' } });
  const { KakaoRouteMap } = runtime.load('src/ui/KakaoRouteMap.tsx');
  const props = { points: [{ lat: 35, lon: 129 }], line: [] };
  const screen = runtime.mount(KakaoRouteMap, props);
  try {
    const web = () => screen.nodes(n => n.type === 'WebView')[0];
    const html = web().props.source.html;
    web().props.onMessage({ nativeEvent: { data: '{"type":"ready"}' } });
    props.points = [{ lat: 36, lon: 128 }]; screen.render();
    assert.equal(web().props.source.html, html, 'a new points array must not recreate the WebView document');
    const source = fs.readFileSync('src/ui/KakaoRouteMap.tsx', 'utf8');
    const body = source.slice(source.indexOf('var lastBoundsKey'), source.indexOf('function focusMap'));
    let fits = 0, pan = 'user-pan';
    const map = { setBounds() { fits++; pan = 'bounds'; } };
    const kakao = { maps: { LatLngBounds: class { empty = true; extend() { this.empty = false; } isEmpty() { return this.empty; } }, Polyline: class {} } };
    const setRoute = new Function('map', 'kakao', 'clearRoute', 'll', 'addDirectionArrows', 'overlays', `let mapTapEnabled = false, hasInitialRoute = false; ${body}; return setRoute;`)(map, kakao, () => {}, p => p, () => {}, []);
    const data = { segments: [{ mode: 'walk', points: [{ lat: 35, lon: 129 }, { lat: 35.1, lon: 129.1 }] }], markers: [], boundsPadding: { top: 66, bottom: 300, left: 34, right: 34 } };
    setRoute(data); pan = 'user-pan'; setRoute(JSON.parse(JSON.stringify(data)));
    assert.equal(fits, 1); assert.equal(pan, 'user-pan');
    setRoute({ ...data, showMarkerLabels: true }); assert.equal(fits, 1);
    data.boundsPadding.bottom = 330; setRoute(data); assert.equal(fits, 2);
    data.segments[0].points[1].lat += .01; setRoute(data); assert.equal(fits, 3);
  } finally { screen.unmount(); }
});

test('PF actual invalid route and app/HTTPS/browser failures never advance or record', async () => {
  for (const invalid of [false, true]) {
    const opened = [];
    const f = confirmFixture(course(['A']), {
      '../data/busan_poi_catalog.json': invalid ? { matched: { data: [{ ...places[0], lat: NaN }] }, unmatched: { data: [] } } : catalog,
      './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, openKakaoRouteWithFallback: (input, mode) => openKakaoRouteWithFallback(input, mode, { async canOpenApp() { return true; }, async openApp() { opened.push('app'); throw Error('fixture'); }, async openWeb() { opened.push('https'); throw Error('fixture'); }, async openBrowser() { opened.push('browser'); throw Error('fixture'); }, observeAppState() { return () => undefined; } }) },
    });
    f.screen.press('verified-course-start'); f.screen.press('verified-progress-primary'); await settle();
    assert.deepEqual(opened, invalid ? [] : ['app', 'https', 'browser']);
    assert.deepEqual(f.flow.activeVerifiedCourse.progress, { stepIndex: 0, routeOpened: false, finished: false });
    assert.deepEqual(f.calls.filter(value => !Array.isArray(value) || value[0] !== 'diagnostic'), ['start']);
  }
});
