import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';

type Props = {
  header: ReactNode; clockLabel: string; originLabel: string; destinationLabel: string;
  hasDestination: boolean; largeText: boolean; wheel: ReactNode; slider: ReactNode; error: string;
  viewportHeight: number; nextDayArrival?: boolean;
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
      <View testID="setup-route-connector" accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={s.routeConnector}>{[0, 1, 2].map(index => <View key={index} style={s.routeDot} />)}</View>
      <View style={s.destination}>
        <Pressable testID="route-destination-field" accessibilityLabel={`마지막 도착지, ${props.destinationLabel}`} style={[s.field, s.destinationField]} onPress={props.onDestination}>
          <Text style={s.label}>마지막 도착지</Text><Text numberOfLines={props.largeText ? undefined : 1} style={s.value}>{props.destinationLabel}</Text><Text style={s.arrow}>›</Text>
        </Pressable>
        {props.hasDestination ? <Pressable testID="route-return-origin" accessibilityLabel="출발지로 돌아오기" style={s.returnButton} onPress={props.onReturn}><Text style={s.returnText}>출발지로 돌아오기</Text></Pressable> : null}
      </View>
    </View>
    <View testID="setup-arrival-time" style={[s.section, s.arrivalSection]}><View style={s.timeHeading}><Text style={s.timeTitle}>도착 시각</Text>{props.nextDayArrival ? <Text testID="setup-next-day-arrival" style={s.nextDay}>다음 날 도착</Text> : null}</View>{props.wheel}</View>
    <View testID="setup-buffer-section" style={s.section}>{props.slider}</View>
    {props.error ? <Text testID="setup-input-error" accessibilityRole="alert" style={s.error}>{props.error}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  body: { justifyContent: 'flex-start', paddingHorizontal: 22, paddingVertical: 8 },
  clock: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 }, fields: { gap: 0 }, section: { marginTop: 32 }, arrivalSection: { gap: 14 }, routeConnector: { height: 24, justifyContent: 'center', gap: 3, paddingLeft: 26 }, routeDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.muted },
  field: { minHeight: 52, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  label: { minWidth: 78, color: C.muted, fontSize: 12, fontWeight: '700' }, value: { flex: 1, color: C.txt, fontSize: 15, fontWeight: '800' }, arrow: { color: C.muted, fontSize: 22 },
  destination: { gap: 8 }, destinationField: { width: '100%' }, returnButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, returnText: { color: C.txt, fontSize: 13, fontWeight: '700' },
  timeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeTitle: { color: C.txt, fontSize: 15, fontWeight: '800', lineHeight: 24 }, nextDay: { color: C.muted, fontSize: 13, lineHeight: 20 }, error: { color: C.red, fontSize: 13, lineHeight: 19, marginTop: 16 },
});
