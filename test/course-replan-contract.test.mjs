import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync('supabase/migrations/202608150009_replace_course_plan.sql', 'utf-8');
const execution = fs.readFileSync('src/ui/CourseConfirmScreen.tsx', 'utf-8');

test('코스 변경은 최초 시작·약속 도착 시각을 바꾸지 않고 마지막 재계산 시각만 기록한다', () => {
  assert.match(migration, /create or replace function public\.replace_course_plan/);
  assert.match(migration, /last_recalculated_at = timezone\('utc', now\(\)\)/);
  assert.doesNotMatch(migration, /starts_at\s*=/);
  assert.doesNotMatch(migration, /ends_at\s*=/);
});

test('코스 변경은 같은 코스 ID의 장소·구간을 원자적으로 교체한다', () => {
  assert.match(migration, /delete from public\.course_stops where course_id = p_course_id/);
  assert.match(migration, /delete from public\.course_legs where course_id = p_course_id/);
  assert.match(migration, /insert into public\.course_stops/);
  assert.match(migration, /insert into public\.course_legs/);
});

test('수동 위치 출시: 현재 확인도 GPS 재추천 없이 증명 없는 복원을 수동 입력 게이트로 보낸다', () => {
  assert.doesNotMatch(execution, /expo-location|Location\.getCurrentPositionAsync|planTimeFit|getActualRouteBaselines/);
  assert.match(execution, /if \(!hasManualLocationProof\(session\)\) return <ManualLocationRestoreGate/);
  assert.match(execution, /endsAtMs=\{Date.parse\(session.nowIso\)\+session.remainingMin\*60000\}/);
  assert.match(execution, /if \(!next\) return false/);
  assert.doesNotMatch(execution, /navigate\('LegacyResults'/);
});
