import type { LiveMultiSourceReservation } from '../engine/liveMultiSourceOrchestrator';
import type {
  SafeTourLiveFailure,
  TourLiveCandidateRef,
  TourLiveCatalogResult,
  TourLiveCatalogSnapshot,
  TourLiveDetailBatchResult,
  TourLiveDetailBudget,
  TourLiveDetailCandidateState,
  TourLiveDetail,
} from './tourApiLiveAdapter';
import type {
  BusanApprovedPhotoEvidence,
  BusanLiveResult,
  BusanLiveSourceKey,
} from './busanLiveAdapter';

type TourAdapterPort = Readonly<{
  loadCatalog(candidates: readonly TourLiveCandidateRef[]): Promise<TourLiveCatalogResult>;
  loadDetailBatch(request: Readonly<{ liveSourceSnapshotId: string; budgetToken: string; candidates: readonly TourLiveCandidateRef[] }>): Promise<TourLiveDetailBatchResult>;
}>;
type BusanAdapterPort = Readonly<{
  loadSnapshot(request: Readonly<{
    action: 'catalog_snapshot';
    liveSourceSnapshotId: string;
    approvedSourceIds: Readonly<Record<BusanLiveSourceKey, readonly string[]>>;
    approvedPhotos: Readonly<Record<BusanLiveSourceKey, readonly BusanApprovedPhotoEvidence[]>>;
  }>): Promise<BusanLiveResult>;
}>;

export type TourCatalogProjectionInput =
  | Readonly<{ kind: 'catalog'; status: 'ready'; snapshot: TourLiveCatalogSnapshot }>
  | Readonly<{ kind: 'catalog'; status: 'partial'; snapshot: TourLiveCatalogSnapshot; failures: readonly SafeTourLiveFailure[] }>
  | Readonly<{ status: 'unavailable'; reason: SafeTourLiveFailure }>;
export type TourDetailProjectionInput =
  | Readonly<{ kind: 'detail_batch'; status: 'ready' | 'partial'; liveSourceSnapshotId: string; details: readonly TourLiveDetail[]; candidateStates: readonly TourLiveDetailCandidateState[]; failures: readonly SafeTourLiveFailure[]; budget: TourLiveDetailBudget }>
  | Readonly<{ status: 'unavailable'; reason: SafeTourLiveFailure }>;
export type LiveMultiSourceSnapshotContext = Readonly<{
  liveSourceSnapshotId: string;
  source: 'tour_catalog' | 'facade_fallback';
}>;
export type LiveMultiSourceFacadeCounts = Readonly<{
  tourCatalogCalls: 0 | 1;
  busanSnapshotCalls: 0 | 1;
  busanProviderCalls: number;
  tourDetailBatches: number;
  tourDetailRequested: number;
}>;
export type LiveMultiSourceFacadeInitial = Readonly<{
  status: 'active';
  snapshotContext: LiveMultiSourceSnapshotContext;
  tourCatalog: TourCatalogProjectionInput;
  busan: BusanLiveResult;
  counts: LiveMultiSourceFacadeCounts;
}>;
export type LiveMultiSourceFacadeReason = 'not_initialized' | 'already_initialized' | 'invalid_input' | 'invalid_snapshot' | 'stale_reservation' | 'snapshot_mismatch' | 'unapproved_ref' | 'duplicate_ref' | 'detail_budget_exhausted' | 'detail_provider_unavailable' | 'closed' | 'cancelled';
export type LiveMultiSourceFacadeBlocked = Readonly<{ status: 'blocked'; reason: LiveMultiSourceFacadeReason; counts: LiveMultiSourceFacadeCounts }>;
export type LiveMultiSourceFacadeDetail = Readonly<{
  status: 'accepted';
  reservation: LiveMultiSourceReservation;
  batch: TourDetailProjectionInput;
  counts: LiveMultiSourceFacadeCounts;
}>;

