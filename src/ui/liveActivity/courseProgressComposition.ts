import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiveActivityLifecycleController, type CourseProgressPayload } from './lifecyclePolicy';
import { nativeLiveActivityLifecyclePort, nativeLiveProgressStoragePort } from './nativeLiveActivityPort';
import { createLiveCourseProgressController } from './courseProgressRuntimeModel';
import { cancelLiveCourseNotificationExact, listOwnedLiveCourseNotificationIds, liveCourseNotificationPort } from './courseProgressNotifications';
import type { LocalProgressActivityPort, LocalProgressState } from './localProgressModel';
import { createTerminalCleanupController } from './terminalCleanupModel';
import { recordLiveActivityAppDiagnostic } from './liveActivityDiagnostics';
import { liveLearningEvidence } from './learningEvidenceComposition';

const lifecycle = createLiveActivityLifecycleController(nativeLiveActivityLifecyclePort);
const payload = (state: LocalProgressState): CourseProgressPayload => ({
  purpose: 'course_progress', schemaVersion: 1, courseRunId: state.courseRunId,
  stopId: state.activeStopId ?? 'final-destination', revision: state.revision,
  completionEligible: state.phase === 'traveling' && state.route?.targetKind === 'final_destination' && !state.handoffPreparation && state.terminalAtMs === null,
  phase: state.phase === 'arrival_pending' || state.phase === 'dwelling' || state.phase === 'departure_due' ? state.phase : 'traveling',
  targetTitle: state.route?.targetTitle ?? state.stops.find(stop => stop.stopId === state.activeStopId)?.title ?? '코스 진행',
  arrivalPromptAtMs: state.route?.arrivalPromptAtMs ?? null,
  nextBoundaryAtMs: state.route?.nextBoundaryAtMs ?? state.finalArrivalAtMs,
  departureReminderAtMs: state.route?.departureReminderAtMs ?? null,
  snoozeUsed: state.activeStopId ? state.stops.find(stop => stop.stopId === state.activeStopId)?.snoozeUsed ?? false : false,
});

const activity: LocalProgressActivityPort = {
  async start(state) {
    const result = await lifecycle.startCourseProgress(payload(state));
    if (result.status !== 'started' && result.status !== 'already_active') throw new Error(`live_activity_${result.status}`);
  },
  async update(state) {
    const value = payload(state);
    const result = await lifecycle.updateCourseProgress(value);
    if (result.status === 'not_found') {
      const started = await lifecycle.startCourseProgress(value);
      if (started.status !== 'started' && started.status !== 'already_active') throw new Error(`live_activity_${started.status}`);
    } else if (result.status !== 'updated' && result.status !== 'ignored_old_revision') throw new Error(`live_activity_${result.status}`);
  },
  async end(state) {
    const exact = (await nativeLiveActivityLifecyclePort.listActivities()).find(item => item.purpose === 'course_progress' && item.courseRunId === state.courseRunId);
    if (!exact) return;
    const result = await lifecycle.endCourseProgress(exact);
    if (result.status !== 'ended' && result.status !== 'not_found' && result.status !== 'already_ended') throw new Error(`live_activity_${result.status}`);
  },
};

const TERMINAL_CLEANUP_KEY = '@timefit/live-course-terminal-cleanup-v1';
const terminalCleanup = createTerminalCleanupController({
  storage: {
    read: () => AsyncStorage.getItem(TERMINAL_CLEANUP_KEY),
    write: raw => AsyncStorage.setItem(TERMINAL_CLEANUP_KEY, raw),
  },
  activity: {
    async resolve(courseRunId) {
      return (await nativeLiveActivityLifecyclePort.listActivities()).find(item => item.purpose === 'course_progress' && item.courseRunId === courseRunId) ?? null;
    },
    async endExact(target) {
      const result = await lifecycle.endCourseProgress(target);
      if (result.status !== 'ended' && result.status !== 'already_ended' && result.status !== 'not_found') throw new Error(`live_activity_${result.status}`);
    },
  },
  notification: {
    listOwned: listOwnedLiveCourseNotificationIds,
    cancelExact: cancelLiveCourseNotificationExact,
  },
});

export const liveCourseProgressRuntime = createLiveCourseProgressController({
  storage: nativeLiveProgressStoragePort,
  activity,
  notification: liveCourseNotificationPort,
  cleanup: terminalCleanup,
  diagnostic: value => { void recordLiveActivityAppDiagnostic(value).catch(() => undefined); },
  learning: {
    capture: liveLearningEvidence.capture,
    consume: liveLearningEvidence.consume,
    restore: state => liveLearningEvidence.restore(state.courseRunId, state.stops.map((s, i) => ({ stopId: s.stopId, stopOrdinal: (i + 1) as 1 | 2, contentId: s.placeId }))),
    close: liveLearningEvidence.close,
  },
});

export const retryPendingLiveCourseCleanup = () => terminalCleanup.retryAll();
