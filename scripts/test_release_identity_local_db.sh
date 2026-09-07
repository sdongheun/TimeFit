#!/bin/sh
set -eu

# Every mode creates its own disposable cluster; never accepts a DB URL.
MODE=${1:-empty}
case "$MODE" in empty|upgrade|email|privileges|cli|c-cleanup|digest-extensions|digest-public) ;; *) echo 'unknown local test mode' >&2; exit 2 ;; esac

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FIXTURE_FILE="$ROOT_DIR/test/fixtures/db-release-identity-a-v1.json"
PG_BIN=${PG_BIN:-/opt/homebrew/bin}
PG_PORT=${PG_PORT:-55439}
DB_ROOT=$(mktemp -d /private/tmp/timefit-release-identity.XXXXXX)

cleanup() {
  "$PG_BIN/pg_ctl" -D "$DB_ROOT/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$DB_ROOT"
}
trap cleanup EXIT HUP INT TERM

ACCOUNT_A=$(jq -r '.identities.accountA.subject' "$FIXTURE_FILE")
ACCOUNT_B=$(jq -r '.identities.accountB.subject' "$FIXTURE_FILE")
ANONYMOUS=$(jq -r '.identities.anonymous.subject' "$FIXTURE_FILE")

"$PG_BIN/initdb" -D "$DB_ROOT/data" -U postgres --auth=trust --no-locale --encoding=UTF8 >/dev/null
LISTEN_ADDRESS=''
if [ "$MODE" = cli ]; then LISTEN_ADDRESS=127.0.0.1; fi
"$PG_BIN/pg_ctl" -D "$DB_ROOT/data" -o "-k $DB_ROOT -p $PG_PORT -c listen_addresses='$LISTEN_ADDRESS'" -l "$DB_ROOT/postgres.log" start >/dev/null

PSQL="$PG_BIN/psql -X -U postgres -h $DB_ROOT -p $PG_PORT -d postgres -v ON_ERROR_STOP=1"
$PSQL -q -c "
  alter database postgres set timezone='UTC';
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users(
    id uuid primary key,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    email_confirmed_at timestamptz,
    is_anonymous boolean not null default false,
    last_sign_in_at timestamptz,
    created_at timestamptz not null default timezone('utc',now())
  );
  create function auth.uid() returns uuid language sql stable as
    \$\$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid \$\$;
  create function auth.jwt() returns jsonb language sql stable as
    \$\$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) \$\$;
  grant usage on schema auth to anon,authenticated,service_role;
  grant select,insert,update,delete on auth.users to service_role;
  grant usage on schema auth to supabase_auth_admin;
  grant select,insert,update on auth.users to supabase_auth_admin;
  grant usage on schema public to anon,authenticated,service_role;
  alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
"

if [ "$MODE" = digest-extensions ]; then
  $PSQL -q -c 'create schema extensions; create extension pgcrypto with schema extensions;'
fi
for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do
  case "$migration" in
    *202609080017*) case "$MODE" in digest-*) break ;; esac ;;
  esac
  $PSQL -q -1 -f "$migration"
  case "$migration" in
    *202609030014*)
      $PSQL -q -f "$ROOT_DIR/test/fixtures/release-migration-compat-catalog.sql"
      if [ "$MODE" = upgrade ]; then
        $PSQL -q -f "$ROOT_DIR/test/fixtures/release-migration-compat-before.sql"
        node "$ROOT_DIR/scripts/test_release_migration_age_boundary.mjs" "$PG_BIN/psql" "$DB_ROOT" "$PG_PORT"
      fi
      if [ "$MODE" = cli ]; then
        $PSQL -q -f "$ROOT_DIR/test/fixtures/release-migration-compat-before.sql"
        node "$ROOT_DIR/scripts/test_release_migration_cli.mjs" "$PG_BIN/psql" "$DB_ROOT" "$PG_PORT" "$ROOT_DIR"
        exit
      fi
      ;;
  esac
done

