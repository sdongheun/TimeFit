-- DB-RELEASE-IDENTITY-01 B: account-only identity, explicit consent,
-- optional nickname, owned completion history, recoverable guest import, and atomic course creation.

-- CLI 2.116.0 resets session settings before each file; keep bounds inside its
-- per-file transaction. Direct psql execution must use --single-transaction.
set local lock_timeout = '3s';
set local statement_timeout = '60s';

create or replace function public.is_account_user()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) is false
$$;

revoke all on function public.is_account_user() from public, anon;
grant execute on function public.is_account_user() to authenticated, service_role;

alter table public.profiles alter column birth_year drop not null;
alter table public.profiles alter column age_band drop not null;
alter table public.profiles alter column terms_agreed_at drop not null;
alter table public.profiles alter column privacy_agreed_at drop not null;
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists nickname_updated_at timestamptz;
alter table public.profiles add constraint profiles_nickname_valid check (
  nickname is null or (
    nickname = btrim(nickname)
    and char_length(nickname) between 1 and 20
    and nickname !~ '[[:cntrl:]]'
    and position(chr(8232) in nickname) = 0
    and position(chr(8233) in nickname) = 0
  )
);

-- User-approved legacy age erasure. Remote execution still requires backup and
-- separate approval. One atomic statement: no observable/persistent bypass window.
do $erase_legacy_age$
declare v_original_guard text;
begin
  if current_user <> 'postgres' then raise exception 'migration_owner_required'; end if;
  lock table auth.users, public.profiles in access exclusive mode;
  select pg_get_functiondef('public.guard_profile_changes()'::regprocedure) into v_original_guard;
  execute $guard_definition$
    create or replace function public.guard_profile_changes()
    returns trigger language plpgsql security invoker
    set search_path = pg_catalog, public as $age_guard$
    begin
      if current_user <> 'postgres' or pg_trigger_depth() <> 1
        or new.birth_year is not null or new.age_band is not null
        or (old.birth_year is null and old.age_band is null)
        or (to_jsonb(new) - 'birth_year' - 'age_band')
          is distinct from (to_jsonb(old) - 'birth_year' - 'age_band') then
        raise exception 'immutable_profile_field';
      end if;
      return new;
    end;
    $age_guard$;
  $guard_definition$;
  update public.profiles set birth_year = null, age_band = null
  where birth_year is not null or age_band is not null;
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'birth_year' - 'age_band'
  where coalesce(raw_user_meta_data, '{}'::jsonb) ?| array['birth_year', 'age_band'];
  execute v_original_guard;
end;
$erase_legacy_age$;

create table public.signup_consent_documents (
  document_id text not null check (document_id in ('terms-of-service', 'privacy-policy')),
  document_version text not null check (char_length(document_version) between 1 and 120),
  document_url text not null check (document_url ~ '^https://'),
  active boolean not null default false,
  approved_at timestamptz not null,
  primary key (document_id, document_version)
);
create unique index signup_consent_documents_one_active_kind
  on public.signup_consent_documents(document_id) where active;
alter table public.signup_consent_documents enable row level security;
revoke all on table public.signup_consent_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_consent_documents to service_role;

create table public.account_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_kind text not null check (consent_kind in ('terms', 'privacy')),
  document_id text not null,
  document_version text not null,
  signup_request_id uuid not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  evidence_schema_version smallint not null default 1 check (evidence_schema_version = 1),
  foreign key (document_id, document_version) references public.signup_consent_documents(document_id, document_version),
  unique (user_id, consent_kind, document_version),
  unique (user_id, consent_kind, signup_request_id)
);
alter table public.account_consent_records enable row level security;
create policy account_consent_records_select_own on public.account_consent_records
  for select to authenticated using (public.is_account_user() and user_id = auth.uid());
revoke all on table public.account_consent_records from public, anon, authenticated;
grant select on table public.account_consent_records to authenticated;
grant select, insert, update, delete on table public.account_consent_records to service_role;

