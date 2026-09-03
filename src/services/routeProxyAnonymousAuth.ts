export type RouteProxySession = {
  accessToken: string;
  /** Unix seconds when Supabase exposes it; consumers may fail closed before an Edge request. */
  expiresAt?: number;
};
export type RouteProxyAnonymousAuthPort = {
  getSession(): Promise<RouteProxySession | null>;
  /** Maps to supabase.auth.signInAnonymously({ options: { captchaToken } }). */
  signInAnonymously(captchaToken: string): Promise<RouteProxySession | null>;
};
export type CaptchaTokenProvider = { requestToken(): Promise<string | null> };
export type RouteProxyAuthResult = { status: 'ready'; accessToken: string } | { status: 'route_proxy_unavailable' };

/**
 * This is intentionally opt-in: deploy configuration must prove CAPTCHA and signup limits before
 * anonymous Auth is enabled. A failure never falls back to a direct route provider call.
 */
export async function ensureRouteProxyAnonymousSession(input: { auth: RouteProxyAnonymousAuthPort; captcha: CaptchaTokenProvider; anonymousAuthEnabled: boolean }): Promise<RouteProxyAuthResult> {
  const existing = await input.auth.getSession().catch(() => null);
  if (existing?.accessToken) return { status: 'ready', accessToken: existing.accessToken };
  if (!input.anonymousAuthEnabled) return { status: 'route_proxy_unavailable' };
  const captchaToken = await input.captcha.requestToken().catch(() => null);
  if (!captchaToken?.trim()) return { status: 'route_proxy_unavailable' };
  const created = await input.auth.signInAnonymously(captchaToken).catch(() => null);
  return created?.accessToken ? { status: 'ready', accessToken: created.accessToken } : { status: 'route_proxy_unavailable' };
}
