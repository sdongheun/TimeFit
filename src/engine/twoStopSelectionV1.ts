import {
  COURSE_V1_ADAPTER_CALL_LIMIT,
  type CourseV1Candidate,
  type CourseV1Leg,
  type CourseV1LimitedInput,
  type CourseV1Point,
  type CourseV1RouteReceipt,
  type CourseV1RouteUnavailableReason,
  type VerifiedCourseV1,
  courseV1LegInternal,
  isCourseV1CandidateAvailableInternal,
  normalizeCourseV1ReceiptInternal,
  selectCourseV1StayPlanInternal,
  selectReleaseTwoStopCandidatePoolInternal,
} from './courseV1';

export const RELEASE_TWO_STOP_AUTOMATIC_ATTEMPT_LIMIT = 16;
export const RELEASE_TWO_STOP_SHARED_ATTEMPT_LIMIT = 12;
export const RELEASE_TWO_STOP_SESSION_ATTEMPT_LIMIT = 36;
export const RELEASE_TWO_STOP_INITIAL_TARGET = 3;
export const RELEASE_TWO_STOP_TOTAL_LIMIT = 6;

export type ReleaseTwoStopFailureReason =
  | 'no_nearby_second_candidate'
  | 'insufficient_time_for_two_stops'
  | 'second_place_closed'
  | 'no_exact_route'
  | 'provider_unavailable'
  | 'store_unavailable'
  | 'attempt_limit_reached'
  | 'continuation_unavailable';

export type ReleaseTwoStopAttemptLedger = Readonly<{
  version: 1;
  initialOneStopAttempts: number;
  automaticTwoStopAttempts: number;
  sharedExpansionAttempts: number;
  totalNewProviderAttempts: number;
}>;

export type ReleaseTwoStopSelectionContinuation = Readonly<{
  version: 1;
  firstPlaceId: string;
  cursor: number;
  orderedCandidateIds: readonly string[];
  candidateSetSignature: string;
  inputSignature: string;
  providerSignature: string;
  firstCourseSignature: string;
  attemptedPairSignatures: readonly string[];
  rejectedPairSignatures: readonly string[];
  verifiedPairSignatures: readonly string[];
  routeReceiptKeys: readonly string[];
  verifiedCount: number;
  ledger: ReleaseTwoStopAttemptLedger;
  stopReason?: ReleaseTwoStopFailureReason;
}>;

export type ReleaseTwoStopProgressEvent =
  | Readonly<{ type: 'started'; requestId: string; firstPlaceId: string; ledger: ReleaseTwoStopAttemptLedger }>
  | Readonly<{ type: 'candidate_verified'; requestId: string; firstPlaceId: string; course: VerifiedCourseV1; ledger: ReleaseTwoStopAttemptLedger }>
  | Readonly<{ type: 'candidate_rejected'; requestId: string; firstPlaceId: string; reason: ReleaseTwoStopFailureReason; ledger: ReleaseTwoStopAttemptLedger }>
  | Readonly<{ type: 'completed'; requestId: string; firstPlaceId: string; state: ReleaseTwoStopSelectionResult['state']; continuation: ReleaseTwoStopSelectionContinuation; ledger: ReleaseTwoStopAttemptLedger }>;

type ReleaseTwoStopRuntimeInput = Readonly<{
  firstCourse: VerifiedCourseV1;
  ledger: ReleaseTwoStopAttemptLedger;
  requestId: string;
  onProgress?: (event: ReleaseTwoStopProgressEvent) => void;
  signal?: AbortSignal;
}>;

export type ReleaseTwoStopSelectionInput = CourseV1LimitedInput & ReleaseTwoStopRuntimeInput & Readonly<{
  reuse?: Readonly<{ courses: readonly VerifiedCourseV1[]; continuation: ReleaseTwoStopSelectionContinuation }>;
}>;

