import { Course, DayType, HourBucket, LatLon, Mode, PlanResult, type CourseV1LimitedResult, type CourseV1ReleaseOneStopResult, type VerifiedCourseV1 } from '../engine';

// 다음 약속(선택): 장소 프리셋 + 라벨. null = 왕복
export type Appointment = { label: string; lat: number; lon: number } | null;

// 화면 간 공통 컨텍스트: 시작 시각(자정 기준 분)·이동수단·약속
// modeLabel: 사용자가 입력한 수단(도보/자차/버스/택시) — 엔진 mode(walk|car)와 별개 표시용
export type PlanCtx = {
  startMin: number;
  /** Original dated start instant, never regenerated at save/replan time. Optional only for legacy read compatibility. */
  startedAtIso?: string;
  /** Repository-validated original deadline (UTC ISO); never infer from a replanned duration. */
  endsAtIso?: string;
  /** Repository restoration issue; retained until an explicitly confirmed separate new plan. */
  courseDateIssue?: 'missing' | 'invalid' | 'conflict';
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
  /** 이미 허용·획득된 기기 위치의 UI 전용 process snapshot. 추천/API/저장 입력으로 사용하지 않는다. */
  deviceLocationSnapshot?: { lat: number; lon: number };
};

// 이동수단 라벨 → 아이콘
export const modeIcon = (label: string) =>
  label.includes('버스') ? '🚌' : label.includes('택시') ? '🚕' : label.includes('자차') || label.includes('차') ? '🚗' : '🚶';

export type RootStackParamList = {
  Home: undefined;
  TimeSetup: { presetMin?: number } | undefined;
  Results: {
    session: RecommendationSession;
    result: CourseV1LimitedResult | CourseV1ReleaseOneStopResult;
  };
  CourseConfirm: {
    session: RecommendationSession;
    /** 결과 화면에서 선택한 검증 스냅샷을 그대로 읽기 전용으로 보여 준다. */
    course: VerifiedCourseV1;
    /** Home 이어가기가 같은 CourseConfirm의 active 상태를 복원할 때만 사용한다. */
    activeId?: string;
  };
  PlaceDetail: {
    requestId: string;
    selectionKind: 'first' | 'pair';
    placeId: string;
    session: RecommendationSession;
    course: VerifiedCourseV1;
    firstCourse?: VerifiedCourseV1;
  };
  /** 비실행 호환 타입: 과거 화면은 미등록. 하위 컴포넌트/저장소 DTO 분리는 후속이다. */
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
  NearbyBrowse: undefined;
  /** courseRepository 등 보존 코드용 비실행 저장소 호환 타입. 화면 재등록 금지. */
  Execution: { course: Course; origin: LatLon; ctx: PlanCtx; courseId?: string };
  Feedback: { course: Course; ctx: PlanCtx };
  ActivityRecord: undefined;
  Profile: undefined;
  ProfileManagement: undefined;
  Login: undefined;
};

// 분(자정 기준) → "13:00"
export const fmtHM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
