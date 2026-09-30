import assert from 'node:assert/strict';
import test from 'node:test';
import { FunctionsHttpError } from '@supabase/functions-js';
import { createLiveMultiSourceProductionFacade, type LiveMultiSourceEdgePort } from '../src/services/liveMultiSourceProductionFactory';
import { restoreLiveFunctionHttpError } from '../src/services/liveMultiSourceProductionReceipt';
import type { LiveMultiSourceFacadeInput } from '../src/services/liveMultiSourceSessionFacade';
import type { TourApiLiveFunctionRequest } from '../src/services/tourApiLiveAdapter';

const refs = Array.from({ length: 18 }, (_, index) => ({ contentId: String(index + 1), contentTypeId: '12' }));
const approved: LiveMultiSourceFacadeInput = {
  approvedTourCandidates: refs,
  approvedSourceIds: { busan_attraction: ['10'], busan_food: [], busan_shopping: [] },
  approvedPhotos: { busan_attraction: [], busan_food: [], busan_shopping: [] },
};
const catalog = {
  kind: 'catalog' as const, status: 'ready' as const, budgetToken: 'server-token-0',
  snapshot: { liveSourceSnapshotId: 'production-snapshot-001', fetchedAt: '2026-09-22T00:00:00Z', unreviewedCount: 0, catalogPlaces: refs.map((ref) => ({ ...ref, title: `place-${ref.contentId}`, lat: 35.1, lon: 129.1 })), candidateStates: refs.map((ref) => ({ ...ref, state: 'active_catalog' as const })) },
};
const busan = (snapshot: string) => ({ status: 'ready' as const, liveSourceSnapshotId: snapshot, providerCalls: 3, sources: {
  busan_attraction: { status: 'ready' as const, complete: true as const, providerCalls: 1 as const, activeApprovedSourceIds: [], inactiveApprovedSourceIds: ['10'], records: [] },
  busan_food: { status: 'ready' as const, complete: true as const, providerCalls: 1 as const, activeApprovedSourceIds: [], inactiveApprovedSourceIds: [], records: [] },
  busan_shopping: { status: 'ready' as const, complete: true as const, providerCalls: 1 as const, activeApprovedSourceIds: [], inactiveApprovedSourceIds: [], records: [] },
} });

test('current session composes both authenticated functions into one facade lifetime', async () => {
  const seen: Array<{ name: string; authorization: string; request: TourApiLiveFunctionRequest | unknown }> = [];
  let detailUsed = 0;
  const edge: LiveMultiSourceEdgePort = { async invoke(name, options) {
    seen.push({ name, authorization: options.headers.Authorization, request: options.body });
    if (name === 'tourapi-live') {
      const request = options.body as TourApiLiveFunctionRequest;
      if (request.action === 'catalog') return { data: catalog, error: null };
      detailUsed += request.candidates.length;
      return { data: { kind: 'detail_batch', status: 'ready', liveSourceSnapshotId: request.liveSourceSnapshotId, details: request.candidates.map((ref) => ({ ...ref, opening: { rawText: '09:00~18:00' } })), candidateStates: request.candidates.map((ref) => ({ ...ref, state: 'active_ready' })), failures: [], budget: { detailIntroUsed: detailUsed, detailIntroRemaining: 30 - detailUsed, nextBatchMax: 6, detailCommonRemaining: 4, detailImageRemaining: 1 }, budgetToken: `server-token-${detailUsed}` }, error: null };
    }
    return { data: busan((options.body as { liveSourceSnapshotId: string }).liveSourceSnapshotId), error: null };
  } };
  const result = await createLiveMultiSourceProductionFacade({ auth: { async getSession() { return { accessToken: ' current-jwt ', expiresAt: 2_000 }; } }, edge, idFactory: () => 'opaque-production-001', nowEpochSeconds: () => 1_000 });
  assert.equal(result.status, 'ready'); if (result.status !== 'ready') return;
  const initial = await result.facade.initialize(approved); assert.equal(initial.status, 'active');
  const detail = await result.facade.loadDetails({ liveSourceSnapshotId: 'production-snapshot-001', sequence: 1, candidates: refs.slice(0, 12).map((ref) => ({ placeId: `place-${ref.contentId}`, ...ref })) });
  assert.equal(detail.status, 'accepted');
  assert.deepEqual(seen.map((item) => item.name), ['tourapi-live', 'busan-live', 'tourapi-live']);
  assert.ok(seen.every((item) => item.authorization === 'Bearer current-jwt'));
  assert.doesNotMatch(JSON.stringify({ initial, detail }), /current-jwt|server-token|budgetToken/);
  assert.equal(result.facade.view().counts.tourDetailRequested, 12);
});

for (const authCase of ['missing', 'throw', 'expired'] as const) test(`${authCase} session returns safe unavailable before provider`, async () => {
  let calls = 0;
  const edge: LiveMultiSourceEdgePort = { async invoke() { calls += 1; return { data: null, error: null }; } };
  const getSession = authCase === 'throw' ? async () => { throw new Error('fixture'); } : authCase === 'expired' ? async () => ({ accessToken: 'jwt', expiresAt: 10 }) : async () => null;
  const result = await createLiveMultiSourceProductionFacade({ auth: { getSession }, edge, idFactory: () => 'opaque-production-001', nowEpochSeconds: () => 10 });
  assert.deepEqual(result, { status: 'unavailable', reason: 'auth_session_unavailable' }); assert.equal(calls, 0);
});

test('non-2xx restoration reconstructs only typed unavailable fields and discards raw fields', async () => {
  const tourError = new FunctionsHttpError({ json: async () => ({ status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'rate_limited', status: 429, raw: 'secret' }, payload: 'discard' }) });
  const busanError = new FunctionsHttpError({ json: async () => ({ status: 'unavailable', providerCalls: 0, reason: { code: 'unauthorized', status: 401, token: 'secret' }, coordinates: [35, 129] }) });
  assert.deepEqual(await restoreLiveFunctionHttpError(tourError, 'tourapi-live'), { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'rate_limited', status: 429 } });
  assert.deepEqual(await restoreLiveFunctionHttpError(busanError, 'busan-live'), { status: 'unavailable', providerCalls: 0, reason: { code: 'unauthorized', status: 401 } });
  assert.equal(await restoreLiveFunctionHttpError(new FunctionsHttpError({ json: async () => ({ status: 'unavailable', reason: { code: 'unknown', status: 500 } }) }), 'busan-live'), null);
});
