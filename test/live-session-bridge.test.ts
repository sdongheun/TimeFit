import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApprovedLiveMultiSourceInput,
  mergeLiveTourSupplements,
  projectLiveSessionDetails,
  projectLiveSessionInitial,
} from '../src/data/liveSessionBridge';
import { createMultiSourceLiveInputs } from '../src/data/busanLiveProjection';
import type { LiveMultiSourceReservation } from '../src/engine/liveMultiSourceOrchestrator';
import type { BusanLiveResult, BusanLiveSourceKey, BusanLiveSourceResult } from '../src/services/busanLiveAdapter';
import type { LiveMultiSourceFacadeDetail, LiveMultiSourceFacadeInitial } from '../src/services/liveMultiSourceSessionFacade';
import type { TourLiveCatalogSnapshot } from '../src/services/tourApiLiveAdapter';

const snapshotId = 'bridge-fixture-001';
const sources: readonly BusanLiveSourceKey[] = ['busan_attraction', 'busan_food', 'busan_shopping'];
const down = (): BusanLiveSourceResult => ({ status: 'unavailable', complete: false, providerCalls: 0, reason: { code: 'network', status: null } });
const busanWithSnapshot = (id = snapshotId): BusanLiveResult => ({
  status: 'unavailable', liveSourceSnapshotId: id, providerCalls: 0,
  sources: Object.fromEntries(sources.map((source) => [source, down()])) as Record<BusanLiveSourceKey, BusanLiveSourceResult>,
});
const counts = { tourCatalogCalls: 1 as const, busanSnapshotCalls: 1 as const, busanProviderCalls: 0, tourDetailBatches: 0, tourDetailRequested: 0 };
const approved = buildApprovedLiveMultiSourceInput();

function catalogSnapshot(): TourLiveCatalogSnapshot {
  return {
    liveSourceSnapshotId: snapshotId,
    fetchedAt: '2026-09-22T00:00:00Z',
    catalogPlaces: [],
    candidateStates: approved.approvedTourCandidates.map((candidate) => ({ ...candidate, state: 'inactive' as const })),
    unreviewedCount: 0,
  };
}

test('approved request is exact, deterministic, deeply frozen, and preserves 369/191=82+93+16 baseline', () => {
  const second = buildApprovedLiveMultiSourceInput();
  assert.deepEqual(second, approved);
  assert.equal(approved.approvedTourCandidates.length, 139);
  assert.deepEqual(Object.fromEntries(sources.map((source) => [source, approved.approvedSourceIds[source].length])), {
    busan_attraction: 85, busan_food: 19, busan_shopping: 29,
  });
  assert.deepEqual(Object.fromEntries(sources.map((source) => [source, approved.approvedPhotos[source].length])), {
    busan_attraction: 85, busan_food: 16, busan_shopping: 0,
  });
  assert.ok(Object.isFrozen(approved) && Object.isFrozen(approved.approvedTourCandidates));
  const locals = createMultiSourceLiveInputs();
  const representative = locals.filter((local) => ['representative_core', 'representative_standard'].includes(local.place.policy.classification));
  assert.equal(locals.length, 369);
  assert.equal(representative.length, 191);
  assert.deepEqual({
    tourapiOnly: representative.filter((local) => local.partition === 'tourapi_only').length,
    busanOnly: representative.filter((local) => local.partition === 'busan_only').length,
    tourapiAndBusan: representative.filter((local) => local.partition === 'tourapi_and_busan').length,
  }, { tourapiOnly: 82, busanOnly: 93, tourapiAndBusan: 16 });
  assert.doesNotMatch(JSON.stringify(approved), /budgetToken|accessToken|rawText|closedText/);
});

