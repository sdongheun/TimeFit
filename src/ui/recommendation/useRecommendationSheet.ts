import { Animated, PanResponder } from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type RecommendationSheetLayout,
  type RecommendationSheetPosition,
  sheetOffset,
  sheetPositionForRelease,
} from "./sheetLayout";

type Options = {
  layout: RecommendationSheetLayout;
  onPositionChange?: (position: RecommendationSheetPosition) => void;
};

export function useRecommendationSheet({ layout, onPositionChange }: Options) {
  const [sheetPosition, setSheetPosition] =
    useState<RecommendationSheetPosition>("default");
  const sheetTranslateY = useRef(
    new Animated.Value(sheetOffset(layout, "default")),
  ).current;
  const sheetStartOffset = useRef(0);

  const moveSheet = useCallback(
    (position: RecommendationSheetPosition) => {
      setSheetPosition(position);
      onPositionChange?.(position);
      Animated.spring(sheetTranslateY, {
        toValue: sheetOffset(layout, position),
        useNativeDriver: true,
        stiffness: 240,
        damping: 28,
      }).start();
    },
    [layout, onPositionChange, sheetTranslateY],
  );

  const resetSheet = useCallback(() => {
    setSheetPosition("default");
    sheetTranslateY.setValue(sheetOffset(layout, "default"));
  }, [layout, sheetTranslateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetStartOffset.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const nextOffset = Math.max(
            0,
            Math.min(layout.collapsedOffset, sheetStartOffset.current + gesture.dy),
          );
          sheetTranslateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) {
            moveSheet(
              sheetPosition === "collapsed"
                ? "default"
                : sheetPosition === "default"
                  ? "expanded"
                  : "default",
            );
            return;
          }
          moveSheet(
            sheetPositionForRelease(
              layout,
              sheetStartOffset.current,
              gesture.dy,
              gesture.vy,
            ),
          );
        },
      }),
    [layout, moveSheet, sheetPosition, sheetTranslateY],
  );

  return {
    panHandlers: panResponder.panHandlers,
    resetSheet,
    sheetPosition,
    sheetTranslateY,
    moveSheet,
  };
}
