-- Auth credentials stay in auth.users. public.profiles stores only planning consent and age-band data.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  birth_year smallint not null check (birth_year between 1900 and 2100),
  age_band text not null check (age_band in ('under_20', '20s', '30s', '40s', '50_plus')),
  email_verified_at timestamptz,
  terms_agreed_at timestamptz not null,
  privacy_agreed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, birth_year, age_band, email_verified_at, terms_agreed_at, privacy_agreed_at
  ) values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'birth_year', '')::smallint,
    nullif(new.raw_user_meta_data ->> 'age_band', ''),
    new.email_confirmed_at,
    coalesce(nullif(new.raw_user_meta_data ->> 'terms_agreed_at', '')::timestamptz, timezone('utc', now())),
    coalesce(nullif(new.raw_user_meta_data ->> 'privacy_agreed_at', '')::timestamptz, timezone('utc', now()))
  );
  return new;
end;
$$;

create or replace function public.sync_profile_email_verification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set email_verified_at = new.email_confirmed_at
  where id = new.id
    and email_verified_at is distinct from new.email_confirmed_at;
  return new;
end;
$$;

create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
    or new.birth_year is distinct from old.birth_year
    or new.age_band is distinct from old.age_band
    or new.email_verified_at is distinct from old.email_verified_at then
    raise exception 'immutable profile fields cannot be changed by clients';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute procedure public.sync_profile_email_verification();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists profiles_guard_changes on public.profiles;
create trigger profiles_guard_changes
  before update on public.profiles
  for each row execute procedure public.guard_profile_changes();
