import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable as NativePressable,
  type PressableProps,
} from 'react-native';
import { pressVisualState, resolveAnimatedPressableStyle, type PressMotionVariant } from './pressInteractionModel';

const AnimatedNativePressable = Animated.createAnimatedComponent(NativePressable);

export type AnimatedPressableProps = PressableProps & Readonly<{
  variant?: PressMotionVariant;
  busy?: boolean;
}>;

/** 앱 소유 press 반응만 담당한다. 햅틱·API·navigation 성공 의미는 포함하지 않는다. */
export function AnimatedPressable({ variant = 'standard', busy = false, disabled = false, onPressIn, onPressOut, style, accessibilityState, ...props }: AnimatedPressableProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const unavailable = disabled || busy || accessibilityState?.busy === true;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!unavailable) return;
    setIsPressed(false);
    progress.stopAnimation();
    progress.setValue(0);
  }, [progress, unavailable]);

  const animate = (pressed: boolean) => {
    const target = pressVisualState(pressed ? 'pressed' : 'idle', variant, reduceMotion, unavailable);
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: pressed && !unavailable ? 1 : 0,
      duration: target.durationMs,
      easing: pressed ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  const pressed = pressVisualState('pressed', variant, reduceMotion, unavailable);
  const motionStyle = {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, pressed.opacity] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, pressed.scale] }) }],
  };
  const resolvedAnimatedStyle = resolveAnimatedPressableStyle(style, { pressed: isPressed }, motionStyle);

  return <AnimatedNativePressable
    {...props}
    disabled={unavailable}
    accessibilityState={{ ...accessibilityState, disabled: unavailable || accessibilityState?.disabled, busy: busy || accessibilityState?.busy }}
    style={resolvedAnimatedStyle}
    onPressIn={(event) => {
      if (unavailable) return;
      setIsPressed(true);
      animate(true);
      onPressIn?.(event);
    }}
    onPressOut={(event) => {
      setIsPressed(false);
      if (!unavailable) animate(false);
      onPressOut?.(event);
    }}
  />;
}
