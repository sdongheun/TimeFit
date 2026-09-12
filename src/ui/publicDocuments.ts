import type { ReadSignupConsentDocumentsResultV1, SignupConsentDocumentV1 } from '../services/accountRegistrationRepository';

export const readPublicDocuments = async () => (await import('../services/releaseIdentitySupabase')).readSignupConsentDocuments();
export const SUPPORT_URL = 'https://jjaturi-docs.pages.dev/support/';
export function validPublicDocuments(result: ReadSignupConsentDocumentsResultV1): readonly SignupConsentDocumentV1[] {
  if (result.status !== 'ok' || result.documents.length !== 2) return [];
  const ids = new Set(result.documents.map(d => d.documentId));
  if (!ids.has('privacy-policy') || !ids.has('terms-of-service')) return [];
  return result.documents.every(d => {
    try { const url = new URL(d.url); return Boolean(d.documentVersion) && url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
  }) ? result.documents : [];
}
export const samePublicDocuments = (left: readonly SignupConsentDocumentV1[], right: readonly SignupConsentDocumentV1[]) =>
  left.length === 2 && right.length === 2 && left.every(d => right.some(r => r.documentId === d.documentId && r.documentVersion === d.documentVersion && r.url === d.url));
