import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmFixture, course, session, settle } from './fixtures/currentConfirm.mjs';

// Valid manual proof must not bypass a deadline elapsed while review was open.
for (const remainingMin of [120, 180]) for (const boundary of ['before', 'at', 'after']) test(`QA-LEGACY-REMOVE-VERIFY-01: current review ${remainingMin} midnight deadline/${boundary}`, async () => {
  const selected = { ...session, nowIso: '2026-12-31T14:50:00.000Z', remainingMin };
  let now = Date.parse(selected.nowIso) + 60000;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const snapshot = course(['A']);
  snapshot.stops[0].arrivalAt = new Date(Date.parse(selected.nowIso) + 5 * 60000).toISOString();
  snapshot.stops[0].departureAt = new Date(Date.parse(selected.nowIso) + 25 * 60000).toISOString();
  snapshot.remainingAfterCourseMin = remainingMin - snapshot.travelMin - snapshot.stayMin;
  snapshot.remainingAfterArrivalBufferMin = remainingMin - snapshot.totalMin;
  const f = confirmFixture(snapshot, { __Date: Clock }, selected);
  try {
    const start = f.screen.get('verified-course-start').props.onPress;
    assert.equal(f.flow.activeVerifiedCourse, null);
    if (boundary !== 'before') now = Date.parse(selected.nowIso) + remainingMin * 60000 + (boundary === 'after' ? 1 : 0);
    start(); await settle();
    assert.equal(f.calls.filter(c => c === 'start').length, boundary === 'before' ? 1 : 0, 'expired review must not start a new active run');
    if (boundary === 'before') assert.equal(f.flow.activeVerifiedCourse.course, snapshot);
    else assert.equal(f.flow.activeVerifiedCourse, null);
    assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === 'route').length, 0);
  } finally { f.screen.unmount(); }
});