export type ReleaseTwoStopSelectionContinuationInput = CourseV1LimitedInput & ReleaseTwoStopRuntimeInput & Readonly<{
  continuation: ReleaseTwoStopSelectionContinuation;
}>;

export type ReleaseTwoStopSelectionResult = Readonly<{
  state: 'verified' | 'partial' | 'no_candidate' | 'exhausted' | 'unavailable' | 'continuation_unavailable';
  requestId: string;
  firstPlaceId: string;
  courses: readonly VerifiedCourseV1[];
  reasons: readonly ReleaseTwoStopFailureReason[];
  continuation: ReleaseTwoStopSelectionContinuation;
  ledger: ReleaseTwoStopAttemptLedger;
}>;

type PairVerification =
  | { kind: 'verified'; course: VerifiedCourseV1 }
  | { kind: 'rejected'; reason: ReleaseTwoStopFailureReason }
  | { kind: 'terminal'; reason: ReleaseTwoStopFailureReason }
  | { kind: 'budget' };

type Prepared = {
  first: CourseV1Candidate;
  candidates: CourseV1Candidate[];
  inputSignature: string;
  providerSignature: string;
  firstCourseSignature: string;
  initialReason?: ReleaseTwoStopFailureReason;
};

export async function beginReleaseTwoStopSelectionV1(
  input: ReleaseTwoStopSelectionInput,
): Promise<ReleaseTwoStopSelectionResult> {
  const prepared = prepare(input);
  if (!prepared || !validLedger(input.ledger)) return invalidResult(input);
  if (input.reuse && validContinuation(input.reuse.continuation, prepared, input.ledger)
    && validReusedCourses(input.reuse.courses, prepared.first.id, input.reuse.continuation)) {
    return finishWithoutCalls(input, input.reuse.courses, { ...input.reuse.continuation, ledger: input.ledger }, []);
  }
  const continuation = emptyContinuation(prepared, input.ledger);
  return verifyPage(input, prepared, continuation, 'automatic');
}

export async function continueReleaseTwoStopSelectionV1(
  input: ReleaseTwoStopSelectionContinuationInput,
): Promise<ReleaseTwoStopSelectionResult> {
  const prepared = prepare(input);
  if (!prepared || !validLedger(input.ledger) || !validContinuation(input.continuation, prepared, input.ledger)) {
    return invalidResult(input, input.continuation);
  }
  const continuation = { ...input.continuation, ledger: input.ledger };
  if (continuation.stopReason) return finishWithoutCalls(input, [], continuation, [continuation.stopReason]);
  if (continuation.verifiedCount >= RELEASE_TWO_STOP_TOTAL_LIMIT) {
    const stopped = { ...continuation, stopReason: 'attempt_limit_reached' as const };
    return finishWithoutCalls(input, [], stopped, ['attempt_limit_reached']);
  }
  return verifyPage(input, prepared, continuation, 'shared');
}