case "$MODE" in
  digest-*) node "$ROOT_DIR/scripts/test_digest_schema_compat.mjs" "$DB_ROOT" "$PG_PORT" "$MODE"; exit ;;
  c-cleanup) node "$ROOT_DIR/scripts/test_c_validation_cleanup.mjs" "$DB_ROOT" "$PG_PORT"; exit ;;
  upgrade) $PSQL -f "$ROOT_DIR/test/fixtures/release-migration-compat-after.sql"; exit ;;
  email|privileges) $PSQL -f "$ROOT_DIR/test/fixtures/release-migration-compat-$MODE.sql"; exit ;;
esac

$PSQL \
  -v account_a="$ACCOUNT_A" \
  -v account_b="$ACCOUNT_B" \
  -v anonymous="$ANONYMOUS" <<'SQL'
insert into public.signup_consent_documents(document_id,document_version,document_url,active,approved_at) values
  ('terms-of-service','fixture-v1','https://fixture.invalid/terms',true,timezone('utc',now())),
  ('privacy-policy','fixture-v1','https://fixture.invalid/privacy',true,timezone('utc',now()));

insert into auth.users(id,is_anonymous,raw_user_meta_data) values
  (:'account_a',false,jsonb_build_object(
    'signup_request_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'required_consents',jsonb_build_object(
      'terms',jsonb_build_object('document_id','terms-of-service','document_version','fixture-v1','accepted',true),
      'privacy',jsonb_build_object('document_id','privacy-policy','document_version','fixture-v1','accepted',true)))),
  (:'account_b',false,jsonb_build_object(
    'signup_request_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'required_consents',jsonb_build_object(
      'terms',jsonb_build_object('document_id','terms-of-service','document_version','fixture-v1','accepted',true),
      'privacy',jsonb_build_object('document_id','privacy-policy','document_version','fixture-v1','accepted',true)))),
  (:'anonymous',true,'{}'::jsonb);

select set_config('test.account_a', :'account_a', false);
select set_config('test.account_b', :'account_b', false);
select set_config('test.anonymous', :'anonymous', false);

do $$
begin
  if (select count(*) from public.profiles where id in (current_setting('test.account_a')::uuid,current_setting('test.account_b')::uuid)) <> 2 then
    raise exception 'account profiles were not created';
  end if;
  if exists(select 1 from public.profiles where id=current_setting('test.anonymous')::uuid) then
    raise exception 'anonymous profile was created';
  end if;
  if exists(select 1 from public.profiles where birth_year is not null or age_band is not null) then
    raise exception 'age data was collected';
  end if;
  if (select count(*) from public.account_consent_records) <> 4 then
    raise exception 'explicit consent evidence missing';
  end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', :'account_a', false);
select set_config('request.jwt.claims', jsonb_build_object('sub',:'account_a','is_anonymous',false)::text, false);

do $$
declare v_name text;
begin
  select nickname into v_name from public.update_account_nickname('nickname-a',repeat('가',20));
  if char_length(v_name) <> 20 then raise exception '20-code-point nickname rejected'; end if;
  begin
    perform public.update_account_nickname('nickname-too-long',repeat('가',21));
    raise exception '21-code-point nickname accepted';
  exception when check_violation or raise_exception then
    if sqlerrm = '21-code-point nickname accepted' then raise; end if;
  end;
end $$;

select * from public.create_course_plan(
  'aaaaaaaa-0000-4000-8000-000000000001','origin',35,129,'destination',35.1,129.1,
  timezone('utc',now()),timezone('utc',now())+interval '2 hours','walk',10,20,5,'{}',
  '[{"stop_order":1,"place_source":"timefit_catalog","place_content_id":"place-a","title":"A","category":"카페","sub_category":"북카페","lat":35.05,"lon":129.05,"planned_dwell_min":20,"dwell_source":"catalog"}]',
  '[{"leg_order":1,"from_kind":"origin","to_kind":"stop","mode":"walk","move_min":10,"source":"fixture","route_summary":{}}]');

