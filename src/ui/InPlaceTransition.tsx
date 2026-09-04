import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { inPlaceTransitionTarget } from './inPlaceTransitionModel';

/** navigation을 만들지 않고 같은 화면의 변경 영역만 짧게 전환한다. */
export function InPlaceTransition({ transitionKey, children }: { transitionKey: string; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const target = inPlaceTransitionTarget(reduceMotion);
    opacity.setValue(target.fromOpacity);
    translateY.setValue(target.fromTranslateY);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: target.durationMs, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: target.durationMs, useNativeDriver: true }),
    ]).start();
  }, [transitionKey, reduceMotion]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
