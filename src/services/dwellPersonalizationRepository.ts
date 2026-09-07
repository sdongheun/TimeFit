import type { DwellPersonalizationSampleV1 } from '../engine/dwellPersonalization';
import type { AccountIdentityResolver } from './accountIdentity';

export type DwellConsentStateV1 = Readonly<{ enabled: boolean; consentEpoch: string | null; revision: number; updatedAt: string }>;
export type DwellEligibilitySnapshotV1 = Readonly<{ ownerSubject: string; consentEpoch: string; consentRevision: number }>;
export type DwellSampleRemoteInputV1 = Readonly<{
  completionEventId: string; courseRunId: string; stopOrdinal: 1 | 2; contentId: string; category: string; subCategory: string;
  actualDwellMin: number; completedAtMinute: number; ownerSubject: string; consentEpoch: string; consentRevision: number;
}>;

export type DwellPersonalizationRemote = Readonly<{
  readConsent(): Promise<DwellConsentStateV1>;
  setConsent(input: Readonly<{ requestId: string; enabled: boolean; expectedRevision: number }>): Promise<DwellConsentStateV1 | { conflictRevision: number }>;
  reset(input: Readonly<{ requestId: string; expectedRevision: number }>): Promise<{ consent: DwellConsentStateV1; deletedSampleCount: number } | { conflictRevision: number }>;
  submit(input: DwellSampleRemoteInputV1): Promise<{ status: 'accepted' | 'already_accepted' | 'idempotency_conflict' | 'catalog_mismatch' | 'consent_changed' | 'stale_generation' }>;
  readSamples(): Promise<readonly DwellPersonalizationSampleV1[]>;
}>;

type Dependencies = Readonly<{ identity: AccountIdentityResolver; remote: DwellPersonalizationRemote; now?: () => number }>;
const DAY = 86_400_000;
const FUTURE_SKEW_MS = 5 * 60_000;
const RETENTION_MS = 180 * DAY;
const id = (value: unknown, max = 200) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;

export function createDwellPersonalizationRepository(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  return {
    async readDwellPersonalizationConsent() {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try { return { status: 'ok' as const, consent: await deps.remote.readConsent() }; } catch { return { status: 'unavailable' as const }; }
    },
    async setDwellPersonalizationConsent(input: Readonly<{ requestId: string; enabled: boolean; expectedRevision: number }>) {
      if (!id(input?.requestId) || typeof input.enabled !== 'boolean' || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return { status: 'invalid_input' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const result = await deps.remote.setConsent(input);
        return 'conflictRevision' in result ? { status: 'conflict' as const, currentRevision: result.conflictRevision } : { status: 'updated' as const, consent: result };
      } catch { return { status: 'unavailable' as const }; }
    },
    async resetDwellPersonalization(input: Readonly<{ requestId: string; expectedRevision: number }>) {
      if (!id(input?.requestId) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) return { status: 'conflict' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const result = await deps.remote.reset(input);
        return 'conflictRevision' in result ? { status: 'conflict' as const } : { status: 'reset' as const, ...result };
      } catch { return { status: 'unavailable' as const }; }
    },
    async submitDwellCompletionSample(input: Readonly<{
      completionEventId: string; courseRunId: string; stopOrdinal: 1 | 2; contentId: string; category: string; subCategory: string;
      actualDwellMin: number; completedAt: number; runEligibility: DwellEligibilitySnapshotV1; stopEligibility: DwellEligibilitySnapshotV1;
    }>) {
      const at = input?.completedAt;
      if (!id(input?.completionEventId) || !id(input?.courseRunId) || ![1, 2].includes(input?.stopOrdinal)
        || !id(input?.contentId, 160) || !id(input?.category, 120) || !id(input?.subCategory, 120)
        || !Number.isFinite(input?.actualDwellMin) || !Number.isInteger(input.actualDwellMin) || input.actualDwellMin <= 0 || input.actualDwellMin > 1440
        || !Number.isSafeInteger(at) || at <= 0 || at > now() + FUTURE_SKEW_MS) return { status: 'invalid_input' as const };
      if (at < now() - RETENTION_MS) return { status: 'expired' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: 'not_eligible' as const, reason: 'account_required' as const };
      let consent: DwellConsentStateV1;
      try { consent = await deps.remote.readConsent(); } catch { return { status: 'unavailable' as const }; }
      if (!consent.enabled || !consent.consentEpoch) return { status: 'not_eligible' as const, reason: 'consent_off' as const };
      const eligible = [input.runEligibility, input.stopEligibility].every((snapshot) => snapshot?.ownerSubject === identity.identity.subject
        && snapshot.consentEpoch === consent.consentEpoch && snapshot.consentRevision === consent.revision);
      if (!eligible) return { status: 'not_eligible' as const, reason: 'consent_changed' as const };
      try {
        const result = await deps.remote.submit({
          completionEventId: input.completionEventId, courseRunId: input.courseRunId, stopOrdinal: input.stopOrdinal,
          contentId: input.contentId, category: input.category, subCategory: input.subCategory, actualDwellMin: input.actualDwellMin,
          completedAtMinute: Math.floor(at / 60_000), ownerSubject: identity.identity.subject,
          consentEpoch: consent.consentEpoch, consentRevision: consent.revision,
        });
        if (result.status === 'consent_changed') return { status: 'not_eligible' as const, reason: 'consent_changed' as const };
        return result;
      } catch { return { status: 'unavailable' as const }; }
    },
    async readDwellPersonalizationSamples() {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status, samples: [] as const };
      try {
        const consent = await deps.remote.readConsent();
        if (!consent.enabled) return { status: 'not_enabled' as const, samples: [] as const };
        const samples = await deps.remote.readSamples();
        return { status: samples.length ? 'ok' as const : 'empty' as const, samples };
      } catch { return { status: 'unavailable' as const, samples: [] as const }; }
    },
  };
}
