import { useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from './theme';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 4;

type Props = {
  values: string[];
  index: number;
  onChange: (index: number) => void;
};

export function TimeWheel({ values, index, onChange }: Props) {
  const ref = useRef<ScrollView>(null);
  const height = ROW_HEIGHT * VISIBLE_ROWS;
  const pad = (height - ROW_HEIGHT) / 2;

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ROW_HEIGHT, animated: false });
  }, [index]);

  const commit = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT);
    onChange(Math.max(0, Math.min(values.length - 1, next)));
  };

  return (
    <View style={[s.root, { height }]}>
      <View pointerEvents="none" style={[s.band, { top: pad }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={commit}
        onScrollEndDrag={commit}
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {values.map((value, valueIndex) => {
          const distance = Math.abs(valueIndex - index);
          return (
            <View key={`${value}-${valueIndex}`} style={s.row}>
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
