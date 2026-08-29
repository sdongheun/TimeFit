export type CaptchaWorkerEnv = { TURNSTILE_SITE_KEY?: string };

const reply = (body: string, status: number, headers: HeadersInit = {}) => new Response(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const challengePage = (siteKey: string) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>보안 확인</title>
  <script>
    const send = (event) => window.ReactNativeWebView?.postMessage(JSON.stringify(event));
    window.__timefitTurnstileSuccess = (token) => {
      const status = document.getElementById('status');
      if (status) status.textContent = '인증이 완료되었습니다.';
      if (typeof token === 'string' && token.trim()) send({ type: 'token', token });
    };
    window.__timefitTurnstileError = (code) => {
      const status = document.getElementById('status');
      if (status) status.textContent = '인증 오류가 발생했습니다.';
      send({ type: 'error', code });
      return true;
    };
    window.__timefitTurnstileExpired = () => {
      const status = document.getElementById('status');
      if (status) status.textContent = '인증이 만료되었습니다.';
    };
  </script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:100vh; margin:0; font-family:sans-serif; background-color:#f9fafb;">
  <main style="text-align:center;">
    <p id="status" role="status" style="margin-bottom:16px;">보안 확인을 진행 중입니다...</p>
    <div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="__timefitTurnstileSuccess" data-error-callback="__timefitTurnstileError" data-expired-callback="__timefitTurnstileExpired"></div>
    <button id="cancel" type="button" style="margin-top:16px; padding:6px 16px; cursor:pointer;">취소</button>
  </main>
  <script>document.getElementById('cancel').onclick = () => send({ type: 'cancelled' });</script>
</body>
</html>`;

/** CAPTCHA page only: it does not verify, persist, or forward tokens, and makes no provider requests. */
export function createCaptchaWorker(env: CaptchaWorkerEnv) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'GET') return reply(JSON.stringify({ status: 'rejected' }), 405, { 'Content-Type': 'application/json' });
      const siteKey = env.TURNSTILE_SITE_KEY;
      if (!siteKey) return reply(JSON.stringify({ status: 'route_proxy_unavailable' }), 503, { 'Content-Type': 'application/json' });
      return reply(challengePage(siteKey), 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com about:; img-src https://challenges.cloudflare.com data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      });
    },
  };
}

export default {
  fetch(request: Request, env: CaptchaWorkerEnv): Promise<Response> {
    return createCaptchaWorker(env).fetch(request);
  },
};
