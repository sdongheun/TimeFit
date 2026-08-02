import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function loadReplanLogic() {
  const source = fs.readFileSync('src/ui/replanLogic.ts', 'utf-8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(compiled)}`);
}

const { parseClockMinute, resolveReplanTiming } = await loadReplanLogic();

test('재검색 현재 시간 입력은 종료 시각에서 남은 시간을 계산한다', () => {
  const timing = resolveReplanTiming({
    timeText: '14:40',
    endMin: 16 * 60,
    currentMin: 22 * 60,
    ctxDayType: '주말',
    ctxHourBucket: '오후',
    ctxIsManualTime: true,
    realDayType: '평일',
    realHourBucket: '야간',
  });

  assert.equal(timing.ok, true);
  assert.equal(timing.nowMin, 14 * 60 + 40);
  assert.equal(timing.remainingMin, 80);
  assert.equal(timing.dayType, '주말');
  assert.equal(timing.hourBucket, '오후');
  assert.equal(timing.isManualTime, true);
});

test('재검색 현재 시간 입력이 없으면 실제 현재 시간 기준으로 계산한다', () => {
  const timing = resolveReplanTiming({
    timeText: '',
    endMin: 16 * 60,
    currentMin: 15 * 60 + 10,
    realDayType: '평일',
    realHourBucket: '오후',
  });

  assert.equal(timing.ok, true);
  assert.equal(timing.nowMin, 15 * 60 + 10);
  assert.equal(timing.remainingMin, 50);
  assert.equal(timing.dayType, '평일');
  assert.equal(timing.hourBucket, '오후');
  assert.equal(timing.isManualTime, false);
});

test('재검색 현재 시간은 HH:MM 또는 HH 형식만 허용한다', () => {
  assert.equal(parseClockMinute('9'), 9 * 60);
  assert.equal(parseClockMinute('09:30'), 9 * 60 + 30);
  assert.equal(parseClockMinute('24:00'), null);
  assert.equal(parseClockMinute('12:99'), null);
  assert.equal(parseClockMinute('abc'), null);
});

test('재검색 남은 시간이 너무 짧거나 길면 실패한다', () => {
  const tooShort = resolveReplanTiming({
    timeText: '15:40',
    endMin: 16 * 60,
    currentMin: 0,
    realDayType: '평일',
    realHourBucket: '오후',
  });
  assert.equal(tooShort.ok, false);
  assert.match(tooShort.error, /30분 미만/);

  const tooLong = resolveReplanTiming({
    timeText: '09:00',
    endMin: 14 * 60,
    currentMin: 0,
    realDayType: '평일',
    realHourBucket: '아침',
  });
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error, /최대 240분/);
});
