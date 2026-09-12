import test from 'node:test';
import assert from 'node:assert/strict';
import { screenRuntime } from './ui/support/screenRuntime.mjs';

// Synthetic historical coordinates deliberately have no acquisition provenance.
const origin = { lat: 35.12, lon: 129.02 };
const ctx = { startedAtIso: '2026-09-09T01:00:00Z', endsAtIso: '2026-09-09T03:00:00Z', startMin: 600, remainingMin: 120, mode: 'walk', appointment: null };
const course = { spots: [{ contentId: 'fixture-place', title: 'fixture', category: '문화시설', lat: 35.13, lon: 129.03, dwell: 20, dwellSrc: 'fixture' }], legs: [{ label: '도보', min: 10 }, { label: '체류', min: 20 }, { label: '도보', min: 10 }], bufferLeftMin: 10 };
function fixture() {
  const row = { id: 'fixture-course', status: 'saved', origin_lat: origin.lat, origin_lon: origin.lon, destination_label: null, starts_at: ctx.startedAtIso, ends_at: ctx.endsAtIso, mode: 'walk', created_at: ctx.startedAtIso, recommendation_snapshot: { course, ctx } };
  const before = JSON.stringify(row), calls = [];
  const supabase = {
    auth: { async getUser() { return { data: { user: { id: 'fixture-owner', is_anonymous: false } }, error: null }; } },
    from(table) {
      const q = { select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; },
        async maybeSingle() { return { data: row, error: null }; },
        then(resolve, reject) { return Promise.resolve({ data: table === 'courses' ? [row] : [], error: null }).then(resolve, reject); } };
      return q;
    },
    async rpc(name, args) { calls.push({ name, args }); return { data: [{ id: row.id, created_at: row.created_at }], error: null }; },
  };
  return { ...screenRuntime({ './supabase': { supabase } }).load('src/services/courseRepository.ts'), row, before, calls };
}

test('manual-location audit: historical origin is preserved on read; listing alone issues no write RPC', async () => {
  const f = fixture();
  const records = await f.listSavedCoursesFromRepository();
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].origin, origin);
  assert.equal(JSON.stringify(f.row), f.before);
  assert.equal(f.calls.length, 0);
  assert.equal('originSource' in records[0], false);
});

test('manual-location audit: explicit legacy replace forwards supplied historical or manually selected origin unchanged', async () => {
  for (const selected of [origin, { lat: 35.15, lon: 129.05 }]) {
    const f = fixture();
    const [stored] = await f.listSavedCoursesFromRepository();
    await f.replaceCoursePlanInRepository(stored.id, { ...stored, course, origin: selected });
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].name, 'replace_course_plan');
    assert.deepEqual([f.calls[0].args.p_origin_lat, f.calls[0].args.p_origin_lon], [selected.lat, selected.lon]);
    assert.equal(JSON.stringify(f.row), f.before);
  }
});
