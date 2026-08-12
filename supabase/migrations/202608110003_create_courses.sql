-- Stored course snapshot. Coordinates describe selected places only, never continuous GPS history.
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.course_status not null default 'saved',
  derived_from_course_id uuid references public.courses(id) on delete set null,
  origin_label text not null,
  origin_lat numeric(9, 6) not null check (origin_lat between -90 and 90),
  origin_lon numeric(9, 6) not null check (origin_lon between -180 and 180),
  destination_label text,
  destination_lat numeric(9, 6) check (destination_lat between -90 and 90),
  destination_lon numeric(9, 6) check (destination_lon between -180 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode public.travel_mode not null,
  total_move_min integer not null check (total_move_min >= 0),
  total_dwell_min integer not null check (total_dwell_min >= 0),
  buffer_min integer not null check (buffer_min >= 0),
  recommendation_snapshot jsonb not null default '{}'::jsonb,
  current_stop_order integer check (current_stop_order > 0),
  last_recalculated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at > starts_at),
  check (
    (destination_label is null and destination_lat is null and destination_lon is null)
    or (destination_label is not null and destination_lat is not null and destination_lon is not null)
  )
);

create index if not exists courses_user_updated_at_idx on public.courses (user_id, updated_at desc);
create index if not exists courses_user_status_idx on public.courses (user_id, status);

create table if not exists public.course_stops (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  stop_order integer not null check (stop_order > 0),
  place_source text not null default 'timefit_catalog',
  place_content_id text not null,
  title text not null,
  category text not null,
  sub_category text,
  lat numeric(9, 6) not null check (lat between -90 and 90),
  lon numeric(9, 6) not null check (lon between -180 and 180),
  planned_dwell_min integer not null check (planned_dwell_min >= 0),
  dwell_source text not null,
  kakao_place_url text,
  visit_status public.stop_visit_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, stop_order)
);

create index if not exists course_stops_course_order_idx on public.course_stops (course_id, stop_order);

create table if not exists public.course_legs (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  leg_order integer not null check (leg_order > 0),
  from_kind public.course_endpoint_kind not null,
  to_kind public.course_endpoint_kind not null,
  mode public.travel_mode not null,
  move_min integer not null check (move_min >= 0),
  distance_m integer check (distance_m >= 0),
  source text not null,
  route_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (course_id, leg_order)
);

create index if not exists course_legs_course_order_idx on public.course_legs (course_id, leg_order);

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at
  before update on public.courses
  for each row execute procedure public.set_updated_at();

drop trigger if exists course_stops_set_updated_at on public.course_stops;
create trigger course_stops_set_updated_at
  before update on public.course_stops
  for each row execute procedure public.set_updated_at();
