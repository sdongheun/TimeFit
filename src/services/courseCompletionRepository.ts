export const COURSE_COMPLETION_STORAGE_KEY = '@timefit/course-completions-v1';
const SCHEMA_VERSION = 1 as const;
const DEFAULT_MAX_RECORDS = 1000;

export type CourseCompletionPlaceV1 = Readonly<{
  contentId: string;
  title: string;
  category: string;
  subCategory: string | null;
  plannedStayMin: number;
  actualDwellMin: number | null;
}>;

export type CourseCompletionRecordV1 = Readonly<{
  schemaVersion: 1;
  completionId: string;
  courseRunId: string;
  completedAt: number;
  trigger: 'explicit_course_finish';
  places: readonly CourseCompletionPlaceV1[];
}>;

export type CompleteCourseInput = Readonly<{
  courseRunId: string;
  completedAt: number;
  trigger: 'explicit_course_finish';
  places: readonly CourseCompletionPlaceV1[];
}>;

export type CompleteCourseResult =
  | { status: 'created'; record: CourseCompletionRecordV1 }
  | { status: 'already_completed'; record: CourseCompletionRecordV1 }
  | { status: 'invalid_input' }
  | { status: 'storage_unavailable' }
  | { status: 'storage_corrupt' };

export type ReadCourseCompletionsResult =
  | { status: 'ok'; records: readonly CourseCompletionRecordV1[] }
  | { status: 'empty'; records: readonly CourseCompletionRecordV1[] }
  | { status: 'storage_unavailable'; records: readonly CourseCompletionRecordV1[] }
  | { status: 'storage_corrupt'; records: readonly CourseCompletionRecordV1[] };

export type ClearCourseCompletionsResult =
  | { status: 'cleared' }
  | { status: 'storage_unavailable' };

export type RemoveCourseCompletionsResult =
  | { status: 'removed'; removedCompletionIds: readonly string[] }
  | { status: 'storage_unavailable' | 'storage_corrupt'; removedCompletionIds: readonly [] };

export interface CourseCompletionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type CourseCompletionRepository = Readonly<{
  complete(input: CompleteCourseInput): Promise<CompleteCourseResult>;
  read(): Promise<ReadCourseCompletionsResult>;
  clear(): Promise<ClearCourseCompletionsResult>;
  removeByCompletionIds(completionIds: readonly string[]): Promise<RemoveCourseCompletionsResult>;
}>;

type EnvelopeV1 = Readonly<{
  schemaVersion: 1;
  records: readonly CourseCompletionRecordV1[];
}>;

type RepositoryOptions = Readonly<{
  createCompletionId?: () => string;
  maxRecords?: number;
}>;

const storageQueues = new WeakMap<object, Promise<unknown>>();
let fallbackIdSequence = 0;

function runSerialized<T>(storage: CourseCompletionStorage, operation: () => Promise<T>): Promise<T> {
  const previous = storageQueues.get(storage) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  storageQueues.set(storage, current.then(() => undefined, () => undefined));
  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedString(value: unknown, max: number, nullable = false): value is string | null {
  if (nullable && value === null) return true;
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && value.trim() === value;
}

function isMinute(value: unknown, nullable = false): value is number | null {
  if (nullable && value === null) return true;
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= 0
    && value <= 1440;
}

function isCompletedAt(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value > 0
    && value <= 8_640_000_000_000_000;
}

function isCompletionPlace(value: unknown): value is CourseCompletionPlaceV1 {
  if (!isPlainObject(value) || !hasOnlyKeys(value, [
    'contentId', 'title', 'category', 'subCategory', 'plannedStayMin', 'actualDwellMin',
  ])) return false;
  return isBoundedString(value.contentId, 160)
    && isBoundedString(value.title, 240)
    && isBoundedString(value.category, 120)
    && isBoundedString(value.subCategory, 120, true)
    && isMinute(value.plannedStayMin)
    && isMinute(value.actualDwellMin, true);
}

function isCompletionRecord(value: unknown): value is CourseCompletionRecordV1 {
  if (!isPlainObject(value) || !hasOnlyKeys(value, [
    'schemaVersion', 'completionId', 'courseRunId', 'completedAt', 'trigger', 'places',
  ])) return false;
  return value.schemaVersion === SCHEMA_VERSION
    && isBoundedString(value.completionId, 200)
    && isBoundedString(value.courseRunId, 200)
    && isCompletedAt(value.completedAt)
    && value.trigger === 'explicit_course_finish'
    && Array.isArray(value.places)
    && value.places.length >= 1
    && value.places.length <= 2
    && value.places.every(isCompletionPlace);
}

function parseEnvelope(raw: string): EnvelopeV1 | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)
      || !hasOnlyKeys(parsed, ['schemaVersion', 'records'])
      || parsed.schemaVersion !== SCHEMA_VERSION
      || !Array.isArray(parsed.records)
      || !parsed.records.every(isCompletionRecord)) return null;
    return { schemaVersion: SCHEMA_VERSION, records: parsed.records };
  } catch {
    return null;
  }
}