for (const status of ['ready', 'partial'] as const) test(`token-free Tour ${status} catalog projects without a synthetic token`, () => {
  const input: LiveMultiSourceFacadeInitial = {
    status: 'active', snapshotContext: { liveSourceSnapshotId: snapshotId, source: 'tour_catalog' },
    tourCatalog: status === 'ready'
      ? { kind: 'catalog', status, snapshot: catalogSnapshot() }
      : { kind: 'catalog', status, snapshot: catalogSnapshot(), failures: [{ operation: 'areaBasedList2', code: 'page_limit', status: null }] },
    busan: { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } }, counts,
  };
  const result = projectLiveSessionInitial(input);
  assert.equal(result.status, 'accepted');
  if (result.status !== 'accepted') return;
  assert.equal(result.sources.tour.status, status);
  assert.equal(result.sources.tour.summary.runtimePlaces, 369);
  assert.equal(result.sources.tour.summary.tourapiMapped, 139);
  assert.doesNotMatch(JSON.stringify(result), /budgetToken|accessToken/);
});

test('facade fallback snapshot keeps Tour unavailable while allowing the matching Busan snapshot', () => {
  const input: LiveMultiSourceFacadeInitial = {
    status: 'active', snapshotContext: { liveSourceSnapshotId: snapshotId, source: 'facade_fallback' },
    tourCatalog: { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'network', status: null } },
    busan: busanWithSnapshot(), counts,
  };
  const result = projectLiveSessionInitial(input);
  assert.equal(result.status, 'accepted');
  if (result.status !== 'accepted') return;
  assert.equal(result.sources.tour.status, 'unavailable');
  assert.equal(result.sources.tour.liveSourceSnapshotId, null);
  assert.equal('sources' in result.sources.busan && result.sources.busan.liveSourceSnapshotId, snapshotId);
  assert.equal(projectLiveSessionInitial({ ...input, busan: busanWithSnapshot('stale') }).status, 'rejected');
  assert.equal(projectLiveSessionInitial({ ...input, snapshotContext: { ...input.snapshotContext, source: 'tour_catalog' } }).status, 'rejected');
});

test('detail ready/failed/missing/review states normalize without exposing source text and retain original reservation', () => {
  const linked = createMultiSourceLiveInputs().filter((local) => local.tourapiSourceId && ['representative_core', 'representative_standard'].includes(local.place.policy.classification)).slice(0, 4);
  const reservation: LiveMultiSourceReservation = {
    liveSourceSnapshotId: snapshotId, sequence: 1,
    candidates: linked.map((local) => ({ placeId: local.place.id, contentId: local.tourapiSourceId!, contentTypeId: local.place.mapping!.contentTypeId })),
  };
  const [ready, review, failed, missing] = reservation.candidates;
  const response: LiveMultiSourceFacadeDetail = {
    status: 'accepted', reservation: structuredClone(reservation), counts: { ...counts, tourDetailBatches: 1, tourDetailRequested: 4 },
    batch: {
      kind: 'detail_batch', status: 'partial', liveSourceSnapshotId: snapshotId,
      details: [
        { contentId: ready.contentId, contentTypeId: ready.contentTypeId, opening: { rawText: '09:00~18:00' } },
        { contentId: review.contentId, contentTypeId: review.contentTypeId, opening: { rawText: '운영시간 문의', closedText: '매주 월요일' } },
      ],
      candidateStates: [
        { contentId: ready.contentId, contentTypeId: ready.contentTypeId, state: 'active_ready' },
        { contentId: review.contentId, contentTypeId: review.contentTypeId, state: 'active_ready' },
        { contentId: failed.contentId, contentTypeId: failed.contentTypeId, state: 'active_detail_failed' },
        { contentId: missing.contentId, contentTypeId: missing.contentTypeId, state: 'active_ready' },
      ],
      failures: [{ operation: 'detailIntro2', code: 'provider_error', status: null }],
      budget: { detailIntroUsed: 4, detailIntroRemaining: 26, nextBatchMax: 6, detailCommonRemaining: 4, detailImageRemaining: 1 },
    },
  };
  const result = projectLiveSessionDetails({ reservation, response, referenceDate: '2026-09-22' });
  assert.equal(result.status, 'accepted');
  if (result.status !== 'accepted') return;
  assert.equal(result.reservation, reservation);
  assert.deepEqual(Object.fromEntries(result.records.map((record) => [record.placeId, record.state])), {
    [ready.placeId]: 'ready', [review.placeId]: 'review', [failed.placeId]: 'failed', [missing.placeId]: 'missing',
  });
  assert.equal(result.supplements.length, 2);
  assert.doesNotMatch(JSON.stringify(result), /09:00~18:00|운영시간 문의|매주 월요일|budgetToken|accessToken/);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.supplements));
});

