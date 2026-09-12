export const LIVE_ACTIVITY_SCHEMA_VERSION = 1 as const;
export const A3_FIXTURE_RUN_ID = 'timefit-a3-fixture-v1';
export const LEGACY_FIXTURE_RUN_IDS = ['a3-fixture-run'] as const;

export type LiveActivityPurpose = 'test_fixture' | 'course_progress';
export type LiveActivityIdentity = Readonly<{
  activityId: string;
  purpose: LiveActivityPurpose | 'unknown';
  courseRunId: string;
  schemaVersion: number;
  revision: number;
}>;

export type CourseProgressPayload = Readonly<{
  purpose: 'course_progress';
  schemaVersion: 1;
  courseRunId: string;
  stopId: string;
  revision: number;
  phase?: 'traveling' | 'arrival_pending' | 'dwelling' | 'departure_due';
  targetTitle: string;
  arrivalPromptAtMs: number | null;
  nextBoundaryAtMs: number;
  departureReminderAtMs: number | null;
  snoozeUsed?: boolean;
  completionEligible?: boolean;
}>;

export type TestFixturePayload = Readonly<{
  purpose: 'test_fixture';
  schemaVersion: 1;
  courseRunId: typeof A3_FIXTURE_RUN_ID;
  stopId: 'stop:a3-busan-citizens-park';
  revision: 1;
  phase?: 'traveling';
  targetTitle: '부산시민공원';
  arrivalPromptAtMs: number;
  nextBoundaryAtMs: number;
  departureReminderAtMs: null;
}>;

type StartedResult = Readonly<{
  status: 'started';
  activity: LiveActivityIdentity;
  applicationState?: string;
}>;
export type NativeStartResult = StartedResult
  | Readonly<{ status: 'already_active'; activity: LiveActivityIdentity; applicationState?: string }>
  | Readonly<{ status: 'conflict'; conflictingRunId?: string }>
  | Readonly<{ status: 'cleanup_required' | 'invalid_input' | 'disabled' | 'busy' }>;

export type LiveActivityLifecycleNativePort = Readonly<{
  listActivities: () => Promise<readonly LiveActivityIdentity[]>;
  startFixture: (payload: TestFixturePayload) => Promise<NativeStartResult>;
  startCourseProgress: (payload: CourseProgressPayload) => Promise<NativeStartResult>;
  updateCourseProgress: (payload: CourseProgressPayload & Readonly<{ activityId: string }>) => Promise<Readonly<{ status: 'updated'; activity: LiveActivityIdentity }>>;
  endActivityExact: (identity: LiveActivityIdentity) => Promise<Readonly<{ status: 'ended' | 'already_ended' | 'identity_mismatch' | 'end_failed' }>>;
}>;

function validIdentityText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

function validTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validCoursePayload(payload: CourseProgressPayload): boolean {
  return payload?.purpose === 'course_progress'
    && payload.schemaVersion === LIVE_ACTIVITY_SCHEMA_VERSION
    && validIdentityText(payload.courseRunId)
    && payload.courseRunId !== A3_FIXTURE_RUN_ID
    && !LEGACY_FIXTURE_RUN_IDS.includes(payload.courseRunId as typeof LEGACY_FIXTURE_RUN_IDS[number])
    && validIdentityText(payload.stopId)
    && validIdentityText(payload.targetTitle)
    && Number.isInteger(payload.revision) && payload.revision >= 1
    && ['traveling', 'arrival_pending', 'dwelling', 'departure_due'].includes(payload.phase ?? 'traveling')
    && (payload.arrivalPromptAtMs === null || validTime(payload.arrivalPromptAtMs))
    && validTime(payload.nextBoundaryAtMs)
    && (payload.departureReminderAtMs === null || validTime(payload.departureReminderAtMs))
    && (payload.snoozeUsed === undefined || typeof payload.snoozeUsed === 'boolean');
}

export function isManagedTestFixture(item: LiveActivityIdentity): boolean {
  return item.purpose === 'test_fixture'
    && item.schemaVersion === LIVE_ACTIVITY_SCHEMA_VERSION
    && (item.courseRunId === A3_FIXTURE_RUN_ID || LEGACY_FIXTURE_RUN_IDS.includes(item.courseRunId as typeof LEGACY_FIXTURE_RUN_IDS[number]));
}

