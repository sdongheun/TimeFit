import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type AccessibilityActionEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { C } from './theme';
import { requestExpoSelectionHaptic } from './expoSelectionHaptic';
import { dispatchSelectionHaptic, type SelectionHapticRequest } from './selectionHaptic';
import { createTimeWheelInteraction, timeWheelMomentumExpected, type TimeWheelDecision } from './timeWheelInteraction';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 4;

type Props = {
  values: readonly string[];
  index: number;
  onChange: (index: number) => void;
  accessibilityLabel: string;
  rowHeight?: number;
  requestSelectionHaptic?: SelectionHapticRequest;
};

export function TimeWheel({ values, index, onChange, accessibilityLabel, rowHeight = ROW_HEIGHT, requestSelectionHaptic = requestExpoSelectionHaptic }: Props) {
  const ref = useRef<ScrollView>(null);
  const controller = useRef(createTimeWheelInteraction(index, values.length)).current;
  const didSetInitialOffset = useRef(false);
  const [activeIndex, setActiveIndex] = useState(controller.getActiveIndex());
  const height = rowHeight * VISIBLE_ROWS;
  const pad = (height - rowHeight) / 2;

  const apply = (decision: TimeWheelDecision) => {
    setActiveIndex(decision.activeIndex);
    if (decision.scrollToIndex !== undefined && decision.scrollToIndex >= 0) {
      ref.current?.scrollTo({ y: decision.scrollToIndex * rowHeight, animated: false });
    }
    dispatchSelectionHaptic(decision.haptic, requestSelectionHaptic);
    if (decision.commitIndex !== undefined) onChange(decision.commitIndex);
  };

  useEffect(() => {
    const next = controller.setValueCount(values.length, index);
    apply(next);
    if (!didSetInitialOffset.current) {
      didSetInitialOffset.current = true;
      if (next.activeIndex >= 0) ref.current?.scrollTo({ y: next.activeIndex * rowHeight, animated: false });
    }
  }, [values.length]);

  useEffect(() => {
    apply(controller.syncExternal(index));
  }, [index]);

  useEffect(() => {
    if (controller.getActiveIndex() >= 0) ref.current?.scrollTo({ y: controller.getActiveIndex() * rowHeight, animated: false });
  }, [rowHeight]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    apply(controller.observeOffset(event.nativeEvent.contentOffset.y, rowHeight));
  };
  const onScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nativeEvent = event.nativeEvent as NativeScrollEvent & { targetContentOffset?: { y?: number } };
    apply(controller.endDrag(timeWheelMomentumExpected(
      nativeEvent.velocity?.y,
      nativeEvent.contentOffset.y,
      nativeEvent.targetContentOffset?.y,
    )));
  };
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') apply(controller.adjust(1));
    if (event.nativeEvent.actionName === 'decrement') apply(controller.adjust(-1));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: activeIndex >= 0 ? values[activeIndex] : '선택 항목 없음' }}
      accessibilityActions={[{ name: 'increment', label: '다음 값' }, { name: 'decrement', label: '이전 값' }]}
      onAccessibilityAction={onAccessibilityAction}
      style={[s.root, { height }]}
    >
      <View pointerEvents="none" style={[s.band, { top: pad, height: rowHeight }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
        decelerationRate="fast"
        onScrollBeginDrag={() => apply(controller.beginDrag())}
        onScroll={onScroll}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={() => apply(controller.beginMomentum())}
        onMomentumScrollEnd={() => apply(controller.endMomentum())}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {values.map((value, valueIndex) => {
          const distance = Math.abs(valueIndex - activeIndex);
          return (
            <View key={`${value}-${valueIndex}`} style={[s.row, { height: rowHeight }]}>
              <Text style={[s.value, distance === 0 && s.valueSelected, { opacity: distance === 0 ? 1 : distance === 1 ? 0.45 : 0.18 }]}>
                {value}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: 'relative', overflow: 'hidden' },
  band: { position: 'absolute', zIndex: 1, left: 4, right: 4, height: ROW_HEIGHT, borderRadius: 10, backgroundColor: 'rgba(0,102,255,0.14)' },
  row: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  value: { color: C.txt, fontSize: 18, fontWeight: '600' },
  valueSelected: { color: C.txt, fontSize: 20, fontWeight: '800' },
});
