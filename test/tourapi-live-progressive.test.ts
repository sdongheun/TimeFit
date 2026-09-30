import assert from 'node:assert/strict';
import test from 'node:test';

import { createTourApiLiveHandler as createRawTourApiLiveHandler, TOUR_LIVE_LIMITS } from '../supabase/functions/tourapi-live/handler';

const createTourApiLiveHandler = (deps: Parameters<typeof createRawTourApiLiveHandler>[0]) => createRawTourApiLiveHandler({ reserveProviderAttempt: async () => 'granted', ...deps });

const ref = (id: number) => ({ contentId: String(id), contentTypeId: '12' });
const listItem = (id: number) => ({ contentid: String(id), contenttypeid: '12', title: `place-${id}`, addr1: '부산광역시', mapx: String(129 + id / 10000), mapy: String(35 + id / 10000), modifiedtime: '20260921000000' });
const envelope = (items: unknown[], totalCount = items.length) => ({ response: { header: { resultCode: '0000' }, body: { totalCount, items: { item: items } } } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const post = (body: unknown, token = 'fixture-token') => new Request('https://edge.test/tourapi-live', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const codec = { async encode(value: unknown) { return JSON.stringify(value); }, async decode(value: string) { try { return JSON.parse(value); } catch { return null; } } };

function makeHarness(size = 30, failing = new Set<string>()) {
  let detailCalls = 0; let listCalls = 0;
  const edge = createTourApiLiveHandler({
    serviceKey: 'fixture-secret', authenticate: async (token) => token === 'fixture-token', sessionCodec: codec,
    randomId: () => 'live-snapshot', nowIso: () => '2026-09-21T00:00:00.000Z',
    fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/areaBasedList2')) { listCalls += 1; return response(envelope(Array.from({ length: size }, (_, index) => listItem(index + 1)))); }
      detailCalls += 1; const id = url.searchParams.get('contentId') ?? '';
      return failing.has(id) ? response({}, 500) : response(envelope([{ contentid: id, contenttypeid: '12', usetime: '09:00~18:00' }]));
    },
  });
  return { edge, counts: () => ({ detailCalls, listCalls }) };
}

async function catalog(edge: ReturnType<typeof createTourApiLiveHandler>, size = 30) {
  const result = await edge(post({ action: 'catalog', approvedCandidates: Array.from({ length: size }, (_, index) => ref(index + 1)) }));
  return { response: result, body: await result.json() };
}

async function batch(edge: ReturnType<typeof createTourApiLiveHandler>, token: string, ids: number[]) {
  const result = await edge(post({ action: 'detail_batch', liveSourceSnapshotId: 'live-snapshot', budgetToken: token, candidates: ids.map(ref) }));
  return { response: result, body: await result.json() };
}

test('catalog returns complete current common facts without detail calls or user coordinates', async () => {
  const harness = makeHarness(3); const result = await catalog(harness.edge, 3);
  assert.equal(result.body.status, 'ready'); assert.equal(result.body.kind, 'catalog');
  assert.equal(result.body.snapshot.catalogPlaces.length, 3); assert.equal(result.body.snapshot.liveSourceSnapshotId, 'live-snapshot');
  assert.deepEqual(harness.counts(), { listCalls: 5, detailCalls: 0 });
});

test('catalog requests only the five approved product types and never hotel, course, or festival', async () => {
  const seen: string[] = [];
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture-secret', authenticate: async () => true, sessionCodec: codec, fetch: async (input) => {
    const url = new URL(String(input)); seen.push(url.searchParams.get('contentTypeId') ?? ''); return response(envelope([]));
  } });
  const result = await edge(post({ action: 'catalog', approvedCandidates: [] }));
  assert.equal((await result.json()).status, 'ready');
  assert.deepEqual(seen.sort(), ['12', '14', '28', '38', '39']);
  assert.equal(seen.includes('15'), false); assert.equal(seen.includes('25'), false); assert.equal(seen.includes('32'), false);
});

test('each approved product type has its own complete two-page boundary', async () => {
  const seen: string[] = [];
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture-secret', authenticate: async () => true, sessionCodec: codec, fetch: async (input) => {
    const url = new URL(String(input)); const type = url.searchParams.get('contentTypeId') ?? ''; const page = url.searchParams.get('pageNo') ?? ''; seen.push(`${type}:${page}`);
    if (type === '12') return response(envelope(page === '1' ? Array.from({ length: 1000 }, (_, index) => listItem(index + 1)) : [listItem(1001)], 1001));
    return response(envelope([]));
  } });
  const result = await edge(post({ action: 'catalog', approvedCandidates: [ref(1)] }));
  assert.equal((await result.json()).status, 'ready');
  assert.deepEqual(seen.sort(), ['12:1', '12:2', '14:1', '28:1', '38:1', '39:1']);
});

test('hotel, travel-course, and festival candidate types are rejected before provider calls', async () => {
  let calls = 0;
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture-secret', authenticate: async () => true, sessionCodec: codec, fetch: async () => { calls += 1; return response(envelope([])); } });
  for (const contentTypeId of ['15', '25', '32']) {
    const result = await edge(post({ action: 'catalog', approvedCandidates: [{ contentId: '1', contentTypeId }] }));
    assert.equal(result.status, 400);
  }
  assert.equal(calls, 0);
});

