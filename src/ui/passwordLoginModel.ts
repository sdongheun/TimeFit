const CODES = new Set(['captcha_failed','invalid_credentials','validation_failed','email_address_invalid','email_not_confirmed','user_banned','over_request_rate_limit','over_email_send_rate_limit','unexpected_failure','request_timeout','captcha_required']);
export type PasswordLoginFailureKind = 'captcha'|'input'|'email_confirmation'|'network'|'server'|'rate_limit'|'account'|'unknown';
export class PasswordLoginFailure extends Error {
  readonly operation = 'signInWithPassword';
  readonly attemptAtUtc = new Date().toISOString();
  constructor(readonly code: string, readonly status: number|null, readonly kind: PasswordLoginFailureKind, readonly captchaTokenProvided: boolean, readonly stage: 'captcha'|'auth' = 'auth') { super('password_login_failed'); this.name='PasswordLoginFailure'; }
}
/** 원문 message/cause/계정/body를 복사하지 않는다. 알려진 code와 유효 HTTP 상태만 보존한다. */
export function safePasswordLoginFailure(error: unknown, provided: boolean): PasswordLoginFailure {
  if (error instanceof PasswordLoginFailure) return error;
  const value = error && typeof error === 'object' ? error as {code?:unknown;status?:unknown;name?:unknown} : {};
  const code = typeof value.code === 'string' && CODES.has(value.code) ? value.code : 'unrecognized';
  const status = typeof value.status === 'number' && Number.isInteger(value.status) && (value.status === 0 || (value.status >= 100 && value.status <= 599)) ? value.status : null;
  const kind: PasswordLoginFailureKind = code === 'captcha_failed' || code === 'captcha_required' ? 'captcha'
    : code === 'email_not_confirmed' ? 'email_confirmation'
    : ['invalid_credentials','validation_failed','email_address_invalid'].includes(code) ? 'input'
    : status === 429 || code.startsWith('over_') ? 'rate_limit'
    : status !== null && status >= 500 ? 'server'
    : value.name === 'AuthRetryableFetchError' || value.name === 'TypeError' || code === 'request_timeout' ? 'network'
    : code === 'user_banned' ? 'account' : 'unknown';
  return new PasswordLoginFailure(code,status,kind,provided,code==='captcha_required'?'captcha':'auth');
}
export function passwordLoginFailureMessage(failure: PasswordLoginFailure): string {
  return {captcha:'안전 확인이 만료되었거나 통과하지 못했어요. 로그인 버튼을 눌러 새로 확인해 주세요.',input:'이메일 또는 비밀번호를 확인해 주세요.',email_confirmation:'받은 이메일에서 인증을 완료한 뒤 로그인해 주세요.',network:'네트워크에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.',server:'로그인 서버에 문제가 있어요. 잠시 후 다시 시도해 주세요.',rate_limit:'로그인 요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.',account:'이 계정으로 로그인할 수 없어요. 계정 상태를 확인해 주세요.',unknown:'로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'}[failure.kind];
}
type PasswordSignInPort = (input: {email:string;password:string;options:{captchaToken:string}}) => Promise<{error:unknown}>;
export async function signInWithFreshCaptcha(signIn: PasswordSignInPort, email: string, password: string, captchaToken?: string): Promise<void> {
  if (!captchaToken?.trim()) throw safePasswordLoginFailure({code:'captcha_required'},false);
  try {
    const {error} = await signIn({email:email.trim(),password,options:{captchaToken}});
    if (error) throw safePasswordLoginFailure(error,true);
  } catch(error) { throw safePasswordLoginFailure(error,true); }
}
