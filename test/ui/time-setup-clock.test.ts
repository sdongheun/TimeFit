import assert from 'node:assert/strict';
import test from 'node:test';
import { clampReleasePresetMinutes, releaseTimeSetupValidation } from '../../src/ui/timeSetup/releaseTimeBoundary';
import { resolveTimeSetupClock, suggestedEndForTestClock } from '../../src/ui/timeSetup/testClock';

const real = { nowMin: 9 * 60 + 15, dayType: '평일' as const, hourBucket: '아침' as const };

test('개발 테스트 시각은 실제 날짜 유형을 유지하면서 추천·운영시간 판정 시각만 대체한다', () => {
  const clock = resolveTimeSetupClock(real, 21 * 60 + 35);

  assert.deepEqual(clock, { nowMin: 21 * 60 + 35, dayType: '평일', hourBucket: '야간' });
  assert.deepEqual(resolveTimeSetupClock(real, null), real);
});

test('URELEASE180: preset 120 유지, 최대 180분과 익일 기본값', () => {
  assert.equal(suggestedEndForTestClock(14 * 60 + 20), 17 * 60 + 20);
  assert.equal(suggestedEndForTestClock(23 * 60 + 30), 26 * 60 + 30);
  assert.equal(clampReleasePresetMinutes(120), 120);
  assert.equal(clampReleasePresetMinutes(180), 180);
  assert.equal(clampReleasePresetMinutes(181), 180);
});

test('URELEASE180: 120·121·180분은 허용하고 181분·0분은 builder 전 차단한다', () => {
  assert.equal(releaseTimeSetupValidation(true, 120), '');
  assert.equal(releaseTimeSetupValidation(true, 121), '');
  assert.equal(releaseTimeSetupValidation(true, 180), '');
  assert.match(releaseTimeSetupValidation(true, 181), /최대 3시간/);
  assert.match(releaseTimeSetupValidation(true, 0), /현재 시각 뒤/);
  assert.match(releaseTimeSetupValidation(false, 120), /출발 위치/);
});
