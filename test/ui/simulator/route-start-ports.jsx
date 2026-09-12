import React, { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { createLiveCourseProgressController } from '../../../src/ui/liveActivity/courseProgressRuntimeModel';
import { startActiveVerifiedCourse, updateActiveVerifiedCourse } from '../../../src/ui/activeVerifiedCourseModel';
import { openKakaoRouteWithFallback as realOpen, isKakaoRouteOpenSuccess, isValidKakaoRouteStage } from '../../../src/ui/execution/schedule';
export { isKakaoRouteOpenSuccess, isValidKakaoRouteStage };
const listeners = new Set(); let version = 0; let raw = null;
export const fixture = { mode: 'web', browser: false, close: null, calls: [], run: 0 };
export function emit() { version++; listeners.forEach(fn => fn()); }
export function useFixture() { useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => version); return fixture; }
const flow = {
  activeVerifiedCourse: null, pendingNavigationAction: null,
  isActiveVerifiedCourseRun(run) { return this.activeVerifiedCourse?.courseRunId === run; },
  startActiveVerifiedCourse(input) { this.activeVerifiedCourse = startActiveVerifiedCourse(input.session, input.course, () => 'fixture-active', undefined, () => `fixture-run-${++fixture.run}`); emit(); return this.activeVerifiedCourse; },
  updateActiveVerifiedCourse(id, updater) { this.activeVerifiedCourse = updateActiveVerifiedCourse(this.activeVerifiedCourse, id, updater); emit(); },
  clearActiveVerifiedCourse() { this.activeVerifiedCourse = null; emit(); },
  async refreshPendingNavigationAction() { return null; },
};
export function resetFixture() { raw = null; flow.activeVerifiedCourse = null; fixture.calls = []; fixture.browser = false; emit(); }
export function useActiveVerifiedCourseFlow() { useFixture(); return flow; }
export const liveCourseProgressRuntime = createLiveCourseProgressController({
  storage: { async read() { return raw; }, async write(value) { raw = value; fixture.calls.push('save'); emit(); }, async clear() { raw = null; }, async listReceipts() { return []; }, async acknowledgeReceipt() {} },
  activity: { async start() { fixture.calls.push('activity'); emit(); }, async update() { fixture.calls.push('update'); emit(); }, async end() { fixture.calls.push('end'); emit(); } },
  notification: { async sync() { fixture.calls.push('notify'); emit(); }, async cancelOwned() { fixture.calls.push('cancel'); emit(); } },
});
export async function openKakaoRouteWithFallback(stage, mode) {
  fixture.calls.push('open'); emit();
  return realOpen(stage, mode, {
    canOpenApp: async () => fixture.mode === 'app', openApp: async () => {},
    openWeb: async () => { throw Error('fixture external web unavailable'); },
    openBrowser: async () => {
      if (fixture.mode === 'failed') throw Error('fixture browser failed');
      fixture.browser = true; emit();
      return new Promise(resolve => { fixture.close = () => { fixture.browser = false; emit(); resolve({ type: 'dismiss' }); }; });
    },
    observeAppState: () => () => {},
  });
}
export const appPrivateWalkConnectorPort = null;
export const courseCompletionRepository = { async complete() { fixture.calls.push('complete'); emit(); return { status: 'created' }; } };
export const ownedCourseLifecycle = { async sync() {} };
export const nativePendingNavigationPort = { async read() { return null; }, async transition() { return false; }, async clear() {} };
export async function prepareLiveCourseNotifications() {}
export function createDiagnosticAttemptId() { return 'fixture'; }
export async function recordLiveActivityAppDiagnostic() {}
export function isPersonalizationScopeCurrent() { return true; }
export const personalizationSession = { version: () => 0 };
export function usePreventRemove() {}
export function resetToMain() {}
export function resetToActivityRecord() {}
export function KakaoRouteMap() { return <View style={{ height: 100, backgroundColor: '#293447', justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: 'white' }}>고정 지도 fixture · 실제 API 0</Text></View>; }
