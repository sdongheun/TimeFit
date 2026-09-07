import type { CourseCompletionRecordV1 } from '../services/courseCompletionRepository';
import type { AccountCourseCompletionV1 } from '../services/accountCourseCompletionRepository';

export function mergeOwnedRecords(local: readonly CourseCompletionRecordV1[], remote: readonly AccountCourseCompletionV1[]) {
  const rows = new Map(remote.map(record => [record.completionId, { ...record, pending: false }]));
  for (const record of local) if (!rows.has(record.completionId)) rows.set(record.completionId, {
    completionId: record.completionId, courseRunId: record.courseRunId, completedAtMinute: Math.floor(record.completedAt / 60000), provenance: 'account_completed', learningEligible: false,
    places: record.places.map((p, index) => ({ ...p, stopOrdinal: (index + 1) as 1 | 2 })), pending: true,
  });
  return [...rows.values()].sort((a, b) => b.completedAtMinute - a.completedAtMinute);
}
