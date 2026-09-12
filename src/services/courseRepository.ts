import { Course, Spot } from '../engine';
import { PlanCtx, RootStackParamList } from '../ui/nav';
import { supabase } from './supabase';

type StoredCourseRow = {
  id: string;
  status: 'saved' | 'in_progress' | 'completed' | 'cancelled' | 'replanned';
  origin_label: string;
  origin_lat: number | string;
  origin_lon: number | string;
  destination_label: string | null;
  destination_lat: number | string | null;
  destination_lon: number | string | null;
  starts_at: string;
  ends_at: string;
  mode: PlanCtx['mode'];
  recommendation_snapshot: unknown;
  created_at: string;
};

type StoredStopRow = {
  course_id: string;
  stop_order: number;
  place_content_id: string;
  title: string;
  category: string;
  sub_category: string | null;
  lat: number | string;
  lon: number | string;
  planned_dwell_min: number;
  dwell_source: string;
  kakao_place_url: string | null;
};

type ExecutionParams = RootStackParamList['Execution'];
type SavedCourse = ExecutionParams & { id: string; title: string; createdAt: number };

export type CourseDateErrorCode = 'course_date_missing' | 'course_date_invalid' | 'course_date_conflict' | 'course_date_unavailable';
export class CourseDateError extends Error {
  constructor(public readonly code: CourseDateErrorCode) { super(code); this.name = 'CourseDateError'; }
}
export function isCourseDateError(error: unknown): error is CourseDateError {
  return error instanceof CourseDateError;
}

/** Require a real calendar date and an explicit timezone; Date.parse alone normalizes February 30. */
function startInstant(value: unknown): number {
  if (value === undefined || value === null) throw new CourseDateError('course_date_missing');
  const parts = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) throw new CourseDateError('course_date_invalid');
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zone = parts[7];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59
    || (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59))) throw new CourseDateError('course_date_invalid');
  const at = Date.parse(value as string);
  if (!Number.isFinite(at)) throw new CourseDateError('course_date_invalid');
  return at;
}

function checkDateIssue(ctx: PlanCtx) {
  if (ctx.courseDateIssue !== undefined) {
    const code = ctx.courseDateIssue === 'missing' ? 'course_date_missing'
      : ctx.courseDateIssue === 'conflict' ? 'course_date_conflict' : 'course_date_invalid';
    throw new CourseDateError(code);
  }
}
function datedContext(ctx: PlanCtx, original?: StoredCourseRow, preserveLocalEnd = false): PlanCtx {
  checkDateIssue(ctx);
  let at: number;
  let end: number;
  const checkEnd = (value: unknown) => {
    const candidate = startInstant(value);
    if (candidate <= at) throw new CourseDateError('course_date_invalid');
    if (candidate !== end) throw new CourseDateError('course_date_conflict');
  };
  if (original) {
    at = startInstant(original.starts_at);
    end = startInstant(original.ends_at);
    if (end <= at) throw new CourseDateError('course_date_invalid');
    const snapshot = original.recommendation_snapshot as { ctx?: PlanCtx } | null;
    if (snapshot?.ctx) {
      checkDateIssue(snapshot.ctx);
      if (snapshot.ctx.startedAtIso !== undefined && startInstant(snapshot.ctx.startedAtIso) !== at) throw new CourseDateError('course_date_conflict');
      if (snapshot.ctx.endsAtIso !== undefined) checkEnd(snapshot.ctx.endsAtIso);
    }
    if (ctx.startedAtIso !== undefined && startInstant(ctx.startedAtIso) !== at) throw new CourseDateError('course_date_conflict');
    if (ctx.endsAtIso !== undefined) checkEnd(ctx.endsAtIso);
  } else {
    at = startInstant(ctx.startedAtIso);
    // Only a first creation may derive its deadline. Existing local plans must carry their original end.
    end = preserveLocalEnd ? startInstant(ctx.endsAtIso) : at + ctx.remainingMin * 60_000;
    if (!Number.isFinite(new Date(end).getTime()) || end <= at) throw new CourseDateError('course_date_invalid');
    if (ctx.endsAtIso !== undefined) checkEnd(ctx.endsAtIso);
  }
  if (!Number.isSafeInteger(ctx.remainingMin) || ctx.remainingMin <= 0 || !Number.isFinite(new Date(at + ctx.remainingMin * 60_000).getTime())) throw new CourseDateError('course_date_invalid');
  return { ...ctx, startedAtIso: new Date(at).toISOString(), endsAtIso: new Date(end).toISOString() };
}

async function originalCourse(courseId: string): Promise<StoredCourseRow> {
  try {
    const { data, error } = await supabase.from('courses')
      .select('id, starts_at, ends_at, recommendation_snapshot').eq('id', courseId).maybeSingle();
    if (error || !data) throw new CourseDateError('course_date_unavailable');
    return data as StoredCourseRow;
  } catch { throw new CourseDateError('course_date_unavailable'); }
}

