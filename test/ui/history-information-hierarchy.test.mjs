import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('기록 화면은 짧은 제목과 한 번만 읽히는 요약 문구를 사용한다', () => {
  const screen = fs.readFileSync('src/ui/ActivityRecordScreen.tsx', 'utf8');
  const statistics = fs.readFileSync('src/ui/activity/ActivityStatistics.tsx', 'utf8');

  assert.match(screen, /function compactRecordTitle/);
  assert.match(screen, /다녀온 장소와 코스를 한눈에 확인해 보세요/);
  assert.doesNotMatch(screen, /계정에 저장된 방문 기록을 모아봤어요/);
  assert.match(statistics, /총 .*번 방문했어요/);
  assert.doesNotMatch(statistics, /기록 구성/);
  const records = fs.readFileSync('src/ui/AccountRecordsPanel.tsx', 'utf8');
  assert.doesNotMatch(records, /function recordMeta|곳 방문.*측정/);
});
