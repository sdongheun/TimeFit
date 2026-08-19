import assert from "node:assert/strict";
import test from "node:test";
import {
  candidateListEndSpace,
  mapFocusOffsetY,
  recommendationSheetLayout,
  sheetOffset,
  sheetPositionForRelease,
} from "../../src/ui/recommendation/sheetLayout";

test("기본 시트는 화면의 56%를 차지하고 상태 영역 아래까지만 확장된다", () => {
  const layout = recommendationSheetLayout({
    windowHeight: 844,
    insetTop: 59,
    insetBottom: 34,
  });

  assert.equal(layout.expandedHeight, 760);
  assert.equal(layout.defaultHeight, 473);
  assert.equal(layout.defaultOffset, 287);
  assert.equal(layout.collapsedOffset, 644);
});

test("시트 상태별 오프셋은 확장·기본·접힘 순서로 증가한다", () => {
  const layout = recommendationSheetLayout({
    windowHeight: 844,
    insetTop: 59,
    insetBottom: 34,
  });

  assert.equal(sheetOffset(layout, "expanded"), 0);
  assert.equal(sheetOffset(layout, "default"), 287);
  assert.equal(sheetOffset(layout, "collapsed"), 644);
});

test("지도 포커스는 현재 사용자가 볼 수 있는 지도 영역의 중앙을 기준으로 한다", () => {
  const layout = recommendationSheetLayout({
    windowHeight: 844,
    insetTop: 59,
    insetBottom: 34,
  });

  assert.equal(mapFocusOffsetY(layout, "default", 34), 237);
  assert.equal(mapFocusOffsetY(layout, "collapsed", 34), 58);
  assert.equal(mapFocusOffsetY(layout, "expanded", 34), 380);
});

test("후보 목록 끝 여백은 현재 시트의 숨김 높이와 안전영역만큼만 확보한다", () => {
  const layout = recommendationSheetLayout({
    windowHeight: 844,
    insetTop: 59,
    insetBottom: 34,
  });

  assert.equal(candidateListEndSpace(layout, "expanded", 34), 34);
  assert.equal(candidateListEndSpace(layout, "default", 34), 321);
  assert.equal(candidateListEndSpace(layout, "collapsed", 34), 678);
});

test("작은 화면에서도 접힌 시트 오프셋은 음수가 되지 않는다", () => {
  const layout = recommendationSheetLayout({
    windowHeight: 240,
    insetTop: 120,
    insetBottom: 90,
  });

  assert.equal(layout.collapsedOffset, 0);
  assert.ok(layout.defaultOffset >= 0);
});

test("시트 드래그 종료는 속도와 가장 가까운 위치로 확장·기본·접힘을 결정한다", () => {
  const layout = recommendationSheetLayout({
    windowHeight: 844,
    insetTop: 59,
    insetBottom: 34,
  });

  assert.equal(sheetPositionForRelease(layout, 280, 0, -0.5), "expanded");
  assert.equal(sheetPositionForRelease(layout, 400, 0, 0.5), "collapsed");
  assert.equal(sheetPositionForRelease(layout, 0, 600, 0), "collapsed");
  assert.equal(sheetPositionForRelease(layout, 644, -350, 0), "default");
});
