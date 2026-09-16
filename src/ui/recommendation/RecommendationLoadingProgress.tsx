import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';
import { recommendationProgressItems, type RecommendationProgressStage } from './recommendationLoadingModel';

export function RecommendationLoadingProgress({ stage }: { stage: RecommendationProgressStage | null }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const items = recommendationProgressItems(stage);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    if (reduceMotion || stage === 'complete' || stage === null) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion, stage]);

  const pulseStyle = reduceMotion
    ? undefined
    : {
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.62, 1] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
    };

  return <View testID="recommendation-progress" style={s.container} accessibilityLabel={`계산 진행: ${items.map((item) => `${item.label} ${item.state}`).join(', ')}`}>
    <View testID="recommendation-progress-columns" style={s.columns}>
    {items.map((item) => <View key={item.stage} style={s.row}>
      <View style={s.markerSlot}>
        {item.state === 'done'
          ? <View testID={`recommendation-progress-done-${item.stage}`} style={s.done}><Text style={s.check}>✓</Text></View>
          : <Animated.View testID={item.state === 'current' ? `recommendation-progress-current-${item.stage}` : undefined} style={[s.dot, item.state === 'current' && s.current, item.state === 'current' && pulseStyle]} />}
      </View>
      <Text style={[s.label, item.state !== 'pending' && s.labelOn]}>{item.label}</Text>
    </View>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  container: { width: '100%', alignItems: 'center' },
  columns: { alignSelf: 'center', maxWidth: '100%' },
  row: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 12 }, markerSlot: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#697385', backgroundColor: 'transparent' },
  done: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green }, check: { color: C.onAccent, fontSize: 10, lineHeight: 12, fontWeight: '900' },
  current: { borderColor: '#72b2ff', backgroundColor: '#72b2ff' },
  label: { flexShrink: 1, color: C.muted, fontSize: 14 },
  labelOn: { color: C.txt2, fontWeight: '700' },
});
