import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveMultiSourceSessionFacade, type LiveMultiSourceFacadeInput } from '../src/services/liveMultiSourceSessionFacade';
import type { BusanLiveResult, BusanLiveSourceResult } from '../src/services/busanLiveAdapter';
import type { TourLiveCatalogResult, TourLiveCandidateRef, TourLiveDetailBatchResult } from '../src/services/tourApiLiveAdapter';
import type { LiveMultiSourceReservation } from '../src/engine/liveMultiSourceOrchestrator';

const refs = Array.from({ length: 30 }, (_, index) => ({ contentId: String(index + 1), contentTypeId: '12' }));
const approvedPhoto = { sourceId: '10', url: 'https://example.invalid/photo.jpg', attribution: 'fixture', sourcePageUrl: 'https://example.invalid/source', licenseName: '이용허락범위 제한 없음' as const, commercialUseAllowed: true as const, modificationAllowed: true as const, verifiedAt: '2026-09-22' };
const approved: LiveMultiSourceFacadeInput = { approvedTourCandidates: refs, approvedSourceIds: { busan_attraction: ['20', '10'], busan_food: [], busan_shopping: [] }, approvedPhotos: { busan_attraction: [approvedPhoto], busan_food: [], busan_shopping: [] } };
const catalog = (status: 'ready' | 'partial' = 'ready', snapshot = 'tour-snapshot-001'): TourLiveCatalogResult => {
  const value = { kind: 'catalog' as const, snapshot: { liveSourceSnapshotId: snapshot, fetchedAt: '2026-09-22T00:00:00Z', catalogPlaces: refs.map((ref) => ({ ...ref, title: `place-${ref.contentId}`, lat: 35.1, lon: 129.1 })), candidateStates: refs.map((ref, index) => ({ ...ref, state: status === 'partial' && index === refs.length - 1 ? 'identity_conflict' as const : 'active_catalog' as const })), unreviewedCount: 0 }, budgetToken: 'token-0' };
  return status === 'partial' ? { ...value, status: 'partial', failures: [{ operation: 'areaBasedList2', code: 'identity_conflict', status: null }] } : { ...value, status: 'ready' };
};
const busanReady = (snapshot: string): BusanLiveResult => {
  const source = (inactiveApprovedSourceIds: readonly string[]): BusanLiveSourceResult => ({ status: 'ready', complete: true, providerCalls: 1, activeApprovedSourceIds: [], inactiveApprovedSourceIds, records: [] });
  return { status: 'ready', liveSourceSnapshotId: snapshot, providerCalls: 3, sources: { busan_attraction: source(['10', '20']), busan_food: source([]), busan_shopping: source([]) } };
};
const busanUnavailable: BusanLiveResult = { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } };
const reservation = (sequence: number, start: number, count: number, snapshot = 'tour-snapshot-001'): LiveMultiSourceReservation => ({ liveSourceSnapshotId: snapshot, sequence, candidates: refs.slice(start, start + count).map((ref) => ({ placeId: `place-${ref.contentId}`, ...ref })) });

function detailPort(seen: Array<{ token: string; refs: string[] }>) {
  let used = 0;
  return async (request: { liveSourceSnapshotId: string; budgetToken: string; candidates: readonly TourLiveCandidateRef[] }): Promise<TourLiveDetailBatchResult> => {
    seen.push({ token: request.budgetToken, refs: request.candidates.map((ref) => `${ref.contentId}:${ref.contentTypeId}`) }); used += request.candidates.length;
    return { kind: 'detail_batch', status: 'ready', liveSourceSnapshotId: request.liveSourceSnapshotId, details: request.candidates.map((ref) => ({ ...ref, opening: { rawText: '09:00~18:00' } })), candidateStates: request.candidates.map((ref) => ({ ...ref, state: 'active_ready' as const })), failures: [], budget: { detailIntroUsed: used, detailIntroRemaining: 30 - used, nextBatchMax: Math.min(6, 30 - used) as 0 | 1 | 2 | 3 | 4 | 5 | 6, detailCommonRemaining: 4, detailImageRemaining: 1 }, budgetToken: `token-${used}` };
  };
}

for (const tourStatus of ['ready', 'partial'] as const) test(`Tour ${tourStatus} snapshot binds Busan to the exact same ID and hides tokens`, async () => {
  const busanRequests: unknown[] = [];
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => catalog(tourStatus), loadDetailBatch: async () => assert.fail('detail not expected') }, busan: { async loadSnapshot(request) { busanRequests.push(request); return busanReady(request.liveSourceSnapshotId); } } });
  const result = await facade.initialize(approved); assert.equal(result.status, 'active'); if (result.status !== 'active') return;
  assert.equal(result.snapshotContext.liveSourceSnapshotId, 'tour-snapshot-001'); assert.equal(result.snapshotContext.source, 'tour_catalog'); assert.equal((busanRequests[0] as { liveSourceSnapshotId: string }).liveSourceSnapshotId, 'tour-snapshot-001');
  assert.deepEqual((busanRequests[0] as { approvedSourceIds: LiveMultiSourceFacadeInput['approvedSourceIds'] }).approvedSourceIds.busan_attraction, ['10', '20']);
  assert.deepEqual((busanRequests[0] as { approvedPhotos: LiveMultiSourceFacadeInput['approvedPhotos'] }).approvedPhotos.busan_attraction, [approvedPhoto]);
  assert.equal(result.tourCatalog.status, tourStatus); assert.doesNotMatch(JSON.stringify(result), /token-0|budgetToken/);
});

