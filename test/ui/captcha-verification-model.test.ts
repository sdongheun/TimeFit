import assert from 'node:assert/strict';
import test from 'node:test';
import { captchaAllowedOrigins, captchaDiagnosticsEnabled, captchaNavigationFailure, captchaStateFor, firstCaptchaFailure, isAllowedCaptchaNavigation, isAllowedCaptchaUrl, isTrustedCaptchaMessageSource, parseCaptchaMessage, resolveCaptchaChallengeUrl, shouldPresentCaptcha, type CaptchaFailure } from '../../src/ui/captchaVerificationModel';

const challenge = 'https://captcha.example.test/';

test('UCAP-01: token/error/cancelled 세 event만 허용하고 token은 success callback 경계 밖에 보관하지 않는다', () => {
  assert.deepEqual(parseCaptchaMessage('{"type":"token","token":"one-shot"}'), { type: 'token', token: 'one-shot' });
  assert.deepEqual(parseCaptchaMessage('{"type":"error"}'), { type: 'error' });
  assert.deepEqual(parseCaptchaMessage('{"type":"cancelled"}'), { type: 'cancelled' });
  for (const payload of ['', '{}', '{"type":"token","token":" "}', '{"type":"navigate","url":"timefit://auth"}', 'not-json']) assert.equal(parseCaptchaMessage(payload), null);
});

test('UCAP-02: 허용 URL·상태는 fail-closed이며 retry는 새 loading mount로 돌아간다', () => {
  assert.equal(isAllowedCaptchaUrl(challenge, challenge), true);
  assert.equal(isAllowedCaptchaUrl('http://project.supabase.co/functions/v1/captcha-challenge', challenge), false);
  assert.equal(isAllowedCaptchaUrl('https://evil.invalid/functions/v1/captcha-challenge', challenge), false);
  assert.equal(isAllowedCaptchaUrl('timefit://auth/callback', challenge), false);
  assert.deepEqual(['open', 'token', 'error', 'cancelled', 'retry'].map((event) => captchaStateFor(event as 'open' | 'token' | 'error' | 'cancelled' | 'retry')), ['loading', 'ready', 'failed', 'cancelled', 'loading']);
});

test('UCAP-03: 기존 session 또는 아직 확인 중인 Auth에서는 CAPTCHA sheet를 열지 않는다', () => {
  assert.equal(shouldPresentCaptcha(false, true), false);
  assert.equal(shouldPresentCaptcha(true, false), false);
  assert.equal(shouldPresentCaptcha(false, false), true);
});

test('UCAP-R-01: 최상위는 exact challenge만, 보조 frame은 Cloudflare/about만 통과한다', () => {
  assert.equal(isAllowedCaptchaNavigation(challenge, challenge, true), true);
  assert.equal(isAllowedCaptchaNavigation('https://challenges.cloudflare.com/turnstile/frame', challenge, true), false);
  assert.equal(isAllowedCaptchaNavigation('https://challenges.cloudflare.com/turnstile/frame', challenge, false), true);
  assert.equal(isAllowedCaptchaNavigation('about:blank', challenge, false), true);
  assert.equal(isAllowedCaptchaNavigation('about:srcdoc', challenge, false), true);
  assert.equal(isAllowedCaptchaNavigation('https://evil.invalid/frame', challenge, false), false);
  assert.equal(isAllowedCaptchaNavigation('javascript:alert(1)', challenge, false), false);
  assert.equal(isAllowedCaptchaNavigation('data:text/html,hello', challenge, false), false);
  // isTopFrame 정보가 없으면 보조 URL을 넓게 허용하지 않는다.
  assert.equal(isAllowedCaptchaNavigation('https://challenges.cloudflare.com/turnstile/frame', challenge, undefined), false);
  assert.deepEqual(captchaAllowedOrigins(challenge), ['https://captcha.example.test', 'https://challenges.cloudflare.com', 'about:*']);
  assert.equal(captchaAllowedOrigins(challenge).some((origin) => origin === 'about:*'), true);
  // transport whitelist may pass any about document, but the final guard cannot.
  assert.equal(isAllowedCaptchaNavigation('about:evil', challenge, false), false);
});

test('UCAP-05: public Worker HTTPS root 설정만 소비하며 누락·비정상 설정은 WebView를 만들 수 없다', () => {
  assert.equal(resolveCaptchaChallengeUrl(challenge), challenge);
  for (const value of [undefined, '', ' ', ' http://captcha.example.test/', 'http://captcha.example.test/', 'https://captcha.example.test/path', 'https://captcha.example.test/?retry=1', 'https://captcha.example.test/#widget', 'not a url']) assert.equal(resolveCaptchaChallengeUrl(value), null);
});

test('UCAP-R-02: token/error/cancelled message는 보조 frame이 아닌 exact top-level challenge에서만 받는다', () => {
  assert.equal(isTrustedCaptchaMessageSource(challenge, challenge), true);
  assert.equal(isTrustedCaptchaMessageSource('https://challenges.cloudflare.com/turnstile/frame', challenge), false);
  assert.equal(isTrustedCaptchaMessageSource('about:srcdoc', challenge), false);
  assert.equal(isTrustedCaptchaMessageSource(undefined, challenge), false);
});

test('UCAP-06: WebView terminal failure는 비밀 없는 고정 enum으로만 분류한다', () => {
  const failures: CaptchaFailure[] = ['invalid_config', 'top_navigation_blocked', 'subframe_navigation_blocked', 'webview_network_error', 'webview_http_error', 'widget_error', 'message_source_rejected', 'message_payload_rejected'];
  assert.equal(new Set(failures).size, 8);
  assert.equal(captchaNavigationFailure('https://evil.invalid/', challenge, true), 'top_navigation_blocked');
  assert.equal(captchaNavigationFailure('https://evil.invalid/', challenge, false), 'subframe_navigation_blocked');
  assert.equal(captchaNavigationFailure('https://challenges.cloudflare.com/turnstile/frame', challenge, false), null);
  assert.equal(captchaNavigationFailure('https://challenges.cloudflare.com/turnstile/frame', challenge, undefined), 'top_navigation_blocked');
});

test('UCAP-07: 같은 시도에서는 첫 실패만 보존하고 retry·정상 token/cancelled는 진단을 만들지 않는다', () => {
  const first = firstCaptchaFailure(null, 'webview_network_error');
  assert.equal(firstCaptchaFailure(first, 'widget_error'), 'webview_network_error');
  assert.equal(firstCaptchaFailure(null, 'webview_http_error'), 'webview_http_error'); // retry reset
  assert.equal(captchaStateFor('token'), 'ready');
  assert.equal(captchaStateFor('cancelled'), 'cancelled');
});

test('UCAP-08: CAPTCHA 진단은 internal test flag의 exact true에서만 표시한다', () => {
  assert.equal(captchaDiagnosticsEnabled('true'), true);
  for (const value of [undefined, '', 'TRUE', '1', ' true']) assert.equal(captchaDiagnosticsEnabled(value), false);
});
