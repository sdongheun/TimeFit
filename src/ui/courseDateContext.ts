import type { PlanCtx } from './nav';

type ReplanFields = Partial<Omit<PlanCtx, 'startedAtIso' | 'endsAtIso' | 'courseDateIssue'>>;

/** Replanning changes display minutes, not the original dated start or repository issue.
 * No date parsing/fallback here: the repository owns validation and original-row reconciliation.
 */
export function preserveCourseDateContext(source: PlanCtx, updates: ReplanFields = {}): PlanCtx {
  return { ...source, ...updates, startedAtIso: source.startedAtIso, endsAtIso: source.endsAtIso, courseDateIssue: source.courseDateIssue };
}

/** Fail closed until the repository supplies the original deadline, including after repeated edits. */
export function courseReplanTiming(ctx: PlanCtx, nowMs: number): { kind: 'ready'; remainingMin: number } | { kind: 'expired' } | { kind: 'unavailable' } {
  const start = Date.parse(ctx.startedAtIso ?? '');
  const end = Date.parse(ctx.endsAtIso ?? '');
  if (ctx.courseDateIssue !== undefined || !Number.isFinite(nowMs) || !Number.isFinite(start) || !Number.isFinite(end)
    || end <= start || new Date(end).toISOString() !== ctx.endsAtIso) return { kind: 'unavailable' };
  const remainingMin = Math.floor((end - nowMs) / 60_000);
  return remainingMin <= 0 ? { kind: 'expired' } : { kind: 'ready', remainingMin };
}
