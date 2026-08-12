-- TimeFit core schema: shared extensions, enum types, and timestamp trigger.
create extension if not exists pgcrypto;

do $$ begin
  create type public.course_status as enum ('saved', 'in_progress', 'completed', 'cancelled', 'replanned');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.travel_mode as enum ('walk', 'transit', 'car');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.stop_visit_status as enum ('pending', 'visited', 'skipped');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.course_endpoint_kind as enum ('origin', 'stop', 'destination');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.recommendation_event_type as enum (
    'recommendation_viewed', 'place_opened', 'basket_added', 'basket_removed',
    'course_saved', 'course_edited', 'navigation_started', 'course_completed', 'feedback_submitted'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
