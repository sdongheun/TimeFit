import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedBusanLiveInvoker, createBusanLiveAdapter, type BusanLiveRequest } from '../src/services/busanLiveAdapter';

const request: BusanLiveRequest = { action: 'catalog_snapshot', liveSourceSnapshotId: 's1', approvedSourceIds: { busan_attraction: ['1'], busan_food: [], busan_shopping: [] }, approvedPhotos: { busan_attraction: [], busan_food: [], busan_shopping: [] } };
const ready = (snapshot = 's1') => ({ status: 'ready', liveSourceSnapshotId: snapshot, providerCalls: 3, sources: {
  busan_attraction: { status: 'ready', complete: true, providerCalls: 1, activeApprovedSourceIds: ['1'], inactiveApprovedSourceIds: [], records: [{ source: 'busan_attraction', sourceId: '1', title: 'place', lat: 35.1, lon: 129.1, photo: { status: 'not_returned_without_approved_evidence' } }] },
  busan_food: { status: 'ready', complete: true, providerCalls: 1, activeApprovedSourceIds: [], inactiveApprovedSourceIds: [], records: [] },
  busan_shopping: { status: 'ready', complete: true, providerCalls: 1, activeApprovedSourceIds: [], inactiveApprovedSourceIds: [], records: [] },
} });

test('authenticated invoker sends only JWT and typed body; missing JWT stops before Edge', async () => {
  const seen: unknown[] = [];
  const invoker = createAuthenticatedBusanLiveInvoker({ accessToken: 'jwt', edge: { async invoke(name, options) { seen.push([name, options]); return { data: ready(), error: null }; } } });
  await invoker.invoke(request); assert.deepEqual(seen, [['busan-live', { body: request, headers: { Authorization: 'Bearer jwt' } }]]);
  let calls = 0; const missing = createAuthenticatedBusanLiveInvoker({ accessToken: ' ', edge: { async invoke() { calls += 1; return { data: null, error: null }; } } });
  const result = await missing.invoke(request) as { providerCalls: number; reason: { code: string } }; assert.equal(result.reason.code, 'unauthorized'); assert.equal(result.providerCalls, 0); assert.equal(calls, 0);
});

test('adapter rejects unapproved IDs, mismatched snapshots, and call totals over six', async () => {
  for (const mutation of [
    () => ({ ...ready(), sources: { ...ready().sources, busan_attraction: { ...ready().sources.busan_attraction, activeApprovedSourceIds: ['999'], records: [] } } }),
    () => ready('different'),
    () => ({ ...ready(), providerCalls: 7 }),
  ]) {
    const adapter = createBusanLiveAdapter({ invoker: { async invoke() { return mutation(); } } }); const result = await adapter.loadSnapshot(request);
    assert.equal(result.status, 'unavailable'); if (!('sources' in result)) assert.equal(result.reason.code, 'invalid_response');
  }
});

test('explicit retry requires a new snapshot and is capped once', async () => {
  let calls = 0; const adapter = createBusanLiveAdapter({ invoker: { async invoke(value) { calls += 1; return ready(value.liveSourceSnapshotId); } } });
  await adapter.loadSnapshot(request);
  const same = await adapter.retrySnapshot(request); assert.equal(same.status, 'unavailable');
  const retried = await adapter.retrySnapshot({ ...request, liveSourceSnapshotId: 's2' }); assert.equal(retried.status, 'ready');
  const blocked = await adapter.retrySnapshot({ ...request, liveSourceSnapshotId: 's3' }); assert.equal(blocked.status, 'unavailable'); assert.equal(calls, 2);
});
