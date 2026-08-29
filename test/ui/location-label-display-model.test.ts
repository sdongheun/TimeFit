import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLatestLocationLabel, displayLocationLabel } from '../../src/ui/locationLabelDisplayModel';

test('UR8-01/05: address·region·unresolved 결과를 과장 없이 표시한다', () => {
  assert.equal(displayLocationLabel({ source: 'address', address: '부산 해운대구 우동 123' }), '부산 해운대구 우동 123');
  assert.equal(displayLocationLabel({ source: 'region', address: '해운대구 우동' }), '해운대구 우동 인근');
  assert.equal(displayLocationLabel({ source: 'unresolved' }), '현재 위치');
});

test('UR8-01: 늦은 GPS label 응답은 최신 기기 위치 라벨을 덮어쓰지 않는다', () => {
  assert.equal(applyLatestLocationLabel(2, 1, { source: 'address', address: '오래된 주소' }), null);
  assert.equal(applyLatestLocationLabel(2, 2, { source: 'region', address: '해운대구 우동' }), '해운대구 우동 인근');
});
