import type { AccountIdentityResolver } from './accountIdentity';
import {
  createAccountCourseCompletionRepository,
  type AccountCompletionOwnerSnapshotStore,
  type AccountCourseCompletionRemote,
} from './accountCourseCompletionRepository';
import {
  createCourseCompletionRepository,
  type CompleteCourseInput,
  type CourseCompletionRecordV1,
  type CourseCompletionRepository,
  type CourseCompletionStorage,
} from './courseCompletionRepository';
import { createDwellOutbox, type DwellOutboxStorage, type StoredDwellOutboxItemV1 } from './dwellPersonalizationOutbox';
import {
  createDwellPersonalizationRepository,
  type DwellConsentStateV1,
  type DwellEligibilitySnapshotV1,
  type DwellPersonalizationRemote,
} from './dwellPersonalizationRepository';
import {
  createGuestCompletionImportRepository,
  type GuestCompletionImportItemV1,
  type GuestImportStore,
  type PendingGuestCompletionImportV1,
} from './guestCompletionImportRepository';
import type { createAccountDeletionRepository } from './accountDeletionRepository';
import { createLiveLearningEvidenceService, type EvidenceRunInspection, type EvidenceFailure } from './liveLearningEvidence';

export const RELEASE_DEVICE_OWNERSHIP_KEY = '@timefit/release-device-ownership-v1';
export const RELEASE_GUEST_IMPORT_PENDING_KEY = '@timefit/guest-completion-import-pending-v1';
export const RELEASE_DWELL_OUTBOX_KEY = '@timefit/dwell-sample-outbox-v1';
const OWNER_COMPLETION_PREFIX = '@timefit/course-completions-owner-v1/';

export type DeviceCourseOwnerV1 =
  | Readonly<{ kind: 'account'; ownerKey: string; subject: string }>
  | Readonly<{ kind: 'guest'; ownerKey: string; deviceScopeId: string }>
  | Readonly<{ kind: 'unverified'; ownerKey: string }>;

/** Caller-supplied display context, never server authorization. No identity query is made by the read. */
export type CourseRunOwnershipViewer = Readonly<{ kind: 'account'; subject: string } | { kind: 'guest' } | { kind: 'unverified' }>;
export type CourseRunCleanupProof = Readonly<{ courseRunId: string }>;
export type ReadCourseRunOwnershipResult =
  | Readonly<{ status: 'found'; courseRunId: string; ownerKind: DeviceCourseOwnerV1['kind']; ownerMatch: boolean; cleanupProof: CourseRunCleanupProof | null }>
  | Readonly<{ status: 'not_found' | 'corrupt' | 'unavailable' | 'invalid_input' }>;

export type DwellLearningQueueStateV1 = Readonly<{
  firstEligibleAt: number;
  state: 'pending' | 'queued' | 'submitted' | 'expired' | 'evicted' | 'discarded';
}>;

export type CourseRunPersonalizationSnapshotV1 = Readonly<{
  courseRunId: string;
  owner: DeviceCourseOwnerV1;
  ownerGeneration: number | null;
  runEligibility: DwellEligibilitySnapshotV1 | null;
  visitSync: 'pending' | 'synced' | 'not_applicable' | null;
  evidenceMode?: 'active' | 'closed';
  evidenceScopeGeneration?: number;
  stops: readonly Readonly<{
    stopOrdinal: 1 | 2;
    confirmationEventId: string;
    eligibility: DwellEligibilitySnapshotV1 | null;
    learning: DwellLearningQueueStateV1 | null;
  }>[];
}>;

type DeviceEnvelopeV1 = Readonly<{
  schemaVersion: 1;
  evidenceGeneration?: number;
  evidenceCleanupRunIds?: readonly string[];
  deviceScopeId: string | null;
  runs: readonly CourseRunPersonalizationSnapshotV1[];
  dismissedImportSubjects: readonly string[];
}>;

export type GuestImportSourceRecordV1 = Readonly<{
  source: 'guest' | 'legacy_unassigned';
  record: CourseCompletionRecordV1;
}>;

export type GuestImportRemote = Readonly<{
  import(input: Readonly<{ importId: string; items: readonly GuestCompletionImportItemV1[] }>): Promise<Readonly<{
    status: 'acknowledged' | 'already_acknowledged';
    importId: string;
    acceptedSourceIds: readonly string[];
    rejectedSourceIds: readonly string[];
  }>>;
}>;

export type ReleaseIdentityPersonalizationRuntimeDependencies = Readonly<{
  storage: CourseCompletionStorage;
  identity: AccountIdentityResolver;
  legacyCompletions: CourseCompletionRepository;
  accountRemote: AccountCourseCompletionRemote;
  dwellRemote: DwellPersonalizationRemote;
  guestRemote: GuestImportRemote;
  accountDeletion?: ReturnType<typeof createAccountDeletionRepository>;
  now?: () => number;
  createDeviceScopeId?: () => string;
  createCompletionId?: () => string;
  createImportId?: () => string;
  createEvidenceToken?: () => string;
  isEvidenceAuthReady?: () => boolean;
}>;

const emptyEnvelope = (): DeviceEnvelopeV1 => ({ schemaVersion: 1, deviceScopeId: null, runs: [], dismissedImportSubjects: [] });
const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
const storageQueues = new WeakMap<object, Promise<unknown>>();
// Shared by runtime instances using the same storage port. Increment even on failed writes:
// a partially committed mandatory completion must invalidate outstanding optional work.
const captureRevisions = new WeakMap<object, number>();
const contextRevisions = new WeakMap<object, number>();
const evidenceRevisions = new WeakMap<object, number>();
const evidenceQuarantined = new WeakSet<object>();
const evidenceTerminalRuns = new WeakMap<object, Set<string>>();

function serialized<T>(storage: CourseCompletionStorage, operation: () => Promise<T>): Promise<T> {
  const previous = storageQueues.get(storage) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  storageQueues.set(storage, current.then(() => undefined, () => undefined));
  return current;
}

function isEligibility(value: unknown): value is DwellEligibilitySnapshotV1 {
  const item = value as DwellEligibilitySnapshotV1;
  return Boolean(item && text(item.ownerSubject) && text(item.consentEpoch) && Number.isSafeInteger(item.consentRevision) && item.consentRevision > 0);
}

function isOwner(value: unknown): value is DeviceCourseOwnerV1 {
  const item = value as DeviceCourseOwnerV1;
  if (!item || !text(item.ownerKey)) return false;
  if (item.kind === 'account') return text(item.subject) && item.ownerKey === `account:${item.subject}`;
  if (item.kind === 'guest') return text(item.deviceScopeId) && item.ownerKey === `guest:${item.deviceScopeId}`;
  return item.kind === 'unverified' && item.ownerKey.startsWith('unverified:');
}

function isLearning(value: unknown): value is DwellLearningQueueStateV1 {
  const item = value as DwellLearningQueueStateV1;
  return Boolean(item && Number.isSafeInteger(item.firstEligibleAt) && item.firstEligibleAt > 0
    && ['pending', 'queued', 'submitted', 'expired', 'evicted', 'discarded'].includes(item.state));
}