function prepare(input: ReleaseTwoStopSelectionInput | ReleaseTwoStopSelectionContinuationInput): Prepared | null {
  if (!(input.now instanceof Date) || Number.isNaN(input.now.getTime())
    || !Number.isInteger(input.remainingMin) || input.remainingMin < 1 || input.remainingMin > 180
    || !Number.isInteger(input.arrivalBufferMin) || input.arrivalBufferMin < 1 || input.arrivalBufferMin >= input.remainingMin
    || !input.receiptRoutes || typeof input.requestId !== 'string' || input.requestId.length === 0) return null;
  const supplied = input.provider.listRepresentativeCandidates(input.now);
  const firstPlaceId = input.firstCourse.placeIds[0];
  if (!validFirstCourse(input.firstCourse, firstPlaceId, input.origin, input.destination ?? input.origin, input.arrivalBufferMin)) return null;
  const first = supplied.find((candidate) => candidate.id === firstPlaceId);
  if (!first || (first.classification !== 'representative_core' && first.classification !== 'representative_standard')
    || first.conditionalVisit || first.minStayMin < 20 || input.firstCourse.stops[0]!.stayMin < first.minStayMin) return null;
  const pool = selectReleaseTwoStopCandidatePoolInternal({ ...input, candidates: supplied });
  const candidates = pool.filter((candidate) => candidate.id !== first.id
    && candidate.id !== input.origin.id
    && candidate.id !== (input.destination ?? input.origin).id
    && (!first.siteGroupId || !candidate.siteGroupId || first.siteGroupId !== candidate.siteGroupId)
    && first.minStayMin + candidate.minStayMin + input.arrivalBufferMin < input.remainingMin);
  const orderedCandidateIds = candidates.map((candidate) => candidate.id);
  const providerSignature = signature(supplied.map(candidateFingerprint));
  const inputSignature = signature([
    input.now.toISOString(), pointFingerprint(input.origin), pointFingerprint(input.destination ?? input.origin),
    String(input.remainingMin), String(input.arrivalBufferMin),
  ]);
  const firstCourseSignature = signature([courseFingerprint(input.firstCourse)]);
  let initialReason: ReleaseTwoStopFailureReason | undefined;
  if (!candidates.length) {
    const otherRepresentative = supplied.filter((candidate) => candidate.id !== first.id
      && (candidate.classification === 'representative_core' || candidate.classification === 'representative_standard')
      && !candidate.conditionalVisit);
    initialReason = otherRepresentative.some((candidate) => first.minStayMin + candidate.minStayMin + input.arrivalBufferMin >= input.remainingMin)
      ? 'insufficient_time_for_two_stops'
      : otherRepresentative.some((candidate) => candidate.availability.status !== 'structured')
        ? 'second_place_closed'
        : 'no_nearby_second_candidate';
  }
  return { first, candidates, inputSignature, providerSignature, firstCourseSignature, initialReason };
}

function validFirstCourse(
  course: VerifiedCourseV1,
  firstPlaceId: string | undefined,
  origin: CourseV1Point,
  target: CourseV1Point,
  arrivalBufferMin: number,
): firstPlaceId is string {
  if (!firstPlaceId || course.placeIds.length !== 1 || course.stops.length !== 1 || course.legs.length !== 2
    || course.stops[0]?.placeId !== firstPlaceId || course.arrivalBufferMin !== arrivalBufferMin
    || course.legs[0]?.fromId !== origin.id || course.legs[0]?.toId !== firstPlaceId
    || course.legs[1]?.fromId !== firstPlaceId || course.legs[1]?.toId !== target.id
    || course.travelMin !== course.legs[0].min + course.legs[1].min
    || course.stayMin !== course.stops[0].stayMin || course.stops[0].stayMin < 20
    || course.totalMin !== course.travelMin + course.stayMin + course.arrivalBufferMin) return false;
  return Number.isInteger(course.totalMin) && course.totalMin > 0;
}

function emptyContinuation(prepared: Prepared, ledger: ReleaseTwoStopAttemptLedger): ReleaseTwoStopSelectionContinuation {
  const orderedCandidateIds = prepared.candidates.map((candidate) => candidate.id);
  return {
    version: 1, firstPlaceId: prepared.first.id, cursor: 0, orderedCandidateIds,
    candidateSetSignature: signature(orderedCandidateIds), inputSignature: prepared.inputSignature,
    providerSignature: prepared.providerSignature, firstCourseSignature: prepared.firstCourseSignature,
    attemptedPairSignatures: [], rejectedPairSignatures: [], verifiedPairSignatures: [], routeReceiptKeys: [],
    verifiedCount: 0, ledger,
  };
}