do $$
begin
  begin
    perform * from public.create_course_plan(
      'aaaaaaaa-0000-4000-8000-000000000002','origin',35,129,'destination',35.1,129.1,
      timezone('utc',now()),timezone('utc',now())+interval '2 hours','walk',10,20,5,'{}',
      '[{"stop_order":1,"place_source":"timefit_catalog","place_content_id":"bad","title":"bad","category":"카페","lat":35,"lon":129,"planned_dwell_min":-1,"dwell_source":"fixture"}]','[]');
    raise exception 'invalid graph accepted';
  exception when check_violation then null;
  end;
  if exists(select 1 from public.courses where client_request_id='aaaaaaaa-0000-4000-8000-000000000002') then
    raise exception 'partial course parent survived';
  end if;
end $$;

do $$
declare v_generation bigint; v_status text;
begin
  v_generation := public.get_account_record_generation();
  v_status := public.write_account_course_completion(
    'completion-a','shared-run',floor(extract(epoch from timezone('utc',now()))/60)::bigint,v_generation,
    '[{"stopOrdinal":1,"contentId":"place-a","title":"A","category":"카페","subCategory":"북카페"}]');
  if v_status <> 'created' then raise exception 'account completion create failed: %',v_status; end if;
  v_status := public.write_account_course_completion(
    'completion-a','shared-run',floor(extract(epoch from timezone('utc',now()))/60)::bigint,v_generation,
    '[{"stopOrdinal":1,"contentId":"place-a","title":"A","category":"카페","subCategory":"북카페"}]');
  if v_status <> 'already_completed' then raise exception 'completion retry failed: %',v_status; end if;
  v_status := public.write_account_course_completion(
    'completion-delete','delete-run',floor(extract(epoch from timezone('utc',now()))/60)::bigint,v_generation,
    '[{"stopOrdinal":1,"contentId":"place-delete","title":"delete","category":"카페","subCategory":"북카페"}]');
  if v_status <> 'created' then raise exception 'deletion fixture create failed: %',v_status; end if;
  v_status := public.delete_account_course_completion('completion-delete','delete-one-request');
  if v_status <> 'deleted' then raise exception 'individual delete failed: %',v_status; end if;
  v_status := public.delete_account_course_completion('completion-delete','delete-one-request');
  if v_status <> 'deleted' then raise exception 'individual delete response-loss retry failed: %',v_status; end if;
  v_status := public.write_account_course_completion(
    'completion-delete-retry','delete-run',floor(extract(epoch from timezone('utc',now()))/60)::bigint,v_generation,
    '[{"stopOrdinal":1,"contentId":"place-delete","title":"delete","category":"카페","subCategory":"북카페"}]');
  if v_status <> 'stale_generation' then raise exception 'individual delete was restorable: %',v_status; end if;
end $$;

