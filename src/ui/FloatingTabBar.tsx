import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';

export type MainTabKey = 'main' | 'course' | 'record' | 'profile';

type Props = {
  active: MainTabKey;
  onMain: () => void;
  onCourse: () => void;
  onRecord: () => void;
  onProfile: () => void;
};

const TABS: { key: MainTabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'main', label: '메인', icon: 'search' },
  { key: 'course', label: '내 코스', icon: 'map' },
  { key: 'record', label: '기록', icon: 'pie-chart' },
  { key: 'profile', label: '내정보', icon: 'user' },
];

export function FloatingTabBar({ active, onMain, onCourse, onRecord, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const handlers: Record<MainTabKey, () => void> = {
    main: onMain,
    course: onCourse,
    record: onRecord,
    profile: onProfile,
  };

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom, 18) }]}>
      <View style={s.bar}>
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[s.item, isActive && s.itemOn]}
              onPress={handlers[tab.key]}
            >
              <Feather name={tab.icon} size={17} color={isActive ? C.accent : C.muted} />
              <Text style={[s.label, isActive && s.labelOn]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(21,27,35,0.96)',
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: { flex: 1, minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: 'rgba(76,194,255,0.14)' },
  label: { color: C.muted, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  labelOn: { color: C.txt },
});
