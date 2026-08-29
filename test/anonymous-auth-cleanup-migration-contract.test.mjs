import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/202608270012_anonymous_auth_cleanup_contract.sql';
const migration = () => fs.readFileSync(migrationPath, 'utf-8');

test('DBPRIV1-01: anonymous Auth는 profile을 만들지 않고 30일 Auth inactivity 후보만 선택한다', () => {
  assert.ok(fs.existsSync(migrationPath), `missing ${migrationPath}`);
  const sql = migration();
  assert.match(sql, /if coalesce\(new\.is_anonymous, false\) then/);
  assert.match(sql, /create or replace function public\.list_anonymous_auth_cleanup_candidates/);
  assert.match(sql, /auth_user\.is_anonymous is true/);
  assert.match(sql, /coalesce\(auth_user\.last_sign_in_at, auth_user\.created_at\) <= p_inactive_before/);
  assert.match(sql, /p_inactive_before > v_now - interval '30 days'/);
});

test('DBPRIV1-02: linked data·identity 변경은 Admin delete 후보에서 제외되고 recheck한다', () => {
  const sql = migration();
  for (const table of ['profiles', 'courses', 'course_feedback', 'recommendation_events']) {
    assert.match(sql, new RegExp(`not exists \\(select 1 from public\\.${table}`));
  }
  assert.match(sql, /create or replace function public\.recheck_anonymous_auth_cleanup_candidate/);
  assert.match(sql, /and auth_user\.is_anonymous is true/);
  assert.doesNotMatch(sql, /delete from auth\.users/);
});

test('DBPRIV1-03: 한 날짜에는 server-only cleanup run 하나와 집계 audit만 남긴다', () => {
  const sql = migration();
  assert.match(sql, /create table public\.anonymous_auth_cleanup_run/);
  assert.match(sql, /run_date date primary key/);
  assert.match(sql, /create table public\.anonymous_auth_cleanup_audit/);
  assert.match(sql, /primary key \(run_date, outcome, reason_code\)/);
  assert.match(sql, /create or replace function public\.claim_anonymous_auth_cleanup_run/);
  assert.match(sql, /on conflict \(run_date\) do nothing/);
  assert.match(sql, /create or replace function public\.record_anonymous_auth_cleanup_audit/);
  assert.doesNotMatch(sql, /\b(ip_address|origin_lat|origin_lon|destination_lat|destination_lon|search_query|raw_response|api_key)\b/i);
});

test('DBPRIV1-04: anon/authenticated 직접 cleanup table/RPC 접근은 막는다', () => {
  const sql = migration();
  for (const table of ['anonymous_auth_cleanup_run', 'anonymous_auth_cleanup_audit']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
  }
  for (const rpc of ['claim_anonymous_auth_cleanup_run', 'list_anonymous_auth_cleanup_candidates', 'recheck_anonymous_auth_cleanup_candidate', 'record_anonymous_auth_cleanup_audit', 'complete_anonymous_auth_cleanup_run']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}`));
  }
});
