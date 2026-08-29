import assert from 'node:assert/strict';
import test from 'node:test';
import { kakaoAddressSearchResult, kakaoPoiSearchMultiResult } from '../src/engine/kakao';
import { classifyLocationQuery, createKakaoLocationSearchAdapter } from '../src/services/kakaoLocationSearchAdapter';

const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function rawKakaoSearchers(input: { place?: unknown[]; address?: unknown[]; onRequest?: (kind: 'place' | 'address') => void }) {
  return {
    place: (query: string) => kakaoPoiSearchMultiResult(query, undefined, 10, {
      apiKey: 'fixture', fetcher: async () => { input.onRequest?.('place'); return response({ documents: input.place ?? [] }); },
    }),
    address: (query: string) => kakaoAddressSearchResult(query, 10, {
      apiKey: 'fixture', fetcher: async () => { input.onRequest?.('address'); return response({ documents: input.address ?? [] }); },
    }),
  };
}

test('APIS5-01: 일반 장소명은 Kakao place만 먼저 호출하고 원문 POI 변환을 공통 위치 제안으로 보존한다', async () => {
  const adapter = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ place: [{ place_name: '사상역', address_name: '부산', x: '129', y: '35.16' }] }),
  });
  const result = await adapter.search('사상역');
  assert.equal(classifyLocationQuery('사상역'), 'place');
  assert.deepEqual(result.suggestions, [{ kind: 'place', provider: 'kakao', label: '사상역', lat: 35.16, lon: 129, address: '부산', labelSource: 'provider', addressSource: 'provider' }]);
  assert.deepEqual(result.diagnostics, { providerRequests: { kakao: { place: 1, address: 0 }, tmap: 0 }, fallbackCount: 0, cache: 'miss' });
});

test('APIS5-02: 도로명·번지·동/리 주소 신호는 Kakao address만 먼저 호출한다', async () => {
  const adapter = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ address: [{ address_name: '부산진구 중앙대로 10', x: '129', y: '35.15' }] }),
  });
  const result = await adapter.search('중앙대로 10번');
  assert.equal(classifyLocationQuery('중앙대로 10번'), 'address');
  assert.equal(classifyLocationQuery('부전동'), 'address');
  assert.equal(classifyLocationQuery('사상동역'), 'place');
  assert.equal(classifyLocationQuery('2번 출구'), 'place');
  assert.equal(result.suggestions[0]?.kind, 'address');
  assert.deepEqual(result.diagnostics.providerRequests, { kakao: { place: 0, address: 1 }, tmap: 0 });
});

test('APIS5-03: 0건일 때만 장소→주소와 주소→장소를 각각 한 번 fallback한다', async () => {
  const placeToAddress = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ address: [{ address_name: '부산', x: '129', y: '35.16' }] }),
  });
  const addressToPlace = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ place: [{ place_name: '중앙대로역', address_name: '부산', x: '129', y: '35.16' }] }),
  });
  const first = await placeToAddress.search('사상역');
  const second = await addressToPlace.search('중앙대로 10번');
  assert.deepEqual(first.diagnostics.providerRequests, { kakao: { place: 1, address: 1 }, tmap: 0 });
  assert.deepEqual(second.diagnostics.providerRequests, { kakao: { place: 1, address: 1 }, tmap: 0 });
  assert.deepEqual([first.diagnostics.fallbackCount, second.diagnostics.fallbackCount], [1, 1]);
  assert.deepEqual([first.suggestions[0]?.kind, second.suggestions[0]?.kind], ['address', 'place']);
});

test('APIS5-04: 양쪽 Kakao 검색이 0건이면 빈 제안만 반환하고 TMAP은 호출하지 않는다', async () => {
  const adapter = createKakaoLocationSearchAdapter({ searchers: rawKakaoSearchers({}) });
  const result = await adapter.search('사상역');
  assert.deepEqual(result.suggestions, []);
  assert.deepEqual(result.diagnostics, { providerRequests: { kakao: { place: 1, address: 1 }, tmap: 0 }, fallbackCount: 1, cache: 'miss' });
});

test('APIS5-05: 동일 검색 10회는 진행 중 요청을 하나로 합치고 Kakao를 한 번만 호출한다', async () => {
  let requests = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const adapter = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ place: [{ place_name: '사상역', address_name: '부산', x: '129', y: '35.16' }], onRequest: async () => { requests += 1; await gate; } }),
  });
  const pending = Array.from({ length: 10 }, () => adapter.search('사상역'));
  await Promise.resolve();
  assert.equal(requests, 1);
  release?.();
  const results = await Promise.all(pending);
  assert.equal(requests, 1);
  assert.equal(results.filter((item) => item.diagnostics.cache === 'miss').length, 1);
  assert.equal(results.filter((item) => item.diagnostics.cache === 'shared_in_flight').length, 9);
  assert.ok(results.every((item) => item.diagnostics.providerRequests.tmap === 0));
});

test('APIS5-06: 10분 TTL 안에는 hit를 재사용하고 만료 뒤에만 Kakao를 다시 호출한다', async () => {
  let now = 0;
  let requests = 0;
  const adapter = createKakaoLocationSearchAdapter({
    now: () => now,
    ttlMs: 10 * 60 * 1000,
    searchers: rawKakaoSearchers({ place: [{ place_name: '사상역', address_name: '부산', x: '129', y: '35.16' }], onRequest: () => { requests += 1; } }),
  });
  const first = await adapter.search('사상역');
  const hit = await adapter.search(' 사상역 ');
  now += 10 * 60 * 1000 + 1;
  const expired = await adapter.search('사상역');
  assert.deepEqual([first.diagnostics.cache, hit.diagnostics.cache, expired.diagnostics.cache], ['miss', 'hit', 'miss']);
  assert.equal(requests, 2);
});

