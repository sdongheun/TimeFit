import type { VerifiedCourseV1 } from '../engine';
import type { RecommendationSession, RootStackParamList } from './nav';
import { initialVerifiedCourseProgressState, type VerifiedCourseProgressState } from './recommendation/verifiedCourseProgressModel';

type LegacyExecution = RootStackParamList['Execution'];

export type ActiveVerifiedCourse = Readonly<{
  identity: string;
  courseRunId: string;
  session: RecommendationSession;
  course: VerifiedCourseV1;
  progress: VerifiedCourseProgressState;
}>;

export type ActiveVerifiedCourseStartRequest = Readonly<{
  session: RecommendationSession;
  course: VerifiedCourseV1;
}>;

export type ActiveVerifiedCourseStartDecision =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'same'; active: ActiveVerifiedCourse }>
  | Readonly<{ kind: 'different'; active: ActiveVerifiedCourse }>;

export type ActiveVerifiedCourseStartConfirmation = Readonly<{
  title: '진행 중인 코스가 있어요';
  message: '새 코스를 시작하면 기존 진행 상태가 종료됩니다.';
  actions: Readonly<{
    cancel: () => void;
    continueExisting: () => void;
    startNew: () => void;
  }>;
}>;

export type HomeActiveCourseProjection =
  | Readonly<{ kind: 'verified'; title: string; accessibilityLabel: string; target: 'CourseConfirm'; params: RootStackParamList['CourseConfirm']; progress: VerifiedCourseProgressState }>
  | Readonly<{ kind: 'legacy'; title: string; accessibilityLabel: string; target: 'Execution'; params: LegacyExecution }>
  | Readonly<{ kind: 'placeholder' }>;

/** 프로세스 메모리 비교에만 쓰는 UI identity다. 장소명·좌표·영속 run ID를 포함하지 않는다. */
export function createActiveVerifiedCourseIdentityFactory() {
  let sequence = 0;
  return () => `verified-runtime-${++sequence}`;
}

/** 표시값·장소·사용자·시각을 섞지 않은 opaque UUID를 active run ID로 감싼다. */
export function createOpaqueCourseRunIdFactory(createUuid: () => string = () => {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error('secure random UUID unavailable');
  return value;
}) {
  return () => {
    const value = createUuid();
    if (!value || typeof value !== 'string') throw new Error('invalid random UUID');
    return `course-run-${value}`;
  };
}

export function startActiveVerifiedCourse(
  session: RecommendationSession,
  course: VerifiedCourseV1,
  createIdentity: () => string,
  createProgress: () => VerifiedCourseProgressState = initialVerifiedCourseProgressState,
  createCourseRunId: () => string = createOpaqueCourseRunIdFactory(),
): ActiveVerifiedCourse {
  return { identity: createIdentity(), courseRunId: createCourseRunId(), session, course, progress: createProgress() };
}

export function updateActiveVerifiedCourse(
  active: ActiveVerifiedCourse | null,
  identity: string,
  update: (progress: VerifiedCourseProgressState) => VerifiedCourseProgressState,
): ActiveVerifiedCourse | null {
  if (!active || active.identity !== identity) return active;
  const progress = update(active.progress);
  return progress === active.progress ? active : { ...active, progress };
}

export function clearActiveVerifiedCourse(active: ActiveVerifiedCourse | null, identity: string): ActiveVerifiedCourse | null {
  return active?.identity === identity ? null : active;
}

/** Route params가 현재 runtime의 원본 snapshot과 같은 경우에만 진행 상태를 제공한다. */
export function matchesActiveVerifiedCourse(
  active: ActiveVerifiedCourse | null,
  identity: string,
  session: RecommendationSession,
  course: VerifiedCourseV1,
): active is ActiveVerifiedCourse {
  return Boolean(active && active.identity === identity && active.session === session && active.course === course);
}

/** 같은 course id라도 추천 입력 또는 원본 snapshot 객체가 다르면 별도 시작 요청이다. */
export function activeVerifiedCourseStartDecision(
  active: ActiveVerifiedCourse | null,
  request: ActiveVerifiedCourseStartRequest,
): ActiveVerifiedCourseStartDecision {
  if (!active) return { kind: 'none' };
  if (active.session === request.session && active.course === request.course) return { kind: 'same', active };
  return { kind: 'different', active };
}

