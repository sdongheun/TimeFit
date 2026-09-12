import { StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { C } from './theme';

/** Camera-only return to an explicitly supplied selected place; never reads device position. */
export function MapCameraButton({ point, onCamera, disabled = false, style, testID = 'map-camera-current' }: { point?: { lat: number; lon: number } | null; onCamera(point: { lat: number; lon: number }): void; scopeKey?: string; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) return null;
  return <Pressable testID={testID} variant="icon" accessibilityRole="button" accessibilityLabel="선택 장소로 이동" accessibilityHint="선택한 장소로 지도만 이동합니다" disabled={disabled} style={[s.button, style]} onPress={() => { if (!disabled) onCamera({ ...point }); }}><Text accessible={false} style={s.icon}>◎</Text></Pressable>;
}
const s = StyleSheet.create({ button: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, icon: { color: C.txt, fontSize: 26, fontWeight: '700' } });
