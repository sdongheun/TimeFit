import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedTourApiLiveInvoker, createTourApiLiveAdapter, mergeTourLiveDetailBatches } from '../src/services/tourApiLiveAdapter';

const ref = { contentId: '1', contentTypeId: '12' } as const;
const snapshot = { liveSourceSnapshotId: 's', fetchedAt: '2026-09-21T00:00:00.000Z', catalogPlaces: [{ ...ref, title: 'place', lat: 35.1, lon: 129.1 }], candidateStates: [{ ...ref, state: 'active_catalog' as const }], unreviewedCount: 0 };

test('authenticated invoker sends only JWT and typed catalog body', async () => {
  const seen: unknown[] = [];
  const invoker = createAuthenticatedTourApiLiveInvoker({ accessToken: 'jwt', edge: { async invoke(name, options) { seen.push([name, options]); return { data: { ok: true }, error: null }; } } });
  await invoker.invoke({ action: 'catalog', approvedCandidates: [ref] });
  assert.deepEqual(seen, [['tourapi-live', { body: { action: 'catalog', approvedCandidates: [ref] }, headers: { Authorization: 'Bearer jwt' } }]]);
});

test('missing JWT fails before Edge and catalog validator rejects unapproved IDs', async () => {
  let calls = 0; const noAuth = createAuthenticatedTourApiLiveInvoker({ accessToken: ' ', edge: { async invoke() { calls += 1; return { data: null, error: null }; } } });
  assert.equal((await noAuth.invoke({ action: 'catalog', approvedCandidates: [] }) as { status: string }).status, 'unavailable'); assert.equal(calls, 0);
  const adapter = createTourApiLiveAdapter({ invoker: { async invoke() { return { kind: 'catalog', status: 'ready', snapshot: { ...snapshot, candidateStates: [{ contentId: '999', contentTypeId: '12', state: 'inactive' }], catalogPlaces: [] }, budgetToken: 't' }; } } });
  assert.equal((await adapter.loadCatalog([ref])).status, 'unavailable');
});

test('adapter exposes explicit catalog and detail batch ports and merge preserves snapshot identity', async () => {
  let calls = 0;
  const adapter = createTourApiLiveAdapter({ invoker: { async invoke(request) { calls += 1; if (request.action === 'catalog') return { kind: 'catalog', status: 'ready', snapshot, budgetToken: 't0' }; return { kind: 'detail_batch', status: 'ready', liveSourceSnapshotId: 's', details: [{ ...ref, opening: { rawText: '09:00~18:00' } }], candidateStates: [{ ...ref, state: 'active_ready' }], failures: [], budget: { detailIntroUsed: 1, detailIntroRemaining: 29, nextBatchMax: 6, detailCommonRemaining: 4, detailImageRemaining: 1 }, budgetToken: 't1' }; } } });
  const catalog = await adapter.loadCatalog([ref]); if (catalog.status === 'unavailable') assert.fail('catalog unavailable'); assert.equal(catalog.status, 'ready');
  const detail = await adapter.loadDetailBatch({ liveSourceSnapshotId: 's', budgetToken: catalog.budgetToken, candidates: [ref] }); if (detail.status === 'unavailable') assert.fail('detail unavailable'); assert.equal(detail.status, 'ready');
  const merged = mergeTourLiveDetailBatches(catalog.snapshot, [detail]); assert.equal(merged?.places.length, 1); assert.equal(merged?.liveSourceSnapshotId, 's'); assert.equal(calls, 2);
});

test('explicit retry is catalog-session restart only and is capped once', async () => {
  let calls = 0; const adapter = createTourApiLiveAdapter({ invoker: { async invoke() { calls += 1; return { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'timeout', status: null } }; } } });
  await adapter.loadCatalog([]); await adapter.retryCatalog([]); const blocked = await adapter.retryCatalog([]);
  assert.equal(calls, 2); assert.equal(blocked.status, 'unavailable'); if (blocked.status === 'unavailable') assert.equal(blocked.reason.code, 'request_budget_exhausted');
});