test('Tour unavailable creates one injected opaque snapshot and preserves Busan ready', async () => {
  let ids = 0; let detailCalls = 0;
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => { ids += 1; return 'opaque-fallback-001'; }, tour: { loadCatalog: async () => ({ status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'network', status: null } }), loadDetailBatch: async () => { detailCalls += 1; return assert.fail('detail not expected'); } }, busan: { async loadSnapshot(request) { return busanReady(request.liveSourceSnapshotId); } } });
  const result = await facade.initialize(approved); assert.equal(result.status, 'active'); if (result.status !== 'active') return;
  assert.equal(ids, 1); assert.equal(result.snapshotContext.liveSourceSnapshotId, 'opaque-fallback-001'); assert.equal(result.snapshotContext.source, 'facade_fallback'); assert.equal(result.busan.status, 'ready');
  const blocked = await facade.loadDetails(reservation(1, 0, 1, 'opaque-fallback-001')); assert.equal(blocked.status, 'blocked'); if (blocked.status === 'blocked') assert.equal(blocked.reason, 'detail_provider_unavailable'); assert.equal(detailCalls, 0);
});

test('Busan unavailable does not erase Tour catalog or detail lifecycle', async () => {
  const seen: Array<{ token: string; refs: string[] }> = [];
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => catalog(), loadDetailBatch: detailPort(seen) }, busan: { loadSnapshot: async () => busanUnavailable } });
  const initial = await facade.initialize(approved); assert.equal(initial.status, 'active'); if (initial.status !== 'active') return; assert.equal(initial.tourCatalog.status, 'ready'); assert.equal(initial.busan.status, 'unavailable');
  const batch = await facade.loadDetails(reservation(1, 0, 1)); assert.equal(batch.status, 'accepted'); assert.equal(seen.length, 1);
});

test('detail token stays in closure and advances across 12→6→6→6 with one cumulative session budget', async () => {
  const seen: Array<{ token: string; refs: string[] }> = [];
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => catalog(), loadDetailBatch: detailPort(seen) }, busan: { async loadSnapshot(request) { return busanReady(request.liveSourceSnapshotId); } } });
  await facade.initialize(approved);
  let start = 0;
  for (const [index, count] of [12, 6, 6, 6].entries()) {
    const result = await facade.loadDetails(reservation(index + 1, start, count)); assert.equal(result.status, 'accepted'); if (result.status !== 'accepted') return;
    assert.equal(result.counts.tourDetailRequested, start + count); assert.doesNotMatch(JSON.stringify(result), /budgetToken|token-/); start += count;
  }
  assert.deepEqual(seen.map((item) => item.token), ['token-0', 'token-12', 'token-18', 'token-24']);
  const blocked = await facade.loadDetails({ liveSourceSnapshotId: 'tour-snapshot-001', sequence: 5, candidates: [{ placeId: 'extra', contentId: '31', contentTypeId: '12' }] }); assert.equal(blocked.status, 'blocked'); if (blocked.status === 'blocked') assert.equal(blocked.reason, 'unapproved_ref');
  assert.equal(seen.length, 4); assert.equal(facade.view().counts.tourDetailRequested, 30);
});

test('stale/different snapshot, unapproved, duplicate, and replay are rejected before provider', async () => {
  const seen: Array<{ token: string; refs: string[] }> = [];
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => catalog(), loadDetailBatch: detailPort(seen) }, busan: { async loadSnapshot(request) { return busanReady(request.liveSourceSnapshotId); } } });
  await facade.initialize(approved);
  const different = await facade.loadDetails(reservation(1, 0, 1, 'different')); assert.equal(different.status, 'blocked');
  const unknown = await facade.loadDetails({ liveSourceSnapshotId: 'tour-snapshot-001', sequence: 1, candidates: [{ placeId: 'x', contentId: '999', contentTypeId: '12' }] }); assert.equal(unknown.status, 'blocked');
  const duplicate = await facade.loadDetails({ liveSourceSnapshotId: 'tour-snapshot-001', sequence: 1, candidates: [{ placeId: 'a', ...refs[0] }, { placeId: 'b', ...refs[0] }] }); assert.equal(duplicate.status, 'blocked');
  const valid = reservation(1, 0, 1); assert.equal((await facade.loadDetails(valid)).status, 'accepted');
  const replay = await facade.loadDetails(valid); assert.equal(replay.status, 'blocked'); if (replay.status === 'blocked') assert.equal(replay.reason, 'stale_reservation');
  assert.equal(seen.length, 1);
});

