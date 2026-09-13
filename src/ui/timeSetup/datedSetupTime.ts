import { RELEASE_MAX_MINUTES } from './releaseTimeBoundary';
import { parseRecommendationNowIso } from '../recommendation/recommendationSessionTime';

/** Original recommendation deadline, never a fresh duration granted at click time. */
export function canStartRecommendationSession(session: { nowIso: string; remainingMin: number }, nowMs: number): boolean {
  try {
    const startMs = parseRecommendationNowIso(session.nowIso).getTime();
    return Number.isFinite(nowMs) && Number.isInteger(session.remainingMin)
      && session.remainingMin > 0 && session.remainingMin <= RELEASE_MAX_MINUTES
      && nowMs < startMs + session.remainingMin * 60_000;
  } catch { return false; }
}

/** Infer tomorrow only inside the next three hours, anchored to the setup clock's date. */
export function resolveArrivalMinute(nowMin: number, selectedMinute: number): number {
  const nextDayRemaining = selectedMinute + 1440 - nowMin;
  return selectedMinute < nowMin && nextDayRemaining > 0 && nextDayRemaining <= RELEASE_MAX_MINUTES
    ? selectedMinute + 1440 : selectedMinute;
}

/** Wheel values are local calendar minutes, including the validated midnight offset. */
export function setupDeadlineIso(base: Date, minute: number): string {
  const deadline = new Date(base);
  deadline.setHours(0, minute, 0, 0);
  return deadline.toISOString();
}

/** Preserve the date when submitting after midnight. Round down rather than exceed the chosen deadline. */
export function remainingSetupMinutes(deadlineIso: string, nowIso: string): number {
  return Math.floor((Date.parse(deadlineIso) - Date.parse(nowIso)) / 60_000);
}

export function datedMinuteLabel(minute: number): string {
  const day = Math.floor(minute / 1440);
  const m = ((minute % 1440) + 1440) % 1440;
  return `${day > 0 ? (day === 1 ? '내일 ' : `${day}일 후 `) : ''}${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export function recommendationDeadlineLabel(session: { nowIso: string; remainingMin: number }): string {
  const start = new Date(session.nowIso);
  const end = new Date(start.getTime() + session.remainingMin * 60_000);
  const nextDay = start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth() || start.getDate() !== end.getDate();
  return `${end.getMonth() + 1}/${end.getDate()} ${datedMinuteLabel(end.getHours() * 60 + end.getMinutes())}${nextDay ? ' (익일)' : ''}`;
}