function newestFirst(left: CourseCompletionRecordV1, right: CourseCompletionRecordV1): number {
  return right.completedAt - left.completedAt || left.completionId.localeCompare(right.completionId);
}

function validInput(input: CompleteCourseInput): boolean {
  return isPlainObject(input)
    && isBoundedString(input.courseRunId, 200)
    && isCompletedAt(input.completedAt)
    && input.trigger === 'explicit_course_finish'
    && Array.isArray(input.places)
    && input.places.length >= 1
    && input.places.length <= 2
    && input.places.every((item) => {
      if (!isPlainObject(item)) return false;
      return isBoundedString(item.contentId, 160)
        && isBoundedString(item.title, 240)
        && isBoundedString(item.category, 120)
        && isBoundedString(item.subCategory, 120, true)
        && isMinute(item.plannedStayMin)
        && isMinute(item.actualDwellMin, true);
    });
}

function sanitizePlace(place: CourseCompletionPlaceV1): CourseCompletionPlaceV1 {
  return {
    contentId: place.contentId,
    title: place.title,
    category: place.category,
    subCategory: place.subCategory,
    plannedStayMin: place.plannedStayMin,
    actualDwellMin: place.actualDwellMin,
  };
}

function defaultCompletionId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `completion-${randomUuid}`;
  fallbackIdSequence += 1;
  return `completion-${Date.now().toString(36)}-${fallbackIdSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createCourseCompletionRepository(
  storage: CourseCompletionStorage,
  options: RepositoryOptions = {},
): CourseCompletionRepository {
  const createCompletionId = options.createCompletionId ?? defaultCompletionId;
  const maxRecords = Number.isInteger(options.maxRecords) && (options.maxRecords ?? 0) > 0
    ? options.maxRecords!
    : DEFAULT_MAX_RECORDS;

  return {
    async complete(input) {
      if (!validInput(input)) return { status: 'invalid_input' };
      return runSerialized(storage, async () => {
        let raw: string | null;
        try {
          raw = await storage.getItem(COURSE_COMPLETION_STORAGE_KEY);
        } catch {
          return { status: 'storage_unavailable' };
        }
        const envelope = raw === null ? { schemaVersion: SCHEMA_VERSION, records: [] } : parseEnvelope(raw);
        if (!envelope) return { status: 'storage_corrupt' };
        const existing = envelope.records.find((record) => record.courseRunId === input.courseRunId);
        if (existing) return { status: 'already_completed', record: existing };

        const completionId = createCompletionId();
        if (!isBoundedString(completionId, 200)) return { status: 'storage_unavailable' };
        const record: CourseCompletionRecordV1 = {
          schemaVersion: SCHEMA_VERSION,
          completionId,
          courseRunId: input.courseRunId,
          completedAt: input.completedAt,
          trigger: 'explicit_course_finish',
          places: input.places.map(sanitizePlace),
        };
        const records = [record, ...envelope.records]
          .sort(newestFirst)
          .slice(0, maxRecords);
        try {
          await storage.setItem(COURSE_COMPLETION_STORAGE_KEY, JSON.stringify({
            schemaVersion: SCHEMA_VERSION,
            records,
          }));
        } catch {
          return { status: 'storage_unavailable' };
        }
        return { status: 'created', record };
      });
    },

    async read() {
      return runSerialized(storage, async () => {
        let raw: string | null;
        try {
          raw = await storage.getItem(COURSE_COMPLETION_STORAGE_KEY);
        } catch {
          return { status: 'storage_unavailable', records: [] };
        }
        if (raw === null) return { status: 'empty', records: [] };
        const envelope = parseEnvelope(raw);
        if (!envelope) return { status: 'storage_corrupt', records: [] };
        if (!envelope.records.length) return { status: 'empty', records: [] };
        return { status: 'ok', records: [...envelope.records].sort(newestFirst) };
      });
    },

    async clear() {
      return runSerialized(storage, async () => {
        try {
          await storage.removeItem(COURSE_COMPLETION_STORAGE_KEY);
          return { status: 'cleared' };
        } catch {
          return { status: 'storage_unavailable' };
        }
      });
    },

    async removeByCompletionIds(completionIds) {
      const requested = new Set(completionIds.filter((item) => isBoundedString(item, 200)));
      if (!requested.size) return { status: 'removed', removedCompletionIds: [] };
      return runSerialized(storage, async () => {
        let raw: string | null;
        try { raw = await storage.getItem(COURSE_COMPLETION_STORAGE_KEY); }
        catch { return { status: 'storage_unavailable', removedCompletionIds: [] as const }; }
        if (raw === null) return { status: 'removed', removedCompletionIds: [] };
        const envelope = parseEnvelope(raw);
        if (!envelope) return { status: 'storage_corrupt', removedCompletionIds: [] as const };
        const removedCompletionIds = envelope.records.filter((record) => requested.has(record.completionId)).map((record) => record.completionId);
        if (!removedCompletionIds.length) return { status: 'removed', removedCompletionIds };
        try {
          await storage.setItem(COURSE_COMPLETION_STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records: envelope.records.filter((record) => !requested.has(record.completionId)) }));
        } catch { return { status: 'storage_unavailable', removedCompletionIds: [] as const }; }
        return { status: 'removed', removedCompletionIds };
      });
    },
  };
}

export type CompletionActivityV1 = Readonly<{
  activityId: string;
  completedAt: number;
  contentId: string;
  title: string;
  category: string;
  subCategory: string | null;
  actualDwellMin: number | null;
  source: 'completion' | 'legacy_feedback';
  rating?: number;
  legacyEstimatedDwellMin?: number;
}>;

export type CompletionActivityReadModel = Readonly<{
  activities: readonly CompletionActivityV1[];
  completedPlaceCount: number;
  completedDwellMin: number;
  measuredCount: number;
  unmeasuredCount: number;
  categories: readonly Readonly<{ category: string; count: number }>[];
}>;

type LegacyFeedbackLike = Readonly<{
  id: string;
  completedAt: number;
  contentId: string;
  title: string;
  category: string;
  rating: number;
  actualDwellMin?: number;
}>;

function isLegacyFeedback(value: unknown): value is LegacyFeedbackLike {
  if (!isPlainObject(value)) return false;
  return isBoundedString(value.id, 240)
    && isCompletedAt(value.completedAt)
    && isBoundedString(value.contentId, 160)
    && isBoundedString(value.title, 240)
    && isBoundedString(value.category, 120)
    && typeof value.rating === 'number'
    && Number.isInteger(value.rating)
    && value.rating >= 1
    && value.rating <= 5;
}

export function buildCourseCompletionActivityReadModel(
  completionRecords: readonly CourseCompletionRecordV1[],
  legacyFeedback: readonly unknown[],
): CompletionActivityReadModel {
  const completionActivities = completionRecords.flatMap((record) => record.places.map((item, index) => ({
    activityId: `completion:${record.completionId}:${index}`,
    completedAt: record.completedAt,
    contentId: item.contentId,
    title: item.title,
    category: item.category,
    subCategory: item.subCategory,
    actualDwellMin: item.actualDwellMin,
    source: 'completion' as const,
  })));
  const legacyActivities = legacyFeedback.filter(isLegacyFeedback).map((item) => ({
    activityId: `legacy-feedback:${item.id}`,
    completedAt: item.completedAt,
    contentId: item.contentId,
    title: item.title,
    category: item.category,
    subCategory: null,
    actualDwellMin: null,
    source: 'legacy_feedback' as const,
    rating: item.rating,
    ...(isMinute(item.actualDwellMin) && item.actualDwellMin !== null
      ? { legacyEstimatedDwellMin: item.actualDwellMin }
      : {}),
  }));
  const activities = [...completionActivities, ...legacyActivities]
    .sort((left, right) => right.completedAt - left.completedAt || left.activityId.localeCompare(right.activityId));
  const measured = activities.filter((item) => item.actualDwellMin !== null);
  const categoryCounts = new Map<string, number>();
  for (const activity of activities) {
    categoryCounts.set(activity.category, (categoryCounts.get(activity.category) ?? 0) + 1);
  }
  return {
    activities,
    completedPlaceCount: activities.length,
    completedDwellMin: measured.reduce((total, item) => total + item.actualDwellMin!, 0),
    measuredCount: measured.length,
    unmeasuredCount: activities.length - measured.length,
    categories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category, 'ko')),
  };
}