create or replace function public.get_signup_consent_documents()
returns table (document_id text, document_version text, document_url text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select d.document_id, d.document_version, d.document_url
  from public.signup_consent_documents d
  where d.active
  order by d.document_id
$$;
revoke all on function public.get_signup_consent_documents() from public;
grant execute on function public.get_signup_consent_documents() to anon, authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_terms jsonb;
  v_privacy jsonb;
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  begin
    v_request_id := nullif(new.raw_user_meta_data ->> 'signup_request_id', '')::uuid;
  exception when others then
    raise exception 'signup_consent_required';
  end;
  v_terms := new.raw_user_meta_data #> '{required_consents,terms}';
  v_privacy := new.raw_user_meta_data #> '{required_consents,privacy}';
  if v_request_id is null
    or coalesce((v_terms ->> 'accepted')::boolean, false) is not true
    or coalesce((v_privacy ->> 'accepted')::boolean, false) is not true
    or v_terms ->> 'document_id' <> 'terms-of-service'
    or v_privacy ->> 'document_id' <> 'privacy-policy'
    or not exists (
      select 1 from public.signup_consent_documents d
      where d.document_id = v_terms ->> 'document_id'
        and d.document_version = v_terms ->> 'document_version' and d.active
    )
    or not exists (
      select 1 from public.signup_consent_documents d
      where d.document_id = v_privacy ->> 'document_id'
        and d.document_version = v_privacy ->> 'document_version' and d.active
    ) then
    raise exception 'signup_consent_required';
  end if;

  insert into public.profiles (id, birth_year, age_band, email_verified_at, terms_agreed_at, privacy_agreed_at)
  values (new.id, null, null, new.email_confirmed_at, null, null);
  insert into public.account_consent_records (user_id, consent_kind, document_id, document_version, signup_request_id)
  values
    (new.id, 'terms', v_terms ->> 'document_id', v_terms ->> 'document_version', v_request_id),
    (new.id, 'privacy', v_privacy ->> 'document_id', v_privacy ->> 'document_version', v_request_id);
  return new;
end;
$$;

create or replace function public.guard_profile_changes()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.id is distinct from old.id
    or new.birth_year is distinct from old.birth_year
    or new.age_band is distinct from old.age_band
    or new.terms_agreed_at is distinct from old.terms_agreed_at
    or new.privacy_agreed_at is distinct from old.privacy_agreed_at then
    raise exception 'immutable_profile_field';
  end if;
  if new.email_verified_at is distinct from old.email_verified_at then
    -- 007 Auth UPDATE -> postgres-owned SECURITY DEFINER sync -> this INVOKER
    -- guard. Only the canonical Auth value in that nested trigger is permitted.
    -- Neither a client-set GUC/JWT nor a direct administrator UPDATE is a bypass.
    if current_user <> 'postgres' or pg_trigger_depth() <> 2 then
      raise exception 'immutable_profile_field';
    end if;
    if not exists (
      select 1 from auth.users u where u.id = old.id
        and u.email_confirmed_at is not distinct from new.email_verified_at
    ) then
      raise exception 'immutable_profile_field';
    end if;
  end if;
  return new;
end;
$$;

create table public.account_nickname_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null check (char_length(mutation_id) between 1 and 200),
  nickname text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, mutation_id)
);
alter table public.account_nickname_mutations enable row level security;
revoke all on table public.account_nickname_mutations from public, anon, authenticated;
grant select, insert, update, delete on table public.account_nickname_mutations to service_role;

