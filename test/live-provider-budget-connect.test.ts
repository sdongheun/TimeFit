import assert from 'node:assert/strict';
import test from 'node:test';
import { createTourApiLiveHandler } from '../supabase/functions/tourapi-live/handler';
import { createBusanLiveHandler } from '../supabase/functions/busan-live/handler';
import { createLiveProviderBudgetPort } from '../supabase/functions/_shared/liveProviderBudget';

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const tourRequest = (body: unknown) => new Request('https://fixture.invalid/tourapi-live', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify(body) });
const busanRequest = () => new Request('https://fixture.invalid/busan-live', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify({ action: 'catalog_snapshot', liveSourceSnapshotId: 'fixture-snapshot', approvedSourceIds: { busan_attraction: [], busan_food: [], busan_shopping: [] }, approvedPhotos: { busan_attraction: [], busan_food: [], busan_shopping: [] } }) });
const tourEnvelope = (items: unknown[], totalCount = items.length) => response({ response: { header: { resultCode: '0000' }, body: { totalCount, items: { item: items } } } });
const busanEnvelope = (operation: string) => response({ [operation]: { header: { resultCode: '00' }, item: [], numOfRows: 500, pageNo: 1, totalCount: 0 } });
const codec = { async encode(value: unknown) { return JSON.stringify(value); }, async decode(value: string) { return JSON.parse(value); } };

test('RPC port accepts exactly one committed grant and rejects missing, denied, malformed, and thrown results', async () => {
  const calls: Array<[string, unknown]> = [];
  const port = createLiveProviderBudgetPort({ async rpc(name, args) { calls.push([name, args]); return { data: [{ granted: true, reason: 'granted' }], error: null }; } });
  assert.equal(await port.reserve('tourapi', 'catalog_page'), 'granted');
  assert.deepEqual(calls, [['reserve_live_provider_attempt', { p_credential_scope: 'tourapi', p_operation: 'catalog_page' }]]);
  for (const result of [
    { data: [{ granted: false, reason: 'limit' }], error: null },
    { data: [{ granted: false, reason: 'unconfigured' }], error: null },
    { data: [{ granted: true, reason: 'granted' }, { granted: true, reason: 'granted' }], error: null },
    { data: [{ granted: true, reason: 'wrong' }], error: null },
    { data: null, error: { message: 'private' } },
  ]) {
    const closed = createLiveProviderBudgetPort({ async rpc() { return result; } });
    assert.notEqual(await closed.reserve('tourapi', 'catalog_page'), 'granted');
  }
  const thrown = createLiveProviderBudgetPort({ async rpc() { throw new Error('private'); } });
  assert.equal(await thrown.reserve('busan_public_data', 'food_page'), 'unavailable');
});

test('Tour catalog and detail reserve immediately before each HTTP; missing and denied ports fetch zero', async () => {
  for (const reserveProviderAttempt of [undefined, async () => 'limit' as const, async () => { throw new Error('private'); }]) {
    let fetches = 0;
    const edge = createTourApiLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, sessionCodec: codec, reserveProviderAttempt, fetch: async () => { fetches += 1; return tourEnvelope([]); } });
    const body = await (await edge(tourRequest({ action: 'catalog', approvedCandidates: [] }))).json();
    assert.equal(body.status, 'unavailable'); assert.equal(fetches, 0); assert.doesNotMatch(JSON.stringify(body), /private/);
  }
  const seen: string[] = []; let fetches = 0;
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, sessionCodec: codec, randomId: () => 'fixture-snapshot', reserveProviderAttempt: async (operation) => { seen.push(operation); return 'granted'; }, fetch: async (url) => {
    fetches += 1; const value = new URL(String(url));
    return value.pathname.endsWith('/areaBasedList2') ? tourEnvelope([{ contentid: '1', contenttypeid: '12', title: 'fixture', mapx: '129.1', mapy: '35.1' }]) : tourEnvelope([{ contentid: '1', contenttypeid: '12', usetime: '09:00~18:00' }]);
  } });
  const catalog = await (await edge(tourRequest({ action: 'catalog', approvedCandidates: [{ contentId: '1', contentTypeId: '12' }] }))).json();
  const detail = await (await edge(tourRequest({ action: 'detail_batch', liveSourceSnapshotId: catalog.snapshot.liveSourceSnapshotId, budgetToken: catalog.budgetToken, candidates: [{ contentId: '1', contentTypeId: '12' }] }))).json();
  assert.equal(detail.status, 'ready'); assert.deepEqual(seen, ['catalog_page', 'catalog_page', 'catalog_page', 'catalog_page', 'catalog_page', 'detail_intro']); assert.equal(fetches, 6);
});

