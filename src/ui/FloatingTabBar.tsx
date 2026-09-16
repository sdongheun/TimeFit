import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  resolveFloatingTabIndexFromDrag,
  resolveFloatingTabMaterial,
  resolveFloatingTabProgressFromDrag,
} from './floatingTabGlassModel';
import { C } from './theme';

export type MainTabKey = 'main' | 'course' | 'record' | 'profile';

type Props = {
  active: MainTabKey;
  onMain: () => void;
  onCourse: () => void;
  onRecord: () => void;
  onProfile: () => void;
  onFrame?: (frame: LayoutRectangle) => void;
};

const TABS: { key: MainTabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'main', label: '메인', icon: 'search' },
  { key: 'course', label: '주변 둘러보기', icon: 'map' },
  { key: 'record', label: '기록', icon: 'pie-chart' },
  { key: 'profile', label: '내정보', icon: 'user' },
];
const TAB_INSET = 6;
let lastCommittedTabIndex: number | null = null;

export function FloatingTabBar({ active, onMain, onCourse, onRecord, onProfile, onFrame }: Props) {
  const insets = useSafeAreaInsets();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [itemsWidth, setItemsWidth] = useState(0);
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.key === active));
  const activeIndexRef = useRef(activeIndex);
  const itemsWidthRef = useRef(0);
  const dragActiveRef = useRef(false);
  const pressedTabIndexRef = useRef(activeIndex);
  const dragStartIndexRef = useRef(activeIndex);
  const lensPosition = useRef(new Animated.Value(lastCommittedTabIndex ?? activeIndex)).current;
  const lensLift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS !== 'ios' || typeof AccessibilityInfo.isReduceTransparencyEnabled !== 'function') return;
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (typeof AccessibilityInfo.isReduceMotionEnabled !== 'function') return;
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  let liquidGlassAvailable = false;
  let glassApiAvailable = false;
  if (Platform.OS === 'ios') {
    try {
      liquidGlassAvailable = isLiquidGlassAvailable();
      glassApiAvailable = isGlassEffectAPIAvailable();
    } catch {
      // 구형 OS·컴파일러 조합에서는 아래 blur fallback을 사용한다.
    }
  }
  const material = resolveFloatingTabMaterial({
    platform: Platform.OS,
    liquidGlassAvailable,
    glassApiAvailable,
    reduceTransparency,
  });
  const handlers: Record<MainTabKey, () => void> = {
    main: onMain,
    course: onCourse,
    record: onRecord,
    profile: onProfile,
  };
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  activeIndexRef.current = activeIndex;

  const settleLens = useCallback((index: number) => {
    lensPosition.stopAnimation();
    if (reduceMotion) {
      lensPosition.setValue(index);
      return;
    }
    Animated.spring(lensPosition, {
      toValue: index,
      damping: 19,
      stiffness: 220,
      mass: 0.78,
      useNativeDriver: true,
    }).start();
  }, [lensPosition, reduceMotion]);
  const setLensLifted = useCallback((lifted: boolean) => {
    lensLift.stopAnimation();
    if (reduceMotion) {
      lensLift.setValue(0);
      return;
    }
    Animated.spring(lensLift, {
      toValue: lifted ? 1 : 0,
      damping: 17,
      stiffness: 260,
      mass: 0.65,
      useNativeDriver: true,
    }).start();
  }, [lensLift, reduceMotion]);

  useEffect(() => {
    if (!dragActiveRef.current) {
      pressedTabIndexRef.current = activeIndex;
      settleLens(activeIndex);
    }
    lastCommittedTabIndex = activeIndex;
  }, [activeIndex, settleLens]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) >= 7 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderGrant: () => {
      dragActiveRef.current = true;
      dragStartIndexRef.current = pressedTabIndexRef.current;
      lensPosition.stopAnimation();
      lensPosition.setValue(dragStartIndexRef.current);
      setLensLifted(true);
    },
    onPanResponderMove: (_event, gesture) => {
      lensPosition.setValue(resolveFloatingTabProgressFromDrag(
        dragStartIndexRef.current,
        gesture.dx,
        itemsWidthRef.current,
        TABS.length,
        TAB_INSET,
      ));
    },
    onPanResponderRelease: (_event, gesture) => {
      const targetIndex = resolveFloatingTabIndexFromDrag(
        dragStartIndexRef.current,
        gesture.dx,
        itemsWidthRef.current,
        TABS.length,
        TAB_INSET,
      );
      dragActiveRef.current = false;
      pressedTabIndexRef.current = targetIndex;
      lastCommittedTabIndex = targetIndex;
      settleLens(targetIndex);
      setLensLifted(false);
      if (targetIndex !== activeIndexRef.current) handlersRef.current[TABS[targetIndex].key]();
    },
    onPanResponderTerminate: () => {
      dragActiveRef.current = false;
      pressedTabIndexRef.current = activeIndexRef.current;
      settleLens(activeIndexRef.current);
      setLensLifted(false);
    },
    onPanResponderTerminationRequest: () => false,
  }), [lensPosition, setLensLifted, settleLens]);

  const tabItems = TABS.map((tab) => {
    const isActive = active === tab.key;
    const tabIndex = TABS.indexOf(tab);
    return (
      <Pressable
        key={tab.key}
        style={[s.item, isActive && s.itemOn]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        onPressIn={() => {
          pressedTabIndexRef.current = tabIndex;
          if (!dragActiveRef.current) {
            setLensLifted(true);
          }
        }}
        onPressOut={() => {
          if (!dragActiveRef.current) setLensLifted(false);
        }}
        onPress={() => handlers[tab.key]()}
      >
        <Feather name={tab.icon} size={18} color={isActive ? C.accentPress : C.txt2} />
        <Text style={[s.label, isActive && s.labelOn]}>{tab.label}</Text>
      </Pressable>
    );
  });
  const usableWidth = Math.max(0, itemsWidth - TAB_INSET * 2);
  const slotWidth = usableWidth / TABS.length;
  const lensTranslateX = lensPosition.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [0, slotWidth * (TABS.length - 1)],
  });
  const lensScaleX = lensLift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const lensScaleY = lensLift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const tabContent = (
    <View
      style={s.items}
      onLayout={({ nativeEvent }) => {
        const width = nativeEvent.layout.width;
        itemsWidthRef.current = width;
        setItemsWidth((current) => current === width ? current : width);
      }}
      {...panResponder.panHandlers}
    >
      {slotWidth > 0 ? (
        <Animated.View
          testID="floating-tab-selection-lens"
          pointerEvents="none"
          style={[
            s.selectionLens,
            {
              width: slotWidth,
              transform: [{ translateX: lensTranslateX }, { scaleX: lensScaleX }, { scaleY: lensScaleY }],
            },
          ]}
        />
      ) : null}
      {tabItems}
    </View>
  );

  return (
    <View pointerEvents="box-none" onLayout={({ nativeEvent }) => onFrame?.(nativeEvent.layout)} style={[s.wrap, { bottom: Math.max(insets.bottom, 18) }]}>
      <View style={s.bar}>
        {material === 'liquid' ? (
          <GlassView
            testID="floating-tab-liquid-glass"
            colorScheme="dark"
            glassEffectStyle="regular"
            tintColor="rgba(22, 34, 50, 0.16)"
            isInteractive
            style={s.liquidSurface}
          >
            {tabContent}
          </GlassView>
        ) : (
          <>
            <View pointerEvents="none" style={s.materialClip}>
              {material === 'blur' ? (
                <BlurView
                  testID="floating-tab-blur-fallback"
                  intensity={74}
                  tint="systemChromeMaterialDark"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View testID="floating-tab-solid-fallback" style={[StyleSheet.absoluteFill, s.solidSurface]} />
              )}
            </View>
            {tabContent}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  liquidSurface: { borderRadius: 23, overflow: 'hidden' },
  materialClip: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 23, overflow: 'hidden' },
  solidSurface: { backgroundColor: 'rgba(21,27,35,0.98)' },
  items: { position: 'relative', flexDirection: 'row', padding: TAB_INSET },
  selectionLens: {
    position: 'absolute',
    left: TAB_INSET,
    top: TAB_INSET,
    bottom: TAB_INSET,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    shadowColor: '#ffffff',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  item: { zIndex: 1, flex: 1, minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  itemOn: { borderColor: 'transparent' },
  label: { color: C.txt2, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  labelOn: { color: C.txt },
});
