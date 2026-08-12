-- Users can access only their own profile and course graph. Event/aggregate reads stay server-only.
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_stops enable row level security;
alter table public.course_legs enable row level security;
alter table public.course_feedback enable row level security;
alter table public.recommendation_events enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "courses_select_own" on public.courses
  for select to authenticated using (user_id = auth.uid());
create policy "courses_insert_own" on public.courses
  for insert to authenticated with check (user_id = auth.uid());
create policy "courses_update_own" on public.courses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "courses_delete_own" on public.courses
  for delete to authenticated using (user_id = auth.uid());

create policy "course_stops_select_own" on public.course_stops
  for select to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "course_stops_insert_own" on public.course_stops
  for insert to authenticated with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "course_stops_update_own" on public.course_stops
  for update to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "course_stops_delete_own" on public.course_stops
  for delete to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

create policy "course_legs_select_own" on public.course_legs
  for select to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "course_legs_insert_own" on public.course_legs
  for insert to authenticated with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "course_legs_update_own" on public.course_legs
  for update to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "course_legs_delete_own" on public.course_legs
  for delete to authenticated using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

create policy "course_feedback_select_own" on public.course_feedback
  for select to authenticated using (user_id = auth.uid());
create policy "course_feedback_insert_own" on public.course_feedback
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "course_feedback_update_own" on public.course_feedback
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );
create policy "course_feedback_delete_own" on public.course_feedback
  for delete to authenticated using (user_id = auth.uid());

create policy "recommendation_events_insert_own" on public.recommendation_events
  for insert to authenticated with check (user_id = auth.uid());
