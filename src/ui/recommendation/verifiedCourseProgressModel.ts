import type { CourseV1TravelMode, VerifiedCourseV1 } from '../../engine';

export type VerifiedCourseProgressPoint = Readonly<{ id: string; label: string; lat: number; lon: number }>;
export type VerifiedCourseProgressStep =
  | Readonly<{ kind: 'travel'; key: string; from: VerifiedCourseProgressPoint; target: VerifiedCourseProgressPoint; mode: CourseV1TravelMode; min: number; scheduledArrivalAt?: string; isFinal: boolean }>
  | Readonly<{ kind: 'stay'; key: string; target: VerifiedCourseProgressPoint; stayMin: number; stayState?: 'recommended' | 'short'; arrivalAt: string; departureAt: string }>;

export type VerifiedCourseProgressState = Readonly<{ stepIndex: number; routeOpened: boolean; finished: boolean }>;

/** 검증된 legs/stops와 장소 좌표가 정확히 맞을 때만 화면용 순서를 만든다. 시간·체류를 재계산하지 않는다. */
export function buildVerifiedCourseProgressSteps(
  course: VerifiedCourseV1,
  origin: VerifiedCourseProgressPoint,
  target: VerifiedCourseProgressPoint,
  resolvePlace: (id: string) => VerifiedCourseProgressPoint | undefined,
): readonly VerifiedCourseProgressStep[] | null {
  if (course.legs.length !== course.stops.length + 1 || course.stops.length !== course.placeIds.length) return null;
  const steps: VerifiedCourseProgressStep[] = [];
  for (let index = 0; index < course.stops.length; index += 1) {
    const place = resolvePlace(course.placeIds[index]);
    const leg = course.legs[index];
    const stop = course.stops[index];
    const fromId = index === 0 ? origin.id : course.placeIds[index - 1];
    const from = index === 0 ? origin : resolvePlace(fromId);
    if (!place || !from || !leg || leg.fromId !== from.id || leg.toId !== place.id || stop.placeId !== place.id) return null;
    steps.push({ kind: 'travel', key: `travel-${index}-${leg.fromId}-${leg.toId}`, from, target: place, mode: leg.mode, min: leg.min, scheduledArrivalAt: stop.arrivalAt, isFinal: false });
    steps.push({ kind: 'stay', key: `stay-${index}-${stop.placeId}`, target: place, stayMin: stop.stayMin, stayState: stop.stayState, arrivalAt: stop.arrivalAt, departureAt: stop.departureAt });
  }
  const lastLeg = course.legs.at(-1);
  if (!lastLeg || lastLeg.fromId !== course.placeIds.at(-1) || lastLeg.toId !== target.id) return null;
  const finalFrom = resolvePlace(lastLeg.fromId);
  if (!finalFrom) return null;
  steps.push({ kind: 'travel', key: `travel-final-${lastLeg.fromId}-${lastLeg.toId}`, from: finalFrom, target, mode: lastLeg.mode, min: lastLeg.min, isFinal: true });
  return steps;
}

export function initialVerifiedCourseProgressState(): VerifiedCourseProgressState {
  return { stepIndex: 0, routeOpened: false, finished: false };
}

export function verifiedCourseNextRouteLabel(isFinal: boolean, hasDestination: boolean): string {
  if (!isFinal) return '다음 장소 길찾기';
  return hasDestination ? '도착지 길찾기' : '복귀 길찾기';
}

/** 길찾기를 열었다는 명시 행동 전에는 이동 단계를 넘기지 않는다. 단계 건너뛰기·중복 완료는 fail-closed다. */
export function advanceVerifiedCourseProgress(
  steps: readonly VerifiedCourseProgressStep[],
  state: VerifiedCourseProgressState,
): VerifiedCourseProgressState {
  const current = steps[state.stepIndex];
  if (state.finished || !current || (current.kind === 'travel' && !state.routeOpened)) return state;
  if (current.kind === 'travel' && current.isFinal) return { ...state, finished: true };
  return { stepIndex: state.stepIndex + 1, routeOpened: false, finished: false };
}

export function markVerifiedCourseRouteOpened(
  steps: readonly VerifiedCourseProgressStep[],
  state: VerifiedCourseProgressState,
): VerifiedCourseProgressState {
  const current = steps[state.stepIndex];
  if (state.finished || !current || current.kind !== 'travel' || state.routeOpened) return state;
  return { ...state, routeOpened: true };
}

/** 체류 중 CTA는 다음 travel의 외부 길찾기가 성공한 뒤에만 그 travel 단계로 전이한다. */
export function nextVerifiedCourseTravel(
  steps: readonly VerifiedCourseProgressStep[],
  state: VerifiedCourseProgressState,
): Extract<VerifiedCourseProgressStep, { kind: 'travel' }> | null {
  const current = steps[state.stepIndex];
  const next = steps[state.stepIndex + 1];
  return !state.finished && current?.kind === 'stay' && next?.kind === 'travel' ? next : null;
}

export async function requestNextVerifiedCourseRoute(
  steps: readonly VerifiedCourseProgressStep[],
  state: VerifiedCourseProgressState,
  openRoute: (travel: Extract<VerifiedCourseProgressStep, { kind: 'travel' }>) => Promise<boolean>,
): Promise<Readonly<{ state: VerifiedCourseProgressState; result: 'opened' | 'failed' | 'unavailable' }>> {
  const next = nextVerifiedCourseTravel(steps, state);
  if (!next) return { state, result: 'unavailable' };
  try {
    if (!await openRoute(next)) return { state, result: 'failed' };
    return { state: { stepIndex: state.stepIndex + 1, routeOpened: true, finished: false }, result: 'opened' };
  } catch {
    return { state, result: 'failed' };
  }
}

/** React state 반영 전 중복 tap도 막는 화면 메모리 lock이다. */
export function createVerifiedCourseRouteOpenLock() {
  let owner: number | null = null;
  let nextOwner = 0;
  return {
    tryLock() {
      if (owner !== null) return null;
      const token = ++nextOwner;
      owner = token;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (owner === token) owner = null;
      };
    },
    // 외부 앱에서 복귀하면 이전 JS continuation의 lock 소유권만 폐기한다.
    // 이전 finally가 늦게 실행돼도 새 시도의 token은 해제할 수 없다.
    resetForExternalReturn() { owner = null; },
  };
}
