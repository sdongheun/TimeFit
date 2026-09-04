import * as Haptics from 'expo-haptics';
import { createSelectionHapticRequester } from './selectionHaptic';

/** Expo native 모듈 의존은 이 UIUX adapter 한 곳에만 둔다. */
export const requestExpoSelectionHaptic = createSelectionHapticRequester(
  { selection: () => Haptics.selectionAsync() },
  {
    dev: typeof __DEV__ !== 'undefined' && __DEV__,
    onDiagnostic: (reason) => console.warn(`[selection-haptic] ${reason}`),
  },
);
