import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNearbyBrowseSheetLayout } from '../../src/ui/nearbyBrowseSheetLayout';

const cases = [
  { name: 'small-safe0-normal', screenHeight: 568, safeTop: 20, safeBottom: 0, fontScale: 1, tabY: 484, tabHeight: 66 },
  { name: 'small-safe34-large', screenHeight: 568, safeTop: 47, safeBottom: 34, fontScale: 1.8, tabY: 468, tabHeight: 66 },
  { name: 'large-safe0-normal', screenHeight: 932, safeTop: 24, safeBottom: 0, fontScale: 1, tabY: 848, tabHeight: 66 },
  { name: 'large-safe34-large', screenHeight: 932, safeTop: 59, safeBottom: 34, fontScale: 1.8, tabY: 832, tabHeight: 66 },
] as const;

for (const fixture of cases) {
  for (const rowCount of [0, 1, 12]) {
    test(`UNEAR sheet geometry ${fixture.name} rows=${rowCount} keeps connected bounds and scroll-end content above the measured tab`, () => {
      const layout = resolveNearbyBrowseSheetLayout({
        screenHeight: fixture.screenHeight,
        safeTop: fixture.safeTop,
        safeBottom: fixture.safeBottom,
        fontScale: fixture.fontScale,
        rowCount,
        tabFrame: { x: 16, y: fixture.tabY, width: 358, height: fixture.tabHeight },
        measured: { handleHeight: 32, listHeaderHeight: fixture.fontScale > 1 ? 82 : 58, firstRowHeight: fixture.fontScale > 1 ? 104 : 75 },
      });

      assert.equal(layout.sheetBottom, 0);
      assert.equal(layout.sheetHorizontalInset, 0);
      assert.equal(layout.tabTop, fixture.tabY);
      assert.equal(layout.tabObstruction, fixture.screenHeight - fixture.tabY);
      assert.ok(layout.expandedHeight <= fixture.screenHeight - layout.minimumSheetTop);
      assert.ok(layout.collapsedHeight <= layout.expandedHeight);

      // At maximum scroll, the bottom of the last row or detail CTA sits here.
      const terminalTouchBottom = fixture.screenHeight - layout.contentBottomPadding;
      assert.ok(terminalTouchBottom <= layout.tabTop - layout.contentGap);
    });
  }
}

test('UNEAR collapsed preview fits handle, heading, and exactly the first row above the measured tab', () => {
  const layout = resolveNearbyBrowseSheetLayout({
    screenHeight: 844,
    safeTop: 47,
    safeBottom: 34,
    fontScale: 1,
    rowCount: 8,
    tabFrame: { x: 16, y: 744, width: 358, height: 66 },
    measured: { handleHeight: 32, listHeaderHeight: 58, firstRowHeight: 75 },
  });
  const unobscuredViewport = layout.collapsedHeight - layout.tabObstruction - layout.contentGap;
  assert.equal(unobscuredViewport, 32 + 58 + 75);
  assert.ok(unobscuredViewport < 32 + 58 + (75 * 2));
});

test('UNEAR uses the measured parent-coordinate tab frame instead of the legacy 72pt constant', () => {
  const layout = resolveNearbyBrowseSheetLayout({
    screenHeight: 844,
    safeTop: 47,
    safeBottom: 34,
    fontScale: 1,
    rowCount: 2,
    tabFrame: { x: 16, y: 718, width: 358, height: 92 },
  });
  assert.equal(layout.tabObstruction, 126);
  assert.notEqual(layout.tabObstruction, 72);
  assert.equal(layout.mapBottomInsetCollapsed, layout.collapsedHeight);
  assert.equal(layout.mapBottomInsetExpanded, layout.expandedHeight);
});
