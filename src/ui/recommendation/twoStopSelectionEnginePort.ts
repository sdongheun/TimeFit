import {
  beginReleaseTwoStopSelectionV1,
  continueReleaseTwoStopSelectionV1,
  type ReleaseTwoStopAttemptLedger,
  type ReleaseTwoStopProgressEvent,
  type ReleaseTwoStopSelectionContinuation,
  type ReleaseTwoStopSelectionInput,
  type ReleaseTwoStopSelectionResult,
} from '../../engine';
import type {
  JsonValue,
  TwoStopProgressEvent,
  TwoStopSelectionPageState,
  TwoStopSelectionPort,
  TwoStopSelectionPortResult,
} from './twoStopSelectionModel';

export type TwoStopSelectionEngineContext = Omit<
  ReleaseTwoStopSelectionInput,
  'firstCourse' | 'ledger' | 'requestId' | 'onProgress' | 'signal' | 'reuse'
> & Readonly<{
  ledger: ReleaseTwoStopAttemptLedger;
  ledgerStore?: Readonly<{
    read(): ReleaseTwoStopAttemptLedger;
    commit(next: ReleaseTwoStopAttemptLedger): void;
  }>;
  onCompletedExact?(result: ReleaseTwoStopSelectionResult): void;
}>;

/**
 * UI가 엔진 input이나 runtime 객체를 navigation에 넣지 않도록 session-scoped context를
 * closure에 보관한다. ledger는 취소 뒤에도 되돌리지 않고 같은 port 수명 동안 이어 쓴다.
 */
export function createTwoStopSelectionEnginePort(context: TwoStopSelectionEngineContext): TwoStopSelectionPort {
  let ledger = context.ledger;
  const { ledgerStore, onCompletedExact, ...engineContext } = context;
  const readLedger = () => ledgerStore?.read() ?? ledger;
  const commitLedger = (next: ReleaseTwoStopAttemptLedger) => {
    ledger = next;
    ledgerStore?.commit(next);
  };
  const reuseByFirstPlace = new Map<string, Readonly<{
    courses: readonly ReleaseTwoStopSelectionResult['courses'][number][];
    continuation: ReleaseTwoStopSelectionContinuation;
  }>>();
  const createLedgerTracker = (base: ReleaseTwoStopAttemptLedger) => {
    let appliedAutomatic = 0;
    let appliedShared = 0;
    return (next: ReleaseTwoStopAttemptLedger) => {
      const automatic = Math.max(0, next.automaticTwoStopAttempts - base.automaticTwoStopAttempts);
      const shared = Math.max(0, next.sharedExpansionAttempts - base.sharedExpansionAttempts);
      const automaticDelta = Math.max(0, automatic - appliedAutomatic);
      const sharedDelta = Math.max(0, shared - appliedShared);
      appliedAutomatic += automaticDelta;
      appliedShared += sharedDelta;
      if (!automaticDelta && !sharedDelta) return;
      const latest = readLedger();
      const automaticTwoStopAttempts = latest.automaticTwoStopAttempts + automaticDelta;
      const sharedExpansionAttempts = latest.sharedExpansionAttempts + sharedDelta;
      commitLedger({
        ...latest,
        automaticTwoStopAttempts,
        sharedExpansionAttempts,
        totalNewProviderAttempts: latest.initialOneStopAttempts + automaticTwoStopAttempts + sharedExpansionAttempts,
      });
    };
  };

  return {
    async begin({ firstCourse, verifiedOneStopCourses, recommendationSessionToken, verifiedPairCourses, requestId, onProgress, signal }) {
      const firstPlaceId = firstCourse.placeIds[0] ?? '';
      const reuse = reuseByFirstPlace.get(firstPlaceId);
      const inputLedger = readLedger();
      const trackLedger = createLedgerTracker(inputLedger);
      const result = await beginReleaseTwoStopSelectionV1({
        ...engineContext,
        firstCourse,
        verifiedOneStopCourses,
        recommendationSessionToken,
        verifiedPairCourses,
        ledger: inputLedger,
        requestId,
        signal,
        ...(reuse ? { reuse } : {}),
        onProgress: (event) => {
          trackLedger(event.ledger);
          onProgress(normalizeProgress(event));
        },
      });
      trackLedger(result.ledger);
      if (canStoreCompletedExactResult(result, requestId, firstPlaceId, signal.aborted)) onCompletedExact?.(result);
      storeReusableResult(reuseByFirstPlace, firstPlaceId, requestId, [], result, signal);
      return normalizeTwoStopSelectionEngineResult(result, 'automatic');
    },
    async continue({ firstCourse, verifiedOneStopCourses, recommendationSessionToken, verifiedPairCourses, continuation, requestId, onProgress, signal }) {
      const engineContinuation = parseContinuation(continuation);
      if (!engineContinuation) {
        return {
          requestId,
          firstPlaceId: firstCourse.placeIds[0] ?? '',
          courses: [],
          pageState: 'continuation_unavailable',
          reason: 'continuation_unavailable',
        };
      }
      const inputLedger = readLedger();
      const trackLedger = createLedgerTracker(inputLedger);
      const result = await continueReleaseTwoStopSelectionV1({
        ...engineContext,
        firstCourse,
        verifiedOneStopCourses,
        recommendationSessionToken,
        verifiedPairCourses,
        ledger: inputLedger,
        continuation: engineContinuation,
        requestId,
        signal,
        onProgress: (event) => {
          trackLedger(event.ledger);
          onProgress(normalizeProgress(event));
        },
      });
      trackLedger(result.ledger);
      if (canStoreCompletedExactResult(result, requestId, firstCourse.placeIds[0] ?? '', signal.aborted)) onCompletedExact?.(result);
      storeReusableResult(
        reuseByFirstPlace,
        firstCourse.placeIds[0] ?? '',
        requestId,
        reuseByFirstPlace.get(firstCourse.placeIds[0] ?? '')?.courses ?? [],
        result,
        signal,
      );
      return normalizeTwoStopSelectionEngineResult(result, 'shared');
    },
  };
}

