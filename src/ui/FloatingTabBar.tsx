import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';

export type MainTabKey = 'main' | 'course' | 'profile';

type Props = {
  active: MainTabKey;
  onMain: () => void;
  onCourse: () => void;
  onProfile: () => void;
};

const TABS: { key: MainTabKey; label: string; mark: string }[] = [
  { key: 'main', label: '메인', mark: '⌕' },
  { key: 'course', label: '내 코스', mark: '□' },
  { key: 'profile', label: '내정보', mark: '●' },
];

export function FloatingTabBar({ active, onMain, onCourse, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const handlers: Record<MainTabKey, () => void> = {
    main: onMain,
    course: onCourse,
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
              <Text style={[s.mark, isActive && s.markOn]}>{tab.mark}</Text>
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
  mark: { color: C.muted, fontSize: 15, fontWeight: '900', lineHeight: 18 },
  markOn: { color: C.accent },
  label: { color: C.muted, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  labelOn: { color: C.txt },
});
