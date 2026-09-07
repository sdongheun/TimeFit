import assert from 'node:assert/strict';
import test from 'node:test';
import 'tsx/cjs';
import { screenRuntime as makeScreenRuntime } from './support/screenRuntime.mjs';
const screenRuntime = overrides => makeScreenRuntime({ './CaptchaVerificationSheet': { CaptchaVerificationSheet: 'Captcha' }, './OwnedDeletionPanel': { OwnedDeletionPanel: 'OwnedDeletionPanel' }, 'expo-modules-core': { uuid: { v4: () => '11111111-1111-4111-8111-111111111111' } }, ...overrides });

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const theme = { C: { bg: '#000', panel: '#111', panel2: '#222', line: '#333', txt: '#fff', txt2: '#ddd', muted: '#999', placeholder: '#777', accent: '#06f', onAccent: '#fff', red: '#f44' } };
const textOf = (node) => Array.isArray(node?.props?.children)
  ? node.props.children.map(textOf).join('')
  : typeof node?.props?.children === 'string' ? node.props.children : '';

function homeFixture(authKind) {
  const calls = [];
  const runtime = screenRuntime({
    './AuthContext': { useAuth: () => ({ authKind }) },
    './theme': theme,
    '@expo/vector-icons': { Feather: 'Feather' },
    './AppFlowContext': { useAppFlow: () => ({ activeCourse: null, activeVerifiedCourse: null }) },
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './mainTabNavigation': { resetToActivityRecord() {}, resetToNearbyBrowse() {}, resetToProfile() {} },
    './activeVerifiedCourseModel': { homeActiveCourseProjection: () => ({ kind: 'placeholder' }) },
  });
  const { HomeScreen } = runtime.load('src/ui/HomeScreen.tsx');
  const navigation = {
    navigate: (...args) => calls.push(['navigate', ...args]),
    dispatch: (...args) => calls.push(['dispatch', ...args]),
  };
  return { calls, screen: runtime.mount(HomeScreen, { navigation }) };
}

test('메인 프로필 entry는 guest/anonymous만 Login, account는 Profile이며 loading은 중복 이동하지 않는다', () => {
  const { authKindFor } = screenRuntime().load('src/ui/authStateModel.ts');
  assert.equal(authKindFor(null, false), 'guest');
  assert.equal(authKindFor({ user: { id: 'proxy', is_anonymous: true } }, false), 'guest');
  assert.equal(authKindFor({ user: { id: 'member' } }, false), 'account');
  assert.equal(authKindFor(null, true), 'loading');
  for (const [kind, target] of [['guest', 'Login'], ['account', 'Profile']]) {
    const fixture = homeFixture(kind);
    fixture.screen.press('home-profile-entry');
    assert.deepEqual(fixture.calls, [['navigate', target]]);
  }
  const loading = homeFixture('loading');
  loading.screen.press('home-profile-entry');
  assert.deepEqual(loading.calls, []);
});

function profileFixture(authKind = 'guest', { openSettings = async () => {} } = {}) {
  const calls = [];
  let reads = 0;
  let appStateListener;
  const runtime = screenRuntime({
    './AccountPersonalizationPanel': { AccountPersonalizationPanel: 'AccountPersonalizationPanel' },
    './AuthContext': { useAuth: () => ({ authKind, accountSession: authKind === 'account' ? { user: { id: 'account' } } : null, signOut: async () => {} }) },
    './theme': theme,
    './FloatingTabBar': { FloatingTabBar: 'FloatingTabBar' },
    './mainTabNavigation': { resetToActivityRecord() {}, resetToMain() {}, resetToNearbyBrowse() {} },
    './profileSettingsPort': {
      readProfilePermissionSnapshot: async () => {
        reads += 1;
        return { location: 'granted', notification: 'denied', liveActivity: 'granted' };
      },
      openProfileSystemSettings: openSettings,
    },
  });
  runtime.native.AppState = { addEventListener: (_name, listener) => { appStateListener = listener; return { remove() {} }; } };
  const { ProfileScreen } = runtime.load('src/ui/ProfileScreen.tsx');
  const navigation = { navigate: (...args) => calls.push(['navigate', ...args]), dispatch: (...args) => calls.push(['dispatch', ...args]) };
  return { calls, get reads() { return reads; }, activate: () => appStateListener?.('active'), screen: runtime.mount(ProfileScreen, { navigation }) };
}