async function verifyPage(
  input: ReleaseTwoStopSelectionInput | ReleaseTwoStopSelectionContinuationInput,
  prepared: Prepared,
  continuation: ReleaseTwoStopSelectionContinuation,
  stage: 'automatic' | 'shared',
): Promise<ReleaseTwoStopSelectionResult> {
  input.onProgress?.({ type: 'started', requestId: input.requestId, firstPlaceId: prepared.first.id, ledger: continuation.ledger });
  if (!prepared.candidates.length) {
    const reason = prepared.initialReason ?? 'no_nearby_second_candidate';
    const stopped = { ...continuation, stopReason: reason };
    return emitCompleted(input, [], stopped, [reason]);
  }
  const stageRemaining = stage === 'automatic'
    ? RELEASE_TWO_STOP_AUTOMATIC_ATTEMPT_LIMIT - continuation.ledger.automaticTwoStopAttempts
    : RELEASE_TWO_STOP_SHARED_ATTEMPT_LIMIT - continuation.ledger.sharedExpansionAttempts;
  const sessionRemaining = RELEASE_TWO_STOP_SESSION_ATTEMPT_LIMIT - continuation.ledger.totalNewProviderAttempts;
  const attemptLimit = Math.max(0, Math.min(stageRemaining, sessionRemaining));
  if (!attemptLimit) {
    const stopped = { ...continuation, stopReason: 'attempt_limit_reached' as const };
    return emitCompleted(input, [], stopped, ['attempt_limit_reached']);
  }

  const attempted = new Set(continuation.attemptedPairSignatures);
  const rejected = new Set(continuation.rejectedPairSignatures);
  const verified = new Set(continuation.verifiedPairSignatures);
  const routeReceiptKeys = new Set(continuation.routeReceiptKeys);
  const receiptCache = new Map<string, Promise<CourseV1RouteReceipt>>();
  const courses: VerifiedCourseV1[] = [];
  const reasons: ReleaseTwoStopFailureReason[] = [];
  let cursor = continuation.cursor;
  let pageAttempts = 0;
  let adapterCalls = 0;
  let localStop = false;
  let aborted = false;
  let terminal: ReleaseTwoStopFailureReason | undefined;

  const currentLedger = (): ReleaseTwoStopAttemptLedger => addAttempts(continuation.ledger, stage, pageAttempts);
  const getReceipt = async (from: CourseV1Point, to: CourseV1Point): Promise<CourseV1RouteReceipt> => {
    const key = `${from.id}>${to.id}`;
    const cached = receiptCache.get(key);
    if (cached) return cached;
    if (input.signal?.aborted) {
      aborted = true;
      return { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false };
    }
    if (pageAttempts >= attemptLimit || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) {
      localStop = true;
      return { result: 'unavailable', reason: 'unknown', newProviderAttemptCount: 0, reused: false };
    }
    const budget = Math.min(2, attemptLimit - pageAttempts) as 0 | 1 | 2;
    adapterCalls += 1;
    const promise = input.receiptRoutes!.getRouteReceipt(from, to, { maxNewProviderAttemptCount: budget })
      .then((receipt) => normalizeCourseV1ReceiptInternal(receipt, budget));
    receiptCache.set(key, promise);
    routeReceiptKeys.add(signature([key]));
    const receipt = await promise;
    pageAttempts += receipt.newProviderAttemptCount;
    return receipt;
  };

  while (cursor < prepared.candidates.length
    && continuation.verifiedCount + courses.length < RELEASE_TWO_STOP_TOTAL_LIMIT
    && courses.length < RELEASE_TWO_STOP_INITIAL_TARGET) {
    if (input.signal?.aborted) { aborted = true; break; }
    const candidate = prepared.candidates[cursor]!;
    const pairSignature = signature([prepared.first.id, candidate.id].sort());
    if (attempted.has(pairSignature)) { cursor += 1; continue; }
    const firstOrder = await verifyOrderedPair([prepared.first, candidate], input, getReceipt, () => localStop || aborted);
    if (firstOrder.kind === 'budget') break;
    if (firstOrder.kind === 'terminal') { terminal = firstOrder.reason; break; }
    const secondOrder = await verifyOrderedPair([candidate, prepared.first], input, getReceipt, () => localStop || aborted);
    if (secondOrder.kind === 'budget') break;
    if (secondOrder.kind === 'terminal') { terminal = secondOrder.reason; break; }
    attempted.add(pairSignature);
    cursor += 1;
    const selected = choosePair(firstOrder, secondOrder);
    if (selected) {
      verified.add(pairSignature);
      courses.push(selected);
      input.onProgress?.({ type: 'candidate_verified', requestId: input.requestId, firstPlaceId: prepared.first.id, course: selected, ledger: currentLedger() });
    } else {
      rejected.add(pairSignature);
      const reason = chooseRejectionReason(firstOrder, secondOrder);
      reasons.push(reason);
      input.onProgress?.({ type: 'candidate_rejected', requestId: input.requestId, firstPlaceId: prepared.first.id, reason, ledger: currentLedger() });
    }
    if (pageAttempts >= attemptLimit) break;
  }

  let stopReason: ReleaseTwoStopFailureReason | undefined = terminal;
  if (!stopReason && continuation.verifiedCount + courses.length >= RELEASE_TWO_STOP_TOTAL_LIMIT) stopReason = 'attempt_limit_reached';
  if (!stopReason && cursor >= prepared.candidates.length) stopReason = reasons[0] ?? 'no_nearby_second_candidate';
  if (!stopReason && (localStop || pageAttempts >= attemptLimit)) reasons.push('attempt_limit_reached');
  const ledger = currentLedger();
  const next: ReleaseTwoStopSelectionContinuation = {
    ...continuation, cursor,
    attemptedPairSignatures: [...attempted], rejectedPairSignatures: [...rejected], verifiedPairSignatures: [...verified],
    routeReceiptKeys: [...routeReceiptKeys], verifiedCount: continuation.verifiedCount + courses.length, ledger,
    ...(stopReason ? { stopReason } : {}),
  };
  return emitCompleted(input, courses, next, uniqueReasons(terminal ? [...reasons, terminal] : reasons));
}

