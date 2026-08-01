// 시간-적합 엔진 타입
export type LatLon = { lat: number; lon: number };
export type Mode = "walk" | "car" | "transit";
export type RoadMode = "walk" | "car";
export type Strategy = "origin_area" | "destination_area" | "route_area";
export type DayType = "평일" | "주말";
export type HourBucket = "아침" | "점심" | "오후" | "저녁" | "야간";
export type MatchScope = "direct_place" | "area_context" | "category_fallback" | "bad_match";
export type OpeningHoursReliability = "direct" | "area_uncertain" | "unknown";
export type SpotConfidence = "direct_match" | "area_context_match" | "category_fallback";
export type MapVerificationStatus = "verified" | "weak" | "not_found" | "unverified";

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
  subCategory?: string;
  lat: number;
  lon: number;
  dwell: number; // 유효 체류(분, 혼잡반영)
  dwellBase: number;
  dwellSrc: string;
  dwellSourceName?: string;
  openingHoursSourceName?: string;
  openingHoursReliability?: OpeningHoursReliability;
  matchScope?: MatchScope;
  mapVerificationStatus?: MapVerificationStatus;
  mapVerificationName?: string;
  mapVerificationDistanceM?: number;
  mult: number;
  openNote: string;
  confidence: SpotConfidence;
  strategy: Strategy;
};

export type Leg = { label: string; min: number; src: string; geo?: LatLon[] }; // geo: TMAP 실경로 좌표(이동 구간만)

export type MobilityOption = {
  mode: Mode;
  moveMin: number;
  stayMin: number;
  totalMin: number;
  bufferLeftMin: number;
  ok: boolean;
  legs: Leg[];
};

export type Course = {
  type: "단일" | "미니코스";
  strategy?: Strategy;
  spots: Spot[];
  totalMin: number;
  legs: Leg[];
  bufferLeftMin: number;
  bestMode?: Mode;
  mobility?: Partial<Record<Mode, MobilityOption>>;
  why?: string; // 랭킹 근거(설명가능성): "체류 72% · 오후 적합 90%"
};

export type PlanResult = {
  budgetMin: number;
  bufferMin: number;
  candidateCount: number;
  gatedCount: number;
  tmapOk: number;
  tmapFail: number;
  courses: Course[]; // 추천 배치(≤10, 목록 단계는 haversine 추정)
  pending: Course[]; // "다른 코스 보기" 대기열(haversine 추정치)
};
