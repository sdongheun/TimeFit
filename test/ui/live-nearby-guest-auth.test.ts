import assert from 'node:assert/strict';
import test from 'node:test';
import { createNearbyGuestAuthGate } from '../../src/ui/nearbyGuestAuthGate';

test('existing session enters nearby without CAPTCHA or anonymous sign-in', async () => {
  let created = 0;
  const gate = createNearbyGuestAuthGate({ getSession: async () => ({ accessToken: 'existing' }), signInAnonymously: async () => { created++; return { accessToken: 'new' }; } });
  assert.equal(await gate.prepare(), 'ready');
  assert.equal(created, 0);
});

test('no session requires explicit CAPTCHA; verified fresh token signs in once', async () => {
  let session = false, created = 0;
  const gate = createNearbyGuestAuthGate({ getSession: async () => session ? { accessToken: 'new' } : null, signInAnonymously: async (token) => { assert.equal(token, 'fresh-once'); created++; session = true; return { accessToken: 'new' }; } });
  assert.equal(await gate.prepare(), 'captcha_required');
  assert.equal(created, 0);
  assert.equal(await gate.verify('fresh-once'), 'ready');
  assert.equal(await gate.verify('fresh-once'), 'ignored');
  assert.equal(created, 1);
});

test('cancel or missing token never creates an anonymous session or starts providers', async () => {
  let created = 0;
  const gate = createNearbyGuestAuthGate({ getSession: async () => null, signInAnonymously: async () => { created++; return null; } });
  assert.equal(await gate.prepare(), 'captcha_required');
  gate.cancel();
  assert.equal(await gate.verify('late-token'), 'ignored');
  assert.equal(created, 0);
  assert.equal(await gate.prepare(), 'captcha_required');
  assert.equal(await gate.verify(''), 'failed');
  assert.equal(created, 0);
});

test('auth failure requires a new explicit prepare/verification; old token is never reused', async () => {
  let attempts = 0;
  const gate = createNearbyGuestAuthGate({ getSession: async () => null, signInAnonymously: async () => { attempts++; return null; } });
  assert.equal(await gate.prepare(), 'captcha_required');
  assert.equal(await gate.verify('first'), 'failed');
  assert.equal(await gate.verify('first'), 'ignored');
  assert.equal(attempts, 1);
  assert.equal(await gate.prepare(), 'captcha_required');
  assert.equal(await gate.verify('second'), 'failed');
  assert.equal(attempts, 2);
});

test('cancel during anonymous sign-in invalidates its late result', async () => {
  let finish!: (session: { accessToken: string }) => void;
  const gate = createNearbyGuestAuthGate({ getSession: async () => null, signInAnonymously: async () => new Promise(resolve => { finish = resolve; }) });
  assert.equal(await gate.prepare(), 'captcha_required');
  const verifying = gate.verify('fresh');
  await Promise.resolve(); await Promise.resolve();
  gate.cancel();
  finish({ accessToken: 'late' });
  assert.equal(await verifying, 'ignored');
});

test('session lookup error fails closed before CAPTCHA/provider calls', async () => {
  let created = 0;
  const gate = createNearbyGuestAuthGate({ getSession: async () => { throw Error('fixture'); }, signInAnonymously: async () => { created++; return { accessToken: 'unexpected' }; } });
  assert.equal(await gate.prepare(), 'failed');
  assert.equal(await gate.verify('unearned-token'), 'ignored');
  assert.equal(created, 0);
});
