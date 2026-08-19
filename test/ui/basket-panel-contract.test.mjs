import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "src/ui/recommendation/BasketPanel.tsx",
  "utf-8",
);

test("장바구니 패널은 표시 전용이며 편집과 저장을 상위 화면으로 위임한다", () => {
  assert.match(source, /export function BasketPanel/);
  assert.match(source, /onAutoSort: \(\) => void/);
  assert.match(source, /onMove: \(index: number, direction: -1 \| 1\) => void/);
  assert.match(source, /onRemove: \(contentId: string\) => void/);
  assert.match(source, /onConfirm: \(\) => void/);
  assert.match(source, /최적 순서로 정렬/);
  assert.match(source, /제거/);
  assert.match(source, /코스 저장 후 길찾기 시작/);
});