do $$
declare v_consent record; v_status text; v_completed bigint; v_generation bigint; v_index integer; v_profile record; v_order integer[];
begin
  select * into v_consent from public.set_dwell_personalization_consent('enable-a',true,0);
  v_completed := floor(extract(epoch from timezone('utc',now()))/60)::bigint;
  v_generation := public.get_account_record_generation();
  v_status := public.submit_dwell_completion_sample(
    'shared-run:1','shared-run',1::smallint,'place-a','카페','북카페',22,v_completed,current_setting('test.account_a')::uuid,v_consent.consent_epoch,v_consent.revision);
  if v_status <> 'accepted' then raise exception 'dwell submit failed: %',v_status; end if;
  v_status := public.submit_dwell_completion_sample(
    'shared-run:1','shared-run',1::smallint,'place-a','카페','북카페',22,v_completed,current_setting('test.account_a')::uuid,v_consent.consent_epoch,v_consent.revision);
  if v_status <> 'already_accepted' then raise exception 'dwell retry failed: %',v_status; end if;
  v_status := public.submit_dwell_completion_sample(
    'shared-run:1','shared-run',1::smallint,'place-a','카페','북카페',23,v_completed,current_setting('test.account_a')::uuid,v_consent.consent_epoch,v_consent.revision);
  if v_status <> 'idempotency_conflict' then raise exception 'dwell payload conflict missed: %',v_status; end if;
  if exists(select 1 from public.dwell_personalization_profiles where user_id=current_setting('test.account_a')::uuid) then
    raise exception 'one sample created a derived profile';
  end if;
  for v_index in 1..5 loop
    v_status := public.write_account_course_completion(
      'completion-sample-'||v_index,'sample-run-'||v_index,v_completed-v_index,v_generation,
      jsonb_build_array(jsonb_build_object('stopOrdinal',1,'contentId','sample-place-'||v_index,'title','sample','category','카페','subCategory','북카페')));
    if v_status <> 'created' then raise exception 'sample completion failed: %',v_status; end if;
    v_status := public.submit_dwell_completion_sample(
      'sample-run-'||v_index||':1','sample-run-'||v_index,1::smallint,'sample-place-'||v_index,'카페','북카페',v_index*10,v_completed-v_index,
      current_setting('test.account_a')::uuid,v_consent.consent_epoch,v_consent.revision);
    if v_status <> 'accepted' then raise exception 'sample submit failed: %',v_status; end if;
    if v_index = 1 and exists(select 1 from public.dwell_personalization_profiles where user_id=current_setting('test.account_a')::uuid) then
      raise exception 'two samples created a derived profile';
    end if;
    if v_index = 2 and not exists(select 1 from public.dwell_personalization_profiles where user_id=current_setting('test.account_a')::uuid) then
      raise exception 'three samples did not create a derived profile';
    end if;
  end loop;
  select * into v_profile from public.dwell_personalization_profiles where user_id=current_setting('test.account_a')::uuid and category='카페' and sub_category='북카페';
  if v_profile.sample_count <> 6 or v_profile.window_sample_count <> 5 or v_profile.median_dwell_min <> 22 then
    raise exception 'latest-five profile mismatch: %, %, %',v_profile.sample_count,v_profile.window_sample_count,v_profile.median_dwell_min;
  end if;
  select array_agg(actual_dwell_min order by completed_at,completion_event_id) into v_order
    from public.dwell_completion_samples where user_id=current_setting('test.account_a')::uuid;
  if v_order <> array[50,40,30,20,10,22] then raise exception 'sample order mismatch: %',v_order; end if;
end $$;

do $$
declare v_result record; v_items jsonb;
begin
  v_items := jsonb_build_array(jsonb_build_object(
    'sourceCompletionId','guest-source-1','courseRunId','guest-run-1',
    'completedAtMinute',floor(extract(epoch from timezone('utc',now()))/60)::bigint,
    'places',jsonb_build_array(jsonb_build_object(
      'stopOrdinal',1,'contentId','guest-place','title','guest','category','문화시설','subCategory','전시'))));
  select * into v_result from public.import_guest_course_completions('aaaaaaaa-0000-4000-8000-000000000010',v_items);
  if v_result.status <> 'acknowledged' or v_result.accepted_source_ids <> '["guest-source-1"]'::jsonb then
    raise exception 'guest import acknowledgement failed';
  end if;
  select * into v_result from public.import_guest_course_completions('aaaaaaaa-0000-4000-8000-000000000010',v_items);
  if v_result.status <> 'already_acknowledged' or v_result.accepted_source_ids <> '["guest-source-1"]'::jsonb then
    raise exception 'guest import response-loss retry failed';
  end if;
  if exists(select 1 from public.dwell_completion_samples where course_run_id='guest-run-1') then
    raise exception 'guest import was promoted to dwell learning';
  end if;
end $$;

