export type CaptchaVerificationState = 'idle' | 'loading' | 'ready' | 'failed' | 'cancelled';
export type CaptchaMessage = { type: 'token'; token: string } | { type: 'error' } | { type: 'cancelled' };
export type CaptchaFailure =
  | 'invalid_config'
  | 'top_navigation_blocked'
  | 'subframe_navigation_blocked'
  | 'webview_network_error'
  | 'webview_http_error'
  | 'widget_error'
  | 'message_source_rejected'
  | 'message_payload_rejected';

/** 공개 Worker root URL만 runtime 설정으로 수용한다. URL을 추측하거나 보정하지 않는다. */
export function resolveCaptchaChallengeUrl(value: string | undefined | null): string | null {
  if (!value || value.trim() !== value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

export function captchaStateFor(event: 'open' | 'token' | 'error' | 'cancelled' | 'retry'): CaptchaVerificationState {
  if (event === 'token') return 'ready';
  if (event === 'error') return 'failed';
  if (event === 'cancelled') return 'cancelled';
  return 'loading';
}

export function parseCaptchaMessage(data: string): CaptchaMessage | null {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object' || !('type' in value)) return null;
    if (value.type === 'token' && 'token' in value && typeof value.token === 'string' && value.token.trim()) return { type: 'token', token: value.token };
    if (value.type === 'error') return { type: 'error' };
    if (value.type === 'cancelled') return { type: 'cancelled' };
  } catch { /* invalid messages fail closed in the UI */ }
  return null;
}

export function isAllowedCaptchaUrl(candidate: string, challengeUrl: string): boolean {
  try {
    const next = new URL(candidate);
    const challenge = new URL(challengeUrl);
    return next.protocol === 'https:' && next.origin === challenge.origin && next.pathname === challenge.pathname && next.search === challenge.search;
  } catch { return false; }
}

export function captchaAllowedOrigins(challengeUrl: string): string[] {
  const challenge = new URL(challengeUrl);
  // react-native-webview matches auxiliary documents by the `about:` origin.
  // This is transport-only; isAllowedCaptchaNavigation remains the final guard.
  return [challenge.origin, 'https://challenges.cloudflare.com', 'about:*'];
}

/** 최상위는 server-owned challenge 하나, 보조 frame은 Turnstile과 about 문서만 허용한다. */
export function isAllowedCaptchaNavigation(candidate: string, challengeUrl: string, isTopFrame: boolean | undefined): boolean {
  if (isTopFrame !== false) return isAllowedCaptchaUrl(candidate, challengeUrl);
  if (isAllowedCaptchaUrl(candidate, challengeUrl)) return true;
  try {
    const next = new URL(candidate);
    return next.origin === 'https://challenges.cloudflare.com' || candidate === 'about:blank' || candidate === 'about:srcdoc';
  } catch { return candidate === 'about:blank' || candidate === 'about:srcdoc'; }
}

/** 허용 범위는 그대로 두고, 차단 이유만 비밀 없는 고정 enum으로 분류한다. */
export function captchaNavigationFailure(candidate: string, challengeUrl: string, isTopFrame: boolean | undefined): CaptchaFailure | null {
  if (isAllowedCaptchaNavigation(candidate, challengeUrl, isTopFrame)) return null;
  return isTopFrame === false ? 'subframe_navigation_blocked' : 'top_navigation_blocked';
}

/** 한 번의 WebView mount에서는 처음 발생한 terminal failure만 유지한다. */
export function firstCaptchaFailure(current: CaptchaFailure | null, next: CaptchaFailure): CaptchaFailure {
  return current ?? next;
}

export function captchaDiagnosticsEnabled(value: string | undefined): boolean {
  return value === 'true';
}

export function isTrustedCaptchaMessageSource(sourceUrl: string | undefined, challengeUrl: string): boolean {
  return Boolean(sourceUrl) && isAllowedCaptchaUrl(sourceUrl as string, challengeUrl);
}

export function shouldPresentCaptcha(authLoading: boolean, hasSession: boolean): boolean {
  return !authLoading && !hasSession;
}
