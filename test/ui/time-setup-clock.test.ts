import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTimeSetupClock, suggestedEndForTestClock } from '../../src/ui/timeSetup/testClock';

const real = { nowMin: 9 * 60 + 15, dayType: '평일' as const, hourBucket: '아침' as const };

test('개발 테스트 시각은 실제 날짜 유형을 유지하면서 추천·운영시간 판정 시각만 대체한다', () => {
  const clock = resolveTimeSetupClock(real, 21 * 60 + 35);

  assert.deepEqual(clock, { nowMin: 21 * 60 + 35, dayType: '평일', hourBucket: '야간' });
  assert.deepEqual(resolveTimeSetupClock(real, null), real);
});

test('테스트 시각을 바꾸면 종료 시각은 최대 2시간 뒤로 재설정하고 자정을 넘기지 않는다', () => {
  assert.equal(suggestedEndForTestClock(14 * 60 + 20), 16 * 60 + 20);
  assert.equal(suggestedEndForTestClock(23 * 60 + 30), 23 * 60 + 59);
});