/** same-A reuse와 unordered pair store가 동일한 완료 결과만 신뢰하게 하는 순수 저장 자격 판정이다. */
export function canStoreCompletedExactResult(
  result: ReleaseTwoStopSelectionResult,
  requestId: string,
  firstPlaceId: string,
  aborted: boolean,
): boolean {
  return Boolean(firstPlaceId)
    && !aborted
    && result.requestId === requestId
    && result.firstPlaceId === firstPlaceId
    && result.continuation.firstPlaceId === firstPlaceId
    && result.courses.length > 0
    && result.state !== 'unavailable'
    && result.state !== 'continuation_unavailable'
    && !result.reasons.some((reason) => reason === 'provider_unavailable'
      || reason === 'store_unavailable'
      || reason === 'continuation_unavailable');
}

function storeReusableResult(
  store: Map<string, Readonly<{ courses: readonly ReleaseTwoStopSelectionResult['courses'][number][]; continuation: ReleaseTwoStopSelectionContinuation }>>,
  firstPlaceId: string,
  requestId: string,
  existingCourses: readonly ReleaseTwoStopSelectionResult['courses'][number][],
  result: ReleaseTwoStopSelectionResult,
  signal: AbortSignal,
): void {
  if (!canStoreCompletedExactResult(result, requestId, firstPlaceId, signal.aborted)) return;
  const courses = mergeReusableCourses(existingCourses, result.courses, firstPlaceId);
  if (courses.length !== result.continuation.verifiedCount) return;
  store.set(firstPlaceId, { courses, continuation: result.continuation });
}

function mergeReusableCourses(
  existing: readonly ReleaseTwoStopSelectionResult['courses'][number][],
  incoming: readonly ReleaseTwoStopSelectionResult['courses'][number][],
  firstPlaceId: string,
): readonly ReleaseTwoStopSelectionResult['courses'][number][] {
  const courses = [...existing];
  const secondIds = new Set(courses.map((course) => secondPlaceId(course, firstPlaceId)).filter((id): id is string => Boolean(id)));
  for (const course of incoming) {
    const secondId = secondPlaceId(course, firstPlaceId);
    if (!secondId || secondIds.has(secondId) || courses.length >= 6) continue;
    secondIds.add(secondId);
    courses.push(course);
  }
  return courses;
}

