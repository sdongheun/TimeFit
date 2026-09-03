import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRouteProxyCatalogSnapshot, routeProxyCatalogSnapshot } from '../src/services/routeProxyCatalogSnapshot';
import { createCourseV1CandidateProvider } from '../src/data/courseV1CandidateProvider';

test('API-SNAPSHOT-SYNC-01: representative 191개만 결정적 snapshot point가 되며 conditional/hold를 새로 해석하지 않는다', () => {
  const provider = createCourseV1CandidateProvider();
  const expected = provider.fixtureSummary.representativeTotal;
  assert.equal(expected, 191);
  assert.equal(Object.keys(routeProxyCatalogSnapshot.points).length, expected);
  assert.equal(routeProxyCatalogSnapshot.version, buildRouteProxyCatalogSnapshot().version);
  assert.equal(routeProxyCatalogSnapshot.json, buildRouteProxyCatalogSnapshot().json);
  assert.deepEqual(Object.keys(routeProxyCatalogSnapshot.points), [...Object.keys(routeProxyCatalogSnapshot.points)].sort());
  for (const point of Object.values(routeProxyCatalogSnapshot.points)) assert.ok(Number.isFinite(point.lat) && Number.isFinite(point.lon));
});

test('API4ACT03-05: ID 또는 좌표 변경은 snapshot version을 바꾸며 비밀·사용자 위치 필드는 포함하지 않는다', () => {
  const base = buildRouteProxyCatalogSnapshot([{ id: 'b', lat: 35.2, lon: 129.2, classification: 'representative_standard' }, { id: 'a', lat: 35.1, lon: 129.1, classification: 'representative_core' }, { id: 'conditional', lat: 1, lon: 1, classification: 'conditional_more' }]);
  const moved = buildRouteProxyCatalogSnapshot([{ id: 'b', lat: 35.2, lon: 129.3, classification: 'representative_standard' }, { id: 'a', lat: 35.1, lon: 129.1, classification: 'representative_core' }]);
  assert.deepEqual(Object.keys(base.points), ['a', 'b']);
  assert.notEqual(base.version, moved.version);
  assert.doesNotMatch(base.json, /key|token|jwt|user|origin|destination/i);
});
