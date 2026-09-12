import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { LearningNativePort } from './learningEvidenceCoordinator';
import type { LearningEvidenceProjectionV1 } from '../../services/liveLearningEvidence';
import type { LiveActivityA3Fixture } from './a3VerificationModel';
import type {
  CourseProgressPayload,
  LiveActivityIdentity,
  LiveActivityLifecycleNativePort,
  NativeStartResult,
  TestFixturePayload,
} from './lifecyclePolicy';
import { decodePendingNavigationAction, type PendingNavigationAction, type PendingNavigationState } from './pendingNavigationHandoffModel';

type NativeLifecycleModule = Readonly<{
  setLearningEvidenceRun?: (run: string) => boolean;
  readLearningEvidence?: (run: string) => LearningEvidenceProjectionV1 | null;
  readLearningEvidenceScope?: () => string | null;
  storePreparedLearningEvidence?: (p: LearningEvidenceProjectionV1) => Promise<LearningEvidenceProjectionV1>;
  activateLearningEvidence?: (p: LearningEvidenceProjectionV1) => Promise<LearningEvidenceProjectionV1>;
  clearLearningEvidence?: (run: string) => Promise<void>;
  activitySupport?: () => Promise<Readonly<{ supported?: boolean; enabled?: boolean; appGroupIdentifier?: string }>>;
  listActivities?: () => Promise<readonly unknown[]>;
  startFixture?: (fixture: TestFixturePayload) => Promise<unknown>;
  startCourseProgress?: (payload: CourseProgressPayload) => Promise<unknown>;
  updateCourseProgress?: (payload: CourseProgressPayload & Readonly<{ activityId: string }>) => Promise<unknown>;
  endFixtureExact?: (identity: LiveActivityIdentity) => Promise<unknown>;
  endCourseProgress?: (identity: LiveActivityIdentity) => Promise<unknown>;
  readLocalProgress?: () => Promise<unknown>;
  writeLocalProgress?: (raw: string) => Promise<void>;
  clearLocalProgress?: () => Promise<void>;
  listLocalProgressReceipts?: () => Promise<readonly unknown[]>;
  acknowledgeLocalProgressReceipt?: (eventId: string) => Promise<void>;
  readPendingNavigationAction?: () => Promise<unknown>;
  revokeCompletionActions?: () => Promise<void>;
  transitionPendingNavigationAction?: (value: Readonly<{ actionId: string; courseRunId: string; from: PendingNavigationState; to: PendingNavigationState }>) => Promise<unknown>;
  clearPendingNavigationAction?: (value: Readonly<{ actionId: string; courseRunId: string }>) => Promise<void>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}>;

function isText(value: unknown): value is string { return typeof value === 'string' && value.length > 0; }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('live_activity_native_response_invalid');
  return value as Record<string, unknown>;
}
function identity(value: unknown): LiveActivityIdentity {
  const item = record(value);
  if (!isText(item.activityId) || !isText(item.courseRunId) || !Number.isInteger(item.schemaVersion) || !Number.isInteger(item.revision)
    || !['test_fixture', 'course_progress', 'unknown'].includes(String(item.purpose))) throw new Error('live_activity_native_identity_invalid');
  return {
    activityId: item.activityId,
    purpose: item.purpose as LiveActivityIdentity['purpose'],
    courseRunId: item.courseRunId,
    schemaVersion: item.schemaVersion as number,
    revision: item.revision as number,
  };
}
function startResult(value: unknown): NativeStartResult {
  const item = record(value);
  if (item.status === 'started' || item.status === 'already_active') return {
    status: item.status,
    activity: identity(item.activity),
    applicationState: isText(item.applicationState) ? item.applicationState : undefined,
  };
  if (item.status === 'conflict') return { status: 'conflict' as const, conflictingRunId: isText(item.conflictingRunId) ? item.conflictingRunId : undefined };
  if (['cleanup_required', 'invalid_input', 'disabled', 'busy'].includes(String(item.status))) {
    return { status: item.status as 'cleanup_required' | 'invalid_input' | 'disabled' | 'busy' };
  }
  throw new Error('live_activity_native_response_invalid');
}