function secondPlaceId(course: ReleaseTwoStopSelectionResult['courses'][number], firstPlaceId: string): string | null {
  if (course.placeIds.length !== 2 || course.placeIds.filter((id) => id === firstPlaceId).length !== 1) return null;
  return course.placeIds.find((id) => id !== firstPlaceId) ?? null;
}

function normalizeProgress(event: ReleaseTwoStopProgressEvent): TwoStopProgressEvent {
  if (event.type === 'candidate_verified') {
    return { type: event.type, requestId: event.requestId, firstPlaceId: event.firstPlaceId, course: event.course };
  }
  if (event.type === 'candidate_rejected') {
    return { type: event.type, requestId: event.requestId, firstPlaceId: event.firstPlaceId, reason: event.reason };
  }
  if (event.type === 'completed') {
    return {
      type: event.type,
      requestId: event.requestId,
      firstPlaceId: event.firstPlaceId,
      pageState: normalizePageState(event.state, event.continuation),
    };
  }
  return { type: event.type, requestId: event.requestId, firstPlaceId: event.firstPlaceId };
}

export function normalizeTwoStopSelectionEngineResult(
  result: ReleaseTwoStopSelectionResult,
  stage: 'automatic' | 'shared',
): TwoStopSelectionPortResult {
  const reason = displayReason(result, stage);
  return {
    requestId: result.requestId,
    firstPlaceId: result.firstPlaceId,
    courses: result.courses,
    pageState: normalizePageState(result.state, result.continuation),
    continuation: toJsonValue(result.continuation),
    ...(reason ? { reason } : {}),
  };
}

function displayReason(
  result: ReleaseTwoStopSelectionResult,
  stage: 'automatic' | 'shared',
): TwoStopSelectionPortResult['reason'] {
  const reasons = [...result.reasons, result.continuation.stopReason].filter((reason): reason is NonNullable<typeof reason> => Boolean(reason));
  const terminal = reasons.find((reason) => reason === 'provider_unavailable'
    || reason === 'store_unavailable'
    || reason === 'continuation_unavailable');
  if (terminal) return terminal;
  if (result.continuation.verifiedCount >= 6) return undefined;
  if (stage === 'shared' && result.ledger.sharedExpansionAttempts >= 12 && reasons.includes('attempt_limit_reached')) {
    return 'attempt_limit_reached';
  }
  if (result.courses.length >= 3) return undefined;
  return reasons.find((reason) => reason !== 'attempt_limit_reached');
}

function normalizePageState(
  state: ReleaseTwoStopSelectionResult['state'],
  continuation: ReleaseTwoStopSelectionContinuation,
): TwoStopSelectionPageState {
  if (state === 'unavailable') return 'unavailable';
  if (state === 'continuation_unavailable') return 'continuation_unavailable';
  if (state === 'exhausted') return 'exhausted';
  // 0개여도 후보 cursor와 공유 확장 budget이 남은 엔진 continuation이면 더 볼 수 있다.
  if (!continuation.stopReason && continuation.cursor < continuation.orderedCandidateIds.length) return 'more_available';
  return state === 'no_candidate' ? 'no_candidate' : 'exhausted';
}

function toJsonValue(value: ReleaseTwoStopSelectionContinuation): JsonValue {
  return value as unknown as JsonValue;
}

function parseContinuation(value: JsonValue): ReleaseTwoStopSelectionContinuation | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const record = value as Readonly<Record<string, JsonValue>>;
  const arrays = [
    record.orderedCandidateIds,
    record.attemptedPairSignatures,
    record.rejectedPairSignatures,
    record.verifiedPairSignatures,
    record.routeReceiptKeys,
  ];
  if (record.version !== 1 || typeof record.firstPlaceId !== 'string'
    || typeof record.cursor !== 'number' || typeof record.verifiedCount !== 'number'
    || arrays.some((item) => !Array.isArray(item) || item.some((entry) => typeof entry !== 'string'))
    || !record.ledger || Array.isArray(record.ledger) || typeof record.ledger !== 'object') return null;
  return value as unknown as ReleaseTwoStopSelectionContinuation;
}
