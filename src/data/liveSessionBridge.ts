import photoAllowlist from '../../data/processed/review/사진_이용허락_허용목록.json';
import type { LiveMultiSourceReservation } from '../engine/liveMultiSourceOrchestrator';
import type { BusanApprovedPhotoEvidence, BusanLiveSourceKey } from '../services/busanLiveAdapter';
import type {
  LiveMultiSourceFacadeDetail,
  LiveMultiSourceFacadeInitial,
  LiveMultiSourceFacadeInput,
} from '../services/liveMultiSourceSessionFacade';
import { createMultiSourceLiveInputs, type TourLiveFieldSupplement } from './busanLiveProjection';
import { createRuntimeLiveCatalogInputs, projectTourLiveCatalog, type LiveCatalogProjection } from './liveCatalogProjection';
import { normalizeTourLiveOpening } from './liveOpeningNormalizer';

type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
type DetailState = 'ready' | 'failed' | 'missing' | 'review';

export type LiveSessionInitialProjection = DeepReadonly<{
  status: 'accepted';
  sources: { tour: LiveCatalogProjection; busan: LiveMultiSourceFacadeInitial['busan'] };
}> | Readonly<{ status: 'rejected'; reason: 'snapshot_mismatch' | 'invalid_snapshot_context' }>;

export type LiveSessionDetailProjection = DeepReadonly<{
  status: 'accepted';
  reservation: LiveMultiSourceReservation;
  supplements: readonly TourLiveFieldSupplement[];
  nextBatchMax: number;
  records: readonly { placeId: string; sourceId: string; state: DetailState }[];
}> | Readonly<{
  status: 'rejected';
  reason: 'reservation_mismatch' | 'snapshot_mismatch' | 'invalid_batch';
}>;

const sourceKeys: readonly BusanLiveSourceKey[] = ['busan_attraction', 'busan_food', 'busan_shopping'];
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const refKey = (value: { contentId: string; contentTypeId: string }) => `${value.contentId}:${value.contentTypeId}`;
const exactTourRefByPlaceId = new Map(createMultiSourceLiveInputs().flatMap((local) => local.tourapiSourceId && local.place.mapping
  ? [[local.place.id, refKey({ contentId: local.tourapiSourceId, contentTypeId: local.place.mapping.contentTypeId })] as const]
  : []));

function deepFreeze<T>(value: T): DeepReadonly<T> {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  };
  freeze(copy);
  return copy as DeepReadonly<T>;
}

/** Exact, reviewed identifiers and verified Busan photo evidence for one facade initialize call. */
export function buildApprovedLiveMultiSourceInput(): LiveMultiSourceFacadeInput {
  const locals = createMultiSourceLiveInputs();
  const approvedTourCandidates = locals.flatMap((local) => local.tourapiSourceId && local.place.mapping
    ? [{ contentId: local.tourapiSourceId, contentTypeId: local.place.mapping.contentTypeId }]
    : []).sort((left, right) => compare(refKey(left), refKey(right)));
  const approvedSourceIds = Object.fromEntries(sourceKeys.map((source) => [source, locals
    .flatMap((local) => local.busanMappings.filter((mapping) => mapping.source === source).map((mapping) => mapping.sourceId))
    .sort(compare)])) as Record<BusanLiveSourceKey, string[]>;
  const approvedIdSets = Object.fromEntries(sourceKeys.map((source) => [source, new Set(approvedSourceIds[source])])) as Record<BusanLiveSourceKey, Set<string>>;
  const approvedPhotos = Object.fromEntries(sourceKeys.map((source) => [source, photoAllowlist.data
    .filter((row) => row.status === 'verified' && row.source === source)
    .map((row) => {
      if (!approvedIdSets[source].has(row.sourceId)
        || row.licenseName !== '이용허락범위 제한 없음'
        || row.commercialUseAllowed !== true
        || row.modificationAllowed !== true
        || !row.sourcePageUrl || !row.verifiedAt) throw new Error(`invalid approved photo evidence: ${source}:${row.sourceId}`);
      return {
        sourceId: row.sourceId,
        url: row.imageUrl,
        attribution: row.attribution,
        sourcePageUrl: row.sourcePageUrl,
        licenseName: '이용허락범위 제한 없음' as const,
        commercialUseAllowed: true as const,
        modificationAllowed: true as const,
        verifiedAt: row.verifiedAt,
      } satisfies BusanApprovedPhotoEvidence;
    })
    .sort((left, right) => compare(`${left.sourceId}:${left.url}`, `${right.sourceId}:${right.url}`))])) as Record<BusanLiveSourceKey, BusanApprovedPhotoEvidence[]>;
  return deepFreeze({ approvedTourCandidates, approvedSourceIds, approvedPhotos });
}

/** Converts facade output without manufacturing a Tour success from a fallback snapshot. */
export function projectLiveSessionInitial(input: LiveMultiSourceFacadeInitial): LiveSessionInitialProjection {
  const tourAvailable = input.tourCatalog.status !== 'unavailable';
  if ((tourAvailable && input.snapshotContext.source !== 'tour_catalog')
    || (!tourAvailable && input.snapshotContext.source !== 'facade_fallback')) {
    return { status: 'rejected', reason: 'invalid_snapshot_context' };
  }
  if (tourAvailable && input.tourCatalog.snapshot.liveSourceSnapshotId !== input.snapshotContext.liveSourceSnapshotId) {
    return { status: 'rejected', reason: 'snapshot_mismatch' };
  }
  if ('sources' in input.busan && input.busan.liveSourceSnapshotId !== input.snapshotContext.liveSourceSnapshotId) {
    return { status: 'rejected', reason: 'snapshot_mismatch' };
  }
  return deepFreeze({
    status: 'accepted' as const,
    sources: {
      tour: projectTourLiveCatalog(createRuntimeLiveCatalogInputs(), input.tourCatalog),
      busan: input.busan,
    },
  });
}

