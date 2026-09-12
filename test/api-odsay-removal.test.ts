import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createCourseV1RouteAdapter, defaultCourseV1RouteFetcher, createCourseV1RouteRequestScope } from '../src/services/courseV1RouteAdapter';

const require = createRequire(import.meta.url);
const { publicEnvironment, assertPublicNativeEnvironment } = require('../scripts/release-build.cjs');
const input = { EXPO_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_fixture', EXPO_PUBLIC_CAPTCHA_CHALLENGE_URL: 'https://fixture.example/challenge', EXPO_PUBLIC_KAKAO_JAVASCRIPT_API_KEY: 'fixture' };
const from = { id: 'a', lat: 35.1, lon: 129.1 }, to = { id: 'b', lat: 35.2, lon: 129.2 };

test('release rejects even an empty retired public key by name only, including native bypass', () => {
  const unreadable = Object.defineProperty({ ...input }, 'EXPO_PUBLIC_ODSAY_API_KEY', {
    enumerable: true, get() { assert.fail('retired key value must not be read'); },
  });
  assert.throws(() => publicEnvironment(unreadable), { message: 'forbidden_public_variable:EXPO_PUBLIC_ODSAY_API_KEY' });
  for (const value of ['', 'fixture-secret']) {
    assert.throws(() => publicEnvironment({ ...input, EXPO_PUBLIC_ODSAY_API_KEY: value }), { message: 'forbidden_public_variable:EXPO_PUBLIC_ODSAY_API_KEY' });
    assert.throws(() => assertPublicNativeEnvironment({ ...publicEnvironment(input), EXPO_PUBLIC_ODSAY_API_KEY: value }), { message: 'forbidden_public_variable:EXPO_PUBLIC_ODSAY_API_KEY' });
  }
  const output = publicEnvironment({ ...input, ODSAY_API_KEY: 'fixture-secret' });
  assert.equal(Object.keys(output).some(key => key.includes('ODSAY')), false);
});

test('legacy adapter never fetches transit or promotes historical ODsay success into new exact cache', async () => {
  let transitCalls = 0;
  const historical = { min: 9, source: 'ODsay' };
  const adapter = createCourseV1RouteAdapter({ fetcher: { async fetch(_a, _b, mode) {
    if (mode === 'transit') { transitCalls++; return historical; }
    return { min: 18, source: 'TMAP' };
  } } });
  assert.equal(await adapter.getRoute(from, to), null);
  assert.equal(await adapter.getRoute(from, to), null);
  assert.equal(transitCalls, 0);
  assert.deepEqual(historical, { min: 9, source: 'ODsay' });
});

test('default transit entry is no-route; retired observer is denied before budget accounting', async () => {
  assert.equal(await defaultCourseV1RouteFetcher.fetch(from, to, 'transit', { recordProviderHttpAttempt() { assert.fail('no provider attempt'); } }), null);
  const scope = createCourseV1RouteRequestScope({ budget: { providerHttpAttempts: { tmap: 1 } }, fetcher: {
    providerHttpAttemptsObserved: true,
    async fetch(_a, _b, _mode, observer) {
      assert.equal(observer.recordProviderHttpAttempt('odsay'), false);
      return { min: 8, source: 'TMAP' };
    },
  } });
  assert.equal(await scope.createAdapter().getRoute(from, to), null);
  assert.deepEqual(scope.diagnostics().providerHttpAttempts, { tmap: 0 });
});