/** Alert 표시와 선택 side effect를 한 번으로 직렬화하는 React 비의존 시작 controller다. */
export function createActiveVerifiedCourseStartController(dependencies: Readonly<{
  start: (request: ActiveVerifiedCourseStartRequest) => ActiveVerifiedCourse;
  navigate: (active: ActiveVerifiedCourse) => void;
  confirm: (confirmation: ActiveVerifiedCourseStartConfirmation) => void;
  onError?: () => void;
}>) {
  let locked = false;
  let pendingToken = 0;
  let sequence = 0;

  const run = (effect: () => void) => {
    try {
      effect();
    } catch {
      locked = false;
      pendingToken = 0;
      dependencies.onError?.();
    }
  };
  const startAndNavigate = (request: ActiveVerifiedCourseStartRequest) => {
    const next = dependencies.start(request);
    dependencies.navigate(next);
  };

  return {
    request(active: ActiveVerifiedCourse | null, request: ActiveVerifiedCourseStartRequest) {
      if (locked) return;
      locked = true;
      const decision = activeVerifiedCourseStartDecision(active, request);
      if (decision.kind === 'none') {
        run(() => startAndNavigate(request));
        return;
      }
      if (decision.kind === 'same') {
        run(() => dependencies.navigate(decision.active));
        return;
      }

      const token = ++sequence;
      pendingToken = token;
      const settle = (action: 'cancel' | 'continue' | 'replace') => {
        if (pendingToken !== token) return;
        pendingToken = 0;
        if (action === 'cancel') {
          locked = false;
          return;
        }
        if (action === 'continue') run(() => dependencies.navigate(decision.active));
        else run(() => startAndNavigate(request));
      };
      run(() => dependencies.confirm({
        title: '진행 중인 코스가 있어요',
        message: '새 코스를 시작하면 기존 진행 상태가 종료됩니다.',
        actions: {
          cancel: () => settle('cancel'),
          continueExisting: () => settle('continue'),
          startNew: () => settle('replace'),
        },
      }));
    },
    reset() {
      locked = false;
      pendingToken = 0;
    },
  };
}

export function homeActiveCourseProjection(
  activeVerifiedCourse: ActiveVerifiedCourse | null,
  activeCourse: LegacyExecution | null,
  resolvePlaceTitle: (placeId: string) => string | undefined,
): HomeActiveCourseProjection {
  if (activeVerifiedCourse) {
    const title = activeVerifiedCourse.course.placeIds.map(resolvePlaceTitle).filter((value): value is string => Boolean(value)).join(' · ') || '현재 V1 코스';
    return {
      kind: 'verified',
      title,
      accessibilityLabel: `진행 중인 코스, ${title}, 이어가기`,
      target: 'CourseConfirm',
      params: { session: activeVerifiedCourse.session, course: activeVerifiedCourse.course, activeId: activeVerifiedCourse.identity },
      progress: activeVerifiedCourse.progress,
    };
  }
  if (activeCourse) {
    const title = activeCourse.course.spots[0]?.title ?? '현재 코스';
    return { kind: 'legacy', title, accessibilityLabel: `진행 중인 코스, ${title}, 이어가기`, target: 'Execution', params: activeCourse };
  }
  return { kind: 'placeholder' };
}

/** React state 반영 전 빠른 중복 시작도 한 번으로 제한한다. 화면이 다시 focus되면 reset한다. */
export function createActiveVerifiedCourseStartLock() {
  let locked = false;
  return {
    tryLock: () => { if (locked) return false; locked = true; return true; },
    reset: () => { locked = false; },
  };
}

/** 완료 clear와 최상위 navigation은 빠른 연타에도 이 화면 instance에서 한 번만 실행한다. */
export function createActiveVerifiedCourseFinishLock() {
  let finished = false;
  return { tryFinish: () => { if (finished) return false; finished = true; return true; } };
}
