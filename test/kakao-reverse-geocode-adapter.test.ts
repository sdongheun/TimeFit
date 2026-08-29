import assert from 'node:assert/strict';
import test from 'node:test';
import { reverseGeocodeSelection } from '../src/services/kakaoReverseGeocodeAdapter';

const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

test('APIS6-01: Kakao 원문 도로명 주소는 실제 변환 뒤 provider label/address로 한 번만 반환한다', async () => {
  let requests = 0;
  const result = await reverseGeocodeSelection(35.16, 129, {
    apiKey: 'fixture',
    fetcher: async () => { requests += 1; return response(200, { documents: [{ road_address: { address_name: '부산광역시 사상구 역로 1' }, address: { address_name: '부산광역시 사상구 괘법동' } }] }); },
  });
  assert.deepEqual(result, {
    provider: 'kakao', status: 'ok', label: '부산광역시 사상구 역로 1', address: '부산광역시 사상구 역로 1',
    labelSource: 'provider', addressSource: 'provider', diagnostics: { providerRequests: { kakao: 1, tmap: 0 } },
  });
  assert.equal(requests, 1);
});

test('APIS6-02: 성공 응답에 provider 주소가 없으면 주소를 추측하지 않은 typed ok를 반환한다', async () => {
  const result = await reverseGeocodeSelection(35.16, 129, {
    apiKey: 'fixture', fetcher: async () => response(200, { documents: [{}] }),
  });
  assert.deepEqual(result, { provider: 'kakao', status: 'ok', diagnostics: { providerRequests: { kakao: 1, tmap: 0 } } });
});

test('APIS6-03: HTTP 401/429는 주소 없이 상태 코드만 보존하며 재시도·fallback을 만들지 않는다', async () => {
  let requests = 0;
  const unauthorized = await reverseGeocodeSelection(35.16, 129, {
    apiKey: 'fixture', fetcher: async () => { requests += 1; return response(401, {}); },
  });
  const limited = await reverseGeocodeSelection(35.16, 129, {
    apiKey: 'fixture', fetcher: async () => { requests += 1; return response(429, {}); },
  });
  assert.deepEqual([unauthorized.status, unauthorized.statusCode, limited.status, limited.statusCode], ['http_error', 401, 'http_error', 429]);
  assert.deepEqual([unauthorized.diagnostics, limited.diagnostics], [
    { providerRequests: { kakao: 1, tmap: 0 } },
    { providerRequests: { kakao: 1, tmap: 0 } },
  ]);
  assert.equal(requests, 2);
});

test('APIS6-04: network·키 미설정·형식 오류는 좌표나 원문 없이 typed failure를 반환한다', async () => {
  const network = await reverseGeocodeSelection(35.16, 129, {
    apiKey: 'fixture', fetcher: async () => { throw new Error('offline'); },
  });
  const unconfigured = await reverseGeocodeSelection(35.16, 129, { apiKey: '' });
  const malformed = await reverseGeocodeSelection(35.16, 129, {
    apiKey: 'fixture', fetcher: async () => response(200, {}),
  });
  assert.deepEqual([network.status, unconfigured.status, malformed.status], ['network_error', 'unconfigured', 'invalid_response']);
  assert.deepEqual([network.diagnostics, unconfigured.diagnostics, malformed.diagnostics], [
    { providerRequests: { kakao: 1, tmap: 0 } },
    { providerRequests: { kakao: 0, tmap: 0 } },
    { providerRequests: { kakao: 1, tmap: 0 } },
  ]);
  for (const result of [network, unconfigured, malformed]) {
    assert.equal('label' in result, false);
    assert.equal('address' in result, false);
  }
});
