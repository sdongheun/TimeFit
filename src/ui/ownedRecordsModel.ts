import type { CourseCompletionRecordV1 } from '../services/courseCompletionRepository';
import type { AccountCourseCompletionV1 } from '../services/accountCourseCompletionRepository';
import { summarizeActivityVisits } from './activity/activitySummary';

/** Input must already be owner-verified and merged by completionId. No guest-store reads. */
export function summarizeOwnedRecords(records:readonly AccountCourseCompletionV1[]) {
  return summarizeActivityVisits(records.flatMap(record=>record.places.map(place=>{
    const actual=(place as {actualDwellMin?:number|null}).actualDwellMin;
    return {category:place.category,actualDwellMin:record.provenance!=='guest_import'&&typeof actual==='number'&&Number.isFinite(actual)&&actual>=0?actual:null};
  })));
}

export function mergeOwnedRecords(local: readonly CourseCompletionRecordV1[], remote: readonly AccountCourseCompletionV1[]) {
  const rows = new Map(remote.map(record => [record.completionId, { ...record, pending: false }]));
  for (const record of local) if (!rows.has(record.completionId)) rows.set(record.completionId, {
    completionId: record.completionId, courseRunId: record.courseRunId, completedAtMinute: Math.floor(record.completedAt / 60000), provenance: 'account_completed', learningEligible: false,
    places: record.places.map((p, index) => ({ ...p, stopOrdinal: (index + 1) as 1 | 2 })), pending: true,
  });
  return [...rows.values()].sort((a, b) => b.completedAtMinute - a.completedAtMinute);
}
