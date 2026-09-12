import type { PlaceFeedback } from '../../services/placeFeedback';
import {
  buildCourseCompletionActivityReadModel,
  type CourseCompletionRecordV1,
  type ReadCourseCompletionsResult,
} from '../../services/courseCompletionRepository';

export type ActivityCategorySummary = {
  category: string;
  count: number;
  dwellMin: number;
  ratio: number;
};

export type ActivitySummary = {
  completedPlaceCount: number;
  completedDwellMin: number;
  measuredCount: number;
  unmeasuredCount: number;
  dwellPresentation:
    | { kind: 'empty' }
    | { kind: 'unmeasured' }
    | { kind: 'measured'; measuredMin: number; measuredCount: number }
    | { kind: 'partial'; measuredMin: number; measuredCount: number; unmeasuredCount: number };
  categories: ActivityCategorySummary[];
};

function isSameMonth(timestamp: number, now: Date) {
  const date = new Date(timestamp);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function summarizeCompletedActivities(records: PlaceFeedback[], nowMs = Date.now()): ActivitySummary {
  const now = new Date(nowMs);
  const grouped = new Map<string, { count: number; dwellMin: number }>();
  let completedPlaceCount = 0;
  let completedDwellMin = 0;

  for (const record of records) {
    if (!isSameMonth(record.completedAt, now)) continue;
    const dwellMin = Number.isFinite(record.actualDwellMin) ? Math.max(0, Math.round(record.actualDwellMin!)) : 0;
    completedPlaceCount += 1;
    completedDwellMin += dwellMin;
    const previous = grouped.get(record.category) ?? { count: 0, dwellMin: 0 };
    grouped.set(record.category, { count: previous.count + 1, dwellMin: previous.dwellMin + dwellMin });
  }

  const categories = [...grouped.entries()]
    .map(([category, value]) => ({
      category,
      ...value,
      ratio: completedDwellMin ? Math.round(value.dwellMin / completedDwellMin * 100) : 0,
    }))
    .sort((left, right) => right.dwellMin - left.dwellMin || right.count - left.count || left.category.localeCompare(right.category, 'ko'));

  const measuredCount = records.filter((record) => isSameMonth(record.completedAt, now) && Number.isFinite(record.actualDwellMin)).length;
  const unmeasuredCount = completedPlaceCount - measuredCount;
  return {
    completedPlaceCount,
    completedDwellMin,
    measuredCount,
    unmeasuredCount,
    dwellPresentation: completedPlaceCount === 0
      ? { kind: 'empty' }
      : measuredCount === 0
        ? { kind: 'unmeasured' }
        : unmeasuredCount > 0
          ? { kind: 'partial', measuredMin: completedDwellMin, measuredCount, unmeasuredCount }
          : { kind: 'measured', measuredMin: completedDwellMin, measuredCount },
    categories,
  };
}

export function buildCompletionHistorySummary(
  completionRecords: readonly CourseCompletionRecordV1[],
  legacyFeedback: readonly unknown[],
  nowMs = Date.now(),
): ActivitySummary {
  const now = new Date(nowMs);
  const activities = buildCourseCompletionActivityReadModel(completionRecords, legacyFeedback).activities
    .filter((activity) => isSameMonth(activity.completedAt, now));
  return summarizeActivityVisits(activities);
}

/** Counts completed visits, not unique map markers. Caller owns the period/owner filter. */
export function summarizeActivityVisits(activities:readonly {category:string;actualDwellMin:number|null}[]):ActivitySummary {
  const grouped = new Map<string, { count: number; dwellMin: number }>();
  let completedDwellMin = 0;
  let measuredCount = 0;
  for (const activity of activities) {
    const measured = activity.actualDwellMin !== null;
    const dwellMin = activity.actualDwellMin ?? 0;
    if (measured) {
      measuredCount += 1;
      completedDwellMin += dwellMin;
    }
    const previous = grouped.get(activity.category) ?? { count: 0, dwellMin: 0 };
    grouped.set(activity.category, { count: previous.count + 1, dwellMin: previous.dwellMin + dwellMin });
  }
  const completedPlaceCount = activities.length;
  const unmeasuredCount = completedPlaceCount - measuredCount;
  const categories = [...grouped.entries()]
    .map(([category, value]) => ({
      category,
      ...value,
      ratio: completedPlaceCount ? Math.round(value.count / completedPlaceCount * 100) : 0,
    }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category, 'ko'));
  return {
    completedPlaceCount,
    completedDwellMin,
    measuredCount,
    unmeasuredCount,
    dwellPresentation: completedPlaceCount === 0
      ? { kind: 'empty' }
      : measuredCount === 0
        ? { kind: 'unmeasured' }
        : unmeasuredCount > 0
          ? { kind: 'partial', measuredMin: completedDwellMin, measuredCount, unmeasuredCount }
          : { kind: 'measured', measuredMin: completedDwellMin, measuredCount },
    categories,
  };
}

export type CompletionHistoryLoadResult =
  | Readonly<{ status: 'ready'; summary: ActivitySummary }>
  | Readonly<{ status: 'empty'; summary: ActivitySummary }>
  | Readonly<{ status: 'storage_unavailable' }>
  | Readonly<{ status: 'storage_corrupt' }>;

export async function loadCompletionHistory(input: Readonly<{
  readCompletions: () => Promise<ReadCourseCompletionsResult>;
  readLegacyFeedback: () => Promise<readonly unknown[]>;
  nowMs?: number;
}>): Promise<CompletionHistoryLoadResult> {
  const completions = await input.readCompletions().catch((): ReadCourseCompletionsResult => ({ status: 'storage_unavailable', records: [] }));
  if (completions.status === 'storage_unavailable' || completions.status === 'storage_corrupt') return { status: completions.status };
  let legacy: readonly unknown[];
  try {
    legacy = await input.readLegacyFeedback();
  } catch {
    return { status: 'storage_unavailable' };
  }
  const summary = buildCompletionHistorySummary(completions.records, legacy, input.nowMs);
  return { status: summary.completedPlaceCount ? 'ready' : 'empty', summary };
}
