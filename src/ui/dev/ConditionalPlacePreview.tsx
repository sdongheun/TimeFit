import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable as Pressable } from '../AnimatedPressable';
import { ConditionalVisitSection, type ConditionalManualState } from '../recommendation/ConditionalVisitSection';
import { C } from '../theme';
import { conditionalPlacePreviewFixtures as fixtures } from './conditionalPlacePreviewFixtures';

// This boundary also rejects direct rendering, not just the launcher entry.
export function ConditionalPlacePreview({ onClose }: { onClose: () => void }) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return <PreviewContent onClose={onClose} />;
}

function PreviewContent({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [count, setCount] = useState(2);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const permitted = () => typeof __DEV__ !== 'undefined' && __DEV__;
  const blocked = () => { if (permitted()) setFeedback('미리보기에서는 실행하지 않아요'); };
  const states: Record<string, ConditionalManualState> = {
    [fixtures[0].id]: { loading: state === 'loading', ...(state === 'error' ? { error: '고정 오류 예시 · 실제 요청은 실행하지 않았어요' } : {}) },
  };
  return <View style={s.root}><ScrollView contentContainerStyle={[s.body, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20 }]}>
    <Text style={s.label}>개발용 미리보기 · 실제 추천/저장 없음</Text>
    <Pressable testID="conditional-preview-close" style={s.button} onPress={() => { if (permitted()) onClose(); }}><Text style={s.text}>닫기</Text></Pressable>
    <Text style={s.text}>합성 장소 fixture · 운영시간과 코스를 검증한 결과가 아니에요</Text>
    {(['idle', 'loading', 'error'] as const).map(value => <Pressable key={value} testID={`conditional-preview-${value}`} style={s.button} onPress={() => { if (permitted()) setState(value); }}><Text style={s.text}>{value === 'idle' ? '기본 상태' : value === 'loading' ? '로딩 상태' : '오류 상태'}</Text></Pressable>)}
    {feedback ? <Text accessibilityRole="alert" style={s.text}>{feedback}</Text> : null}
    <ConditionalVisitSection places={fixtures.slice(0, count)} nextCursor={count < fixtures.length ? count : null}
      displayPlace={id => ({ ...fixtures.find(place => place.id === id)!, lat: 0, lon: 0 })} discoveryContext={() => null}
      onOpenKakao={blocked} onConfirm={blocked} onMore={() => { if (permitted()) setCount(value => Math.min(fixtures.length, value + 2)); }}
      manualStates={states} session={{ nowIso: '2026-09-08T06:00:00.000Z' }} />
  </ScrollView></View>;
}
const s = StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg }, body: { paddingHorizontal: 22, gap: 14 }, label: { color: C.txt, fontSize: 17, fontWeight: '800' }, text: { color: C.txt, fontSize: 14 }, button: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12 } });