test('initial 12 can stop without API automatically requesting another batch', async () => {
  const harness = makeHarness(); const first = await catalog(harness.edge); const detail = await batch(harness.edge, first.body.budgetToken, Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal(detail.body.status, 'ready'); assert.equal(detail.body.budget.detailIntroUsed, 12); assert.equal(detail.body.budget.nextBatchMax, 6);
  assert.equal(harness.counts().detailCalls, 12);
});

test('orchestrator can request 12+6 and receives the same snapshot ID', async () => {
  const harness = makeHarness(); const first = await catalog(harness.edge);
  const a = await batch(harness.edge, first.body.budgetToken, Array.from({ length: 12 }, (_, index) => index + 1));
  const b = await batch(harness.edge, a.body.budgetToken, Array.from({ length: 6 }, (_, index) => index + 13));
  assert.equal(b.body.liveSourceSnapshotId, 'live-snapshot'); assert.equal(b.body.budget.detailIntroUsed, 18); assert.equal(harness.counts().detailCalls, 18);
});

test('12+6+6+6 reaches hard cap 30 and a 31st unique ID is blocked before provider fetch', async () => {
  const harness = makeHarness(31); const first = await catalog(harness.edge, 31); let token = first.body.budgetToken;
  for (const ids of [Array.from({ length: 12 }, (_, i) => i + 1), Array.from({ length: 6 }, (_, i) => i + 13), Array.from({ length: 6 }, (_, i) => i + 19), Array.from({ length: 6 }, (_, i) => i + 25)]) {
    const result = await batch(harness.edge, token, ids); token = result.body.budgetToken;
  }
  assert.equal(harness.counts().detailCalls, 30);
  const blocked = await batch(harness.edge, token, [31]);
  assert.equal(blocked.response.status, 400); assert.equal(blocked.body.reason.code, 'request_budget_exhausted'); assert.equal(harness.counts().detailCalls, 30);
});

test('duplicate IDs are deduplicated and do not consume detail budget twice', async () => {
  const harness = makeHarness(); const first = await catalog(harness.edge);
  const ids = [1, 1, ...Array.from({ length: 11 }, (_, i) => i + 2)];
  const result = await batch(harness.edge, first.body.budgetToken, ids);
  assert.equal(result.body.budget.detailIntroUsed, 12); assert.equal(harness.counts().detailCalls, 12);
  const duplicate = await batch(harness.edge, result.body.budgetToken, [1, 1]);
  assert.equal(duplicate.body.budget.detailIntroUsed, 12); assert.equal(harness.counts().detailCalls, 12);
});

test('partial detail batch excludes failed detail but preserves active_detail_failed', async () => {
  const harness = makeHarness(12, new Set(['2'])); const first = await catalog(harness.edge, 12);
  const result = await batch(harness.edge, first.body.budgetToken, [1, 2]);
  assert.equal(result.body.status, 'partial');
  assert.deepEqual(result.body.candidateStates, [{ ...ref(1), state: 'active_ready' }, { ...ref(2), state: 'active_detail_failed' }]);
});

test('incomplete catalog page is unavailable and detail is never attempted', async () => {
  let calls = 0;
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture-secret', authenticate: async () => true, sessionCodec: codec, fetch: async () => { calls += 1; return calls === 1 ? response(envelope([listItem(1)], 1001)) : response({}, 500); } });
  const result = await edge(post({ action: 'catalog', approvedCandidates: [ref(1)] }));
  assert.equal((await result.json()).status, 'unavailable'); assert.equal(calls, 6);
});

test('coordinate-shaped catalog and detail inputs are rejected before provider calls', async () => {
  const harness = makeHarness();
  const badCatalog = await harness.edge(post({ action: 'catalog', approvedCandidates: [{ ...ref(1), lat: 35 }] }));
  assert.equal(badCatalog.status, 400); assert.deepEqual(harness.counts(), { listCalls: 0, detailCalls: 0 });
  const first = await catalog(harness.edge);
  const badDetail = await harness.edge(post({ action: 'detail_batch', liveSourceSnapshotId: 'live-snapshot', budgetToken: first.body.budgetToken, candidates: [{ ...ref(1), lon: 129 }] }));
  assert.equal(badDetail.status, 400); assert.equal(harness.counts().detailCalls, 0);
});

test('progressive budgets are mechanically fixed without a legacy total request deadline', () => {
  assert.deepEqual(TOUR_LIVE_LIMITS, { listPagesPerType: 2, catalogContentTypes: 5, catalogConcurrency: 3, catalogCandidateLimit: 500, initialDetailBatch: 12, supplementalDetailBatch: 6, detailRequests: 30, detailCommonRequests: 4, detailImageRequests: 1, detailConcurrency: 3, listTimeoutMs: 4000, detailTimeoutMs: 3000, automaticRetries: 0 });
});

test('production budget token signature blocks tampering without a provider detail call', async () => {
  let detailCalls = 0;
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture-secret', authenticate: async () => true, randomId: () => 'signed-snapshot', fetch: async (input) => {
    const url = new URL(String(input)); if (url.pathname.endsWith('/detailIntro2')) detailCalls += 1;
    return response(envelope([listItem(1)]));
  } });
  const catalogResponse = await edge(post({ action: 'catalog', approvedCandidates: [ref(1)] })); const catalogBody = await catalogResponse.json();
  const token = catalogBody.budgetToken as string; const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  const result = await edge(post({ action: 'detail_batch', liveSourceSnapshotId: 'signed-snapshot', budgetToken: tampered, candidates: [ref(1)] }));
  assert.equal(result.status, 400); assert.equal(detailCalls, 0);
});
