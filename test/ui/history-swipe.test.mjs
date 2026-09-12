import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';
const tick = async () => { for (let n = 0; n < 100; n++) await Promise.resolve(); };
const animated = {
  Value: class { constructor(n) { this.n = n; } setValue(n) { this.n = n; } stopAnimation(cb) { cb?.(this.n); } },
  View: 'AnimatedView',
  spring: (v, { toValue }) => ({ start(cb) { v.setValue(toValue); cb({ finished: true }); } }),
};
const swipe = (screen, id) => { const h = screen.get(`history-swipe-${id}`).props; h.onPanResponderGrant(); h.onPanResponderMove(null, { dx: -60 }); h.onPanResponderRelease(null, { dx: -60 }); };
const menu = (screen, id) => { const h=screen.get(`history-longpress-${id}`).props; h.onPressIn({nativeEvent:{pageX:0,pageY:0}}); h.onLongPress(); };
test('chevron reveals without menu and slow horizontal capture tracks continuously until release', () => {
  let open = false, menus = 0;
  const host = screenRuntime();
  const runtime = screenRuntime({ 'react-native': { ...host.native, Animated: animated, PanResponder: { create: h => ({ panHandlers: h }) } }, '@expo/vector-icons': { Feather: 'Feather' } });
  const Row = runtime.load('src/ui/HistorySwipeRow.tsx').HistorySwipeRow;
  const screen = runtime.mount(() => Row({id:'arrow',open,busy:false,onOpen:()=>{open=true;},onClose:()=>{open=false;},onDelete:()=>{},onMenu:()=>menus++,children:'fixture'}),{});
  screen.press('history-menu-arrow'); screen.render();
  assert.equal(menus,0); assert.equal(open,true);
  const h=screen.get('history-swipe-arrow').props;
  assert.equal(h.onMoveShouldSetPanResponderCapture(null,{dx:7,dy:1}),true);
  assert.equal(h.onMoveShouldSetPanResponderCapture(null,{dx:2,dy:10}),false);
  h.onPanResponderGrant(null,{dx:0});
  const position=h.style[1].transform[0].translateX;
  for (const [dx,expected] of [[3,-69],[9,-63],[5,-67],[15,-57],[10,-62]]) {
    h.onPanResponderMove(null,{dx}); assert.equal(position.n,expected);
  }
  assert.equal(h.onPanResponderTerminationRequest(),false);
});
test('production responder regrabs sampled native position, buffers release, rejects stale completion and busy/terminate input', () => {
  let sample, stopped, completion, target, open = false, busy = false, deletes = 0, closes = 0;
  const host = screenRuntime();
  const runtime = screenRuntime({ 'react-native': { ...host.native, PanResponder: { create: h => ({ panHandlers: h }) }, Animated: {
    View: 'AnimatedView', Value: class { constructor(n) { sample = n; } setValue(n) { sample = n; } stopAnimation(cb) { stopped = cb; } },
    spring: (_v, config) => ({ start(cb) { assert.equal(config.useNativeDriver, true); target = config.toValue; completion = cb; } }),
  } }, '@expo/vector-icons': { Feather: 'Feather' } });
  const Row = runtime.load('src/ui/HistorySwipeRow.tsx').HistorySwipeRow;
  const screen = runtime.mount(() => Row({ id: 'motion', open, busy, onOpen: () => { open = true; }, onClose: () => { closes++; open = false; }, onDelete: () => deletes++, children: 'fixture' }), {});
  const h = screen.get('history-swipe-motion').props;
  assert.equal(h.onMoveShouldSetPanResponder(null, { dx: -20, dy: 30 }), false);
  h.onPanResponderGrant(); h.onPanResponderMove(null, { dx: -50 });
  assert.equal(sample, 0); stopped(0); assert.equal(sample, -50);
  screen.press('history-trash-motion'); assert.equal(deletes, 0, 'not yet settled');
  h.onPanResponderRelease(null, { dx: -50 }); assert.equal(target, -72); assert.equal(sample, -50);
  const stale = completion;
  sample = -60; h.onPanResponderGrant(); h.onPanResponderMove(null, { dx: 10 });
  h.onPanResponderRelease(null, { dx: 12 }); stopped(-60);
  assert.equal(sample, -48); assert.equal(target, -72);
  stale({ finished: true }); assert.equal(closes, 0);
  sample = -72; completion({ finished: true }); screen.press('history-trash-motion'); assert.equal(deletes, 1);
  h.onPanResponderGrant(); h.onPanResponderMove(null, { dx: 30 }); stopped(-72); assert.equal(sample, -42);
  h.onPanResponderMove(null, { dx: 70 }); assert.equal(sample, -2);
  h.onPanResponderTerminate(); assert.equal(target, 0);
  completion({ finished: true }); screen.render(); assert.equal(open, false);
  h.onPanResponderGrant(); const late = stopped; busy = true; screen.render();
  late(-40); h.onPanResponderMove(null, { dx: -20 }); assert.equal(target, 0);
  assert.equal(h.onMoveShouldSetPanResponder(null, { dx: -50, dy: 0 }), false);
});
test('history swipe reveals one action, never deletes on full swipe; vertical scroll stays free', () => {
  let open = false, deletes = 0;
  const host = screenRuntime();
  const runtime = screenRuntime({ 'react-native': { ...host.native, Animated: animated, PanResponder: { create: h => ({ panHandlers: h }) } }, '@expo/vector-icons': { Feather: 'Feather' } });
  const Row = runtime.load('src/ui/HistorySwipeRow.tsx').HistorySwipeRow;
  const screen = runtime.mount(() => Row({ id: 'record-a', open, busy: false, onOpen: () => { open = true; screen.render(); }, onClose: () => { open = false; screen.render(); }, onDelete: () => deletes++, children: '장소 A' }), {});
  const row = screen.get('history-swipe-record-a');
  assert.equal(row.props.onMoveShouldSetPanResponder(null, { dx: -8, dy: 30 }), false);
  assert.equal(row.props.onMoveShouldSetPanResponder(null, { dx: -50, dy: 2 }), true);
  row.props.onPanResponderGrant(); row.props.onPanResponderRelease(null, { dx: -200 });
  assert.equal(deletes, 0);
  screen.press('history-trash-record-a'); assert.equal(deletes, 1);
  row.props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }); assert.equal(deletes, 2);
});

