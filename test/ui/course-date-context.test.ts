import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanCtx } from '../../src/ui/nav';
import { preserveCourseDateContext } from '../../src/ui/courseDateContext';

test('UCOURSEDATE original date/issue survives replan minute changes and serialized save request', () => {
  for (const remainingMin of [120, 180]) for (const startedAtIso of ['2026-09-08T23:50:00+09:00', '2026-12-31T14:50:00.000Z', '', 'invalid']) {
    for (const courseDateIssue of [undefined, 'missing', 'invalid', 'conflict'] as const) {
      const ctx: PlanCtx = { startedAtIso, courseDateIssue, startMin: 1430, remainingMin, mode: 'walk', modeLabel: '도보', appointment: null };
      const next = preserveCourseDateContext(ctx, { startMin: 5, remainingMin: remainingMin - 15, isManualTime: false });
      assert.equal(next.startedAtIso, startedAtIso);
      assert.equal(next.courseDateIssue, courseDateIssue);
      assert.equal(next.startMin, 5);
      assert.equal(next.remainingMin, remainingMin - 15);
      const savedRequest = JSON.parse(JSON.stringify({ ctx: next }));
      assert.equal(savedRequest.ctx.startedAtIso, startedAtIso);
      assert.equal(savedRequest.ctx.courseDateIssue, courseDateIssue);
      assert.equal(ctx.startMin, 1430);
    }
  }
});

test('UCOURSEDATE missing date is not inferred from now/startMin; no reset of supplied issue', () => {
  const ctx: PlanCtx = { startMin: 1430, remainingMin: 120, mode: 'walk', modeLabel: '도보', appointment: null, courseDateIssue: 'missing' };
  const next = preserveCourseDateContext(ctx, { startMin: 5 });
  assert.equal(next.startedAtIso, undefined);
  assert.equal(next.courseDateIssue, 'missing');
});
