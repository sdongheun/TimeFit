// @ts-nocheck
// Deno-only integration: real entry, SDK clients, HTTP server and getClaims.
// All Auth/RPC transport is synthetic; runtime net permission is loopback only.
import { createClient } from '@supabase/supabase-js';

Deno.test('delete-account actual entry startup and SDK auth/claim/delete/verify with fixture transport', async () => {
  const check = (condition: boolean, label: string) => { if (!condition) throw new Error(label); };
  const owner = '22222222-2222-4222-8222-222222222222';
  const requestId = '11111111-1111-4111-8111-111111111111';
  const now = 1788912000;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, exp: now + 3600, iat: now, aud: 'authenticated', is_anonymous: false, amr: [{ method: 'password', timestamp: now - 599 }] })}.Zml4dHVyZQ`;
  const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const previous = names.map(name => Deno.env.get(name));
  const values = ['https://delete-fixture.invalid', 'fixture-anon-key', 'fixture-service-key'];
  names.forEach((name, i) => Deno.env.set(name, values[i]));
  const realFetch = globalThis.fetch, realServe = Deno.serve;
  const calls: string[] = [];
  let server;
  let serving = 0;
  try {
    const probe = createClient(values[0], values[1], { auth: { persistSession: false, autoRefreshToken: false } });
    check(typeof probe.auth.getClaims === 'function', 'exact SDK must provide getClaims');
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (url.hostname === '127.0.0.1') return realFetch(input, init);
      check(url.origin === values[0], 'no external transport');
      const route = `${request.method} ${url.pathname}`;
      calls.push(route);
      const reply = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
      if (route === 'GET /auth/v1/user') {
        check(request.headers.get('Authorization') === `Bearer ${token}`, 'normal user JWT');
        check(request.headers.get('apikey') === values[1], 'auth client initialization');
        return reply({ id: owner, aud: 'authenticated', role: 'authenticated', is_anonymous: false, email: 'fixture@example.invalid', created_at: '2026-01-01T00:00:00Z' });
      }
      check(request.headers.get('apikey') === values[2], 'server admin client initialization');
      if (route === 'POST /rest/v1/rpc/claim_account_deletion') {
        const body = await request.json();
        check(body.p_user_id === owner && body.p_request_id === requestId, 'verified owner claim');
        return reply('claimed');
      }
      if (route === `DELETE /auth/v1/admin/users/${owner}`) return reply({ id: owner });
      if (route === 'POST /rest/v1/rpc/count_account_owned_rows') return reply(0);
      throw new Error('unexpected fixture route');
    };
    Deno.serve = handler => {
      serving++;
      server = realServe({ hostname: '127.0.0.1', port: 0, onListen() {} }, handler);
      return server;
    };
    await import('./index.ts');
    check(serving === 1, 'production entry must register exactly once');
    const response = await realFetch(`http://127.0.0.1:${server.addr.port}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId }),
    });
    const result = await response.json();
    check(response.status === 200 && result.status === 'deleted' && result.requestId === requestId && result.localCleanupRequired === true, 'actual entry success');
    check(JSON.stringify(calls) === JSON.stringify([
      'GET /auth/v1/user', 'GET /auth/v1/user',
      'POST /rest/v1/rpc/claim_account_deletion',
      `DELETE /auth/v1/admin/users/${owner}`,
      'POST /rest/v1/rpc/count_account_owned_rows',
    ]), 'real SDK getUser + symmetric getClaims and ordered server operations');
  } finally {
    await server?.shutdown();
    globalThis.fetch = realFetch;
    Deno.serve = realServe;
    Date.now = realNow;
    names.forEach((name, i) => previous[i] === undefined ? Deno.env.delete(name) : Deno.env.set(name, previous[i]));
  }
});
