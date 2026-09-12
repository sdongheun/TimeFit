import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createHistorySwipeMotion, HISTORY_REVEAL_WIDTH } from '../../src/ui/historySwipeMotion';
import { historyCategories, filterHistory } from '../../src/ui/historyCategoryFilter';
test('grant excludes pre-responder distance and reversal at clamp responds immediately', () => {
  let value = 0;
  const motion = createHistorySwipeMotion({ stop: cb => cb(value), write: n => { value = n; }, animate() {}, settled() {} });
  motion.grant(-15); motion.move(-16);
  assert.equal(value, -1, 'threshold movement must not become a first-frame jump');
  motion.move(-120); assert.equal(value, -72);
  motion.move(-119); assert.equal(value, -71, 'reverse without paying back clamped overshoot');
  motion.move(50); assert.equal(value, 0);
  motion.move(49); assert.equal(value, -1);
});
test('history motion uses sampled position with deferred stop, settle regrab, stale completion and cancellation', () => {
  let value = 0, stop: (n: number) => void = () => {}, finish: () => void = () => {};
  const targets: number[] = [];
  const motion = createHistorySwipeMotion({ stop: cb => { stop = cb; }, write: n => { value = n; }, animate: (target, done) => { targets.push(target); finish = () => { value = target; done(); }; }, settled() {} });
  motion.grant(); motion.move(-30); stop(0); assert.equal(value, -30);
  motion.release(); assert.equal(value, -30, 'release must animate, not jump');
  value = -40; const oldFinish = finish;
  motion.grant(); motion.move(8); stop(-40); assert.equal(value, -32);
  motion.move(-10); assert.equal(value, -50);
  motion.release(); assert.equal(targets.at(-1), -HISTORY_REVEAL_WIDTH);
  motion.sync(false, true); const lateStop = stop; lateStop(-35); motion.move(-20);
  assert.equal(targets.at(-1), 0);
  motion.dispose(); oldFinish();
});
test('history filters are stable, whole-completion based and tolerate unknown categories', () => {
  const rows = [{ id: 'pair', provenance: 'guest_import', learningEligible: false, places: [{ category: '카페' }, { category: '문화시설' }] }, { id: 'unknown', pending: true, learningEligible: false, places: [{ category: '' }] }];
  assert.deepEqual(historyCategories(rows), ['문화시설', '카페', '기타']);
  assert.deepEqual(filterHistory(rows, '문화시설'), [rows[0]]);
  assert.deepEqual(filterHistory(rows, null), rows);
  assert.equal(filterHistory(rows, '기타')[0], rows[1]);
  assert.equal(filterHistory(rows, '문화시설')[0].learningEligible, false);
});
test('card geometry matches statistics, reveal includes gap and header/filter remain small-screen flexible', () => {
  const row = fs.readFileSync('src/ui/HistorySwipeRow.tsx', 'utf8');
  const panel = fs.readFileSync('src/ui/AccountRecordsPanel.tsx', 'utf8');
  assert.match(row, /borderWidth: 1, borderColor: C.line, borderRadius: 14/);
  assert.match(row, /width: HISTORY_DELETE_WIDTH, borderRadius: 14/);
  assert.equal(HISTORY_REVEAL_WIDTH, 72);
  assert.match(panel, /flex: 1, minWidth: 0/);
  assert.match(panel, /ScrollView horizontal/);
  assert.match(panel, /minHeight: 44/);
  assert.equal((panel.match(/왼쪽으로 밀어 삭제/g) ?? []).length, 0);
});
test('history move no longer schedules a React offset render per frame', () => {
  assert.doesNotMatch(fs.readFileSync('src/ui/HistorySwipeRow.tsx', 'utf8'), /setOffset/);
});
