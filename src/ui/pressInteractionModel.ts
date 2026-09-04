export type PressMotionVariant = 'standard' | 'icon';
export type PressMotionPhase = 'idle' | 'pressed';
export type PressStyleState = Readonly<{ pressed: boolean }>;

export type PressVisualState = Readonly<{
  scale: number;
  opacity: number;
  durationMs: number;
}>;

/** 원래 style callback은 여기서 평가하고 Animated surface에는 객체/배열만 넘긴다. */
export function resolveAnimatedPressableStyle<T, M>(
  style: T | ((state: PressStyleState) => T),
  state: PressStyleState,
  motionStyle: M,
): [T, M] {
  const resolvedOriginalStyle = typeof style === 'function'
    ? (style as (value: PressStyleState) => T)(state)
    : style;
  return [resolvedOriginalStyle, motionStyle];
}

/** Layout과 실행 상태를 바꾸지 않는 공용 press 시각 결정이다. */
export function pressVisualState(
  phase: PressMotionPhase,
  variant: PressMotionVariant,
  reduceMotion: boolean,
  disabled: boolean,
): PressVisualState {
  if (disabled || phase === 'idle') return { scale: 1, opacity: 1, durationMs: disabled ? 0 : 170 };
  return {
    scale: reduceMotion ? 1 : variant === 'icon' ? 0.95 : 0.975,
    opacity: 0.92,
    durationMs: 70,
  };
}