export type LiveMultiSourceFacadeInput = Readonly<{
  approvedTourCandidates: readonly TourLiveCandidateRef[];
  approvedSourceIds: Readonly<Record<BusanLiveSourceKey, readonly string[]>>;
  approvedPhotos: Readonly<Record<BusanLiveSourceKey, readonly BusanApprovedPhotoEvidence[]>>;
}>;

const sourceKeys: readonly BusanLiveSourceKey[] = ['busan_attraction', 'busan_food', 'busan_shopping'];
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const refKey = (value: TourLiveCandidateRef) => `${value.contentId}:${value.contentTypeId}`;
const compareRef = (left: TourLiveCandidateRef, right: TourLiveCandidateRef) => compare(left.contentId, right.contentId) || compare(left.contentTypeId, right.contentTypeId);
const snapshotPattern = /^[A-Za-z0-9._-]{1,128}$/;
const placeIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const fallbackFailure: SafeTourLiveFailure = { operation: 'areaBasedList2', code: 'invalid_response', status: null };
const unavailableBusan = (): BusanLiveResult => ({ status: 'unavailable', providerCalls: 0, reason: { code: 'invalid_response', status: null } });

function frozenCopy<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (item: unknown): void => { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } };
  freeze(copy);
  return copy;
}
function stripCatalogToken(result: TourLiveCatalogResult): TourCatalogProjectionInput {
  if (result.status === 'unavailable') return frozenCopy(result);
  if (result.status === 'partial') return frozenCopy({ kind: 'catalog' as const, status: 'partial' as const, snapshot: result.snapshot, failures: result.failures });
  return frozenCopy({ kind: 'catalog' as const, status: 'ready' as const, snapshot: result.snapshot });
}
function stripDetailToken(result: TourLiveDetailBatchResult): TourDetailProjectionInput {
  if (result.status === 'unavailable') return frozenCopy(result);
  return frozenCopy({ kind: 'detail_batch' as const, status: result.status, liveSourceSnapshotId: result.liveSourceSnapshotId, details: result.details, candidateStates: result.candidateStates, failures: result.failures, budget: result.budget });
}
function safeCounts(input: { catalogCalls: number; busanCalls: number; busanProviderCalls: number; detailBatches: number; detailRequested: number }): LiveMultiSourceFacadeCounts {
  return frozenCopy({ tourCatalogCalls: Math.min(1, input.catalogCalls) as 0 | 1, busanSnapshotCalls: Math.min(1, input.busanCalls) as 0 | 1, busanProviderCalls: input.busanProviderCalls, tourDetailBatches: input.detailBatches, tourDetailRequested: input.detailRequested });
}
function canonicalInput(input: LiveMultiSourceFacadeInput): LiveMultiSourceFacadeInput | null {
  if (!input || typeof input !== 'object' || !Array.isArray(input.approvedTourCandidates)
    || !input.approvedSourceIds || typeof input.approvedSourceIds !== 'object'
    || !input.approvedPhotos || typeof input.approvedPhotos !== 'object') return null;
  if (input.approvedTourCandidates.some((item) => !item || typeof item.contentId !== 'string' || typeof item.contentTypeId !== 'string')) return null;
  const approvedTourCandidates = input.approvedTourCandidates.map((item) => ({ contentId: item.contentId.trim(), contentTypeId: item.contentTypeId.trim() }))
    .sort(compareRef);
  if (approvedTourCandidates.some((item) => !/^\d{1,20}$/.test(item.contentId) || !/^\d{1,4}$/.test(item.contentTypeId)) || new Set(approvedTourCandidates.map(refKey)).size !== approvedTourCandidates.length) return null;
  const approvedSourceIds = {} as Record<BusanLiveSourceKey, string[]>; const approvedPhotos = {} as Record<BusanLiveSourceKey, BusanApprovedPhotoEvidence[]>;
  for (const source of sourceKeys) {
    const sourceIds = input.approvedSourceIds[source];
    const sourcePhotos = input.approvedPhotos[source];
    if (!Array.isArray(sourceIds) || sourceIds.some((value) => typeof value !== 'string') || !Array.isArray(sourcePhotos)) return null;
    const ids = [...sourceIds].map((value) => value.trim()).sort(compare);
    if (ids.some((value) => !/^\d{1,20}$/.test(value)) || new Set(ids).size !== ids.length) return null;
    const idSet = new Set(ids);
    if (sourcePhotos.some((photo) => !photo || typeof photo !== 'object' || typeof photo.sourceId !== 'string' || typeof photo.url !== 'string')) return null;
    const photos = [...sourcePhotos].map((photo) => frozenCopy(photo)).sort((left, right) => compare(`${left.sourceId}:${left.url}`, `${right.sourceId}:${right.url}`));
    if (photos.some((photo) => !idSet.has(photo.sourceId) || !photo.url) || new Set(photos.map((photo) => photo.sourceId)).size !== photos.length) return null;
    approvedSourceIds[source] = ids; approvedPhotos[source] = photos;
  }
  return frozenCopy({ approvedTourCandidates, approvedSourceIds, approvedPhotos });
}

