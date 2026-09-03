import type { VerifiedCourseV1 } from '../../engine';
import { getPlaceActivityLabel } from './courseV1DiscoveryContext';
import type { CourseV1CatalogDisplayPlace } from './courseV1CardDetailModel';

export type TwoStopSelectionReason =
  | 'no_nearby_second_candidate'
  | 'insufficient_time_for_two_stops'
  | 'second_place_closed'
  | 'no_exact_route'
  | 'provider_unavailable'
  | 'store_unavailable'
  | 'attempt_limit_reached'
  | 'continuation_unavailable';
export type TwoStopSelectionPageState = 'more_available' | 'exhausted' | 'no_candidate' | 'unavailable' | 'continuation_unavailable';
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type TwoStopSelectionSnapshot = Readonly<{
  courses: readonly VerifiedCourseV1[];
  singleContinuation: JsonValue;
  singlePageState: string | null;
  scrollOffset: number;
  focusedCourseId?: string;
}>;

export type TwoStopProgressEvent =
  | Readonly<{ type: 'started'; requestId: string; firstPlaceId: string }>
  | Readonly<{ type: 'candidate_verified'; requestId: string; firstPlaceId: string; course: VerifiedCourseV1 }>
  | Readonly<{ type: 'candidate_rejected'; requestId: string; firstPlaceId: string; reason: TwoStopSelectionReason }>
  | Readonly<{ type: 'completed'; requestId: string; firstPlaceId: string; pageState: TwoStopSelectionPageState; reason?: TwoStopSelectionReason }>;

export type TwoStopSelectionPortResult = Readonly<{
  requestId: string;
  firstPlaceId: string;
  courses: readonly VerifiedCourseV1[];
  pageState: TwoStopSelectionPageState;
  continuation?: JsonValue;
  reason?: TwoStopSelectionReason;
}>;
export type TwoStopSelectionPort = Readonly<{
  begin(input: Readonly<{
    firstCourse: VerifiedCourseV1;
    requestId: string;
    onProgress(event: TwoStopProgressEvent): void;
    signal: AbortSignal;
  }>): Promise<TwoStopSelectionPortResult>;
  continue(input: Readonly<{
    firstCourse: VerifiedCourseV1;
    continuation: JsonValue;
    requestId: string;
    onProgress(event: TwoStopProgressEvent): void;
    signal: AbortSignal;
  }>): Promise<TwoStopSelectionPortResult>;
}>;

export type TwoStopSelectionState = Readonly<{
  firstCourse: VerifiedCourseV1;
  firstPlaceId: string;
  requestId: string;
  courses: readonly VerifiedCourseV1[];
  loading: boolean;
  pageState: TwoStopSelectionPageState | null;
  continuation?: JsonValue;
  reason?: TwoStopSelectionReason;
  snapshot: TwoStopSelectionSnapshot;
}>;
export type TwoStopSelectionControllerState = Readonly<{ selection: TwoStopSelectionState | null }>;

export type TwoStopCandidateCard = Readonly<{
  placeId: string;
  title: string;
  activityLabel: string;
  place: CourseV1CatalogDisplayPlace;
  courseMin: number;
  course: VerifiedCourseV1;
  accessibilityLabel: string;
}>;

export function twoStopSelectionReasonMessage(reason: TwoStopSelectionReason): string {
  switch (reason) {
    case 'no_nearby_second_candidate': return '근처에서 함께 갈 수 있는 장소가 부족해요';
    case 'insufficient_time_for_two_stops': return '남은 시간 안에 두 곳을 안전하게 연결하기 어려워요';
    case 'second_place_closed': return '이용 가능한 시간이 맞지 않아요';
    case 'no_exact_route': return '실제 경로를 확인하지 못했어요';
    case 'provider_unavailable':
    case 'store_unavailable': return '경로 확인이 잠시 어려워요';
    case 'attempt_limit_reached': return '이번 추천의 추가 확인 횟수를 모두 사용했어요';
    case 'continuation_unavailable': return '이 결과에서는 더 확인할 수 없어요';
  }
}

export function canOfferTwoStopSelection(course: VerifiedCourseV1, port: TwoStopSelectionPort | null | undefined): boolean {
  return Boolean(port)
    && course.placeIds.length === 1
    && course.stops.length === 1
    && course.legs.length === 2
    && course.stops[0]?.placeId === course.placeIds[0]
    && course.legs[0]?.toId === course.placeIds[0]
    && course.legs[1]?.fromId === course.placeIds[0];
}

export function buildTwoStopCandidateCard(
  course: VerifiedCourseV1,
  firstPlaceId: string,
  getPlace: (placeId: string) => CourseV1CatalogDisplayPlace | undefined,
): TwoStopCandidateCard | null {
  if (course.placeIds.length !== 2 || course.stops.length !== 2 || course.legs.length !== 3) return null;
  if (course.placeIds.filter((id) => id === firstPlaceId).length !== 1) return null;
  const placeId = course.placeIds.find((id) => id !== firstPlaceId);
  if (!placeId) return null;
  const place = getPlace(placeId);
  const activityLabel = getPlaceActivityLabel(place);
  if (!place?.title?.trim() || !activityLabel) return null;
  const courseMin = course.travelMin + course.stayMin;
  return {
    placeId,
    title: place.title,
    activityLabel,
    place,
    courseMin,
    course,
    accessibilityLabel: `선택한 장소와 함께 가능한 곳, ${place.title}, ${activityLabel}, 약 ${courseMin}분 코스`,
  };
}