select set_config('request.jwt.claim.sub', :'account_b', false);
select set_config('request.jwt.claims', jsonb_build_object('sub',:'account_b','is_anonymous',false)::text, false);
do $$
declare v_generation bigint; v_status text; v_import record; v_items jsonb;
begin
  if (select count(*) from public.courses) <> 0 then raise exception 'B can read A course'; end if;
  if (select count(*) from public.account_course_completions) <> 0 then raise exception 'B can read A completion'; end if;
  if (select count(*) from public.dwell_completion_samples) <> 0 then raise exception 'B can read A dwell sample'; end if;
  v_generation := public.get_account_record_generation();
  v_status := public.write_account_course_completion(
    'completion-b','shared-run',floor(extract(epoch from timezone('utc',now()))/60)::bigint,v_generation,
    '[{"stopOrdinal":1,"contentId":"place-b","title":"B","category":"카페","subCategory":"북카페"}]');
  if v_status <> 'created' then raise exception 'B namespace collision: %',v_status; end if;
  perform public.update_account_nickname('nickname-b',repeat('가',20));
  v_items := jsonb_build_array(jsonb_build_object(
    'sourceCompletionId','guest-source-1','courseRunId','guest-run-b',
    'completedAtMinute',floor(extract(epoch from timezone('utc',now()))/60)::bigint,
    'places',jsonb_build_array(jsonb_build_object(
      'stopOrdinal',1,'contentId','guest-place','title','guest','category','문화시설','subCategory','전시'))));
  select * into v_import from public.import_guest_course_completions('bbbbbbbb-0000-4000-8000-000000000010',v_items);
  if v_import.accepted_source_ids <> '[]'::jsonb or v_import.rejected_source_ids <> '["guest-source-1"]'::jsonb then
    raise exception 'cross-account guest source claim failed';
  end if;
end $$;

select set_config('request.jwt.claim.sub', :'anonymous', false);
select set_config('request.jwt.claims', jsonb_build_object('sub',:'anonymous','is_anonymous',true)::text, false);
do $$
begin
  if public.is_account_user() then raise exception 'anonymous accepted as account'; end if;
  begin
    perform public.get_account_record_generation();
    raise exception 'anonymous account RPC accepted';
  exception when raise_exception then
    if sqlerrm = 'anonymous account RPC accepted' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', :'account_a', false);
select set_config('request.jwt.claims', jsonb_build_object('sub',:'account_a','is_anonymous',false)::text, false);
do $$
declare v_reset record; v_status text; v_old_generation bigint;
begin
  perform public.update_account_nickname('nickname-a-2','두번째');
  perform public.update_account_nickname('nickname-a',repeat('가',20));
  if (select nickname from public.profiles where id=current_setting('test.account_a')::uuid) <> '두번째' then
    raise exception 'old nickname retry reverted a newer mutation';
  end if;
  select * into v_reset from public.reset_dwell_personalization('reset-a',1);
  if v_reset.status <> 'reset' or v_reset.enabled or v_reset.revision <> 2 or v_reset.deleted_sample_count <> 6 then
    raise exception 'dwell reset did not delete and disable';
  end if;
  if exists(select 1 from public.dwell_completion_samples where user_id=current_setting('test.account_a')::uuid)
    or exists(select 1 from public.dwell_personalization_profiles where user_id=current_setting('test.account_a')::uuid) then
    raise exception 'dwell reset rows survived';
  end if;
  v_old_generation := public.get_account_record_generation();
  perform public.delete_all_account_course_completions('delete-all-a');
  v_status := public.write_account_course_completion(
    'completion-stale','stale-run',floor(extract(epoch from timezone('utc',now()))/60)::bigint,v_old_generation,
    '[{"stopOrdinal":1,"contentId":"place-a","title":"A","category":"카페","subCategory":"북카페"}]');
  if v_status <> 'stale_generation' then raise exception 'deleted history was restorable: %',v_status; end if;
end $$;

reset role;
delete from auth.users where id=:'account_a';
do $$
begin
  if public.count_account_owned_rows(current_setting('test.account_a')::uuid) <> 0 then raise exception 'account cascade incomplete'; end if;
  if exists(select 1 from public.account_nickname_mutations where user_id=current_setting('test.account_a')::uuid) then raise exception 'nickname mutation survived deletion'; end if;
  if exists(select 1 from public.guest_completion_imports where user_id=current_setting('test.account_a')::uuid) then raise exception 'guest import survived deletion'; end if;
end $$;
SQL

echo "release identity local DB fixture: PASS"
