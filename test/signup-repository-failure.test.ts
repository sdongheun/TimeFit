import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountRegistrationRepository } from '../src/services/accountRegistrationRepository';

const docs = [{ documentId: 'terms-of-service' as const, documentVersion: '1.0', url: 'https://fixture.invalid/terms' }, { documentId: 'privacy-policy' as const, documentVersion: '1.0', url: 'https://fixture.invalid/privacy' }];
const input = { requestId: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.invalid', password: 'fixture-secret', captchaToken: 'fixture-captcha', requiredConsents: { terms: { documentId: 'terms-of-service' as const, documentVersion: '1.0', accepted: true as const }, privacy: { documentId: 'privacy-policy' as const, documentVersion: '1.0', accepted: true as const } } };
function fixture(stage?: 'registry' | 'auth', error?: unknown) {
  const calls: any[] = [];
  const repository = createAccountRegistrationRepository({ async readDocuments() { if (stage === 'registry') throw error; return docs; }, async signUp(value) { calls.push(value); if (stage === 'auth') throw error; return { sessionReady: false }; } });
  return { repository, calls };
}
test('signup token passes only through dependency field; metadata and result retain no token', async () => {
  const f = fixture(); const result = await f.repository.signUpAccount(input);
  assert.equal(f.calls[0].captchaToken, input.captchaToken);
  assert.deepEqual(f.calls[0].metadata, { signup_request_id: input.requestId, required_consents: { terms: { document_id: 'terms-of-service', document_version: '1.0', accepted: true }, privacy: { document_id: 'privacy-policy', document_version: '1.0', accepted: true } } });
  assert.doesNotMatch(JSON.stringify([result, f.calls[0].metadata]), /fixture-captcha|fixture-secret|fixture@example/);
});
test('missing or blank token never calls Auth', async () => {
  for (const captchaToken of [undefined, '', '   ', ' token ']) { const f = fixture(); const r = await f.repository.signUpAccount({ ...input, captchaToken }); assert.equal(f.calls.length, 0); assert.deepEqual(r, { status: 'rejected', reason: 'captcha_required', failure: { code: 'captcha_required', httpStatus: null, stage: 'auth' } }); }
});
test('token never bypasses request identity, explicit consent or exact document version', async () => {
  for (const patch of [{ requestId: 'bad' }, { requiredConsents: { ...input.requiredConsents, terms: { ...input.requiredConsents.terms, accepted: false } } }, { requiredConsents: { ...input.requiredConsents, terms: { ...input.requiredConsents.terms, documentVersion: 'old' } } }]) { const f = fixture(); assert.equal((await f.repository.signUpAccount({ ...input, ...patch } as any)).status, 'rejected'); assert.equal(f.calls.length, 0); }
});
for (const stage of ['registry', 'auth'] as const) for (const [code, status] of [['captcha_failed', 400], ['weak_password', 422], ['over_email_send_rate_limit', 429], ['unexpected_failure', 500], ['42501', 403]] as const) test(`${stage}: preserves safe ${code}/${status}, never raw data`, async () => {
  const f = fixture(stage, { code, status, message: input.email, body: input.password, cause: input.captchaToken, stage: 'spoofed' });
  const r = await f.repository.signUpAccount(input);
  assert.ok('failure' in r); assert.deepEqual(r.failure, { code, httpStatus: status, stage });
  assert.doesNotMatch(JSON.stringify(r), /fixture@|fixture-secret|fixture-captcha|spoofed/);
  assert.equal(f.calls.length, stage === 'registry' ? 0 : 1);
});
test('unknown code and invalid HTTP status are removed; no retry and no invented trigger cause', async () => {
  const f = fixture('auth', { code: input.email, status: 999, message: 'database trigger captcha failed' });
  const r = await f.repository.signUpAccount(input); assert.ok('failure' in r);
  assert.deepEqual(r.failure, { code: 'unrecognized', httpStatus: null, stage: 'auth' }); assert.equal(f.calls.length, 1);
});
test('registry read failure also returns safe structured observation', async () => {
  const f = fixture('registry', { code: '42501', status: 403, message: input.password });
  assert.deepEqual(await f.repository.readSignupConsentDocuments(), { status: 'unavailable', documents: [], failure: { code: '42501', httpStatus: 403, stage: 'registry' } });
});
