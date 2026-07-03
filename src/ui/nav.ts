import { Course, LatLon, Mode, PlanResult } from '../engine';

// 다음 약속(선택): 장소 프리셋 + 라벨. null = 왕복
export type Appointment = { label: string; lat: number; lon: number } | null;

// 화면 간 공통 컨텍스트: 시작 시각(자정 기준 분)·이동수단·약속
export type PlanCtx = { startMin: number; mode: Mode; appointment: Appointment; remainingMin: number };

export type RootStackParamList = {
  Home: undefined;
  Results: { result: PlanResult; usedTimeLabel: string; origin: LatLon; ctx: PlanCtx };
  Detail: { course: Course; origin: LatLon; ctx: PlanCtx };
  Execution: { course: Course; origin: LatLon; ctx: PlanCtx };
  Feedback: { course: Course; ctx: PlanCtx };
};

// 분(자정 기준) → "13:00"
export const fmtHM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
