import type { CourseCompletionRecordV1 } from './courseCompletionRepository';
import type { AccountIdentityResolver } from './accountIdentity';
import type { AccountCompletionPlaceV1 } from './accountCourseCompletionRepository';

export type GuestCompletionImportItemV1 = Readonly<{ sourceCompletionId: string; courseRunId: string; completedAtMinute: number; places: readonly AccountCompletionPlaceV1[] }>;
export type PendingGuestCompletionImportV1 = Readonly<{ importId: string; targetSubject: string; state: 'prepared' | 'acknowledged'; items: readonly GuestCompletionImportItemV1[]; acceptedSourceIds: readonly string[] }>;
export interface GuestImportStore { read(): Promise<PendingGuestCompletionImportV1 | null>; write(value: PendingGuestCompletionImportV1): Promise<void>; clear(): Promise<void> }

export function createMemoryGuestImportStore(): GuestImportStore {
  let value: PendingGuestCompletionImportV1 | null = null;
  return { async read() { return value; }, async write(next) { value = next; }, async clear() { value = null; } };
}

type RemoteReply = Readonly<{ status: 'acknowledged' | 'already_acknowledged'; importId: string; acceptedSourceIds: readonly string[]; rejectedSourceIds: readonly string[] }>;
type Dependencies = Readonly<{
  identity: AccountIdentityResolver;
  pending: GuestImportStore;
  source: Readonly<{ removeByIds(ids: readonly string[]): Promise<void> }>;
  remote: Readonly<{ import(input: Readonly<{ importId: string; items: readonly GuestCompletionImportItemV1[] }>): Promise<RemoteReply> }>;
  createImportId?: () => string;
}>;

const defaultImportId = () => globalThis.crypto?.randomUUID?.() ?? `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createGuestCompletionImportRepository(deps: Dependencies) {
  return {
    async prepareGuestCompletionImport(input: Readonly<{ records: readonly CourseCompletionRecordV1[] }>) {
      if (!Array.isArray(input?.records) || !input.records.length) return { status: 'empty' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const existing = await deps.pending.read();
        if (existing) return existing.targetSubject === identity.identity.subject ? { status: 'prepared' as const, importId: existing.importId } : { status: 'blocked' as const, reason: 'pending_for_other_account' as const };
        const importId = (deps.createImportId ?? defaultImportId)();
        const records: readonly CourseCompletionRecordV1[] = input.records;
        const items = records.map((record) => ({
          sourceCompletionId: record.completionId, courseRunId: record.courseRunId, completedAtMinute: Math.floor(record.completedAt / 60_000),
          places: record.places.map((place, index) => ({ stopOrdinal: (index + 1) as 1 | 2, contentId: place.contentId, title: place.title, category: place.category, subCategory: place.subCategory })),
        }));
        await deps.pending.write({ importId, targetSubject: identity.identity.subject, state: 'prepared', items, acceptedSourceIds: [] });
        return { status: 'prepared' as const, importId };
      } catch { return { status: 'unavailable' as const }; }
    },
    async importGuestCourseCompletions(input: Readonly<{ importId: string }>) {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const pending = await deps.pending.read();
        if (!pending || pending.importId !== input.importId) return { status: 'invalid_input' as const };
        if (pending.targetSubject !== identity.identity.subject) return { status: 'account_changed' as const };
        const reply = await deps.remote.import({ importId: pending.importId, items: pending.items });
        const known = new Set(pending.items.map((item) => item.sourceCompletionId));
        if (reply.importId !== pending.importId || reply.acceptedSourceIds.some((id) => !known.has(id))) return { status: 'unavailable' as const };
        await deps.pending.write({ ...pending, state: 'acknowledged', acceptedSourceIds: [...reply.acceptedSourceIds] });
        return reply;
      } catch { return { status: 'unavailable' as const }; }
    },
    async finalizeGuestCompletionImport(input: Readonly<{ importId: string }>) {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const pending = await deps.pending.read();
        if (!pending || pending.importId !== input.importId) return { status: 'cleanup_pending' as const };
        if (pending.targetSubject !== identity.identity.subject) return { status: 'account_changed' as const };
        if (pending.state !== 'acknowledged') return { status: 'cleanup_pending' as const };
        await deps.source.removeByIds(pending.acceptedSourceIds);
        await deps.pending.clear();
        return { status: 'source_removed' as const };
      } catch { return { status: 'cleanup_pending' as const }; }
    },
  };
}
