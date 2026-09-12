import test from 'node:test';
import assert from 'node:assert/strict';
import 'tsx/cjs';
import { createRequire } from 'node:module';
import { screenRuntime } from './support/screenRuntime.mjs';
const require = createRequire(import.meta.url);
const { ownedCourseFixture } = require('./fixtures/ownedCoursePorts.ts');
const { liveEvidenceFixture } = require('../fixtures/liveLearningEvidenceFixture.ts');
const flush = async () => { for (let n = 0; n < 150; n++) await Promise.resolve(); };
const uuid = { v4: () => '11111111-1111-4111-8111-111111111111' };

test('actual import panel + production factories: source read binds nothing, offline retry preserves and then removes acknowledged source only', async () => {
  const f = ownedCourseFixture(); f.setActor('guest');
  const ports = f.make();
  await ports.beginOwnedCourseRun({ courseRunId: 'guest-run' });
  await ports.completeOwnedCourseRun({ courseRunId: 'guest-run', trigger: 'explicit_course_finish', completedAt: 1788753500000, places: [{ contentId: 'p', title: '장소', category: '카페', subCategory: '커피전문점', plannedStayMin: 30, actualDwellMin: 40 }] });
  f.setActor('A');
  const runtime = screenRuntime();
  const { GuestImportPanel } = runtime.load('src/ui/GuestImportPanel.tsx');
  const screen = runtime.mount(GuestImportPanel, { subject: 'A', surface: 'records', getPorts: async () => ports });
  await flush(); assert.equal(f.calls.length, 0);
  f.setOnline(false); screen.press('guest-import-approve'); screen.press('guest-import-approve'); await flush();
  assert.equal(f.calls.filter(c => c === 'import').length, 1);
  assert.equal((await ports.readGuestCompletionImportSource({ surface: 'records' })).records.length, 1);
  f.setOnline(true); screen.press('guest-import-approve'); await flush();
  assert.equal((await ports.readGuestCompletionImportSource({ surface: 'records' })).records.length, 0);
  assert.equal(f.samples.length, 0);
});

test('actual signup: registry documents unchecked, two explicit consents, stable request, no age metadata', async () => {
  const inputs = [];
  const runtime = screenRuntime({ './CaptchaVerificationSheet': { CaptchaVerificationSheet: 'Captcha' }, 'expo-modules-core': { uuid }, './AuthContext': { useAuth: () => ({ authKind: 'guest', signUp: async input => { inputs.push(input); return false; } }) } });
  const { LoginScreen } = runtime.load('src/ui/LoginScreen.tsx');
  runtime.native.Linking.openURL = async () => {};
  const screen = runtime.mount(LoginScreen, { navigation: { addListener: () => () => {}, goBack() {} }, readDocuments: async () => ({ status: 'ok', documents: ['terms-of-service','privacy-policy'].map(documentId => ({ documentId, documentVersion: 'fixture-v1', url: 'https://fixture.invalid/doc' })) }) });
  screen.press('login-mode-signup'); screen.render(); await flush();
  assert.equal(screen.get('login-submit').props.disabled, true);
  screen.get('login-email').props.onChangeText('fixture@example.test'); screen.get('login-password').props.onChangeText('fixture-password'); screen.get('signup-password-confirm').props.onChangeText('fixture-password');
  await screen.press('signup-document-terms-of-service'); await screen.press('signup-document-privacy-policy');
  screen.press('signup-consent-terms-of-service'); screen.press('signup-consent-privacy-policy');
  screen.press('signup-age-confirm');
  await screen.press('login-submit');
  screen.nodes(n=>n.type==='Captcha')[0].props.onVerified('fresh-fixture');await flush();
  assert.equal(inputs.length, 1); assert.equal(inputs[0].requiredConsents.terms.accepted, true);
  assert.doesNotMatch(JSON.stringify(inputs), /age|birth|timestamp/);
});

