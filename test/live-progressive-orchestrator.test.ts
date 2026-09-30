import assert from 'node:assert/strict';
import test from 'node:test';
import { beginLiveProgressive, planLiveDetailBatch, acceptLiveDetailBatch as acceptBoundBatch, releaseResultSufficiency, type LiveOpeningGate } from '../src/engine/liveProgressiveOrchestrator';
import { buildReleaseOneStopRepresentativeCourseV1 } from '../src/engine/courseV1';
import type { LocalLivePlaceProjection } from '../src/engine/liveCandidateSnapshot';
import type { TourLiveCatalogResult, TourLiveDetailBatchResult } from '../src/services/tourApiLiveAdapter';

function setup(n = 40) {
  const locals: LocalLivePlaceProjection[] = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, order: i,
    mapping: { status: 'exact', tourapiContentId: String(i + 100), contentTypeId: '12' },
    facts: { title: `공원${i}`, lat: 36, lon: 130, opening: {} }, aliases: [],
    policy: { category: '자연', subCategory: '공원', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, classification: 'representative_standard' },
    relations: { mergedPlaceIds: [] }, photoRights: [],
  }));
  const catalog: TourLiveCatalogResult = { kind: 'catalog', status: 'ready', budgetToken: 'fixture-token', snapshot: { liveSourceSnapshotId: 's1', fetchedAt: '2026-09-21T01:00:00Z', unreviewedCount: 0,
    catalogPlaces: locals.map((l, i) => ({ contentId: l.mapping!.tourapiContentId, contentTypeId: '12', title: l.facts.title, lat: 35.1 + i * 0.001, lon: 129.1 })),
    candidateStates: locals.map(l => ({ contentId: l.mapping!.tourapiContentId, contentTypeId: '12', state: 'active_catalog' })),
  } };
  const origin = { id: 'manual-origin', lat: 35.1, lon: 129.1 };
  return { locals, catalog, origin, state: beginLiveProgressive({ local: locals, catalog, origin, destination: null }) };
}
const opening = () => ({ status: 'structured' as const, alwaysAccessible: true, dayTypes: ['weekday' as const, 'weekend' as const], windows: [] });
function acceptLiveDetailBatch(state: ReturnType<typeof beginLiveProgressive>, result: TourLiveDetailBatchResult, gate: LiveOpeningGate) {
  return acceptBoundBatch(state, result, gate, { liveSourceSnapshotId: state.snapshotId!, candidates: state.pending ?? (result.status === 'unavailable' ? [] : result.candidateStates) });
}
function response(state: ReturnType<typeof beginLiveProgressive>, failed = 0): TourLiveDetailBatchResult {
  const refs = state.pending!;
  const used = state.requested.length;
  return { kind: 'detail_batch', status: failed ? 'partial' : 'ready', liveSourceSnapshotId: 's1', budgetToken: 'not-in-planner', failures: [],
    budget: { detailIntroUsed: used, detailIntroRemaining: 30 - used, nextBatchMax: Math.min(6, 30 - used) as 0 | 6, detailCommonRemaining: 4, detailImageRemaining: 1 },
    candidateStates: refs.map((r, i) => ({ ...r, state: i < failed ? 'active_detail_failed' : 'active_ready' })),
    details: refs.slice(failed).map(r => ({ ...r, opening: { rawText: '24시간' } })),
  };
}
test('live coordinates change first batch membership; local coordinate/order cannot pre-cut 18', () => {
  const f = setup();
  const moved = { ...f.catalog, snapshot: { ...f.catalog.snapshot, catalogPlaces: f.catalog.snapshot.catalogPlaces.map((p, i) => ({ ...p, lat: i === 39 ? 35.1 : i === 0 ? 37 : p.lat })) } };
  const s = beginLiveProgressive({ ...f, local: [...f.locals].reverse(), catalog: moved, destination: null });
  const p = planLiveDetailBatch(s, 'insufficient');
  assert.equal(s.queue.length, 40);
  assert.ok(p.batch!.candidates.some(r => r.contentId === '139'));
  assert.ok(!p.batch!.candidates.some(r => r.contentId === '100'));
  assert.doesNotMatch(JSON.stringify(p.batch), /lat|lon|manual-origin|fixture-token/);
});
test('initial12 stops early; 12+6 only after insufficient; pending/replay are zero new reservations', () => {
  const first = planLiveDetailBatch(setup().state, 'insufficient');
  assert.equal(first.batch!.candidates.length, 12);
  assert.equal(planLiveDetailBatch(first.state, 'insufficient').batch, undefined);
  const result = response(first.state, 4);
  const done = acceptLiveDetailBatch(first.state, result, opening);
  assert.equal(done.state.routeCandidates.length, 8);
  assert.equal(planLiveDetailBatch(done.state, 'sufficient').reason, 'sufficient');
  assert.deepEqual(acceptLiveDetailBatch(done.state, result, opening).state, done.state);
  const next = planLiveDetailBatch(done.state, 'insufficient');
  assert.equal(next.batch!.candidates.length, 6);
  assert.equal(next.state.requested.length, 18);
});
test('30 hard cap and route18 cap; rejected opening/detail failures never route', () => {
  let state = setup().state;
  for (const count of [12, 6, 6, 6]) {
    const plan = planLiveDetailBatch(state, 'insufficient');
    assert.equal(plan.batch!.candidates.length, count);
    state = acceptLiveDetailBatch(plan.state, response(plan.state), opening).state;
  }
  assert.equal(state.requested.length, 30);
  assert.equal(state.routeCandidates.length, 18);
  assert.equal(planLiveDetailBatch(state, 'insufficient').reason, 'detail_cap');
  assert.equal(planLiveDetailBatch(state, 'insufficient').nextAction, 'empty_or_edit_inputs');
  const first = planLiveDetailBatch(setup().state, 'insufficient');
  assert.equal(acceptLiveDetailBatch(first.state, response(first.state), () => null).state.routeCandidates.length, 0);
});
test('different snapshot cannot merge, response order stable, route budget/no evaluation stops requests', () => {
  const plan = planLiveDetailBatch(setup().state, 'insufficient');
  const res = response(plan.state);
  if (res.status === 'unavailable') return;
  assert.equal(acceptLiveDetailBatch(plan.state, { ...res, liveSourceSnapshotId: 'other' }, opening).reason, 'snapshot_mismatch');
  assert.deepEqual(acceptLiveDetailBatch(plan.state, res, opening).state, acceptLiveDetailBatch(plan.state, { ...res, details: [...res.details].reverse(), candidateStates: [...res.candidateStates].reverse() }, opening).state);
  assert.equal(planLiveDetailBatch(setup().state, 'not_evaluated').batch, undefined);
  assert.equal(planLiveDetailBatch(setup().state, 'route_budget_exhausted').batch, undefined);
});
test('catalog unavailable is fail-closed and CourseV1 sufficiency does not invent new target', () => {
  const f = setup();
  const state = beginLiveProgressive({ ...f, local: f.locals, catalog: { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'network', status: null } }, destination: null });
  assert.equal(planLiveDetailBatch(state, 'insufficient').reason, 'unavailable');
  assert.equal(releaseResultSufficiency({ resultState: 'verified', representativeCourse: { id: 'a' }, alternativeCourses: [{ id: 'b' }, { id: 'c' }, { id: 'd' }] }), 'sufficient');
  assert.equal(releaseResultSufficiency({ resultState: 'verified', representativeCourse: { id: 'a' }, alternativeCourses: [{ id: 'b' }] }), 'insufficient');
});

