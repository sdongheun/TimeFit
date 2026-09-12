import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { createRequire } from 'node:module';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);

test('MAP02 pair pending has real loading feedback and cannot select stale candidates', () => {
  const host = screenRuntime(); host.native.ActivityIndicator = 'ActivityIndicator';
  const screen = host.mount(host.load('src/ui/recommendation/TwoStopSelectionPanel.tsx').TwoStopSelectionPanel, {
    state: { loading: true }, pairEnabled: true, regionMode: 'pair_loading', candidates: [{ placeId: 'stale', title: '이전 후보' }], onContinue() {}, onSelectCandidate() { throw Error('stale candidate selected'); }, selectedPairCourse: null,
  });
  assert.match(JSON.stringify(screen.render()), /함께 들를 곳을 찾고 있어요/);
  assert.equal(screen.nodes(n => n.type === 'ActivityIndicator').length, 1);
  assert.doesNotMatch(JSON.stringify(screen.render()), /이전 후보/);
  screen.unmount();
});

test('UMANUAL camera absent without valid selected point', () => {
  const host = screenRuntime();
  for (const point of [undefined, { lat: NaN, lon: 129 }, { lat: 91, lon: 129 }]) {
    const screen = host.mount(host.load('src/ui/MapCameraButton.tsx').MapCameraButton, { point, onCamera() { throw Error('must not move'); } });
    assert.equal(screen.nodes(n => n.type === 'Pressable').length, 0); screen.unmount();
  }
});

test('MAP02 review details are explicit, credited while collapsed, reset across courses, never gate active actions', () => {
  const model = { courseMin: 40, originLabel: '출발', destinationLabel: '약속', arrivalBufferMin: 10, legs: [{ mode: 'walk', min: 10 }, { mode: 'walk', min: 10 }], stops: [{ placeId: 'a', place: { title: '긴 장소 '.repeat(20), lat: 35, lon: 129 }, activityLabel: '문화시설', stayLabel: '둘러보기 약 20분' }] };
  const host = screenRuntime();
  const props = { model, mode: 'review', onOpenKakao() {}, expansionKey: 'one' };
  const screen = host.mount(host.load('src/ui/recommendation/CourseV1VerticalDetail.tsx').CourseV1VerticalDetail, props);
  assert.equal(screen.get('course-detail-toggle-a').props.accessibilityState.expanded, false);
  assert.doesNotMatch(JSON.stringify(screen.render()), /둘러보기 약/);
  screen.press('course-detail-toggle-a'); assert.match(JSON.stringify(screen.render()), /둘러보기 약 20분/);
  props.expansionKey = 'two'; screen.render();
  assert.equal(screen.get('course-detail-toggle-a').props.accessibilityState.expanded, false);
  props.mode = 'active'; screen.render(); assert.equal(screen.nodes(n => n.props.testID === 'course-detail-toggle-a').length, 0);
  assert.doesNotMatch(JSON.stringify(screen.render()), /둘러보기 약/);
  screen.unmount();
});

test('MAP02 reason mapping distinguishes supply/time/route/unavailable and leaves unknown undecided', () => {
  const { courseV1OutcomeMessage } = require('../../src/ui/recommendation/courseV1OutcomeMessageModel.ts');
  const values = ['no_eligible_candidates', 'no_open_candidates', 'time_budget_exceeded', 'route_not_verified', 'route_verification_unavailable'].map(courseV1OutcomeMessage);
  assert.equal(new Set(values).size, 5);
  assert.match(values[4], /잠시 후 다시 시도/);
  assert.equal(courseV1OutcomeMessage('unknown'), undefined);
});