create or replace function public.update_account_nickname(p_mutation_id text, p_nickname text)
returns table (nickname text, nickname_updated_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_nickname text; v_previous text;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_mutation_id is null or char_length(p_mutation_id) not between 1 and 200 then raise exception 'invalid_request'; end if;
  v_nickname := case when p_nickname is null then null else regexp_replace(btrim(p_nickname), '[[:space:]]+', ' ', 'g') end;
  if v_nickname is not null and (char_length(v_nickname) not between 1 and 20 or v_nickname ~ '[[:cntrl:]]' or position(chr(8232) in v_nickname)>0 or position(chr(8233) in v_nickname)>0) then raise exception 'invalid_nickname'; end if;
  select m.nickname into v_previous from public.account_nickname_mutations m where m.user_id = auth.uid() and m.mutation_id = p_mutation_id;
  if found and v_previous is distinct from v_nickname then raise exception 'idempotency_conflict'; end if;
  if found then
    return query select p.nickname, p.nickname_updated_at from public.profiles p where p.id = auth.uid();
    return;
  end if;
  insert into public.account_nickname_mutations(user_id, mutation_id, nickname) values (auth.uid(), p_mutation_id, v_nickname) on conflict do nothing;
  update public.profiles p set nickname = v_nickname, nickname_updated_at = case when p.nickname is distinct from v_nickname then timezone('utc', now()) else p.nickname_updated_at end where p.id = auth.uid();
  return query select p.nickname, p.nickname_updated_at from public.profiles p where p.id = auth.uid();
end;
$$;
revoke all on function public.update_account_nickname(text, text) from public, anon;
grant execute on function public.update_account_nickname(text, text) to authenticated;

create table public.account_record_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation bigint not null default 1 check (generation > 0),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.account_record_state enable row level security;
create policy account_record_state_select_own on public.account_record_state for select to authenticated
  using (public.is_account_user() and user_id = auth.uid());
revoke all on table public.account_record_state from public, anon, authenticated;
grant select on table public.account_record_state to authenticated;
grant select, insert, update, delete on table public.account_record_state to service_role;

create table public.account_course_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completion_id text not null check (char_length(completion_id) between 1 and 200),
  course_run_id text not null check (char_length(course_run_id) between 1 and 200),
  completed_at timestamptz not null,
  provenance text not null check (provenance in ('account_completed', 'guest_import')),
  owner_generation bigint not null check (owner_generation > 0),
  payload_hash bytea not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, completion_id), unique (user_id, course_run_id)
);
create table public.account_course_completion_places (
  completion_id uuid not null references public.account_course_completions(id) on delete cascade,
  stop_ordinal smallint not null check (stop_ordinal in (1, 2)),
  content_id text not null check (char_length(content_id) between 1 and 160),
  title text not null check (char_length(title) between 1 and 240),
  category text not null check (char_length(category) between 1 and 120),
  sub_category text check (sub_category is null or char_length(sub_category) between 1 and 120),
  primary key (completion_id, stop_ordinal)
);
create table public.account_completion_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_run_id text not null,
  deleted_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, course_run_id)
);
alter table public.account_course_completions enable row level security;
alter table public.account_course_completion_places enable row level security;
alter table public.account_completion_tombstones enable row level security;
create policy account_course_completions_select_own on public.account_course_completions for select to authenticated using (public.is_account_user() and user_id = auth.uid());
create policy account_completion_places_select_own on public.account_course_completion_places for select to authenticated using (exists (select 1 from public.account_course_completions c where c.id = account_course_completion_places.completion_id and c.user_id = auth.uid() and public.is_account_user()));
revoke all on table public.account_course_completions, public.account_course_completion_places, public.account_completion_tombstones from public, anon, authenticated;
grant select on table public.account_course_completions, public.account_course_completion_places to authenticated;
grant select, insert, update, delete on table public.account_course_completions, public.account_course_completion_places, public.account_completion_tombstones to service_role;