test('close and cancel make handles terminal and discard late lifecycle reuse', async () => {
  for (const action of ['close', 'cancel'] as const) {
    let detailCalls = 0;
    const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => catalog(), loadDetailBatch: async () => { detailCalls += 1; return assert.fail('detail not expected'); } }, busan: { async loadSnapshot(request) { return busanReady(request.liveSourceSnapshotId); } } });
    await facade.initialize(approved); facade[action](); const result = await facade.loadDetails(reservation(1, 0, 1)); assert.equal(result.status, 'blocked'); if (result.status === 'blocked') assert.equal(result.reason, action === 'close' ? 'closed' : 'cancelled'); assert.equal(detailCalls, 0);
  }
});

test('cancel during catalog loading suppresses the Busan request and makes the session terminal', async () => {
  let releaseCatalog!: (value: TourLiveCatalogResult) => void;
  const pendingCatalog = new Promise<TourLiveCatalogResult>((resolve) => { releaseCatalog = resolve; });
  let busanCalls = 0;
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => pendingCatalog, loadDetailBatch: async () => assert.fail('detail not expected') }, busan: { async loadSnapshot(request) { busanCalls += 1; return busanReady(request.liveSourceSnapshotId); } } });
  const opening = facade.initialize(approved); facade.cancel(); releaseCatalog(catalog());
  const result = await opening; assert.equal(result.status, 'blocked'); if (result.status === 'blocked') assert.equal(result.reason, 'cancelled');
  assert.equal(busanCalls, 0); assert.equal((await facade.initialize(approved)).status, 'blocked');
});

test('initial provider inputs are copied and sorted deterministically without mutating owner arrays', async () => {
  const tourInputs: readonly TourLiveCandidateRef[][] = []; const busanInputs: string[][] = [];
  const reversed: LiveMultiSourceFacadeInput = { ...approved, approvedTourCandidates: [...approved.approvedTourCandidates].reverse(), approvedSourceIds: { ...approved.approvedSourceIds, busan_attraction: ['20', '10'] } };
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { async loadCatalog(input) { (tourInputs as TourLiveCandidateRef[][]).push([...input]); return catalog(); }, loadDetailBatch: async () => assert.fail('detail not expected') }, busan: { async loadSnapshot(input) { busanInputs.push([...input.approvedSourceIds.busan_attraction]); return busanReady(input.liveSourceSnapshotId); } } });
  await facade.initialize(reversed);
  assert.deepEqual(tourInputs[0].map((ref) => ref.contentId), [...refs].sort((left, right) => left.contentId < right.contentId ? -1 : left.contentId > right.contentId ? 1 : 0).map((ref) => ref.contentId)); assert.deepEqual(busanInputs[0], ['10', '20']); assert.deepEqual(reversed.approvedSourceIds.busan_attraction, ['20', '10']);
});

test('malformed owner input and malformed reservation are blocked without provider work', async () => {
  let catalogCalls = 0; let busanCalls = 0; let detailCalls = 0;
  const facade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => { catalogCalls += 1; return catalog(); }, loadDetailBatch: async () => { detailCalls += 1; return assert.fail('detail not expected'); } }, busan: { async loadSnapshot(request) { busanCalls += 1; return busanReady(request.liveSourceSnapshotId); } } });
  const malformed = await facade.initialize({ ...approved, approvedSourceIds: { ...approved.approvedSourceIds, busan_food: undefined } } as unknown as LiveMultiSourceFacadeInput);
  assert.deepEqual(malformed, { status: 'blocked', reason: 'invalid_input', counts: { tourCatalogCalls: 0, busanSnapshotCalls: 0, busanProviderCalls: 0, tourDetailBatches: 0, tourDetailRequested: 0 } });
  assert.equal(catalogCalls, 0); assert.equal(busanCalls, 0);

  const validFacade = createLiveMultiSourceSessionFacade({ idFactory: () => 'unused-fallback-001', tour: { loadCatalog: async () => catalog(), loadDetailBatch: async () => { detailCalls += 1; return assert.fail('detail not expected'); } }, busan: { async loadSnapshot(request) { return busanReady(request.liveSourceSnapshotId); } } });
  await validFacade.initialize(approved);
  const invalidReservation = await validFacade.loadDetails({ liveSourceSnapshotId: 'tour-snapshot-001', sequence: 1, candidates: [{ placeId: '', ...refs[0] }] });
  assert.equal(invalidReservation.status, 'blocked'); if (invalidReservation.status === 'blocked') assert.equal(invalidReservation.reason, 'invalid_input');
  assert.equal(detailCalls, 0);
});
