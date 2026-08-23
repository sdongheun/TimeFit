import type { PlaceFeedback } from '../../services/placeFeedback';

export type ActivityCategorySummary = {
  category: string;
  count: number;
  dwellMin: number;
  ratio: number;
};

export type ActivitySummary = {
  completedPlaceCount: number;
  completedDwellMin: number;
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

  return { completedPlaceCount, completedDwellMin, categories };
}
