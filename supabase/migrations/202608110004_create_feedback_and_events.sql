-- Personalization source data. Every row is tied to a user and cascades on account deletion.
create table if not exists public.course_feedback (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists course_feedback_user_created_at_idx on public.course_feedback (user_id, created_at desc);

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type public.recommendation_event_type not null,
  course_id uuid references public.courses(id) on delete set null,
  place_source text,
  place_content_id text,
  mode public.travel_mode,
  time_bucket text check (time_bucket in ('morning', 'lunch', 'afternoon', 'evening', 'night')),
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  check (not (metadata ?| array['lat', 'lon', 'latitude', 'longitude', 'birth_date', 'birth_year', 'comment']))
);

create index if not exists recommendation_events_user_created_at_idx on public.recommendation_events (user_id, created_at desc);
create index if not exists recommendation_events_course_idx on public.recommendation_events (course_id) where course_id is not null;
