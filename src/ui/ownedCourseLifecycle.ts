import type { CompleteCourseInput, CompleteCourseResult } from '../services/courseCompletionRepository';

type Ports = typeof import('../services/releaseIdentitySupabase');
export const loadOwnedCoursePorts = () => import('../services/releaseIdentitySupabase');

/** No persistent queue or ownership inference here: all durable state belongs to DB ports. */
export function createOwnedCourseLifecycle(getPorts: () => Promise<Ports> = loadOwnedCoursePorts) {
  const starts = new Map<string, Promise<unknown>>();
  const owners = new Map<string, string | null>();
  const captures = new Set<Promise<unknown>>();
  const syncing = new Map<string, Promise<unknown>>();
  const listeners = new Set<() => void>();
  let recovery: Promise<void> | null = null;
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    begin(courseRunId: string) {
      if (!starts.has(courseRunId)) starts.set(courseRunId, getPorts().then(p => p.beginOwnedCourseRun({ courseRunId })).then(result => {
        if (result.status === 'captured') owners.set(courseRunId, result.snapshot.owner.kind === 'account' ? result.snapshot.owner.subject : null);
        return result;
      }).catch(() => undefined));
      return starts.get(courseRunId)!;
    },
    ownerFor(courseRunId: string) { return owners.get(courseRunId); },
    captureArrival(input: { courseRunId: string; stopOrdinal: 1 | 2; confirmationEventId: string }) {
      const work = (async () => {
        await starts.get(input.courseRunId);
        return (await getPorts()).captureOwnedStopEligibility(input);
      })().catch(() => undefined);
      captures.add(work); void work.finally(() => captures.delete(work));
      return work;
    },
    async complete(input: CompleteCourseInput): Promise<CompleteCourseResult> {
      // Optional eligibility requests do not hold up mandatory completion.
      try {
        const ports = await getPorts();
        if (input.trigger === 'explicit_course_finish') {
          const preserved = await ports.preserveUnverifiedOwnedCourseRun({ courseRunId: input.courseRunId });
          if (preserved.status !== 'captured') return { status: 'storage_unavailable' };
        }
        const result = await ports.completeOwnedCourseRun(input);
        if (result.status === 'completed') return { status: result.localStatus, record: result.record };
        return { status: result.status === 'storage_corrupt' || result.status === 'invalid_input' ? result.status : 'storage_unavailable' };
      } catch { return { status: 'storage_unavailable' }; }
    },
    sync(courseRunId: string) {
      if (!syncing.has(courseRunId)) {
        const task = getPorts().then(p => p.retryOwnedCourseRunSync({ courseRunId })).then(result => { listeners.forEach(listener => listener()); return result; }).catch(() => undefined);
        syncing.set(courseRunId, task); void task.finally(() => syncing.delete(courseRunId));
      }
      return syncing.get(courseRunId)!;
    },
    resumePending() {
      if (!recovery) recovery = (async () => {
        const ports = await getPorts();
        const pending = await ports.readPendingOwnedCourseRunSyncs();
        for (const courseRunId of pending.courseRunIds) await this.sync(courseRunId);
      })().catch(() => undefined).finally(() => { recovery = null; });
      return recovery;
    },
  };
}

export const ownedCourseLifecycle = createOwnedCourseLifecycle();
