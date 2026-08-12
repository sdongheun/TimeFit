-- This helper is for the delete-account Edge Function only. The Edge Function then removes auth.users via Admin API.
create or replace function public.purge_account_data(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.recommendation_events where user_id = target_user_id;
  delete from public.course_feedback where user_id = target_user_id;
  delete from public.courses where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
  -- course_stops and course_legs cascade from courses. The Edge Function then deletes auth.users via Admin API.
end;
$$;

revoke all on function public.purge_account_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_account_data(uuid) to service_role;