export function createLiveMultiSourceSessionFacade(input: {
  tour: TourAdapterPort;
  busan: BusanAdapterPort;
  idFactory: () => string;
}) {
  let lifecycle: 'new' | 'opening' | 'active' | 'closed' | 'cancelled' = 'new';
  let snapshotId = '';
  let catalogToken = '';
  let activeRefs = new Set<string>();
  let catalogCalls = 0;
  let busanCalls = 0;
  let busanProviderCalls = 0;
  let detailBatches = 0;
  let detailRequested = 0;
  let lastSequence = 0;
  let detailProviderUnavailable = false;
  const requestedRefs = new Set<string>();
  const counts = () => safeCounts({ catalogCalls, busanCalls, busanProviderCalls, detailBatches, detailRequested });
  const blocked = (reason: LiveMultiSourceFacadeReason): LiveMultiSourceFacadeBlocked => frozenCopy({ status: 'blocked' as const, reason, counts: counts() });
  const lifecycleBlock = () => lifecycle === 'closed' ? blocked('closed') : lifecycle === 'cancelled' ? blocked('cancelled') : null;

  async function initialize(raw: LiveMultiSourceFacadeInput): Promise<LiveMultiSourceFacadeInitial | LiveMultiSourceFacadeBlocked> {
    const stopped = lifecycleBlock(); if (stopped) return stopped;
    if (lifecycle !== 'new') return blocked('already_initialized');
    const approved = canonicalInput(raw); if (!approved) return blocked('invalid_input');
    lifecycle = 'opening'; catalogCalls = 1;
    let catalog: TourLiveCatalogResult;
    try { catalog = await input.tour.loadCatalog(approved.approvedTourCandidates); } catch { catalog = { status: 'unavailable', reason: fallbackFailure }; }
    const closedAfterTour = lifecycleBlock(); if (closedAfterTour) return closedAfterTour;
    if (catalog.status === 'unavailable') {
      let generated = ''; try { generated = input.idFactory(); } catch { return blocked('invalid_snapshot'); }
      if (!snapshotPattern.test(generated)) return blocked('invalid_snapshot');
      snapshotId = generated;
    } else {
      snapshotId = catalog.snapshot.liveSourceSnapshotId;
      if (!snapshotPattern.test(snapshotId)) return blocked('invalid_snapshot');
      catalogToken = catalog.budgetToken;
      activeRefs = new Set(catalog.snapshot.candidateStates.filter((item) => item.state === 'active_catalog').map(refKey));
    }
    busanCalls = 1;
    let busan: BusanLiveResult;
    try { busan = await input.busan.loadSnapshot({ action: 'catalog_snapshot', liveSourceSnapshotId: snapshotId, approvedSourceIds: approved.approvedSourceIds, approvedPhotos: approved.approvedPhotos }); } catch { busan = unavailableBusan(); }
    const closedAfterBusan = lifecycleBlock(); if (closedAfterBusan) return closedAfterBusan;
    busanProviderCalls = busan.providerCalls;
    lifecycle = 'active';
    return frozenCopy({ status: 'active' as const, snapshotContext: { liveSourceSnapshotId: snapshotId, source: catalog.status === 'unavailable' ? 'facade_fallback' as const : 'tour_catalog' as const }, tourCatalog: stripCatalogToken(catalog), busan, counts: counts() });
  }

  async function loadDetails(reservation: LiveMultiSourceReservation): Promise<LiveMultiSourceFacadeDetail | LiveMultiSourceFacadeBlocked> {
    const stopped = lifecycleBlock(); if (stopped) return stopped;
    if (lifecycle !== 'active') return blocked('not_initialized');
    if (detailProviderUnavailable || !catalogToken) return blocked('detail_provider_unavailable');
    if (reservation.liveSourceSnapshotId !== snapshotId) return blocked('snapshot_mismatch');
    if (!Number.isInteger(reservation.sequence) || reservation.sequence !== lastSequence + 1) return blocked('stale_reservation');
    if (!Array.isArray(reservation.candidates) || !reservation.candidates.length
      || reservation.candidates.some((item) => !item || typeof item.placeId !== 'string' || !placeIdPattern.test(item.placeId)
        || typeof item.contentId !== 'string' || !/^\d{1,20}$/.test(item.contentId)
        || typeof item.contentTypeId !== 'string' || !/^\d{1,4}$/.test(item.contentTypeId))) return blocked('invalid_input');
    const placeIds = reservation.candidates.map((item) => item.placeId);
    const refs = reservation.candidates.map((item) => ({ contentId: item.contentId, contentTypeId: item.contentTypeId }));
    const keys = refs.map(refKey);
    if (new Set(placeIds).size !== placeIds.length || new Set(keys).size !== keys.length) return blocked('duplicate_ref');
    if (keys.some((key) => !activeRefs.has(key))) return blocked('unapproved_ref');
    if (keys.some((key) => requestedRefs.has(key))) return blocked('stale_reservation');
    const batchLimit = detailRequested === 0 ? 12 : 6;
    if (keys.length > batchLimit || detailRequested + keys.length > 30) return blocked('detail_budget_exhausted');
    let result: TourLiveDetailBatchResult;
    try { result = await input.tour.loadDetailBatch({ liveSourceSnapshotId: snapshotId, budgetToken: catalogToken, candidates: refs }); } catch { result = { status: 'unavailable', reason: { operation: 'detailIntro2', code: 'network', status: null } }; }
    const stoppedAfterCall = lifecycleBlock(); if (stoppedAfterCall) return stoppedAfterCall;
    lastSequence = reservation.sequence; detailBatches += 1; detailRequested += keys.length; keys.forEach((key) => requestedRefs.add(key));
    if (result.status === 'unavailable') {
      detailProviderUnavailable = true;
      return frozenCopy({ status: 'accepted' as const, reservation, batch: stripDetailToken(result), counts: counts() });
    }
    const stateKeys = result.candidateStates.map(refKey);
    if (result.liveSourceSnapshotId !== snapshotId || new Set(stateKeys).size !== stateKeys.length || stateKeys.length !== keys.length || stateKeys.some((key) => !keys.includes(key)) || result.budget.detailIntroUsed !== detailRequested || result.budget.detailIntroRemaining !== 30 - detailRequested) {
      detailProviderUnavailable = true;
      return frozenCopy({ status: 'accepted' as const, reservation, batch: { status: 'unavailable', reason: { operation: 'detailIntro2', code: 'invalid_response', status: null } }, counts: counts() });
    }
    catalogToken = result.budgetToken;
    return frozenCopy({ status: 'accepted' as const, reservation, batch: stripDetailToken(result), counts: counts() });
  }

  function close() { if (lifecycle !== 'closed' && lifecycle !== 'cancelled') lifecycle = 'closed'; }
  function cancel() { if (lifecycle !== 'closed' && lifecycle !== 'cancelled') lifecycle = 'cancelled'; }
  function view() { return frozenCopy({ lifecycle, ...(snapshotId ? { snapshotContext: { liveSourceSnapshotId: snapshotId } } : {}), counts: counts() }); }

  return Object.freeze({ initialize, loadDetails, close, cancel, view });
}
