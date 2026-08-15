-- 진행 중 코스의 미래 계획을 한 번에 교체한다.
-- 최초 starts_at과 약속 ends_at은 보존하고, 변경 시각은 last_recalculated_at에만 기록한다.
create or replace function public.replace_course_plan(
  p_course_id uuid,
  p_origin_label text,
  p_origin_lat numeric,
  p_origin_lon numeric,
  p_total_move_min integer,
  p_total_dwell_min integer,
  p_buffer_min integer,
  p_recommendation_snapshot jsonb,
  p_stops jsonb,
  p_legs jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.courses
  set
    status = 'in_progress',
    origin_label = p_origin_label,
    origin_lat = p_origin_lat,
    origin_lon = p_origin_lon,
    total_move_min = p_total_move_min,
    total_dwell_min = p_total_dwell_min,
    buffer_min = p_buffer_min,
    recommendation_snapshot = p_recommendation_snapshot,
    current_stop_order = 1,
    last_recalculated_at = timezone('utc', now())
  where id = p_course_id
    and user_id = auth.uid();

  if not found then
    raise exception 'course_not_found_or_forbidden';
  end if;

  delete from public.course_stops where course_id = p_course_id;
  delete from public.course_legs where course_id = p_course_id;

  insert into public.course_stops (
    course_id, stop_order, place_source, place_content_id, title, category,
    sub_category, lat, lon, planned_dwell_min, dwell_source, kakao_place_url
  )
  select
    p_course_id, item.stop_order, item.place_source, item.place_content_id, item.title, item.category,
    item.sub_category, item.lat, item.lon, item.planned_dwell_min, item.dwell_source, item.kakao_place_url
  from jsonb_to_recordset(coalesce(p_stops, '[]'::jsonb)) as item(
    stop_order integer,
    place_source text,
    place_content_id text,
    title text,
    category text,
    sub_category text,
    lat numeric,
    lon numeric,
    planned_dwell_min integer,
    dwell_source text,
    kakao_place_url text
  );

  insert into public.course_legs (
    course_id, leg_order, from_kind, to_kind, mode, move_min, source, route_summary
  )
  select
    p_course_id, item.leg_order, item.from_kind::public.course_endpoint_kind,
    item.to_kind::public.course_endpoint_kind, item.mode::public.travel_mode,
    item.move_min, item.source, item.route_summary
  from jsonb_to_recordset(coalesce(p_legs, '[]'::jsonb)) as item(
    leg_order integer,
    from_kind text,
    to_kind text,
    mode text,
    move_min integer,
    source text,
    route_summary jsonb
  );
end;
$$;

grant execute on function public.replace_course_plan(
  uuid, text, numeric, numeric, integer, integer, integer, jsonb, jsonb, jsonb
) to authenticated;
