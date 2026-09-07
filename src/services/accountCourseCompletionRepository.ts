import type { CourseCompletionRecordV1 } from './courseCompletionRepository';
import type { AccountIdentityResolver } from './accountIdentity';

export type AccountCompletionPlaceV1 = Readonly<{ stopOrdinal: 1 | 2; contentId: string; title: string; category: string; subCategory: string | null }>;
export type AccountCourseCompletionV1 = Readonly<{ completionId: string; courseRunId: string; completedAtMinute: number; provenance: 'account_completed' | 'guest_import'; learningEligible: false; places: readonly AccountCompletionPlaceV1[] }>;
export type AccountCompletionOwnerSnapshotV1 = Readonly<{ courseRunId: string; ownerSubject: string; generation: number }>;

export interface AccountCompletionOwnerSnapshotStore {
  read(courseRunId: string): Promise<AccountCompletionOwnerSnapshotV1 | null>;
  write(snapshot: AccountCompletionOwnerSnapshotV1): Promise<void>;
  remove(courseRunId: string): Promise<void>;
}

export function createMemoryOwnerSnapshotStore(): AccountCompletionOwnerSnapshotStore {
  const values = new Map<string, AccountCompletionOwnerSnapshotV1>();
  return { async read(id) { return values.get(id) ?? null; }, async write(value) { values.set(value.courseRunId, value); }, async remove(id) { values.delete(id); } };
}

export type AccountCourseCompletionRemote = Readonly<{
  readGeneration(): Promise<number>;
  write(input: Readonly<{ courseRunId: string; completionId: string; completedAtMinute: number; ownerGeneration: number; places: readonly AccountCompletionPlaceV1[] }>): Promise<{ status: 'created' | 'already_completed' | 'stale_generation' | 'idempotency_conflict' }>;
  read(): Promise<readonly AccountCourseCompletionV1[]>;
  deleteOne(completionId: string, requestId: string): Promise<{ status: 'deleted' | 'not_found'; generation: number }>;
  deleteAll(requestId: string): Promise<{ status: 'deleted'; generation: number }>;
}>;

type Dependencies = Readonly<{ identity: AccountIdentityResolver; owners: AccountCompletionOwnerSnapshotStore; remote: AccountCourseCompletionRemote }>;
const validId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value;

export function createAccountCourseCompletionRepository(deps: Dependencies) {
  return {
    async captureAccountCompletionOwner(courseRunId: string) {
      if (!validId(courseRunId)) return { status: 'invalid_input' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try {
        const existing = await deps.owners.read(courseRunId);
        if (existing) return existing.ownerSubject === identity.identity.subject
          ? { status: 'captured' as const, generation: existing.generation }
          : { status: 'owner_changed' as const };
        const generation = await deps.remote.readGeneration();
        await deps.owners.write({ courseRunId, ownerSubject: identity.identity.subject, generation });
        return { status: 'captured' as const, generation };
      } catch { return { status: 'unavailable' as const }; }
    },
    async writeAccountCourseCompletion(input: Readonly<{ record: CourseCompletionRecordV1 }>) {
      const record = input?.record;
      if (!record || !validId(record.courseRunId) || !validId(record.completionId) || !Number.isSafeInteger(record.completedAt) || record.completedAt <= 0 || ![1, 2].includes(record.places?.length)) return { status: 'invalid_input' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      let owner: AccountCompletionOwnerSnapshotV1 | null;
      try { owner = await deps.owners.read(record.courseRunId); } catch { return { status: 'unavailable' as const }; }
      if (!owner || owner.ownerSubject !== identity.identity.subject) return { status: 'owner_changed' as const };
      const places = record.places.map((place, index) => ({ stopOrdinal: (index + 1) as 1 | 2, contentId: place.contentId, title: place.title, category: place.category, subCategory: place.subCategory }));
      try { return await deps.remote.write({ courseRunId: record.courseRunId, completionId: record.completionId, completedAtMinute: Math.floor(record.completedAt / 60_000), ownerGeneration: owner.generation, places }); }
      catch { return { status: 'unavailable' as const }; }
    },
    async readAccountCourseCompletions() {
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status, records: [] as const };
      try { const records = await deps.remote.read(); return { status: records.length ? 'ok' as const : 'empty' as const, records }; }
      catch { return { status: 'unavailable' as const, records: [] as const }; }
    },
    async deleteAccountCourseCompletion(input: Readonly<{ completionId: string; requestId: string }>) {
      if (!validId(input?.completionId) || !validId(input?.requestId)) return { status: 'invalid_input' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try { return await deps.remote.deleteOne(input.completionId, input.requestId); } catch { return { status: 'unavailable' as const }; }
    },
    async deleteAllAccountCourseCompletions(input: Readonly<{ requestId: string }>) {
      if (!validId(input?.requestId)) return { status: 'invalid_input' as const };
      const identity = await deps.identity.resolve();
      if (identity.status !== 'account') return { status: identity.status === 'account_required' ? 'account_required' as const : identity.status };
      try { return await deps.remote.deleteAll(input.requestId); } catch { return { status: 'unavailable' as const }; }
    },
  };
}
