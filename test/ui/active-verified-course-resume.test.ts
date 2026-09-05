import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import type { VerifiedCourseV1 } from '../../src/engine';
import type { RecommendationSession, RootStackParamList } from '../../src/ui/nav';
import {
  clearActiveVerifiedCourse,
  createActiveVerifiedCourseFinishLock,
  createActiveVerifiedCourseIdentityFactory,
  createActiveVerifiedCourseStartLock,
  homeActiveCourseProjection,
  matchesActiveVerifiedCourse,
  startActiveVerifiedCourse,
  updateActiveVerifiedCourse,
} from '../../src/ui/activeVerifiedCourseModel';
import {
  advanceVerifiedCourseProgress,
  buildVerifiedCourseProgressSteps,
  initialVerifiedCourseProgressState,
  markVerifiedCourseRouteOpened,
  requestNextVerifiedCourseRoute,
} from '../../src/ui/recommendation/verifiedCourseProgressModel';

const session: RecommendationSession = {
  nowIso: '2026-09-05T06:00:00.000Z',
  origin: { id: 'origin', label: '출발지', lat: 35.15, lon: 129.05 },
  destination: { id: 'destination', label: '약속 장소', lat: 35.16, lon: 129.06 },
  remainingMin: 90,
  arrivalBufferMin: 10,
};

function course(id = 'course-a', placeId = 'place-a'): VerifiedCourseV1 {
  return {
    id,
    placeIds: [placeId],
    stops: [{ placeId, stayMin: 30, stayState: 'recommended', availabilityState: 'structured_verified', arrivalAt: '2026-09-05T06:10:00.000Z', departureAt: '2026-09-05T06:40:00.000Z' }],
    legs: [
      { fromId: 'origin', toId: placeId, mode: 'walk', min: 10 },
      { fromId: placeId, toId: 'destination', mode: 'transit', min: 20 },
    ],
    stayMin: 30,
    travelMin: 30,
    totalMin: 60,
    arrivalBufferMin: 10,
    remainingAfterCourseMin: 30,
    remainingAfterArrivalBufferMin: 20,
  };
}

const legacy = { course: { spots: [{ title: '기존 코스' }] } } as RootStackParamList['Execution'];
const resolveTitle = (id: string) => id === 'place-a' ? '부산시민공원' : id === 'place-b' ? '송상현광장' : undefined;

test('UPROGRESSRESUME01 failure-first: V1 시작 뒤 Home은 placeholder가 아니라 verified 이어가기를 투영한다', () => {
  const active = startActiveVerifiedCourse(session, course(), () => 'v1-1');
  const home = homeActiveCourseProjection(active, null, resolveTitle);
  assert.equal(home.kind, 'verified');
  if (home.kind === 'verified') {
    assert.equal(home.title, '부산시민공원');
    assert.equal(home.target, 'CourseConfirm');
    assert.equal(home.params.activeId, active.identity);
  }
});

test('UPROGRESSRESUME01 failure-first: 진행 2단계는 Home 왕복 뒤 초기화되지 않는다', () => {
  const active = startActiveVerifiedCourse(session, course(), () => 'v1-1');
  const progressed = updateActiveVerifiedCourse(active, active.identity, () => ({ stepIndex: 2, routeOpened: true, finished: false }));
  const home = homeActiveCourseProjection(progressed, null, resolveTitle);
  assert.equal(home.kind, 'verified');
  if (home.kind === 'verified') assert.deepEqual(home.progress, { stepIndex: 2, routeOpened: true, finished: false });
});

test('UPROGRESSRESUME01: 로그인·비로그인은 같은 V1 runtime과 Home 표시를 사용한다', () => {
  const project = (_login: object | null) => homeActiveCourseProjection(startActiveVerifiedCourse(session, course(), () => 'same-id'), null, resolveTitle);
  assert.deepEqual(project(null), project({ user: { id: 'login-fixture' } }));
});

test('UPROGRESSRESUME01: legacy 단독은 Execution을 유지하고 V1과 함께면 V1만 우선한다', () => {
  const legacyOnly = homeActiveCourseProjection(null, legacy, resolveTitle);
  assert.equal(legacyOnly.kind, 'legacy');
  if (legacyOnly.kind === 'legacy') assert.equal(legacyOnly.target, 'Execution');
  const active = startActiveVerifiedCourse(session, course(), () => 'v1-1');
  assert.equal(homeActiveCourseProjection(active, legacy, resolveTitle).kind, 'verified');
  assert.equal(legacy.course.spots[0]?.title, '기존 코스');
});

test('UPROGRESSRESUME01: 첫 시작은 initial progress를 한 번만 만들고 새 시작은 한 건으로 교체한다', () => {
  let initialCalls = 0;
  const first = startActiveVerifiedCourse(session, course(), () => 'v1-1', () => { initialCalls += 1; return initialVerifiedCourseProgressState(); });
  const second = startActiveVerifiedCourse(session, course('course-b', 'place-b'), () => 'v1-2', () => { initialCalls += 1; return initialVerifiedCourseProgressState(); });
  assert.equal(initialCalls, 2);
  assert.equal(first.identity, 'v1-1');
  assert.equal(second.identity, 'v1-2');
  assert.equal(second.course.id, 'course-b');
});

