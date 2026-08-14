-- RLS policies decide which rows a signed-in user may access.
-- PostgreSQL grants are also required before those policies can be evaluated.
grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.courses to authenticated;
grant select, insert, update, delete on table public.course_stops to authenticated;
grant select, insert, update, delete on table public.course_legs to authenticated;
grant select, insert, update, delete on table public.course_feedback to authenticated;
grant insert on table public.recommendation_events to authenticated;