create table public.guest_completion_imports (
  import_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_hash bytea not null,
  accepted_source_ids jsonb not null default '[]'::jsonb,
  rejected_source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create table public.guest_completion_source_claims (
  source_completion_id text primary key,
  import_id uuid not null references public.guest_completion_imports(import_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.guest_completion_imports enable row level security;
alter table public.guest_completion_source_claims enable row level security;
revoke all on table public.guest_completion_imports, public.guest_completion_source_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.guest_completion_imports, public.guest_completion_source_claims to service_role;

create table public.account_record_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 200),
  mutation_kind text not null check (mutation_kind in ('delete_completion','delete_all_completions')),
  target_completion_id text,
  resulting_generation bigint not null check (resulting_generation > 0),
  created_at timestamptz not null default timezone('utc', now()),
  check (
    (mutation_kind='delete_completion' and target_completion_id is not null and char_length(target_completion_id) between 1 and 200)
    or (mutation_kind='delete_all_completions' and target_completion_id is null)
  ),
  primary key (user_id, request_id, mutation_kind)
);
alter table public.account_record_mutations enable row level security;
revoke all on table public.account_record_mutations from public, anon, authenticated;
grant select, insert, update, delete on table public.account_record_mutations to service_role;

create or replace function public.get_account_record_generation()
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_generation bigint;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  insert into public.account_record_state(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select generation into v_generation from public.account_record_state where user_id=auth.uid();
  return v_generation;
end;
$$;

create or replace function public.write_account_course_completion(
  p_completion_id text, p_course_run_id text, p_completed_at_minute bigint,
  p_owner_generation bigint, p_places jsonb
) returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_generation bigint; v_hash bytea; v_existing bytea; v_id uuid;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_completion_id is null or char_length(p_completion_id) not between 1 and 200
    or p_course_run_id is null or char_length(p_course_run_id) not between 1 and 200
    or p_completed_at_minute is null or p_completed_at_minute <= 0
    or p_completed_at_minute > floor(extract(epoch from (timezone('utc', now()) + interval '5 minutes')) / 60)::bigint
    or p_owner_generation is null or p_owner_generation <= 0
    or jsonb_typeof(p_places) <> 'array' or jsonb_array_length(p_places) not between 1 and 2
    or exists (
      select 1 from jsonb_array_elements(p_places) as item(value)
      where jsonb_typeof(value) <> 'object'
        or not (value ?& array['stopOrdinal','contentId','title','category'])
        or exists (select 1 from jsonb_object_keys(value) as key(name) where name not in ('stopOrdinal','contentId','title','category','subCategory'))
        or value ->> 'stopOrdinal' not in ('1','2')
        or jsonb_typeof(value -> 'contentId') <> 'string' or char_length(value ->> 'contentId') not between 1 and 160
        or jsonb_typeof(value -> 'title') <> 'string' or char_length(value ->> 'title') not between 1 and 240
        or jsonb_typeof(value -> 'category') <> 'string' or char_length(value ->> 'category') not between 1 and 120
        or (value ? 'subCategory' and jsonb_typeof(value -> 'subCategory') not in ('string','null'))
        or (jsonb_typeof(value -> 'subCategory') = 'string' and char_length(value ->> 'subCategory') not between 1 and 120)
    )
    or (select count(distinct value ->> 'stopOrdinal') from jsonb_array_elements(p_places)) <> jsonb_array_length(p_places)
  then raise exception 'invalid_input'; end if;
  v_generation := public.get_account_record_generation();
  if p_owner_generation <> v_generation or exists(select 1 from public.account_completion_tombstones where user_id=auth.uid() and course_run_id=p_course_run_id) then return 'stale_generation'; end if;
  v_hash := digest(convert_to(p_completion_id || E'\n' || p_course_run_id || E'\n' || p_completed_at_minute::text || E'\n' || p_places::text, 'utf8'), 'sha256');
  select payload_hash into v_existing from public.account_course_completions where user_id=auth.uid() and (completion_id=p_completion_id or course_run_id=p_course_run_id);
  if found then return case when v_existing=v_hash then 'already_completed' else 'idempotency_conflict' end; end if;
  insert into public.account_course_completions(user_id,completion_id,course_run_id,completed_at,provenance,owner_generation,payload_hash)
  values(auth.uid(),p_completion_id,p_course_run_id,to_timestamp(p_completed_at_minute*60),'account_completed',p_owner_generation,v_hash) returning id into v_id;
  insert into public.account_course_completion_places(completion_id,stop_ordinal,content_id,title,category,sub_category)
  select v_id,x."stopOrdinal",x."contentId",x.title,x.category,x."subCategory"
  from jsonb_to_recordset(p_places) x("stopOrdinal" smallint,"contentId" text,title text,category text,"subCategory" text);
  return 'created';
end;
$$;

create or replace function public.delete_account_course_completion(p_completion_id text, p_request_id text)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_run text; v_previous_target text; v_generation bigint;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_completion_id is null or char_length(p_completion_id) not between 1 and 200
    or p_request_id is null or char_length(p_request_id) not between 1 and 200 then raise exception 'invalid_request'; end if;
  select target_completion_id into v_previous_target from public.account_record_mutations
    where user_id=auth.uid() and request_id=p_request_id and mutation_kind='delete_completion';
  if found then
    if v_previous_target is distinct from p_completion_id then raise exception 'idempotency_conflict'; end if;
    return 'deleted';
  end if;
  select course_run_id into v_run from public.account_course_completions where user_id=auth.uid() and completion_id=p_completion_id for update;
  if not found then return 'not_found'; end if;
  v_generation := public.get_account_record_generation();
  insert into public.account_completion_tombstones(user_id,course_run_id) values(auth.uid(),v_run) on conflict do nothing;
  delete from public.account_course_completions where user_id=auth.uid() and completion_id=p_completion_id;
  insert into public.account_record_mutations(user_id,request_id,mutation_kind,target_completion_id,resulting_generation)
    values(auth.uid(),p_request_id,'delete_completion',p_completion_id,v_generation);
  return 'deleted';
end;
$$;

create or replace function public.delete_all_account_course_completions(p_request_id text)
returns bigint language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_generation bigint;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_request_id is null or char_length(p_request_id) not between 1 and 200 then raise exception 'invalid_request'; end if;
  select resulting_generation into v_generation from public.account_record_mutations where user_id=auth.uid() and request_id=p_request_id and mutation_kind='delete_all_completions';
  if found then return v_generation; end if;
  insert into public.account_record_state(user_id,generation) values(auth.uid(),2)
  on conflict(user_id) do update set generation=account_record_state.generation+1,updated_at=timezone('utc',now())
  returning generation into v_generation;
  delete from public.account_course_completions where user_id=auth.uid();
  delete from public.account_completion_tombstones where user_id=auth.uid();
  insert into public.account_record_mutations(user_id,request_id,mutation_kind,resulting_generation) values(auth.uid(),p_request_id,'delete_all_completions',v_generation);
  return v_generation;
end;
$$;

create or replace function public.import_guest_course_completions(p_import_id uuid, p_items jsonb)
returns table(status text, accepted_source_ids jsonb, rejected_source_ids jsonb)
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_hash bytea; v_existing bytea; v_accepted jsonb := '[]'::jsonb; v_rejected jsonb := '[]'::jsonb; v_item jsonb; v_source text; v_completion uuid; v_generation bigint;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  if p_import_id is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 1000 then raise exception 'invalid_input'; end if;
  v_hash := digest(convert_to(p_items::text,'utf8'),'sha256');
  select request_hash,guest_completion_imports.accepted_source_ids,guest_completion_imports.rejected_source_ids into v_existing,v_accepted,v_rejected from public.guest_completion_imports where import_id=p_import_id and user_id=auth.uid();
  if found then
    if v_existing<>v_hash then raise exception 'idempotency_conflict'; end if;
    return query select 'already_acknowledged'::text,v_accepted,v_rejected; return;
  end if;
  v_accepted := '[]'::jsonb;
  v_rejected := '[]'::jsonb;
  if exists(select 1 from public.guest_completion_imports where import_id=p_import_id) then raise exception 'import_owned_by_other_account'; end if;
  insert into public.guest_completion_imports(import_id,user_id,request_hash) values(p_import_id,auth.uid(),v_hash);
  v_generation := public.get_account_record_generation();
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_source := v_item->>'sourceCompletionId';
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ?& array['sourceCompletionId','courseRunId','completedAtMinute','places'])
      or exists (select 1 from jsonb_object_keys(v_item) as key(name) where name not in ('sourceCompletionId','courseRunId','completedAtMinute','places'))
      or v_source is null or char_length(v_source) not between 1 and 200
      or v_item->>'courseRunId' is null or char_length(v_item->>'courseRunId') not between 1 and 200
      or jsonb_typeof(v_item->'completedAtMinute') <> 'number' or v_item->>'completedAtMinute' !~ '^[0-9]+$'
      or (v_item->>'completedAtMinute')::numeric <= 0
      or (v_item->>'completedAtMinute')::numeric > floor(extract(epoch from (timezone('utc',now())+interval '5 minutes'))/60)::numeric
      or jsonb_typeof(v_item->'places')<>'array' or jsonb_array_length(v_item->'places') not between 1 and 2
      or exists (
        select 1 from jsonb_array_elements(v_item->'places') as place(value)
        where jsonb_typeof(value) <> 'object'
          or not (value ?& array['stopOrdinal','contentId','title','category'])
          or exists (select 1 from jsonb_object_keys(value) as key(name) where name not in ('stopOrdinal','contentId','title','category','subCategory'))
          or value ->> 'stopOrdinal' not in ('1','2')
          or jsonb_typeof(value -> 'contentId') <> 'string' or char_length(value ->> 'contentId') not between 1 and 160
          or jsonb_typeof(value -> 'title') <> 'string' or char_length(value ->> 'title') not between 1 and 240
          or jsonb_typeof(value -> 'category') <> 'string' or char_length(value ->> 'category') not between 1 and 120
          or (value ? 'subCategory' and jsonb_typeof(value -> 'subCategory') not in ('string','null'))
          or (jsonb_typeof(value -> 'subCategory') = 'string' and char_length(value ->> 'subCategory') not between 1 and 120)
      )
      or (select count(distinct value ->> 'stopOrdinal') from jsonb_array_elements(v_item->'places')) <> jsonb_array_length(v_item->'places')
    then
      if v_source is not null and char_length(v_source) between 1 and 200 then v_rejected := v_rejected || to_jsonb(v_source); end if;
      continue;
    end if;
    begin
      insert into public.guest_completion_source_claims(source_completion_id,import_id,user_id) values(v_source,p_import_id,auth.uid());
    exception when unique_violation then
      v_rejected := v_rejected || to_jsonb(v_source); continue;
    end;
    if exists(select 1 from public.account_course_completions where user_id=auth.uid() and course_run_id=v_item->>'courseRunId') then
      delete from public.guest_completion_source_claims where source_completion_id=v_source and import_id=p_import_id;
      v_rejected := v_rejected || to_jsonb(v_source); continue;
    end if;
    insert into public.account_course_completions(user_id,completion_id,course_run_id,completed_at,provenance,owner_generation,payload_hash)
    values(auth.uid(),v_source,v_item->>'courseRunId',to_timestamp((v_item->>'completedAtMinute')::bigint*60),'guest_import',v_generation,digest(convert_to(v_item::text,'utf8'),'sha256')) returning id into v_completion;
    insert into public.account_course_completion_places(completion_id,stop_ordinal,content_id,title,category,sub_category)
    select v_completion,x."stopOrdinal",x."contentId",x.title,x.category,x."subCategory"
    from jsonb_to_recordset(v_item->'places') x("stopOrdinal" smallint,"contentId" text,title text,category text,"subCategory" text);
    v_accepted := v_accepted || to_jsonb(v_source);
  end loop;
  update public.guest_completion_imports set accepted_source_ids=v_accepted,rejected_source_ids=v_rejected where import_id=p_import_id and user_id=auth.uid();
  return query select 'acknowledged'::text,v_accepted,v_rejected;
end;
$$;

revoke all on function public.get_account_record_generation(),
  public.write_account_course_completion(text,text,bigint,bigint,jsonb),
  public.delete_account_course_completion(text,text),
  public.delete_all_account_course_completions(text),
  public.import_guest_course_completions(uuid,jsonb) from public,anon;
grant execute on function public.get_account_record_generation(),
  public.write_account_course_completion(text,text,bigint,bigint,jsonb),
  public.delete_account_course_completion(text,text),
  public.delete_all_account_course_completions(text),
  public.import_guest_course_completions(uuid,jsonb) to authenticated;

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  request_id uuid not null unique,
  state text not null default 'processing' check (state in ('processing', 'retryable')),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.account_deletion_requests enable row level security;
revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_requests to service_role;

-- Replace every account-owned policy with an explicit non-anonymous predicate.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (public.is_account_user() and id = auth.uid());
revoke insert, update, delete on table public.profiles from authenticated;

-- Legacy app-table grants may predate RLS and include destructive/DDL rights.
-- RLS cannot protect TRUNCATE. Leave required DML and all service-role grants intact.
revoke truncate, references, trigger on table
  public.profiles, public.courses, public.course_stops, public.course_legs,
  public.course_feedback, public.recommendation_events
from public, anon, authenticated;

-- PostgreSQL 17 introduced MAINTAIN. Older local fixtures must not parse its
-- privilege syntax; supported servers revoke only these exact legacy app tables.
do $maintain_privilege$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on table public.profiles, public.courses,
      public.course_stops, public.course_legs, public.course_feedback,
      public.recommendation_events from public, anon, authenticated';
  end if;
end;
$maintain_privilege$;

drop policy if exists courses_select_own on public.courses;
drop policy if exists courses_insert_own on public.courses;
drop policy if exists courses_update_own on public.courses;
drop policy if exists courses_delete_own on public.courses;
create policy courses_select_own on public.courses for select to authenticated using (public.is_account_user() and user_id = auth.uid());
create policy courses_insert_own on public.courses for insert to authenticated with check (public.is_account_user() and user_id = auth.uid());
create policy courses_update_own on public.courses for update to authenticated using (public.is_account_user() and user_id = auth.uid()) with check (public.is_account_user() and user_id = auth.uid());
create policy courses_delete_own on public.courses for delete to authenticated using (public.is_account_user() and user_id = auth.uid());

drop policy if exists course_stops_select_own on public.course_stops;
drop policy if exists course_stops_insert_own on public.course_stops;
drop policy if exists course_stops_update_own on public.course_stops;
drop policy if exists course_stops_delete_own on public.course_stops;
create policy course_stops_select_own on public.course_stops for select to authenticated using (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_stops_insert_own on public.course_stops for insert to authenticated with check (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_stops_update_own on public.course_stops for update to authenticated using (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())) with check (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_stops_delete_own on public.course_stops for delete to authenticated using (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

drop policy if exists course_legs_select_own on public.course_legs;
drop policy if exists course_legs_insert_own on public.course_legs;
drop policy if exists course_legs_update_own on public.course_legs;
drop policy if exists course_legs_delete_own on public.course_legs;
create policy course_legs_select_own on public.course_legs for select to authenticated using (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_legs_insert_own on public.course_legs for insert to authenticated with check (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_legs_update_own on public.course_legs for update to authenticated using (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())) with check (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_legs_delete_own on public.course_legs for delete to authenticated using (public.is_account_user() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

drop policy if exists course_feedback_select_own on public.course_feedback;
drop policy if exists course_feedback_insert_own on public.course_feedback;
drop policy if exists course_feedback_update_own on public.course_feedback;
drop policy if exists course_feedback_delete_own on public.course_feedback;
create policy course_feedback_select_own on public.course_feedback for select to authenticated using (public.is_account_user() and user_id = auth.uid());
create policy course_feedback_insert_own on public.course_feedback for insert to authenticated with check (public.is_account_user() and user_id = auth.uid() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_feedback_update_own on public.course_feedback for update to authenticated using (public.is_account_user() and user_id = auth.uid()) with check (public.is_account_user() and user_id = auth.uid() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy course_feedback_delete_own on public.course_feedback for delete to authenticated using (public.is_account_user() and user_id = auth.uid());
drop policy if exists recommendation_events_insert_own on public.recommendation_events;
create policy recommendation_events_insert_own on public.recommendation_events for insert to authenticated with check (public.is_account_user() and user_id = auth.uid());

-- Atomic save. Any invalid stop/leg rolls back the parent in the same function transaction.
alter table public.courses add column if not exists client_request_id uuid;
create unique index courses_user_client_request_unique on public.courses(user_id, client_request_id) where client_request_id is not null;
create or replace function public.create_course_plan(
  p_request_id uuid, p_origin_label text, p_origin_lat numeric, p_origin_lon numeric,
  p_destination_label text, p_destination_lat numeric, p_destination_lon numeric,
  p_starts_at timestamptz, p_ends_at timestamptz, p_mode public.travel_mode,
  p_total_move_min integer, p_total_dwell_min integer, p_buffer_min integer,
  p_recommendation_snapshot jsonb, p_stops jsonb, p_legs jsonb
) returns table (id uuid, created_at timestamptz)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_course_id uuid;
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  select c.id into v_course_id from public.courses c where c.user_id = auth.uid() and c.client_request_id = p_request_id;
  if found then return query select c.id, c.created_at from public.courses c where c.id = v_course_id; return; end if;
  insert into public.courses(user_id, client_request_id, status, origin_label, origin_lat, origin_lon, destination_label, destination_lat, destination_lon, starts_at, ends_at, mode, total_move_min, total_dwell_min, buffer_min, recommendation_snapshot)
  values(auth.uid(), p_request_id, 'saved', p_origin_label, p_origin_lat, p_origin_lon, p_destination_label, p_destination_lat, p_destination_lon, p_starts_at, p_ends_at, p_mode, p_total_move_min, p_total_dwell_min, p_buffer_min, p_recommendation_snapshot)
  returning courses.id into v_course_id;
  insert into public.course_stops(course_id, stop_order, place_source, place_content_id, title, category, sub_category, lat, lon, planned_dwell_min, dwell_source, kakao_place_url)
  select v_course_id, x.stop_order, x.place_source, x.place_content_id, x.title, x.category, x.sub_category, x.lat, x.lon, x.planned_dwell_min, x.dwell_source, x.kakao_place_url
  from jsonb_to_recordset(coalesce(p_stops, '[]'::jsonb)) x(stop_order integer, place_source text, place_content_id text, title text, category text, sub_category text, lat numeric, lon numeric, planned_dwell_min integer, dwell_source text, kakao_place_url text);
  insert into public.course_legs(course_id, leg_order, from_kind, to_kind, mode, move_min, source, route_summary)
  select v_course_id, x.leg_order, x.from_kind::public.course_endpoint_kind, x.to_kind::public.course_endpoint_kind, x.mode::public.travel_mode, x.move_min, x.source, x.route_summary
  from jsonb_to_recordset(coalesce(p_legs, '[]'::jsonb)) x(leg_order integer, from_kind text, to_kind text, mode text, move_min integer, source text, route_summary jsonb);
  return query select c.id, c.created_at from public.courses c where c.id = v_course_id;
end;
$$;
revoke all on function public.create_course_plan(uuid,text,numeric,numeric,text,numeric,numeric,timestamptz,timestamptz,public.travel_mode,integer,integer,integer,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.create_course_plan(uuid,text,numeric,numeric,text,numeric,numeric,timestamptz,timestamptz,public.travel_mode,integer,integer,integer,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.claim_account_deletion(p_user_id uuid, p_request_id uuid)
returns text language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_request uuid;
begin
  if p_user_id is null or p_request_id is null then raise exception 'invalid_request'; end if;
  select request_id into v_request from public.account_deletion_requests where user_id = p_user_id;
  if found then return case when v_request = p_request_id then 'same_request' else 'conflict' end; end if;
  insert into public.account_deletion_requests(user_id, request_id) values (p_user_id, p_request_id);
  return 'claimed';
end;
$$;
create or replace function public.count_account_owned_rows(p_user_id uuid)
returns bigint language sql stable security definer set search_path = pg_catalog, public as $$
  select
    (select count(*) from public.profiles where id = p_user_id)
    + (select count(*) from public.courses where user_id = p_user_id)
    + (select count(*) from public.course_feedback where user_id = p_user_id)
    + (select count(*) from public.recommendation_events where user_id = p_user_id)
    + (select count(*) from public.account_consent_records where user_id = p_user_id)
    + (select count(*) from public.account_course_completions where user_id = p_user_id)
$$;
revoke all on function public.claim_account_deletion(uuid, uuid), public.count_account_owned_rows(uuid) from public, anon, authenticated;
grant execute on function public.claim_account_deletion(uuid, uuid), public.count_account_owned_rows(uuid) to service_role;

-- Existing replace RPC must also reject anonymous JWTs before touching a graph.
create or replace function public.replace_course_plan(
  p_course_id uuid, p_origin_label text, p_origin_lat numeric, p_origin_lon numeric,
  p_total_move_min integer, p_total_dwell_min integer, p_buffer_min integer,
  p_recommendation_snapshot jsonb, p_stops jsonb, p_legs jsonb
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not public.is_account_user() then raise exception 'account_required'; end if;
  update public.courses set status='in_progress', origin_label=p_origin_label, origin_lat=p_origin_lat, origin_lon=p_origin_lon,
    total_move_min=p_total_move_min, total_dwell_min=p_total_dwell_min, buffer_min=p_buffer_min,
    recommendation_snapshot=p_recommendation_snapshot, current_stop_order=1, last_recalculated_at=timezone('utc', now())
  where id=p_course_id and user_id=auth.uid();
  if not found then raise exception 'course_not_found_or_forbidden'; end if;
  delete from public.course_stops where course_id=p_course_id;
  delete from public.course_legs where course_id=p_course_id;
  insert into public.course_stops(course_id,stop_order,place_source,place_content_id,title,category,sub_category,lat,lon,planned_dwell_min,dwell_source,kakao_place_url)
  select p_course_id,x.stop_order,x.place_source,x.place_content_id,x.title,x.category,x.sub_category,x.lat,x.lon,x.planned_dwell_min,x.dwell_source,x.kakao_place_url
  from jsonb_to_recordset(coalesce(p_stops,'[]'::jsonb)) x(stop_order integer,place_source text,place_content_id text,title text,category text,sub_category text,lat numeric,lon numeric,planned_dwell_min integer,dwell_source text,kakao_place_url text);
  insert into public.course_legs(course_id,leg_order,from_kind,to_kind,mode,move_min,source,route_summary)
  select p_course_id,x.leg_order,x.from_kind::public.course_endpoint_kind,x.to_kind::public.course_endpoint_kind,x.mode::public.travel_mode,x.move_min,x.source,x.route_summary
  from jsonb_to_recordset(coalesce(p_legs,'[]'::jsonb)) x(leg_order integer,from_kind text,to_kind text,mode text,move_min integer,source text,route_summary jsonb);
end;
$$;
