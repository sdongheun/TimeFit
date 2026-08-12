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
  // 자동진단에서만 사용: 후보 풀 비교를 위해 ODsay 정밀화를 생략한다.
  deferTransitRefinement?: boolean;
  // 자동진단에서만 사용: 후보 데이터 범위 비교를 위해 TourAPI 운영시간 상세 조회를 생략한다.
  deferOpeningGate?: boolean;
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
  kakaoPlaceId?: string;
  kakaoPlaceUrl?: string;
  mapVerificationName?: string;
  mapVerificationDistanceM?: number;
  tourapiContentId?: string;
  tourapiContentTypeId?: string;
  operatingHours?: string[];
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
  rankingScore?: number; // 추천 엔진의 기본 점수. 후보 목록 정렬 근거로도 사용한다.
  why?: string; // 랭킹 근거(설명가능성): "체류 72% · 오후 적합 90%"
};

export type PlanResult = {
  budgetMin: number;
  bufferMin: number;
  tourApiCount: number; // 후보 중 TourAPI contentId가 있어 운영시간 상세 조회가 가능한 장소 수
  candidateCount: number; // 로컬 부산 카탈로그에서 좌표 반경 조건을 통과한 후보
  eligibleCount: number; // 시간·방향성 1차 컷 통과 후보
  openingCheckCount: number; // 운영시간 상세 조회 대상
  gatedCount: number; // 운영시간 게이트 통과 후보
  tmapOk: number;
  tmapFail: number;
  courses: Course[]; // 추천 배치(≤10, 목록 단계는 haversine 추정)
  pending: Course[]; // "다른 코스 보기" 대기열(haversine 추정치)
};
