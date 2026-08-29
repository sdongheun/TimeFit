import assert from 'node:assert/strict';
import test from 'node:test';
import { createCaptchaChallengeHandler } from '../supabase/functions/captcha-challenge/handler';

const csp = (value: string) => new Map(value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
  const [directive, ...sources] = part.split(/\s+/);
  return [directive, sources];
}));

test('API4ACT04A-03: challenge page는 GET/no-store/CSP와 token/error/cancelled typed message만 제공한다', async () => {
  const handler = createCaptchaChallengeHandler({ env: (name) => name === 'TURNSTILE_SITE_KEY' ? 'public-site-key' : '' });
  const response = await handler(new Request('https://fixture.invalid/captcha-challenge'));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Content-Security-Policy') ?? '', /default-src 'none'/);
  assert.match(html, /TURNSTILE_SITE_KEY|public-site-key/);
  for (const event of ['token', 'error', 'cancelled']) assert.match(html, new RegExp(`type: '${event}'`));
  assert.doesNotMatch(html, /siteverify|secret|jwt|user_id|origin|destination|latitude|longitude|provider key/i);
});

test('API4ACT04A-04: challenge는 GET 외 요청과 site key 누락을 fail-closed한다', async () => {
  const configured = createCaptchaChallengeHandler({ env: () => 'public-site-key' });
  const missing = createCaptchaChallengeHandler({ env: () => '' });
  assert.equal((await configured(new Request('https://fixture.invalid/captcha-challenge', { method: 'POST' }))).status, 405);
  assert.equal((await missing(new Request('https://fixture.invalid/captcha-challenge'))).status, 503);
});

test('API4ACT04AR-01~03: Turnstile CSP는 Cloudflare connect와 제한된 about frame만 허용하며 다른 source를 열지 않는다', async () => {
  const handler = createCaptchaChallengeHandler({ env: () => 'public-site-key' });
  const response = await handler(new Request('https://fixture.invalid/captcha-challenge'));
  const directives = csp(response.headers.get('Content-Security-Policy') ?? '');
  assert.deepEqual(Object.fromEntries(directives), {
    'default-src': ["'none'"],
    'script-src': ["'unsafe-inline'", 'https://challenges.cloudflare.com'],
    'connect-src': ['https://challenges.cloudflare.com'],
    'frame-src': ['https://challenges.cloudflare.com', 'about:'],
    'style-src': ["'unsafe-inline'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
  });
  const full = response.headers.get('Content-Security-Policy') ?? '';
  assert.doesNotMatch(full, /\*|\bhttp:|\bhttps:(?!\/\/challenges\.cloudflare\.com)|data:|blob:|kakao|tmap|odsay|supabase|analytics/i);
});

test('API4ACT04AR-04: POST/PUT과 site key 누락 GET은 HTML 없이 no-store로 끝난다', async () => {
  const configured = createCaptchaChallengeHandler({ env: () => 'public-site-key' });
  const missing = createCaptchaChallengeHandler({ env: () => '' });
  for (const request of [new Request('https://fixture.invalid/captcha-challenge', { method: 'POST' }), new Request('https://fixture.invalid/captcha-challenge', { method: 'PUT' }), new Request('https://fixture.invalid/captcha-challenge')]) {
    const response = request.method === 'GET' ? await missing(request) : await configured(request);
    assert.ok([405, 503].includes(response.status));
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.doesNotMatch(await response.text(), /<html/i);
  }
});
