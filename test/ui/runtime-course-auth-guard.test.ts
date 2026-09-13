import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import { ensureRouteProxyAnonymousSession } from '../../src/services/routeProxyAnonymousAuth';
import {
  AccountSessionRequiredError,
  accountSessionFor,
  authKindFor,
  profileAuthProjection,
  requireAccountSession,
} from '../../src/ui/authStateModel';
import {
  createActiveVerifiedCourseStartController,
  startActiveVerifiedCourse,
  type ActiveVerifiedCourse,
  type ActiveVerifiedCourseStartConfirmation,
} from '../../src/ui/activeVerifiedCourseModel';
import type { RecommendationSession } from '../../src/ui/nav';

const session: RecommendationSession = {
  nowIso: '2026-09-05T06:00:00.000Z',
  origin: { id: 'origin', label: '출발지', lat: 35.15, lon: 129.05 },
  destination: { id: 'destination', label: '약속 장소', lat: 35.16, lon: 129.06 },
  remainingMin: 90,
  arrivalBufferMin: 10,
};

function course(id: string): VerifiedCourseV1 {
  return {
    id,
    placeIds: [`${id}-place`],
    stops: [{ placeId: `${id}-place`, stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-05T06:10:00.000Z', departureAt: '2026-09-05T06:40:00.000Z' }],
    legs: [
      { fromId: 'origin', toId: `${id}-place`, mode: 'walk', min: 10 },
      { fromId: `${id}-place`, toId: 'destination', mode: 'transit', min: 20 },
    ],
    stayMin: 30,
    travelMin: 30,
    totalMin: 60,
    arrivalBufferMin: 10,
    remainingAfterCourseMin: 30,
    remainingAfterArrivalBufferMin: 20,
  };
}

const anonymous = { user: { id: 'anonymous-route-proxy', email: 'must-not-show@example.com', is_anonymous: true } };
const account = { user: { id: 'account-user', email: 'account@example.com', is_anonymous: false } };

test('URUNTIMEGUARD01 failure-first: loading/null/anonymous/account를 email 추론 없이 분류한다', () => {
  assert.equal(authKindFor(null, true), 'loading');
  assert.equal(authKindFor(null, false), 'guest');
  assert.equal(authKindFor(anonymous, false), 'guest');
  assert.equal(authKindFor(account, false), 'account');
  assert.equal(authKindFor({ user: { id: 'account-without-email' } }, false), 'account');
  assert.equal(accountSessionFor(anonymous, false), null);
  assert.equal(accountSessionFor(account, false), account);
});

test('URUNTIMEGUARD01 failure-first: anonymous Profile은 로그인 폼이며 이메일·로그아웃을 노출하지 않는다', () => {
  assert.deepEqual(profileAuthProjection(anonymous, false), { kind: 'guest' });
  assert.deepEqual(profileAuthProjection(account, false), { kind: 'account', email: 'account@example.com' });
  assert.deepEqual(profileAuthProjection(null, true), { kind: 'loading' });
});

test('URUNTIMEGUARD01 failure-first: 저장 repository 소비는 일반 account만 허용한다', () => {
  let repositoryCalls = 0;
  const consume = (candidate: typeof account | typeof anonymous | null) => {
    const resolved = requireAccountSession(candidate, false);
    repositoryCalls += 1;
    return resolved.user.id;
  };
  assert.throws(() => consume(null), AccountSessionRequiredError);
  assert.throws(() => consume(anonymous), AccountSessionRequiredError);
  assert.equal(repositoryCalls, 0);
  assert.equal(consume(account), 'account-user');
  assert.equal(repositoryCalls, 1);
});

test('URUNTIMEGUARD01 failure-first: 기존 anonymous raw session은 Route Proxy가 재사용하고 CAPTCHA·sign-in은 0회다', async () => {
  let captchaCalls = 0;
  let signInCalls = 0;
  const result = await ensureRouteProxyAnonymousSession({
    anonymousAuthEnabled: true,
    captcha: { async requestToken() { captchaCalls += 1; return 'must-not-request'; } },
    auth: {
      async getSession() { return { accessToken: 'existing-anonymous-token' }; },
      async signInAnonymously() { signInCalls += 1; return null; },
    },
  });
  assert.deepEqual(result, { status: 'ready', accessToken: 'existing-anonymous-token' });
  assert.equal(captchaCalls, 0);
  assert.equal(signInCalls, 0);
});

function startHarness() {
  let active: ActiveVerifiedCourse | null = null;
  let starts = 0;
  let progressInitializations = 0;
  let navigations = 0;
  let confirmations = 0;
  let completionWrites = 0;
  let externalCalls = 0;
  let confirmation: ActiveVerifiedCourseStartConfirmation | null = null;
  const navigated: ActiveVerifiedCourse[] = [];
  const controller = createActiveVerifiedCourseStartController({
    canStart: () => true, // This fixture isolates identity/confirmation; expiry has its own fixed-clock tests.
    start(request) {
      starts += 1;
      active = startActiveVerifiedCourse(request.session, request.course, () => `runtime-${starts}`, () => {
        progressInitializations += 1;
        return { stepIndex: 0, routeOpened: false, finished: false };
      });
      return active;
    },
    navigate(next) { navigations += 1; navigated.push(next); },
    confirm(model) { confirmations += 1; confirmation = model; },
  });
  const counts = () => ({ starts, progressInitializations, navigations, confirmations, completionWrites, externalCalls });
  return {
    controller,
    counts,
    navigated,
    get active() { return active; },
    set active(value: ActiveVerifiedCourse | null) { active = value; },
    get confirmation() { return confirmation; },
    unchangedBoundaries() { completionWrites += 0; externalCalls += 0; },
  };
}

test('URUNTIMEGUARD01 failure-first: active 없음은 확인 없이 생성·navigation 각 1회이고 빠른 tap은 무시한다', () => {
  const h = startHarness();
  const request = { session, course: course('course-a') };
  h.controller.request(null, request);
  h.controller.request(null, request);
  assert.deepEqual(h.counts(), { starts: 1, progressInitializations: 1, navigations: 1, confirmations: 0, completionWrites: 0, externalCalls: 0 });
});

test('URUNTIMEGUARD01 failure-first: 같은 원본 snapshot은 기존 identity/progress로 바로 이어간다', () => {
  const h = startHarness();
  const item = course('course-a');
  const existing = startActiveVerifiedCourse(session, item, () => 'existing', () => ({ stepIndex: 2, routeOpened: true, finished: false }));
  h.active = existing;
  h.controller.request(existing, { session, course: item });
  assert.equal(h.navigated[0], existing);
  assert.deepEqual(h.counts(), { starts: 0, progressInitializations: 0, navigations: 1, confirmations: 0, completionWrites: 0, externalCalls: 0 });
});

test('URUNTIMEGUARD01 failure-first: course id가 같아도 session 또는 객체 snapshot이 다르면 교체 확인이다', () => {
  const h = startHarness();
  const original = course('same-id');
  const existing = startActiveVerifiedCourse(session, original, () => 'existing');
  h.controller.request(existing, { session: { ...session }, course: original });
  assert.equal(h.confirmation?.title, '진행 중인 코스가 있어요');
  assert.deepEqual(h.counts(), { starts: 0, progressInitializations: 0, navigations: 0, confirmations: 1, completionWrites: 0, externalCalls: 0 });
  h.controller.reset();
  h.controller.request(existing, { session, course: course('same-id') });
  assert.equal(h.counts().confirmations, 2);
});

test('URUNTIMEGUARD01 failure-first: 다른 active 확인 전과 취소는 상태·navigation·완료 기록을 바꾸지 않는다', () => {
  const h = startHarness();
  const existing = startActiveVerifiedCourse(session, course('course-a'), () => 'existing');
  h.active = existing;
  h.controller.request(existing, { session, course: course('course-b') });
  assert.deepEqual(h.counts(), { starts: 0, progressInitializations: 0, navigations: 0, confirmations: 1, completionWrites: 0, externalCalls: 0 });
  h.confirmation?.actions.cancel();
  assert.equal(h.active, existing);
  assert.deepEqual(h.counts(), { starts: 0, progressInitializations: 0, navigations: 0, confirmations: 1, completionWrites: 0, externalCalls: 0 });
});

test('URUNTIMEGUARD01 failure-first: 기존 코스 이어가기는 기존 진행만 한 번 navigation한다', () => {
  const h = startHarness();
  const existing = startActiveVerifiedCourse(session, course('course-a'), () => 'existing', () => ({ stepIndex: 2, routeOpened: true, finished: false }));
  h.active = existing;
  h.controller.request(existing, { session, course: course('course-b') });
  h.confirmation?.actions.continueExisting();
  h.confirmation?.actions.continueExisting();
  assert.equal(h.active, existing);
  assert.equal(h.navigated[0], existing);
  assert.deepEqual(h.counts(), { starts: 0, progressInitializations: 0, navigations: 1, confirmations: 1, completionWrites: 0, externalCalls: 0 });
});

test('URUNTIMEGUARD01 failure-first: 새 코스로 시작은 완료 처리 없이 새 progress를 한 번만 만든다', () => {
  const h = startHarness();
  const existing = startActiveVerifiedCourse(session, course('course-a'), () => 'existing');
  h.active = existing;
  h.controller.request(existing, { session, course: course('course-b') });
  h.confirmation?.actions.startNew();
  h.confirmation?.actions.startNew();
  assert.equal(h.active?.course.id, 'course-b');
  assert.deepEqual(h.counts(), { starts: 1, progressInitializations: 1, navigations: 1, confirmations: 1, completionWrites: 0, externalCalls: 0 });
});

test('URUNTIMEGUARD01 failure-first: refocus는 side effect 없이 이전 Alert action을 폐기한다', () => {
  const h = startHarness();
  const existing = startActiveVerifiedCourse(session, course('course-a'), () => 'existing');
  const request = { session, course: course('course-b') };
  h.controller.request(existing, request);
  const staleConfirmation = h.confirmation;
  h.controller.reset();
  staleConfirmation?.actions.startNew();
  assert.deepEqual(h.counts(), { starts: 0, progressInitializations: 0, navigations: 0, confirmations: 1, completionWrites: 0, externalCalls: 0 });
  h.controller.request(existing, request);
  h.confirmation?.actions.startNew();
  assert.deepEqual(h.counts(), { starts: 1, progressInitializations: 1, navigations: 1, confirmations: 2, completionWrites: 0, externalCalls: 0 });
});

test('URUNTIMEGUARD01: 화면 연결은 정확한 세 행동·destructive·접근성 label만 추가하고 raw session을 유지한다', () => {
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const timeSetup = fs.readFileSync('src/ui/TimeSetupScreen.tsx', 'utf8');
  assert.match(confirm, /진행 중인 코스가 있어요/);
  assert.match(confirm, /새 코스를 시작하면 기존 진행 상태가 종료됩니다\./);
  assert.match(confirm, /style: 'destructive'/);
  assert.match(confirm, /cancelable: false/);
  for (const label of ['취소', '기존 코스 이어가기', '새 코스로 시작', 'accessibilityLabel="코스 시작하기"']) assert.match(confirm, new RegExp(label));
  assert.match(timeSetup, /session: authSession/);
  assert.match(timeSetup, /hasSession: Boolean\(authSession\)/);
  assert.doesNotMatch(confirm, /ActivityKit|Haptics/);
});