function parseEnvelope(raw: string | null): DeviceEnvelopeV1 | null {
  if (raw === null) return emptyEnvelope();
  try {
    const value = JSON.parse(raw) as DeviceEnvelopeV1;
    if (!value || value.schemaVersion !== 1 || (value.deviceScopeId !== null && !text(value.deviceScopeId))
      || !Array.isArray(value.runs) || !Array.isArray(value.dismissedImportSubjects)
      || !value.dismissedImportSubjects.every((item) => text(item))) return null;
    const runs: CourseRunPersonalizationSnapshotV1[] = [];
    for (const run of value.runs) {
      if (!run || !text(run.courseRunId) || !isOwner(run.owner)
        || (run.ownerGeneration !== null && (!Number.isSafeInteger(run.ownerGeneration) || run.ownerGeneration <= 0))
        || (run.runEligibility !== null && !isEligibility(run.runEligibility))
        || (run.visitSync !== undefined && run.visitSync !== null && !['pending', 'synced', 'not_applicable'].includes(run.visitSync))
        || !Array.isArray(run.stops)) return null;
      for (const stop of run.stops) {
        if (!stop || (stop.stopOrdinal !== 1 && stop.stopOrdinal !== 2) || !text(stop.confirmationEventId)
          || (stop.eligibility !== null && !isEligibility(stop.eligibility))
          || (stop.learning !== undefined && stop.learning !== null && !isLearning(stop.learning))) return null;
      }
      runs.push({ ...run, visitSync: run.visitSync ?? null, stops: run.stops.map((stop: CourseRunPersonalizationSnapshotV1['stops'][number]) => ({ ...stop, learning: stop.learning ?? null })) });
    }
    return { ...value, runs };
  } catch { return null; }
}

function ownerCompletionKey(ownerKey: string) {
  return `${OWNER_COMPLETION_PREFIX}${encodeURIComponent(ownerKey)}`;
}

/** Production and fixtures share the mutation fence, including failed/unknown requests. */
export function withCourseRunCaptureInvalidation(remote: DwellPersonalizationRemote, invalidate: () => void): DwellPersonalizationRemote {
  return {
    ...remote,
    async setConsent(input) { invalidate(); try { return await remote.setConsent(input); } finally { invalidate(); } },
    async reset(input) { invalidate(); try { return await remote.reset(input); } finally { invalidate(); } },
  };
}

