import type { CompleteCourseInput, CompleteCourseResult } from '../services/courseCompletionRepository';
import type { ActiveVerifiedCourse } from './activeVerifiedCourseModel';

type CompletionCatalogPlace = Readonly<{
  contentId: string;
  title: string;
  category: string;
  subCategory?: string | null;
}>;

export type CompleteCourseProjection =
  | Readonly<{ status: 'ready'; input: CompleteCourseInput }>
  | Readonly<{ status: 'invalid_snapshot' }>;

export type CourseCompletionFailureReason =
  | 'invalid_snapshot'
  | 'invalid_input'
  | 'storage_unavailable'
  | 'storage_corrupt';

export type CourseCompletionFinishState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'saving' }>
  | Readonly<{ kind: 'failure'; reason: CourseCompletionFailureReason }>
  | Readonly<{ kind: 'finished'; recorded: boolean }>;

const validText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/** 검증 course의 stop 순서와 catalog 사실만 로컬 completion 입력으로 좁힌다. */
export function buildCompleteCourseInput(
  active: ActiveVerifiedCourse,
  resolveCatalogPlace: (contentId: string) => CompletionCatalogPlace | undefined,
  completedAt: number,
): CompleteCourseProjection {
  const { course } = active;
  if (course.stops.length < 1 || course.stops.length > 2 || course.placeIds.length !== course.stops.length) return { status: 'invalid_snapshot' };
  const places = course.stops.map((stop, index) => {
    if (course.placeIds[index] !== stop.placeId || !Number.isInteger(stop.stayMin) || stop.stayMin < 0) return null;
    const catalogPlace = resolveCatalogPlace(stop.placeId);
    if (!catalogPlace
      || catalogPlace.contentId !== stop.placeId
      || !validText(catalogPlace.title)
      || !validText(catalogPlace.category)
      || !(catalogPlace.subCategory == null || validText(catalogPlace.subCategory))) return null;
    return {
      contentId: catalogPlace.contentId,
      title: catalogPlace.title,
      category: catalogPlace.category,
      subCategory: catalogPlace.subCategory ?? null,
      plannedStayMin: stop.stayMin,
      actualDwellMin: null,
    };
  });
  if (places.some((place) => place === null)) return { status: 'invalid_snapshot' };
  return {
    status: 'ready',
    input: {
      courseRunId: active.courseRunId,
      completedAt,
      trigger: 'explicit_course_finish',
      places: places as CompleteCourseInput['places'],
    },
  };
}

export function completionFailureMessage(reason: CourseCompletionFailureReason): string {
  return reason === 'invalid_snapshot' || reason === 'invalid_input'
    ? '코스 정보를 확인하지 못해 완료 기록을 저장할 수 없어요.'
    : reason === 'storage_corrupt'
      ? '기기 기록을 읽지 못했어요. 기존 기록을 덮어쓰지 않고 다시 시도할 수 있어요.'
      : '기기 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

/** 완료 저장과 active clear/navigation을 상태 전이로 직렬화한다. */
export function createCourseCompletionFinishController(dependencies: Readonly<{
  complete: (input: CompleteCourseInput) => Promise<CompleteCourseResult>;
  onStateChange: (state: CourseCompletionFinishState) => void;
  onFinish: (result: Readonly<{ recorded: boolean }>) => void;
}>) {
  let state: CourseCompletionFinishState = { kind: 'idle' };

  const setState = (next: CourseCompletionFinishState) => {
    state = next;
    dependencies.onStateChange(next);
  };
  const finalize = (recorded: boolean) => {
    if (state.kind === 'finished') return;
    setState({ kind: 'finished', recorded });
    dependencies.onFinish({ recorded });
  };
  const fail = (reason: CourseCompletionFailureReason) => {
    if (state.kind === 'saving' || state.kind === 'finished') return;
    setState({ kind: 'failure', reason });
  };

  return {
    async finish(input: CompleteCourseInput) {
      if (state.kind === 'saving' || state.kind === 'finished') return;
      setState({ kind: 'saving' });
      let result: CompleteCourseResult;
      try {
        result = await dependencies.complete(input);
      } catch {
        result = { status: 'storage_unavailable' };
      }
      if (result.status === 'created' || result.status === 'already_completed') finalize(true);
      else setState({ kind: 'failure', reason: result.status });
    },
    failInvalidSnapshot: () => fail('invalid_snapshot'),
    finishWithoutRecord() {
      if (state.kind !== 'failure') return;
      finalize(false);
    },
    getState: () => state,
  };
}
