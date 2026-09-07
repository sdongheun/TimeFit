import { createReleaseIdentityPersonalizationRuntime } from '../../../src/services/releaseIdentityPersonalizationRuntime';
import { createCourseCompletionRepository } from '../../../src/services/courseCompletionRepository';
import { createAccountIdentityResolver } from '../../../src/services/accountIdentity';

export function ownedCourseFixture() {
  const values = new Map<string, string>(), calls: string[] = [], samples: { category: string; subCategory: string; dwellMin: number }[] = [];
  const storage = { async getItem(k: string) { return values.get(k) ?? null; }, async setItem(k: string, v: string) { values.set(k, v); }, async removeItem(k: string) { values.delete(k); } };
  let actor = 'A', online = true, id = 0;
  let consentBarrier: Promise<void> | null = null;
  let consent = { enabled: true, consentEpoch: 'epoch' as string | null, revision: 1, updatedAt: '' };
  const identity = createAccountIdentityResolver({ async getSession() { return actor === 'guest' ? null : { accessToken: actor, expiresAt: 9999999999 }; }, async getUser() { return { id: actor, email: null, isAnonymous: false }; } }, () => 1);
  const legacy = createCourseCompletionRepository(storage);
  const acknowledged = new Set<string>(), submitted = new Set<string>();
  const deps = {
    storage, identity, legacyCompletions: legacy, now: () => 1788753600000, createDeviceScopeId: () => 'device', createCompletionId: () => `completion-${++id}`, createImportId: () => '11111111-1111-4111-8111-111111111111',
    accountRemote: {
      async readGeneration() { return 1; }, async read() { return []; }, async deleteOne() { return { status: 'deleted' as const, generation: 1 }; }, async deleteAll() { return { status: 'deleted' as const, generation: 1 }; },
      async write(input: { courseRunId: string }) { calls.push('visit'); if (!online) throw Error('offline'); acknowledged.add(input.courseRunId); return { status: 'created' as const }; },
    },
    dwellRemote: {
      async readConsent() { if (consentBarrier) await consentBarrier; return consent; }, async setConsent(input: { enabled: boolean }) { consent = { enabled: input.enabled, consentEpoch: input.enabled ? 'new' : null, revision: consent.revision + 1, updatedAt: '' }; return consent; },
      async reset() { consent = { enabled: false, consentEpoch: null, revision: consent.revision + 1, updatedAt: '' }; return { consent, deletedSampleCount: 0 }; },
      async submit(input: { completionEventId: string; courseRunId: string; category: string; subCategory: string; actualDwellMin: number }) { if (!acknowledged.has(input.courseRunId)) throw Error('missing visit'); calls.push('sample'); if (!submitted.has(input.completionEventId)) samples.push({ category: input.category, subCategory: input.subCategory, dwellMin: input.actualDwellMin }); submitted.add(input.completionEventId); return { status: 'accepted' as const }; },
      async readSamples() { return [...samples]; },
    },
    guestRemote: { async import(input: { importId: string; items: readonly { sourceCompletionId: string }[] }) { calls.push('import'); if (!online) throw Error('offline'); return { status: 'acknowledged' as const, importId: input.importId, acceptedSourceIds: input.items.map(i => i.sourceCompletionId), rejectedSourceIds: [] }; } },
  };
  const make = () => {
    const runtime = createReleaseIdentityPersonalizationRuntime(deps);
    return {
      beginOwnedCourseRun: runtime.beginCourseRun, captureOwnedStopEligibility: runtime.captureStopPersonalizationEligibility, completeOwnedCourseRun: runtime.completeCourseRun,
      preserveUnverifiedOwnedCourseRun: runtime.preserveUnverifiedCourseRun,
      retryOwnedCourseRunSync: runtime.retryCourseRunSync, readPendingOwnedCourseRunSyncs: runtime.readPendingCourseRunSyncs, readOwnedDeviceCourseCompletions: runtime.readDeviceCourseCompletions,
      readGuestCompletionImportSource: runtime.readGuestImportSource, dismissGuestCompletionImportOffer: runtime.dismissGuestImportOffer, approveGuestCompletionImport: runtime.approveGuestCompletionImport, continueGuestCompletionImport: runtime.continueGuestCompletionImport,
      readOwnedDwellPersonalizationSamples: runtime.readDwellPersonalizationSamples, supabaseAccountIdentityResolver: identity,
    };
  };
  return { make, calls, samples, setActor(next: string) { actor = next; }, setOnline(next: boolean) { online = next; }, setConsentBarrier(value: Promise<void> | null) { consentBarrier = value; } };
}
