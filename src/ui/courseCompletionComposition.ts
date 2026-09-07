import { ownedCourseLifecycle } from './ownedCourseLifecycle';
/** Required owner-local completion only. Remote sync is started after screen cleanup. */
export const courseCompletionRepository = { complete: ownedCourseLifecycle.complete };
