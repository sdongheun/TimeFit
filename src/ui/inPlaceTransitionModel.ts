export function inPlaceTransitionTarget(reduceMotion: boolean) {
  return { fromOpacity: 0.82, fromTranslateY: reduceMotion ? 0 : 10, durationMs: 190 } as const;
}
