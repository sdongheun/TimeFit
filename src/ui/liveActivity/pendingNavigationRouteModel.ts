import type { ActiveVerifiedCourse } from '../activeVerifiedCourseModel';
import type { RootStackParamList } from '../nav';
import type { PendingNavigationAction } from './pendingNavigationHandoffModel';

export function pendingNavigationRouteTarget(
  active: ActiveVerifiedCourse | null,
  pending: PendingNavigationAction | null,
  current: Readonly<{ name: string; params?: unknown }> | undefined,
): RootStackParamList['CourseConfirm'] | null {
  if (!active || !pending || pending.state !== 'pending' || pending.courseRunId !== active.courseRunId) return null;
  const currentActiveId = current?.name === 'CourseConfirm' && current.params && typeof current.params === 'object'
    ? (current.params as { activeId?: unknown }).activeId : undefined;
  if (currentActiveId === active.identity) return null;
  return { session: active.session, course: active.course, activeId: active.identity };
}

export function createPendingNavigationRouteGate() {
  let routedActionId: string | null = null;
  return {
    next(active: ActiveVerifiedCourse | null, pending: PendingNavigationAction | null, current: Readonly<{ name: string; params?: unknown }> | undefined) {
      if (!pending || pending.state !== 'pending') routedActionId = null;
      if (pending && routedActionId === pending.actionId) return null;
      const target = pendingNavigationRouteTarget(active, pending, current);
      if (target && pending) routedActionId = pending.actionId;
      return target;
    },
  };
}
