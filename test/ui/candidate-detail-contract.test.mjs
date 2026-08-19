import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('src/ui/recommendation/CandidateDetail.tsx', 'utf-8');

test('장소 상세는 표시 전용이며 수단 선택·카카오맵 열기·장바구니 이벤트를 상위로 위임한다', () => {
  assert.match(source, /export function CandidateDetail/);
  assert.match(source, /onClose: \(\) => void/);
  assert.match(source, /onModeChange: \(mode: Mode\) => void/);
  assert.match(source, /onOpenKakaoPlace: \(spot: Spot\) => void/);
  assert.match(source, /onAddToBasket: \(\) => void/);
  assert.match(source, /카카오맵에서 보기/);
  assert.match(source, /장바구니에 담기/);
  assert.match(source, /chosen\?\.totalMoveMin/);
  assert.match(source, /chosen\?\.totalStayMin/);
  assert.match(source, /chosen\?\.remainingAfterPlannedMin/);
  assert.match(source, /label="총 이동"/);
  assert.match(source, /label="코스 체류"/);
});
