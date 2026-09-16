import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { C } from './theme';

export function RecordEmptyState({ onCreateCourse }: { onCreateCourse?: () => void }) {
  return <View testID="record-empty-state" style={s.root}>
    <View style={s.icon}><Feather name="map-pin" size={30} color={C.accent} /></View>
    <Text style={s.title}>아직 방문 기록이 없어요</Text>
    <Text style={s.copy}>코스를 마치면 다녀온 장소와 활동 기록이 여기에 쌓여요.</Text>
    {onCreateCourse ? <Pressable testID="record-empty-create-course" accessibilityRole="button" style={s.button} onPress={onCreateCourse}><Text style={s.buttonText}>코스 만들기</Text></Pressable> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { minHeight: 320, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  icon: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: C.txt, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  copy: { maxWidth: 270, color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9 },
  button: { width: '100%', maxWidth: 260, minHeight: 52, marginTop: 22, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: C.onAccent, fontSize: 16, fontWeight: '800' },
});