export function createNativeLiveActivityLifecyclePort(input: Readonly<{
  platform: string;
  internal: boolean;
  module: NativeLifecycleModule | null;
}>): LiveActivityLifecycleNativePort {
  const requireModule = () => {
    if (input.platform !== 'ios' || !input.module) throw new Error('live_activity_native_module_unavailable');
    return input.module;
  };
  return {
    async listActivities() {
      const method = requireModule().listActivities;
      if (!method) throw new Error('live_activity_list_unavailable');
      const result = await method();
      if (!Array.isArray(result)) throw new Error('live_activity_native_response_invalid');
      return result.map(identity);
    },
    async startFixture(payload) {
      if (!input.internal) throw new Error('live_activity_fixture_entry_release_blocked');
      const method = requireModule().startFixture;
      if (!method) throw new Error('live_activity_fixture_entry_unavailable');
      return startResult(await method(payload));
    },
    async startCourseProgress(payload) {
      const method = requireModule().startCourseProgress;
      if (!method) throw new Error('live_activity_course_start_unavailable');
      return startResult(await method(payload));
    },
    async updateCourseProgress(payload) {
      const method = requireModule().updateCourseProgress;
      if (!method) throw new Error('live_activity_course_update_unavailable');
      const result = record(await method(payload));
      if (result.status !== 'updated') throw new Error(`live_activity_native_${String(result.status ?? 'response_invalid')}`);
      return { status: 'updated', activity: identity(result.activity) };
    },
    async endActivityExact(value) {
      const module = requireModule();
      const method = value.purpose === 'test_fixture'
        ? (input.internal ? module.endFixtureExact : undefined)
        : module.endCourseProgress;
      if (!method) throw new Error(value.purpose === 'test_fixture' ? 'live_activity_fixture_entry_release_blocked' : 'live_activity_course_end_unavailable');
      const result = record(await method(value));
      if (!['ended', 'already_ended', 'identity_mismatch', 'end_failed'].includes(String(result.status))) throw new Error('live_activity_native_response_invalid');
      return { status: result.status as 'ended' | 'already_ended' | 'identity_mismatch' | 'end_failed' };
    },
  };
}

const module = (NativeModules.TimeFitLiveActivityModule as NativeLifecycleModule | undefined) ?? null;
export const nativeLearningEvidencePort: LearningNativePort = {
  setActiveRun(run) { if (!module?.setLearningEvidenceRun?.(run)) throw Error('learning_unavailable'); },
  readActive: run => module?.readLearningEvidence?.(run) ?? null,
  readScope: () => module?.readLearningEvidenceScope?.() ?? null,
  async storePrepared(p) { if (!module?.storePreparedLearningEvidence) throw Error('learning_unavailable'); return module.storePreparedLearningEvidence(p); },
  async activate(p) { if (!module?.activateLearningEvidence) throw Error('learning_unavailable'); return module.activateLearningEvidence(p); },
  async clearExact(run) { if (!module?.clearLearningEvidence) throw Error('learning_unavailable'); await module.clearLearningEvidence(run); },
  async clearReceipts(run) {
    for (const item of await nativeLiveProgressStoragePort.listReceipts()) {
      let parsed: { courseRunId?: string };
      try { parsed = JSON.parse(item.raw); } catch { continue; }
      if (parsed.courseRunId === run) await nativeLiveProgressStoragePort.acknowledgeReceipt(item.receiptId);
    }
  },
  async receiptRuns() {
    const runs = new Set<string>();
    for (const item of await nativeLiveProgressStoragePort.listReceipts()) {
      try { const r = JSON.parse(item.raw).courseRunId; if (typeof r === 'string') runs.add(r); } catch { /* malformed native input stays excluded */ }
    }
    return [...runs];
  },
  async activeProgressRun() {
    const raw = await nativeLiveProgressStoragePort.read();
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state.terminalAtMs == null ? state.courseRunId : null;
  },
};
const internal = typeof __DEV__ !== 'undefined' && __DEV__;
export const nativeLiveActivityLifecyclePort = createNativeLiveActivityLifecyclePort({ platform: Platform.OS, internal, module });

