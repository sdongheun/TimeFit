import assert from 'node:assert/strict';
import test from 'node:test';
import { kakaoPoiSearchMulti, kakaoPoiSearchMultiResult } from '../src/engine/kakao';
import { tmapPoiSearchMultiResult } from '../src/engine/travel';
import { matchPlaceNameQuery } from '../src/services/placeNameSemanticMatch';

const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

test('Kakao 성공 fixture는 사상역 관련 POI와 ok 상태를 함께 반환하고 기존 Poi[] wrapper를 유지한다', async () => {
  const fetcher: typeof fetch = async () => response(200, { documents: [{ place_name: '사상역', address_name: '부산 사상구', x: '128.999', y: '35.163' }] });
  const result = await kakaoPoiSearchMultiResult('사상역', undefined, 5, { apiKey: 'fixture', fetcher });
  const legacy = await kakaoPoiSearchMulti('사상역', undefined, 5);
  assert.equal(result.provider, 'kakao');
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.pois, [{ name: '사상역', addr: '부산 사상구', lat: 35.163, lon: 128.999 }]);
  assert.deepEqual(result.metrics, { rawPoiCount: 1, mappingValidCount: 1, directNameMatchCount: 1 });
  assert.ok(Array.isArray(legacy));
});

test('Kakao 실패 fixture는 키·검색어·원문 없이 설정·권한·쿼터·네트워크·형식 오류를 구분한다', async () => {
  const unconfigured = await kakaoPoiSearchMultiResult('x', undefined, 1, { apiKey: '' });
  const unauthorized = await kakaoPoiSearchMultiResult('x', undefined, 1, { apiKey: 'fixture', fetcher: async () => response(401, {}) });
  const forbidden = await kakaoPoiSearchMultiResult('x', undefined, 1, { apiKey: 'fixture', fetcher: async () => response(403, {}) });
  const limited = await kakaoPoiSearchMultiResult('x', undefined, 1, { apiKey: 'fixture', fetcher: async () => response(429, {}) });
  const malformed = await kakaoPoiSearchMultiResult('x', undefined, 1, { apiKey: 'fixture', fetcher: async () => response(200, {}) });
  const offline = await kakaoPoiSearchMultiResult('x', undefined, 1, { apiKey: 'fixture', fetcher: async () => { throw new Error('offline'); } });
  assert.deepEqual([unconfigured.status, unauthorized.status, forbidden.status, limited.status, malformed.status, offline.status], ['unconfigured', 'http_error', 'http_error', 'http_error', 'invalid_response', 'network_error']);
  assert.deepEqual([unauthorized.statusCode, forbidden.statusCode, limited.statusCode], [401, 403, 429]);
  for (const item of [unconfigured, unauthorized, forbidden, limited, malformed, offline]) {
    assert.deepEqual(Object.keys(item).sort(), item.statusCode ? ['metrics', 'pois', 'provider', 'status', 'statusCode'] : ['metrics', 'pois', 'provider', 'status']);
    assert.deepEqual(item.metrics, { rawPoiCount: 0, mappingValidCount: 0, directNameMatchCount: 0 });
  }
});

test('TMAP fallback fixture는 성공·실패 상태를 구분하고 실제가 아닌 값은 POI로 만들지 않는다', async () => {
  const success = await tmapPoiSearchMultiResult('사상역', undefined, 1, { apiKey: 'fixture', fetcher: async () => response(200, { searchPoiInfo: { pois: { poi: [{ name: '사상역', frontLat: '35.163', frontLon: '128.999', upperAddrName: '부산' }] } } }) });
  const failed = await tmapPoiSearchMultiResult('사상역', undefined, 1, { apiKey: 'fixture', fetcher: async () => response(429, {}) });
  assert.equal(success.status, 'ok');
  assert.equal(success.pois[0]?.name, '사상역');
  assert.equal(failed.status, 'http_error');
  assert.equal(failed.statusCode, 429);
});

