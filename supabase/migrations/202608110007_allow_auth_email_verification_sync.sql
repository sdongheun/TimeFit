-- Supabase Auth confirms an email by updating auth.users. The Auth trigger then
-- synchronizes profiles.email_verified_at as postgres; client updates remain immutable.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.birth_year is distinct from old.birth_year
    or new.age_band is distinct from old.age_band
    or (
      new.email_verified_at is distinct from old.email_verified_at
      and current_user <> 'postgres'
    ) then
    raise exception 'immutable profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;