test('late unavailable from settled reservation cannot terminate the next pending batch', () => {
  const first = planLiveDetailBatch(setup().state, 'insufficient');
  const done = acceptBoundBatch(first.state, response(first.state), opening, first.batch!).state;
  const next = planLiveDetailBatch(done, 'insufficient');
  const late = acceptBoundBatch(next.state, { status: 'unavailable', reason: { operation: 'detailIntro2', code: 'timeout', status: null } }, opening, first.batch!);
  assert.equal(late.reason, 'duplicate_or_stale');
  assert.equal(late.state, next.state);
});

test('CourseV1 connected via pure provider keeps first route8 and one-stop result target', async () => {
  const p = planLiveDetailBatch(setup().state, 'insufficient');
  const state = acceptLiveDetailBatch(p.state, response(p.state), opening).state;
  let calls = 0;
  const result = await buildReleaseOneStopRepresentativeCourseV1({ now: new Date('2026-09-21T01:00:00Z'), remainingMin: 180, arrivalBufferMin: 10,
    origin: { id: 'o', lat: 35.1, lon: 129.1 }, destination: null, provider: { listRepresentativeCandidates: () => state.routeCandidates },
    routes: { getRoute: async () => { throw new Error('legacy route forbidden'); } },
    receiptRoutes: { getRouteReceipt: async () => { calls++; return { result: 'exact', route: { exact: true, mode: 'walk', min: 5 }, newProviderAttemptCount: 1, reused: false }; } },
  });
  assert.equal(calls, 8);
  assert.equal(releaseResultSufficiency(result), 'sufficient');
  assert.ok([result.representativeCourse!, ...result.alternativeCourses].every(c => c.placeIds.length === 1));
});

test('catalog exclusions and queue order are stable across shuffled local/API input', () => {
  const f = setup(8);
  const catalog = { ...f.catalog, snapshot: { ...f.catalog.snapshot,
    candidateStates: f.catalog.snapshot.candidateStates.map((c, i) => ({ ...c, state: i === 0 ? 'inactive' as const : i === 1 ? 'identity_conflict' as const : c.state })),
    catalogPlaces: f.catalog.snapshot.catalogPlaces.filter((_, i) => i > 1).map((c, i) => i === 0 ? { ...c, title: '미등록 이름', lat: 34 } : c),
  } };
  const a = beginLiveProgressive({ local: f.locals, catalog, origin: f.origin, destination: null });
  const b = beginLiveProgressive({ local: [...f.locals].reverse(), catalog: { ...catalog, snapshot: { ...catalog.snapshot, candidateStates: [...catalog.snapshot.candidateStates].reverse(), catalogPlaces: [...catalog.snapshot.catalogPlaces].reverse() } }, origin: f.origin, destination: null });
  assert.deepEqual(a, b);
  assert.equal(a.queue.length, 5);
  assert.deepEqual(a.diagnostics.map(d => d.reason), ['inactive', 'review_required', 'review_required']);
});

test('missing batch states fail closed; queue exhaustion never repeats failed IDs', () => {
  const plan = planLiveDetailBatch(setup(3).state, 'insufficient');
  const good = response(plan.state, 3); if (good.status === 'unavailable') return;
  assert.equal(acceptLiveDetailBatch(plan.state, { ...good, candidateStates: [] }, opening).reason, 'invalid_batch');
  const done = acceptLiveDetailBatch(plan.state, good, opening).state;
  assert.equal(done.routeCandidates.length, 0);
  assert.equal(done.requested.length, 3);
  assert.equal(planLiveDetailBatch(done, 'insufficient').reason, 'queue_exhausted');
});