test('장소명 요청은 keyword를 보존하고 TMAP 반경 기반 주변 POI 파라미터를 보내지 않으며 관련성 계수를 보존한다', async () => {
  let kakaoUrl = '';
  let tmapUrl = '';
  const kakao = await kakaoPoiSearchMultiResult('사상역', { lat: 35.16, lon: 128.98 }, 5, {
    apiKey: 'fixture', fetcher: async (url) => { kakaoUrl = String(url); return response(200, { documents: [{ place_name: '무관한 카페', x: '128.9', y: '35.1' }, { place_name: '사상역', x: '129', y: '35.16' }] }); },
  });
  const tmap = await tmapPoiSearchMultiResult('사상역', { lat: 35.16, lon: 128.98 }, 5, {
    apiKey: 'fixture', fetcher: async (url) => { tmapUrl = String(url); return response(200, { searchPoiInfo: { pois: { poi: [{ name: '무관한 카페', frontLat: '35.1', frontLon: '128.9' }] } } }); },
  });
  assert.match(kakaoUrl, /query=%EC%82%AC%EC%83%81%EC%97%AD/);
  assert.match(tmapUrl, /searchKeyword=%EC%82%AC%EC%83%81%EC%97%AD/);
  assert.doesNotMatch(kakaoUrl, /[?&](?:x|y|radius|sort)=/);
  assert.doesNotMatch(tmapUrl, /radius=|searchtypCd=|centerLat=|centerLon=/);
  assert.deepEqual(kakao.metrics, { rawPoiCount: 2, mappingValidCount: 2, directNameMatchCount: 1 });
  assert.deepEqual(tmap.metrics, { rawPoiCount: 1, mappingValidCount: 1, directNameMatchCount: 0 });
});

test('교통 장소명 의미 매칭은 도시 접두·공백·순서 차이를 허용하지만 수식어 단독·무관 이름은 넓히지 않는다', async () => {
  assert.equal(matchPlaceNameQuery('사상역 2호선', '사상역 부산2호선'), 'transit_variant');
  assert.equal(matchPlaceNameQuery('부산2호선 사상역', '사상역 부산2호선'), 'transit_variant');
  assert.equal(matchPlaceNameQuery('사상역 경전철', '경전철 사상역'), 'transit_variant');
  assert.equal(matchPlaceNameQuery('2호선', '사상역 부산2호선'), 'none');
  assert.equal(matchPlaceNameQuery('사상역 2호선', '무관한 카페'), 'none');
  const result = await kakaoPoiSearchMultiResult('사상역 2호선', undefined, 1, {
    apiKey: 'fixture', fetcher: async () => response(200, { documents: [{ place_name: '사상역 부산2호선', x: '129', y: '35.16' }] }),
  });
  assert.equal(result.metrics?.directNameMatchCount, 1);
});

function actualKakaoSearcher(categoryName?: string) {
  return (query: string) => kakaoPoiSearchMultiResult(query, undefined, 5, {
    apiKey: 'fixture',
    fetcher: async () => response(200, { documents: query.includes('2호선') ? [] : categoryName ? [{ place_name: '사상역', address_name: '부산', x: '129', y: '35.16', category_group_code: 'SW8', category_name: categoryName }] : [] }),
  });
}

function actualTmapSearcher(categoryName?: string) {
  return (query: string) => tmapPoiSearchMultiResult(query, undefined, 5, {
    apiKey: 'fixture',
    fetcher: async () => response(200, { searchPoiInfo: { pois: { poi: query.includes('2호선') ? [] : categoryName ? [{ name: '사상역', frontLat: '35.16', frontLon: '129', upperAddrName: '부산', poiCateName: categoryName }] : [] } } }),
  });
}

test('provider category mapping retains Kakao and TMAP transit line metadata without retired suggestions', async () => {
  for (const search of [actualKakaoSearcher, actualTmapSearcher]) {
    const result = await search('교통, 지하철역, 부산2호선')('사상역');
    assert.deepEqual(result.pois[0]?.providerMetadata, { placeType: 'transit_place', lineLabels: ['2호선'], labelSource: 'provider' });
  }
});

test('provider category mapping never invents missing lines or marks a shop as transit', async () => {
  const missing = await actualKakaoSearcher('교통, 지하철역')('사상역');
  const shop = await actualTmapSearcher('음식점, 부산2호선')('사상역');
  assert.deepEqual(missing.pois[0]?.providerMetadata, { placeType: 'transit_place', labelSource: 'provider' });
  assert.equal(shop.pois[0]?.providerMetadata, undefined);
});