test('UPROGRESSRESUME01: route 성공만 routeOpened를 보존하고 실패·invalid·중복은 전이하지 않는다', async () => {
  const item = course();
  const steps = buildVerifiedCourseProgressSteps(item, session.origin, session.destination!, (id) => id === 'place-a' ? { id, label: '부산시민공원', lat: 35.155, lon: 129.055 } : undefined);
  assert.ok(steps);
  const initial = initialVerifiedCourseProgressState();
  assert.equal(markVerifiedCourseRouteOpened([], initial), initial);
  const opened = markVerifiedCourseRouteOpened(steps, initial);
  assert.equal(opened.routeOpened, true);
  assert.equal(markVerifiedCourseRouteOpened(steps, opened), opened);
  const stay = advanceVerifiedCourseProgress(steps, opened);
  const failed = await requestNextVerifiedCourseRoute(steps, stay, async () => false);
  assert.equal(failed.state, stay);
});

test('UPROGRESSRESUME01: stay 다음 route 성공 상태도 Home 왕복 뒤 유지한다', async () => {
  const item = course();
  const steps = buildVerifiedCourseProgressSteps(item, session.origin, session.destination!, (id) => id === 'place-a' ? { id, label: '부산시민공원', lat: 35.155, lon: 129.055 } : undefined);
  assert.ok(steps);
  let progress = advanceVerifiedCourseProgress(steps, markVerifiedCourseRouteOpened(steps, initialVerifiedCourseProgressState()));
  progress = (await requestNextVerifiedCourseRoute(steps, progress, async () => true)).state;
  const active = startActiveVerifiedCourse(session, item, () => 'v1-1');
  const saved = updateActiveVerifiedCourse(active, active.identity, () => progress);
  const home = homeActiveCourseProjection(saved, null, resolveTitle);
  assert.equal(home.kind, 'verified');
  if (home.kind === 'verified') assert.deepEqual(home.progress, progress);
});

test('UPROGRESSRESUME01: navigation·background는 action이 없고 명시 완료만 같은 identity를 한 번 제거한다', () => {
  const active = startActiveVerifiedCourse(session, course(), () => 'v1-1');
  const afterBackBlurAndForeground = active;
  assert.equal(afterBackBlurAndForeground, active);
  assert.equal(clearActiveVerifiedCourse(active, 'other-id'), active);
  const cleared = clearActiveVerifiedCourse(active, active.identity);
  assert.equal(cleared, null);
  assert.equal(clearActiveVerifiedCourse(cleared, active.identity), cleared);
  const finishLock = createActiveVerifiedCourseFinishLock();
  assert.equal(finishLock.tryFinish(), true);
  assert.equal(finishLock.tryFinish(), false);
});

test('UPROGRESSRESUME01: mismatched identity·params는 다른 활성 진행을 덮어쓰지 않는다', () => {
  const active = startActiveVerifiedCourse(session, course(), () => 'v1-1');
  assert.equal(updateActiveVerifiedCourse(active, 'wrong', () => ({ stepIndex: 9, routeOpened: true, finished: true })), active);
  assert.equal(matchesActiveVerifiedCourse(active, active.identity, { ...session }, active.course), false);
  assert.equal(matchesActiveVerifiedCourse(active, active.identity, session, course()), false);
  assert.equal(matchesActiveVerifiedCourse(active, active.identity, session, active.course), true);
});

test('UPROGRESSRESUME01: 빠른 시작 연타는 active 생성과 navigation을 한 번만 허용한다', () => {
  const lock = createActiveVerifiedCourseStartLock();
  assert.equal(lock.tryLock(), true);
  assert.equal(lock.tryLock(), false);
  lock.reset();
  assert.equal(lock.tryLock(), true);
});

test('UPROGRESSRESUME01: identity는 장소명·좌표 대신 프로세스 순번만 사용한다', () => {
  const next = createActiveVerifiedCourseIdentityFactory();
  assert.equal(next(), 'verified-runtime-1');
  assert.equal(next(), 'verified-runtime-2');
  assert.doesNotMatch(next(), /부산|35\.|129\./);
});

test('UPROGRESSRESUME01: pure active 경계는 외부 호출·저장·로그인 분기를 포함하지 않는다', () => {
  const source = fs.readFileSync('src/ui/activeVerifiedCourseModel.ts', 'utf8');
  assert.doesNotMatch(source, /AsyncStorage|Supabase|courseCompletion|fetch\(|Linking|WebBrowser|useAuth|console\./);
});

test('UPROGRESSRESUME01: Home 이어가기 접근성과 26px 간격·일반 tap 무햅틱을 유지한다', () => {
  const active = startActiveVerifiedCourse(session, course(), () => 'v1-1');
  const home = homeActiveCourseProjection(active, null, resolveTitle);
  assert.equal(home.kind, 'verified');
  if (home.kind === 'verified') assert.equal(home.accessibilityLabel, '진행 중인 코스, 부산시민공원, 이어가기');
  const source = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf8');
  assert.match(source, /active: \{ marginTop: 26/);
  assert.doesNotMatch(source, /Haptics|performSelectionHaptic/);
});

test('UPROGRESSRESUME01: 화면 container는 start → verified navigation과 단일 AppFlow progress를 연결한다', () => {
  const appFlow = fs.readFileSync('src/ui/AppFlowContext.tsx', 'utf8');
  const confirm = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf8');
  const home = fs.readFileSync('src/ui/HomeScreen.tsx', 'utf8');
  assert.match(confirm, /flow\.startActiveVerifiedCourse/);
  assert.match(confirm, /mode === 'active'/);
  assert.doesNotMatch(confirm, /navigate\('VerifiedCourseProgress'/);
  assert.match(appFlow, /activeVerifiedCourse/);
  assert.match(confirm, /useActiveVerifiedCourseFlow/);
  assert.match(confirm, /matchesActiveVerifiedCourse/);
  assert.match(confirm, /flow\.updateActiveVerifiedCourse/);
  assert.match(confirm, /flow\.clearActiveVerifiedCourse/);
  assert.match(home, /homeActiveCourseProjection\(activeVerifiedCourse, activeCourse/);
});