test('account rows use existing confirmation, pending cleanup same request retry, final refresh and account guard', async () => {
  let subject = 'A', buttons, message, confirmations = 0, mode = 'pending', sequence = 0;
  let rows = ['one', 'two'].map(id => ({ completionId: id, courseRunId: id, completedAtMinute: 1, provenance: 'guest_import', learningEligible: false, places: [{ contentId: id, title: id, category: '카페', stopOrdinal: 1 }] }));
  rows[1].places.push({ contentId: 'second-stop', title: '두 번째 장소', category: '문화시설', stopOrdinal: 2 });
  const requests = [], allRequests = [];
  const host = screenRuntime();
  const runtime = screenRuntime({
    'react-native': { ...host.native, Animated: animated, PanResponder: { create: h => ({ panHandlers: h }) }, Alert: { alert: (_t, m, b) => { message = m; buttons = b; confirmations++; } } },
    '@expo/vector-icons': { Feather: 'Feather' }, 'expo-modules-core': { uuid: { v4: () => `fixture-request-${++sequence}` } },
    './AppFlowContext': { useActiveVerifiedCourseFlow: () => ({ activeVerifiedCourse: null }) },
    './AuthContext': { useAuth: () => ({ accountSession: { user: { id: subject } } }) },
    './personalizationComposition': { personalizationSession: { invalidate() {} } },
    './liveActivity/learningEvidenceComposition': { liveLearningEvidence: { close() { throw Error('unrelated learning'); } } },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: { finish() { throw Error('unrelated course'); } } },
    './ownedCourseLifecycle': { ownedCourseLifecycle: { subscribe: () => () => {} } },
    './GuestImportPanel': { GuestImportPanel: 'Import' }, './activity/ActivityStatistics': { ActivityStatistics: 'Statistics' },
  });
  const getPorts = async () => ({
    supabaseAccountIdentityResolver: { resolve: async () => ({ status: 'account', identity: { subject } }) },
    readOwnedDeviceCourseCompletions: async () => ({ status: 'empty', records: [] }),
    supabaseAccountCourseCompletionRepository: { readAccountCourseCompletions: async () => ({ status: 'ok', records: rows }) },
    deleteOwnedAccountRecord: async input => { requests.push(input); if (mode === 'offline') throw Error('fixture offline'); if (mode === 'pending') return { status: 'deleted', cleanup: { status: 'local_cleanup_pending' } }; rows = rows.filter(r => r.completionId !== input.completionId); return { status: 'deleted', cleanup: { status: 'cleaned' } }; },
    deleteAllOwnedAccountRecords: async input => { allRequests.push(input); return { status: 'unavailable' }; },
  });
  const Panel = runtime.load('src/ui/AccountRecordsPanel.tsx').AccountRecordsPanel;
  const screen = runtime.mount(() => Panel({ subject, getPorts }), {}); await tick();
  assert.doesNotMatch(JSON.stringify(screen.render()), /번째 방문 기록 삭제|코스 완료 기록/);
  assert.match(JSON.stringify(screen.get('history-swipe-two')), /두 번째 장소/);
  menu(screen,'two');
  assert.equal(message, undefined, 'menu is not yet the destructive confirmation');
  const menuButtons = buttons;
  menu(screen,'one'); assert.equal(buttons, menuButtons, 'one menu at a time');
  buttons[1].onPress(); assert.match(message, /two.*두 번째 장소/s); assert.equal(requests.length, 0); buttons[0].onPress();
  const long = screen.get('history-longpress-two').props;
  long.onPressIn({nativeEvent:{pageX:0,pageY:0}}); long.onTouchMove({nativeEvent:{pageX:0,pageY:20}});
  const beforeScroll = confirmations; long.onLongPress(); assert.equal(confirmations,beforeScroll);
  long.onPressIn({nativeEvent:{pageX:0,pageY:0}}); long.onLongPress(); long.onLongPress();
  assert.equal(confirmations,beforeScroll+1); buttons[0].onPress();
  long.onPressIn({nativeEvent:{pageX:0,pageY:0}});
  screen.get('history-swipe-two').props.onMoveShouldSetPanResponder(null,{dx:-20,dy:0});
  long.onLongPress(); assert.equal(confirmations,beforeScroll+1);
  menu(screen,'two'); const staleMenu = buttons[1].onPress;
  screen.press('history-filter-문화시설');
  screen.render(); staleMenu(); assert.equal(requests.length,0); assert.equal(message,undefined);
  assert.equal(screen.nodes(n => n.props.testID === 'history-swipe-one').length, 0);
  assert.equal(screen.nodes(n => n.type === 'Statistics')[0].props.summary.completedPlaceCount, 3);
  screen.press('owned-delete-all'); assert.match(message, /카테고리 필터와 관계없이 이 계정의 모든 방문 기록을 삭제합니다/); buttons[0].onPress();
  assert.equal(requests.length, 0);
  screen.press('owned-delete-all'); buttons[1].onPress(); await tick(); screen.render();
  assert.equal(allRequests.length, 1); assert.deepEqual(Object.keys(allRequests[0]), ['requestId']);
  assert.equal(requests.length, 0, 'filtered full deletion must not become per-row deletion');
  screen.press('history-filter-all'); confirmations = 0;
  swipe(screen, 'one'); swipe(screen, 'two');
  assert.equal(screen.nodes(n => n.props.testID?.startsWith('history-trash-')).length, 1);
  screen.press('history-trash-two'); screen.press('history-trash-two'); assert.equal(confirmations, 1);
  assert.match(message, /two.*두 번째 장소/s);
  buttons[0].onPress(); assert.equal(requests.length, 0);
  screen.press('history-trash-two'); buttons[1].onPress(); await tick();
  assert.equal(requests[0].completionId, 'two'); assert.match(JSON.stringify(screen.render()), /기기 정리가 남았어요/);
  screen.press('history-filter-문화시설');
  mode = 'clean'; swipe(screen, 'two'); screen.press('history-trash-two'); buttons[1].onPress(); await tick();
  screen.render(); await tick();
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(screen.nodes(n => n.props.testID === 'history-swipe-two').length, 0);
  assert.equal(screen.get('history-filter-all').props.accessibilityState.selected, true);
  assert.equal(screen.nodes(n => n.type === 'Statistics')[0].props.summary.completedPlaceCount, 1);
  screen.get('history-swipe-one').props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } });
  const stale = buttons[1].onPress; screen.press('history-filter-카페'); subject = 'B'; screen.render(); await tick(); stale(); await tick();
  assert.equal(requests.length, 2);
  assert.equal(screen.get('history-filter-all').props.accessibilityState.selected, true);
  subject = 'A'; screen.render(); await tick();
  mode = 'offline'; screen.get('history-swipe-one').props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }); buttons[1].onPress(); buttons[1].onPress(); await tick();
  assert.equal(requests.length, 3); assert.ok(screen.get('history-swipe-one'));
  assert.match(JSON.stringify(screen.render()), /기록을 임의로 지우지 않았습니다/);
  mode = 'clean'; screen.get('history-swipe-one').props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }); buttons[1].onPress(); await tick(); screen.render(); await tick();
  assert.equal(requests[2].requestId, requests[3].requestId);
  assert.equal(screen.nodes(n => n.type === 'Statistics').length, 0);
  assert.equal(screen.get('owned-delete-all').props.disabled, true);
  assert.match(JSON.stringify(screen.render()), /이 계정에 저장된 방문 기록이 없어요/);
});
