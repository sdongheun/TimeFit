import type { CourseV1LimitedResult, CourseV1ReleaseOneStopResult, VerifiedCourseV1 } from '../engine';

// 다음 약속(선택): 장소 프리셋 + 라벨. null = 왕복
export type Appointment = { label: string; lat: number; lon: number } | null;

export type RecommendationSession = {
  nowIso: string;
  origin: { id: string; lat: number; lon: number; label: string };
  destination: { id: string; lat: number; lon: number; label: string } | null;
  remainingMin: number;
  arrivalBufferMin: number;
};

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
  NearbyBrowse: undefined;
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
