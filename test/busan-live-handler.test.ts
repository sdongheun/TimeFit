import assert from 'node:assert/strict';
import test from 'node:test';
import { createBusanLiveHandler as createRawBusanLiveHandler, createProviderCallBudget } from '../supabase/functions/busan-live/handler';

const createBusanLiveHandler = (deps: Parameters<typeof createRawBusanLiveHandler>[0]) => createRawBusanLiveHandler({ reserveProviderAttempt: async () => 'granted', ...deps });

const operations = {
  AttractionService: 'getAttractionKr',
  FoodService: 'getFoodKr',
  ShoppingService: 'getShoppingKr',
} as const;
const sourceIds = { busan_attraction: ['101'], busan_food: ['201'], busan_shopping: ['301'] } as const;
const row = (id: string, image = `https://images.example/${id}.jpg`) => ({ UC_SEQ: id, MAIN_TITLE: `place-${id}`, ADDR1: `address-${id}`, LAT: '35.1', LNG: '129.1', USAGE_DAY_WEEK_AND_TIME: '09:00~18:00', HLDY_INFO: '월요일', ITEMCNTNTS: `description-${id}`, MAIN_IMG_NORMAL: image });
const envelope = (operation: string, rows: unknown[], pageNo = 1, totalCount = rows.length) => ({ [operation]: { header: { resultCode: '00', resultMsg: 'OK' }, item: rows, numOfRows: 500, pageNo, totalCount } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const approvedPhotos = {
  busan_attraction: [{ sourceId: '101', url: 'https://images.example/101.jpg', attribution: '자료: 부산광역시 부산명소정보 서비스', sourcePageUrl: 'https://www.data.go.kr/data/15063481/openapi.do', licenseName: '이용허락범위 제한 없음' as const, commercialUseAllowed: true as const, modificationAllowed: true as const, verifiedAt: '2026-09-22' }],
  busan_food: [],
  busan_shopping: [],
};
const body = (snapshot = 'snapshot-1') => ({ action: 'catalog_snapshot', liveSourceSnapshotId: snapshot, approvedSourceIds: sourceIds, approvedPhotos });
const request = (payload: unknown, token = 'fixture-token') => new Request('https://edge.test/busan-live', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const operationFor = (url: URL) => Object.entries(operations).find(([service]) => url.pathname.includes(service))?.[1] ?? '';
const defaultFetch = async (input: string | URL | Request) => {
  const url = new URL(String(input)); const operation = operationFor(url); const id = operation === 'getAttractionKr' ? '101' : operation === 'getFoodKr' ? '201' : '301';
  return response(envelope(operation, [row(id)]));
};

test('normal snapshot makes three fixed full-list calls and returns only approved exact IDs', async () => {
  const seen: URL[] = [];
  const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async (input) => { seen.push(new URL(String(input))); return defaultFetch(input); } });
  const result = await edge(request(body())); const output = await result.json();
  assert.equal(output.status, 'ready'); assert.equal(output.providerCalls, 3); assert.equal(seen.length, 3);
  for (const url of seen) { assert.equal(url.searchParams.get('numOfRows'), '500'); assert.equal(url.searchParams.get('pageNo'), '1'); assert.equal(url.searchParams.get('resultType'), 'json'); assert.equal(url.searchParams.has('UC_SEQ'), false); }
  assert.deepEqual(output.sources.busan_attraction.activeApprovedSourceIds, ['101']);
  assert.equal(output.sources.busan_attraction.records[0].photo.status, 'approved');
});

test('one two-page source uses four calls and all two-page sources use six calls', async () => {
  for (const allTwoPages of [false, true]) {
    let calls = 0;
    const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async (input) => {
      calls += 1; const url = new URL(String(input)); const operation = operationFor(url); const pageNo = Number(url.searchParams.get('pageNo')); const id = operation === 'getAttractionKr' ? '101' : operation === 'getFoodKr' ? '201' : '301'; const twoPages = allTwoPages || operation === 'getAttractionKr';
      const rows = pageNo === 1 && twoPages ? Array.from({ length: 500 }, (_, index) => row(index === 0 ? id : `${id}${index}`)) : pageNo === 2 && twoPages ? [row(`${id}999`)] : [row(id)];
      return response(envelope(operation, rows, pageNo, twoPages ? 501 : 1));
    } });
    const output = await (await edge(request(body(allTwoPages ? 'snapshot-6' : 'snapshot-4')))).json();
    assert.equal(output.status, 'ready'); assert.equal(output.providerCalls, allTwoPages ? 6 : 4); assert.equal(calls, allTwoPages ? 6 : 4);
  }
});

test('seventh provider call is blocked by the hard budget', () => {
  const budget = createProviderCallBudget();
  for (let index = 0; index < 6; index += 1) assert.equal(budget.reserve(), true);
  assert.equal(budget.reserve(), false); assert.equal(budget.used(), 6);
});

