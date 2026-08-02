import type { DayType, HourBucket } from '../engine';

export type ReplanTimingInput = {
  timeText: string;
  endMin: number;
  currentMin: number;
  ctxDayType?: DayType;
  ctxHourBucket?: HourBucket;
  ctxIsManualTime?: boolean;
  realDayType: DayType;
  realHourBucket: HourBucket;
};

export type ReplanTimingResult =
  | { ok: true; nowMin: number; remainingMin: number; dayType: DayType; hourBucket: HourBucket; isManualTime: boolean }
  | { ok: false; error: string };

export function parseClockMinute(txt: string): number | null {
  const trimmed = txt.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = m[2] ? Number(m[2]) : 0;
  if (!Number.isInteger(h) || !Number.isInteger(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function hourBucketOfMinute(min: number): HourBucket {
  const h = Math.floor((((min % 1440) + 1440) % 1440) / 60);
  return h < 11 ? '아침' : h < 14 ? '점심' : h < 17 ? '오후' : h < 21 ? '저녁' : '야간';
}

export function resolveReplanTiming(input: ReplanTimingInput): ReplanTimingResult {
  const manualNowMin = parseClockMinute(input.timeText);
  const usingManualNow = manualNowMin != null;
  if (input.timeText.trim() && manualNowMin == null) {
    return { ok: false, error: '재검색 기준 시각은 HH:MM 형식으로 입력하세요.' };
  }

  const nowMin = manualNowMin ?? input.currentMin;
  const remainingMin = Math.max(0, input.endMin - nowMin);
  if (remainingMin > 240) {
    return { ok: false, error: '재검색 남은 시간은 최대 240분까지 입력하세요.' };
  }
  if (remainingMin < 30) {
    return { ok: false, error: '남은 시간이 30분 미만이라 새 코스보다 바로 다음 일정으로 이동하는 편이 안전해요.' };
  }

  const dayType = input.ctxDayType ?? input.realDayType;
  const hourBucket = usingManualNow
    ? hourBucketOfMinute(nowMin)
    : input.ctxIsManualTime
      ? (input.ctxHourBucket ?? hourBucketOfMinute(nowMin))
      : input.realHourBucket;

  return {
    ok: true,
    nowMin,
    remainingMin,
    dayType,
    hourBucket,
    isManualTime: Boolean(input.ctxIsManualTime || usingManualNow),
  };
}
