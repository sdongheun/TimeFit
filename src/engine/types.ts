// 시간-적합 엔진 타입
export type LatLon = { lat: number; lon: number };
export type Mode = "walk" | "car";
export type DayType = "평일" | "주말";
export type HourBucket = "아침" | "점심" | "오후" | "저녁" | "야간";

export type PlanInput = {
  origin: LatLon;
  destination?: LatLon | null; // null = 왕복
  remainingMin: number;
  nowMin: number; // 자정 기준 분
  dayType: DayType;
  hourBucket: HourBucket;
  mode: Mode;
  radiusM?: number;
};

export type Spot = {
  title: string;
  contentId: string;
  typeId: string;
  category: string;
  lat: number;
  lon: number;
  dwell: number; // 유효 체류(분, 혼잡반영)
  dwellBase: number;
  dwellSrc: string;
  mult: number;
  openNote: string;
};

export type Leg = { label: string; min: number; src: string };

export type Course = {
  type: "단일" | "미니코스";
  spots: Spot[];
  totalMin: number;
  legs: Leg[];
  bufferLeftMin: number;
};

export type PlanResult = {
  budgetMin: number;
  bufferMin: number;
  candidateCount: number;
  gatedCount: number;
  tmapOk: number;
  tmapFail: number;
  courses: Course[];
};
