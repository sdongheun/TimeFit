import { Course, DayType, HourBucket, LatLon, Mode, PlanResult, type CourseV1LimitedResult, type VerifiedCourseV1 } from '../engine';

// 다음 약속(선택): 장소 프리셋 + 라벨. null = 왕복
export type Appointment = { label: string; lat: number; lon: number } | null;

// 화면 간 공통 컨텍스트: 시작 시각(자정 기준 분)·이동수단·약속
// modeLabel: 사용자가 입력한 수단(도보/자차/버스/택시) — 엔진 mode(walk|car)와 별개 표시용
export type PlanCtx = {
  startMin: number;
  mode: Mode;
  modeLabel: string;
  originLabel?: string;
  appointment: Appointment;
  remainingMin: number;
  // 단일 장소 추천에서 약속/복귀 전에 확보할 사용자 설정 여유 시간.
  arrivalBufferMin?: number;
  dayType?: DayType;
  hourBucket?: HourBucket;
  isManualTime?: boolean;
};

export type RecommendationSession = {
  nowIso: string;
  origin: { id: string; lat: number; lon: number; label: string };
  destination: { id: string; lat: number; lon: number; label: string } | null;
  remainingMin: number;
  arrivalBufferMin: number;
};

// 이동수단 라벨 → 아이콘
export const modeIcon = (label: string) =>
  label.includes('버스') ? '🚌' : label.includes('택시') ? '🚕' : label.includes('자차') || label.includes('차') ? '🚗' : '🚶';

export type RootStackParamList = {
  Home: undefined;
  TimeSetup: { presetMin?: number } | undefined;
  Results: {
    session: RecommendationSession;
    result: CourseV1LimitedResult;
  };
  CourseConfirm: {
    session: RecommendationSession;
    /** 결과 화면에서 선택한 검증 스냅샷을 그대로 읽기 전용으로 보여 준다. */
    course: VerifiedCourseV1;
  };
  /** V1 저장 계약이 준비되기 전 기존 진행 코스의 변경 흐름만 유지한다. */
  LegacyResults: {
    result: PlanResult;
    usedTimeLabel: string;
    origin: LatLon;
    ctx: PlanCtx;
    selectedIds?: string[];
    initialPage?: "recommend" | "basket";
    editingCourseId?: string;
  };
  MyCourses: undefined;
  Execution: { course: Course; origin: LatLon; ctx: PlanCtx; courseId?: string };
  Feedback: { course: Course; ctx: PlanCtx };
  ActivityRecord: undefined;
  Profile: undefined;
};

// 분(자정 기준) → "13:00"
export const fmtHM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