test('MAP02 actual empty Results renders evidence-specific copy and a consistently padded reset action', () => {
  const { courseV1OutcomeMessage } = require('../../src/ui/recommendation/courseV1OutcomeMessageModel.ts');
  for (const reason of ['no_eligible_candidates', 'no_open_candidates', 'time_budget_exceeded', 'route_not_verified', 'route_verification_unavailable', undefined]) {
    let back = 0;
    const host = screenRuntime({ '../data/busan_poi_catalog.json': { matched: { data: [] }, unmatched: { data: [] } }, '@react-navigation/native': { useFocusEffect() {}, useIsFocused: () => true, usePreventRemove() {} }, './recommendation/v1Session': { getTwoStopSelectionPort: () => null }, './personalizationComposition': { personalizationSession: { version: () => 0, subscribe: () => () => {} }, isPersonalizationScopeCurrent: () => true } });
    const screen = host.mount(host.load('src/ui/ResultsScreen.tsx').ResultsScreen, { route: { params: { session: { nowIso: '2026-09-08T03:00:00Z', remainingMin: 120 }, result: { representativeCourse: null, alternativeCourses: [], resultState: 'no_verified_course_within_limit', primaryOutcomeReason: reason } } }, navigation: { goBack() { back++; }, addListener: () => () => {} } });
    const expected = courseV1OutcomeMessage(reason) ?? '설정한 시간 안에 들를 수 있는 장소를 찾지 못했어요.';
    assert.ok(screen.nodes(n => n.type === 'Text' && n.props.children === expected).length);
    const reset = screen.nodes(n => n.type === 'Pressable' && JSON.stringify(n.props.children).includes('시간과 위치 다시 설정'))[0];
    assert.equal(reset.props.style.width, '100%'); assert.ok(reset.props.style.paddingVertical >= 14); reset.props.onPress(); assert.equal(back, 1);
    if (reason === 'route_verification_unavailable') assert.doesNotMatch(JSON.stringify(screen.render()), /장소가 부족|운영 중인/);
    screen.unmount();
  }
});

test('UMANUAL camera uses current selected point and disabled prevents movement', () => {
  const moved = [];
  const host = screenRuntime();
  const props = { point: { lat: 35, lon: 129 }, onCamera: p => moved.push(p) };
  const screen = host.mount(host.load('src/ui/MapCameraButton.tsx').MapCameraButton, props);
  screen.press('map-camera-current');
  props.point = { lat: 36, lon: 128 }; screen.render(); screen.press('map-camera-current');
  props.disabled = true; screen.render(); screen.get('map-camera-current').props.onPress();
  assert.deepEqual(moved, [{ lat: 35, lon: 129 }, { lat: 36, lon: 128 }]); screen.unmount();
});
test('MAP02 return: embedded map camera honors map-local top, full screen retains safe area', () => {
  const host = screenRuntime({ __process: { env: { EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture' } }, 'react-native-webview': { WebView: 'WebView' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }) } });
  const props = { points: [{ lat: 35, lon: 129 }], line: [], cameraTop: 12 };
  const screen = host.mount(host.load('src/ui/KakaoRouteMap.tsx').KakaoRouteMap, props);
  screen.nodes(n => n.type === 'WebView')[0].props.onMessage({ nativeEvent: { data: JSON.stringify({ type: 'ready' }) } });
  screen.render();
  assert.equal(screen.nodes(n => n.type === 'MapCameraButton')[0].props.style.top, 12);
  props.cameraTop = undefined; screen.render();
  assert.equal(screen.nodes(n => n.type === 'MapCameraButton')[0].props.style.top, 71);
  screen.unmount();
});

test('MAP02 return: progress has centered intrinsic shared columns, not a left-aligned wide block', () => {
  const host = screenRuntime();
  host.native.Easing = { quad: x => x, inOut: x => x };
  host.native.Animated.Value = class { setValue() {} stopAnimation() {} interpolate() { return 1; } };
  const screen = host.mount(host.load('src/ui/recommendation/RecommendationLoadingProgress.tsx').RecommendationLoadingProgress, { stage: 'verifying' });
  assert.equal(screen.get('recommendation-progress').props.style.alignItems, 'center');
  assert.equal(screen.get('recommendation-progress-columns').props.style.alignSelf, 'center');
  assert.equal(screen.get('recommendation-progress-columns').props.style.width, undefined);
  const labels = screen.nodes(n => n.type === 'Text');
  for (const label of labels) { assert.equal(label.props.style[0].flex, undefined); assert.equal(label.props.style[0].flexShrink, 1); }
  screen.unmount();
});
