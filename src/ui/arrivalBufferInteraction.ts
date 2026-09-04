export type ArrivalBufferDecision = Readonly<{
  value: number;
  haptic: boolean;
}>;

export const ARRIVAL_BUFFER_MIN = 5;
export const ARRIVAL_BUFFER_MAX = 30;
export const ARRIVAL_BUFFER_STEP = 5;

export function normalizeArrivalBuffer(value: number): number {
  if (!Number.isFinite(value)) return ARRIVAL_BUFFER_MIN;
  const stepped = Math.round(value / ARRIVAL_BUFFER_STEP) * ARRIVAL_BUFFER_STEP;
  return Math.max(ARRIVAL_BUFFER_MIN, Math.min(ARRIVAL_BUFFER_MAX, stepped));
}

/** Slider 사용자 drag와 mount/외부 동기화를 구분하는 화면 수명 단위 controller다. */
export function createArrivalBufferInteraction(initialValue: number) {
  let dragging = false;
  let lastHapticValue = normalizeArrivalBuffer(initialValue);
  const decision = (value: number, haptic = false): ArrivalBufferDecision => ({ value: normalizeArrivalBuffer(value), haptic });

  return {
    begin(currentValue: number): ArrivalBufferDecision {
      dragging = true;
      lastHapticValue = normalizeArrivalBuffer(currentValue);
      return decision(currentValue);
    },
    change(nextValue: number): ArrivalBufferDecision {
      const value = normalizeArrivalBuffer(nextValue);
      if (!dragging || value === lastHapticValue) return decision(value);
      lastHapticValue = value;
      return decision(value, true);
    },
    complete(finalValue: number): ArrivalBufferDecision {
      dragging = false;
      lastHapticValue = normalizeArrivalBuffer(finalValue);
      return decision(finalValue);
    },
    syncExternal(nextValue: number): ArrivalBufferDecision {
      const value = normalizeArrivalBuffer(nextValue);
      if (!dragging) lastHapticValue = value;
      return decision(value);
    },
  };
}