async function contextForWrite(params: ExecutionParams, userId: string | null, sourceId = params.courseId): Promise<PlanCtx> {
  checkDateIssue(params.ctx);
  if (sourceId && !sourceId.startsWith('local-')) {
    if (!userId) throw new CourseDateError('course_date_unavailable');
    return datedContext(params.ctx, await originalCourse(sourceId));
  }
  return datedContext(params.ctx, undefined, !!sourceId);
}

function savedTitle(course: Course) {
  return course.spots.map((spot) => spot.title).join(' + ');
}

function courseSnapshot(course: Course): Course {
  // 지도 폴리라인은 DB에 보관하지 않는다. 앱을 다시 열면 필요 시 경로 API로 새로 계산한다.
  return {
    ...course,
    legs: course.legs.map(({ geo: _geo, ...leg }) => leg),
    mobility: course.mobility
      ? Object.fromEntries(Object.entries(course.mobility).map(([mode, option]) => [
        mode,
        option ? { ...option, legs: option.legs.map(({ geo: _geo, ...leg }) => leg) } : option,
      ])) as Course['mobility']
      : undefined,
  };
}

function num(value: number | string | null): number | null {
  return value == null ? null : Number(value);
}

function paramsFromRows(course: StoredCourseRow, stops: StoredStopRow[]): SavedCourse {
  const snapshot = course.recommendation_snapshot as { course?: Course; ctx?: PlanCtx };
  if (!snapshot?.course || !snapshot?.ctx) {
    throw new Error('저장된 코스 스냅샷이 올바르지 않습니다.');
  }
  const orderedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const selected: Spot[] = orderedStops.map((stop) => {
    const original = snapshot.course!.spots.find((spot) => spot.contentId === stop.place_content_id);
    if (!original) throw new Error('저장된 장소 스냅샷이 올바르지 않습니다.');
    return {
      ...original,
      contentId: stop.place_content_id,
      title: stop.title,
      category: stop.category,
      subCategory: stop.sub_category ?? undefined,
      lat: Number(stop.lat),
      lon: Number(stop.lon),
      dwell: stop.planned_dwell_min,
      dwellSrc: stop.dwell_source,
      kakaoPlaceUrl: stop.kakao_place_url ?? undefined,
    };
  });
  const savedCourse: Course = { ...snapshot.course, spots: selected };
  let restoredCtx: PlanCtx;
  try { restoredCtx = datedContext(snapshot.ctx, course); }
  catch (error) {
    if (!isCourseDateError(error)) throw error;
    // Keep the row visible and unchanged on the server; carry the blocking issue through navigation.
    const issue = error.code === 'course_date_missing' ? 'missing' : error.code === 'course_date_conflict' ? 'conflict' : 'invalid';
    restoredCtx = { ...snapshot.ctx, courseDateIssue: issue };
  }
  return {
    id: course.id,
    courseId: course.id,
    title: savedTitle(savedCourse),
    createdAt: new Date(course.created_at).getTime(),
    course: savedCourse,
    origin: { lat: Number(course.origin_lat), lon: Number(course.origin_lon) },
    ctx: {
      ...restoredCtx,
      mode: course.mode,
      appointment: course.destination_label && num(course.destination_lat) != null && num(course.destination_lon) != null
        ? { label: course.destination_label, lat: Number(course.destination_lat), lon: Number(course.destination_lon) }
        : null,
    },
  };
}

