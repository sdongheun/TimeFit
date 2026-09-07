export type RequiredConsentDocumentId = 'terms-of-service' | 'privacy-policy';
export type RequiredConsentInputV1 = Readonly<{ documentId: RequiredConsentDocumentId; documentVersion: string; accepted: true }>;
export type SignupConsentDocumentV1 = Readonly<{ documentId: RequiredConsentDocumentId; documentVersion: string; url: string }>;
export type SignUpAccountInputV1 = Readonly<{
  requestId: string;
  email: string;
  password: string;
  requiredConsents: Readonly<{ terms: RequiredConsentInputV1; privacy: RequiredConsentInputV1 }>;
}>;
export type SignUpAccountResultV1 =
  | { status: 'account_session_ready' }
  | { status: 'email_confirmation_pending' }
  | { status: 'rejected'; reason: 'invalid_input' | 'consent_required' | 'document_version_stale' | 'signup_unavailable' }
  | { status: 'retryable_failure' };
export type ReadSignupConsentDocumentsResultV1 =
  | { status: 'ok'; documents: readonly SignupConsentDocumentV1[] }
  | { status: 'not_configured' | 'unavailable'; documents: readonly [] };

export type AccountRegistrationDependencies = Readonly<{
  readDocuments(): Promise<readonly SignupConsentDocumentV1[]>;
  signUp(input: Readonly<{ email: string; password: string; metadata: Record<string, unknown> }>): Promise<{ sessionReady: boolean }>;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonempty = (value: unknown, max: number) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
const validDocuments = (documents: readonly SignupConsentDocumentV1[]) => {
  if (documents.length !== 2 || documents.some((item) => !nonempty(item.url, 2048) || !nonempty(item.documentVersion, 120))) return false;
  const ids = new Set(documents.map((item) => item.documentId));
  return ids.size === 2 && ids.has('terms-of-service') && ids.has('privacy-policy');
};

export function createAccountRegistrationRepository(deps: AccountRegistrationDependencies) {
  return {
    async readSignupConsentDocuments(): Promise<ReadSignupConsentDocumentsResultV1> {
      try {
        const documents = await deps.readDocuments();
        return validDocuments(documents) ? { status: 'ok', documents } : { status: 'not_configured', documents: [] };
      } catch { return { status: 'unavailable', documents: [] }; }
    },
    async signUpAccount(input: SignUpAccountInputV1): Promise<SignUpAccountResultV1> {
      if (!input || !UUID.test(input.requestId) || !nonempty(input.email?.trim(), 320) || !nonempty(input.password, 1024)) return { status: 'rejected', reason: 'invalid_input' };
      const terms = input.requiredConsents?.terms;
      const privacy = input.requiredConsents?.privacy;
      if (terms?.accepted !== true || privacy?.accepted !== true || terms.documentId !== 'terms-of-service' || privacy.documentId !== 'privacy-policy') return { status: 'rejected', reason: 'consent_required' };
      let documents: readonly SignupConsentDocumentV1[];
      try { documents = await deps.readDocuments(); } catch { return { status: 'retryable_failure' }; }
      if (!validDocuments(documents)) return { status: 'rejected', reason: 'signup_unavailable' };
      const registry = new Map(documents.map((item) => [item.documentId, item]));
      if (registry.get(terms.documentId)?.documentVersion !== terms.documentVersion || registry.get(privacy.documentId)?.documentVersion !== privacy.documentVersion) return { status: 'rejected', reason: 'document_version_stale' };
      try {
        const result = await deps.signUp({
          email: input.email.trim(), password: input.password,
          metadata: {
            signup_request_id: input.requestId,
            required_consents: {
              terms: { document_id: terms.documentId, document_version: terms.documentVersion, accepted: true },
              privacy: { document_id: privacy.documentId, document_version: privacy.documentVersion, accepted: true },
            },
          },
        });
        return { status: result.sessionReady ? 'account_session_ready' : 'email_confirmation_pending' };
      } catch {
        return { status: 'rejected', reason: 'signup_unavailable' };
      }
    },
  };
}
