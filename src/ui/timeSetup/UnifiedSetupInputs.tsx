import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';

type Props = {
  header: ReactNode; clockLabel: string; originLabel: string; destinationLabel: string;
  hasDestination: boolean; largeText: boolean; wheel: ReactNode; slider: ReactNode; error: string;
  viewportHeight: number;
  onOrigin(): void; onDestination(): void; onReturn(): void;
};

/** Presentation only: route state, clock, haptic and recommendation stay in the container. */
export function UnifiedSetupInputs(props: Props) {
  return <View testID="setup-general-inputs" style={[s.body, { minHeight: props.viewportHeight }]}>
    {props.header}
    <Text style={s.clock}>{props.clockLabel}</Text>
    <View style={s.fields}>
      <Pressable testID="route-origin-field" accessibilityLabel={`출발지, ${props.originLabel}`} style={s.field} onPress={props.onOrigin}>
        <Text style={s.label}>출발지</Text><Text numberOfLines={props.largeText ? undefined : 1} style={s.value}>{props.originLabel}</Text><Text style={s.arrow}>›</Text>
      </Pressable>
      <View style={s.destination}>
        <Pressable testID="route-destination-field" accessibilityLabel={`도착지, ${props.destinationLabel}`} style={[s.field, s.destinationField]} onPress={props.onDestination}>
          <Text style={s.label}>도착지</Text><Text numberOfLines={props.largeText ? undefined : 1} style={s.value}>{props.destinationLabel}</Text><Text style={s.arrow}>›</Text>
        </Pressable>
        {props.hasDestination ? <Pressable testID="route-return-origin" accessibilityLabel="출발지로 돌아오기" style={s.returnButton} onPress={props.onReturn}><Text style={s.returnText}>복귀</Text></Pressable> : null}
      </View>
    </View>
    <View testID="setup-arrival-time"><Text style={s.timeTitle}>도착 시각</Text>{props.wheel}</View>
    {props.slider}
    {props.error ? <Text testID="setup-input-error" accessibilityRole="alert" style={s.error}>{props.error}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  body: { gap: 10, justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 8 },
  clock: { color: C.muted, fontSize: 13, lineHeight: 20 }, fields: { gap: 6 },
  field: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  label: { color: C.muted, fontSize: 12, fontWeight: '700' }, value: { flex: 1, color: C.txt, fontSize: 15, fontWeight: '800' }, arrow: { color: C.muted, fontSize: 22 },
  destination: { flexDirection: 'row', gap: 6 }, destinationField: { flex: 1 }, returnButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }, returnText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  timeTitle: { color: C.txt, fontSize: 15, fontWeight: '800', lineHeight: 24 }, error: { color: C.red, fontSize: 13, lineHeight: 19 },
});
