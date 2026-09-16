import test from 'node:test';
import assert from 'node:assert/strict';
import { screenRuntime } from './support/screenRuntime.mjs';

test('기록 빈 상태는 한 가지 코스 생성 행동을 제공한다', () => {
  let starts = 0;
  const runtime = screenRuntime({
    './theme': { C: { accent: '#0A84FF', panel: '#202126', txt: '#FFFFFF', muted: '#8E8E93', onAccent: '#FFFFFF' } },
  });
  const { RecordEmptyState } = runtime.load('src/ui/RecordEmptyState.tsx');
  const screen = runtime.mount(RecordEmptyState, { onCreateCourse: () => { starts++; } });
  assert.match(JSON.stringify(screen.get('record-empty-state')), /아직 방문 기록이 없어요/);
  assert.match(JSON.stringify(screen.get('record-empty-state')), /다녀온 장소와 활동 기록/);
  screen.press('record-empty-create-course');
  assert.equal(starts, 1);
});
