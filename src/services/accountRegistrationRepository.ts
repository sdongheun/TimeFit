export type RequiredConsentDocumentId = 'terms-of-service' | 'privacy-policy';
export type RequiredConsentInputV1 = Readonly<{ documentId: RequiredConsentDocumentId; documentVersion: string; accepted: true }>;
export type SignupConsentDocumentV1 = Readonly<{ documentId: RequiredConsentDocumentId; documentVersion: string; url: string }>;
export type SignUpAccountInputV1 = Readonly<{
  requestId: string;
  email: string;
  password: string;
  /** Transient attempt input. Missing input is rejected; never part of consent metadata. */
  captchaToken?: string;
  requiredConsents: Readonly<{ terms: RequiredConsentInputV1; privacy: RequiredConsentInputV1 }>;
}>;
export type SignUpAccountResultV1 =
  | { status: 'account_session_ready' }
  | { status: 'email_confirmation_pending' }
  | { status: 'rejected'; reason: 'invalid_input' | 'consent_required' | 'document_version_stale' | 'signup_unavailable' | 'captcha_required'; failure?: SignupFailureInfoV1 }
  | { status: 'retryable_failure'; failure: SignupFailureInfoV1 };
export type SignupFailureStageV1 = 'registry' | 'auth';
const SAFE_SIGNUP_CODES = ['captcha_required', 'captcha_failed', 'weak_password', 'over_email_send_rate_limit',
  'over_request_rate_limit', 'email_address_invalid', 'email_address_not_authorized', 'validation_failed',
  'user_already_exists', 'email_exists', 'signup_disabled', 'email_provider_disabled', 'unexpected_failure',
  'request_timeout', '23505', '23503', '23514', '42501', 'P0001', 'PGRST301', 'unrecognized'] as const;
export type SignupFailureCodeV1 = typeof SAFE_SIGNUP_CODES[number];
export type SignupFailureInfoV1 = Readonly<{ code: SignupFailureCodeV1; httpStatus: number | null; stage: SignupFailureStageV1 }>;
/** Only allowlisted codes and HTTP failures cross this boundary. No raw message/body/cause. */
export function sanitizeSignupFailure(error: unknown, stage: SignupFailureStageV1): SignupFailureInfoV1 {
  const value = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; httpStatus?: unknown } : {};
  const code = typeof value.code === 'string' && (SAFE_SIGNUP_CODES as readonly string[]).includes(value.code)
    ? value.code as SignupFailureCodeV1 : 'unrecognized';
  const status = value.httpStatus ?? value.status;
  return Object.freeze({ code, httpStatus: typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? status : null, stage });
}
export type ReadSignupConsentDocumentsResultV1 =
  | { status: 'ok'; documents: readonly SignupConsentDocumentV1[] }
  | { status: 'not_configured'; documents: readonly [] }
  | { status: 'unavailable'; documents: readonly []; failure: SignupFailureInfoV1 };

export type AccountRegistrationDependencies = Readonly<{
  readDocuments(): Promise<readonly SignupConsentDocumentV1[]>;
  signUp(input: Readonly<{ email: string; password: string; captchaToken: string; metadata: Record<string, unknown> }>): Promise<{ sessionReady: boolean }>;
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
      } catch (error) { return { status: 'unavailable', documents: [], failure: sanitizeSignupFailure(error, 'registry') }; }
    },
    async signUpAccount(input: SignUpAccountInputV1): Promise<SignUpAccountResultV1> {
      if (!input || !UUID.test(input.requestId) || !nonempty(input.email?.trim(), 320) || !nonempty(input.password, 1024)) return { status: 'rejected', reason: 'invalid_input' };
      const terms = input.requiredConsents?.terms;
      const privacy = input.requiredConsents?.privacy;
      if (terms?.accepted !== true || privacy?.accepted !== true || terms.documentId !== 'terms-of-service' || privacy.documentId !== 'privacy-policy') return { status: 'rejected', reason: 'consent_required' };
      let documents: readonly SignupConsentDocumentV1[];
      try { documents = await deps.readDocuments(); } catch (error) { return { status: 'retryable_failure', failure: sanitizeSignupFailure(error, 'registry') }; }
      if (!validDocuments(documents)) return { status: 'rejected', reason: 'signup_unavailable' };
      const registry = new Map(documents.map((item) => [item.documentId, item]));
      if (registry.get(terms.documentId)?.documentVersion !== terms.documentVersion || registry.get(privacy.documentId)?.documentVersion !== privacy.documentVersion) return { status: 'rejected', reason: 'document_version_stale' };
      const captchaToken = input.captchaToken;
      if (typeof captchaToken !== 'string' || !captchaToken.length || captchaToken.trim() !== captchaToken) return { status: 'rejected', reason: 'captcha_required', failure: { code: 'captcha_required', httpStatus: null, stage: 'auth' } };
      try {
        const result = await deps.signUp({
          email: input.email.trim(), password: input.password, captchaToken,
          metadata: {
            signup_request_id: input.requestId,
            required_consents: {
              terms: { document_id: terms.documentId, document_version: terms.documentVersion, accepted: true },
              privacy: { document_id: privacy.documentId, document_version: privacy.documentVersion, accepted: true },
            },
          },
        });
        return { status: result.sessionReady ? 'account_session_ready' : 'email_confirmation_pending' };
      } catch (error) {
        return { status: 'rejected', reason: 'signup_unavailable', failure: sanitizeSignupFailure(error, 'auth') };
      }
    },
  };
}
