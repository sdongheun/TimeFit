import test from 'node:test';
import 'tsx/cjs';
import assert from 'node:assert/strict';
import { screenRuntime as makeScreenRuntime } from './support/screenRuntime.mjs';
const screenRuntime = overrides => makeScreenRuntime({ './liveActivity/learningEvidenceComposition': { liveLearningEvidence: { clearInvalidatedNative: async () => {} } }, 'expo-modules-core': { uuid: { v4: () => '11111111-1111-4111-8111-111111111111' } }, ...overrides });
const flush = async () => { for (let n = 0; n < 60; n++) await Promise.resolve(); };

test('B actual records panel: A late result cannot appear in B; unavailable never falls back to guest', async () => {
  let subject = 'A'; const reads = new Map();
  const getPorts = async () => ({
    async readOwnedDeviceCourseCompletions() { return { status: 'empty', records: [] }; },
    supabaseAccountIdentityResolver: { async resolve() { return { status: 'account', identity: { subject } }; } },
    supabaseAccountCourseCompletionRepository: { readAccountCourseCompletions() { return new Promise(resolve => reads.set(subject, resolve)); } },
  });
  const runtime = screenRuntime({ './OwnedDeletionPanel': { OwnedDeletionPanel: 'OwnedDeletionPanel' } });
  const { AccountRecordsPanel } = runtime.load('src/ui/AccountRecordsPanel.tsx');
  const screen = runtime.mount(() => AccountRecordsPanel({ subject, getPorts }), {});
  await flush();
  subject = 'B'; screen.render(); await flush();
  reads.get('A')({ status: 'ok', records: [{ completionId: 'a', completedAtMinute: 1, places: [{ title: 'A private place' }] }] });
  reads.get('B')({ status: 'unavailable', records: [] });
  await flush();
  assert.doesNotMatch(JSON.stringify(screen.render()), /A private place/);
  assert.match(JSON.stringify(screen.render()), /계정 기록을 확인하지 못했어요/);
});

test('B actual consent panel: unchecked, failed mutation stays off, duplicate submit once, success invalidates sessions', async () => {
  let invalidations = 0, resolveChange, submits = 0;
  const getPorts = async () => ({
    supabaseAccountIdentityResolver: { async resolve() { return { status: 'account', identity: { subject: 'A' } }; } },
    supabaseDwellPersonalizationRepository: {
      async readDwellPersonalizationConsent() { return { status: 'ok', consent: { enabled: false, consentEpoch: null, revision: 0, updatedAt: '' } }; },
      setDwellPersonalizationConsent(input) { submits++; assert.equal(input.enabled, true); return new Promise(resolve => { resolveChange = resolve; }); },
    },
  });
  const runtime = screenRuntime({ './personalizationComposition': { personalizationSession: { invalidate() { invalidations++; } } } });
  const { AccountPersonalizationPanel } = runtime.load('src/ui/AccountPersonalizationPanel.tsx');
  const screen = runtime.mount(AccountPersonalizationPanel, { subject: 'A', getPorts });
  await flush();
  assert.equal(screen.get('profile-dwell-consent').props.accessibilityState.checked, false);
  screen.press('profile-dwell-consent'); screen.press('profile-dwell-consent'); await flush();
  assert.equal(submits, 1);
  resolveChange({ status: 'unavailable' }); await flush();
  assert.equal(screen.get('profile-dwell-consent').props.accessibilityState.checked, false);
  screen.press('profile-dwell-consent'); await flush();
  resolveChange({ status: 'updated', consent: { enabled: true, consentEpoch: 'epoch', revision: 1, updatedAt: '' } }); await flush();
  assert.equal(screen.get('profile-dwell-consent').props.accessibilityState.checked, true);
  assert.equal(invalidations, 3); // also invalidates reads started during the successful mutation
});

test('B actual profile: nickname optional null delete and typed validation errors', async () => {
  const inputs = [];
  const getPorts = async () => ({
    supabaseAccountIdentityResolver: { async resolve() { return { status: 'account', identity: { subject: 'A' } }; } },
    supabaseAccountProfileRepository: {
      async readAccountProfile() { return { status: 'ok', profile: { nickname: 'First' } }; },
      async updateAccountNickname(input) { inputs.push(input); return input.nickname === 'invalid' ? { status: 'invalid_nickname' } : { status: 'updated', profile: { nickname: input.nickname } }; },
    },
  });
  const runtime = screenRuntime();
  const { AccountPersonalizationPanel } = runtime.load('src/ui/AccountPersonalizationPanel.tsx');
  const screen = runtime.mount(AccountPersonalizationPanel, { subject: 'A', profile: true, getPorts });
  await flush();
  screen.get('profile-nickname').props.onChangeText('');
  screen.press('profile-nickname-save'); await flush();
  assert.equal(inputs[0].nickname, null);
  assert.equal(screen.get('profile-nickname').props.value, '');
  screen.get('profile-nickname').props.onChangeText('invalid');
  screen.press('profile-nickname-save'); await flush();
  assert.match(JSON.stringify(screen.render()), /줄바꿈 없이 1~20자/);
});
