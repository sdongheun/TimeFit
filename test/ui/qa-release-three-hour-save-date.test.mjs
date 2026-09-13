import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import 'tsx/cjs';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';
const require = createRequire(import.meta.url);
const { buildCompleteCourseInput } = require('../../src/ui/courseCompletionUiModel.ts');
const { createCourseCompletionRepository } = require('../../src/services/courseCompletionRepository.ts');
const { buildVerifiedCourseProgressSteps } = require('../../src/ui/recommendation/verifiedCourseProgressModel.ts');
const { buildLiveCoursePlan } = require('../../src/ui/liveActivity/courseProgressRuntimeModel.ts');
const resolve = id => ({ id, contentId: id, label: id, title: id, category: '문화시설', lat: 35.13, lon: 129.13 });

for (const remainingMin of [120, 180]) test(`QA-RELEASE-180 current snapshot and completion preserve previous-day start (${remainingMin}min)`, async () => {
  const selected = { ...session, nowIso: '2026-12-31T14:50:00.000Z', remainingMin };
  const originalEnd = Date.parse(selected.nowIso) + remainingMin * 60000;
  const completedAt = Date.parse('2026-12-31T15:35:00.000Z'); // KST Jan 1 00:35
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-12-31T15:05:00.000Z'])); }
    static now() { return Date.parse('2026-12-31T15:05:00.000Z'); }
  }
  const value = course(['A']);
  value.stops[0].arrivalAt = '2026-12-31T14:55:00.000Z';
  value.stops[0].departureAt = '2026-12-31T15:15:00.000Z';
  value.remainingAfterCourseMin = remainingMin - value.travelMin - value.stayMin;
  value.remainingAfterArrivalBufferMin = remainingMin - value.totalMin;
  const f = confirmFixture(value, { __Date: Clock }, selected);
  try {
    assert.match(JSON.stringify(f.screen.get('course-deadline')), /1\/1/);
    f.screen.press('verified-course-start'); await settle();
    const active = f.flow.activeVerifiedCourse;
    assert.ok(active); assert.equal(active.session.nowIso, selected.nowIso);
    assert.equal(active.session.remainingMin, remainingMin);
    const steps = buildVerifiedCourseProgressSteps(value, selected.origin, selected.destination, resolve);
    const plan = buildLiveCoursePlan(active, steps);
    assert.equal(plan.status, 'ready');
    assert.equal(plan.snapshot.finalArrivalAtMs, originalEnd);
    const projection = buildCompleteCourseInput(active, resolve, completedAt);
    assert.equal(projection.status, 'ready');
    const data = new Map(); let writes = 0;
    const repo = createCourseCompletionRepository({
      async getItem(key) { return data.get(key) ?? null; },
      async setItem(key, raw) { writes++; data.set(key, raw); },
      async removeItem() { assert.fail('no cleanup expected'); },
    }, { createCompletionId: () => 'fixture-completion' });
    assert.equal((await repo.complete(projection.input)).status, 'created');
    const saved = await repo.read();
    assert.equal(saved.status, 'ok'); assert.equal(saved.records.length, 1);
    assert.equal(saved.records[0].completedAt, completedAt);
    assert.equal(saved.records[0].courseRunId, active.courseRunId);
    assert.equal(writes, 1);
    assert.equal(active.session.nowIso, '2026-12-31T14:50:00.000Z');
    assert.equal(buildLiveCoursePlan(active, steps).snapshot.finalArrivalAtMs, originalEnd);
    assert.equal((await repo.complete(projection.input)).status, 'already_completed');
    assert.equal((await repo.read()).records[0].completedAt, completedAt);
  } finally { f.screen.unmount(); }
});

for (const remainingMin of [120, 180]) test(`QA-RELEASE-180 current date-less review explicitly rejects (${remainingMin}min)`, async () => {
  for (const nowIso of [undefined, '']) {
    const writes = [];
    const f = confirmFixture(course(['A']), {
      './courseCompletionComposition': { courseCompletionRepository: { async complete(input) { writes.push(input); return { status: 'storage_unavailable' }; } } },
    }, { ...session, nowIso, remainingMin });
    try {
      f.screen.press('verified-course-start'); await settle();
      assert.equal(f.flow.activeVerifiedCourse, null);
      assert.equal(f.calls.filter(c => c === 'start').length, 0);
      assert.deepEqual(writes, []);
      assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === 'route').length, 0);
    } finally { f.screen.unmount(); }
  }
});
