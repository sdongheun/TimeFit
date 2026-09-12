import type { ActiveVerifiedCourse } from '../activeVerifiedCourseModel';
import type { VerifiedCourseProgressStep } from '../recommendation/verifiedCourseProgressModel';
import type { LocalProgressState } from './localProgressModel';
import { hasManualLocationProof } from '../manualLocationRestoreModel';

export type PendingNavigationState = 'pending' | 'executing' | 'success' | 'failure';
export type PendingNavigationAction = Readonly<{
  schemaVersion: 1;
  purpose: 'course_progress_navigation' | 'course_progress_completion';
  actionId: string;
  courseRunId: string;
  stopId: string;
  baseRevision: number;
  state: PendingNavigationState;
}>;

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

/** Native가 만든 최소 capability만 받는다. 공개 URL·좌표가 섞이면 fail closed 한다. */
export function decodePendingNavigationAction(value: unknown): PendingNavigationAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const exactKeys = ['actionId', 'baseRevision', 'courseRunId', 'purpose', 'schemaVersion', 'state', 'stopId'];
  if (Object.keys(item).sort().join('|') !== exactKeys.sort().join('|') || item.schemaVersion !== 1 || !['course_progress_navigation', 'course_progress_completion'].includes(String(item.purpose))
    || !text(item.actionId) || !text(item.courseRunId) || !text(item.stopId) || !Number.isInteger(item.baseRevision) || (item.baseRevision as number) < 1
    || !['pending', 'executing', 'success', 'failure'].includes(String(item.state))) return null;
  return item as PendingNavigationAction;
}

export type PendingNavigationNativePort = Readonly<{
  transition: (action: PendingNavigationAction, from: PendingNavigationState, to: PendingNavigationState) => Promise<boolean>;
  clear: (action: PendingNavigationAction) => Promise<void>;
}>;

type ConsumeInput = Readonly<{
  action: PendingNavigationAction;
  active: ActiveVerifiedCourse;
  local: LocalProgressState;
  steps: readonly VerifiedCourseProgressStep[];
  open: (travel: Extract<VerifiedCourseProgressStep, { kind: 'travel' }>) => Promise<boolean>;
  onOpened: (travel: Extract<VerifiedCourseProgressStep, { kind: 'travel' }>, travelStepIndex: number) => Promise<void>;
}>;

function verifiedNextTravel(input: ConsumeInput) {
  const { action, active, local, steps } = input;
  if (action.purpose !== 'course_progress_navigation' || active.courseRunId !== action.courseRunId || local.courseRunId !== action.courseRunId || local.terminalAtMs !== null
    || local.phase !== 'traveling' || local.revision < action.baseRevision + 1 || !local.processedEventIds.includes(action.actionId)) return null;
  const stopIndex = local.stops.findIndex(stop => stop.stopId === action.stopId && stop.departedAtMs !== null);
  if (stopIndex < 0 || local.activeStopId !== action.stopId || active.course.placeIds[stopIndex] !== local.stops[stopIndex]?.placeId) return null;
  const stay = steps[stopIndex * 2];
  const next = steps[stopIndex * 2 + 2];
  if (stay?.kind !== 'travel' || stay.target.id !== local.stops[stopIndex]?.placeId || next?.kind !== 'travel'
    || next.from.id !== stay.target.id || next.isFinal !== (stopIndex === local.stops.length - 1)) return null;
  return { travel: next, travelStepIndex: stopIndex * 2 + 2 };
}

export function createPendingNavigationHandoffController(native: PendingNavigationNativePort) {
  let inFlightRequest: string | null = null;
  const consumedActionIds = new Set<string>();
  return {
    async consume(input: ConsumeInput, trigger: 'automatic' | 'retry') {
      if (!hasManualLocationProof(input.active.session)) return { status: 'manual_location_required' as const };
      const { action, active, local } = input;
      // Idempotency must never hide a different run or a terminal/expired local course.
      if (action.purpose !== 'course_progress_navigation' || active.courseRunId !== action.courseRunId
        || local.courseRunId !== action.courseRunId || local.terminalAtMs !== null
        || ['completed', 'cancelled', 'expired', 'incomplete'].includes(local.phase)) return { status: 'invalid' as const };
      const request = JSON.stringify([active.identity, action.purpose, action.courseRunId, action.actionId, action.stopId, action.baseRevision]);
      if (consumedActionIds.has(request)) return { status: 'not_pending' as const };
      // beginRouteIntent changes activeStopId (null for the final destination) before
      // external open settles. A re-render of this exact request isn't a new departure.
      if (inFlightRequest === request) return { status: 'busy' as const };
      const currentState = input.action.state;
      if (trigger === 'automatic' && currentState === 'executing') return { status: 'success_unknown' as const };
      if (trigger === 'automatic' && currentState !== 'pending') return { status: 'not_pending' as const };
      if (trigger === 'retry' && currentState !== 'failure' && currentState !== 'executing') return { status: 'not_retryable' as const };
      const verified = verifiedNextTravel(input);
      if (!verified) return { status: 'invalid' as const };
      inFlightRequest = request;
      try {
        if (!await native.transition(input.action, currentState, 'executing')) return { status: 'not_pending' as const };
        let opened = false;
        try { opened = await input.open(verified.travel); } catch { opened = false; }
        if (!opened) {
          await native.transition({ ...input.action, state: 'executing' }, 'executing', 'failure').catch(() => false);
          return { status: 'failed' as const };
        }
        // 외부 앱 실행 뒤 프로세스가 여기 오기 전에 끝나면 native state=executing이므로 다음 시작에서 자동 반복하지 않는다.
        await input.onOpened(verified.travel, verified.travelStepIndex);
        const executing = { ...input.action, state: 'executing' as const };
        if (await native.transition(executing, 'executing', 'success').catch(() => false)) {
          await native.clear({ ...executing, state: 'success' });
        }
        consumedActionIds.add(request);
        return { status: 'opened' as const, travel: verified.travel, travelStepIndex: verified.travelStepIndex };
      } finally {
        if (inFlightRequest === request) inFlightRequest = null;
      }
    },
  };
}
