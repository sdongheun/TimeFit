import type { TourLiveCatalogResult, TourLiveDetailBatchResult, TourLiveCandidateRef, TourLiveSourceResult } from '../services/tourApiLiveAdapter';
import { buildLiveCandidateSnapshot, type LocalLivePlaceProjection, type LiveCandidate, type LiveCandidateDiagnostic } from './liveCandidateSnapshot';
import { candidateSpatialBurden, COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT, COURSE_V1_RELEASE_RESULT_TARGET, type CourseV1Candidate, type CourseV1Point, type CourseV1ReleaseOneStopResult } from './courseV1';

export type LiveSufficiency = 'sufficient' | 'insufficient' | 'not_evaluated' | 'route_budget_exhausted';
/** Caller supplies current aggregate CourseV1 results, not a fabricated detail-count target. */
export function releaseResultSufficiency(result: {
  resultState: CourseV1ReleaseOneStopResult['resultState']; representativeCourse: { id: string } | null; alternativeCourses: readonly { id: string }[];
}): LiveSufficiency {
  if (result.resultState !== 'verified' || !result.representativeCourse) return 'insufficient';
  return new Set([result.representativeCourse.id, ...result.alternativeCourses.map(c => c.id)]).size >= COURSE_V1_RELEASE_RESULT_TARGET ? 'sufficient' : 'insufficient';
}
export type LiveProgressiveState = Readonly<{
  status: 'ready' | 'unavailable'; snapshotId: string | null; fetchedAt: string | null;
  queue: readonly LiveCandidate[];
  requested: readonly TourLiveCandidateRef[];
  pending: readonly TourLiveCandidateRef[] | null;
  settled: readonly TourLiveCandidateRef[];
  routeCandidates: readonly CourseV1Candidate[];
  sourceCandidates: readonly LiveCandidate[];
  diagnostics: readonly (LiveCandidateDiagnostic | { placeId: string; reason: 'opening_rejected' })[];
  nextBatchMax: number;
}>;
export type LiveDetailPlan = Readonly<{
  state: LiveProgressiveState;
  reason: 'request' | 'awaiting_batch' | 'awaiting_evaluation' | 'sufficient' | 'detail_cap' | 'queue_exhausted' | 'route_budget_exhausted' | 'unavailable' | 'provider_limit';
  nextAction?: 'empty_or_edit_inputs';
  /** Only source IDs are emitted. API owner attaches its current signed token separately. */
  batch?: { liveSourceSnapshotId: string; candidates: readonly TourLiveCandidateRef[] };
}>;
const key = (r: TourLiveCandidateRef) => `${r.contentId}:${r.contentTypeId}`;
const ref = (c: LiveCandidate): TourLiveCandidateRef => ({ contentId: c.tourapiContentId, contentTypeId: c.contentTypeId });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function freeze<T>(v: T): T { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }

/** Latest catalog facts are identity checked with empty opening, never used as opening success. No 18-place pre-cut. */
export function beginLiveProgressive(input: {
  local: readonly LocalLivePlaceProjection[]; catalog: TourLiveCatalogResult; origin: CourseV1Point; destination: CourseV1Point | null;
}): LiveProgressiveState {
  const base: LiveProgressiveState = { status: 'unavailable', snapshotId: null, fetchedAt: null, queue: [], requested: [], pending: null, settled: [], routeCandidates: [], sourceCandidates: [], diagnostics: [], nextBatchMax: 12 };
  if (input.catalog.status === 'unavailable') return freeze(base);
  if (![input.origin, input.destination ?? input.origin].every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)) return freeze(base);
  const s = input.catalog.snapshot;
  const combined = buildLiveCandidateSnapshot(input.local, { status: 'ready', snapshot: { snapshotId: s.liveSourceSnapshotId, fetchedAt: s.fetchedAt, unreviewedCount: s.unreviewedCount,
    places: s.catalogPlaces.map(p => ({ ...p, opening: {} })),
    candidateStates: s.candidateStates.map(c => ({ ...c, state: c.state === 'active_catalog' ? 'active_ready' : c.state })),
  } });
  const point = (c: LiveCandidate) => ({ id: c.id, lat: c.facts.lat, lon: c.facts.lon });
  const target = input.destination ?? input.origin;
  const queue = combined.candidates.filter(c => c.policy.classification === 'representative_core' || c.policy.classification === 'representative_standard').sort((a, b) =>
    candidateSpatialBurden(point(a), input.origin, target, input.destination === null) - candidateSpatialBurden(point(b), input.origin, target, input.destination === null)
    || Number(b.policy.classification === 'representative_core') - Number(a.policy.classification === 'representative_core') || compare(a.id, b.id));
  // User coordinates and derived distance scores are intentionally not retained in state/request.
  return freeze({ ...base, status: 'ready', snapshotId: s.liveSourceSnapshotId, fetchedAt: s.fetchedAt, queue, diagnostics: [...combined.diagnostics] });
}

/** Pure reservation. Consumer must commit returned state before dispatch; never dispatch the same reservation twice. */
export function planLiveDetailBatch(state: LiveProgressiveState, sufficiency: LiveSufficiency): LiveDetailPlan {
  const stop = (reason: LiveDetailPlan['reason']): LiveDetailPlan => ({ state, reason, ...(reason === 'detail_cap' || reason === 'queue_exhausted' ? { nextAction: 'empty_or_edit_inputs' as const } : {}) });
  if (state.status === 'unavailable') return stop('unavailable');
  if (state.pending) return stop('awaiting_batch');
  if (sufficiency === 'sufficient') return stop('sufficient');
  if (sufficiency === 'not_evaluated') return stop('awaiting_evaluation');
  if (sufficiency === 'route_budget_exhausted') return stop('route_budget_exhausted');
  if (state.requested.length >= 30) return stop('detail_cap');
  const used = new Set(state.requested.map(key));
  const remaining = state.queue.map(ref).filter(r => !used.has(key(r)));
  if (!remaining.length) return stop('queue_exhausted');
  const count = Math.min(state.requested.length ? 6 : 12, 30 - state.requested.length, state.nextBatchMax);
  if (count <= 0) return stop('provider_limit');
  const pending = remaining.slice(0, count);
  return freeze({ state: { ...state, requested: [...state.requested, ...pending], pending }, reason: 'request', batch: { liveSourceSnapshotId: state.snapshotId!, candidates: pending } });
}

