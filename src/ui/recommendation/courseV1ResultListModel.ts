import type { CourseV1LimitedResult, VerifiedCourseV1 } from '../../engine';
import { buildCourseDiscoveryContext } from './courseV1DiscoveryContext';

type PlaceContext = { title?: string; addr1?: string | null; shortStay?: { type?: string | null } | null } | undefined;

export type CourseV1ResultListItem = {
  course: VerifiedCourseV1;
  placeNames: string[];
  context: string | null;
  totalMin: number;
  remainingAfterCourseMin: number | null;
};

/** 엔진/어댑터를 호출하지 않고 같은 결과 스냅샷을 대표·대안 목록용 표시값으로만 투영한다. */
export function buildCourseV1ResultListItem(course: VerifiedCourseV1, getPlace: (id: string) => PlaceContext): CourseV1ResultListItem {
  return {
    course,
    placeNames: course.placeIds.map((id) => getPlace(id)?.title ?? '장소'),
    context: buildCourseDiscoveryContext(course.placeIds, getPlace),
    totalMin: course.totalMin,
    remainingAfterCourseMin: Number.isInteger(course.remainingAfterCourseMin) && course.remainingAfterCourseMin! >= 0 ? course.remainingAfterCourseMin! : null,
  };
}

export function buildCourseV1AlternativeList(result: CourseV1LimitedResult, getPlace: (id: string) => PlaceContext): CourseV1ResultListItem[] {
  return result.alternativeCourses.map((course) => buildCourseV1ResultListItem(course, getPlace));
}

/** 선택한 목록 항목의 검증 스냅샷을 바꾸지 않고 확인 화면으로 전달한다. */
export function selectedCourseForConfirm(item: CourseV1ResultListItem): VerifiedCourseV1 {
  return item.course;
}
