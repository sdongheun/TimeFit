export type FloatingTabMaterial = 'liquid' | 'blur' | 'solid';

type FloatingTabMaterialInput = Readonly<{
  platform: string;
  liquidGlassAvailable: boolean;
  glassApiAvailable: boolean;
  reduceTransparency: boolean;
}>;

/** 시각 재질만 결정한다. 탭 선택·navigation·haptic 의미는 포함하지 않는다. */
export function resolveFloatingTabMaterial(input: FloatingTabMaterialInput): FloatingTabMaterial {
  if (input.platform !== 'ios' || input.reduceTransparency) return 'solid';
  if (input.liquidGlassAvailable && input.glassApiAvailable) return 'liquid';
  return 'blur';
}

/** 탭바 안의 가로 좌표를 가장 가까운 균등 탭 index로 바꾸고 바깥 이동은 끝 탭에 고정한다. */
export function resolveFloatingTabIndexAtX(
  x: number,
  width: number,
  tabCount: number,
  horizontalInset = 0,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width <= horizontalInset * 2 || tabCount <= 0) return 0;
  const usableWidth = width - horizontalInset * 2;
  const slotWidth = usableWidth / tabCount;
  const clampedX = Math.max(0, Math.min(usableWidth, x - horizontalInset));
  return Math.max(0, Math.min(tabCount - 1, Math.floor(clampedX / slotWidth)));
}

/** 자식 view의 localX에 의존하지 않고 시작 탭과 누적 이동 거리로 연속 렌즈 위치를 계산한다. */
export function resolveFloatingTabProgressFromDrag(
  startIndex: number,
  deltaX: number,
  width: number,
  tabCount: number,
  horizontalInset = 0,
): number {
  const lastIndex = Math.max(0, tabCount - 1);
  const safeStart = Math.max(0, Math.min(lastIndex, Number.isFinite(startIndex) ? startIndex : 0));
  if (!Number.isFinite(deltaX) || !Number.isFinite(width) || width <= horizontalInset * 2 || tabCount <= 0) return safeStart;
  const slotWidth = (width - horizontalInset * 2) / tabCount;
  return Math.max(0, Math.min(lastIndex, safeStart + deltaX / slotWidth));
}

export function resolveFloatingTabIndexFromDrag(
  startIndex: number,
  deltaX: number,
  width: number,
  tabCount: number,
  horizontalInset = 0,
): number {
  return Math.round(resolveFloatingTabProgressFromDrag(startIndex, deltaX, width, tabCount, horizontalInset));
}
