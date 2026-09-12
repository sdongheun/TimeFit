import assert from 'node:assert/strict';
import test from 'node:test';
import { courseReplanTiming } from '../../src/ui/courseDateContext';

test('repeat replan uses original end, never original start + reduced remainingMin', () => {
  const ctx = { startMin: 5, startedAtIso: '2026-12-31T14:50:00.000Z', endsAtIso: '2026-12-31T17:50:00.000Z', remainingMin: 30, mode: 'walk' as const, modeLabel: '도보', appointment: null };
  assert.deepEqual(courseReplanTiming(ctx, Date.parse('2026-12-31T16:00:00Z')), { kind: 'ready', remainingMin: 110 });
  assert.deepEqual(courseReplanTiming(ctx, Date.parse(ctx.endsAtIso)), { kind: 'expired' });
  assert.deepEqual(courseReplanTiming({ ...ctx, endsAtIso: undefined }, Date.parse(ctx.startedAtIso)), { kind: 'unavailable' });
  assert.deepEqual(courseReplanTiming({ ...ctx, courseDateIssue: 'conflict' }, Date.parse(ctx.startedAtIso)), { kind: 'unavailable' });
});