export const nativeLiveProgressStoragePort = {
  async read(): Promise<string | null> {
    if (Platform.OS !== 'ios' || !module?.readLocalProgress) return null;
    const value = await module.readLocalProgress();
    if (value === null) return null;
    if (typeof value !== 'string') throw new Error('live_progress_native_response_invalid');
    return value;
  },
  async write(raw: string) {
    if (Platform.OS !== 'ios' || !module?.writeLocalProgress) throw new Error('live_progress_native_storage_unavailable');
    await module.writeLocalProgress(raw);
  },
  async clear() {
    if (Platform.OS !== 'ios' || !module?.clearLocalProgress) return;
    await module.clearLocalProgress();
  },
  async listReceipts() {
    if (Platform.OS !== 'ios' || !module?.listLocalProgressReceipts) return [];
    const values = await module.listLocalProgressReceipts();
    if (!Array.isArray(values)) throw new Error('live_progress_native_response_invalid');
    return values.map(value => {
      const item = record(value);
      if (!isText(item.receiptId) || !isText(item.raw)) throw new Error('live_progress_native_response_invalid');
      return { receiptId: item.receiptId, raw: item.raw };
    });
  },
  async acknowledgeReceipt(eventId: string) {
    if (Platform.OS !== 'ios' || !module?.acknowledgeLocalProgressReceipt) return;
    await module.acknowledgeLocalProgressReceipt(eventId);
  },
};

export const nativePendingNavigationPort = {
  async revokeCompletion() {
    if (Platform.OS !== 'ios') return;
    if (!module?.revokeCompletionActions) throw new Error('completion_revocation_unavailable');
    await module.revokeCompletionActions();
  },
  async read(): Promise<PendingNavigationAction | null> {
    if (Platform.OS !== 'ios' || !module?.readPendingNavigationAction) return null;
    const value = await module.readPendingNavigationAction();
    if (value === null) return null;
    const decoded = decodePendingNavigationAction(value);
    if (!decoded) throw new Error('live_navigation_native_response_invalid');
    return decoded;
  },
  async transition(action: PendingNavigationAction, from: PendingNavigationState, to: PendingNavigationState) {
    if (Platform.OS !== 'ios' || !module?.transitionPendingNavigationAction) return false;
    return await module.transitionPendingNavigationAction({ actionId: action.actionId, courseRunId: action.courseRunId, from, to }) === true;
  },
  async clear(action: PendingNavigationAction) {
    if (Platform.OS !== 'ios' || !module?.clearPendingNavigationAction) return;
    await module.clearPendingNavigationAction({ actionId: action.actionId, courseRunId: action.courseRunId });
  },
  subscribe(listener: () => void): () => void {
    if (Platform.OS !== 'ios' || !module) return () => undefined;
    const nativeModule = module as NonNullable<ConstructorParameters<typeof NativeEventEmitter>[0]>;
    const subscription = new NativeEventEmitter(nativeModule).addListener('timeFitPendingNavigationAvailable', listener);
    return () => subscription.remove();
  },
};

export const nativeLiveActivityPort = {
  async activitySupport() {
    if (Platform.OS !== 'ios' || !module?.activitySupport) return { supported: false, enabled: false };
    const result = await module.activitySupport();
    return { supported: result.supported === true, enabled: result.enabled === true };
  },
  async startFixture(fixture: LiveActivityA3Fixture) {
    if (!internal || !module?.startFixture) throw new Error('live_activity_fixture_entry_unavailable');
    const result = record(await module.startFixture(fixture));
    if (!['started', 'cleanup_required', 'disabled', 'invalid_input'].includes(String(result.status))) throw new Error('live_activity_native_response_invalid');
    return {
      status: result.status as 'started' | 'cleanup_required' | 'disabled' | 'invalid_input',
      activityId: isText(result.activityId) ? result.activityId : undefined,
      applicationState: isText(result.applicationState) ? result.applicationState : undefined,
    };
  },
};
