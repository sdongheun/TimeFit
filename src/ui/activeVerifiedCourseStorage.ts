import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveVerifiedCourse } from './activeVerifiedCourseModel';

const KEY = '@timefit/active-verified-course-v1';
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function decodePersistedActiveVerifiedCourse(raw: string | null): ActiveVerifiedCourse | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ActiveVerifiedCourse;
    if (!value || !text(value.identity) || !text(value.courseRunId) || !value.session || !Number.isFinite(Date.parse(value.session.nowIso))
      || !value.course || !Array.isArray(value.course.stops) || value.course.stops.length < 1 || value.course.stops.length > 2
      || !Array.isArray(value.course.placeIds) || value.course.placeIds.length !== value.course.stops.length
      || !Array.isArray(value.course.legs) || value.course.legs.length !== value.course.stops.length + 1
      || !value.progress || !Number.isInteger(value.progress.stepIndex) || typeof value.progress.routeOpened !== 'boolean' || typeof value.progress.finished !== 'boolean') return null;
    return value;
  } catch { return null; }
}

export const activeVerifiedCourseStorage = {
  async read() { return decodePersistedActiveVerifiedCourse(await AsyncStorage.getItem(KEY)); },
  async write(value: ActiveVerifiedCourse) { await AsyncStorage.setItem(KEY, JSON.stringify(value)); },
  async clear() { await AsyncStorage.removeItem(KEY); },
};
