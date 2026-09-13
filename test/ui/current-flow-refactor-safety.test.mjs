import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { StackRouter, CommonActions } from '@react-navigation/routers';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
const { startActiveVerifiedCourse, homeActiveCourseProjection, updateActiveVerifiedCourse } = require('../../src/ui/activeVerifiedCourseModel.ts');
const { buildCompleteCourseInput, createCourseCompletionFinishController } = require('../../src/ui/courseCompletionUiModel.ts');

// 출시 동작의 보존 계약. legacy 화면의 존재나 내부 코드 문자열은 요구하지 않는다.
const session = {
  nowIso: '2026-09-12T06:00:00.000Z', remainingMin: 180, arrivalBufferMin: 10,
  origin: { id: 'origin', label: '수동 출발지', lat: 35.15, lon: 129.05 },
  destination: { id: 'destination', label: '수동 도착지', lat: 35.16, lon: 129.06 },
};
function activeCourse(count = 1) {
  const placeIds = ['p1', 'p2'].slice(0, count);
  const endpoints = ['origin', ...placeIds, 'destination'];
  const course = {
    id: 'fixture-course', placeIds,
    stops: placeIds.map((placeId, i) => ({ placeId, stayMin: 20,
      stayState: 'recommended', availabilityState: 'structured_verified',
      arrivalAt: `2026-09-12T06:${i ? '40' : '10'}:00.000Z`,
      departureAt: i ? '2026-09-12T07:00:00.000Z' : '2026-09-12T06:30:00.000Z' })),
    legs: endpoints.slice(1).map((toId, i) => ({ fromId: endpoints[i], toId, mode: 'walk', min: 10 })),
    stayMin: count * 20, travelMin: (count + 1) * 10, totalMin: count * 30 + 10,
    arrivalBufferMin: 10, remainingAfterCourseMin: 170 - count * 30,
    remainingAfterArrivalBufferMin: 160 - count * 30,
  };
  return startActiveVerifiedCourse(session, course, () => 'fixture-active', undefined, () => 'fixture-run');
}
const pending = (overrides = {}) => ({ schemaVersion: 1, purpose: 'course_progress_navigation',
  actionId: 'fixture-action', courseRunId: 'fixture-run', stopId: 'stop:0:p1',
  baseRevision: 1, state: 'pending', ...overrides });

function bridgeHarness(active, action, ready = true, current = { name: 'Home' }) {
  const flow = { activeVerifiedCourse: active, pendingNavigationAction: action };
  const calls = [];
  const host = screenRuntime({ '../AppFlowContext': { useAppFlow: () => flow } });
  const { PendingNavigationRouteBridge } = host.load('src/ui/liveActivity/PendingNavigationRouteBridge.tsx');
  const props = { ready, navigation: { getCurrentRoute: () => current, navigate: (...args) => calls.push(args) } };
  const screen = host.mount(PendingNavigationRouteBridge, props);
  return { flow, calls, props, screen };
}

for (const count of [1, 2]) test(`REFACTOR-SAFE: ${count}곳 코스는 과거 상태 없이 동일 진행·순서로 홈 이어가기`, () => {
  const initial = activeCourse(count);
  const progress = { stepIndex: 2, routeOpened: true, finished: false };
  const active = updateActiveVerifiedCourse(initial, initial.identity, () => progress);
  const target = homeActiveCourseProjection(active, id => `장소 ${id}`);
  assert.equal(target.kind, 'verified');
  assert.equal(target.target, 'CourseConfirm');
  assert.equal(target.params.activeId, initial.identity);
  assert.equal(active.courseRunId, initial.courseRunId);
  assert.deepEqual(target.progress, progress);
  assert.deepEqual(target.params.course.placeIds, initial.course.placeIds);
  assert.deepEqual(target.params.session, session);
});

