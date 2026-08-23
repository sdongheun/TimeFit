import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyHoursText } from '../scripts/lib/openingHoursAudit.mjs';

test('운영시간 감사는 실제 시간 범위와 모호한 안내를 구분한다', () => {
  assert.equal(classifyHoursText('매일 10:00~20:00').status, 'structured');
  assert.equal(classifyHoursText('매일 09:00~21:00(가게별 상이)').status, 'conditional');
  assert.equal(classifyHoursText('상시(가게별 상이)').status, 'ambiguous');
  assert.equal(classifyHoursText('매일').status, 'ambiguous');
  assert.equal(classifyHoursText('').status, 'missing');
});

test('운영시간 감사는 자정 종료 시간을 구조화된 시간으로 인정한다', () => {
  const result = classifyHoursText('매일 19:30-24:00');
  assert.equal(result.status, 'structured');
  assert.equal(result.hasTimeRange, true);
});
