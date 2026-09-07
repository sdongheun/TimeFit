import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { C } from '../theme';
import { PlacePhoto } from '../PlacePhoto';
import type { PlacePhotoInput } from '../placePhotoModel';

export type TwoStopTrayPlace = PlacePhotoInput & Readonly<{
  key: string;
  title: string;
  activityLabel: string;
  imageUrl?: string | null;
  removeAccessibilityLabel: string;
  onRemove(): void;
}>;

export function TwoStopSelectionTray({ rows, announcement }: Readonly<{ rows: readonly TwoStopTrayPlace[]; announcement: string }>) {
  return <View testID="two-stop-selection-tray" accessibilityLabel="선택한 장소" style={s.tray}>
    <Text style={s.heading}>선택한 장소</Text>
    {rows.slice(0, 2).map((row) => <TrayRow key={row.key} row={row} />)}
    <Text accessibilityLiveRegion="polite" style={s.live}>{announcement}</Text>
  </View>;
}

function TrayRow({ row }: Readonly<{ row: TwoStopTrayPlace }>) {
  return <View accessibilityLabel={`${row.title}, ${row.activityLabel}`} style={s.row}>
    <PlacePhoto place={row} style={[s.thumb, {flex:0}]} fallback={<View accessible={false} style={s.placeholder}><Text style={s.placeholderText}>{row.activityLabel.slice(0, 1)}</Text></View>} />
    <View style={s.copy}><Text numberOfLines={1} ellipsizeMode="tail" style={s.title}>{row.title}</Text><Text numberOfLines={1} style={s.activity}>{row.activityLabel}</Text></View>
    <Pressable variant="icon" accessibilityRole="button" accessibilityLabel={row.removeAccessibilityLabel} hitSlop={4} style={s.remove} onPress={row.onRemove}><Text style={s.removeText}>×</Text></Pressable>
  </View>;
}

export function TwoStopFixedCourseCta({ pairSelected, bottomInset, onPress }: Readonly<{ pairSelected: boolean; bottomInset: number; onPress(): void }>) {
  const label = pairSelected ? '선택한 2곳 코스 보기' : '이 장소로 코스 보기';
  return <View testID="two-stop-fixed-cta" style={[s.ctaFrame, { paddingBottom: Math.max(bottomInset, 10) }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.cta, pressed && s.pressed]} onPress={onPress}><Text style={s.ctaText}>{label}</Text></Pressable>
  </View>;
}

const s = StyleSheet.create({
  tray: { marginHorizontal: 22, gap: 7, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#3f78bb', backgroundColor: C.panel },
  heading: { color: C.txt, fontSize: 14, fontWeight: '800' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.panel2 },
  placeholder: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#26384a' },
  placeholderText: { color: '#b9d8ff', fontSize: 14, fontWeight: '800' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: C.txt, fontSize: 15, fontWeight: '800' },
  activity: { color: C.muted, fontSize: 12, marginTop: 2 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: C.txt2, fontSize: 28, lineHeight: 30 },
  live: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  ctaFrame: { paddingTop: 10, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg },
  cta: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.accent },
  pressed: { backgroundColor: C.accentPress },
  ctaText: { color: C.onAccent, fontSize: 16, fontWeight: '800', textAlign: 'center' },
});