async function verifyOrderedPair(
  places: readonly [CourseV1Candidate, CourseV1Candidate],
  input: ReleaseTwoStopSelectionInput | ReleaseTwoStopSelectionContinuationInput,
  getReceipt: (from: CourseV1Point, to: CourseV1Point) => Promise<CourseV1RouteReceipt>,
  didStop: () => boolean,
): Promise<PairVerification> {
  const target = input.destination ?? input.origin;
  const legs: CourseV1Leg[] = [];
  let current: CourseV1Point = input.origin;
  let elapsedMin = 0;
  for (const place of places) {
    const receipt = await getReceipt(current, place);
    if (didStop()) return { kind: 'budget' };
    if (receipt.result === 'unavailable') return { kind: 'terminal', reason: unavailableReason(receipt.reason) };
    if (receipt.result !== 'exact') return { kind: 'rejected', reason: 'no_exact_route' };
    legs.push(courseV1LegInternal(current.id, place.id, receipt.route));
    elapsedMin += receipt.route.min;
    const arrival = new Date(input.now.getTime() + elapsedMin * 60_000);
    if (!isCourseV1CandidateAvailableInternal(place, arrival, place.minStayMin)) return { kind: 'rejected', reason: 'second_place_closed' };
    elapsedMin += place.minStayMin;
    if (elapsedMin + input.arrivalBufferMin > input.remainingMin) return { kind: 'rejected', reason: 'insufficient_time_for_two_stops' };
    current = place;
  }
  const finalReceipt = await getReceipt(current, target);
  if (didStop()) return { kind: 'budget' };
  if (finalReceipt.result === 'unavailable') return { kind: 'terminal', reason: unavailableReason(finalReceipt.reason) };
  if (finalReceipt.result !== 'exact') return { kind: 'rejected', reason: 'no_exact_route' };
  legs.push(courseV1LegInternal(current.id, target.id, finalReceipt.route));
  const stayPlan = selectCourseV1StayPlanInternal(places, input, legs);
  if (!stayPlan) return { kind: 'rejected', reason: 'insufficient_time_for_two_stops' };
  const placeIds = places.map((place) => place.id);
  const travelMin = legs.reduce((sum, leg) => sum + leg.min, 0);
  return {
    kind: 'verified',
    course: {
      id: placeIds.join('|'), placeIds, stops: stayPlan.stops, legs,
      stayMin: stayPlan.stayMin, travelMin, totalMin: stayPlan.totalMin,
      arrivalBufferMin: input.arrivalBufferMin,
      remainingAfterCourseMin: input.remainingMin - stayPlan.totalMin,
      remainingAfterArrivalBufferMin: input.remainingMin - stayPlan.totalMin,
    },
  };
}