export function createTwoStopSelectionController(port: TwoStopSelectionPort) {
  let state: TwoStopSelectionControllerState = { selection: null };
  let epoch = 0;
  let page = 0;
  let abortController: AbortController | null = null;
  let continueLocked = false;
  const listeners = new Set<(next: TwoStopSelectionControllerState) => void>();
  const emit = () => listeners.forEach((listener) => listener(state));
  const update = (selection: TwoStopSelectionState | null) => { state = { selection }; emit(); };

  const matches = (requestId: string, firstPlaceId: string) => state.selection?.requestId === requestId
    && state.selection.firstPlaceId === firstPlaceId;
  const append = (current: readonly VerifiedCourseV1[], incoming: readonly VerifiedCourseV1[], firstPlaceId: string) => {
    const next = [...current];
    const seen = new Set(next.map((course) => secondPlaceId(course, firstPlaceId)).filter((id): id is string => Boolean(id)));
    for (const course of incoming) {
      const candidateId = secondPlaceId(course, firstPlaceId);
      if (!candidateId || seen.has(candidateId) || next.length >= 6) continue;
      seen.add(candidateId);
      next.push(course);
    }
    return next;
  };

  const acceptProgress = (event: TwoStopProgressEvent) => {
    const current = state.selection;
    if (!current || !matches(event.requestId, event.firstPlaceId)) return;
    if (event.type === 'candidate_verified') {
      update({ ...current, courses: append(current.courses, [event.course], current.firstPlaceId) });
    } else if (event.type === 'completed') {
      // candidate rejection/completed reason은 관찰값이다. 사용자 사유는 최종 result에서만 정규화한다.
      update({ ...current, loading: false, pageState: event.pageState });
    }
  };

  const acceptResult = (result: TwoStopSelectionPortResult) => {
    const current = state.selection;
    if (!current || !matches(result.requestId, result.firstPlaceId)) return;
    const courses = append(current.courses, result.courses, current.firstPlaceId);
    update({
      ...current,
      courses,
      loading: false,
      pageState: result.pageState,
      reason: normalizeDisplayReason(result.reason, courses.length),
      ...(result.continuation !== undefined ? { continuation: result.continuation } : {}),
    });
  };

  return {
    getState: () => state,
    subscribe(listener: (next: TwoStopSelectionControllerState) => void) { listeners.add(listener); return () => listeners.delete(listener); },
    acceptProgress,
    async begin(firstCourse: VerifiedCourseV1, snapshot: TwoStopSelectionSnapshot) {
      const firstPlaceId = firstCourse.placeIds.length === 1 ? firstCourse.placeIds[0] : '';
      abortController?.abort();
      abortController = new AbortController();
      continueLocked = false;
      const requestId = `two-stop-ui-${++epoch}`;
      update({ firstCourse, firstPlaceId, requestId, courses: [], loading: true, pageState: null, snapshot });
      if (!firstPlaceId) {
        update({ ...state.selection!, loading: false, pageState: 'unavailable', reason: 'continuation_unavailable' });
        return;
      }
      try {
        acceptResult(await port.begin({ firstCourse, requestId, onProgress: acceptProgress, signal: abortController.signal }));
      } catch {
        if (matches(requestId, firstPlaceId)) update({ ...state.selection!, loading: false, pageState: 'unavailable', reason: 'provider_unavailable' });
      }
    },
    async continue() {
      const current = state.selection;
      if (!current || continueLocked || current.loading || current.pageState !== 'more_available' || current.continuation === undefined) return;
      continueLocked = true;
      abortController = new AbortController();
      const requestId = `two-stop-ui-${epoch}-page-${++page}`;
      update({ ...current, requestId, loading: true, reason: undefined });
      try {
        acceptResult(await port.continue({ firstCourse: current.firstCourse, continuation: current.continuation, requestId, onProgress: acceptProgress, signal: abortController.signal }));
      } catch {
        if (matches(requestId, current.firstPlaceId)) update({ ...state.selection!, loading: false, pageState: 'unavailable', reason: 'provider_unavailable' });
      } finally {
        continueLocked = false;
      }
    },
    cancel(): TwoStopSelectionSnapshot | null {
      const snapshot = state.selection?.snapshot ?? null;
      epoch += 1;
      abortController?.abort();
      abortController = null;
      continueLocked = false;
      update(null);
      return snapshot;
    },
  };
}

function normalizeDisplayReason(
  reason: TwoStopSelectionReason | undefined,
  totalDisplayedCount: number,
): TwoStopSelectionReason | undefined {
  if (!reason) return undefined;
  if (reason === 'provider_unavailable' || reason === 'store_unavailable' || reason === 'continuation_unavailable') return reason;
  if (reason === 'attempt_limit_reached') return totalDisplayedCount >= 6 ? undefined : reason;
  if (totalDisplayedCount >= 3) return undefined;
  return reason;
}

function secondPlaceId(course: VerifiedCourseV1, firstPlaceId: string): string | null {
  if (course.placeIds.length !== 2 || course.placeIds.filter((id) => id === firstPlaceId).length !== 1) return null;
  return course.placeIds.find((id) => id !== firstPlaceId) ?? null;
}
