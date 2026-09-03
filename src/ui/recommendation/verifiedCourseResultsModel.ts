import type { CourseV1Continuation, CourseV1ContinuationStopReason, VerifiedCourseV1 } from '../../engine';
import type { ConditionalManualUiResult } from './v1Session';

export type VerifiedCoursePageState = 'more_available' | 'exhausted' | 'provider_unavailable' | 'continuation_unavailable';
export type ConditionalVisitDisplayPlace = Readonly<{ id: string; lat: number; lon: number }>;

export function effectiveContinuationState(continuation: CourseV1Continuation | undefined): VerifiedCoursePageState {
  switch (continuation?.stopReason) {
    case 'candidate_queue_exhausted': return 'exhausted';
    case 'provider_daily_limit':
    case 'provider_unavailable': return 'provider_unavailable';
    case 'continuation_unavailable': return 'continuation_unavailable';
    default: return continuation ? 'more_available' : 'exhausted';
  }
}

export function continuationEndMessage(state: VerifiedCoursePageState): string | null {
  if (state === 'more_available') return null;
  if (state === 'continuation_unavailable') return '이 결과에서는 더 확인할 수 없어요. 다시 추천해 주세요.';
  if (state === 'provider_unavailable') return '지금은 추가 경로를 확인할 수 없어요.';
  return '이 조건에서 다른 검증 코스가 없어요.';
}

function courseSetSignature(course: VerifiedCourseV1): string {
  return [...course.placeIds].sort().join('|');
}

/** 순서만 다른 동일 장소 집합은 막되, A와 A→B 같은 서로 다른 코스는 보존한다. */
export function appendDistinctVerifiedCourses(existing: readonly VerifiedCourseV1[], appended: readonly VerifiedCourseV1[]): VerifiedCourseV1[] {
  const known = new Set(existing.map(courseSetSignature));
  return [...existing, ...appended.filter((course) => {
    const signature = courseSetSignature(course);
    if (known.has(signature)) return false;
    known.add(signature);
    return true;
  })];
}

/** React state 반영 전에도 두 번째 탭을 막는 동기 잠금이다. */
export function createContinuationInFlightLock() {
  let locked = false;
  return {
    tryLock: () => {
      if (locked) return false;
      locked = true;
      return true;
    },
    release: () => { locked = false; },
  };
}

export function createKeyedInFlightLock() {
  const locked = new Set<string>();
  return {
    tryLock: (key: string) => {
      if (locked.has(key)) return false;
      locked.add(key);
      return true;
    },
    release: (key: string) => { locked.delete(key); },
  };
}

export function isConditionalManualConfirmTime(now: Date): boolean {
  return !Number.isNaN(now.getTime()) && now.getHours() >= 10 && now.getHours() < 18;
}

/** 다음 10:00 또는 18:00에만 한 번 갱신한다. 상시 minute polling은 사용하지 않는다. */
export function millisecondsUntilConditionalVisibilityBoundary(now: Date): number {
  const boundary = new Date(now);
  if (now.getHours() < 10) boundary.setHours(10, 0, 0, 0);
  else if (now.getHours() < 18) boundary.setHours(18, 0, 0, 0);
  else { boundary.setDate(boundary.getDate() + 1); boundary.setHours(10, 0, 0, 0); }
  return Math.max(1, boundary.getTime() - now.getTime());
}

export function conditionalManualMessage(reason: 'unavailable' | 'time_budget_exceeded' | 'conditional_candidate_not_eligible' | 'route_not_verified' | 'route_verification_unavailable'): string {
  switch (reason) {
    case 'time_budget_exceeded': return '남은 시간이 부족해요. 다시 추천해 주세요.';
    case 'conditional_candidate_not_eligible': return '이 장소는 조건부 계산을 할 수 없어요.';
    case 'route_not_verified': return '실제 경로를 확인하지 못했어요.';
    case 'route_verification_unavailable':
    case 'unavailable': return '지금은 경로를 확인할 수 없어요. 잠시 후 다시 시도해 주세요.';
  }
}

export type ConditionalManualActionResult =
  | Readonly<{ state: 'after_window' }>
  | Readonly<{ state: 'success'; course: VerifiedCourseV1 }>
  | Readonly<{ state: 'rejected'; reason: Exclude<Extract<ConditionalManualUiResult, { state: 'rejected' }>['reason'], 'conditional_display_window_unavailable'> }>
  | Readonly<{ state: 'unavailable' }>;

/** CTA handler의 시간 gate와 typed 실패 경계. 호출자는 이 함수 전후에만 loading/lock을 관리한다. */
export async function runConditionalManualAction(
  confirmedAt: Date,
  request: () => Promise<ConditionalManualUiResult>,
): Promise<ConditionalManualActionResult> {
  if (!isConditionalManualConfirmTime(confirmedAt)) return { state: 'after_window' };
  try {
    const result = await request();
    if (result.state === 'conditional_manual_course') return { state: 'success', course: result.course };
    if (result.state === 'unavailable') return { state: 'unavailable' };
    if (result.reason === 'conditional_display_window_unavailable') return { state: 'after_window' };
    return { state: 'rejected', reason: result.reason };
  } catch {
    return { state: 'unavailable' };
  }
}

function distanceSquared(from: { lat: number; lon: number }, to: ConditionalVisitDisplayPlace): number {
  const lat = from.lat - to.lat;
  const lon = from.lon - to.lon;
  return lat * lat + lon * lon;
}

/** 조건부 후보는 출발/도착 중 가까운 쪽으로 안정 정렬하고 화면에서만 8개씩 나눈다. */
export function conditionalVisitPage<T extends ConditionalVisitDisplayPlace>(
  candidates: readonly T[],
  session: Readonly<{ nowIso: string; origin: { lat: number; lon: number }; destination: { lat: number; lon: number } | null }>,
  actualNow: Date,
  cursor = 0,
): Readonly<{ places: readonly T[]; nextCursor: number | null }> {
  if (!isConditionalManualConfirmTime(actualNow)) return { places: [], nextCursor: null };
  const anchors = session.destination ? [session.origin, session.destination] : [session.origin];
  const ordered = [...candidates].sort((a, b) => {
    const distanceA = Math.min(...anchors.map((anchor) => distanceSquared(anchor, a)));
    const distanceB = Math.min(...anchors.map((anchor) => distanceSquared(anchor, b)));
    return distanceA - distanceB || a.id.localeCompare(b.id);
  });
  const start = Math.max(0, cursor);
  const places = ordered.slice(start, start + 8);
  return { places, nextCursor: start + places.length < ordered.length ? start + places.length : null };
}
