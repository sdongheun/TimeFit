import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { screenRuntime } from './ui/support/screenRuntime.mjs';

const secret = 'SYNTHETIC_PRIVATE_NEVER_RETURN';
const input = { requestId: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid', password: secret, captchaToken: 'fixture-captcha', requiredConsents: { terms: { documentId: 'terms-of-service', documentVersion: '1.0', accepted: true }, privacy: { documentId: 'privacy-policy', documentVersion: '1.0', accepted: true } } };
const rows = ['terms-of-service', 'privacy-policy'].map(document_id => ({ document_id, document_version: '1.0', document_url: 'https://fixture.invalid/document' }));
function harness({ authError, registryError, registryStatus, thrown, session = null } = {}) {
  const calls = [], writes = [];
  const supabase = {
    auth: { onAuthStateChange() {}, async signUp(value) { calls.push(value); if (thrown) throw thrown; return { data: { session }, error: authError }; } },
    async rpc(name) { assert.equal(name, 'get_signup_consent_documents'); return { data: registryError ? null : rows, error: registryError, status: registryStatus }; },
  };
  const runtime = screenRuntime({ './supabase': { supabase }, '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async (...args) => writes.push(args) }, 'expo-modules-core': { uuid: { v4: () => input.requestId } }, './courseCompletionAsyncStorage': { courseCompletionRepository: {} } });
  return { repo: runtime.load('src/services/releaseIdentitySupabase.ts').supabaseAccountRegistrationRepository, calls, writes };
}
test('signup composition sends token only in Auth options, preserving consent metadata and both success states', async () => {
  for (const session of [null, { user: { id: 'fixture' } }]) {
    const h = harness({ session }); const result = await h.repo.signUpAccount(input);
    assert.deepEqual(h.calls, [{ email: input.email, password: input.password, options: { captchaToken: input.captchaToken, data: { signup_request_id: input.requestId, required_consents: { terms: { document_id: 'terms-of-service', document_version: '1.0', accepted: true }, privacy: { document_id: 'privacy-policy', document_version: '1.0', accepted: true } } } } }]);
    assert.deepEqual(result, { status: session ? 'account_session_ready' : 'email_confirmation_pending' });
    assert.deepEqual(h.writes, []);
  }
});
test('composition missing token never reaches Auth', async () => {
  const h = harness(); const result = await h.repo.signUpAccount({ ...input, captchaToken: undefined });
  assert.equal(result.failure.code, 'captcha_required'); assert.equal(h.calls.length, 0);
});
for (const [code, status] of [['captcha_failed', 400], ['weak_password', 422], ['over_email_send_rate_limit', 429], ['unexpected_failure', 500], ['P0001', 500], [secret, 999]]) test(`Auth safe projection ${status}/${code === secret ? 'unknown' : code}`, async () => {
  const h = harness({ authError: { code, status, message: secret, body: input.email, cause: input.captchaToken } });
  const result = await h.repo.signUpAccount(input);
  assert.deepEqual(result, { status: 'rejected', reason: 'signup_unavailable', failure: { code: code === secret ? 'unrecognized' : code, httpStatus: status === 999 ? null : status, stage: 'auth' } });
  assert.equal(h.calls.length, 1); assert.deepEqual(h.writes, []);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE|fixture-captcha|fixture@example/);
});
test('PostgREST response status is retained with registry stage, no Auth request', async () => {
  const h = harness({ registryError: { code: '42501', message: secret, details: secret }, registryStatus: 403 });
  assert.deepEqual(await h.repo.signUpAccount(input), { status: 'retryable_failure', failure: { code: '42501', httpStatus: 403, stage: 'registry' } });
  assert.deepEqual(await h.repo.readSignupConsentDocuments(), { status: 'unavailable', documents: [], failure: { code: '42501', httpStatus: 403, stage: 'registry' } });
  assert.equal(h.calls.length, 0);
});
test('thrown unknown transport error stays unknown without retries or guessed trigger cause', async () => {
  const h = harness({ thrown: new Error(secret) });
  const result = await h.repo.signUpAccount(input);
  assert.deepEqual(result.failure, { code: 'unrecognized', httpStatus: null, stage: 'auth' }); assert.equal(h.calls.length, 1);
});
