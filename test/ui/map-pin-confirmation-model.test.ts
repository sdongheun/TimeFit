import assert from 'node:assert/strict';
import test from 'node:test';
import { createMapPinConfirmationController } from '../../src/ui/mapPinConfirmationModel';

const a = { lat: 35.16, lon: 129.06 }, b = { lat: 35.17, lon: 129.07 };

test('UR7-06: 지도 중심 20회 이동은 reverse 요청 0회이고 확정 1회만 요청한다', async () => {
  let calls = 0;
  const controller = createMapPinConfirmationController(a, async () => { calls += 1; return { status: 'ok', address: '부산진구 중앙대로' }; });
  for (let i = 0; i < 20; i += 1) controller.move({ lat: a.lat + i / 1000, lon: a.lon });
  assert.equal(calls, 0);
  await controller.confirm();
  assert.equal(calls, 1);
  assert.equal(controller.state.confirmed?.label, '부산진구 중앙대로');
});

test('UR7-06: 처리 중 연타는 하나의 reverse 요청만 만들고 중심 변경 뒤 응답은 무시한다', async () => {
  let resolve!: (value: { status: 'ok'; address: string }) => void;
  let calls = 0;
  const controller = createMapPinConfirmationController(a, () => { calls += 1; return new Promise((done) => { resolve = done; }); });
  const first = controller.confirm();
  const second = controller.confirm();
  controller.move(b);
  resolve({ status: 'ok', address: '오래된 주소' });
  await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(controller.state.confirmed, null);
  assert.equal(controller.state.point, b);
});

test('UR7-06: 주소 없음과 typed 실패는 검색 대안을 유지하고 좌표 확정만 허용한다', async () => {
  for (const status of ['ok', 'network_error'] as const) {
    const controller = createMapPinConfirmationController(a, async () => ({ status }));
    await controller.confirm();
    assert.match(controller.state.message, /좌표로 선택하거나 검색으로 선택/);
    assert.match(controller.confirmCoordinate().confirmed?.label ?? '', /지도 선택 위치/);
  }
});
