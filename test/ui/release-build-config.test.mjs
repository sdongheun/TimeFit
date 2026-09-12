import test from 'node:test';
import 'tsx/cjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
test('public release identity is iPhone-only without changing installed identity', () => {
  const { expo } = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  assert.equal(expo.ios.infoPlist.CFBundleDisplayName, '짜투리');
  assert.equal(expo.ios.supportsTablet, false);
  assert.equal(expo.ios.bundleIdentifier, 'com.dongheun.mobile');
  assert.equal(expo.scheme, 'timefit');
  assert.equal(expo.slug, 'mobile');
});

test('public C panels stay inert for a signed-in account with previously enabled internal inputs', () => {
  const { publicEnvironment } = require('../../scripts/release-build.cjs');
  const env = publicEnvironment({ EXPO_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_fixture', EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL: 'https://fixture.example/challenge', EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture', EXPO_PUBLIC_C_VALIDATION_INTERNAL: 'true' });
  const host = screenRuntime({ __DEV__: false, __process: { env }, './AuthContext': { useAuth: () => ({ authKind: 'account', accountSession: { user: { id: 'fixture-owner' } } }) }, '../services/cValidationSupabase': { createAppCValidationRunner() { assert.fail('runner forbidden'); }, inspectAppCValidationExecution() { assert.fail('inspect forbidden'); } }, '../services/supabase': { supabase: { auth: { onAuthStateChange() { assert.fail('subscription forbidden'); } } } } });
  for (const name of ['CValidationPanel', 'CValidationRecoveryPanel']) {
    const screen = host.mount(host.load(`src/ui/${name}.tsx`)[name], {});
    assert.equal(screen.nodes(n => Boolean(n.props.testID)).length, 0);
    screen.unmount();
  }
});
test('public build overrides internal input without mutating it and refuses secret client credentials', () => {
  const { publicEnvironment } = require('../../scripts/release-build.cjs');
  const input = { EXPO_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_fixture', EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL: 'https://fixture.example/challenge', EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture', EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS: 'true', EXPO_PUBLIC_C_VALIDATION_INTERNAL: 'true', DATABASE_URL: 'fixture-secret' };
  const result = publicEnvironment(input);
  assert.equal(result.EXPO_PUBLIC_RECOMMENDATION_DIAGNOSTICS, 'false');
  assert.equal(result.EXPO_PUBLIC_C_VALIDATION_INTERNAL, 'false');
  assert.equal(result.EXPO_PUBLIC_CAPTCHA_DIAGNOSTICS, 'false');
  assert.equal(result.EXPO_PUBLIC_RECOMMENDATION_INTERNAL_B12, 'false');
  assert.equal(result.EXPO_PUBLIC_ROUTE_PROXY_ENABLED, 'true');
  assert.equal(result.EXPO_NO_DOTENV, '1');
  assert.equal(result.NODE_ENV, 'production');
  assert.equal(result.DATABASE_URL, undefined);
  assert.equal(input.EXPO_PUBLIC_C_VALIDATION_INTERNAL, 'true');
  assert.throws(() => publicEnvironment({ ...input, EXPO_PUBLIC_SUPABASE_KEY: 'sb_secret_fixture' }), /public_supabase_key_required/);
  assert.throws(() => publicEnvironment({ ...input, EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }), /public_https_endpoint_required/);
  assert.throws(() => publicEnvironment({ ...input, EXPO_PUBLIC_NEW_INTERNAL: 'true' }), /unreviewed_public_variable/);
});
