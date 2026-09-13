import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const identity = fs.readFileSync('supabase/migrations/202609070015_release_account_identity_records.sql', 'utf8');
const dwell = fs.readFileSync('supabase/migrations/202609070016_dwell_personalization_storage.sql', 'utf8');
const dwellCode = dwell.replace(/--.*$/gm, '');

test('015/016 bound each migration transaction; MAINTAIN revoke is version-scoped', () => {
  for (const migration of [identity,dwell]) {
    assert.match(migration, /set local lock_timeout = '3s'/);
    assert.match(migration, /set local statement_timeout = '60s'/);
  }
  assert.match(identity, /server_version_num.*170000/);
  assert.match(identity, /revoke maintain on table/);
});

test('015 legacy age erasure is a locked single-statement migration, never a persistent bypass', () => {
  assert.match(identity, /lock table auth\.users, public\.profiles in access exclusive mode/);
  assert.match(identity, /pg_get_functiondef\('public\.guard_profile_changes\(\)'::regprocedure\)/);
  assert.match(identity, /execute v_original_guard/);
  assert.match(identity, /to_jsonb\(new\) - 'birth_year' - 'age_band'/);
  assert.doesNotMatch(identity, /disable trigger|session_replication_role/i);
});

test('DB-RELEASE-IDENTITY B migration: account predicate가 anonymous를 fail-closed하고 전체 owner graph에 적용된다', () => {
  assert.match(identity, /coalesce\(\(auth\.jwt\(\) ->> 'is_anonymous'\)::boolean, true\) is false/);
  for (const table of ['profiles', 'courses', 'course_stops', 'course_legs', 'course_feedback', 'recommendation_events', 'account_course_completions']) {
    assert.match(identity, new RegExp(`${table}[^;]+public\\.is_account_user\\(\\)`, 's'), table);
  }
  assert.match(identity, /revoke insert, update, delete on table public\.profiles from authenticated/);
});

test('DB-RELEASE-IDENTITY B migration: 신규 가입은 나이 없이 exact 문서 registry와 server accepted_at을 요구한다', () => {
  assert.match(identity, /update auth\.users[\s\S]+- 'birth_year' - 'age_band'/);
  assert.match(identity, /signup_consent_required/);
  assert.match(identity, /account_consent_records/);
  assert.match(identity, /accepted_at timestamptz not null default timezone\('utc', now\(\)\)/);
  assert.doesNotMatch(identity.match(/create or replace function public\.handle_new_user\(\)[\s\S]+?\$\$;/)?.[0] ?? '', /coalesce\([^)]*agreed_at[^)]*now/);
});

test('DB-RELEASE-IDENTITY B migration: nickname·completion 삭제·guest import·course 저장 멱등 경계가 있다', () => {
  assert.match(identity, /char_length\(v_nickname\) not between 1 and 20/);
  assert.doesNotMatch(identity, /unique\s*\(nickname\)/i);
  assert.match(identity, /unique \(user_id, course_run_id\)/);
  assert.match(identity, /account_completion_tombstones/);
  assert.match(identity, /delete_all_account_course_completions/);
  assert.match(identity, /guest_completion_source_claims/);
  assert.match(identity, /already_acknowledged/);
  assert.match(identity, /create or replace function public\.create_course_plan/);
});

test('DB-DWELL-01 migration: 최소 payload·180일·동의 epoch·시간순·service cleanup을 고정한다', () => {
  for (const forbidden of ['arrived_at', 'departed_at', 'latitude', 'longitude', 'polyline', 'provider_url']) assert.doesNotMatch(dwellCode, new RegExp(forbidden, 'i'));
  assert.match(dwell, /interval '180 days'/);
  assert.match(dwell, /consent_epoch/);
  assert.match(dwell, /date_trunc\('minute',c\.completed_at\)=v_completed/);
  assert.match(dwell, /order by s\.completed_at asc,s\.completion_event_id asc/);
  assert.match(dwell, /public\.purge_expired_dwell_samples/);
  assert.match(dwell, /revoke execute on function public\.purge_expired_dwell_samples\(\) from authenticated/);
});
