import { createRequire } from 'node:module';
import 'tsx/cjs';
import { screenRuntime } from '../support/screenRuntime.mjs';
import { approvedPhotoEvidence } from './approvedPhoto.mjs';
const require=createRequire(import.meta.url);
const { homeActiveCourseProjection,startActiveVerifiedCourse,updateActiveVerifiedCourse }=require('../../../src/ui/activeVerifiedCourseModel.ts');
const {isKakaoRouteOpenSuccess,isValidKakaoRouteStage}=require('../../../src/ui/execution/schedule.ts');
const session = require('../../../src/ui/manualLocationRestoreModel.ts').withManualLocationProof({ nowIso: '2026-09-05T06:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.1, lon: 129.1 }, destination: { id: 'destination', label: '도착', lat: 35.2, lon: 129.2 }, remainingMin: 120, arrivalBufferMin: 10 });
const places = ['A', 'B'].map((id, i) => ({ contentId: id, title: `긴 장소 이름 ${id}`, category: '문화시설', subCategory: '전시', imageUrl: `https://example.test/${id}.jpg`, imageEvidence: approvedPhotoEvidence, lat: 35.13 + i * .01, lon: 129.13 + i * .01, addr1: '부산 긴 주소 '.repeat(8), detailDescription: '설명'.repeat(120), operatingHours: ['평일 10~18', '주말 10~19'] }));
function course(ids = ['B', 'A']) { return { id: ids.join('-'), placeIds: ids, stops: ids.map(placeId => ({ placeId, stayMin: 20, stayState: 'short', availabilityState: 'structured_verified', arrivalAt: '2026-09-05T06:10:00Z', departureAt: '2026-09-05T06:30:00Z' })), legs: Array.from({ length: ids.length + 1 }, (_, i) => ({ fromId: i ? ids[i - 1] : 'origin', toId: ids[i] ?? 'destination', mode: 'walk', min: 5 })), travelMin: (ids.length + 1) * 5, stayMin: ids.length * 20, totalMin: (ids.length + 1) * 5 + ids.length * 20 + 10, arrivalBufferMin: 10, remainingAfterCourseMin: 20, remainingAfterArrivalBufferMin: 10 }; }
const catalog = { matched: { data: places }, unmatched: { data: [] } };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function confirmFixture(value = course(), overrides = {}, selectedSession = session) {
  // Normal scenarios run within their original recommendation window; expiry tests override this clock.
  class SessionClock extends Date { static now() { return Date.parse(selectedSession.nowIso) + 60000; } }
  overrides = { __Date: SessionClock, ...overrides };
  overrides = { './ownedCourseLifecycle': { ownedCourseLifecycle: { async sync() {} } }, ...overrides };
  overrides = { ...overrides, './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: {
    async beginRouteIntent() { return { status: 'started', state: {}, previous: null }; },
    async rollbackRouteIntent() { return { status: 'rolled_back' }; },
    async prepareHandoff() { return { status: 'prepared' }; }, async settleHandoff() {},
    async afterHandoff() {}, async confirmArrival() {}, async readState() { return null; }, async readActualDwell() { return {}; }, async finish() {},
    ...overrides['./liveActivity/courseProgressComposition']?.liveCourseProgressRuntime,
  } } };
  const calls = [], paramsUpdates = [], listeners = new Map(), appStateListeners = new Set();
  let routeResult = 'failed', resolveRoute;
  const flow = { activeVerifiedCourse: null, pendingNavigationAction: null, isActiveVerifiedCourseRun(run) { return this.activeVerifiedCourse?.courseRunId === run; }, startActiveVerifiedCourse({ session, course }) { calls.push('start'); return this.activeVerifiedCourse = startActiveVerifiedCourse(session, course, () => 'active', undefined, () => 'run'); }, updateActiveVerifiedCourse(id, fn) { this.activeVerifiedCourse = updateActiveVerifiedCourse(this.activeVerifiedCourse, id, fn); }, clearActiveVerifiedCourse() { calls.push('clear'); this.activeVerifiedCourse = null; }, async refreshPendingNavigationAction() { return this.pendingNavigationAction; } };
  const navigation = { dispatch(action) { calls.push(['dispatch', action]); }, setParams(params) { paramsUpdates.push(params); }, addListener(name, fn) { listeners.set(name, fn); return () => listeners.delete(name); }, replace(...args) { calls.push(['replace', ...args]); }, goBack() { calls.push('back'); } };
  const runtime = screenRuntime({ '@react-navigation/native': { usePreventRemove(prevent, callback) { listeners.set('beforeRemove', event => { if (prevent) { event.preventDefault(); callback({ data: {} }); } }); } }, '../data/busan_poi_catalog.json': catalog, './AppFlowContext': { useActiveVerifiedCourseFlow: () => flow }, './privateWalkConnectorComposition': { appPrivateWalkConnectorPort: null }, './courseCompletionComposition': { courseCompletionRepository: { async complete(input) { calls.push(['complete', input]); return { status: 'created' }; } } }, './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: { async afterHandoff() {}, async confirmArrival() {}, async readState() { return null; }, async readActualDwell() { return {}; }, async finish() {} } }, './liveActivity/courseProgressNotifications': { async prepareLiveCourseNotifications() {} }, './liveActivity/liveActivityDiagnostics': { createDiagnosticAttemptId: () => 'fixture-attempt', async recordLiveActivityAppDiagnostic(value) { calls.push(['diagnostic', value]); } }, './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: { async read() { return null; }, async transition() { return false; }, async clear() {} } }, './execution/schedule': { isKakaoRouteOpenSuccess, isValidKakaoRouteStage, async openKakaoRouteWithFallback(input) { calls.push(['route', input]); return routeResult === 'pending' ? new Promise(r => { resolveRoute = r; }) : routeResult; } }, './mainTabNavigation': { resetToMain() { calls.push('home'); }, resetToActivityRecord() { calls.push('record'); } }, ...overrides });
  runtime.native.AppState = { addEventListener(_name, listener) { appStateListeners.add(listener); return { remove() { appStateListeners.delete(listener); } }; } };
  const { CourseConfirmScreen } = runtime.load('src/ui/CourseConfirmScreen.tsx');
  const screen = runtime.mount(CourseConfirmScreen, { route: { params: { session: selectedSession, course: value } }, navigation });
  return { screen, flow, calls, paramsUpdates, listeners, native: runtime.native, emitAppState: state => appStateListeners.forEach(listener => listener(state)), resume() { const projection = homeActiveCourseProjection(flow.activeVerifiedCourse, id => id); screen.unmount(); return runtime.mount(CourseConfirmScreen, { route: { params: projection.params }, navigation }); }, setRoute: v => { routeResult = v; }, resolve: v => resolveRoute(v) };
}


export { confirmFixture, course, session, settle };
