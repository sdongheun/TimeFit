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

function dateAtMinute(minute: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return date;
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
  return {
    id: course.id,
    courseId: course.id,
    title: savedTitle(savedCourse),
    createdAt: new Date(course.created_at).getTime(),
    course: savedCourse,
    origin: { lat: Number(course.origin_lat), lon: Number(course.origin_lon) },
    ctx: {
      ...snapshot.ctx,
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
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function saveCourseToRepository(params: ExecutionParams): Promise<SavedCourse> {
  const userId = await currentUserId();
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
    const startsAt = dateAtMinute(ctx.startMin);
    const endsAt = new Date(startsAt.getTime() + ctx.remainingMin * 60_000);
    const plan = coursePlanRows('', params);

    const { data: created, error: courseError } = await supabase
      .from('courses')
      .insert({
        user_id: userId,
        status: 'saved',
        origin_label: ctx.originLabel ?? '선택한 출발지',
        origin_lat: origin.lat,
        origin_lon: origin.lon,
        destination_label: ctx.appointment?.label ?? null,
        destination_lat: ctx.appointment?.lat ?? null,
        destination_lon: ctx.appointment?.lon ?? null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        mode: ctx.mode,
        total_move_min: plan.totalMoveMin,
        total_dwell_min: plan.totalDwellMin,
        buffer_min: Math.max(0, Math.round(course.bufferLeftMin)),
        recommendation_snapshot: { course: courseSnapshot(course), ctx },
      })
      .select('id, created_at')
      .single();
    if (courseError || !created) {
      return {
        ...params,
        courseId: localId,
        id: localId,
        title: savedTitle(course),
        createdAt: now,
      };
    }

    const planRows = coursePlanRows(created.id, params);
    await Promise.all([
      planRows.stops.length ? supabase.from('course_stops').insert(planRows.stops) : Promise.resolve({ error: null }),
      planRows.legs.length ? supabase.from('course_legs').insert(planRows.legs) : Promise.resolve({ error: null }),
    ]);

    return {
      ...params,
      courseId: created.id,
      id: created.id,
      title: savedTitle(course),
      createdAt: new Date(created.created_at).getTime(),
    };
  } catch {
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
  } catch {}
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
