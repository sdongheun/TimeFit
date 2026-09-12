const kinds = {
  captcha_failed: 'captcha', captcha_required: 'captcha', weak_password: 'password',
  over_email_send_rate_limit: 'mail_limit', over_request_rate_limit: 'rate_limit',
  invalid_input: 'input', validation_failed: 'input', email_address_invalid: 'input',
  consent_required: 'consent', document_version_stale: 'consent', signup_unavailable: 'unavailable',
  unexpected_failure: 'server', request_timeout: 'network',
  email_address_not_authorized: 'input', user_already_exists: 'existing', email_exists: 'existing',
  signup_disabled: 'unavailable', email_provider_disabled: 'unavailable',
  '23505': 'server', '23503': 'server', '23514': 'server', '42501': 'server', P0001: 'server', PGRST301: 'server',
} as const;
type Kind = typeof kinds[keyof typeof kinds] | 'unknown' | 'retryable';
export class SignupFailure extends Error {
  constructor(readonly code: string, readonly status: number | null, readonly kind: Kind, readonly stage: 'registry' | 'auth' | null = null) {
    super('signup_failed'); this.name = 'SignupFailure';
  }
}
/** Do not copy message/body/cause or infer a DB/CAPTCHA cause from a collapsed failure. */
export function safeSignupFailure(error: unknown): SignupFailure {
  if (error instanceof SignupFailure) return error;
  const outer = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const value = outer.failure && typeof outer.failure === 'object' ? outer.failure as Record<string, unknown> : outer;
  const raw = value.code ?? value.reason;
  const code = typeof raw === 'string' && Object.prototype.hasOwnProperty.call(kinds, raw) ? raw as keyof typeof kinds : 'unrecognized';
  const httpStatus = value.httpStatus ?? value.status;
  const status = typeof httpStatus === 'number' && Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599 ? httpStatus : null;
  const kind: Kind = code !== 'unrecognized' ? kinds[code] : value.status === 'retryable_failure' ? 'retryable'
    : status === 429 ? 'rate_limit' : status !== null && status >= 500 ? 'server'
    : value.name === 'AuthRetryableFetchError' || value.name === 'TypeError' ? 'network' : 'unknown';
  return new SignupFailure(code, status, kind, value.stage === 'registry' || value.stage === 'auth' ? value.stage : null);
}
export function signupFailureMessage(failure: SignupFailure): string {
  return {
    captcha: '안전 확인을 통과하지 못했어요. 새로 확인한 뒤 다시 시도해 주세요.',
    password: '비밀번호가 보안 조건을 충족하지 않아요. 다른 비밀번호로 다시 시도해 주세요.',
    mail_limit: '인증 메일 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.',
    rate_limit: '가입 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.',
    input: '이메일과 비밀번호 입력을 확인해 주세요.',
    existing: '이미 가입된 이메일이에요. 로그인해 주세요.',
    consent: '가입 문서가 변경됐거나 동의가 필요해요. 문서를 다시 확인해 주세요.',
    unavailable: '지금은 가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
    retryable: '가입 정보를 확인하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
    network: '네트워크에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
    server: '가입 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.',
    unknown: '가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  }[failure.kind];
}
