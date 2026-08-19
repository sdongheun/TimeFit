import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  "src/ui/execution/CourseProgress.tsx",
  "utf-8",
);

test("진행 화면 표현은 상태 변경과 외부 동작을 상위 컨테이너로 위임한다", () => {
  assert.match(source, /export function CourseProgress/);
  assert.match(source, /onChangeCourse: \(\) => void/);
  assert.match(source, /onPrimaryAction: \(\) => void/);
  assert.match(source, /onSelectStep: \(index: number\) => void/);
  assert.match(source, /onFinish: \(\) => void/);
  assert.match(source, /가는 순서/);
  assert.match(source, /약속·복귀 출발 알림/);
});
