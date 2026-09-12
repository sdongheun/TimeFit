import assert from 'node:assert/strict';
import test from 'node:test';
import { screenRuntime } from './support/screenRuntime.mjs';

for (const remainingMin of [120, 180]) test(`QA-RELEASE-180 legacy account save preserves previous-day start (${remainingMin}min)`, async () => {
  const originalStart = new Date(2026, 8, 8, 23, 50);
  const savedAt = new Date(2026, 8, 9, 0, 5).getTime();
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [savedAt])); }
    static now() { return savedAt; }
  }
  const calls = [];
  const reads = [];
  const originalEnd = new Date(originalStart.getTime() + remainingMin * 60000).toISOString();
  const runtime = screenRuntime({
    __Date: FixedDate,
    './supabase': { supabase: {
      auth: { async getUser() { return { data: { user: { id: 'fixture-account', is_anonymous: false } }, error: null }; } },
      from(table) {
        assert.equal(table, 'courses');
        const query = { select() { return query; }, eq(key, value) { reads.push([key, value]); return query; },
          async maybeSingle() { return { data: { starts_at: originalStart.toISOString(), ends_at: originalEnd, recommendation_snapshot: { ctx: {} } }, error: null }; } };
        return query;
      },
      async rpc(name, args) { calls.push({ name, args }); return { data: [{ id: 'fixture-saved', created_at: new Date(savedAt).toISOString() }], error: null }; },
    } },
  });
  const { saveCourseToRepository } = runtime.load('src/services/courseRepository.ts');
  // Date-less legacy snapshot recovers authoritative server dates, not the save date.
  const saved = await saveCourseToRepository({ courseId: 'fixture-run', origin: { lat: 35, lon: 129 },
    ctx: { startMin: 23 * 60 + 50, remainingMin, mode: 'walk', modeLabel: '도보', appointment: null },
    course: { spots: [{ contentId: 'fixture-place', title: 'fixture', category: '문화시설', lat: 35, lon: 129, dwell: 20, dwellSrc: 'fixture' }], legs: [{ label: '도보', min: 10 }, { label: '체류', min: 20 }, { label: '도보', min: 10 }], bufferLeftMin: 10 },
  });
  assert.equal(calls.length, 1, 'must exercise actual account RPC payload, not guest fallback');
  assert.equal(calls[0].name, 'create_course_plan');
  assert.ok(reads.some(([key, value]) => key === 'id' && value === 'fixture-run'));
  assert.deepEqual([calls[0].args.p_starts_at, calls[0].args.p_ends_at],
    [originalStart.toISOString(), new Date(originalStart.getTime() + remainingMin * 60000).toISOString()]);
  assert.equal(saved.ctx.startedAtIso, originalStart.toISOString());
  assert.equal(saved.ctx.endsAtIso, originalEnd);
  assert.deepEqual(calls[0].args.p_recommendation_snapshot.ctx, saved.ctx);
});

for (const remainingMin of [120, 180]) test(`QA-RELEASE-180 date-less input explicitly rejects without local success (${remainingMin}min)`, async () => {
  for (const account of [true, false]) {
    const calls = [];
    const runtime = screenRuntime({ './supabase': { supabase: {
      auth: { async getUser() { return { data: { user: account ? { id: 'fixture-account', is_anonymous: false } : null }, error: null }; } },
      async rpc(...args) { calls.push(args); throw new Error('unexpected write'); },
    } } });
    const { saveCourseToRepository, isCourseDateError } = runtime.load('src/services/courseRepository.ts');
    await assert.rejects(saveCourseToRepository({ origin: { lat: 35, lon: 129 },
      ctx: { startMin: 1430, remainingMin, mode: 'walk', modeLabel: '도보', appointment: null },
      course: { spots: [], legs: [], bufferLeftMin: 10 },
    }), error => isCourseDateError(error) && error.code === 'course_date_missing');
    assert.equal(calls.length, 0);
  }
});
