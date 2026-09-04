export type TimeWheelDecision = Readonly<{
  activeIndex: number;
  haptic: boolean;
  commitIndex?: number;
  scrollToIndex?: number;
}>;

export function clampTimeWheelIndex(index: number, valueCount: number): number {
  if (!Number.isFinite(index) || valueCount <= 0) return -1;
  return Math.max(0, Math.min(valueCount - 1, Math.round(index)));
}

export function timeWheelIndexForOffset(offsetY: number, rowHeight: number, valueCount: number): number {
  if (!Number.isFinite(offsetY) || !Number.isFinite(rowHeight) || rowHeight <= 0) return clampTimeWheelIndex(0, valueCount);
  return clampTimeWheelIndex(offsetY / rowHeight, valueCount);
}

export function timeWheelMomentumExpected(velocityY: number | undefined, offsetY: number, targetOffsetY: number | undefined): boolean {
  return Math.abs(velocityY ?? 0) > 0.05
    || (Number.isFinite(targetOffsetY) && Math.abs((targetOffsetY ?? offsetY) - offsetY) > 1);
}

/** 사용자 scroll과 controlled prop 동기화를 분리하는 wheel 수명 단위 controller다. */
export function createTimeWheelInteraction(initialIndex: number, initialValueCount: number) {
  let valueCount = Math.max(0, initialValueCount);
  let activeIndex = clampTimeWheelIndex(initialIndex, valueCount);
  let externalIndex = activeIndex;
  let interacting = false;
  let waitingForMomentum = false;

  const decision = (extra: Partial<TimeWheelDecision> = {}): TimeWheelDecision => ({ activeIndex, haptic: false, ...extra });
  const finish = () => {
    interacting = false;
    waitingForMomentum = false;
    if (activeIndex < 0 || activeIndex === externalIndex) return decision();
    externalIndex = activeIndex;
    return decision({ commitIndex: activeIndex });
  };

  return {
    getActiveIndex: () => activeIndex,
    setValueCount(nextCount: number, nextExternalIndex: number): TimeWheelDecision {
      valueCount = Math.max(0, nextCount);
      const next = clampTimeWheelIndex(nextExternalIndex, valueCount);
      externalIndex = next;
      activeIndex = clampTimeWheelIndex(activeIndex < 0 ? next : activeIndex, valueCount);
      if (!interacting && activeIndex !== next) { activeIndex = next; return decision({ scrollToIndex: next }); }
      return decision();
    },
    syncExternal(nextIndex: number): TimeWheelDecision {
      const next = clampTimeWheelIndex(nextIndex, valueCount);
      externalIndex = next;
      if (interacting || waitingForMomentum || next === activeIndex) return decision();
      activeIndex = next;
      return decision({ scrollToIndex: next });
    },
    beginDrag(): TimeWheelDecision { interacting = true; waitingForMomentum = false; return decision(); },
    observeOffset(offsetY: number, rowHeight: number): TimeWheelDecision {
      const next = timeWheelIndexForOffset(offsetY, rowHeight, valueCount);
      if (next < 0 || next === activeIndex) return decision();
      activeIndex = next;
      return decision({ haptic: interacting });
    },
    endDrag(momentumExpected: boolean): TimeWheelDecision {
      if (momentumExpected) { waitingForMomentum = true; return decision(); }
      return finish();
    },
    beginMomentum(): TimeWheelDecision { interacting = true; waitingForMomentum = true; return decision(); },
    endMomentum(): TimeWheelDecision { return finish(); },
    adjust(delta: -1 | 1): TimeWheelDecision {
      const next = clampTimeWheelIndex(activeIndex + delta, valueCount);
      if (next < 0 || next === activeIndex) return decision();
      activeIndex = next;
      externalIndex = next;
      return decision({ commitIndex: next, scrollToIndex: next });
    },
  };
}