test('내정보는 인증 상태와 무관하게 세 영역을 공개하고 권한은 읽기 전용 조회 후 복귀 때 갱신한다', async () => {
  const fixture = profileFixture('guest');
  await tick();
  const allText = fixture.screen.nodes((node) => node.type === 'Text').map(textOf).join('|');
  assert.match(allText, /내정보/);
  assert.match(allText, /내 프로필/);
  assert.match(allText, /권한 및 맞춤 추천/);
  assert.match(allText, /앱 안내/);
  assert.match(allText, /허용됨/);
  assert.match(allText, /거절됨/);
  assert.match(allText, /실시간 현황/);
  assert.equal(fixture.screen.nodes((node) => node.type === 'TextInput').length, 0);
  assert.equal(fixture.reads, 1);
  fixture.activate();
  await tick();
  assert.equal(fixture.reads, 2);
});

test('내정보 로그인 안내는 별도 Login 화면으로 navigate하고 account에는 프로필 관리 entry를 제공한다', () => {
  const guest = profileFixture('guest');
  guest.screen.press('profile-login-entry');
  assert.deepEqual(guest.calls, [['navigate', 'Login']]);

  const account = profileFixture('account');
  const allText = account.screen.nodes((node) => node.type === 'Text').map(textOf).join('|');
  assert.match(allText, /닉네임 설정하기/);
  assert.match(allText, /프로필 관리에서 닉네임/);
  assert.doesNotMatch(allText, /저장 계약|공개 채널|문의 채널|repository|metadata|endpoint/);
  assert.doesNotMatch(allText, /계정 삭제/);
  assert.doesNotMatch(allText, /@/);
});

test('설정 열기 실패는 현재 화면에 남아 같은 행동으로 재시도할 수 있다', async () => {
  let attempts = 0;
  const fixture = profileFixture('guest', { openSettings: async () => { attempts += 1; if (attempts === 1) throw new Error('blocked'); } });
  await fixture.screen.press('profile-open-settings');
  let allText = fixture.screen.nodes((node) => node.type === 'Text').map(textOf).join('|');
  assert.match(allText, /설정 열기 다시 시도/);
  await fixture.screen.press('profile-open-settings');
  allText = fixture.screen.nodes((node) => node.type === 'Text').map(textOf).join('|');
  assert.doesNotMatch(allText, /설정 열기 다시 시도/);
  assert.equal(attempts, 2);
});

test('로그인은 성공 account 상태에서만 원래 stack으로 돌아가며 취소 뒤 늦은 응답은 이동시키지 않는다', async () => {
  let authKind = 'guest';
  let resolveSignIn;
  const signIn = () => new Promise((resolve) => { resolveSignIn = resolve; });
  const calls = [];
  const listeners = {};
  const runtime = screenRuntime({
    './AuthContext': { useAuth: () => ({ authKind, signIn, signUp: async () => false }) },
    './theme': theme,
  });
  const { LoginScreen } = runtime.load('src/ui/LoginScreen.tsx');
  const navigation = {
    goBack: () => calls.push('goBack'),
    addListener: (name, fn) => { listeners[name] = fn; return () => {}; },
  };
  const screen = runtime.mount(LoginScreen, { navigation });
  screen.get('login-email').props.onChangeText('person@example.com');
  screen.get('login-password').props.onChangeText('password');
  const pending = screen.press('login-submit');
  screen.nodes(n => n.type === 'Captcha')[0].props.onVerified('fresh-login-fixture');
  authKind = 'account';
  screen.render();
  assert.deepEqual(calls, ['goBack']);
  resolveSignIn();
  await pending;
  screen.unmount();

  authKind = 'guest';
  const lateCalls = [];
  const late = runtime.mount(LoginScreen, { navigation: { goBack: () => lateCalls.push('goBack'), addListener: () => () => {} } });
  late.get('login-email').props.onChangeText('person@example.com');
  late.get('login-password').props.onChangeText('password');
  const latePending = late.press('login-submit');
  late.nodes(n => n.type === 'Captcha')[0].props.onVerified('fresh-login-fixture');
  late.press('login-cancel');
  late.unmount();
  authKind = 'account';
  resolveSignIn();
  await latePending;
  assert.deepEqual(lateCalls, ['goBack']);
});

