import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildKakaoRouteRequest, safeKakaoErrorCode, safeKakaoRouteStatus } from '../supabase/functions/route-proxy/kakaoRouteRequest';
import { routeGeometryDiagnosticSafeResult } from './fixtures/route-geometry-diagnostic-safe.fixture';

test('API-ROUTE-GEOMETRY-01: production과 진단이 공유하는 Kakao publictraffic 요청 계약', () => {
  const request = buildKakaoRouteRequest('publictraffic', {
    origin: { lat: 37.39477123, lon: 127.11119217 },
    destination: { lat: 37.41993056, lon: 127.12628814 },
    key: 'fixture-rest-key',
  });
  const url = new URL(request.url);
  assert.equal(request.method, 'GET');
  assert.equal(url.host, 'dapi.kakao.com');
  assert.equal(url.pathname, '/v2/routing/publictraffic');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['end_x', 'end_y', 'input_coord', 'output_coord', 'start_x', 'start_y']);
  assert.equal(url.searchParams.get('input_coord'), 'WGS84');
  assert.equal(url.searchParams.get('output_coord'), 'WGS84');
  assert.equal(request.headers.Authorization, 'KakaoAK fixture-rest-key');
});

test('API-ROUTE-GEOMETRY-01: 진단 오류는 숫자 code와 route status allowlist만 보존한다', () => {
  assert.equal(safeKakaoErrorCode(-401), -401);
  assert.equal(safeKakaoErrorCode('-401'), null);
  assert.equal(safeKakaoRouteStatus('NO_RESULTS'), 'NO_RESULTS');
  assert.equal(safeKakaoRouteStatus('secret-bearing-message'), 'unknown');
});

test('API-ROUTE-GEOMETRY-01: 빈 key·범위 밖·동일 좌표는 provider 요청 전 fail-closed한다', () => {
  const valid = { origin: { lat: 35.1, lon: 129.1 }, destination: { lat: 35.2, lon: 129.2 } };
  assert.throws(() => buildKakaoRouteRequest('publictraffic', { ...valid, key: '   ' }));
  assert.throws(() => buildKakaoRouteRequest('publictraffic', { ...valid, origin: { lat: 91, lon: 129.1 }, key: 'fixture' }));
  assert.throws(() => buildKakaoRouteRequest('publictraffic', { ...valid, destination: valid.origin, key: 'fixture' }));
});

test('API-ROUTE-GEOMETRY-01: 임시 진단은 production builder와 transit sanitizer를 공유한다', () => {
  const source = readFileSync(new URL('../supabase/functions/route-geometry-diagnostic/index.ts', import.meta.url), 'utf8');
  const summarySource = readFileSync(new URL('../supabase/functions/route-geometry-diagnostic/summarizeKakaoTransitRoutes.ts', import.meta.url), 'utf8');
  assert.match(source, /buildKakaoRouteRequest/);
  assert.match(source, /summarizeKakaoTransitRoutes/);
  assert.match(summarySource, /sanitizeKakaoTransitSegments/);
  assert.doesNotMatch(source, /https:\/\/dapi\.kakao\.com\/v2\/routing/);
});

test('API-ROUTE-GEOMETRY-01: C1 성공 뒤 C2 한 번에서 마지막 WALKING 부재와 endpoint gap을 안전 fixture로 보존한다', () => {
  const result = routeGeometryDiagnosticSafeResult;
  assert.equal(result.providerCallCount, 2);
  assert.deepEqual([result.c1.httpStatus, result.c1.status], [200, 'OK']);
  assert.deepEqual(result.c2.stepModeOrder, ['transit']);
  assert.deepEqual(result.c2.steps, [{ type: 'BUS', validPointCount: 157 }]);
  assert.equal(result.c2.lastStepType, 'BUS');
  assert.equal(result.c2.endEndpointGap, '101_250m');
});
