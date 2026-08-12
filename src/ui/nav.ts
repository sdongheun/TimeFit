import { Course, DayType, HourBucket, LatLon, Mode, PlanResult } from '../engine';

// 다음 약속(선택): 장소 프리셋 + 라벨. null = 왕복
export type Appointment = { label: string; lat: number; lon: number } | null;

// 화면 간 공통 컨텍스트: 시작 시각(자정 기준 분)·이동수단·약속
// modeLabel: 사용자가 입력한 수단(도보/자차/버스/택시) — 엔진 mode(walk|car)와 별개 표시용
export type PlanCtx = {
  startMin: number;
  mode: Mode;
  modeLabel: string;
  appointment: Appointment;
  remainingMin: number;
  dayType?: DayType;
  hourBucket?: HourBucket;
  isManualTime?: boolean;
};

// 이동수단 라벨 → 아이콘
export const modeIcon = (label: string) =>
  label.includes('버스') ? '🚌' : label.includes('택시') ? '🚕' : label.includes('자차') || label.includes('차') ? '🚗' : '🚶';

export type RootStackParamList = {
  Home: undefined;
  TimeSetup: { presetMin?: number } | undefined;
  Results: {
    result: PlanResult;
    usedTimeLabel: string;
    origin: LatLon;
    ctx: PlanCtx;
    selectedIds?: string[];
    initialPage?: "recommend" | "basket";
  };
  Detail: { course: Course; origin: LatLon; ctx: PlanCtx; source?: "builder" | "saved"; savedCourseId?: string };
  MyCourses: undefined;
  Execution: { course: Course; origin: LatLon; ctx: PlanCtx };
  Feedback: { course: Course; ctx: PlanCtx };
  Profile: undefined;
};

// 분(자정 기준) → "13:00"
export const fmtHM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
