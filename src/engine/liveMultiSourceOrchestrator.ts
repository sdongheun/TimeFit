import type { projectMultiSourceLiveCatalog, MultiSourceLiveProjection, TourLiveFieldSupplement } from '../data/busanLiveProjection';
import {
  buildReleaseOneStopRepresentativeCourseV1, candidateSpatialBurden,
  COURSE_V1_ADAPTER_CALL_LIMIT, COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT,
  COURSE_V1_INITIAL_PROVIDER_ATTEMPT_LIMIT, COURSE_V1_RELEASE_RESULT_TARGET,
  selectReleaseTwoStopCandidatePoolInternal, selectRepresentativeCourseSetV1,
  type CourseV1Candidate, type CourseV1Input, type CourseV1ReleaseOneStopResult,
  type CourseV1RouteReceiptAdapter, type VerifiedCourseV1,
} from './courseV1';
import type { ReleaseTwoStopAttemptLedger } from './twoStopSelectionV1';
import { createLiveRouteBudgetOwner, type LiveRuntimeBridge } from './liveRuntimeBridge';

export type LiveMultiSourceInput = Parameters<typeof projectMultiSourceLiveCatalog>[0];
export type LiveMultiSourceProjector = typeof projectMultiSourceLiveCatalog;
type Context = Omit<CourseV1Input, 'candidates' | 'routes'>;
type DetailRef = Readonly<{ placeId: string; contentId: string; contentTypeId: string }>;
export type LiveMultiSourceReservation = Readonly<{
  liveSourceSnapshotId: string; sequence: number; candidates: readonly DetailRef[];
}>;
export type LiveMultiSourceStop = 'sufficient' | 'detail_cap' | 'queue_exhausted' | 'route_budget_exhausted' | 'provider_unavailable' | 'detail_provider_limit' | 'unavailable';
export type LiveMultiSourceDiagnostic = Readonly<{
  provider: MultiSourceLiveProjection['records'][number]['providers'][number]['provider'];
  sourceId: string;
  reason: NonNullable<MultiSourceLiveProjection['records'][number]['reason']> | MultiSourceLiveProjection['records'][number]['state'];
  count: number;
}>;
export type LiveMultiSourceView = Readonly<{
  state: 'loading' | 'ready' | 'partial' | 'empty' | 'unavailable';
  liveSourceSnapshotId: string | null;
  courses: readonly VerifiedCourseV1[];
  routeCandidates: readonly CourseV1Candidate[];
  activeCandidateCount: number;
  detailRequested: number;
  ledger: ReleaseTwoStopAttemptLedger;
  adapterCalls: number;
  routeCacheEntries: number;
  diagnostics: readonly LiveMultiSourceDiagnostic[];
  sourceFailure?: 'snapshot_mismatch' | 'invalid_projection';
  stopReason?: LiveMultiSourceStop;
  nextAction: 'continue' | 'show_results' | 'edit_inputs' | 'retry';
}>;

function frozenCopy<T>(value: T): T {
  const copy = structuredClone(value);
  function freeze(v: unknown): void {
    if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); }
  }
  freeze(copy);
  return copy;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const representative = (c: { classification: string }) => c.classification === 'representative_core' || c.classification === 'representative_standard';

/** Exact data-owner input/output, injected to keep static catalogs and I/O out of the engine graph. */
export function projectLiveSessionSources(input: LiveMultiSourceInput, projector: LiveMultiSourceProjector):
  | Readonly<{ status: 'accepted'; projection: MultiSourceLiveProjection }>
  | Readonly<{ status: 'snapshot_mismatch' | 'invalid_projection' }> {
  const tourId = input.tour.liveSourceSnapshotId;
  const busanId = 'sources' in input.busan ? input.busan.liveSourceSnapshotId : null;
  const id = tourId ?? busanId;
  if ((tourId !== null && busanId !== null && tourId !== busanId)
    || (!tourId && (input.tour.status !== 'unavailable' || input.tour.candidates.length > 0))
    || (input.tourSupplements ?? []).some(s => !id || s.liveSourceSnapshotId !== id)) return { status: 'snapshot_mismatch' };
  const seen = new Set<string>();
  for (const s of input.tourSupplements ?? []) {
    if (seen.has(s.placeId) || !input.tour.candidates.some(c => c.id === s.placeId && c.source.contentId === s.sourceId)) return { status: 'invalid_projection' };
    seen.add(s.placeId);
  }
  try {
    const projection = projector(input);
    if (projection.liveSourceSnapshotId !== id) return { status: 'snapshot_mismatch' };
    return frozenCopy({ status: 'accepted' as const, projection });
  } catch { return { status: 'invalid_projection' }; }
}