export function buildA3FixturePayload(nowMs = Date.now()): TestFixturePayload {
  return {
    purpose: 'test_fixture',
    schemaVersion: LIVE_ACTIVITY_SCHEMA_VERSION,
    courseRunId: A3_FIXTURE_RUN_ID,
    stopId: 'stop:a3-busan-citizens-park',
    revision: 1,
    phase: 'traveling',
    targetTitle: '부산시민공원',
    arrivalPromptAtMs: nowMs + 15 * 60_000,
    nextBoundaryAtMs: nowMs + 45 * 60_000,
    departureReminderAtMs: null,
  };
}

export function createLiveActivityLifecycleController(port: LiveActivityLifecycleNativePort) {
  let tail: Promise<void> = Promise.resolve();
  const serial = <T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.then(job, job);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };

  return {
    startTestFixture(nowMs = Date.now()) {
      return serial(async () => {
        const activities = await port.listActivities();
        if (activities.some(isManagedTestFixture)) return { status: 'cleanup_required' as const };
        return port.startFixture(buildA3FixturePayload(nowMs));
      });
    },

    cleanupTestFixtures() {
      return serial(async () => {
        const targets = (await port.listActivities()).filter(isManagedTestFixture);
        if (targets.length === 0) return { status: 'already_ended' as const, endedActivityIds: [], failedActivityIds: [] };
        const endedActivityIds: string[] = [];
        const failedActivityIds: string[] = [];
        for (const target of targets) {
          try {
            const result = await port.endActivityExact(target);
            if (result.status === 'ended' || result.status === 'already_ended') endedActivityIds.push(target.activityId);
            else failedActivityIds.push(target.activityId);
          } catch {
            failedActivityIds.push(target.activityId);
          }
        }
        const remaining = new Set((await port.listActivities()).filter(isManagedTestFixture).map(item => item.activityId));
        for (const id of endedActivityIds.splice(0)) {
          if (remaining.has(id)) failedActivityIds.push(id);
          else endedActivityIds.push(id);
        }
        return {
          status: failedActivityIds.length === 0 ? 'ended' as const : 'partial_failure' as const,
          endedActivityIds,
          failedActivityIds: [...new Set(failedActivityIds)],
        };
      });
    },

    startCourseProgress(payload: CourseProgressPayload) {
      return serial(async () => {
        if (!validCoursePayload(payload)) return { status: 'invalid_input' as const };
        const courses = (await port.listActivities()).filter(item => item.purpose === 'course_progress');
        const conflict = courses.find(item => item.courseRunId !== payload.courseRunId);
        if (conflict) return { status: 'conflict' as const, conflictingRunId: conflict.courseRunId };
        const same = courses.find(item => item.courseRunId === payload.courseRunId && item.schemaVersion === payload.schemaVersion);
        if (same) return { status: 'already_active' as const, activity: same };
        return port.startCourseProgress(payload);
      });
    },

    updateCourseProgress(payload: CourseProgressPayload) {
      return serial(async () => {
        if (!validCoursePayload(payload)) return { status: 'invalid_input' as const };
        const courses = (await port.listActivities()).filter(item => item.purpose === 'course_progress');
        const conflict = courses.find(item => item.courseRunId !== payload.courseRunId);
        if (conflict) return { status: 'conflict' as const, conflictingRunId: conflict.courseRunId };
        const same = courses.find(item => item.courseRunId === payload.courseRunId && item.schemaVersion === payload.schemaVersion);
        if (!same) return { status: 'not_found' as const };
        if (payload.revision <= same.revision) return { status: 'ignored_old_revision' as const, activity: same };
        return port.updateCourseProgress({ ...payload, activityId: same.activityId });
      });
    },

    endCourseProgress(identity: LiveActivityIdentity) {
      return serial(async () => {
        if (identity.purpose !== 'course_progress' || !validIdentityText(identity.activityId) || !validIdentityText(identity.courseRunId) || identity.courseRunId === A3_FIXTURE_RUN_ID) {
          return { status: 'invalid_input' as const };
        }
        const activities = await port.listActivities();
        const exact = activities.find(item => item.activityId === identity.activityId
          && item.purpose === 'course_progress'
          && item.courseRunId === identity.courseRunId
          && item.schemaVersion === identity.schemaVersion);
        if (!exact) return { status: 'not_found' as const };
        return port.endActivityExact(exact);
      });
    },
  };
}
