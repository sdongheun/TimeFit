import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

function homeWithSession(session) {
  const activeVerifiedCourse = { identity: 'active-1', courseRunId: 'run-1', session, course: { id: 'course-1', placeIds: ['poi_live'] }, progress: {} };
  const runtime = screenRuntime({
    '../data/busan_poi_catalog.json': { matched: { data: [{ contentId: 'poi_live', title: '오래된 번들 이름' }] }, unmatched: { data: [] } },
    './AppFlowContext': { useAppFlow: () => ({ activeVerifiedCourse }) },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './mainTabNavigation': { resetToActivityRecord() {}, resetToNearbyBrowse() {}, resetToProfile() {} },
    '@expo/vector-icons': { Feather: 'Feather' },
  });
  return runtime.mount(runtime.load('src/ui/HomeScreen.tsx').HomeScreen, { navigation: { navigate() {} } });
}

test('live resumed course uses its preserved selected place name, not stale bundled catalog', () => {
  const session = { nowIso: '2026-09-22T05:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35, lon: 129 }, destination: null, remainingMin: 120, arrivalBufferMin: 10,
    __livePlaceSnapshotId: 'snapshot-1', __liveSelectedPlaces: [{ contentId: 'poi_live', title: '현재 선택한 이름', lat: 35.1, lon: 129.1, category: '관광지', subCategory: null, shortStay: null }] };
  const screen = homeWithSession(session);
  const title = screen.nodes(node => node.type === 'Text' && node.props.children === '현재 선택한 이름')[0];
  assert.ok(title, 'Home must display the session-owned selected title');
  assert.doesNotMatch(JSON.stringify(screen.get('home-active-course')), /오래된 번들 이름/);
  screen.unmount();
});

test('legacy pre-cutover resumed course retains the existing bundled title', () => {
  const session = { nowIso: '2026-09-22T05:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35, lon: 129 }, destination: null, remainingMin: 120, arrivalBufferMin: 10 };
  const screen = homeWithSession(session);
  assert.match(JSON.stringify(screen.get('home-active-course')), /오래된 번들 이름/);
  screen.unmount();
});

test('missing live selected identity never resurrects a stale bundled title', () => {
  const session = { nowIso: '2026-09-22T05:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35, lon: 129 }, destination: null, remainingMin: 120, arrivalBufferMin: 10,
    __livePlaceSnapshotId: 'snapshot-1', __liveSelectedPlaces: [] };
  const screen = homeWithSession(session);
  assert.match(JSON.stringify(screen.get('home-active-course')), /현재 V1 코스/);
  assert.doesNotMatch(JSON.stringify(screen.get('home-active-course')), /오래된 번들 이름/);
  screen.unmount();
});