test('REFACTOR-SAFE: Live Activity 요청은 준비 후 현재 코스로 한 번 연결하고 새 요청은 허용', () => {
  const h = bridgeHarness(activeCourse(), pending(), false);
  assert.equal(h.calls.length, 0);
  h.props.ready = true; h.screen.render();
  assert.deepEqual(h.calls, [['CourseConfirm', {
    session, course: h.flow.activeVerifiedCourse.course, activeId: 'fixture-active',
  }]]);
  h.flow.pendingNavigationAction = { ...h.flow.pendingNavigationAction };
  h.screen.render();
  assert.equal(h.calls.length, 1);
  h.flow.pendingNavigationAction = pending({ actionId: 'next-action' });
  h.screen.render();
  assert.equal(h.calls.length, 2);
  h.screen.unmount();
});

test('REFACTOR-SAFE: 다른 코스·종료 요청·활성 코스 없음은 화면을 열지 않음', () => {
  for (const [active, action] of [
    [null, pending()], [activeCourse(), null],
    [activeCourse(), pending({ courseRunId: 'old-run' })],
    [activeCourse(), pending({ state: 'success' })],
    [activeCourse(), pending({ state: 'failure' })],
  ]) {
    const h = bridgeHarness(active, action);
    assert.deepEqual(h.calls, []); h.screen.unmount();
  }
});

test('REFACTOR-SAFE: 현재 코스 화면 중복 진입 방지와 완료 요청의 앱 복귀', () => {
  const h = bridgeHarness(activeCourse(), pending(), true,
    { name: 'CourseConfirm', params: { activeId: 'fixture-active' } });
  assert.deepEqual(h.calls, []); h.screen.unmount();
  const completion = bridgeHarness(activeCourse(), pending({ purpose: 'course_progress_completion', state: 'executing' }));
  assert.equal(completion.calls.length, 1);
  assert.equal(completion.calls[0][0], 'CourseConfirm');
  completion.screen.unmount();
});

test('REFACTOR-SAFE: 현재 완료 연결은 owner lifecycle로 입력·실패를 그대로 전달', async () => {
  const seen = [];
  const host = screenRuntime({ './ownedCourseLifecycle': { ownedCourseLifecycle: {
    complete: async input => { seen.push(input); return { status: 'storage_unavailable' }; },
  } } });
  const { courseCompletionRepository } = host.load('src/ui/courseCompletionComposition.ts');
  const projection = buildCompleteCourseInput(activeCourse(2), id => ({ contentId: id, title: id, category: '문화시설' }),
    Date.parse('2026-09-12T07:10:00.000Z'), { p1: 17 });
  assert.equal(projection.status, 'ready');
  assert.deepEqual(projection.input.places.map(p => p.actualDwellMin), [17, null]);
  assert.deepEqual(projection.input.places.map(p => p.contentId), ['p1', 'p2']);
  assert.deepEqual(await courseCompletionRepository.complete(projection.input), { status: 'storage_unavailable' });
  assert.deepEqual(seen, [projection.input]);
});

