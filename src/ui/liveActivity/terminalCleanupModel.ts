import type { LiveActivityIdentity } from './lifecyclePolicy';

export const TERMINAL_CLEANUP_SCHEMA_VERSION = 1 as const;

type CleanupJob = Readonly<{
  courseRunId: string;
  activityResolved: boolean;
  activity: LiveActivityIdentity | null;
  notificationsResolved: boolean;
  notificationIds: readonly string[];
}>;

type CleanupQueue = Readonly<{ schemaVersion: 1; jobs: readonly CleanupJob[] }>;

export type TerminalCleanupDependencies = Readonly<{
  storage: Readonly<{ read: () => Promise<string | null>; write: (raw: string) => Promise<void> }>;
  activity: Readonly<{ resolve: (courseRunId: string) => Promise<LiveActivityIdentity | null>; endExact: (target: LiveActivityIdentity) => Promise<void> }>;
  notification: Readonly<{ listOwned: (courseRunId: string) => Promise<readonly string[]>; cancelExact: (notificationId: string, courseRunId: string) => Promise<void> }>;
}>;

const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

function decode(raw: string | null): CleanupQueue | null | 'unreadable' {
  if (raw === null) return { schemaVersion: 1, jobs: [] };
  try {
    const value = JSON.parse(raw) as CleanupQueue;
    if (value?.schemaVersion !== 1 || !Array.isArray(value.jobs)) return 'unreadable';
    const valid = value.jobs.every(job => validText(job.courseRunId)
      && typeof job.activityResolved === 'boolean'
      && (job.activity === null || (validText(job.activity.activityId) && job.activity.purpose === 'course_progress'
        && job.activity.courseRunId === job.courseRunId && job.activity.schemaVersion === 1 && Number.isInteger(job.activity.revision)))
      && typeof job.notificationsResolved === 'boolean'
      && Array.isArray(job.notificationIds) && job.notificationIds.every(validText));
    return valid ? value : 'unreadable';
  } catch { return 'unreadable'; }
}

export function createTerminalCleanupController(dependencies: TerminalCleanupDependencies) {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(work: () => Promise<T>) => {
    const result = tail.then(work, work);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
  const read = async () => decode(await dependencies.storage.read());
  const persist = (queue: CleanupQueue) => dependencies.storage.write(JSON.stringify(queue));

  const retry = async (onlyCourseRunId?: string) => {
    const decoded = await read();
    if (decoded === 'unreadable') return { status: 'storage_unreadable' as const };
    if (!decoded) return { status: 'storage_unreadable' as const };
    let queue = decoded;
    const targetRuns = queue.jobs.filter(job => !onlyCourseRunId || job.courseRunId === onlyCourseRunId).map(job => job.courseRunId);
    for (const courseRunId of targetRuns) {
      let job = queue.jobs.find(item => item.courseRunId === courseRunId);
      if (!job) continue;
      if (!job.activityResolved) {
        try { job = { ...job, activity: await dependencies.activity.resolve(courseRunId), activityResolved: true }; } catch { /* 다음 lifecycle 접근에서 재시도 */ }
        queue = { ...queue, jobs: queue.jobs.map(item => item.courseRunId === courseRunId ? job! : item) };
        await persist(queue);
      }
      if (!job.notificationsResolved) {
        try { job = { ...job, notificationIds: [...new Set(await dependencies.notification.listOwned(courseRunId))], notificationsResolved: true }; } catch { /* 다음 lifecycle 접근에서 재시도 */ }
        queue = { ...queue, jobs: queue.jobs.map(item => item.courseRunId === courseRunId ? job! : item) };
        await persist(queue);
      }
      if (job.activityResolved && job.activity) {
        try {
          await dependencies.activity.endExact(job.activity);
          job = { ...job, activity: null };
          queue = { ...queue, jobs: queue.jobs.map(item => item.courseRunId === courseRunId ? job! : item) };
          await persist(queue);
        } catch { /* exact identity를 보존해 재시도 */ }
      }
      for (const notificationId of [...job.notificationIds]) {
        try {
          await dependencies.notification.cancelExact(notificationId, courseRunId);
          job = { ...job, notificationIds: job.notificationIds.filter(id => id !== notificationId) };
          queue = { ...queue, jobs: queue.jobs.map(item => item.courseRunId === courseRunId ? job! : item) };
          await persist(queue);
        } catch { /* 실패 ID만 보존 */ }
      }
      if (job.activityResolved && job.notificationsResolved && job.activity === null && job.notificationIds.length === 0) {
        queue = { ...queue, jobs: queue.jobs.filter(item => item.courseRunId !== courseRunId) };
        await persist(queue);
      }
    }
    const pending = onlyCourseRunId ? queue.jobs.some(job => job.courseRunId === onlyCourseRunId) : queue.jobs.length > 0;
    return { status: pending ? 'pending' as const : 'clean' as const };
  };

  return {
    prepare(courseRunId: string) {
      return serial(async () => {
        if (!validText(courseRunId)) return { status: 'invalid_input' as const };
        const decoded = await read();
        if (decoded === 'unreadable' || !decoded) return { status: 'storage_unreadable' as const };
        if (decoded.jobs.some(job => job.courseRunId === courseRunId)) return { status: 'already_prepared' as const };
        let activity: LiveActivityIdentity | null = null;
        let activityResolved = false;
        let notificationIds: readonly string[] = [];
        let notificationsResolved = false;
        try { activity = await dependencies.activity.resolve(courseRunId); activityResolved = true; } catch { /* identity resolution stays pending */ }
        try { notificationIds = [...new Set(await dependencies.notification.listOwned(courseRunId))]; notificationsResolved = true; } catch { /* owned ID resolution stays pending */ }
        await persist({ ...decoded, jobs: [...decoded.jobs, { courseRunId, activityResolved, activity, notificationsResolved, notificationIds }] });
        return { status: 'prepared' as const };
      });
    },
    retry(courseRunId: string) { return serial(() => retry(courseRunId)); },
    retryAll() { return serial(() => retry()); },
  };
}
