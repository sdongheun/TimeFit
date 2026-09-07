import type { ConfirmationEvidenceInput, LearningEvidenceProjectionV1, LearningEvidencePublicationPort, LearningEvidenceStopV1 } from '../../services/liveLearningEvidence';

type Ports = typeof import('../../services/releaseIdentitySupabase');
export type LearningNativePort = LearningEvidencePublicationPort & {
  setActiveRun(courseRunId: string): void;
  readActive(courseRunId: string): LearningEvidenceProjectionV1 | null;
  readScope(): string | null;
  clearExact(courseRunId: string): Promise<void>;
  clearReceipts?(courseRunId: string): Promise<void>;
  receiptRuns?(): Promise<readonly string[]>;
  activeProgressRun?(): Promise<string | null>;
};

/** Optional work is never a dependency of route/progress/mandatory completion. No UI durable queue. */
export function createLearningEvidenceCoordinator(getPorts: () => Promise<Ports>, native: LearningNativePort) {
  const closed = new Set<string>();
  let active: string | null = null;
  const close = async (courseRunId: string, reason: 'completed' | 'cancelled' | 'expired' | 'replaced' | 'window_closed') => {
    closed.add(courseRunId);
    const clearing = native.clearExact(courseRunId).then(async () => {
      if (reason !== 'window_closed') await native.clearReceipts?.(courseRunId);
      return true;
    }, () => false).catch(() => false);
    const result = await (await getPorts()).closeOwnedRunLearningEvidence({ courseRunId, reason });
    return { result, nativeCleaned: await clearing };
  };
  const restore = async (courseRunId: string, stops: readonly LearningEvidenceStopV1[]) => {
    if (closed.has(courseRunId)) return;
    return (await getPorts()).prepareOwnedRunLearningEvidence({ courseRunId, stops });
  };
  return {
    start(courseRunId: string) {
      active = courseRunId;
      try { native.setActiveRun(courseRunId); } catch { closed.add(courseRunId); }
    },
    async bootstrap(courseRunId: string, stops: readonly LearningEvidenceStopV1[]) {
      if (active !== courseRunId || closed.has(courseRunId)) return close(courseRunId, 'window_closed');
      const p = await getPorts();
      const prepared = await p.prepareOwnedRunLearningEvidence({ courseRunId, stops });
      if (active !== courseRunId || closed.has(courseRunId) || prepared.status !== 'prepared') return close(courseRunId, 'window_closed');
      const result = await p.publishOwnedRunLearningEvidence({ projection: prepared.projection }, native);
      // Lost activate ack can still leave an action-time token. Never replace it with null.
      if (result.status !== 'published' && !native.readActive(courseRunId)) return close(courseRunId, 'window_closed');
      return result;
    },
    restore,
    capture(courseRunId: string) {
      let value: LearningEvidenceProjectionV1 | null = null;
      try { if (!closed.has(courseRunId)) value = native.readActive(courseRunId); } catch { /* learning only */ }
      if (!value?.publicationToken) { void close(courseRunId, 'window_closed').catch(() => undefined); return undefined; }
      return value;
    },
    async consume(input: ConfirmationEvidenceInput) {
      try {
        const token = (input.receipt.evidence as LearningEvidenceProjectionV1 | undefined)?.publicationToken;
        if (!token && input.application.outcome !== 'stale' && ['app_action', 'live_activity_intent'].includes(input.receipt.source)) {
          await close(input.receipt.courseRunId, 'window_closed');
        }
        return await (await getPorts()).acceptOwnedConfirmationEvidence(input);
      }
      catch { return { status: 'unavailable' as const }; }
    },
    close,
    async clearInvalidatedNative() {
      const run = native.readScope();
      if (run) { closed.add(run); await native.clearExact(run); }
    },
    async retry() {
      const ports = await getPorts();
      const run = native.readScope();
      if (run) {
        const result = await ports.purgeOwnedRunLearningEvidence({ courseRunId: run });
        if (result.status === 'purged') await native.clearExact(run);
      }
      const progressRun = await native.activeProgressRun?.();
      for (const receiptRun of await native.receiptRuns?.() ?? []) {
        if (receiptRun === progressRun) continue;
        if ((await ports.purgeOwnedRunLearningEvidence({ courseRunId: receiptRun })).status === 'purged') await native.clearReceipts?.(receiptRun);
      }
      return ports.retryOwnedLearningEvidenceCleanup();
    },
  };
}
