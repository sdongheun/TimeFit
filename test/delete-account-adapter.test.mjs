import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import 'tsx/cjs';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { screenRuntime } from './ui/support/screenRuntime.mjs';

const requestId = '11111111-1111-4111-8111-111111111111';
const secret = 'SYNTHETIC_PRIVATE_ERROR_NEVER_EXPOSE';
const failure = { status: 'retryable_failure', stage: 'database' };
function harness(result) {
  let calls = 0;
  const supabase = {
    auth: {
      async getSession() { return { data: { session: { access_token: 'fixture-token', expires_at: 4102444800, user: { id: 'fixture-owner', is_anonymous: false } } }, error: null }; },
      async getUser() { return { data: { user: { id: 'fixture-owner', is_anonymous: false } }, error: null }; },
      onAuthStateChange() {},
    },
    functions: { async invoke(name, input) {
      calls++;
      assert.equal(name, 'delete-account');
      assert.deepEqual(input, { body: { requestId }, headers: { Authorization: 'Bearer fixture-token' } });
      if (result instanceof Error) throw result;
      return result;
    } },
  };
  const runtime = screenRuntime({
    './supabase': { supabase },
    '@react-native-async-storage/async-storage': { getItem: async () => null },
    'expo-modules-core': { uuid: { v4: () => requestId } },
    './courseCompletionAsyncStorage': { courseCompletionRepository: {} },
  });
  return { repository: runtime.load('src/services/releaseIdentitySupabase.ts').supabaseAccountDeletionRepository, calls: () => calls };
}
const http = (status, body) => ({ data: null, error: new FunctionsHttpError(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) });
const cases = [
  ['success', { data: { status: 'deleted', requestId, localCleanupRequired: true, debug: secret }, error: null }, { status: 'deleted', requestId, localCleanupRequired: true }],
  ['reauth', http(403, { status: 'reauth_required', method: 'password_sign_in', debug: secret }), { status: 'reauth_required', method: 'password_sign_in' }],
  ['account', http(401, { status: 'rejected', reason: 'account_required' }), { status: 'rejected', reason: 'account_required' }],
  ['conflict', http(409, failure), failure],
  ...['storage', 'auth', 'verification', 'database'].map(stage => [stage, http(503, { status: 'retryable_failure', stage, debug: secret }), { status: 'retryable_failure', stage }]),
  ['invalid request', http(400, { status: 'rejected', reason: 'invalid_request' }), { status: 'rejected', reason: 'invalid_request' }],
  ['malformed', http(503, secret), failure],
  ['empty error body', http(503, ''), failure],
  ['oversized body', http(503, { status: 'reauth_required', method: 'password_sign_in', debug: secret.repeat(300) }), failure],
  ['non HTTP error context', { data: null, error: { context: new Response(JSON.stringify({ status: 'reauth_required', method: 'password_sign_in' }), { status: 403 }) } }, failure],
  ['unreadable HTTP context', { data: null, error: new FunctionsHttpError({ status: 503, clone() { throw new Error(secret); } }) }, failure],
  ['empty', { data: null, error: null }, failure],
  ['network', new Error(secret), failure],
  ['wrong success ID', { data: { status: 'deleted', requestId: 'other', localCleanupRequired: true }, error: null }, failure],
  ['missing cleanup flag', { data: { status: 'deleted', requestId }, error: null }, failure],
  ['untrusted stage', http(503, { status: 'retryable_failure', stage: secret }), failure],
  ['error cannot become success', http(503, { status: 'deleted', requestId, localCleanupRequired: true }), failure],
  ['HTTP/body mismatch', http(401, { status: 'reauth_required', method: 'password_sign_in' }), failure],
];
for (const [name, result, expected] of cases) test(`delete adapter → repository: ${name}`, async () => {
  const logs = []; const methods = ['error', 'warn', 'log', 'info', 'debug'];
  const original = methods.map(method => console[method]);
  methods.forEach(method => { console[method] = (...args) => logs.push(args); });
  try {
    const h = harness(result);
    const actual = await h.repository.deleteAccount({ requestId });
    assert.deepEqual(actual, expected);
    assert.equal(h.calls(), 1, 'never automatically retry deletion');
    assert.equal(JSON.stringify([actual, logs]).includes(secret), false);
    assert.deepEqual(logs, []);
  } finally { methods.forEach((method, i) => { console[method] = original[i]; }); }
});

test('delete Edge SDK has a function-local exact dependency and frozen lock', () => {
  const config = JSON.parse(fs.readFileSync('supabase/functions/delete-account/deno.json', 'utf8'));
  assert.equal(config.imports['@supabase/supabase-js'], 'npm:@supabase/supabase-js@2.109.0');
  assert.equal(config.lock.frozen, true);
  assert.ok(fs.existsSync('supabase/functions/delete-account/deno.lock'));
});