test('로그인·회원가입 전환은 제출 중 잠기고 실패 뒤에는 입력을 유지한 채 다시 제출할 수 있다', async () => {
  let rejectSignIn;
  let signInCalls = 0;
  let resolveSignUp;
  let signUpCalls = 0;
  const signIn = () => {
    signInCalls += 1;
    return new Promise((_resolve, reject) => { rejectSignIn = reject; });
  };
  const runtime = screenRuntime({
    './AuthContext': { useAuth: () => ({
      authKind: 'guest',
      signIn,
      signUp: () => { signUpCalls += 1; return new Promise((resolve) => { resolveSignUp = resolve; }); },
    }) },
    './theme': theme,
  });
  const { LoginScreen } = runtime.load('src/ui/LoginScreen.tsx');
  const screen = runtime.mount(LoginScreen, { navigation: { goBack() {}, addListener: () => () => {} } });
  screen.get('login-email').props.onChangeText('person@example.com');
  screen.get('login-password').props.onChangeText('password');
  const first = screen.press('login-submit');
  screen.nodes(n => n.type === 'Captcha')[0].props.onVerified('fresh-login-fixture');
  assert.equal(screen.get('login-mode-login').props.disabled, true);
  assert.equal(screen.get('login-mode-signup').props.disabled, true);
  screen.press('login-mode-signup');
  assert.equal(screen.nodes((node) => textOf(node) === '출생연도').length, 0);
  rejectSignIn(new Error('retryable'));
  await first;
  await tick();
  assert.equal(screen.get('login-mode-signup').props.disabled, false);
  assert.equal(screen.get('login-email').props.value, 'person@example.com');
  assert.equal(screen.get('login-password').props.value, 'password');
  const second = screen.press('login-submit');
  screen.nodes(n => n.type === 'Captcha')[0].props.onVerified('next-login-fixture');
  assert.equal(signInCalls, 2);
  rejectSignIn(new Error('retryable'));
  await second;
  await tick();

  screen.press('login-mode-signup');
  screen.get('signup-password-confirm').props.onChangeText('password');
  assert.equal(screen.nodes(node => node.props.testID === 'signup-birth-year').length, 0);
  assert.equal(screen.get('login-submit').props.disabled, true);
  screen.press('login-submit');
  assert.equal(signUpCalls, 0);
  assert.equal(screen.get('login-mode-login').props.disabled, false);
  screen.press('login-mode-login');
  assert.equal(screen.nodes((node) => textOf(node) === '출생연도').length, 0);
});

test('권한 adapter는 request 없이 상태를 구분하고 설정 열기 실패를 반환한다', async () => {
  const runtime = screenRuntime({
    'expo-location': {},
    'expo-notifications': {},
    './liveActivity/nativeLiveActivityPort': { nativeLiveActivityPort: { activitySupport: async () => ({ supported: false, enabled: false }) } },
  });
  const { readProfilePermissionSnapshot, openProfileSystemSettings } = runtime.load('src/ui/profileSettingsPort.ts');
  let locationReads = 0;
  let notificationReads = 0;
  const snapshot = await readProfilePermissionSnapshot({
    getLocationPermission: async () => { locationReads += 1; return { status: 'undetermined', granted: false }; },
    getNotificationPermission: async () => { notificationReads += 1; return { status: 'denied', granted: false }; },
    getLiveActivitySupport: async () => ({ supported: true, enabled: true }),
  });
  assert.deepEqual(snapshot, { location: 'undetermined', notification: 'denied', liveActivity: 'granted' });
  assert.equal(locationReads, 1);
  assert.equal(notificationReads, 1);
  assert.deepEqual(await readProfilePermissionSnapshot({}), { location: 'unavailable', notification: 'unavailable', liveActivity: 'unavailable' });
  assert.deepEqual(await readProfilePermissionSnapshot({
    getLocationPermission: async () => { throw new Error('read failed'); },
    getNotificationPermission: async () => ({ status: 'granted', granted: true }),
    getLiveActivitySupport: async () => ({ supported: true, enabled: false }),
  }), { location: 'error', notification: 'granted', liveActivity: 'denied' });
  await assert.rejects(() => openProfileSystemSettings({ openSettings: async () => { throw new Error('blocked'); } }), /blocked/);
});
