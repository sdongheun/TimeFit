import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "src/ui/recommendation/MapControls.tsx",
  "utf-8",
);

test("지도 제어는 화면 상태 대신 뒤로가기·장바구니·위치 이동 이벤트만 위임한다", () => {
  assert.match(source, /export function RecommendationMapTopBar/);
  assert.match(source, /export function MapIconButton/);
  assert.match(source, /onBack: \(\) => void/);
  assert.match(source, /onOpenBasket: \(\) => void/);
  assert.match(source, /onPress: \(\) => void/);
  assert.match(source, /장바구니/);
});
