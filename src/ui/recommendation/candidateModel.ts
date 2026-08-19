import type { Course, Spot } from "../../engine";
import type { CandidateEval, CandidateStatus } from "./types";

export type CandidateRecommendation = {
  rank: number;
  score: number;
  strategy?: Course["strategy"];
  why?: string;
};

export function evaluateCandidateStatus(
  stayPossibleMin: number,
  minStay: number,
  dwellMin: number,
  bufferLeftMin: number,
  paidBalanced: boolean,
  courseMinimumMet: boolean,
): CandidateStatus {
  if (
    stayPossibleMin < minStay ||
    bufferLeftMin < 0 ||
    !paidBalanced ||
    !courseMinimumMet
  ) {
    return "over";
  }
  if (stayPossibleMin >= dwellMin) return "good";
  if (stayPossibleMin >= Math.max(minStay, Math.round(dwellMin * 0.55))) {
    return "short";
  }
  return "tight";
}

export function uniqueCandidateSpots(courses: Course[]): Spot[] {
  const byId = new Map<string, Spot>();
  for (const course of courses) {
    for (const spot of course.spots) {
      if (!byId.has(spot.contentId)) byId.set(spot.contentId, spot);
    }
  }
  return [...byId.values()];
}

// 하나의 장소가 여러 코스에 포함될 수 있으므로, 가장 높은 순위 코스의 근거를 후보에 연결한다.
export function candidateRecommendations(
  courses: Course[],
): Map<string, CandidateRecommendation> {
  const byId = new Map<string, CandidateRecommendation>();
  courses.forEach((course, rank) => {
    course.spots.forEach((spot) => {
      const previous = byId.get(spot.contentId);
      if (!previous || rank < previous.rank) {
        byId.set(spot.contentId, {
          rank,
          score: course.rankingScore ?? -rank,
          strategy: course.strategy,
          why: course.why,
        });
      }
    });
  });
  return byId;
}

export function diversifyCandidateGroup(items: CandidateEval[]): CandidateEval[] {
  const remaining = [...items];
  const out: CandidateEval[] = [];
  const categories: Record<string, number> = {};
  const strategies: Partial<Record<NonNullable<Course["strategy"]>, number>> = {};

  while (remaining.length) {
    const windowSize = Math.min(6, remaining.length);
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let index = 0; index < windowSize; index++) {
      const item = remaining[index];
      const categoryPenalty = (categories[item.spot.category] ?? 0) * 0.09;
      const strategyPenalty = item.recommendationStrategy
        ? (strategies[item.recommendationStrategy] ?? 0) * 0.035
        : 0;
      const value = item.rankingScore - categoryPenalty - strategyPenalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    out.push(next);
    categories[next.spot.category] = (categories[next.spot.category] ?? 0) + 1;
    if (next.recommendationStrategy) {
      strategies[next.recommendationStrategy] =
        (strategies[next.recommendationStrategy] ?? 0) + 1;
    }
  }
  return out;
}
