import type { PlanInput } from '../../engine/types';

export type TimeSetupClock = {
  nowMin: number;
  dayType: PlanInput['dayType'];
  hourBucket: PlanInput['hourBucket'];
};

export function resolveTimeSetupClock(real: TimeSetupClock, testNowMin: number | null): TimeSetupClock {
  if (testNowMin == null) return real;
  const nowMin = Math.max(0, Math.min(23 * 60 + 59, Math.round(testNowMin)));
  return { ...real, nowMin, hourBucket: hourBucketForMinute(nowMin) };
}

export function suggestedEndForTestClock(nowMin: number): number {
  return Math.min(23 * 60 + 59, nowMin + 180);
}

export function hourBucketForMinute(minuteOfDay: number): PlanInput['hourBucket'] {
  const hour = Math.floor(minuteOfDay / 60);
  return hour < 11 ? '아침' : hour < 14 ? '점심' : hour < 17 ? '오후' : hour < 21 ? '저녁' : '야간';
}
