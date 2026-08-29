// @ts-nocheck
// Server-only Supabase Edge Function. Secrets are read exclusively from Deno.env.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createRouteProxyHandler } from './handler.ts';

const env = (name: string) => Deno.env.get(name) ?? '';
// Instance-local burst protection only. DB atomic provider+mode budgets are the global cost boundary.
const requestRate = new Map<string, { startedAt: number; count: number }>();
async function consumeEphemeralRate(token: string) {
  const limit = Number(env('ROUTE_PROXY_REQUESTS_PER_MINUTE'));
  if (!Number.isInteger(limit) || limit < 1) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const key = Array.from(new Uint8Array(digest)).slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('');
  const now = Date.now(); const value = requestRate.get(key);
  for (const [oldKey, oldValue] of requestRate) if (now - oldValue.startedAt >= 60_000) requestRate.delete(oldKey);
  const next = !value || now - value.startedAt >= 60_000 ? { startedAt: now, count: 1 } : { ...value, count: value.count + 1 };
  requestRate.set(key, next);
  return next.count <= limit;
}

const db = () => {
  const url = env('SUPABASE_URL'); const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  return url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
};
const handler = createRouteProxyHandler({
  env,
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  consumeRate: consumeEphemeralRate,
  storeAvailable: () => Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY')),
  async authenticate(token) {
    const client = db(); if (!client) return { user: null, error: new Error('store_unavailable') };
    const { data, error } = await client.auth.getUser(token); return { user: data.user, error };
  },
  async rpc(name, args) {
    const client = db(); return client ? client.rpc(name, args) : { error: new Error('store_unavailable') };
  },
});

Deno.serve(handler);
