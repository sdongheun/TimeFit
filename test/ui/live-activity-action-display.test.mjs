import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Live Activity 공용 버튼: 재알림 진입을 제거하고 도착·출발·최종 완료를 유지한다', () => {
  const source = readFileSync(new URL('../../plugins/live-activity/TimeFitLiveActivityExtension.swift', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Button\(intent: TimeFitSnoozeIntent/);
  assert.doesNotMatch(source, /Text\("5분 뒤"\)/);
  for (const intent of ['Arrival', 'Departure', 'Completion']) {
    assert.match(source, new RegExp(`Button\\(intent: TimeFit${intent}Intent`));
  }
  assert.equal((source.match(/TimeFitLiveActions\(context: context\)/g) ?? []).length, 2);
  const notifications = readFileSync(new URL('../../src/ui/liveActivity/courseProgressNotifications.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(notifications, /buttonTitle: '5분 뒤'/);
  assert.match(notifications, /buttonTitle: '도착했어요'/);
});
