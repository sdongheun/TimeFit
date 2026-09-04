import { StyleSheet, Text } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { C } from './theme';

export function Chip({ active, onPress, text }: { active: boolean; onPress: () => void; text: string }) {
  return (
    <Pressable style={[s.chip, active && s.on]} onPress={onPress}>
      <Text style={[s.txt, active && s.txtOn]}>{text}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  on: { backgroundColor: C.accent, borderColor: C.accent },
  txt: { color: C.txt2, fontWeight: '600' },
  txtOn: { color: '#06243a' },
});