function choosePair(first: PairVerification, second: PairVerification): VerifiedCourseV1 | null {
  const a = first.kind === 'verified' ? first.course : null;
  const b = second.kind === 'verified' ? second.course : null;
  if (!a) return b;
  if (!b) return a;
  return a.travelMin <= b.travelMin ? a : b;
}

function chooseRejectionReason(first: PairVerification, second: PairVerification): ReleaseTwoStopFailureReason {
  const reasons = [first, second].flatMap((result) => result.kind === 'rejected' ? [result.reason] : []);
  return (['second_place_closed', 'insufficient_time_for_two_stops', 'no_exact_route'] as const)
    .find((reason) => reasons.includes(reason)) ?? 'no_exact_route';
}

function unavailableReason(reason: CourseV1RouteUnavailableReason | undefined): ReleaseTwoStopFailureReason {
  if (reason === 'store') return 'store_unavailable';
  if (reason === 'limited') return 'attempt_limit_reached';
  return 'provider_unavailable';
}

function addAttempts(ledger: ReleaseTwoStopAttemptLedger, stage: 'automatic' | 'shared', count: number): ReleaseTwoStopAttemptLedger {
  return {
    ...ledger,
    automaticTwoStopAttempts: ledger.automaticTwoStopAttempts + (stage === 'automatic' ? count : 0),
    sharedExpansionAttempts: ledger.sharedExpansionAttempts + (stage === 'shared' ? count : 0),
    totalNewProviderAttempts: ledger.totalNewProviderAttempts + count,
  };
}

function validLedger(value: ReleaseTwoStopAttemptLedger): boolean {
  return value?.version === 1
    && Number.isInteger(value.initialOneStopAttempts) && value.initialOneStopAttempts >= 0 && value.initialOneStopAttempts <= 8
    && Number.isInteger(value.automaticTwoStopAttempts) && value.automaticTwoStopAttempts >= 0 && value.automaticTwoStopAttempts <= 16
    && Number.isInteger(value.sharedExpansionAttempts) && value.sharedExpansionAttempts >= 0 && value.sharedExpansionAttempts <= 12
    && Number.isInteger(value.totalNewProviderAttempts)
    && value.totalNewProviderAttempts === value.initialOneStopAttempts + value.automaticTwoStopAttempts + value.sharedExpansionAttempts
    && value.totalNewProviderAttempts <= RELEASE_TWO_STOP_SESSION_ATTEMPT_LIMIT;
}

