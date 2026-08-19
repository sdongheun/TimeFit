import type { Course, Mode, Spot } from "../../engine";

export type CandidateStatus = "good" | "short" | "tight" | "over";

export type CandidateEval = {
  spot: Spot;
  moveMin: number;
  stayPossibleMin: number;
  bufferLeftMin: number;
  status: CandidateStatus;
  siteConflict: boolean;
  reason: string;
  recommendationRank: number;
  rankingScore: number;
  availableModes: Mode[];
  suggestedMode?: Mode;
  recommendationStrategy?: Course["strategy"];
  rankingWhy?: string;
};

export type TransportScenario = {
  mode: Mode;
  approachMin: number;
  onwardMode: Mode;
  onwardMin: number;
  // 상세 카드의 요약 숫자는 모두 같은 전체 코스 시간 예산을 기준으로 표시한다.
  totalMoveMin: number;
  totalStayMin: number;
  remainingAfterPlannedMin: number;
  stayPossibleMin: number;
  bufferLeftMin: number;
  status: CandidateStatus;
};

export const MODE_LABEL: Record<Mode, string> = {
  walk: "도보",
  transit: "대중교통",
  car: "차량",
};

export const CATEGORY_FILTERS = [
  { label: "전체", category: null },
  { label: "음식점", category: "식당" },
  { label: "카페", category: "카페" },
  { label: "자연관광", category: "자연관광지" },
  { label: "문화", category: "문화시설" },
  { label: "쇼핑·거리", category: "상업지구" },
  { label: "레저", category: "레저/스포츠" },
] as const;
