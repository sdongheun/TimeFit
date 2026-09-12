export const RELEASE_MAX_MINUTES = 180;

export function clampReleasePresetMinutes(minutes: number | undefined): number {
  if (!Number.isFinite(minutes)) return RELEASE_MAX_MINUTES;
  return Math.max(1, Math.min(RELEASE_MAX_MINUTES, Math.round(minutes as number)));
}

/** Runs before auth, CAPTCHA, route ports, or the release builder. */
export function releaseTimeSetupValidation(hasOrigin: boolean, remainingMin: number): string {
  if (!hasOrigin) return '출발 위치를 선택해 주세요.';
  if (!Number.isFinite(remainingMin) || remainingMin <= 0) return '도착 시각을 현재 시각 뒤로 설정해 주세요.';
  if (remainingMin > RELEASE_MAX_MINUTES) return '현재 시각부터 최대 3시간 안에서 설정해 주세요.';
  if (!Number.isInteger(remainingMin)) return '시간을 1분 단위로 설정해 주세요.';
  return '';
}
