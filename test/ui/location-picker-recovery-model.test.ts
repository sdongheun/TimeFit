import assert from 'node:assert/strict';
import test from 'node:test';
import { canConfirmMapPoint, mapPickerStatus, pickerInitialCenter, sharedLocationLabelAdapter, shouldApplyGpsLabel } from '../../src/ui/locationPickerRecoveryModel';

const origin = { lat: 35.15, lon: 129.06 };
const destination = { lat: 35.18, lon: 129.08 };
const fallback = { lat: 35.1578, lon: 129.0594 };

test('UR8R-01: GPS 라벨 요청은 origin 상태 갱신과 별개로 최신 request만 반영한다', () => {
  assert.equal(shouldApplyGpsLabel(true, 1, 1), true);
  assert.equal(shouldApplyGpsLabel(true, 1, 2), false);
  assert.equal(shouldApplyGpsLabel(false, 1, 1), false);
});

test('UR8R-02/03: 기기 위치와 지도 핀 확정은 같은 label adapter 인스턴스를 사용한다', () => {
  const adapter = { resolve: () => Promise.resolve() };
  const shared = sharedLocationLabelAdapter(adapter);
  assert.equal(shared.gps, adapter);
  assert.equal(shared.pin, adapter);
});

test('UMANUAL: 지도는 해당 선택 장소를 먼저 보고 미선택 출발지는 부산 기본 보기로 둔다', () => {
  assert.deepEqual(pickerInitialCenter('destination', origin, destination, fallback), destination);
  assert.deepEqual(pickerInitialCenter('origin', origin, destination, fallback), origin);
  assert.deepEqual(pickerInitialCenter('origin', null, destination, fallback), fallback);
  assert.deepEqual(pickerInitialCenter('destination', null, null, fallback), fallback);
});

test('UR8R-04: 지도 준비 전에는 확정할 수 없고 오류 뒤 재시도는 loading부터 다시 시작한다', () => {
  assert.equal(mapPickerStatus('open'), 'loading');
  assert.equal(canConfirmMapPoint('loading', false), false);
  assert.equal(mapPickerStatus('error'), 'failed');
  assert.equal(canConfirmMapPoint('failed', false), false);
  assert.equal(mapPickerStatus('retry'), 'loading');
  assert.equal(mapPickerStatus('ready'), 'ready');
  assert.equal(canConfirmMapPoint('ready', false), true);
});