test('totalCount over 1000, incomplete pages, and duplicate IDs fail only that source', async () => {
  for (const mode of ['over', 'incomplete', 'duplicate'] as const) {
    const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async (input) => {
      const url = new URL(String(input)); const operation = operationFor(url); const pageNo = Number(url.searchParams.get('pageNo')); const id = operation === 'getAttractionKr' ? '101' : operation === 'getFoodKr' ? '201' : '301';
      if (operation !== 'getAttractionKr') return response(envelope(operation, [row(id)]));
      if (mode === 'over') return response(envelope(operation, [row(id)], 1, 1001));
      if (mode === 'incomplete') return response(envelope(operation, pageNo === 1 ? [row(id)] : [], pageNo, 2));
      return response(envelope(operation, [row(id), row(id)], 1, 2));
    } });
    const output = await (await edge(request(body(`snapshot-${mode}`)))).json();
    assert.equal(output.status, 'partial'); assert.equal(output.sources.busan_attraction.status, 'unavailable'); assert.equal(output.sources.busan_food.status, 'ready'); assert.equal(output.sources.busan_shopping.status, 'ready');
    assert.equal(output.sources.busan_attraction.reason.code, mode === 'over' ? 'page_limit' : 'invalid_response');
    assert.equal('inactiveApprovedSourceIds' in output.sources.busan_attraction, false);
  }
});

test('one source failure is partial, all source failures are unavailable, and provider messages are hidden', async () => {
  for (const allFail of [false, true]) {
    const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async (input) => {
      const url = new URL(String(input)); const operation = operationFor(url); if (allFail || operation === 'getFoodKr') return response({ raw: 'provider-secret-message' }, 500); return defaultFetch(input);
    } });
    const text = await (await edge(request(body(allFail ? 'snapshot-all-fail' : 'snapshot-partial')))).text(); const output = JSON.parse(text);
    assert.equal(output.status, allFail ? 'unavailable' : 'partial'); assert.doesNotMatch(text, /provider-secret-message/);
    if (!allFail) { assert.equal(output.sources.busan_attraction.status, 'ready'); assert.equal(output.sources.busan_food.status, 'unavailable'); assert.equal(output.sources.busan_shopping.status, 'ready'); }
  }
});

test('complete list alone marks approved missing ID inactive and never returns unapproved new IDs', async () => {
  const base = body(); const payload = { ...base, approvedSourceIds: { ...base.approvedSourceIds, busan_attraction: ['101', '102'] } };
  const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async (input) => { const url = new URL(String(input)); const operation = operationFor(url); const id = operation === 'getAttractionKr' ? '101' : operation === 'getFoodKr' ? '201' : '301'; return response(envelope(operation, [row(id), row('999')])); } });
  const output = await (await edge(request(payload))).json();
  assert.deepEqual(output.sources.busan_attraction.inactiveApprovedSourceIds, ['102']); assert.deepEqual(output.sources.busan_attraction.records.map((item: { sourceId: string }) => item.sourceId), ['101']); assert.doesNotMatch(JSON.stringify(output), /place-999|description-999/);
});

test('coordinates/search/base URL/page/key fields are rejected and auth failure calls provider zero times', async () => {
  for (const extra of [{ latitude: 35 }, { search: 'place' }, { baseURL: 'https://example.test' }, { pageNo: 1 }, { ServiceKey: 'forbidden' }]) {
    let calls = 0; const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async () => { calls += 1; return response({}); } });
    const result = await edge(request({ ...body('snapshot-reject'), ...extra })); assert.equal(result.status, 400); assert.equal(calls, 0);
  }
  let calls = 0; const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => false, fetch: async () => { calls += 1; return response({}); } });
  const output = await (await edge(request(body('snapshot-auth')))).json(); assert.equal(output.reason.code, 'unauthorized'); assert.equal(output.providerCalls, 0); assert.equal(calls, 0);
});

test('changed provider photo URL is not returned as approved', async () => {
  const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, fetch: async (input) => { const url = new URL(String(input)); const operation = operationFor(url); const id = operation === 'getAttractionKr' ? '101' : operation === 'getFoodKr' ? '201' : '301'; return response(envelope(operation, [row(id, id === '101' ? 'https://images.example/changed.jpg' : undefined)])); } });
  const text = await (await edge(request(body('snapshot-photo')))).text(); const output = JSON.parse(text);
  assert.equal(output.sources.busan_attraction.records[0].photo.status, 'not_returned_without_approved_evidence'); assert.doesNotMatch(text, /changed\.jpg/);
});

test('timeout and missing resultCode become safe source failures without retry', async () => {
  for (const mode of ['timeout', 'missing-code'] as const) {
    let attractionCalls = 0;
    const edge = createBusanLiveHandler({ serviceKey: 'secret', authenticate: async () => true, timeoutSignal: () => new AbortController().signal, fetch: async (input) => {
      const url = new URL(String(input)); const operation = operationFor(url); const id = operation === 'getAttractionKr' ? '101' : operation === 'getFoodKr' ? '201' : '301';
      if (operation === 'getAttractionKr') { attractionCalls += 1; if (mode === 'timeout') throw new DOMException('fixture', 'TimeoutError'); return response({ [operation]: { header: {}, item: [row(id)], numOfRows: 500, pageNo: 1, totalCount: 1 } }); }
      return response(envelope(operation, [row(id)]));
    } });
    const output = await (await edge(request(body(`snapshot-${mode}`)))).json();
    assert.equal(output.status, 'partial'); assert.equal(output.sources.busan_attraction.reason.code, mode === 'timeout' ? 'timeout' : 'invalid_response'); assert.equal(attractionCalls, 1);
  }
});
