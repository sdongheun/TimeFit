import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { LocalProgressState } from './localProgressModel';
import type { LocalProgressEvent } from './localProgressModel';

const REGISTRY_KEY = '@timefit/live-course-notifications-v2';
const LEGACY_REGISTRY_KEY = '@timefit/live-course-notifications-v1';
const EXPLANATION_KEY = '@timefit/live-course-notification-explanation-v1';
const ARRIVAL_CATEGORY = 'timefit-course-arrival-v1';
const DEPARTURE_CATEGORY = 'timefit-course-departure-v1';

type RunRegistry = Readonly<{ courseRunId: string; revision: number; synced: boolean; notificationIds: readonly string[] }>;
type Registry = Readonly<{ schemaVersion: 2; runs: readonly RunRegistry[] }>;
let notificationTail: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>) {
  const result = notificationTail.then(work, work);
  notificationTail = result.then(() => undefined, () => undefined);
  return result;
}
const validRun = (value: RunRegistry) => typeof value?.courseRunId === 'string' && value.courseRunId.length > 0
  && Number.isInteger(value.revision) && typeof value.synced === 'boolean'
  && Array.isArray(value.notificationIds) && value.notificationIds.every(id => typeof id === 'string' && id.length > 0);
const readRegistry = async (): Promise<Registry> => {
  const raw = await AsyncStorage.getItem(REGISTRY_KEY);
  if (raw !== null) {
    try {
      const value = JSON.parse(raw) as Registry;
      if (value?.schemaVersion === 2 && Array.isArray(value.runs) && value.runs.every(validRun)) return value;
    } catch { /* fall through to fail closed */ }
    throw new Error('live_notification_registry_unreadable');
  }
  const legacyRaw = await AsyncStorage.getItem(LEGACY_REGISTRY_KEY);
  if (legacyRaw === null) return { schemaVersion: 2, runs: [] };
  try {
    const legacy = JSON.parse(legacyRaw) as Omit<RunRegistry, 'synced'>;
    if (typeof legacy?.courseRunId !== 'string' || !Number.isInteger(legacy.revision) || !Array.isArray(legacy.notificationIds)) throw new Error();
    return { schemaVersion: 2, runs: [{ ...legacy, synced: true }] };
  } catch { throw new Error('live_notification_registry_unreadable'); }
};
const writeRegistry = (registry: Registry) => AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
const replaceRun = (registry: Registry, run: RunRegistry | null): Registry => ({
  ...registry,
  runs: [...registry.runs.filter(item => item.courseRunId !== run?.courseRunId), ...(run ? [run] : [])],
});

function trigger(atMs: number): Notifications.NotificationTriggerInput {
  return atMs <= Date.now() ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(atMs) };
}

export const liveCourseNotificationPort = {
  sync(state: LocalProgressState) { return serial(async () => {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    let registry = await readRegistry();
    const previous = registry.runs.find(item => item.courseRunId === state.courseRunId);
    if (previous?.revision === state.revision && previous.synced) return;
    let retainedIds = previous?.notificationIds ?? [];
    for (const id of [...retainedIds]) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
        retainedIds = retainedIds.filter(value => value !== id);
        registry = replaceRun(registry, { courseRunId: state.courseRunId, revision: state.revision, synced: false, notificationIds: retainedIds });
        await writeRegistry(registry);
      } catch { /* 실패 ID는 새 예약과 함께 계속 소유한다. */ }
    }
    await Notifications.setNotificationCategoryAsync(ARRIVAL_CATEGORY, [
      { identifier: 'arrival_confirmed', buttonTitle: '도착했어요' },
    ]);
    await Notifications.setNotificationCategoryAsync(DEPARTURE_CATEGORY, [
      { identifier: 'departure_confirmed', buttonTitle: '이제 출발해요' },
    ]);
    let run: RunRegistry = { courseRunId: state.courseRunId, revision: state.revision, synced: false, notificationIds: retainedIds };
    registry = replaceRun(registry, run);
    await writeRegistry(registry);
    const scheduleOwned = async (request: Notifications.NotificationRequestInput) => {
      const id = await Notifications.scheduleNotificationAsync(request);
      run = { ...run, notificationIds: [...new Set([...run.notificationIds, id])] };
      registry = replaceRun(registry, run);
      await writeRegistry(registry);
    };
    if ((state.phase === 'traveling' || state.phase === 'arrival_pending') && state.activeStopId && state.route?.arrivalPromptAtMs) {
      await scheduleOwned({
        content: { title: state.route.targetTitle, body: '도착했다면 알려주세요.', categoryIdentifier: ARRIVAL_CATEGORY,
          data: { purpose: 'course_progress', courseRunId: state.courseRunId, stopId: state.activeStopId, revision: state.revision, nextBoundaryAtMs: state.route.nextBoundaryAtMs } },
        trigger: trigger(state.route.arrivalPromptAtMs),
      });
    }
    if (state.activeStopId && state.route?.departureReminderAtMs && state.phase !== 'completed') {
      await scheduleOwned({
        content: { title: '다음 이동을 준비할 시간이에요', body: '출발할 때 확인해 주세요.', categoryIdentifier: DEPARTURE_CATEGORY,
          data: { purpose: 'course_progress', courseRunId: state.courseRunId, stopId: state.activeStopId, revision: state.revision } },
        trigger: trigger(state.route.departureReminderAtMs),
      });
    }
    run = { ...run, synced: true };
    await writeRegistry(replaceRun(registry, run));
  }); },
  cancelOwned(courseRunId: string) { return serial(async () => {
    let registry = await readRegistry();
    let run = registry.runs.find(item => item.courseRunId === courseRunId);
    if (!run) return;
    let failed = false;
    for (const id of [...run.notificationIds]) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
        run = { ...run, notificationIds: run.notificationIds.filter(value => value !== id) };
        registry = replaceRun(registry, run);
        await writeRegistry(registry);
      } catch { failed = true; }
    }
    if (failed) throw new Error('live_notification_cancel_partial');
    await writeRegistry({ ...registry, runs: registry.runs.filter(item => item.courseRunId !== courseRunId) });
  }); },
};

