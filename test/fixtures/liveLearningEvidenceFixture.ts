import { createAccountIdentityResolver } from '../../src/services/accountIdentity';
import { createCourseCompletionRepository } from '../../src/services/courseCompletionRepository';
import { createReleaseIdentityPersonalizationRuntime, withCourseRunCaptureInvalidation } from '../../src/services/releaseIdentityPersonalizationRuntime';
import type { DwellPersonalizationRemote } from '../../src/services/dwellPersonalizationRepository';

export function liveEvidenceFixture() {
  const values = new Map<string, string>(), calls: string[] = [], visits = new Set<string>();
  const samples = new Map<string, { category: string; subCategory: string; dwellMin: number }>();
  let actor = 'A', sequence = 0, online = true, currentTime = 1788753600000;
  const storage = {
    async getItem(key: string) { return values.get(key) ?? null; },
    async setItem(key: string, value: string) { values.set(key, value); },
    async removeItem(key: string) { values.delete(key); },
  };
  const identity = createAccountIdentityResolver({
    async getSession() { return actor === 'guest' ? null : { accessToken: 'fixture-only', expiresAt: 9999999999999 }; },
    async getUser() { return actor === 'error' ? null : { id: actor, email: null, isAnonymous: actor === 'anonymous' }; },
  }, () => currentTime);
  let consent = { enabled: true, consentEpoch: 'epoch' as string | null, revision: 1, updatedAt: '' };
  const remote: DwellPersonalizationRemote = {
    async readConsent() { return consent; },
    async setConsent(input) { consent = { enabled: input.enabled, consentEpoch: input.enabled ? `epoch-${consent.revision + 1}` : null, revision: consent.revision + 1, updatedAt: '' }; return consent; },
    async reset() { samples.clear(); consent = { enabled: false, consentEpoch: null, revision: consent.revision + 1, updatedAt: '' }; return { consent, deletedSampleCount: 0 }; },
    async submit(input) { assertVisit(input.courseRunId); calls.push('sample'); if (!online) throw Error('offline'); samples.set(input.completionEventId, { category: input.category, subCategory: input.subCategory, dwellMin: input.actualDwellMin }); return { status: 'accepted' }; },
    async readSamples() { return [...samples.values()]; },
  };
  function assertVisit(run: string) { if (!visits.has(run)) throw Error('visit_ack_missing'); }
  let runtime: ReturnType<typeof createReleaseIdentityPersonalizationRuntime>;
  const deps = {
    storage, identity, legacyCompletions: createCourseCompletionRepository(storage), now: () => currentTime,
    createDeviceScopeId: () => 'device', createCompletionId: () => `completion-${++sequence}`,
    createEvidenceToken: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    accountRemote: {
      async readGeneration() { return 1; }, async read() { return []; },
      async write(input: { courseRunId: string }) { calls.push('visit'); if (!online) throw Error('offline'); visits.add(input.courseRunId); return { status: 'created' as const }; },
      async deleteOne() { return { status: 'deleted' as const, generation: 1 }; }, async deleteAll() { return { status: 'deleted' as const, generation: 2 }; },
    },
    dwellRemote: withCourseRunCaptureInvalidation(remote, () => runtime.invalidatePendingCourseRunCaptures()),
    guestRemote: { async import(input: { importId: string }) { return { status: 'acknowledged' as const, importId: input.importId, acceptedSourceIds: [], rejectedSourceIds: [] }; } },
  };
  const make = () => { runtime = createReleaseIdentityPersonalizationRuntime(deps); return runtime; };
  const makeCold = () => {
    // New port identity removes process-local WeakMap fences; only persisted data can protect recovery.
    runtime = createReleaseIdentityPersonalizationRuntime({ ...deps, storage: {
      getItem: key => deps.storage.getItem(key), setItem: (key, value) => deps.storage.setItem(key, value), removeItem: key => deps.storage.removeItem(key),
    } });
    return runtime;
  };
  return { make, makeCold, deps, values, calls, samples, remote, actor(value: string) { actor = value; }, online(value: boolean) { online = value; }, time(value: number) { currentTime = value; } };
}

export const evidenceStops = [{ stopId: 'stop-1', stopOrdinal: 1 as const, contentId: 'p' }];
export const evidenceCompletion = (courseRunId: string) => ({ courseRunId, completedAt: 1788753500000, trigger: 'explicit_course_finish' as const,
  places: [{ contentId: 'p', title: 'fixture', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 40 }] });
export function evidenceConfirmation(courseRunId: string, evidence: unknown, source = 'live_activity_intent') {
  return {
    receipt: { courseRunId, stopId: 'stop-1', eventId: `arrival-${courseRunId}`, baseRevision: 2, type: 'arrival_confirmed', source, evidence },
    application: { courseRunId, stopId: 'stop-1', stopOrdinal: 1 as 1 | 2, firstArrivalEventId: `arrival-${courseRunId}`, arrivalBaseRevision: 2, source, outcome: 'applied' as 'applied' | 'replayed_first' | 'stale' },
  };
}
export function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
export async function checkpoint() { for (let n = 0; n < 250; n++) await Promise.resolve(); }
