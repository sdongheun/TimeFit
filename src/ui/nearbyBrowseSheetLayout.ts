export type NearbyBrowseFrame = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type Measurements = Readonly<{
  handleHeight?: number;
  listHeaderHeight?: number;
  firstRowHeight?: number;
}>;

type Input = Readonly<{
  screenHeight: number;
  safeTop: number;
  safeBottom: number;
  fontScale: number;
  rowCount: number;
  tabFrame?: NearbyBrowseFrame | null;
  measured?: Measurements;
}>;

export type NearbyBrowseSheetLayout = Readonly<{
  sheetBottom: 0;
  sheetHorizontalInset: 0;
  minimumSheetTop: number;
  tabTop: number;
  tabObstruction: number;
  contentGap: number;
  contentBottomPadding: number;
  collapsedHeight: number;
  expandedHeight: number;
  mapBottomInsetCollapsed: number;
  mapBottomInsetExpanded: number;
}>;

const CONTENT_GAP = 12;
const TAB_VISUAL_HEIGHT_FALLBACK = 66;

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveNearbyBrowseSheetLayout(input: Input): NearbyBrowseSheetLayout {
  const screenHeight = Math.max(0, input.screenHeight);
  const safeTop = Math.max(0, input.safeTop);
  const safeBottom = Math.max(0, input.safeBottom);
  const fontScale = Math.max(1, input.fontScale || 1);
  const measuredTabTop = input.tabFrame && Number.isFinite(input.tabFrame.y)
    ? Math.max(0, Math.min(screenHeight, input.tabFrame.y))
    : null;
  // The fallback is used only before native onLayout reports the real parent-coordinate frame.
  const fallbackObstruction = Math.max(safeBottom, 18) + TAB_VISUAL_HEIGHT_FALLBACK;
  const tabObstruction = measuredTabTop === null
    ? Math.min(screenHeight, fallbackObstruction)
    : screenHeight - measuredTabTop;
  const tabTop = screenHeight - tabObstruction;

  const handleHeight = finitePositive(input.measured?.handleHeight, 32);
  const listHeaderHeight = finitePositive(input.measured?.listHeaderHeight, 58 + ((fontScale - 1) * 30));
  const firstRowFallback = input.rowCount > 0 ? 75 + ((fontScale - 1) * 36) : 76 + ((fontScale - 1) * 28);
  const firstRowHeight = finitePositive(input.measured?.firstRowHeight, firstRowFallback);
  const previewHeight = handleHeight + listHeaderHeight + firstRowHeight;

  // Header is at safeTop + 10 and at least 48pt tall. Keep another 22pt of map separation.
  const minimumSheetTop = safeTop + 80;
  const maximumAvailableHeight = Math.max(0, screenHeight - minimumSheetTop);
  const desiredCollapsedHeight = tabObstruction + CONTENT_GAP + previewHeight;
  const collapsedHeight = Math.min(desiredCollapsedHeight, maximumAvailableHeight);
  const expandedHeight = Math.max(collapsedHeight, Math.min(610, maximumAvailableHeight));
  const contentBottomPadding = tabObstruction + CONTENT_GAP;

  return {
    sheetBottom: 0,
    sheetHorizontalInset: 0,
    minimumSheetTop,
    tabTop,
    tabObstruction,
    contentGap: CONTENT_GAP,
    contentBottomPadding,
    collapsedHeight,
    expandedHeight,
    mapBottomInsetCollapsed: collapsedHeight,
    mapBottomInsetExpanded: expandedHeight,
  };
}
