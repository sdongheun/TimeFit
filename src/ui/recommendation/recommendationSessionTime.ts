/** 추천 화면에 전달할 시각은 UTC ISO 문자열만 허용해 navigation state를 직렬화 가능하게 유지한다. */
export function parseRecommendationNowIso(nowIso: string): Date {
  const parsed = new Date(nowIso);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(nowIso) || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== nowIso) {
    throw new Error('추천 시각은 유효한 UTC ISO 문자열이어야 합니다.');
  }
  return parsed;
}

/** 운영은 클릭 순간, 개발 fixture는 같은 날짜의 고정 시:분을 한 번만 캡처한다. */
export function captureRecommendationNowIso(capturedAt: Date, testNowMin: number | null): string {
  const captured = new Date(capturedAt);
  if (testNowMin != null) captured.setHours(Math.floor(testNowMin / 60), testNowMin % 60, 0, 0);
  return captured.toISOString();
}

/** 시간 여정의 시작 표시는 엔진에 전달한 것과 같은 직렬화 시각을 복원한다. */
export function startMinuteForRecommendation(nowIso: string): number {
  const now = parseRecommendationNowIso(nowIso);
  return now.getHours() * 60 + now.getMinutes();
}