test('APIS5R-01: network_error 완료 결과는 cache하지 않아 다음 명시 검색이 실제 Kakao 요청을 다시 한다', async () => {
  let requests = 0;
  const adapter = createKakaoLocationSearchAdapter({
    searchers: {
      place: (query) => kakaoPoiSearchMultiResult(query, undefined, 10, {
        apiKey: 'fixture', fetcher: async () => { requests += 1; throw new Error('offline'); },
      }),
    },
  });
  const first = await adapter.search('사상역');
  const second = await adapter.search('사상역');
  assert.deepEqual([first.diagnostics.cache, second.diagnostics.cache], ['miss', 'miss']);
  assert.deepEqual([first.attempts[0]?.status, second.attempts[0]?.status], ['network_error', 'network_error']);
  assert.equal(requests, 2);
});

test('APIS5R-02: fallback 중 http_error가 있으면 저장하지 않고 다음 검색도 같은 순서·상한으로 재시도한다', async () => {
  let placeRequests = 0;
  let addressRequests = 0;
  const adapter = createKakaoLocationSearchAdapter({
    searchers: {
      place: (query) => kakaoPoiSearchMultiResult(query, undefined, 10, {
        apiKey: 'fixture', fetcher: async () => { placeRequests += 1; return response({ documents: [] }); },
      }),
      address: (query) => kakaoAddressSearchResult(query, 10, {
        apiKey: 'fixture', fetcher: async () => { addressRequests += 1; return { ok: false, status: 429, json: async () => ({}) } as Response; },
      }),
    },
  });
  const first = await adapter.search('사상역');
  const second = await adapter.search('사상역');
  assert.deepEqual([first.diagnostics.cache, second.diagnostics.cache], ['miss', 'miss']);
  assert.deepEqual(first.attempts.map((attempt) => attempt.status), ['ok', 'http_error']);
  assert.deepEqual(second.attempts.map((attempt) => attempt.status), ['ok', 'http_error']);
  assert.deepEqual(first.diagnostics.providerRequests, { kakao: { place: 1, address: 1 }, tmap: 0 });
  assert.equal(first.diagnostics.fallbackCount, 1);
  assert.deepEqual([placeRequests, addressRequests], [2, 2]);
});

test('APIS5R-03: 성공 장소·주소와 성공 0건 결과만 정규화 key의 TTL hit로 재사용한다', async () => {
  let placeRequests = 0;
  let addressRequests = 0;
  const adapter = createKakaoLocationSearchAdapter({
    searchers: {
      place: (query) => kakaoPoiSearchMultiResult(query, undefined, 10, {
        apiKey: 'fixture', fetcher: async () => { placeRequests += 1; return response({ documents: [] }); },
      }),
      address: (query) => kakaoAddressSearchResult(query, 10, {
        apiKey: 'fixture', fetcher: async () => { addressRequests += 1; return response({ documents: [] }); },
      }),
    },
  });
  const first = await adapter.search('사상역');
  const hit = await adapter.search(' 사상역 ');
  assert.deepEqual([first.diagnostics.cache, hit.diagnostics.cache], ['miss', 'hit']);
  assert.deepEqual([placeRequests, addressRequests], [1, 1]);
  assert.deepEqual(hit.suggestions, []);
});

test('APIS5R-04: 같은 실패 검색 10회는 진행 중 1회를 공유하지만 완료 뒤 새 검색은 실제 요청한다', async () => {
  let requests = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const adapter = createKakaoLocationSearchAdapter({
    searchers: {
      place: (query) => kakaoPoiSearchMultiResult(query, undefined, 10, {
        apiKey: 'fixture', fetcher: async () => { requests += 1; await gate; throw new Error('offline'); },
      }),
    },
  });
  const pending = Array.from({ length: 10 }, () => adapter.search('사상역'));
  await Promise.resolve();
  assert.equal(requests, 1);
  release?.();
  const results = await Promise.all(pending);
  assert.equal(results.filter((item) => item.diagnostics.cache === 'miss').length, 1);
  assert.equal(results.filter((item) => item.diagnostics.cache === 'shared_in_flight').length, 9);
  await adapter.search('사상역');
  assert.equal(requests, 2);
});

test('APIS5R-05: Kakao 원문 카테고리 노선 근거만 위치 제안에 보존하고 없으면 생략한다', async () => {
  const withLine = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ place: [{ place_name: '사상역', address_name: '부산', x: '129', y: '35.16', category_group_code: 'SW8', category_name: '교통, 지하철역, 부산2호선' }] }),
  });
  const withoutLine = createKakaoLocationSearchAdapter({
    searchers: rawKakaoSearchers({ place: [{ place_name: '사상역', address_name: '부산', x: '129', y: '35.16', category_group_code: 'SW8', category_name: '교통, 지하철역' }] }),
  });
  const provided = await withLine.search('사상역');
  const absent = await withoutLine.search('사상역');
  assert.deepEqual(provided.suggestions[0]?.providerLineLabels, ['2호선']);
  assert.equal('providerLineLabels' in (absent.suggestions[0] ?? {}), false);
  assert.ok([provided, absent].every((result) => result.diagnostics.providerRequests.tmap === 0));
});
