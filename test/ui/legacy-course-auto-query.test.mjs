import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime } from './support/screenRuntime.mjs';

// 실제 AppFlowProvider의 effect를 실행한다. DB/알림/네이티브는 메모리 포트만 사용.
function harness(initialAccount = null) {
  let account = initialAccount;
  const calls = { legacyReads: 0, restores: 0, ownerResumes: 0 };
  const host = screenRuntime({
    'expo-modules-core': { uuid: { v4: () => 'fixture-uuid' } },
    'expo-notifications': { addNotificationResponseReceivedListener: () => ({ remove() {} }) },
    './AuthContext': { useAuth: () => ({ accountSession: account }) },
    '../services/courseRepository': {
      listSavedCoursesFromRepository: async () => { calls.legacyReads++; return []; },
      removeCourseFromRepository: async () => {},
      replaceCoursePlanInRepository: async value => value,
      saveCourseToRepository: async value => value,
    },
    './activeVerifiedCourseStorage': { activeVerifiedCourseStorage: {
      read: async () => { calls.restores++; return null; }, write: async () => {}, clear: async () => {},
    } },
    './liveActivity/courseProgressComposition': {
      liveCourseProgressRuntime: { reconcile: async () => ({ status: 'missing' }) },
      retryPendingLiveCourseCleanup: async () => {},
    },
    './liveActivity/courseProgressRuntimeModel': { projectVerifiedProgressFromLocal: value => value },
    './liveActivity/courseProgressNotifications': { localProgressEventFromNotificationResponse: () => null },
    './liveActivity/nativeLiveActivityPort': { nativePendingNavigationPort: {
      read: async () => null, subscribe: () => () => {},
    } },
    './liveActivity/liveActivityDiagnostics': {
      createDiagnosticAttemptId: () => 'fixture-attempt', recordLiveActivityAppDiagnostic: async () => {},
    },
    './ownedCourseLifecycle': { ownedCourseLifecycle: {
      resumePending: async () => { calls.ownerResumes++; },
    } },
    './liveActivity/learningEvidenceComposition': { liveLearningEvidence: { retry: async () => {} } },
    './GuestImportPanel': { GuestImportPanel: () => null },
  });
  host.react.createContext = () => ({ Provider: 'FlowProvider' });
  const { AppFlowProvider } = host.load('src/ui/AppFlowContext.tsx');
  const screen = host.mount(AppFlowProvider, { children: null });
  return {
    calls, screen,
    async settle() { for (let i = 0; i < 6; i++) { await Promise.resolve(); screen.render(); } },
    account(next) { account = next; screen.render(); },
    value() { return screen.nodes(n => n.type === 'FlowProvider')[0].props.value; },
  };
}
const account = id => ({ user: { id, is_anonymous: false } });

test('LEGACY-QUERY-01: 비로그인 시작은 과거 조회 없이 현재 복원·owner 재개 유지', async () => {
  const h = harness();
  try {
    await h.settle();
    assert.equal(h.calls.legacyReads, 0);
    assert.equal(h.calls.restores, 1);
    assert.equal(h.calls.ownerResumes, 1);
  } finally { h.screen.unmount(); }
});

test('LEGACY-QUERY-01: 로그인 복원·계정 전환에 과거 저장 코스 자동 조회 없음', async () => {
  const h = harness(account('fixture-a'));
  try {
    await h.settle();
    assert.equal(h.calls.legacyReads, 0, '로그인 복원 시 과거 courses 조회가 실행됨');
    h.account(null); await h.settle();
    h.account(account('fixture-b')); await h.settle();
    assert.equal(h.calls.legacyReads, 0, '재로그인 시 과거 courses 조회가 실행됨');
    assert.equal(h.calls.restores, 1);
    assert.equal(h.calls.ownerResumes, 3);
  } finally { h.screen.unmount(); }
});

test('LEGACY-QUERY-01: 비로그인에서 로그인해도 과거 조회 없이 현재 owner 재개', async () => {
  const h = harness();
  try {
    await h.settle();
    h.account(account('fixture-a')); await h.settle();
    assert.equal(h.calls.legacyReads, 0, '신규 로그인 시 과거 courses 조회가 실행됨');
    assert.equal(h.calls.ownerResumes, 2);
  } finally { h.screen.unmount(); }
});

test('LEGACY-QUERY-01: 전용 과거 상태·API는 노출하지 않고 저장소 조회도 하지 않는다', async () => {
  const h = harness(account('fixture-a'));
  try {
    await h.settle();
    for (const key of ['activeCourse', 'savedCourses', 'isCoursesLoading', 'coursesError', 'refreshSavedCourses', 'saveCourse', 'replaceCourse', 'removeSavedCourse', 'setActiveCourse']) {
      assert.equal(key in h.value(), false, key);
    }
    assert.equal(h.calls.legacyReads, 0);
  } finally { h.screen.unmount(); }
});
