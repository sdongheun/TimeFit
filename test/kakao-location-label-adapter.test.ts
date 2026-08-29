import assert from 'node:assert/strict';
import test from 'node:test';
import { kakaoRegionCodeResult, kakaoReverseGeocodeResult } from '../src/engine/kakao';
import { createKakaoLocationLabelAdapter } from '../src/services/kakaoLocationLabelAdapter';

const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const point = { lat: 35.16, lon: 129 };

function actualResolvers(input: { address?: () => Response | Promise<Response>; region?: () => Response | Promise<Response> }) {
  return {
    addressResolver: (value: typeof point) => kakaoReverseGeocodeResult(value.lat, value.lon, {
      apiKey: 'fixture', fetcher: async () => input.address?.() ?? response(200, { documents: [] }),
    }),
    regionResolver: (value: typeof point) => kakaoRegionCodeResult(value.lat, value.lon, {
      apiKey: 'fixture', fetcher: async () => input.region?.() ?? response(200, { documents: [] }),
    }),
  };
}

test('APIS7-01: Kakao 도로명 주소 성공은 address source로 끝나며 region을 호출하지 않는다', async () => {
  let addressCalls = 0;
  let regionCalls = 0;
  const adapter = createKakaoLocationLabelAdapter({
    ...actualResolvers({
      address: () => { addressCalls += 1; return response(200, { documents: [{ road_address: { address_name: '부산광역시 해운대구 해변로 1' } }] }); },
      region: () => { regionCalls += 1; return response(200, { documents: [] }); },
    }),
  });
  const result = await adapter.resolve(point, 'gps_auto');
  assert.deepEqual(result, {
    provider: 'kakao', status: 'ok', label: '부산광역시 해운대구 해변로 1', address: '부산광역시 해운대구 해변로 1',
    source: 'address', diagnostics: { providerRequests: { address: 1, region: 0, tmap: 0 }, cache: 'miss' },
  });
  assert.deepEqual([addressCalls, regionCalls], [1, 0]);
});

test('APIS7-02: 주소 없는 성공 응답에서만 실제 region 변환을 한 번 수행해 provider 지역을 반환한다', async () => {
  const adapter = createKakaoLocationLabelAdapter({
    ...actualResolvers({ region: () => response(200, { documents: [{ address_name: '부산광역시 해운대구 우동' }] }) }),
  });
  const result = await adapter.resolve(point, 'pin_confirm');
  assert.deepEqual(result, {
    provider: 'kakao', status: 'ok', label: '부산광역시 해운대구 우동', address: '부산광역시 해운대구 우동',
    source: 'region', diagnostics: { providerRequests: { address: 1, region: 1, tmap: 0 }, cache: 'miss' },
  });
});

test('APIS7-03: 주소와 region 모두 없으면 provider 이름을 추측하지 않은 unresolved 성공으로 끝낸다', async () => {
  const adapter = createKakaoLocationLabelAdapter({ ...actualResolvers({}) });
  const result = await adapter.resolve(point, 'pin_confirm');
  assert.deepEqual(result, {
    provider: 'kakao', status: 'ok', source: 'unresolved',
    diagnostics: { providerRequests: { address: 1, region: 1, tmap: 0 }, cache: 'miss' },
  });
});

test('APIS7-04: address HTTP·network·키 미설정·형식 오류에는 region이나 다른 provider fallback을 추가하지 않는다', async () => {
  const http = createKakaoLocationLabelAdapter({ ...actualResolvers({ address: () => response(429, {}) }) });
  const network = createKakaoLocationLabelAdapter({ ...actualResolvers({ address: async () => { throw new Error('offline'); } }) });
  const malformed = createKakaoLocationLabelAdapter({ ...actualResolvers({ address: () => response(200, {}) }) });
  const unconfigured = createKakaoLocationLabelAdapter({
    addressResolver: (value) => kakaoReverseGeocodeResult(value.lat, value.lon, { apiKey: '' }),
  });
  const results = await Promise.all([http.resolve(point, 'gps_auto'), network.resolve(point, 'gps_auto'), malformed.resolve(point, 'gps_auto'), unconfigured.resolve(point, 'gps_auto')]);
  assert.deepEqual(results.map((result) => result.status), ['http_error', 'network_error', 'invalid_response', 'unconfigured']);
  assert.ok(results.every((result) => result.source === 'unresolved' && result.diagnostics.providerRequests.region === 0 && result.diagnostics.providerRequests.tmap === 0));
});

test('APIS7-05: 성공한 address/region/unresolved는 10분 TTL과 동일 좌표 in-flight를 재사용한다', async () => {
  let now = 0;
  let addressCalls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const adapter = createKakaoLocationLabelAdapter({
    now: () => now,
    ...actualResolvers({ address: async () => { addressCalls += 1; await gate; return response(200, { documents: [{ road_address: { address_name: '부산광역시 해운대구 해변로 1' } }] }); } }),
  });
  const concurrent = Array.from({ length: 10 }, () => adapter.resolve(point, 'gps_auto'));
  await Promise.resolve();
  assert.equal(addressCalls, 1);
  release?.();
  const resolved = await Promise.all(concurrent);
  assert.equal(resolved.filter((result) => result.diagnostics.cache === 'shared_in_flight').length, 9);
  const hit = await adapter.resolve(point, 'pin_confirm');
  now += 10 * 60 * 1000 + 1;
  const expired = await adapter.resolve(point, 'gps_auto');
  assert.deepEqual([hit.diagnostics.cache, expired.diagnostics.cache], ['hit', 'miss']);
  assert.equal(addressCalls, 2);

  const regionAdapter = createKakaoLocationLabelAdapter({
    ...actualResolvers({ region: () => response(200, { documents: [{ address_name: '부산광역시 해운대구 우동' }] }) }),
  });
  const unresolvedAdapter = createKakaoLocationLabelAdapter({ ...actualResolvers({}) });
  const regionFirst = await regionAdapter.resolve(point, 'gps_auto');
  const regionHit = await regionAdapter.resolve(point, 'pin_confirm');
  const unresolvedFirst = await unresolvedAdapter.resolve(point, 'gps_auto');
  const unresolvedHit = await unresolvedAdapter.resolve(point, 'pin_confirm');
  assert.deepEqual([regionFirst.source, regionHit.diagnostics.cache, unresolvedFirst.source, unresolvedHit.diagnostics.cache], ['region', 'hit', 'unresolved', 'hit']);
});

test('APIS7-06: 실패 결과는 cache하지 않아 같은 좌표의 다음 GPS/핀 resolve가 실제 요청을 다시 한다', async () => {
  let calls = 0;
  const adapter = createKakaoLocationLabelAdapter({
    ...actualResolvers({ address: async () => { calls += 1; throw new Error('offline'); } }),
  });
  const first = await adapter.resolve(point, 'gps_auto');
  const second = await adapter.resolve(point, 'pin_confirm');
  assert.deepEqual([first.diagnostics.cache, second.diagnostics.cache], ['miss', 'miss']);
  assert.equal(calls, 2);
});