function validContinuation(continuation: ReleaseTwoStopSelectionContinuation, prepared: Prepared, ledger: ReleaseTwoStopAttemptLedger): boolean {
  if (!continuation || continuation.version !== 1 || continuation.firstPlaceId !== prepared.first.id
    || continuation.inputSignature !== prepared.inputSignature || continuation.providerSignature !== prepared.providerSignature
    || continuation.firstCourseSignature !== prepared.firstCourseSignature || !validLedger(continuation.ledger)
    || !Number.isInteger(continuation.cursor) || continuation.cursor < 0 || continuation.cursor > prepared.candidates.length
    || !Number.isInteger(continuation.verifiedCount) || continuation.verifiedCount < 0 || continuation.verifiedCount > RELEASE_TWO_STOP_TOTAL_LIMIT
    || !arraysEqual(continuation.orderedCandidateIds, prepared.candidates.map((candidate) => candidate.id))
    || continuation.candidateSetSignature !== signature(continuation.orderedCandidateIds)
    || !validStringSet(continuation.attemptedPairSignatures) || !validStringSet(continuation.rejectedPairSignatures)
    || !validStringSet(continuation.verifiedPairSignatures) || !validStringSet(continuation.routeReceiptKeys)
    || !ledgerCanAdvance(continuation.ledger, ledger)) return false;
  const expected = new Set(prepared.candidates.map((candidate) => signature([prepared.first.id, candidate.id].sort())));
  const attempted = new Set(continuation.attemptedPairSignatures);
  const rejected = new Set(continuation.rejectedPairSignatures);
  const verified = new Set(continuation.verifiedPairSignatures);
  if ([...attempted, ...rejected, ...verified].some((item) => !expected.has(item))
    || [...rejected].some((item) => verified.has(item))
    || [...rejected, ...verified].some((item) => !attempted.has(item))
    || continuation.verifiedCount !== verified.size) return false;
  return true;
}

function validReusedCourses(courses: readonly VerifiedCourseV1[], firstPlaceId: string, continuation: ReleaseTwoStopSelectionContinuation): boolean {
  if (!Array.isArray(courses) || courses.length !== continuation.verifiedCount || courses.length > RELEASE_TWO_STOP_TOTAL_LIMIT) return false;
  const secondIds = new Set<string>();
  return courses.every((course: VerifiedCourseV1) => {
    if (course.placeIds.length !== 2 || !course.placeIds.includes(firstPlaceId) || course.legs.length !== 3) return false;
    const second = course.placeIds.find((id) => id !== firstPlaceId);
    if (!second || secondIds.has(second)) return false;
    secondIds.add(second);
    return continuation.verifiedPairSignatures.includes(signature([firstPlaceId, second].sort()));
  });
}

function invalidResult(
  input: ReleaseTwoStopSelectionInput | ReleaseTwoStopSelectionContinuationInput,
  existing?: ReleaseTwoStopSelectionContinuation,
): ReleaseTwoStopSelectionResult {
  const firstPlaceId = input.firstCourse?.placeIds?.[0] ?? '';
  const fallbackLedger = validLedger(input.ledger) ? input.ledger : { version: 1, initialOneStopAttempts: 0, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 0 } as const;
  const continuation: ReleaseTwoStopSelectionContinuation = existing ?? {
    version: 1, firstPlaceId, cursor: 0, orderedCandidateIds: [], candidateSetSignature: signature([]),
    inputSignature: '', providerSignature: '', firstCourseSignature: '', attemptedPairSignatures: [], rejectedPairSignatures: [],
    verifiedPairSignatures: [], routeReceiptKeys: [], verifiedCount: 0, ledger: fallbackLedger,
    stopReason: 'continuation_unavailable',
  };
  return { state: 'continuation_unavailable', requestId: input.requestId, firstPlaceId, courses: [], reasons: ['continuation_unavailable'], continuation: { ...continuation, stopReason: 'continuation_unavailable' }, ledger: fallbackLedger };
}

function emitCompleted(
  input: ReleaseTwoStopSelectionInput | ReleaseTwoStopSelectionContinuationInput,
  courses: readonly VerifiedCourseV1[],
  continuation: ReleaseTwoStopSelectionContinuation,
  reasons: readonly ReleaseTwoStopFailureReason[],
): ReleaseTwoStopSelectionResult {
  const state = resultState(courses.length, continuation);
  const result: ReleaseTwoStopSelectionResult = {
    state, requestId: input.requestId, firstPlaceId: continuation.firstPlaceId,
    courses, reasons: uniqueReasons(reasons), continuation, ledger: continuation.ledger,
  };
  input.onProgress?.({ type: 'completed', requestId: input.requestId, firstPlaceId: continuation.firstPlaceId, state, continuation, ledger: continuation.ledger });
  return result;
}