export function createReleaseIdentityPersonalizationRuntime(deps: ReleaseIdentityPersonalizationRuntimeDependencies) {
  const now = deps.now ?? Date.now;
  const deviceScopeId = deps.createDeviceScopeId ?? (() => globalThis.crypto?.randomUUID?.() ?? `device-${now()}`);
  const ownerRepositories = new Map<string, CourseCompletionRepository>();
  const freshEvidenceWindows = new Map<string, number>();
  const evidenceFence = () => evidenceRevisions.get(deps.storage) ?? 0;
  const terminalEvidenceRuns = evidenceTerminalRuns.get(deps.storage) ?? new Set<string>();
  evidenceTerminalRuns.set(deps.storage, terminalEvidenceRuns);

  const readEnvelope = async () => parseEnvelope(await deps.storage.getItem(RELEASE_DEVICE_OWNERSHIP_KEY));
  const revision = () => captureRevisions.get(deps.storage) ?? 0;
  const invalidateCaptures = () => { captureRevisions.set(deps.storage, revision() + 1); };
  const writeEnvelope = (value: DeviceEnvelopeV1) => {
    invalidateCaptures();
    return deps.storage.setItem(RELEASE_DEVICE_OWNERSHIP_KEY, JSON.stringify(value));
  };
  const cleanupProofs = new WeakMap<CourseRunCleanupProof, { subject: string; contextRevision: number }>();
  const prepareCapture = () => serialized(deps.storage, async () => {
    try {
      const envelope = await readEnvelope();
      return envelope ? { status: 'ready' as const, envelope, revision: revision() } : { status: 'storage_corrupt' as const };
    } catch { return { status: 'storage_unavailable' as const }; }
  });
  const ownerRepository = (ownerKey: string) => {
    const existing = ownerRepositories.get(ownerKey);
    if (existing) return existing;
    const key = ownerCompletionKey(ownerKey);
    const repository = createCourseCompletionRepository({
      getItem: () => deps.storage.getItem(key),
      setItem: (_ignored, value) => deps.storage.setItem(key, value),
      removeItem: () => deps.storage.removeItem(key),
    }, { createCompletionId: deps.createCompletionId });
    ownerRepositories.set(ownerKey, repository);
    return repository;
  };

  const evidenceGeneration = (envelope: DeviceEnvelopeV1) => {
    const value = envelope.evidenceGeneration ?? 0;
    if (!Number.isSafeInteger(value) || value < 0) throw Error('evidence_generation_corrupt');
    return value;
  };
  const inspectEvidenceRun = async (courseRunId: string): Promise<EvidenceRunInspection> => {
    try {
      if (evidenceQuarantined.has(deps.storage) || deps.isEvidenceAuthReady?.() === false) return { status: 'unavailable' };
      if (terminalEvidenceRuns.has(courseRunId)) return { status: 'excluded', reason: 'terminal' };
      const envelope = await readEnvelope();
      if (!envelope) return { status: 'unavailable' };
      const run = envelope.runs.find(item => item.courseRunId === courseRunId);
      if (!run) return { status: 'excluded', reason: 'not_found' };
      if (run.evidenceMode !== 'active' || run.visitSync !== null) return { status: 'excluded', reason: 'terminal' };
      if (run.owner.kind !== 'account' || !run.runEligibility || run.ownerGeneration === null) return { status: 'excluded', reason: 'ineligible' };
      const local = await ownerRepository(run.owner.ownerKey).read();
      if (local.status !== 'ok' && local.status !== 'empty') return { status: 'unavailable' };
      if (local.records.some(record => record.courseRunId === courseRunId)) return { status: 'excluded', reason: 'terminal' };
      const generation = evidenceGeneration(envelope);
      return run.evidenceScopeGeneration === generation ? { status: 'ready', generation } : { status: 'excluded', reason: 'stale_generation' };
    } catch { return { status: 'unavailable' }; }
  };
  const evidence = createLiveLearningEvidenceService({
    storage: deps.storage, inspect: inspectEvidenceRun, fence: evidenceFence,
    createToken: deps.createEvidenceToken ?? (() => {
      const value = globalThis.crypto?.randomUUID?.();
      if (!value) throw Error('secure_random_unavailable');
      return value;
    }),
    reserve: courseRunId => serialized(deps.storage, async (): Promise<EvidenceRunInspection> => {
      try {
        if (evidenceQuarantined.has(deps.storage) || deps.isEvidenceAuthReady?.() === false) return { status: 'unavailable' };
        if (terminalEvidenceRuns.has(courseRunId)) return { status: 'excluded', reason: 'terminal' };
        const envelope = await readEnvelope(); if (!envelope) return { status: 'unavailable' };
        const run = envelope.runs.find(item => item.courseRunId === courseRunId);
        if (!run) return { status: 'excluded', reason: 'not_found' };
        if (run.evidenceMode === 'active') {
          const inspected = await inspectEvidenceRun(courseRunId);
          return inspected.status === 'ready' ? { ...inspected, existingOnly: true } : inspected;
        }
        if (run.owner.kind !== 'account' || !run.runEligibility || run.ownerGeneration === null) return { status: 'excluded', reason: 'ineligible' };
        if (run.evidenceMode === 'closed' || run.visitSync !== null || run.stops.length || freshEvidenceWindows.get(courseRunId) !== evidenceFence()) return { status: 'excluded', reason: 'window_closed' };
        freshEvidenceWindows.delete(courseRunId);
        const generation = evidenceGeneration(envelope);
        await writeEnvelope({ ...envelope, runs: envelope.runs.map(item => item.courseRunId === courseRunId
          ? { ...item, evidenceMode: 'active', evidenceScopeGeneration: generation } : item) });
        return { status: 'ready', generation };
      } catch { return { status: 'unavailable' }; }
    }),
    closeWindow: courseRunId => runtime.closeRunLearningEvidence({ courseRunId, reason: 'window_closed' }),
  });

  const invalidateEvidence = async (): Promise<Readonly<{ status: 'invalidated' }> | EvidenceFailure> => {
    evidenceRevisions.set(deps.storage, evidenceFence() + 1);
    evidenceQuarantined.add(deps.storage);
    freshEvidenceWindows.clear(); evidence.forget();
    return serialized(deps.storage, async () => {
      try {
        const envelope = await readEnvelope(); if (!envelope) return { status: 'unavailable' };
        const affected = envelope.runs.filter(run => run.evidenceMode === 'active').map(run => run.courseRunId);
        await writeEnvelope({ ...envelope, evidenceGeneration: evidenceGeneration(envelope) + 1,
          runs: envelope.runs.map(run => run.evidenceMode === 'active' ? { ...run, evidenceMode: 'closed' } : run) });
        evidenceQuarantined.delete(deps.storage);
        for (const courseRunId of affected) void evidence.purgeRunLearningEvidence({ courseRunId });
        return { status: 'invalidated' };
      } catch { return { status: 'unavailable' }; }
    });
  };

  const ownerSnapshots: AccountCompletionOwnerSnapshotStore = {
    async read(courseRunId) {
      const envelope = await readEnvelope();
      if (!envelope) throw new Error('device_state_corrupt');
      const run = envelope.runs.find((item) => item.courseRunId === courseRunId);
      return run?.owner.kind === 'account' && run.ownerGeneration !== null
        ? { courseRunId, ownerSubject: run.owner.subject, generation: run.ownerGeneration }
        : null;
    },
    async write(snapshot) {
      await serialized(deps.storage, async () => {
        const envelope = await readEnvelope();
        if (!envelope) throw new Error('device_state_corrupt');
        const run = envelope.runs.find((item) => item.courseRunId === snapshot.courseRunId);
        if (!run || run.owner.kind !== 'account' || run.owner.subject !== snapshot.ownerSubject || run.ownerGeneration !== snapshot.generation) {
          throw new Error('immutable_run_owner');
        }
      });
    },
    async remove(courseRunId) {
      await serialized(deps.storage, async () => {
        const envelope = await readEnvelope();
        if (!envelope) throw new Error('device_state_corrupt');
        await writeEnvelope({ ...envelope, runs: envelope.runs.filter((item) => item.courseRunId !== courseRunId) });
      });
    },
  };
  const accountCompletions = createAccountCourseCompletionRepository({ identity: deps.identity, owners: ownerSnapshots, remote: deps.accountRemote });
  const dwell = createDwellPersonalizationRepository({ identity: deps.identity, remote: deps.dwellRemote, now });
  const setLearningStates = async (completionEventIds: readonly string[], state: DwellLearningQueueStateV1['state']) => serialized(deps.storage, async () => {
    const envelope = await readEnvelope();
    if (!envelope) throw new Error('device_state_corrupt');
    const ids = new Set(completionEventIds); let changed = false;
    const runs = envelope.runs.map((candidate) => ({ ...candidate, stops: candidate.stops.map((stop) => {
      if (!ids.has(stop.confirmationEventId) || !stop.learning || stop.learning.state === state) return stop;
      if (['submitted', 'expired', 'evicted', 'discarded'].includes(stop.learning.state)) return stop;
      changed = true; return { ...stop, learning: { ...stop.learning, state } };
    }) }));
    if (changed) await writeEnvelope({ ...envelope, runs });
  });
  const setRunVisitSync = async (courseRunId: string, visitSync: CourseRunPersonalizationSnapshotV1['visitSync']) => serialized(deps.storage, async () => {
    const envelope = await readEnvelope();
    if (!envelope) throw new Error('device_state_corrupt');
    const run = envelope.runs.find((candidate) => candidate.courseRunId === courseRunId);
    if (!run) throw new Error('run_not_found');
    await writeEnvelope({ ...envelope, runs: envelope.runs.map((candidate) => candidate.courseRunId === courseRunId ? { ...candidate, visitSync } : candidate) });
  });
  const dwellStorage: DwellOutboxStorage = {
    async read() {
      const raw = await deps.storage.getItem(RELEASE_DWELL_OUTBOX_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('dwell_outbox_corrupt');
      return parsed as StoredDwellOutboxItemV1[];
    },
    async write(items) { await deps.storage.setItem(RELEASE_DWELL_OUTBOX_KEY, JSON.stringify(items)); },
  };
  const outbox = createDwellOutbox(dwellStorage, { now, beforeEvict: (ids) => setLearningStates(ids, 'evicted') });
  const pendingStore: GuestImportStore = {
    serializationKey: deps.storage,
    async read() {
      const raw = await deps.storage.getItem(RELEASE_GUEST_IMPORT_PENDING_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingGuestCompletionImportV1;
      if (!parsed || !text(parsed.importId) || !text(parsed.targetSubject) || !Array.isArray(parsed.items) || !Array.isArray(parsed.acceptedSourceIds)) throw new Error('guest_import_corrupt');
      return parsed;
    },
    async write(value) { await deps.storage.setItem(RELEASE_GUEST_IMPORT_PENDING_KEY, JSON.stringify(value)); },
    async clear() { await deps.storage.removeItem(RELEASE_GUEST_IMPORT_PENDING_KEY); },
  };

  const readGuestRecords = async () => {
    const envelope = await readEnvelope();
    if (!envelope) return { status: 'storage_corrupt' as const, records: [] as const };
    if (!envelope.deviceScopeId) return { status: 'ok' as const, records: [] as const };
    const result = await ownerRepository(`guest:${envelope.deviceScopeId}`).read();
    return result.status === 'ok' || result.status === 'empty'
      ? { status: 'ok' as const, records: result.records }
      : { status: result.status, records: [] as const };
  };
  const removeImportSources = async (ids: readonly string[]) => {
    const envelope = await readEnvelope();
    if (!envelope) throw new Error('device_state_corrupt');
    if (envelope.deviceScopeId) {
      const guest = await ownerRepository(`guest:${envelope.deviceScopeId}`).removeByCompletionIds(ids);
      if (guest.status !== 'removed') throw new Error('guest_cleanup_failed');
    }
    const legacy = await deps.legacyCompletions.removeByCompletionIds(ids);
    if (legacy.status !== 'removed') throw new Error('legacy_cleanup_failed');
  };
  const guestImport = createGuestCompletionImportRepository({
    identity: deps.identity,
    pending: pendingStore,
    source: { removeByIds: removeImportSources },
    remote: deps.guestRemote,
    createImportId: deps.createImportId,
  });

  async function currentOwnerForRead() {
    const envelope = await readEnvelope();
    if (!envelope) return { status: 'storage_corrupt' as const };
    const identity = await deps.identity.resolve();
    if (identity.status === 'account') return { status: 'ok' as const, ownerKey: `account:${identity.identity.subject}` };
    if (identity.status === 'unavailable' || identity.status === 'session_expired') return { status: identity.status as 'unavailable' | 'session_expired' };
    return envelope.deviceScopeId ? { status: 'ok' as const, ownerKey: `guest:${envelope.deviceScopeId}` } : { status: 'empty' as const };
  }

  async function syncRun(courseRunId: string) {
    let envelope: DeviceEnvelopeV1 | null;
    try { envelope = await readEnvelope(); } catch { return { status: 'storage_unavailable' as const, submittedSampleCount: 0 }; }
    if (!envelope) return { status: 'storage_corrupt' as const, submittedSampleCount: 0 };
    const run = envelope.runs.find((item) => item.courseRunId === courseRunId);
    if (!run) return { status: 'not_found' as const, submittedSampleCount: 0 };
    if (run.owner.kind !== 'account') return { status: 'local_only' as const, submittedSampleCount: 0 };
    const local = await ownerRepository(run.owner.ownerKey).read();
    if (local.status !== 'ok') return { status: local.status === 'empty' ? 'not_found' as const : local.status, submittedSampleCount: 0 };
    const record = local.records.find((item) => item.courseRunId === courseRunId);
    if (!record) return { status: 'not_found' as const, submittedSampleCount: 0 };
    if (run.evidenceMode) void evidence.purgeRunLearningEvidence({ courseRunId });
    const server = await accountCompletions.writeAccountCourseCompletion({ record });
    if (server.status !== 'created' && server.status !== 'already_completed') return { status: server.status, visitStatus: server.status, sampleSync: { status: 'not_started' as const, submittedCount: 0, pendingCount: 0, excludedCount: 0 }, submittedSampleCount: 0 };
    try { await setRunVisitSync(courseRunId, 'synced'); }
    catch { return { status: 'storage_unavailable' as const, visitStatus: server.status, sampleSync: { status: 'pending' as const, submittedCount: 0, pendingCount: 0, excludedCount: 0 }, submittedSampleCount: 0 }; }
    let submittedSampleCount = 0; let pendingCount = 0; let excludedCount = 0;
    const setLearningState = async (completionEventId: string, state: DwellLearningQueueStateV1['state']) => {
      try { await setLearningStates([completionEventId], state); return true; } catch { return false; }
    };
    let latestEnvelope: DeviceEnvelopeV1 | null;
    try { latestEnvelope = await readEnvelope(); }
    catch { return { status: 'storage_unavailable' as const, visitStatus: server.status, sampleSync: { status: 'pending' as const, submittedCount: 0, pendingCount: 0, excludedCount: 0 }, submittedSampleCount: 0 }; }
    if (!latestEnvelope) return { status: 'storage_corrupt' as const, visitStatus: server.status, sampleSync: { status: 'pending' as const, submittedCount: 0, pendingCount: 0, excludedCount: 0 }, submittedSampleCount: 0 };
    const latestRun = latestEnvelope.runs.find((item) => item.courseRunId === courseRunId);
    if (!latestRun || latestRun.owner.kind !== 'account') return { status: 'owner_changed' as const, visitStatus: server.status, sampleSync: { status: 'not_started' as const, submittedCount: 0, pendingCount: 0, excludedCount: 0 }, submittedSampleCount: 0 };
    for (let index = 0; index < record.places.length; index += 1) {
      const place = record.places[index]!;
      const stopOrdinal = (index + 1) as 1 | 2;
      const stop = latestRun.stops.find((item) => item.stopOrdinal === stopOrdinal);
      if (!latestRun.runEligibility || !stop?.eligibility || !stop.learning || place.actualDwellMin === null || place.subCategory === null) {
        if (stop?.learning && (stop.learning.state === 'pending' || stop.learning.state === 'queued')) {
          await setLearningState(stop.confirmationEventId, 'discarded');
          await outbox.acknowledge(stop.confirmationEventId);
        }
        excludedCount += 1; continue;
      }
      if (stop.learning.state === 'submitted' || stop.learning.state === 'expired' || stop.learning.state === 'evicted' || stop.learning.state === 'discarded') { excludedCount += 1; continue; }
      if (now() - stop.learning.firstEligibleAt > 7 * 86_400_000) {
        await setLearningState(stop.confirmationEventId, 'expired'); excludedCount += 1; continue;
      }
      const item = {
        completionEventId: stop.confirmationEventId,
        courseRunId,
        stopOrdinal,
        contentId: place.contentId,
        category: place.category,
        subCategory: place.subCategory,
        actualDwellMin: place.actualDwellMin,
        completedAtMinute: Math.floor(record.completedAt / 60_000),
        ownerSubject: run.owner.subject,
        consentEpoch: stop.eligibility.consentEpoch,
        consentRevision: stop.eligibility.consentRevision,
      };
      const queued = await outbox.enqueue(item, { firstQueuedAt: stop.learning.firstEligibleAt });
      if (queued.status === 'expired') { await setLearningState(stop.confirmationEventId, 'expired'); excludedCount += 1; continue; }
      if (queued.status === 'invalid_input' || queued.status === 'idempotency_conflict') { await setLearningState(stop.confirmationEventId, 'discarded'); excludedCount += 1; continue; }
      if (queued.status !== 'queued' && queued.status !== 'already_queued') { pendingCount += 1; continue; }
      if (queued.status === 'queued') {
        if (queued.evictedCompletionEventIds.includes(stop.confirmationEventId)) { excludedCount += 1; continue; }
        await setLearningState(stop.confirmationEventId, 'queued');
      }
      const submitted = await dwell.submitDwellCompletionSample({
        ...item,
        completedAt: record.completedAt,
        runEligibility: latestRun.runEligibility,
        stopEligibility: stop.eligibility,
      });
      if (submitted.status === 'accepted' || submitted.status === 'already_accepted') {
        const closed = await setLearningState(item.completionEventId, 'submitted');
        if (!closed) { pendingCount += 1; continue; }
        const removed = await outbox.acknowledge(item.completionEventId);
        if (removed.status === 'removed') submittedSampleCount += 1;
        else pendingCount += 1;
      } else if (submitted.status === 'not_eligible') {
        const closed = await setLearningState(item.completionEventId, 'discarded');
        if (closed) { await outbox.acknowledge(item.completionEventId); excludedCount += 1; }
        else pendingCount += 1;
      } else if (submitted.status === 'unavailable') pendingCount += 1;
      else {
        const closed = await setLearningState(item.completionEventId, 'discarded');
        if (closed) { await outbox.acknowledge(item.completionEventId); excludedCount += 1; }
        else pendingCount += 1;
      }
    }
    const sampleStatus = pendingCount > 0 ? (submittedSampleCount > 0 || excludedCount > 0 ? 'partial' as const : 'pending' as const)
      : submittedSampleCount > 0 ? (excludedCount > 0 ? 'partial' as const : 'submitted' as const) : 'excluded' as const;
    return { status: 'synced' as const, visitStatus: server.status, sampleSync: { status: sampleStatus, submittedCount: submittedSampleCount, pendingCount, excludedCount }, submittedSampleCount };
  }

  async function cleanupOwnerData(ownerSubject: string) {
    try {
      const local = await serialized(deps.storage, async () => {
        const pending = await pendingStore.read();
        if (pending?.targetSubject === ownerSubject) await pendingStore.clear();
        const completion = await ownerRepository(`account:${ownerSubject}`).clear();
        const discarded = await outbox.discardOwner(ownerSubject);
        const envelope = await readEnvelope();
        if (!envelope) return { completion, discarded, state: false };
        await writeEnvelope({
          ...envelope,
          evidenceCleanupRunIds: [...new Set([...(envelope.evidenceCleanupRunIds ?? []), ...envelope.runs.filter(run => run.evidenceMode && run.owner.kind === 'account' && run.owner.subject === ownerSubject).map(run => run.courseRunId)])],
          runs: envelope.runs.filter((run) => run.owner.kind !== 'account' || run.owner.subject !== ownerSubject),
          dismissedImportSubjects: envelope.dismissedImportSubjects.filter((subject) => subject !== ownerSubject),
        });
        for (const run of envelope.runs.filter(run => run.owner.kind === 'account' && run.owner.subject === ownerSubject)) {
          terminalEvidenceRuns.add(run.courseRunId); evidence.forget(run.courseRunId);
          void evidence.purgeRunLearningEvidence({ courseRunId: run.courseRunId });
        }
        return { completion, discarded, state: true };
      });
      return local.completion.status === 'cleared' && local.discarded.status === 'removed' && local.state
        ? { status: 'cleaned' as const, progressCleanupRequired: true as const, ownerSubject }
        : { status: 'local_cleanup_pending' as const, progressCleanupRequired: true as const, ownerSubject };
    } catch { return { status: 'local_cleanup_pending' as const, progressCleanupRequired: true as const, ownerSubject }; }
  }

  const runtime = {
    prepareRunLearningEvidence: evidence.prepareRunLearningEvidence,
    confirmRunEvidencePublication: evidence.confirmRunEvidencePublication,
    publishRunLearningEvidence: evidence.publishRunLearningEvidence,
    acceptConfirmationEvidence: evidence.acceptConfirmationEvidence,
    purgeRunLearningEvidence: evidence.purgeRunLearningEvidence,
    async retryLearningEvidenceCleanup() {
      try {
        const envelope = await readEnvelope(); if (!envelope) return { status: 'unavailable' as const };
        let purgedCount = 0, pendingCount = 0;
        const pending = envelope.evidenceCleanupRunIds ?? [];
        if (!Array.isArray(pending) || !pending.every(id => text(id))) return { status: 'unavailable' as const };
        const ids = new Set([...pending, ...envelope.runs.filter(run => run.evidenceMode === 'closed').map(run => run.courseRunId)]);
        for (const courseRunId of ids) {
          const result = await evidence.purgeRunLearningEvidence({ courseRunId });
          if (result.status === 'purged') {
            purgedCount++;
            await serialized(deps.storage, async () => {
              const latest = await readEnvelope(); if (!latest) throw Error('owner_storage_corrupt');
              if (latest.evidenceCleanupRunIds?.includes(courseRunId)) await writeEnvelope({ ...latest, evidenceCleanupRunIds: latest.evidenceCleanupRunIds.filter(id => id !== courseRunId) });
            });
          } else pendingCount++;
        }
        return { status: pendingCount ? 'pending' as const : 'cleaned' as const, purgedCount, pendingCount };
      } catch { return { status: 'unavailable' as const }; }
    },
    invalidateLearningEvidence: invalidateEvidence,
    /** INITIAL_SESSION is a cold identity check, not a logout. Same-owner native receipts remain recoverable. */
    async reconcileLearningEvidenceAccount(subject: string | null): Promise<Readonly<{ status: 'ready' }> | EvidenceFailure> {
      try {
        const envelope = await readEnvelope(); if (!envelope) return { status: 'unavailable' };
        if (envelope.runs.some(run => run.evidenceMode === 'active' && (run.owner.kind !== 'account' || run.owner.subject !== subject))) {
          const result = await invalidateEvidence(); if (result.status !== 'invalidated') return result;
        }
        return { status: 'ready' };
      } catch { return { status: 'unavailable' }; }
    },
    async closeRunLearningEvidence(input: Readonly<{ courseRunId: string; reason: 'completed' | 'cancelled' | 'expired' | 'replaced' | 'window_closed' }>): Promise<Readonly<{ status: 'closed'; courseRunId: string; activeCleanup: 'pending' }> | EvidenceFailure> {
      if (!text(input?.courseRunId) || !['completed', 'cancelled', 'expired', 'replaced', 'window_closed'].includes(input.reason)) return { status: 'excluded', reason: 'invalid_input' };
      freshEvidenceWindows.delete(input.courseRunId); evidence.forget(input.courseRunId); invalidateCaptures();
      terminalEvidenceRuns.add(input.courseRunId);
      return serialized(deps.storage, async () => {
        try {
          const envelope = await readEnvelope(); if (!envelope) return { status: 'unavailable' };
          const run = envelope.runs.find(item => item.courseRunId === input.courseRunId);
          if (!run) return { status: 'excluded', reason: 'not_found' };
          if (input.reason === 'completed') {
            const local = await ownerRepository(run.owner.ownerKey).read();
            if (local.status !== 'ok' && local.status !== 'empty') return { status: 'unavailable' };
            if (!local.records.some(record => record.courseRunId === input.courseRunId)) return { status: 'excluded', reason: 'completion_not_saved' };
          }
          await writeEnvelope({ ...envelope, runs: envelope.runs.map(item => item.courseRunId === input.courseRunId ? { ...item, evidenceMode: 'closed' } : item) });
          terminalEvidenceRuns.delete(input.courseRunId);
          void evidence.purgeRunLearningEvidence(input);
          return { status: 'closed', courseRunId: input.courseRunId, activeCleanup: 'pending' };
        } catch { return { status: 'unavailable' }; }
      });
    },
    /** Synchronous invalidation: auth events and consent/delete/reset mutations call this without awaiting network. */
    invalidatePendingCourseRunCaptures() {
      invalidateCaptures();
      void invalidateEvidence();
    },

    notifyCourseRunAuthChanged() {
      invalidateCaptures();
      contextRevisions.set(deps.storage, (contextRevisions.get(deps.storage) ?? 0) + 1);
      void invalidateEvidence();
    },

    async readCourseRunOwnership(input: Readonly<{ courseRunId: string; viewer: CourseRunOwnershipViewer }>): Promise<ReadCourseRunOwnershipResult> {
      if (!text(input?.courseRunId) || !input.viewer || !['account', 'guest', 'unverified'].includes(input.viewer.kind)
        || (input.viewer.kind === 'account' && !text(input.viewer.subject))) return { status: 'invalid_input' };
      try {
        const contextRevision = contextRevisions.get(deps.storage) ?? 0;
        const envelope = await readEnvelope();
        if (!envelope) return { status: 'corrupt' };
        if (contextRevision !== (contextRevisions.get(deps.storage) ?? 0)) return { status: 'unavailable' };
        const run = envelope.runs.find(item => item.courseRunId === input.courseRunId);
        if (!run) return { status: 'not_found' };
        const ownerMatch = run.owner.kind === input.viewer.kind && (run.owner.kind !== 'account'
          || (input.viewer.kind === 'account' && run.owner.subject === input.viewer.subject));
        let cleanupProof: CourseRunCleanupProof | null = null;
        if (ownerMatch && run.owner.kind === 'account' && contextRevision === (contextRevisions.get(deps.storage) ?? 0)) {
          cleanupProof = Object.freeze({ courseRunId: run.courseRunId });
          cleanupProofs.set(cleanupProof, { subject: run.owner.subject, contextRevision });
        }
        return { status: 'found', courseRunId: run.courseRunId, ownerKind: run.owner.kind, ownerMatch, cleanupProof };
      } catch { return { status: 'unavailable' }; }
    },

    /** Call synchronously inside UI's exact-active compare-and-clear; this never deletes UI/native state. */
    canCleanupCourseRun(input: Readonly<{ proof: CourseRunCleanupProof | null; currentSubject: string | null; activeCourseRunId: string | null }>) {
      if (!input.proof) return false;
      const captured = cleanupProofs.get(input.proof);
      return Boolean(captured && captured.subject === input.currentSubject && input.proof.courseRunId === input.activeCourseRunId
        && captured.contextRevision === (contextRevisions.get(deps.storage) ?? 0));
    },

    /** Explicit local finish fallback only, not cold lookup or automatic historical ownership repair. */
    async preserveUnverifiedCourseRun(input: Readonly<{ courseRunId: string }>) {
      if (!text(input?.courseRunId)) return { status: 'invalid_input' as const };
      return serialized(deps.storage, async () => {
        try {
          const envelope = await readEnvelope();
          if (!envelope) return { status: 'storage_corrupt' as const };
          const existing = envelope.runs.find(item => item.courseRunId === input.courseRunId);
          if (existing) return { status: 'captured' as const, snapshot: existing };
          const snapshot: CourseRunPersonalizationSnapshotV1 = { courseRunId: input.courseRunId,
            owner: { kind: 'unverified', ownerKey: `unverified:${input.courseRunId}` }, ownerGeneration: null,
            runEligibility: null, visitSync: null, stops: [] };
          await writeEnvelope({ ...envelope, runs: [...envelope.runs, snapshot] });
          return { status: 'captured' as const, snapshot };
        } catch { return { status: 'storage_unavailable' as const }; }
      });
    },

    async beginCourseRun(input: Readonly<{ courseRunId: string }>) {
      if (!text(input?.courseRunId)) return { status: 'invalid_input' as const };
      const prepared = await prepareCapture();
      if (prepared.status !== 'ready') return prepared;
      let envelope = prepared.envelope;
        const existing = envelope.runs.find((item) => item.courseRunId === input.courseRunId);
        if (existing) return { status: 'captured' as const, snapshot: existing };
        const first = await deps.identity.resolve();
        let owner: DeviceCourseOwnerV1;
        let generation: number | null = null;
        let eligibility: DwellEligibilitySnapshotV1 | null = null;
        if (first.status === 'account') {
          owner = { kind: 'account', ownerKey: `account:${first.identity.subject}`, subject: first.identity.subject };
          try {
            generation = await deps.accountRemote.readGeneration();
            const second = await deps.identity.resolve();
            if (second.status !== 'account' || second.identity.subject !== first.identity.subject) {
              owner = { kind: 'unverified', ownerKey: `unverified:${input.courseRunId}` };
              generation = null;
            }
          } catch {
            generation = null;
          }
          if (owner.kind === 'account' && generation !== null) {
            try {
              const consent = await deps.dwellRemote.readConsent();
              const verified = await deps.identity.resolve();
              if (verified.status === 'account' && verified.identity.subject === owner.subject && consent.enabled && consent.consentEpoch) {
                eligibility = { ownerSubject: owner.subject, consentEpoch: consent.consentEpoch, consentRevision: consent.revision };
              }
              if (verified.status !== 'account' || verified.identity.subject !== owner.subject) {
                owner = { kind: 'unverified', ownerKey: `unverified:${input.courseRunId}` };
                generation = null;
              }
            } catch { eligibility = null; }
          }
        } else if (first.status === 'account_required') {
          const scope = envelope.deviceScopeId ?? deviceScopeId();
          if (!text(scope)) return { status: 'storage_unavailable' as const };
          envelope = { ...envelope, deviceScopeId: scope };
          owner = { kind: 'guest', ownerKey: `guest:${scope}`, deviceScopeId: scope };
        } else {
          owner = { kind: 'unverified', ownerKey: `unverified:${input.courseRunId}` };
        }
        const snapshot: CourseRunPersonalizationSnapshotV1 = { courseRunId: input.courseRunId, owner, ownerGeneration: generation, runEligibility: eligibility, visitSync: null, stops: [] };
      return serialized(deps.storage, async () => {
        try {
          const current = await readEnvelope();
          if (!current) return { status: 'storage_corrupt' as const };
          const existing = current.runs.find(item => item.courseRunId === input.courseRunId);
          if (existing) return { status: 'captured' as const, snapshot: existing };
          if (prepared.revision !== revision() || JSON.stringify(current) !== JSON.stringify(prepared.envelope)) return { status: 'stale' as const };
          await writeEnvelope({ ...envelope, runs: [...envelope.runs, snapshot] });
          freshEvidenceWindows.set(input.courseRunId, evidenceFence());
        }
        catch { return { status: 'storage_unavailable' as const }; }
        return { status: 'captured' as const, snapshot };
      });
    },

    async captureStopPersonalizationEligibility(input: Readonly<{ courseRunId: string; stopOrdinal: 1 | 2; confirmationEventId: string }>) {
      if (!text(input?.courseRunId) || !text(input?.confirmationEventId) || (input.stopOrdinal !== 1 && input.stopOrdinal !== 2)) return { status: 'invalid_input' as const };
      const prepared = await serialized(deps.storage, async () => {
        try {
          const envelope = await readEnvelope();
          if (!envelope) return { status: 'storage_corrupt' as const };
          const run = envelope.runs.find(item => item.courseRunId === input.courseRunId);
          if (!run) return { status: 'not_found' as const };
          freshEvidenceWindows.delete(input.courseRunId);
          if (run.evidenceMode) return { status: 'captured' as const, eligibility: null };
          const existing = run.stops.find(item => item.stopOrdinal === input.stopOrdinal);
          if (existing) {
            if (existing.confirmationEventId !== input.confirmationEventId) return { status: 'conflict' as const };
            // Once another/cold caller observes exclusion, an older in-flight call cannot approve it later.
            if (existing.eligibility === null) invalidateCaptures();
            return { status: 'captured' as const, eligibility: existing.eligibility };
          }
          // Durable null reservation: only THIS outstanding call may approve it. Cold/duplicate calls cannot.
          const updated = { ...run, stops: [...run.stops, { stopOrdinal: input.stopOrdinal, confirmationEventId: input.confirmationEventId, eligibility: null, learning: null }] };
          const reserved = { ...envelope, runs: envelope.runs.map(item => item.courseRunId === input.courseRunId ? updated : item) };
          await writeEnvelope(reserved);
          return { status: 'ready' as const, envelope: reserved, run: updated, revision: revision() };
        } catch { return { status: 'storage_unavailable' as const }; }
      });
      if (prepared.status !== 'ready') return prepared;
      const envelope = prepared.envelope;
        const run = prepared.run;
        let eligibility: DwellEligibilitySnapshotV1 | null = null;
        if (run.owner.kind === 'account' && run.runEligibility) {
          try {
            const first = await deps.identity.resolve();
            const consent = await deps.dwellRemote.readConsent();
            const second = await deps.identity.resolve();
            if (first.status === 'account' && second.status === 'account'
              && first.identity.subject === run.owner.subject && second.identity.subject === run.owner.subject
              && consent.enabled && consent.consentEpoch === run.runEligibility.consentEpoch && consent.revision === run.runEligibility.consentRevision) {
              eligibility = run.runEligibility;
            }
          } catch { eligibility = null; }
        }
      return serialized(deps.storage, async () => {
        try {
          const current = await readEnvelope();
          if (!current) return { status: 'storage_corrupt' as const };
          const latest = current.runs.find(item => item.courseRunId === input.courseRunId);
          if (!latest) return { status: 'not_found' as const };
          const duplicate = latest.stops.find(item => item.stopOrdinal === input.stopOrdinal);
          if (!duplicate || duplicate.confirmationEventId !== input.confirmationEventId) return { status: 'conflict' as const };
          const local = await ownerRepository(latest.owner.ownerKey).read();
          if (local.status !== 'ok' && local.status !== 'empty') return { status: local.status };
          const completed = latest.visitSync !== null || local.records.some(item => item.courseRunId === input.courseRunId);
          // Persist the exclusion, not a retriable absence. A later current consent cannot approve this event.
          if (completed || prepared.revision !== revision() || JSON.stringify(current) !== JSON.stringify(envelope)) return { status: 'captured' as const, eligibility: null };
          if (!eligibility) return { status: 'captured' as const, eligibility: null };
          const updated = { ...latest, stops: latest.stops.map(stop => stop.stopOrdinal === input.stopOrdinal ? { ...stop, eligibility } : stop) };
          await writeEnvelope({ ...current, runs: current.runs.map(item => item.courseRunId === input.courseRunId ? updated : item) });
        }
        catch { return { status: 'storage_unavailable' as const }; }
        return { status: 'captured' as const, eligibility };
      });
    },

    async completeCourseRun(input: CompleteCourseInput) {
      // Close approval synchronously; an optional storage callback settling during local completion is too late.
      if (text(input?.courseRunId)) terminalEvidenceRuns.add(input.courseRunId);
      const captured = await serialized(deps.storage, async () => {
        let envelope: DeviceEnvelopeV1 | null;
        try { envelope = await readEnvelope(); } catch { return { status: 'storage_unavailable' as const }; }
        if (!envelope) return { status: 'storage_corrupt' as const };
        const run = envelope.runs.find((item) => item.courseRunId === input.courseRunId);
        if (!run) return { status: 'run_not_captured' as const };
        invalidateCaptures();
        const local = await ownerRepository(run.owner.ownerKey).complete(input);
        if (local.status !== 'created' && local.status !== 'already_completed') return { status: local.status };
        freshEvidenceWindows.delete(run.courseRunId);
        // Only write-acknowledged optional evidence is copied. Never await the optional evidence queue here.
        const accepted = evidence.takeAccepted(run.courseRunId, envelope.evidenceGeneration ?? 0);
        const evidenceStops = run.evidenceMode === 'active' && run.visitSync === null ? accepted.map(stop => ({ stopOrdinal: stop.stopOrdinal,
          confirmationEventId: stop.eventId, eligibility: local.record.places[stop.stopOrdinal - 1]?.contentId === stop.contentId ? run.runEligibility : null, learning: null })) : [];
        const sourceStops = run.evidenceMode && run.visitSync === null ? evidenceStops : run.stops;
        const firstEligibleAt = Math.min(local.record.completedAt, now());
        const stops = sourceStops.map((stop) => {
          if (stop.learning || !run.runEligibility || !stop.eligibility) return stop;
          const place = local.record.places[stop.stopOrdinal - 1];
          if (!place || place.actualDwellMin === null || place.subCategory === null) return stop;
          return { ...stop, learning: { firstEligibleAt, state: 'pending' as const } };
        });
        let learningStateStored = true;
        const visitSync = run.owner.kind === 'account' ? 'pending' as const : 'not_applicable' as const;
        try { await writeEnvelope({ ...envelope, runs: envelope.runs.map((item) => item.courseRunId === run.courseRunId ? { ...run, visitSync, stops, ...(run.evidenceMode ? { evidenceMode: 'closed' as const } : {}) } : item) }); }
        catch { learningStateStored = false; }
        if (learningStateStored) terminalEvidenceRuns.delete(run.courseRunId);
        if (run.evidenceMode) void evidence.purgeRunLearningEvidence({ courseRunId: run.courseRunId });
        return { status: 'completed' as const, localStatus: local.status, record: local.record, learningStateStored, remoteSyncRequired: run.owner.kind === 'account' };
      });
      if (captured.status !== 'completed') return { ...captured, sync: { status: 'not_started' as const, submittedSampleCount: 0 } };
      const { learningStateStored, remoteSyncRequired, ...localResult } = captured;
      return {
        ...localResult,
        sync: { status: remoteSyncRequired ? 'pending' as const : 'not_applicable' as const },
        learning: { status: learningStateStored ? 'recorded' as const : 'excluded_storage_failure' as const },
      };
    },

    retryCourseRunSync(input: Readonly<{ courseRunId: string }>) { return syncRun(input.courseRunId); },

    async readPendingCourseRunSyncs() {
      try {
        const identity = await deps.identity.resolve();
        if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status, courseRunIds: [] as const };
        const envelope = await readEnvelope();
        if (!envelope) return { status: 'storage_corrupt' as const, courseRunIds: [] as const };
        const ownerKey = `account:${identity.identity.subject}`;
        const local = await ownerRepository(ownerKey).read();
        if (local.status !== 'ok' && local.status !== 'empty') return { status: local.status, courseRunIds: [] as const };
        const completed = new Set(local.records.map((record) => record.courseRunId));
        const courseRunIds = envelope.runs.filter((run) => run.owner.ownerKey === ownerKey && completed.has(run.courseRunId)
          && (run.visitSync !== 'synced' || run.stops.some((stop) => stop.learning?.state === 'pending' || stop.learning?.state === 'queued')))
          .map((run) => run.courseRunId);
        return { status: courseRunIds.length ? 'ok' as const : 'empty' as const, courseRunIds };
      } catch { return { status: 'storage_unavailable' as const, courseRunIds: [] as const }; }
    },

    async readDeviceCourseCompletions() {
      try {
        const current = await currentOwnerForRead();
        if (current.status === 'empty') return { status: 'empty' as const, records: [] as const };
        if (current.status !== 'ok') return { status: current.status, records: [] as const };
        return ownerRepository(current.ownerKey).read();
      } catch { return { status: 'storage_unavailable' as const, records: [] as const }; }
    },

    async readGuestImportSource(input: Readonly<{ surface: 'login' | 'records' }>) {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status, records: [] as const };
      try {
        const envelope = await readEnvelope();
        if (!envelope) return { status: 'storage_corrupt' as const, records: [] as const };
        const guest = await readGuestRecords();
        const legacy = await deps.legacyCompletions.read();
        if (guest.status !== 'ok' || (legacy.status !== 'ok' && legacy.status !== 'empty')) return { status: guest.status !== 'ok' ? guest.status : legacy.status, records: [] as const };
        const records: GuestImportSourceRecordV1[] = [
          ...guest.records.map((record) => ({ source: 'guest' as const, record })),
          ...legacy.records.map((record) => ({ source: 'legacy_unassigned' as const, record })),
        ];
        const flattened = records.map((item) => item.record);
        if (!flattened.length) return { status: 'empty' as const, records: flattened };
        if (input.surface === 'login' && envelope.dismissedImportSubjects.includes(identity.identity.subject)) return { status: 'dismissed' as const, records: flattened };
        return { status: 'available' as const, records: flattened, sources: records };
      } catch { return { status: 'storage_unavailable' as const, records: [] as const }; }
    },

    async dismissGuestImportOffer() {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'account_required' as const };
      return serialized(deps.storage, async () => {
        let envelope: DeviceEnvelopeV1 | null;
        try { envelope = await readEnvelope(); } catch { return { status: 'storage_unavailable' as const }; }
        if (!envelope) return { status: 'storage_corrupt' as const };
        if (!envelope.dismissedImportSubjects.includes(identity.identity.subject)) {
          await writeEnvelope({ ...envelope, dismissedImportSubjects: [...envelope.dismissedImportSubjects, identity.identity.subject] });
        }
        return { status: 'dismissed' as const };
      });
    },

    async approveGuestCompletionImport(input: Readonly<{ sourceCompletionIds: readonly string[] }>) {
      const source = await runtime.readGuestImportSource({ surface: 'records' });
      if (source.status !== 'available') return { status: source.status };
      const requested = new Set(input.sourceCompletionIds);
      const records = source.records.filter((record) => requested.has(record.completionId));
      if (!records.length || records.length !== requested.size) return { status: 'invalid_input' as const };
      return guestImport.prepareGuestCompletionImport({ records });
    },

    async continueGuestCompletionImport(input: Readonly<{ importId: string }>) {
      const imported = await guestImport.importGuestCourseCompletions(input);
      if (imported.status !== 'acknowledged' && imported.status !== 'already_acknowledged') return imported;
      return guestImport.finalizeGuestCompletionImport({ importId: input.importId });
    },

    readDwellPersonalizationSamples() { return dwell.readDwellPersonalizationSamples(); },

    async resetDwellPersonalization(input: Readonly<{ requestId: string; expectedRevision: number }>) {
      invalidateCaptures();
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'account_required' as const };
      const result = await dwell.resetDwellPersonalization(input);
      if (result.status !== 'reset') return result;
      try {
        const discarded = await outbox.discardOwner(identity.identity.subject);
        const invalidated = await serialized(deps.storage, async () => {
          const envelope = await readEnvelope();
          if (!envelope) return false;
          await writeEnvelope({ ...envelope, runs: envelope.runs.map((run) => run.owner.kind === 'account' && run.owner.subject === identity.identity.subject
            ? { ...run, runEligibility: null, stops: run.stops.map((stop) => ({ ...stop, eligibility: null })) }
            : run) });
          return true;
        });
        return discarded.status === 'removed' && invalidated ? result : { status: 'local_cleanup_pending' as const, serverResult: result };
      } catch { return { status: 'local_cleanup_pending' as const, serverResult: result }; }
    },

    async cleanupAccountDeviceData() {
      invalidateCaptures();
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'account_required' as const, progressCleanupRequired: false as const };
      return cleanupOwnerData(identity.identity.subject);
    },

    async deleteAllAccountRecords(input: Readonly<{ requestId: string }>) {
      invalidateCaptures();
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'account_required' as const };
      const server = await accountCompletions.deleteAllAccountCourseCompletions(input);
      if (server.status !== 'deleted') return server;
      return { status: 'deleted' as const, generation: server.generation, cleanup: await cleanupOwnerData(identity.identity.subject) };
    },

    async deleteAccountRecord(input: Readonly<{ completionId: string; requestId: string }>) {
      invalidateCaptures();
      if (!text(input?.completionId) || !text(input?.requestId)) return { status: 'invalid_input' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'account_required' as const };
      const ownerKey = `account:${identity.identity.subject}`;
      const local = await ownerRepository(ownerKey).read();
      if (local.status !== 'ok' && local.status !== 'empty') return { status: local.status };
      const record = local.records.find((item) => item.completionId === input.completionId);
      const server = await accountCompletions.deleteAccountCourseCompletion(input);
      if (server.status !== 'deleted' && server.status !== 'not_found') return server;
      try {
        const removed = await ownerRepository(ownerKey).removeByCompletionIds([input.completionId]);
        if (removed.status !== 'removed') throw new Error('completion_cleanup_failed');
        if (record) {
          await serialized(deps.storage, async () => {
            const envelope = await readEnvelope();
            if (!envelope) throw new Error('device_state_corrupt');
            const run = envelope.runs.find((item) => item.courseRunId === record.courseRunId && item.owner.ownerKey === ownerKey);
            for (const stop of run?.stops ?? []) await outbox.acknowledge(stop.confirmationEventId);
            await writeEnvelope({ ...envelope,
              evidenceCleanupRunIds: run?.evidenceMode ? [...new Set([...(envelope.evidenceCleanupRunIds ?? []), record.courseRunId])] : envelope.evidenceCleanupRunIds,
              runs: envelope.runs.filter((item) => item.courseRunId !== record.courseRunId || item.owner.ownerKey !== ownerKey) });
            terminalEvidenceRuns.add(record.courseRunId); evidence.forget(record.courseRunId);
            void evidence.purgeRunLearningEvidence({ courseRunId: record.courseRunId });
          });
        }
        return { ...server, cleanup: { status: 'cleaned' as const, progressCleanupRequired: true as const } };
      } catch {
        return { ...server, cleanup: { status: 'local_cleanup_pending' as const, progressCleanupRequired: true as const } };
      }
    },

    async deleteAccount(input: Readonly<{ requestId: string }>) {
      invalidateCaptures();
      if (!deps.accountDeletion) return { status: 'unavailable' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'account_required' as const };
      const ownerSubject = identity.identity.subject;
      const server = await deps.accountDeletion.deleteAccount(input);
      if (server.status !== 'deleted') return server;
      return { ...server, cleanup: await cleanupOwnerData(ownerSubject) };
    },

    async recheckAccountDeletion(input: Readonly<{ requestId: string }>) {
      if (!deps.accountDeletion) return { status: 'unknown' as const, requestId: input.requestId, retryWithSameRequestId: true as const };
      return deps.accountDeletion.recheckAccountDeletion(input);
    },
  };
  return runtime;
}