function sameReservation(left: LiveMultiSourceReservation, right: LiveMultiSourceReservation): boolean {
  return left.liveSourceSnapshotId === right.liveSourceSnapshotId
    && left.sequence === right.sequence
    && left.candidates.length === right.candidates.length
    && left.candidates.every((candidate, index) => {
      const other = right.candidates[index];
      return other?.placeId === candidate.placeId && other.contentId === candidate.contentId && other.contentTypeId === candidate.contentTypeId;
    });
}

/**
 * Normalizes a token-free detail batch. Raw opening/closed/event strings are consumed here and
 * intentionally absent from the returned supplements and records.
 */
export function projectLiveSessionDetails(input: Readonly<{
  reservation: LiveMultiSourceReservation;
  response: LiveMultiSourceFacadeDetail;
  referenceDate: string;
}>): LiveSessionDetailProjection {
  const { reservation, response } = input;
  if (!sameReservation(reservation, response.reservation)) return { status: 'rejected', reason: 'reservation_mismatch' };
  const reservationPlaceIds = reservation.candidates.map((candidate) => candidate.placeId);
  const reservationRefs = reservation.candidates.map(refKey);
  if (!reservation.candidates.length
    || new Set(reservationPlaceIds).size !== reservationPlaceIds.length
    || new Set(reservationRefs).size !== reservationRefs.length
    || reservation.candidates.some((candidate) => exactTourRefByPlaceId.get(candidate.placeId) !== refKey(candidate))) {
    return { status: 'rejected', reason: 'invalid_batch' };
  }
  if (response.batch.status === 'unavailable') {
    return Object.freeze({
      status: 'accepted' as const,
      reservation,
      supplements: Object.freeze([]),
      nextBatchMax: 0,
      records: deepFreeze(reservation.candidates.map((candidate) => ({ placeId: candidate.placeId, sourceId: candidate.contentId, state: 'failed' as const }))),
    });
  }
  if (response.batch.liveSourceSnapshotId !== reservation.liveSourceSnapshotId) return { status: 'rejected', reason: 'snapshot_mismatch' };
  const candidatesByRef = new Map(reservation.candidates.map((candidate) => [refKey(candidate), candidate]));
  const stateKeys = response.batch.candidateStates.map(refKey);
  const detailKeys = response.batch.details.map(refKey);
  if (new Set(stateKeys).size !== stateKeys.length || stateKeys.length !== reservation.candidates.length
    || stateKeys.some((key) => !candidatesByRef.has(key))
    || new Set(detailKeys).size !== detailKeys.length || detailKeys.some((key) => !candidatesByRef.has(key))) {
    return { status: 'rejected', reason: 'invalid_batch' };
  }
  const stateByRef = new Map(response.batch.candidateStates.map((state) => [refKey(state), state.state]));
  const detailByRef = new Map(response.batch.details.map((detail) => [refKey(detail), detail]));
  if (response.batch.details.some((detail) => stateByRef.get(refKey(detail)) !== 'active_ready')) {
    return { status: 'rejected', reason: 'invalid_batch' };
  }
  const supplements: TourLiveFieldSupplement[] = [];
  const records = reservation.candidates.map((candidate) => {
    const key = refKey(candidate);
    const state = stateByRef.get(key);
    const detail = detailByRef.get(key);
    if (state === 'active_detail_failed') return { placeId: candidate.placeId, sourceId: candidate.contentId, state: 'failed' as const };
    if (state !== 'active_ready' || !detail) return { placeId: candidate.placeId, sourceId: candidate.contentId, state: 'missing' as const };
    const openingResult = normalizeTourLiveOpening({
      placeId: candidate.placeId,
      sourceId: candidate.contentId,
      contentTypeId: candidate.contentTypeId,
      referenceDate: input.referenceDate,
      opening: detail.opening,
    });
    supplements.push({
      liveSourceSnapshotId: reservation.liveSourceSnapshotId,
      placeId: candidate.placeId,
      sourceId: candidate.contentId,
      openingResult,
    });
    return {
      placeId: candidate.placeId,
      sourceId: candidate.contentId,
      state: openingResult.status === 'structured' ? 'ready' as const : 'review' as const,
    };
  });
  return Object.freeze({
    status: 'accepted' as const,
    reservation,
    supplements: deepFreeze(supplements.sort((left, right) => compare(left.placeId, right.placeId))),
    nextBatchMax: response.batch.budget.nextBatchMax,
    records: deepFreeze(records.sort((left, right) => compare(left.placeId, right.placeId))),
  });
}

/** Deterministic cumulative view for controller diagnostics; the engine remains the state owner. */
export function mergeLiveTourSupplements(
  current: readonly TourLiveFieldSupplement[],
  incoming: readonly TourLiveFieldSupplement[],
  liveSourceSnapshotId: string,
): readonly TourLiveFieldSupplement[] | null {
  const merged = [...current, ...incoming];
  if (merged.some((item) => item.liveSourceSnapshotId !== liveSourceSnapshotId)) return null;
  const keys = merged.map((item) => `${item.placeId}:${item.sourceId}`);
  if (new Set(keys).size !== keys.length) return null;
  return deepFreeze(merged.sort((left, right) => compare(`${left.placeId}:${left.sourceId}`, `${right.placeId}:${right.sourceId}`)));
}