test('detail mismatch/duplicates reject; unavailable settles the batch with provider limit', () => {
  const local = createMultiSourceLiveInputs().find((item) => item.tourapiSourceId)!;
  const reservation: LiveMultiSourceReservation = { liveSourceSnapshotId: snapshotId, sequence: 1, candidates: [{ placeId: local.place.id, contentId: local.tourapiSourceId!, contentTypeId: local.place.mapping!.contentTypeId }] };
  const unavailable: LiveMultiSourceFacadeDetail = { status: 'accepted', reservation: structuredClone(reservation), batch: { status: 'unavailable', reason: { operation: 'detailIntro2', code: 'network', status: null } }, counts };
  const settled = projectLiveSessionDetails({ reservation, response: unavailable, referenceDate: '2026-09-22' });
  assert.equal(settled.status, 'accepted');
  if (settled.status === 'accepted') assert.deepEqual({ next: settled.nextBatchMax, supplements: settled.supplements.length, state: settled.records[0].state }, { next: 0, supplements: 0, state: 'failed' });
  assert.equal(projectLiveSessionDetails({ reservation, response: { ...unavailable, reservation: { ...reservation, sequence: 2 } }, referenceDate: '2026-09-22' }).status, 'rejected');
  const wrongPlaceReservation = { ...reservation, candidates: [{ ...reservation.candidates[0], placeId: 'poi-not-the-exact-mapping' }] };
  assert.equal(projectLiveSessionDetails({ reservation: wrongPlaceReservation, response: { ...unavailable, reservation: structuredClone(wrongPlaceReservation) }, referenceDate: '2026-09-22' }).status, 'rejected');
  const duplicate = { ...unavailable, batch: { kind: 'detail_batch' as const, status: 'ready' as const, liveSourceSnapshotId: snapshotId,
    details: [], candidateStates: [
      { contentId: reservation.candidates[0].contentId, contentTypeId: reservation.candidates[0].contentTypeId, state: 'active_detail_failed' as const },
      { contentId: reservation.candidates[0].contentId, contentTypeId: reservation.candidates[0].contentTypeId, state: 'active_detail_failed' as const },
    ], failures: [], budget: { detailIntroUsed: 1, detailIntroRemaining: 29, nextBatchMax: 6 as const, detailCommonRemaining: 4, detailImageRemaining: 1 } } };
  assert.equal(projectLiveSessionDetails({ reservation, response: duplicate, referenceDate: '2026-09-22' }).status, 'rejected');
});

test('cumulative supplements are order-independent, deeply frozen, and reject duplicates/stale snapshots', () => {
  const supplement = (placeId: string, sourceId: string) => ({ liveSourceSnapshotId: snapshotId, placeId, sourceId });
  const a = supplement('poi-b', '2'); const b = supplement('poi-a', '1');
  const left = mergeLiveTourSupplements([a], [b], snapshotId);
  const right = mergeLiveTourSupplements([b], [a], snapshotId);
  assert.deepEqual(left, right);
  assert.ok(left && Object.isFrozen(left) && Object.isFrozen(left[0]));
  assert.equal(mergeLiveTourSupplements([a], [a], snapshotId), null);
  assert.equal(mergeLiveTourSupplements([a], [{ ...b, liveSourceSnapshotId: 'stale' }], snapshotId), null);
});
