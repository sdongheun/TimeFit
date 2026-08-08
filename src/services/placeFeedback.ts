import AsyncStorage from '@react-native-async-storage/async-storage';
import { Course } from '../engine';

const STORAGE_KEY = '@timefit/place-feedback-v1';
const MAX_RECORDS = 1000;

export type PlaceFeedback = {
  id: string;
  completedAt: number;
  contentId: string;
  title: string;
  category: string;
  rating: number;
  actualDwellMin?: number;
  revisit?: boolean;
};

export type PlaceFeedbackInput = {
  course: Pick<Course, 'spots'>;
  ratingByContentId: Record<string, number>;
  actualDwellByContentId: Record<string, number>;
  revisitByContentId: Record<string, boolean>;
};

export type PlaceFeedbackSummary = {
  count: number;
  averageRating: number;
  revisitYesRate: number | null;
};

function isValidRecord(value: unknown): value is PlaceFeedback {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PlaceFeedback>;
  const rating = item.rating;
  return typeof item.id === 'string'
    && typeof item.completedAt === 'number'
    && typeof item.contentId === 'string'
    && typeof item.title === 'string'
    && typeof item.category === 'string'
    && typeof rating === 'number'
    && Number.isInteger(rating)
    && rating >= 1
    && rating <= 5;
}

export async function readPlaceFeedback(): Promise<PlaceFeedback[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidRecord) : [];
  } catch {
    return [];
  }
}

export async function savePlaceFeedback(input: PlaceFeedbackInput): Promise<number> {
  const completedAt = Date.now();
  const feedback = input.course.spots.flatMap((spot, index): PlaceFeedback[] => {
    const rating = input.ratingByContentId[spot.contentId];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return [];
    return [{
      id: `${completedAt}-${index}-${spot.contentId}`,
      completedAt,
      contentId: spot.contentId,
      title: spot.title,
      category: spot.category,
      rating,
      actualDwellMin: input.actualDwellByContentId[spot.contentId],
      revisit: input.revisitByContentId[spot.contentId],
    }];
  });
  if (!feedback.length) return 0;

  const previous = await readPlaceFeedback();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...feedback, ...previous].slice(0, MAX_RECORDS)));
  return feedback.length;
}

export function summarizePlaceFeedback(records: PlaceFeedback[]): Record<string, PlaceFeedbackSummary> {
  const grouped = new Map<string, PlaceFeedback[]>();
  for (const record of records) {
    grouped.set(record.contentId, [...(grouped.get(record.contentId) ?? []), record]);
  }
  return Object.fromEntries([...grouped.entries()].map(([contentId, items]) => {
    const revisits = items.filter((item) => typeof item.revisit === 'boolean');
    return [contentId, {
      count: items.length,
      averageRating: items.reduce((sum, item) => sum + item.rating, 0) / items.length,
      revisitYesRate: revisits.length
        ? revisits.filter((item) => item.revisit).length / revisits.length
        : null,
    }];
  }));
}
