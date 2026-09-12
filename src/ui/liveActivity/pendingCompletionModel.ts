import type { ActiveVerifiedCourse } from '../activeVerifiedCourseModel';
import type { VerifiedCourseProgressStep } from '../recommendation/verifiedCourseProgressModel';
import type { LocalProgressState } from './localProgressModel';
import type { PendingNavigationAction, PendingNavigationNativePort } from './pendingNavigationHandoffModel';

export function canFinishFromPending(action: PendingNavigationAction, active: ActiveVerifiedCourse, local: LocalProgressState, steps: readonly VerifiedCourseProgressStep[]) {
  const current = steps[active.progress.stepIndex];
  return action.purpose === 'course_progress_completion' && action.stopId === 'final-destination'
    && active.courseRunId === action.courseRunId && local.courseRunId === action.courseRunId
    && local.revision === action.baseRevision && local.terminalAtMs === null && local.phase === 'traveling'
    && !local.handoffPreparation && local.route?.targetKind === 'final_destination'
    && current?.kind === 'travel' && current.isFinal && active.progress.routeOpened
    && local.stops.length === active.course.placeIds.length
    && local.stops.every((stop, i) => stop.placeId === active.course.placeIds[i]);
}

export function createPendingCompletionController(native: PendingNavigationNativePort) {
  let busy = false;
  const completed = new Set<string>();
  return {
    async consume(input: { action: PendingNavigationAction; active: ActiveVerifiedCourse; local: LocalProgressState; steps: readonly VerifiedCourseProgressStep[]; isCurrent: () => boolean; authorize: () => Promise<boolean>; finish: () => Promise<boolean> }) {
      const { action } = input;
      if (completed.has(action.actionId) || action.state === 'success' || action.state === 'failure') return 'ignored';
      if (busy) return 'busy';
      if (!input.isCurrent() || !canFinishFromPending(action, input.active, input.local, input.steps)) return 'invalid';
      busy = true;
      try {
        if (!await input.authorize() || !input.isCurrent()) return 'invalid';
        if (!await native.transition(action, action.state, 'executing') || !input.isCurrent()) return 'invalid';
        const finished = await input.finish();
        const executing = { ...action, state: 'executing' as const };
        if (!finished) { await native.transition(executing, 'executing', 'failure').catch(() => false); return 'failed'; }
        // The normal finish path may already have exact-cleaned the pending file.
        completed.add(action.actionId);
        await native.clear(executing);
        return 'finished';
      } finally { busy = false; }
    },
  };
}