export function listOwnedLiveCourseNotificationIds(courseRunId: string) {
  return serial(async () => {
    const registryIds = (await readRegistry()).runs.find(item => item.courseRunId === courseRunId)?.notificationIds ?? [];
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const pendingIds = pending.filter(request => {
      const data = request.content.data as Record<string, unknown>;
      return data.purpose === 'course_progress' && data.courseRunId === courseRunId;
    }).map(request => request.identifier);
    return [...new Set([...registryIds, ...pendingIds])];
  });
}

export function cancelLiveCourseNotificationExact(notificationId: string, courseRunId: string) {
  return serial(async () => {
    let registry = await readRegistry();
    const run = registry.runs.find(item => item.courseRunId === courseRunId);
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const pendingOwned = pending.some(request => {
      const data = request.content.data as Record<string, unknown>;
      return request.identifier === notificationId && data.purpose === 'course_progress' && data.courseRunId === courseRunId;
    });
    if ((!run || !run.notificationIds.includes(notificationId)) && !pendingOwned) return;
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    const remaining = run?.notificationIds.filter(id => id !== notificationId) ?? [];
    registry = !run || remaining.length === 0
      ? { ...registry, runs: registry.runs.filter(item => item.courseRunId !== courseRunId) }
      : replaceRun(registry, { ...run, notificationIds: remaining });
    await writeRegistry(registry);
  });
}

export function localProgressEventFromNotificationResponse(response: Notifications.NotificationResponse, occurredAtMs = Date.now()): LocalProgressEvent | null {
  const data = response.notification.request.content.data as Record<string, unknown>;
  const action = response.actionIdentifier;
  if (data.purpose !== 'course_progress' || typeof data.courseRunId !== 'string' || typeof data.stopId !== 'string'
    || !Number.isInteger(data.revision) || !['arrival_confirmed', 'arrival_snoozed', 'departure_confirmed'].includes(action)) return null;
  const common = { courseRunId: data.courseRunId, stopId: data.stopId, baseRevision: data.revision as number,
    eventId: `notification:${response.notification.request.identifier}:${action}`, occurredAtMs, source: 'notification_action' as const };
  if (action === 'arrival_snoozed') {
    if (typeof data.nextBoundaryAtMs !== 'number') return null;
    return { ...common, type: action, nextBoundaryAtMs: data.nextBoundaryAtMs };
  }
  return { ...common, type: action as 'arrival_confirmed' | 'departure_confirmed' };
}

/** 첫 실제 길찾기 직전에만 설명하며, 거절·오류도 길찾기를 막지 않는다. */
export async function prepareLiveCourseNotifications(confirm: () => Promise<boolean>): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'denied') return;
    if (await AsyncStorage.getItem(EXPLANATION_KEY)) return;
    await AsyncStorage.setItem(EXPLANATION_KEY, 'shown');
    if (await confirm()) await Notifications.requestPermissionsAsync();
  } catch { /* 로컬 알림은 실제 route handoff의 선행 조건이 아니다. */ }
}