test('actual deletion: server reauthentication and unknown result never clear unrelated progress or sign out', async () => {
  let result = { status: 'reauth_required' }, confirmed, signs = 0, clears = 0;
  const ids = [];
  const runtime = screenRuntime({
    'expo-modules-core': { uuid }, './AppFlowContext': { useActiveVerifiedCourseFlow: () => ({ activeVerifiedCourse: null, clearActiveVerifiedCourse() { clears++; } }) },
    './AuthContext': { useAuth: () => ({ accountSession: { user: { email: 'fixture@example.test' } }, async signIn() { signs++; }, async signOut() { throw Error('must not sign out'); } }) },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: { finish() { throw Error('must not finish'); } } },
    './liveActivity/learningEvidenceComposition': { liveLearningEvidence: { close: async () => {} } },
  });
  runtime.native.Alert.alert = (_title, _copy, buttons) => { confirmed = buttons.at(-1).onPress; };
  const { OwnedDeletionPanel } = runtime.load('src/ui/OwnedDeletionPanel.tsx');
  const screen = runtime.mount(OwnedDeletionPanel, { subject: 'A', account: true, getPorts: async () => ({ supabaseAccountIdentityResolver: { resolve: async () => ({ status: 'account', identity: { subject: 'A' } }) }, deleteOwnedAccount: async input => { ids.push(input.requestId); return result; }, recheckOwnedAccountDeletion: async () => ({ status: 'unknown' }) }) });
  const action = screen.get('owned-delete-all');
  assert.equal(action.props.style.alignItems, 'center'); assert.equal(action.props.style.borderWidth, 1);
  assert.equal(action.props.style.backgroundColor, '#171719'); assert.equal(action.props.children.props.style.textAlign, 'center');
  screen.press('owned-delete-all'); confirmed(); await flush();
  screen.get('delete-account-password').props.onChangeText('fixture-password');
  result = { status: 'retryable_failure', stage: 'verification' };
  screen.press('owned-delete-all'); confirmed(); await flush();
  assert.equal(signs, 1); assert.equal(clears, 0); assert.equal(ids[0], ids[1]);
  assert.match(JSON.stringify(screen.render()), /削除|삭제 결과 확인 중/);
});

for (const switched of [false, true]) test(`cold deletion uses production readonly proof and exact current run after await: switched=${switched}`, async () => {
  const f = liveEvidenceFixture(); await f.make().beginCourseRun({ courseRunId: 'cold-A' });
  const db = f.makeCold(); let confirm, release, clears = 0, finishes = 0;
  const waiting = new Promise(resolve => { release = resolve; });
  const flow = { activeVerifiedCourse: { courseRunId: 'cold-A', identity: 'id-A' }, clearActiveVerifiedCourse() { clears++; } };
  const runtime = screenRuntime({
    'expo-modules-core': { uuid }, './AppFlowContext': { useActiveVerifiedCourseFlow: () => flow },
    './AuthContext': { useAuth: () => ({ accountSession: { user: { id: 'A' } }, async signOut() {} }) },
    './liveActivity/courseProgressComposition': { liveCourseProgressRuntime: { async finish() { finishes++; } } },
    './liveActivity/learningEvidenceComposition': { liveLearningEvidence: { close: async () => {} } },
  });
  runtime.native.Alert.alert = (_title, _copy, buttons) => { confirm = buttons.at(-1).onPress; };
  const { OwnedDeletionPanel } = runtime.load('src/ui/OwnedDeletionPanel.tsx');
  const screen = runtime.mount(OwnedDeletionPanel, { subject: 'A', getPorts: async () => ({
    readOwnedCourseRunOwnership: db.readCourseRunOwnership, canCleanupOwnedCourseRun: db.canCleanupCourseRun,
    supabaseAccountIdentityResolver: f.deps.identity, deleteAllOwnedAccountRecords: async () => { await waiting; return { status: 'deleted' }; },
  }) });
  screen.press('owned-delete-all'); confirm(); await flush();
  if (switched) flow.activeVerifiedCourse = { courseRunId: 'new-run', identity: 'new-id' };
  release(); await flush();
  assert.equal(clears, switched ? 0 : 1); assert.equal(finishes, switched ? 0 : 1);
});
