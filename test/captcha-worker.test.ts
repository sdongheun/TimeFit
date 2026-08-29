import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { createCaptchaWorker } from '../cloudflare/captcha-worker/src/index';

const csp = (value: string) => new Map(value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
  const [directive, ...sources] = part.split(/\s+/);
  return [directive, sources];
}));

test('API4ACT04B-A01: Worker GET은 Turnstile 최소 CSP/no-store와 typed message만 반환한다', async () => {
  const response = await createCaptchaWorker({ TURNSTILE_SITE_KEY: 'public-site-key' }).fetch(new Request('https://fixture.invalid/'));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(Object.fromEntries(csp(response.headers.get('Content-Security-Policy') ?? '')), {
    'default-src': ["'none'"], 'script-src': ["'unsafe-inline'", 'https://challenges.cloudflare.com'], 'connect-src': ['https://challenges.cloudflare.com'], 'frame-src': ['https://challenges.cloudflare.com', 'about:'], 'img-src': ['https://challenges.cloudflare.com', 'data:'], 'style-src': ["'unsafe-inline'"], 'base-uri': ["'none'"], 'form-action': ["'none'"],
  });
  for (const event of ['token', 'error', 'cancelled']) assert.match(html, new RegExp(`type: '${event}'`));
  assert.doesNotMatch(html, /siteverify|secret|jwt|user_id|origin|destination|latitude|longitude|kakao|tmap|odsay|supabase|analytics/i);
});

test('API4ACT04B-A02: Worker는 key 누락과 GET 외 요청을 no-store fail-closed로 처리한다', async () => {
  const configured = createCaptchaWorker({ TURNSTILE_SITE_KEY: 'public-site-key' });
  const missing = createCaptchaWorker({});
  for (const [handler, request, status] of [[configured, new Request('https://fixture.invalid/', { method: 'POST' }), 405], [configured, new Request('https://fixture.invalid/', { method: 'PUT' }), 405], [missing, new Request('https://fixture.invalid/'), 503]] as const) {
    const response = await handler.fetch(request);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.doesNotMatch(await response.text(), /<html/i);
  }
  assert.equal(typeof worker.fetch, 'function');
});

test('API4ACT04B-W01: 사용자 검증 implicit artifact는 상태·bridge·CSP를 보존한다', async () => {
  const html = await (await createCaptchaWorker({ TURNSTILE_SITE_KEY: 'public-site-key' }).fetch(new Request('https://fixture.invalid/'))).text();
  assert.match(html, /id="status"[^>]*>보안 확인을 진행 중입니다\.\.\./);
  assert.equal((html.match(/class="cf-turnstile"/g) ?? []).length, 1);
  assert.match(html, /data-sitekey="public-site-key"/);
  for (const callback of ['__timefitTurnstileSuccess', '__timefitTurnstileError', '__timefitTurnstileExpired']) assert.match(html, new RegExp(callback));
  const turnstileScript = '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>';
  assert.ok(html.includes(turnstileScript));
  assert.ok(html.indexOf(turnstileScript) < html.indexOf('</head>'));
  assert.ok(html.indexOf(turnstileScript) < html.indexOf('class="cf-turnstile"'));
  for (const status of ['인증이 완료되었습니다.', '인증 오류가 발생했습니다.', '인증이 만료되었습니다.']) assert.match(html, new RegExp(status));
  assert.match(html, /send\(\{ type: 'error', code \}\);\s*return true/);
  assert.match(html, /send\(\{ type: 'cancelled' \}\)/);
  assert.match(html, /display:flex; flex-direction:column; justify-content:center; align-items:center/);
  assert.doesNotMatch(html, /render=explicit|__timefitTurnstileBoot|window\.turnstile|turnstile\.render|onerror=|widget_error_/);
  assert.doesNotMatch(html, /error\.message|error\.stack|location\.|window\.location|console\.|raw.*url/i);
});
