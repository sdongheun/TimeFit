import { personalizationSession } from '../personalizationComposition';

/** Read-only ownership check: never create/repair an owner for an automatic action. */
type ReadOwnership = typeof import('../../services/releaseIdentitySupabase').readOwnedCourseRunOwnership;
export async function authorizePendingCompletion(courseRunId: string, read: ReadOwnership = async input => (await import('../../services/releaseIdentitySupabase')).readOwnedCourseRunOwnership(input)) {
  const version = personalizationSession.version();
  const subject = personalizationSession.subject();
  const result = await read({ courseRunId, viewer: subject ? { kind: 'account', subject } : { kind: 'guest' } });
  return version === personalizationSession.version() && result.status === 'found'
    && (result.ownerMatch || (!subject && result.ownerKind === 'unverified'));
}

export async function invalidatePendingCompletion() {
  const { nativePendingNavigationPort } = await import('./nativeLiveActivityPort');
  await nativePendingNavigationPort.revokeCompletion();
}
