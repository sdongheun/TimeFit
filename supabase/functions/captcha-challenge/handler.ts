export type CaptchaChallengeDependencies = { env(name: string): string };

const response = (body: string, status: number, headers: HeadersInit = {}) => new Response(body, { status, headers });

const page = (siteKey: string) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>보안 확인</title><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script></head><body><main><div id="turnstile"></div><button id="cancel" type="button">취소</button></main><script>const send=(event)=>window.ReactNativeWebView?.postMessage(JSON.stringify(event));window.onload=()=>turnstile.render('#turnstile',{sitekey:${JSON.stringify(siteKey)},callback:(token)=>send({type: 'token',token}),'error-callback':()=>send({type: 'error'}),'expired-callback':()=>send({type: 'error'})});document.getElementById('cancel').onclick=()=>send({type: 'cancelled'});</script></body></html>`;

/** Server-owned WebView page. Supabase Auth verifies the resulting token after CAPTCHA is enabled. */
export function createCaptchaChallengeHandler(deps: CaptchaChallengeDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return response(JSON.stringify({ status: 'rejected' }), 405, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    const siteKey = deps.env('TURNSTILE_SITE_KEY');
    if (!siteKey) return response(JSON.stringify({ status: 'route_proxy_unavailable' }), 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return response(page(siteKey), 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline' https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com about:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    });
  };
}