/**
 * In-memory, injected-port engine session. No public activation or I/O implementation.
 * Owns a single writer: reserves details synchronously and serializes route evaluation.
 * Source snapshots/context are copied once; refresh requires a new explicit session.
 */
export function createMultiSourceLiveSession(input: {
  sources: Omit<LiveMultiSourceInput, 'tourSupplements'>;
  context: Context;
  projector: LiveMultiSourceProjector;
  receiptRoutes: CourseV1RouteReceiptAdapter;
}) {
  const context = structuredClone(input.context);
  if (!Number.isFinite(context.now.getTime()) || !Number.isInteger(context.remainingMin) || context.remainingMin <= 0 || context.remainingMin > 180
    || !Number.isInteger(context.arrivalBufferMin) || context.arrivalBufferMin < 1 || context.arrivalBufferMin >= context.remainingMin
    || ![context.origin, context.destination ?? context.origin].every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)) throw new Error('invalid_session_input');
  // Deliberately does not accept pre-fetched supplements: all detail work must be reserved.
  const sources = frozenCopy({ tour: input.sources.tour, busan: input.sources.busan });
  let supplements: TourLiveFieldSupplement[] = [];
  let checked = projectLiveSessionSources(sources, input.projector);
  let projection = checked.status === 'accepted' ? checked.projection : null;
  const sourceFailure = checked.status === 'accepted' ? undefined : checked.status;
  const snapshotId = projection?.liveSourceSnapshotId ?? null;
  const unavailable = !projection || !snapshotId || (sources.tour.status === 'unavailable' && sources.busan.status === 'unavailable');
  const queue = sources.tour.candidates.filter(c => representative(c.policy)
    && sources.tour.records.some(r => r.placeId === c.id && r.state === 'active_catalog')
    && !projection?.records.some(r => r.placeId === c.id && r.reason === 'identity_conflict'))
    .sort((a, b) => candidateSpatialBurden({ id: a.id, ...a.facts }, context.origin, context.destination ?? context.origin, context.destination === null)
      - candidateSpatialBurden({ id: b.id, ...b.facts }, context.origin, context.destination ?? context.origin, context.destination === null)
      || Number(b.policy.classification === 'representative_core') - Number(a.policy.classification === 'representative_core') || compare(a.id, b.id))
    .map(c => ({ placeId: c.id, contentId: c.source.contentId, contentTypeId: c.source.contentTypeId }));
  const requested = new Set<string>();
  let pending: LiveMultiSourceReservation | null = null;
  let sequence = 0;
  let nextBatchMax = 12;
  let evaluating = false;
  let needsEvaluation = false;
  let evaluated = false;
  let routeUnavailable = false;
  let adapterCalls = 0;
  let attempts = 0;
  let courses: VerifiedCourseV1[] = [];
  let routeCandidates: CourseV1Candidate[] = [];
  const routeOwner = createLiveRouteBudgetOwner(input.receiptRoutes);
  let sealed = false;
  let lastResult: CourseV1ReleaseOneStopResult | null = null;
  const remainingQueue = () => queue.filter(c => !requested.has(c.placeId));
  function stopReason(): LiveMultiSourceStop | undefined {
    if (unavailable) return 'unavailable';
    if (courses.length >= COURSE_V1_RELEASE_RESULT_TARGET) return 'sufficient';
    if (routeUnavailable) return 'provider_unavailable';
    if (attempts >= COURSE_V1_INITIAL_PROVIDER_ATTEMPT_LIMIT || adapterCalls >= COURSE_V1_ADAPTER_CALL_LIMIT) return 'route_budget_exhausted';
    if (pending || needsEvaluation || !evaluated) return undefined;
    if (requested.size >= 30) return 'detail_cap';
    if (!remainingQueue().length) return 'queue_exhausted';
    if (!nextBatchMax) return 'detail_provider_limit';
    return undefined;
  }
  function view(): LiveMultiSourceView {
    const stop = stopReason();
    const state = courses.length >= COURSE_V1_RELEASE_RESULT_TARGET ? 'ready' : courses.length ? 'partial'
      : unavailable || (stop && routeUnavailable) ? 'unavailable' : stop ? 'empty' : 'loading';
    const diagnostics = (projection?.records ?? []).flatMap(r => r.state === 'active' ? [] : r.providers.map(p => ({ provider: p.provider, sourceId: p.sourceId, reason: r.reason ?? r.state, count: 1 })))
      .sort((a, b) => compare(a.provider, b.provider) || compare(a.sourceId, b.sourceId) || compare(a.reason, b.reason));
    return frozenCopy({ state, liveSourceSnapshotId: snapshotId, courses, routeCandidates,
      activeCandidateCount: projection?.candidates.length ?? 0, detailRequested: requested.size,
      ledger: { version: 1, initialOneStopAttempts: attempts, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: attempts },
      adapterCalls, routeCacheEntries: routeOwner.stats().cacheEntries, diagnostics, ...(sourceFailure ? { sourceFailure } : {}), ...(stop ? { stopReason: stop } : {}),
      nextAction: courses.length ? 'show_results' : state === 'unavailable' ? 'retry' : state === 'empty' ? 'edit_inputs' : 'continue' });
  }
  function reserveDetails(): Readonly<{ reason: LiveMultiSourceStop | 'request' | 'awaiting_batch' | 'awaiting_evaluation' | 'session_sealed'; reservation?: LiveMultiSourceReservation }> {
    if (sealed) return { reason: 'session_sealed' };
    if (evaluating || needsEvaluation) return { reason: 'awaiting_evaluation' };
    if (pending) return { reason: 'awaiting_batch' };
    const stop = stopReason();
    if (stop) return { reason: stop };
    if (requested.size >= 30) return { reason: 'detail_cap' };
    const candidates = remainingQueue().slice(0, Math.min(requested.size ? 6 : 12, 30 - requested.size, nextBatchMax));
    if (!candidates.length) return { reason: 'queue_exhausted' };
    candidates.forEach(c => requested.add(c.placeId));
    pending = frozenCopy({ liveSourceSnapshotId: snapshotId!, sequence: ++sequence, candidates });
    return { reason: 'request', reservation: pending };
  }
  /** Missing supplements settle as detail failure, never Busan fallback for an active Tour owner. */
  function acceptDetails(reservation: LiveMultiSourceReservation, batch: readonly TourLiveFieldSupplement[], limits: Readonly<{ nextBatchMax: number }> = { nextBatchMax: Math.min(6, 30 - requested.size) }): 'accepted' | 'snapshot_mismatch' | 'stale_reservation' | 'invalid_batch' | 'session_sealed' {
    if (sealed) return 'session_sealed';
    if (reservation.liveSourceSnapshotId !== snapshotId || batch.some(s => s.liveSourceSnapshotId !== snapshotId)) return 'snapshot_mismatch';
    if (!pending || evaluating || reservation !== pending) return 'stale_reservation';
    if (!Number.isInteger(limits.nextBatchMax) || limits.nextBatchMax < 0 || limits.nextBatchMax > Math.min(6, 30 - requested.size)) return 'invalid_batch';
    if (new Set(batch.map(s => s.placeId)).size !== batch.length || batch.some(s => !pending!.candidates.some(c => c.placeId === s.placeId && c.contentId === s.sourceId))) return 'invalid_batch';
    const next = [...supplements, ...batch].sort((a, b) => compare(a.placeId, b.placeId));
    checked = projectLiveSessionSources({ ...sources, tourSupplements: next }, input.projector);
    if (checked.status !== 'accepted') return checked.status === 'snapshot_mismatch' ? 'snapshot_mismatch' : 'invalid_batch';
    supplements = frozenCopy(next);
    projection = checked.projection;
    nextBatchMax = limits.nextBatchMax;
    pending = null;
    needsEvaluation = true;
    return 'accepted';
  }
  const receipts: CourseV1RouteReceiptAdapter = { async getRouteReceipt(from, to, budget) {
    const receipt = await routeOwner.initialReceiptRoutes.getRouteReceipt(from, to, budget);
    attempts = routeOwner.ledger().initialOneStopAttempts;
    adapterCalls = routeOwner.stats().initialCalls;
    routeUnavailable = routeOwner.stats().initialUnavailable;
    return receipt;
  } };
  async function evaluate(): Promise<LiveMultiSourceView> {
    if (sealed) throw new Error('session_sealed');
    if (evaluating) throw new Error('evaluation_in_progress');
    if (pending) throw new Error('detail_batch_in_progress');
    if (unavailable || (evaluated && !needsEvaluation)) return view();
    if (queue.length && !requested.size) throw new Error('initial_detail_batch_required');
    evaluating = true;
    try {
      const candidates: CourseV1Candidate[] = (projection?.candidates ?? []).filter(c => c.state === 'active' && representative(c.policy) && c.facts.availability.status === 'structured')
        .map(c => ({ id: c.id, title: c.facts.title, lat: c.facts.lat, lon: c.facts.lon, ...c.policy, siteGroupId: c.relations.siteGroupId,
          availability: { ...c.facts.availability, dayTypes: [...c.facts.availability.dayTypes], windows: c.facts.availability.windows.map(w => ({ ...w })) } }));
      // Reuse the exact release preselection, including opening/day, spatial and wide lane.
      const selected = selectReleaseTwoStopCandidatePoolInternal({ ...context, candidates });
      for (const c of selected) {
        if (routeCandidates.length >= COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT) break;
        if (!routeCandidates.some(r => r.id === c.id || (c.siteGroupId && r.siteGroupId === c.siteGroupId))) routeCandidates.push(c);
      }
      const result = await buildReleaseOneStopRepresentativeCourseV1({ ...context,
        provider: { listRepresentativeCandidates: () => structuredClone(routeCandidates) },
        routes: { getRoute: async () => null }, receiptRoutes: receipts });
      lastResult = frozenCopy(result);
      const merged = new Map(courses.map(c => [c.id, c]));
      for (const c of [result.representativeCourse, ...result.alternativeCourses]) if (c) merged.set(c.id, c);
      courses = selectRepresentativeCourseSetV1([...merged.values()]).slice(0, COURSE_V1_RELEASE_RESULT_TARGET);
      evaluated = true;
      needsEvaluation = false;
      return view();
    } finally { evaluating = false; }
  }
  function initialResult(): CourseV1ReleaseOneStopResult {
    if (evaluating || pending || needsEvaluation || (!evaluated && !unavailable)) throw new Error('initial_not_final');
    const failed = unavailable || routeUnavailable;
    const primary = failed ? 'route_verification_unavailable' : !routeCandidates.length ? 'no_eligible_candidates'
      : lastResult?.primaryOutcomeReason ?? 'route_not_verified';
    return frozenCopy({
      ...(lastResult ?? {}), representativeCourse: courses[0] ?? null, alternativeCourses: courses.slice(1, COURSE_V1_RELEASE_RESULT_TARGET),
      resultState: courses.length ? 'verified' : failed || routeCandidates.length ? 'no_verified_course_within_limit' : 'no_representative_candidates',
      alternativeState: courses.length > 1 ? 'alternatives_available' : courses.length || failed || routeCandidates.length ? 'no_alternative_verified_course' : 'no_candidates',
      primaryOutcomeReason: courses.length ? courses.length === 1 ? 'no_distinct_verified_alternative' : undefined : primary,
      outcomeReasons: courses.length ? (lastResult?.outcomeReasons ?? []).filter(r => courses.length === 1 || r !== 'no_distinct_verified_alternative') : [primary],
      diagnostics: { providerCandidateCount: projection?.candidates.length ?? 0, preselectionCandidateCount: routeCandidates.length,
        candidatePoolCount: routeCandidates.length, generatedOrderedCourseCount: 0, preselectedCourseIds: [], exactCourseAttemptCount: 0,
        routeRejected: 0, openingRejected: 0, budgetRejected: 0, relationshipRejected: 0, classificationExcluded: 0,
        ...lastResult?.diagnostics, newProviderAttemptCount: attempts, adapterCallCount: adapterCalls },
    });
  }
  function sealRuntime(): LiveRuntimeBridge {
    if (sealed) throw new Error('session_sealed');
    const result = initialResult();
    if (!stopReason()) throw new Error('initial_not_final');
    const bridge = routeOwner.seal(context, routeCandidates, result);
    sealed = true;
    return bridge;
  }
  return Object.freeze({ view, reserveDetails, acceptDetails, evaluate, initialResult, sealRuntime });
}
