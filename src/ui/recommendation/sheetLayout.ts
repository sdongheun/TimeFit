export type RecommendationSheetPosition = "collapsed" | "default" | "expanded";

export type RecommendationSheetLayout = {
  expandedHeight: number;
  defaultHeight: number;
  defaultOffset: number;
  collapsedOffset: number;
  collapsedVisibleHeight: number;
};

type LayoutInput = {
  windowHeight: number;
  insetTop: number;
  insetBottom: number;
  defaultRatio?: number;
};

const EXPANDED_RATIO = 0.9;
const DEFAULT_RATIO = 0.56;
const EXPANDED_TOP_GAP = 8;
const COLLAPSED_CONTROL_HEIGHT = 82;

export function recommendationSheetLayout({
  windowHeight,
  insetTop,
  insetBottom,
  defaultRatio = DEFAULT_RATIO,
}: LayoutInput): RecommendationSheetLayout {
  const expandedHeight = Math.max(
    0,
    Math.min(
      Math.round(windowHeight * EXPANDED_RATIO),
      windowHeight - (insetTop + EXPANDED_TOP_GAP),
    ),
  );
  const defaultHeight = Math.min(
    expandedHeight,
    Math.max(0, Math.round(windowHeight * defaultRatio)),
  );
  const collapsedVisibleHeight = insetBottom + COLLAPSED_CONTROL_HEIGHT;

  return {
    expandedHeight,
    defaultHeight,
    defaultOffset: Math.max(0, expandedHeight - defaultHeight),
    collapsedOffset: Math.max(0, expandedHeight - collapsedVisibleHeight),
    collapsedVisibleHeight,
  };
}

export function sheetOffset(
  layout: RecommendationSheetLayout,
  position: RecommendationSheetPosition,
): number {
  if (position === "expanded") return 0;
  if (position === "collapsed") return layout.collapsedOffset;
  return layout.defaultOffset;
}

export function mapFocusOffsetY(
  layout: RecommendationSheetLayout,
  position: RecommendationSheetPosition,
  insetBottom: number,
): number {
  if (position === "collapsed") {
    return Math.round((insetBottom + COLLAPSED_CONTROL_HEIGHT) * 0.5);
  }
  if (position === "expanded") return Math.round(layout.expandedHeight * 0.5);
  return Math.round(layout.defaultHeight * 0.5);
}

export function candidateListEndSpace(
  layout: RecommendationSheetLayout,
  position: RecommendationSheetPosition,
  insetBottom: number,
): number {
  return sheetOffset(layout, position) + Math.max(insetBottom, 18);
}

export function sheetPositionForRelease(
  layout: RecommendationSheetLayout,
  startOffset: number,
  gestureDy: number,
  velocityY: number,
): RecommendationSheetPosition {
  const currentOffset = Math.max(
    0,
    Math.min(layout.collapsedOffset, startOffset + gestureDy),
  );
  if (velocityY > 0.3) {
    return currentOffset >= layout.defaultOffset ? "collapsed" : "default";
  }
  if (velocityY < -0.3) {
    return currentOffset <= layout.defaultOffset ? "expanded" : "default";
  }

  return ([
    { position: "expanded" as const, offset: 0 },
    { position: "default" as const, offset: layout.defaultOffset },
    { position: "collapsed" as const, offset: layout.collapsedOffset },
  ]).reduce((nearest, candidate) =>
    Math.abs(candidate.offset - currentOffset) <
    Math.abs(nearest.offset - currentOffset)
      ? candidate
      : nearest,
  ).position;
}
