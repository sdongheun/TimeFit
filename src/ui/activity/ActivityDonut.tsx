import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ActivityCategorySummary } from './activitySummary';
import { C } from '../theme';

const COLORS = ['#2f7cff', '#29b765', '#f3a638', '#b375ff', '#e76089'];
const SIZE = 126;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  categories: ActivityCategorySummary[];
  completedPlaceCount: number;
};

export function ActivityDonut({ categories, completedPlaceCount }: Props) {
  let offset = 0;
  return (
    <View style={s.wrap} accessibilityLabel={`이번 달 완료 장소 ${completedPlaceCount}곳, 카테고리별 활동 시간 비율`}>
      <View style={s.chart}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={C.panel2} strokeWidth={STROKE} fill="none" />
          {categories.map((item, index) => {
            const length = CIRCUMFERENCE * item.ratio / 100;
            const circle = <Circle
              key={item.category}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={STROKE}
              strokeDasharray={`${length} ${Math.max(0, CIRCUMFERENCE - length)}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              fill="none"
              rotation="-90"
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />;
            offset += length;
            return circle;
          })}
        </Svg>
        <View pointerEvents="none" style={s.center}>
          <Text style={s.centerCount}>{completedPlaceCount}</Text>
          <Text style={s.centerLabel}>완료</Text>
        </View>
      </View>
      <View style={s.legend}>
        {categories.slice(0, 4).map((item, index) => (
          <View key={item.category} style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: COLORS[index % COLORS.length] }]} />
            <Text numberOfLines={1} style={s.legendLabel}>{item.category}</Text>
            <Text style={s.legendValue}>{item.ratio}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  chart: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  centerCount: { color: C.txt, fontSize: 25, fontWeight: '900' },
  centerLabel: { color: C.muted, fontSize: 11, fontWeight: '800', marginTop: 1 },
  legend: { width: '100%', gap: 7 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: C.txt2, fontSize: 12, flex: 1 },
  legendValue: { color: C.muted, fontSize: 12, fontWeight: '800' },
});
