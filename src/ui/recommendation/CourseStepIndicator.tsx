import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import type { ActiveCourseStepRow } from '../courseConfirmActiveModel';

/** Pure presentation: progress changes never wait for this native opacity loop. */
export function CourseStepIndicator({ status }: { status: ActiveCourseStepRow['actionState'] }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    opacity.stopAnimation(); opacity.setValue(1);
    if (reduceMotion || status !== 'current') return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.55, duration: 1000, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ]));
    animation.start();
    return () => { animation.stop(); opacity.stopAnimation(); opacity.setValue(1); };
  }, [opacity, reduceMotion, status]);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={s.frame}>
    <Animated.View testID={`course-indicator-${status}`} style={[s.dot, status === 'current' ? s.current : status === 'complete' ? s.complete : s.future, { opacity: status === 'current' && !reduceMotion ? opacity : 1 }]} />
    {status === 'complete' ? <Text style={s.check}>✓</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  frame: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderWidth: 2, borderRadius: 7 },
  current: { width: 18, height: 18, borderColor: C.amber, backgroundColor: C.amber },
  complete: { borderRadius: 4, borderColor: C.muted, backgroundColor: C.panel2 },
  future: { borderColor: C.muted, backgroundColor: C.bg },
  check: { position: 'absolute', color: C.txt, fontSize: 11, fontWeight: '800' },
});
