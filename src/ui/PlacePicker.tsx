import { Fragment, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocationKeyboardLayout } from './locationKeyboardLayout';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LatLon } from '../engine';
import { createKakaoLocationSearchAdapter } from '../services/kakaoLocationSearchAdapter';
import { createKakaoLocationLabelAdapter } from '../services/kakaoLocationLabelAdapter';
import { C } from './theme';
import { shouldDebounceLocationSearch } from './locationSelectionModel';
import { createLocationSearchDraft, locationCandidateId, selectedRowScrollOffset, type DraftPlace, type LocationSearchDraft } from './locationSearchDraft';

export type Place = DraftPlace;
type Props = {
  visible: boolean; title: string; center: LatLon; showGps?: boolean;
  editingSession?: LocationSearchDraft;
  labelAdapter?: ReturnType<typeof createKakaoLocationLabelAdapter>;
  onOpenMap(): void; onClose(): void; onConfirm(p: Place): void;
};

/** The parent owns the editing lifetime; map round trips retain only that session's draft. */
export function PlacePicker({ visible, title, editingSession, onOpenMap, onClose, onConfirm }: Props) {
  const ownSession = useRef(createLocationSearchDraft()).current;
  const draft = editingSession ?? ownSession;
  const [, refresh] = useState(0);
  const insets = useSafeAreaInsets();
  const keyboardLayout = useLocationKeyboardLayout(visible, insets.bottom);
  const locationSearch = useRef(createKakaoLocationSearchAdapter()).current;
  const list = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const rowFrames = useRef(new Map<string, { y: number; height: number }>());
  const state = draft.get(), candidate = draft.choice();
  const choice = candidate?.source === 'device' ? null : candidate;
  const choiceId = state.deviceLocation ? 'device' : state.selectedId;
  useEffect(() => draft.subscribe(() => refresh(n => n + 1)), [draft]);
  useEffect(() => {
    if (editingSession) return;
    if (visible) draft.start(title); else draft.end();
    return () => draft.end();
  }, [draft, editingSession, title, visible]);
  useEffect(() => { rowFrames.current.clear(); }, [state.epoch, state.query]);

  async function search(explicit: boolean) {
    if (explicit) Keyboard.dismiss();
    const request = draft.beginSearch(explicit);
    if (!request) return;
    const query = draft.get().query.trim();
    try {
      const response = await locationSearch.search(query);
      const applied = draft.resolveSearch(request, response);
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[location-search-complete]', { attempts: response.attempts.map(a => a.status), providerRequests: response.diagnostics.providerRequests, fallbackCount: response.diagnostics.fallbackCount, cache: response.diagnostics.cache, resultCount: response.suggestions.length, staleIgnored: !applied });
    } catch { draft.fail(request, '위치 검색을 준비하지 못했어요. 다시 검색해 주세요.'); }
  }
  useEffect(() => {
    if (!visible || state.phase !== 'search' || !shouldDebounceLocationSearch(state.query)) return;
    const epoch = state.epoch, query = state.query;
    const timer = setTimeout(() => {
      if (draft.get().epoch === epoch && draft.get().query === query) void search(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, state.epoch, state.query, state.phase, draft]);

  const changeQuery = (value: string) => {
    if (value.trim() !== draft.get().query.trim()) list.current?.scrollTo({ y: 0, animated: false });
    draft.changeQuery(value);
  };
  const close = () => { Keyboard.dismiss(); draft.end(); onClose(); };
  const openMap = () => { Keyboard.dismiss(); draft.pause(); onOpenMap(); };
  const revealSelection = () => {
    const current = draft.get();
    if (!visible || current.phase !== 'search') return;
    const id = current.deviceLocation ? 'device' : current.selectedId;
    const y = selectedRowScrollOffset(current.scrollY, viewport.current, id ? rowFrames.current.get(id) : undefined);
    if (y !== current.scrollY) { draft.rememberScroll(y); list.current?.scrollTo({ y, animated: false }); }
  };
  const frame = (id: string, value: { y: number; height: number }) => { rowFrames.current.set(id, value); if (id === choiceId) revealSelection(); };
  const confirm = () => {
    if (draft.choice()?.source === 'device') return;
    const selected = draft.claimConfirmation(state.epoch);
    if (!selected) return;
    Keyboard.dismiss(); onConfirm(selected); draft.end(); onClose();
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={close} onShow={() => { list.current?.scrollTo({ y: draft.get().scrollY, animated: false }); }}>
    <View testID="location-keyboard-layout" onLayout={keyboardLayout.onLayout} style={[s.root, { paddingBottom: keyboardLayout.overlap }]}>
      <ScrollView testID="location-results" ref={list} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
        onLayout={({ nativeEvent }) => { viewport.current = nativeEvent.layout.height; revealSelection(); }} onScroll={({ nativeEvent }) => draft.rememberScroll(nativeEvent.contentOffset.y)} scrollEventThrottle={16}>
        <View style={[s.head, { paddingTop: insets.top + 12 }]}><Text style={s.title}>{title}</Text><Pressable testID="location-close" variant="icon" accessibilityLabel="위치 검색 닫기" onPress={close} style={s.closeButton}><Text style={s.close}>✕</Text></Pressable></View>
        <View style={s.searchRow}>
          <TextInput testID="location-search-input" accessibilityLabel="장소명 또는 주소 검색" style={s.input} value={state.query} onChangeText={changeQuery} autoFocus={!state.query && !choice} placeholder="예: 부산역 / 벡스코 / 사상역" placeholderTextColor={C.muted} returnKeyType="search" onSubmitEditing={() => { void search(true); }} />
          <Pressable testID="location-search-submit" accessibilityLabel="위치 검색" style={s.searchBtn} onPress={() => { void search(true); }}>{state.busy === 'search' ? <ActivityIndicator color={C.accent} /> : <Text style={s.searchBtnTxt}>검색</Text>}</Pressable>
        </View>
        <View testID="location-alternatives" style={s.searchRow}>
          <Pressable testID="location-map" style={[s.searchBtn, s.half]} onPress={openMap}><Text style={s.searchBtnTxt}>지도에서 선택</Text></Pressable>
        </View>
        {state.message ? <Text accessibilityLiveRegion="polite" style={s.msg}>{state.message}</Text> : null}
        {state.suggestions.map((p, i) => {
          const id = locationCandidateId(p), selected = state.selectedId === id && !state.deviceLocation;
          return <Fragment key={id}><Pressable testID={`location-suggestion-${i}`} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${p.label}, ${p.address}${selected ? ', 선택됨' : ''}`}
            onLayout={({ nativeEvent }) => frame(id, nativeEvent.layout)} style={[s.row, selected && s.rowOn]} onPress={() => { if (draft.select(id)) { Keyboard.dismiss(); revealSelection(); } }}>
            <Text style={s.rowName}>{p.label}</Text><Text style={s.rowAddr}>{p.address}</Text>
            {selected ? <Text style={s.selected}>선택됨</Text> : null}
          </Pressable>{i < state.suggestions.length - 1 ? <View testID={`location-separator-${i}`} accessible={false} importantForAccessibility="no" style={s.separator} /> : null}</Fragment>;
        })}
      </ScrollView>
      {choice ? <View testID="location-footer" style={[s.footer, { paddingBottom: keyboardLayout.footerPadding }]}><Pressable testID="location-confirm" accessibilityLabel={`이 위치로 확정, ${choice.label}`} style={s.cta} onPress={confirm}><Text style={s.ctaTxt}>이 위치로 확정 — {choice.label}</Text></Pressable></View> : null}
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 }, title: { flex: 1, color: C.txt, fontSize: 18, fontWeight: '800' }, closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, close: { color: C.muted, fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 10 }, input: { flex: 1, minHeight: 44, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 14, color: C.txt, fontSize: 15 },
  searchBtn: { minHeight: 44, minWidth: 44, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' }, half: { flex: 1 }, searchBtnTxt: { color: C.txt, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  msg: { color: C.muted, fontSize: 13, paddingHorizontal: 20, marginBottom: 8 }, row: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 12, marginHorizontal: 18, marginBottom: 6, borderWidth: 1, borderColor: 'transparent', borderRadius: 10 }, rowOn: { backgroundColor: 'rgba(0,102,255,0.10)', borderColor: '#4b85cf' }, rowName: { color: C.txt, fontSize: 16, fontWeight: '700' }, rowAddr: { color: C.txt2, fontSize: 14, marginTop: 4 }, selected: { color: C.txt, fontSize: 13, marginTop: 4, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#454952', marginHorizontal: 18, marginBottom: 6 },
  footer: { paddingHorizontal: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line }, cta: { minHeight: 52, backgroundColor: C.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 }, ctaTxt: { color: C.onAccent, fontSize: 15, fontWeight: '800', textAlign: 'center' },
});
