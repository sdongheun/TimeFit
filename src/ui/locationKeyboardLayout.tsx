import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent, type LayoutChangeEvent } from 'react-native';

/** Full-screen Modal coordinates; never estimates keyboard height from input focus. */
export function locationKeyboardGeometry(bottom: number, screenY: number | null, safeBottom: number) {
  const overlap = screenY === null ? 0 : Math.max(0, bottom - screenY);
  return { overlap, footerPadding: overlap > 0 ? 8 : Math.max(safeBottom, 12) };
}

/** One owner for keyboard displacement AND footer safe area, scheduled from the same native event. */
export function useLocationKeyboardLayout(visible: boolean, safeBottom: number) {
  const dimensions = useWindowDimensions();
  const bottom = useRef(dimensions.height);
  const screenY = useRef<number | null>(null);
  const [geometry, setGeometry] = useState(() => locationKeyboardGeometry(bottom.current, null, safeBottom));
  const latest = useRef(geometry);
  const update = (event?: KeyboardEvent) => {
    const next = locationKeyboardGeometry(bottom.current, screenY.current, safeBottom);
    if (next.overlap === latest.current.overlap && next.footerPadding === latest.current.footerPadding) return;
    if (event) Keyboard.scheduleLayoutAnimation(event); // RN consumes system duration/easing, including keyboard curve.
    latest.current = next;
    setGeometry(next);
  };
  useEffect(() => {
    if (!visible) { screenY.current = null; update(); return; }
    update();
    let active = true;
    const frame = (event: KeyboardEvent) => {
      if (!active || !Number.isFinite(event.endCoordinates.screenY)) return;
      screenY.current = event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null;
      update(event);
    };
    const hide = (event: KeyboardEvent) => { if (active) { screenY.current = null; update(event); } };
    const subscriptions = Platform.OS === 'ios'
      ? [Keyboard.addListener('keyboardWillChangeFrame', frame), Keyboard.addListener('keyboardWillShow', frame), Keyboard.addListener('keyboardWillHide', hide)]
      : [Keyboard.addListener('keyboardDidShow', frame), Keyboard.addListener('keyboardDidHide', hide)];
    return () => { active = false; subscriptions.forEach(s => s.remove()); };
  }, [visible, safeBottom]);
  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    // Padding does not change this flex:1 root's external frame. No layout→height feedback loop.
    bottom.current = nativeEvent.layout.y + nativeEvent.layout.height;
    update();
  };
  return { ...geometry, onLayout };
}
