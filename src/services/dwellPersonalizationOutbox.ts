export type DwellOutboxItemV1 = Readonly<{
  completionEventId: string; courseRunId: string; stopOrdinal: 1 | 2; contentId: string; category: string; subCategory: string;
  actualDwellMin: number; completedAtMinute: number; ownerSubject: string; consentEpoch: string; consentRevision: number;
}>;
export type StoredDwellOutboxItemV1 = DwellOutboxItemV1 & Readonly<{ queuedAt: number }>;
export interface DwellOutboxStorage { read(): Promise<readonly StoredDwellOutboxItemV1[]>; write(items: readonly StoredDwellOutboxItemV1[]): Promise<void> }

export function createMemoryDwellOutboxStorage(): DwellOutboxStorage {
  let items: readonly StoredDwellOutboxItemV1[] = [];
  return { async read() { return items; }, async write(next) { items = [...next]; } };
}

export function createDwellOutbox(storage: DwellOutboxStorage, options: Readonly<{ now?: () => number; maxItems?: number; retentionMs?: number; beforeEvict?: (completionEventIds: readonly string[]) => Promise<void> }> = {}) {
  const now = options.now ?? Date.now;
  const maxItems = options.maxItems ?? 32;
  const retentionMs = options.retentionMs ?? 7 * 86_400_000;
  const fresh = (items: readonly StoredDwellOutboxItemV1[]) => items.filter((item) => now() - item.queuedAt <= retentionMs);
  const exactKeys = ['actualDwellMin','category','completedAtMinute','completionEventId','consentEpoch','consentRevision','contentId','courseRunId','ownerSubject','stopOrdinal','subCategory'];
  const valid = (item: DwellOutboxItemV1) => item && Object.keys(item).sort().join('|') === exactKeys.join('|')
    && typeof item.completionEventId === 'string' && item.completionEventId.length > 0
    && typeof item.courseRunId === 'string' && item.courseRunId.length > 0
    && (item.stopOrdinal === 1 || item.stopOrdinal === 2)
    && typeof item.contentId === 'string' && item.contentId.length > 0
    && typeof item.category === 'string' && item.category.length > 0
    && typeof item.subCategory === 'string' && item.subCategory.length > 0
    && Number.isSafeInteger(item.actualDwellMin) && item.actualDwellMin > 0
    && Number.isSafeInteger(item.completedAtMinute) && item.completedAtMinute > 0
    && typeof item.ownerSubject === 'string' && item.ownerSubject.length > 0
    && typeof item.consentEpoch === 'string' && item.consentEpoch.length > 0
    && Number.isSafeInteger(item.consentRevision) && item.consentRevision > 0;
  return {
    async enqueue(item: DwellOutboxItemV1, enqueueOptions: Readonly<{ firstQueuedAt?: number }> = {}) {
      if (!valid(item)) return { status: 'invalid_input' as const };
      try {
        const items = fresh(await storage.read());
        const existing = items.find((candidate) => candidate.completionEventId === item.completionEventId);
        if (existing) return JSON.stringify({ ...existing, queuedAt: undefined }) === JSON.stringify({ ...item, queuedAt: undefined }) ? { status: 'already_queued' as const } : { status: 'idempotency_conflict' as const };
        const firstQueuedAt = enqueueOptions.firstQueuedAt ?? now();
        if (!Number.isSafeInteger(firstQueuedAt) || firstQueuedAt <= 0 || firstQueuedAt > now()) return { status: 'invalid_input' as const };
        if (now() - firstQueuedAt > retentionMs) return { status: 'expired' as const };
        const combined = [...items, { ...item, queuedAt: firstQueuedAt }]
          .sort((left, right) => left.queuedAt - right.queuedAt || left.completionEventId.localeCompare(right.completionEventId));
        const kept = combined.slice(-maxItems);
        const keptIds = new Set(kept.map((candidate) => candidate.completionEventId));
        const evictedCompletionEventIds = combined.filter((candidate) => !keptIds.has(candidate.completionEventId)).map((candidate) => candidate.completionEventId);
        if (evictedCompletionEventIds.length) await options.beforeEvict?.(evictedCompletionEventIds);
        await storage.write(kept);
        return { status: 'queued' as const, evictedCompletionEventIds };
      } catch { return { status: 'unavailable' as const }; }
    },
    async readEligible(eligibility: Readonly<{ ownerSubject: string; consentEpoch: string; consentRevision: number }>) {
      try {
        const all = await storage.read(); const current = fresh(all);
        if (!all.every(({ queuedAt, ...item }) => Number.isSafeInteger(queuedAt) && valid(item as DwellOutboxItemV1))) return { status: 'unavailable' as const, items: [] as const };
        if (current.length !== all.length) await storage.write(current);
        return { status: 'ok' as const, items: current.filter((item) => item.ownerSubject === eligibility.ownerSubject && item.consentEpoch === eligibility.consentEpoch && item.consentRevision === eligibility.consentRevision) };
      } catch { return { status: 'unavailable' as const, items: [] as const }; }
    },
    async acknowledge(completionEventId: string) {
      try {
        const items = fresh(await storage.read());
        await storage.write(items.filter((item) => item.completionEventId !== completionEventId));
        return { status: 'removed' as const };
      } catch { return { status: 'unavailable' as const }; }
    },
    async discardOwner(ownerSubject: string) {
      try {
        const items = fresh(await storage.read());
        await storage.write(items.filter((item) => item.ownerSubject !== ownerSubject));
        return { status: 'removed' as const };
      } catch { return { status: 'unavailable' as const }; }
    },
  };
}