/** Pure, injected opening policy. Must use live facts + explicit time/context, never a stale local schedule. null is fail-closed. */
export type LiveOpeningGate = (candidate: LiveCandidate) => CourseV1Candidate['availability'] | null;
export function acceptLiveDetailBatch(state: LiveProgressiveState, response: TourLiveDetailBatchResult, openingGate: LiveOpeningGate, reservation: NonNullable<LiveDetailPlan['batch']>): {
  state: LiveProgressiveState; reason: 'accepted' | 'duplicate_or_stale' | 'snapshot_mismatch' | 'invalid_batch' | 'unavailable';
} {
  const reject = (reason: 'duplicate_or_stale' | 'snapshot_mismatch' | 'invalid_batch') => ({ state, reason });
  if (reservation.liveSourceSnapshotId !== state.snapshotId) return reject('snapshot_mismatch');
  const reserved = reservation.candidates.map(key);
  if (reserved.length && reserved.every(k => state.settled.some(r => key(r) === k))) return reject('duplicate_or_stale');
  if (!state.pending || reserved.length !== state.pending.length || new Set(reserved).size !== reserved.length || reserved.some(k => !state.pending!.some(r => key(r) === k))) return reject('invalid_batch');
  if (response.status === 'unavailable') return { state: freeze({ ...state, status: 'unavailable' as const, pending: null, routeCandidates: [], sourceCandidates: [] }), reason: 'unavailable' };
  if (response.liveSourceSnapshotId !== state.snapshotId) return reject('snapshot_mismatch');
  const stateKeys = response.candidateStates.map(key);
  const settled = new Set(state.settled.map(key));
  if (stateKeys.length && stateKeys.every(k => settled.has(k))) return reject('duplicate_or_stale');
  if (!state.pending || state.status === 'unavailable') return reject('invalid_batch');
  const pending = new Set(state.pending.map(key));
  const ready = response.candidateStates.filter(c => c.state === 'active_ready').map(key);
  const details = response.details.map(key);
  if (stateKeys.length !== pending.size || new Set(stateKeys).size !== pending.size || stateKeys.some(k => !pending.has(k))
    || details.length !== ready.length || new Set(details).size !== details.length || details.some(k => !ready.includes(k))
    || response.budget.detailIntroUsed !== state.requested.length || response.budget.detailIntroRemaining !== 30 - state.requested.length
    || !Number.isInteger(response.budget.nextBatchMax) || response.budget.nextBatchMax < 0 || response.budget.nextBatchMax > Math.min(6, response.budget.detailIntroRemaining)) return reject('invalid_batch');
  const locals: LocalLivePlaceProjection[] = state.queue.map((c, order) => ({ id: c.id, order, mapping: { status: 'exact', tourapiContentId: c.tourapiContentId, contentTypeId: c.contentTypeId },
    facts: { ...c.facts, opening: {} }, aliases: c.aliases, policy: { ...c.policy }, relations: { ...c.relations, mergedPlaceIds: [...c.relations.mergedPlaceIds] }, photoRights: c.photoRights }));
  const source: TourLiveSourceResult = { status: 'ready', snapshot: { snapshotId: state.snapshotId!, fetchedAt: state.fetchedAt!, unreviewedCount: 0,
    candidateStates: response.candidateStates.map(c => ({ contentId: c.contentId, contentTypeId: c.contentTypeId, state: c.state })),
    places: response.details.flatMap(d => { const c = state.queue.find(c => key(ref(c)) === key(d)); return c ? [{ contentId: d.contentId, contentTypeId: d.contentTypeId, ...c.facts, opening: d.opening }] : []; }),
  } };
  const combined = buildLiveCandidateSnapshot(locals.filter(l => pending.has(key({ contentId: l.mapping!.tourapiContentId, contentTypeId: l.mapping!.contentTypeId }))), source);
  const routes = [...state.routeCandidates], diagnostics = [...state.diagnostics, ...combined.diagnostics];
  for (const c of combined.candidates) {
    let availability: CourseV1Candidate['availability'] | null;
    try { availability = openingGate(c); } catch { availability = null; }
    if (!availability || availability.status !== 'structured') { diagnostics.push({ placeId: c.id, reason: 'opening_rejected' }); continue; }
    if (routes.length >= COURSE_V1_PRESELECTION_PLACE_POOL_LIMIT || routes.some(r => r.id === c.id || (c.relations.siteGroupId && r.siteGroupId === c.relations.siteGroupId))) continue;
    routes.push({ id: c.id, title: c.facts.title, lat: c.facts.lat, lon: c.facts.lon, ...c.policy, siteGroupId: c.relations.siteGroupId,
      availability: { ...availability, dayTypes: [...availability.dayTypes], windows: availability.windows.map(w => ({ ...w })) } });
  }
  return { reason: 'accepted', state: freeze({ ...state, pending: null, settled: [...state.settled, ...state.pending], routeCandidates: routes,
    sourceCandidates: [...state.sourceCandidates, ...combined.candidates], diagnostics, nextBatchMax: response.budget.nextBatchMax }) };
}
