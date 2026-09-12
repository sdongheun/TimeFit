import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AnimatedPressable as Pressable } from './AnimatedPressable';
import { C } from './theme';
import { createHistorySwipeMotion, HISTORY_DELETE_WIDTH } from './historySwipeMotion';

export function HistorySwipeRow({ id, open, busy, onOpen, onClose, onDelete, children, date, onMenu }: {
  id: string; open: boolean; busy: boolean; onOpen(): void; onClose(): void; onDelete(): void; children: ReactNode; date?: string; onMenu?(): void;
}) {
  const touch = useRef({ cancelled: false, x: 0, y: 0 });
  const position = useRef(new Animated.Value(0)).current;
  const latest = useRef({ open, busy, onOpen, onClose });
  latest.current = { open, busy, onOpen, onClose };
  const motion = useMemo(() => createHistorySwipeMotion({
    stop: cb => position.stopAnimation(cb), write: n => position.setValue(n),
    animate: (toValue, complete) => Animated.spring(position, { toValue, useNativeDriver: true, damping: 24, stiffness: 240, mass: 0.8, isInteraction: false }).start(({ finished }) => { if (finished) complete(); }),
    settled: expanded => { if (!expanded) latest.current.onClose(); },
  }), [position]);
  useEffect(() => { motion.activate(); return () => motion.dispose(); }, [motion]);
  useEffect(() => { motion.sync(open && !busy, !open || busy); }, [motion, open, busy]);
  const pan = useMemo(() => {
    const shouldClaim = (_: unknown, g: { dx: number; dy: number }) => {
      if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) touch.current.cancelled = true;
      return !latest.current.busy && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
    };
    return PanResponder.create({
    onMoveShouldSetPanResponderCapture: shouldClaim,
    onMoveShouldSetPanResponder: shouldClaim,
    onPanResponderGrant: (_, g) => { touch.current.cancelled = true; if (!latest.current.busy) { motion.grant(g?.dx ?? 0); latest.current.onOpen(); } },
    onPanResponderMove: (_, g) => motion.move(g.dx),
    onPanResponderRelease: (_, g) => { motion.move(g.dx); motion.release(); },
    onPanResponderTerminate: () => motion.cancel(),
    // Once horizontal ownership is established, reversal must not yield to the
    // vertical parent. Vertical-first gestures never acquire this responder.
    onPanResponderTerminationRequest: () => false,
  }); }, [motion]);
  return <View style={s.root}>
    {open ? <Pressable testID={`history-trash-${id}`} accessibilityLabel="방문 기록 삭제" disabled={busy} style={s.trash} onPress={() => { if (!busy && motion.isRevealed()) onDelete(); }}><Feather name="trash-2" size={22} color={C.onAccent} /></Pressable> : null}
    <Animated.View testID={`history-swipe-${id}`} accessibilityActions={[{ name: 'delete', label: '방문 기록 삭제' }]} onAccessibilityAction={({ nativeEvent }) => { if (!busy && nativeEvent.actionName === 'delete') onDelete(); }} {...pan.panHandlers} style={[s.content, { transform: [{ translateX: position }] }]}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable testID={`history-longpress-${id}`} style={{ flex: 1, minWidth: 0 }} disabled={busy} delayLongPress={500}
          accessibilityActions={[{ name: 'delete', label: '방문 기록 삭제' }]} onAccessibilityAction={({ nativeEvent }) => { if (!busy && nativeEvent.actionName === 'delete') onDelete(); }}
          onPressIn={({ nativeEvent }) => { touch.current = { cancelled: false, x: nativeEvent.pageX, y: nativeEvent.pageY }; }}
          onTouchMove={({ nativeEvent }) => { if (Math.abs(nativeEvent.pageX - touch.current.x) > 6 || Math.abs(nativeEvent.pageY - touch.current.y) > 6) touch.current.cancelled = true; }}
          onTouchCancel={() => { touch.current.cancelled = true; }}
          onLongPress={() => { if (!busy && !touch.current.cancelled) { touch.current.cancelled = true; onMenu?.(); } }}>{children}</Pressable>
        <View style={{ flexShrink: 0, alignItems: 'flex-end' }}><Text style={{ color: C.muted, fontSize: 12 }}>{date}</Text><Pressable testID={`history-menu-${id}`} accessibilityLabel="삭제 버튼 펼치기" accessibilityState={{ expanded: open }} disabled={busy} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => { if (busy) return; touch.current.cancelled = true; motion.sync(true, true); onOpen(); }}><Feather name="chevron-right" size={22} color={C.txt} /></Pressable></View>
      </View>
    </Animated.View>
  </View>;
}
const s = StyleSheet.create({ root: { overflow: 'hidden', borderRadius: 14, marginBottom: 10 }, content: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 16 }, trash: { position: 'absolute', right: 0, top: 0, bottom: 0, width: HISTORY_DELETE_WIDTH, borderRadius: 14, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' } });