test('REFACTOR-SAFE: 완료 실패는 진행 유지, 재시도 성공만 기록 탭으로 이동하며 뒤로 복귀 불가', async () => {
  const router = StackRouter({ initialRouteName: 'Home' });
  const options = { routeNames: ['Home', 'TimeSetup', 'Results', 'PlaceDetail', 'CourseConfirm', 'ActivityRecord'], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  const navigation = { dispatch(action) { state = router.getStateForAction(state, action, options) ?? state; } };
  for (const name of ['TimeSetup', 'Results', 'CourseConfirm']) navigation.dispatch(CommonActions.navigate(name));
  const host = screenRuntime({ '@react-navigation/native': { CommonActions } });
  const { resetToActivityRecord } = host.load('src/ui/mainTabNavigation.ts');
  const projection = buildCompleteCourseInput(activeCourse(), id => ({ contentId: id, title: id, category: '문화시설' }), Date.parse('2026-09-12T07:00:00.000Z'));
  assert.equal(projection.status, 'ready');
  const inputs = []; let finished = 0;
  const controller = createCourseCompletionFinishController({
    complete: async input => { inputs.push(input); return inputs.length === 1
      ? { status: 'storage_unavailable' } : { status: 'already_completed', record: { ...input, schemaVersion: 1, completionId: 'fixture-completion' } }; },
    onStateChange() {}, onFinish(result) { assert.equal(result.recorded, true); finished++; resetToActivityRecord(navigation); },
  });
  await controller.finish(projection.input);
  assert.equal(controller.getState().kind, 'failure');
  assert.equal(state.routes.at(-1).name, 'CourseConfirm');
  assert.equal(finished, 0);
  await controller.finish(projection.input);
  await controller.finish(projection.input);
  assert.equal(finished, 1); assert.equal(inputs.length, 2);
  assert.equal(inputs[0].courseRunId, inputs[1].courseRunId);
  navigation.dispatch(CommonActions.goBack());
  assert.deepEqual(state.routes.map(r => r.name), ['ActivityRecord']);
});

for (const authKind of ['guest', 'account']) test(`LEGACY-SCREEN-SAFE: ${authKind} 홈은 과거 상태 없이 설정·현재 코스·계정·탭 이동 가능`, () => {
  const calls = [];
  const active = activeCourse(2);
  const host = screenRuntime({
    '@expo/vector-icons': { Feather: 'Icon' },
    '@react-navigation/native': { CommonActions },
    './mainTabNavigation': screenRuntime({ '@react-navigation/native': { CommonActions } }).load('src/ui/mainTabNavigation.ts'),
    './AppFlowContext': { useAppFlow: () => ({ activeVerifiedCourse: active }) },
    './AuthContext': { useAuth: () => ({ authKind }) },
    './FloatingTabBar': { FloatingTabBar: 'TabBar' },
    '../data/busan_poi_catalog.json': { matched: { data: [] }, unmatched: { data: [] } },
  });
  const navigation = { navigate: (...args) => calls.push(args), dispatch: action => calls.push([action.payload.routes[0].name]) };
  const screen = host.mount(host.load('src/ui/HomeScreen.tsx').HomeScreen, { navigation });
  try {
    screen.press('home-profile-entry');
    const buttons = screen.nodes(n => n.type === 'Pressable');
    buttons.find(n => n.props.children?.props?.children === '자투리 시간 설정하기').props.onPress();
    buttons.find(n => n.props.accessibilityLabel?.includes('이어가기')).props.onPress();
    const tab = screen.nodes(n => n.type === 'TabBar')[0];
    tab.props.onCourse(); tab.props.onRecord(); tab.props.onProfile();
    assert.deepEqual(calls.map(c => c[0]), [authKind === 'account' ? 'Profile' : 'Login', 'TimeSetup', 'CourseConfirm', 'NearbyBrowse', 'ActivityRecord', 'Profile']);
    assert.equal(calls[2][1].activeId, active.identity);
    assert.deepEqual(calls[2][1].course.placeIds, ['p1', 'p2']);
  } finally { screen.unmount(); }
});

test('LEGACY-SCREEN-SAFE: 과거 네 route가 없는 실제 router에서 상세 왕복·모든 탭 reset 유지', () => {
  const router = StackRouter({ initialRouteName: 'Home' });
  const options = { routeNames: ['Home', 'TimeSetup', 'Results', 'PlaceDetail', 'CourseConfirm', 'NearbyBrowse', 'ActivityRecord', 'Profile', 'ProfileManagement', 'Login'], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  const navigation = { dispatch(action) {
    const next = router.getStateForAction(state, action, options);
    if (next) state = router.getRehydratedState(next, options);
  } };
  for (const name of ['TimeSetup', 'Results']) navigation.dispatch(CommonActions.navigate(name));
  const resultsKey = state.routes.at(-1).key;
  for (const name of ['PlaceDetail', 'CourseConfirm']) {
    navigation.dispatch(CommonActions.navigate(name));
    assert.equal(state.routes.at(-1).name, name);
    navigation.dispatch(CommonActions.goBack());
    assert.equal(state.routes.at(-1).key, resultsKey);
  }
  const host = screenRuntime({ '@react-navigation/native': { CommonActions } });
  const tabs = host.load('src/ui/mainTabNavigation.ts');
  for (const [reset, expected] of [[tabs.resetToMain, 'Home'], [tabs.resetToNearbyBrowse, 'NearbyBrowse'], [tabs.resetToActivityRecord, 'ActivityRecord'], [tabs.resetToProfile, 'Profile']]) {
    reset(navigation); navigation.dispatch(CommonActions.goBack());
    assert.deepEqual(state.routes.map(r => r.name), [expected]);
  }
});