test('Tour reserves page two separately and preserves a granted detail when another reservation is denied', async () => {
  let listCalls = 0; const listReservations: string[] = [];
  const incomplete = createTourApiLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, sessionCodec: codec, reserveProviderAttempt: async (operation) => { listReservations.push(operation); return listReservations.length === 1 ? 'granted' : 'limit'; }, fetch: async () => { listCalls += 1; return tourEnvelope([{ contentid: '1', contenttypeid: '12', title: 'fixture', mapx: '129.1', mapy: '35.1' }], 2); } });
  const catalogFailure = await (await incomplete(tourRequest({ action: 'catalog', approvedCandidates: [{ contentId: '1', contentTypeId: '12' }] }))).json();
  assert.equal(catalogFailure.status, 'unavailable'); assert.equal(catalogFailure.reason.code, 'request_budget_exhausted');
  assert.deepEqual(listReservations, ['catalog_page', 'catalog_page', 'catalog_page', 'catalog_page', 'catalog_page', 'catalog_page']); assert.equal(listCalls, 1);

  let fetches = 0; const operations: string[] = [];
  const edge = createTourApiLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, sessionCodec: codec, randomId: () => 'fixture-snapshot', reserveProviderAttempt: async (operation) => { operations.push(operation); return operation === 'detail_intro' && operations.filter((item) => item === 'detail_intro').length === 2 ? 'limit' : 'granted'; }, fetch: async (url) => {
    fetches += 1; const value = new URL(String(url));
    return value.pathname.endsWith('/areaBasedList2') ? tourEnvelope([1, 2].map((id) => ({ contentid: String(id), contenttypeid: '12', title: `fixture-${id}`, mapx: '129.1', mapy: '35.1' }))) : tourEnvelope([{ contentid: value.searchParams.get('contentId'), contenttypeid: '12', usetime: '09:00~18:00' }]);
  } });
  const catalog = await (await edge(tourRequest({ action: 'catalog', approvedCandidates: [1, 2].map((id) => ({ contentId: String(id), contentTypeId: '12' })) }))).json();
  const detail = await (await edge(tourRequest({ action: 'detail_batch', liveSourceSnapshotId: catalog.snapshot.liveSourceSnapshotId, budgetToken: catalog.budgetToken, candidates: [1, 2].map((id) => ({ contentId: String(id), contentTypeId: '12' })) }))).json();
  assert.equal(detail.status, 'partial'); assert.equal(detail.details.length, 1); assert.equal(detail.candidateStates.filter((item: { state: string }) => item.state === 'active_detail_failed').length, 1);
  assert.deepEqual(operations, ['catalog_page', 'catalog_page', 'catalog_page', 'catalog_page', 'catalog_page', 'detail_intro', 'detail_intro']); assert.equal(fetches, 6);
});

test('Busan maps each source to one allowlisted operation, rejects missing port, and preserves ready sources on denial', async () => {
  let fetches = 0;
  const missing = createBusanLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, fetch: async () => { fetches += 1; return busanEnvelope('getAttractionKr'); } });
  const missingBody = await (await missing(busanRequest())).json();
  assert.equal(missingBody.status, 'unavailable'); assert.equal(missingBody.providerCalls, 0); assert.equal(fetches, 0);

  const seen: string[] = [];
  const edge = createBusanLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, reserveProviderAttempt: async (operation) => { seen.push(operation); return operation === 'food_page' ? 'limit' : 'granted'; }, fetch: async (url) => {
    fetches += 1; const path = new URL(String(url)).pathname;
    return busanEnvelope(path.endsWith('getAttractionKr') ? 'getAttractionKr' : path.endsWith('getFoodKr') ? 'getFoodKr' : 'getShoppingKr');
  } });
  const body = await (await edge(busanRequest())).json();
  assert.equal(body.status, 'partial'); assert.equal(body.sources.busan_food.status, 'unavailable');
  assert.equal(body.sources.busan_attraction.status, 'ready'); assert.equal(body.sources.busan_shopping.status, 'ready');
  assert.deepEqual([...seen].sort(), ['attractions_page', 'food_page', 'shopping_page']);
  assert.equal(fetches, 2); assert.equal(body.providerCalls, 2);
});

test('Busan DB exception and client quota fields fail closed before provider', async () => {
  let fetches = 0; let reservations = 0;
  const edge = createBusanLiveHandler({ serviceKey: 'fixture', authenticate: async () => true, reserveProviderAttempt: async () => { reservations += 1; throw new Error('private-db-error'); }, fetch: async () => { fetches += 1; return busanEnvelope('getAttractionKr'); } });
  const unavailable = await (await edge(busanRequest())).text(); assert.equal(JSON.parse(unavailable).providerCalls, 0); assert.equal(fetches, 0); assert.equal(reservations, 3); assert.doesNotMatch(unavailable, /private-db-error/);
  const withClientCap = await edge(new Request('https://fixture.invalid/busan-live', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify({ action: 'catalog_snapshot', liveSourceSnapshotId: 'fixture-snapshot', approvedSourceIds: { busan_attraction: [], busan_food: [], busan_shopping: [] }, approvedPhotos: { busan_attraction: [], busan_food: [], busan_shopping: [] }, quota: 999999 }) }));
  assert.equal(withClientCap.status, 400); assert.equal(fetches, 0); assert.equal(reservations, 3);
});