function coursePlanRows(courseId: string, params: ExecutionParams) {
  const { course, origin, ctx } = params;
  const travelLegs = course.legs.filter((leg) => !leg.label.startsWith('체류'));
  const totalMoveMin = travelLegs.reduce((sum, leg) => sum + leg.min, 0);
  const totalDwellMin = course.legs
    .filter((leg) => leg.label.startsWith('체류'))
    .reduce((sum, leg) => sum + leg.min, 0);
  const stops = course.spots.map((spot, index) => ({
    course_id: courseId,
    stop_order: index + 1,
    place_source: 'timefit_catalog',
    place_content_id: spot.contentId,
    title: spot.title,
    category: spot.category,
    sub_category: spot.subCategory ?? null,
    lat: spot.lat,
    lon: spot.lon,
    planned_dwell_min: Math.max(0, Math.round(course.legs[index * 2 + 1]?.min ?? spot.dwell)),
    dwell_source: spot.dwellSrc,
    kakao_place_url: spot.kakaoPlaceUrl ?? null,
  }));
  const legs = travelLegs.map((leg, index) => ({
    course_id: courseId,
    leg_order: index + 1,
    from_kind: index === 0 ? 'origin' : 'stop',
    to_kind: index === travelLegs.length - 1 ? (ctx.appointment ? 'destination' : 'origin') : 'stop',
    mode: leg.mode ?? ctx.mode,
    move_min: Math.max(0, Math.round(leg.min)),
    source: leg.src,
    route_summary: { label: leg.label },
  }));
  return { origin, ctx, course, totalMoveMin, totalDwellMin, stops, legs };
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user || data.user.is_anonymous === true) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function saveCourseToRepository(params: ExecutionParams): Promise<SavedCourse> {
  const userId = await currentUserId();
  params = { ...params, ctx: await contextForWrite(params, userId) };
  const { course, origin, ctx } = params;
  const localId = `local-${Date.now()}`;
  const now = Date.now();

  if (!userId) {
    // 비로그인 / 게스트 모드: 로컬 객체 즉시 반환
    return {
      ...params,
      courseId: localId,
      id: localId,
      title: savedTitle(course),
      createdAt: now,
    };
  }

  try {
    const startsAt = new Date(ctx.startedAtIso!);
    const endsAt = new Date(ctx.endsAtIso!);
    const plan = coursePlanRows('', params);
    const requestId = globalThis.crypto?.randomUUID?.();
    if (!requestId) {
      return {
        ...params,
        courseId: localId,
        id: localId,
        title: savedTitle(course),
        createdAt: now,
      };
    }
    const args = {
      p_request_id: requestId,
      p_origin_label: ctx.originLabel ?? '선택한 출발지', p_origin_lat: origin.lat, p_origin_lon: origin.lon,
      p_destination_label: ctx.appointment?.label ?? null, p_destination_lat: ctx.appointment?.lat ?? null, p_destination_lon: ctx.appointment?.lon ?? null,
      p_starts_at: startsAt.toISOString(), p_ends_at: endsAt.toISOString(), p_mode: ctx.mode,
      p_total_move_min: plan.totalMoveMin, p_total_dwell_min: plan.totalDwellMin,
      p_buffer_min: Math.max(0, Math.round(course.bufferLeftMin)), p_recommendation_snapshot: { course: courseSnapshot(course), ctx },
      p_stops: plan.stops.map(({ course_id: _courseId, ...stop }) => stop),
      p_legs: plan.legs.map(({ course_id: _courseId, ...leg }) => leg),
    };
    let reply = await supabase.rpc('create_course_plan', args);
    // A lost response may follow a committed transaction. Retry once with the same request ID.
    if (reply.error || !reply.data?.[0]) reply = await supabase.rpc('create_course_plan', args);
    const created = reply.data?.[0];
    if (reply.error || !created) return { ...params, courseId: localId, id: localId, title: savedTitle(course), createdAt: now };

    return {
      ...params,
      courseId: created.id,
      id: created.id,
      title: savedTitle(course),
      createdAt: new Date(created.created_at).getTime(),
    };
  } catch (error) {
    if (isCourseDateError(error)) throw error;
    return {
      ...params,
      courseId: localId,
      id: localId,
      title: savedTitle(course),
      createdAt: now,
    };
  }
}

export async function replaceCoursePlanInRepository(courseId: string, params: ExecutionParams): Promise<ExecutionParams> {
  const userId = await currentUserId();
  params = { ...params, ctx: await contextForWrite(params, userId, courseId) };
  if (!userId || courseId.startsWith('local-')) {
    return { ...params, courseId };
  }
  try {
    const plan = coursePlanRows(courseId, params);
    await supabase.rpc('replace_course_plan', {
      p_course_id: courseId,
      p_origin_label: plan.ctx.originLabel ?? '현재 위치',
      p_origin_lat: plan.origin.lat,
      p_origin_lon: plan.origin.lon,
      p_total_move_min: plan.totalMoveMin,
      p_total_dwell_min: plan.totalDwellMin,
      p_buffer_min: Math.max(0, Math.round(plan.course.bufferLeftMin)),
      p_recommendation_snapshot: { course: courseSnapshot(plan.course), ctx: plan.ctx },
      p_stops: plan.stops.map(({ course_id: _courseId, ...stop }) => stop),
      p_legs: plan.legs.map(({ course_id: _courseId, ...leg }) => leg),
    });
  } catch (error) { if (isCourseDateError(error)) throw error; }
  return { ...params, courseId };
}

export async function listSavedCoursesFromRepository(): Promise<SavedCourse[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  try {
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('id, status, origin_label, origin_lat, origin_lon, destination_label, destination_lat, destination_lon, starts_at, ends_at, mode, recommendation_snapshot, created_at')
      .in('status', ['saved', 'in_progress'])
      .order('updated_at', { ascending: false });
    if (courseError || !courses?.length) return [];
    const ids = courses.map((course) => course.id);
    const { data: stops, error: stopsError } = await supabase
      .from('course_stops')
      .select('course_id, stop_order, place_content_id, title, category, sub_category, lat, lon, planned_dwell_min, dwell_source, kakao_place_url')
      .in('course_id', ids)
      .order('stop_order', { ascending: true });
    if (stopsError) return [];
    const byCourse = new Map<string, StoredStopRow[]>();
    (stops as StoredStopRow[] ?? []).forEach((stop) => byCourse.set(stop.course_id, [...(byCourse.get(stop.course_id) ?? []), stop]));
    return (courses as StoredCourseRow[]).map((course) => paramsFromRows(course, byCourse.get(course.id) ?? []));
  } catch {
    return [];
  }
}

export async function removeCourseFromRepository(id: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId || id.startsWith('local-')) return;
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