function finishWithoutCalls(
  input: ReleaseTwoStopSelectionInput | ReleaseTwoStopSelectionContinuationInput,
  courses: readonly VerifiedCourseV1[],
  continuation: ReleaseTwoStopSelectionContinuation,
  reasons: readonly ReleaseTwoStopFailureReason[],
): ReleaseTwoStopSelectionResult {
  input.onProgress?.({ type: 'started', requestId: input.requestId, firstPlaceId: continuation.firstPlaceId, ledger: continuation.ledger });
  return emitCompleted(input, courses, continuation, reasons);
}

function resultState(count: number, continuation: ReleaseTwoStopSelectionContinuation): ReleaseTwoStopSelectionResult['state'] {
  if (continuation.stopReason === 'continuation_unavailable') return 'continuation_unavailable';
  if (continuation.stopReason === 'provider_unavailable' || continuation.stopReason === 'store_unavailable') return 'unavailable';
  if (count >= RELEASE_TWO_STOP_INITIAL_TARGET) return 'verified';
  if (count > 0) return 'partial';
  if (continuation.verifiedCount >= RELEASE_TWO_STOP_TOTAL_LIMIT || continuation.stopReason === 'attempt_limit_reached') return 'exhausted';
  return 'no_candidate';
}

function candidateFingerprint(candidate: CourseV1Candidate): string {
  return [candidate.id, candidate.lat, candidate.lon, candidate.classification, candidate.minStayMin,
    candidate.recommendedStayMin, candidate.maxStayMin ?? '', candidate.siteGroupId ?? '',
    candidate.availability.status, candidate.availability.alwaysAccessible,
    candidate.availability.dayTypes.join(','), candidate.availability.windows.map((window) => `${window.startMin}-${window.endMin}`).join(',')].join(':');
}

function pointFingerprint(point: CourseV1Point): string { return `${point.id}:${point.lat}:${point.lon}`; }
function courseFingerprint(course: VerifiedCourseV1): string {
  return JSON.stringify({ id: course.id, placeIds: course.placeIds, stops: course.stops, legs: course.legs, stayMin: course.stayMin, travelMin: course.travelMin, totalMin: course.totalMin, arrivalBufferMin: course.arrivalBufferMin });
}
function signature(values: readonly string[]): string {
  let hash = 2166136261;
  for (const char of values.join('\u001f')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `t2-${(hash >>> 0).toString(36)}`;
}
function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
}
function validStringSet(value: readonly string[]): boolean { return Array.isArray(value) && value.every((item) => typeof item === 'string') && new Set(value).size === value.length; }
function ledgerCanAdvance(previous: ReleaseTwoStopAttemptLedger, current: ReleaseTwoStopAttemptLedger): boolean {
  if (!validLedger(previous) || !validLedger(current) || previous.initialOneStopAttempts !== current.initialOneStopAttempts
    || current.automaticTwoStopAttempts < previous.automaticTwoStopAttempts
    || current.sharedExpansionAttempts < previous.sharedExpansionAttempts) return false;
  const automaticDelta = current.automaticTwoStopAttempts - previous.automaticTwoStopAttempts;
  const sharedDelta = current.sharedExpansionAttempts - previous.sharedExpansionAttempts;
  return current.totalNewProviderAttempts - previous.totalNewProviderAttempts === automaticDelta + sharedDelta;
}
function uniqueReasons(reasons: readonly ReleaseTwoStopFailureReason[]): ReleaseTwoStopFailureReason[] { return [...new Set(reasons)]; }
