import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createMultiSourceLiveSession, projectLiveSessionSources } from '../src/engine/liveMultiSourceOrchestrator';
import { createMultiSourceLiveInputs, projectMultiSourceLiveCatalog, type TourLiveFieldSupplement } from '../src/data/busanLiveProjection';
import { normalizeTourLiveOpening } from '../src/data/liveOpeningNormalizer';
import type { LiveCatalogProjection } from '../src/data/liveCatalogProjection';
import type { BusanLiveResult, BusanLiveSourceKey, BusanLiveSourceResult } from '../src/services/busanLiveAdapter';
import type { CourseV1RouteReceiptAdapter } from '../src/engine/courseV1';

const snapshot = 'fixture-session-1';
const locals = createMultiSourceLiveInputs();
const reps = locals.filter(l => ['representative_core', 'representative_standard'].includes(l.place.policy.classification));
const sources = ['busan_attraction', 'busan_food', 'busan_shopping'] as const;
const down = (): BusanLiveSourceResult => ({ status: 'unavailable', complete: false, providerCalls: 0, reason: { code: 'network', status: null } });
function fixture(): { tour: LiveCatalogProjection; busan: BusanLiveResult; tourSupplements: TourLiveFieldSupplement[] } {
  const active = reps.filter(l => l.tourapiSourceId);
  const tour: LiveCatalogProjection = {
    status: 'ready', liveSourceSnapshotId: snapshot, fetchedAt: '2026-09-22T00:00:00Z', unreviewedSourceCount: 0,
    candidates: active.map(l => ({ id: l.place.id, order: l.place.order, state: 'active_catalog', source: { provider: 'tourapi', contentId: l.tourapiSourceId!, contentTypeId: l.place.mapping!.contentTypeId },
      facts: { title: l.place.identity.title, lat: l.place.identity.lat, lon: l.place.identity.lon }, provenance: { title: 'tourapi_live_catalog', lat: 'tourapi_live_catalog', lon: 'tourapi_live_catalog' }, policy: l.place.policy, relations: l.place.relations })),
    records: locals.flatMap(l => l.tourapiSourceId ? [{ placeId: l.place.id, providerScope: 'tourapi' as const, sourceContentId: l.tourapiSourceId, sourceContentTypeId: l.place.mapping!.contentTypeId, state: reps.includes(l) ? 'active_catalog' as const : 'inactive' as const }] : []),
    summary: { runtimePlaces: 369, tourapiMapped: 139, activeCatalog: 98, inactive: 41, identityConflict: 0, providerOutOfScope: 230, traditionalMarketOnly: 118 },
  };
  const busan: BusanLiveResult = { status: 'ready', liveSourceSnapshotId: snapshot, providerCalls: 3, sources: Object.fromEntries(sources.map(source => {
    const rows = locals.flatMap(l => l.busanMappings.filter(m => m.source === source).map(m => ({ l, m })));
    const result: BusanLiveSourceResult = { status: 'ready', complete: true, providerCalls: 1,
      activeApprovedSourceIds: rows.filter(r => reps.includes(r.l)).map(r => r.m.sourceId),
      inactiveApprovedSourceIds: rows.filter(r => !reps.includes(r.l)).map(r => r.m.sourceId),
      records: rows.filter(r => reps.includes(r.l)).map(({ l, m }) => ({ source, sourceId: m.sourceId, title: l.place.identity.title, lat: l.place.identity.lat, lon: l.place.identity.lon, openingText: '09:00~18:00', photo: { status: 'not_returned_without_approved_evidence' } })),
    };
    return [source, result];
  })) as Record<BusanLiveSourceKey, BusanLiveSourceResult> };
  const tourSupplements = active.map(l => supplement(l.place.id));
  return { tour, busan, tourSupplements };
}
function supplement(id: string): TourLiveFieldSupplement {
  const l = locals.find(l => l.place.id === id)!;
  return { liveSourceSnapshotId: snapshot, placeId: id, sourceId: l.tourapiSourceId!, openingText: '09:00~18:00', openingResult: normalizeTourLiveOpening({ placeId: id, sourceId: l.tourapiSourceId!, contentTypeId: l.place.mapping!.contentTypeId, referenceDate: '2026-09-22', opening: { rawText: '09:00~18:00' } }) };
}
const context = { now: new Date('2026-09-22T01:00:00Z'), origin: { id: 'origin', lat: 35.16, lon: 129.06 }, destination: null, remainingMin: 180, arrivalBufferMin: 10 };
const noRoute: CourseV1RouteReceiptAdapter = { async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 0, reused: true }; } };
function session(f = fixture(), routes = noRoute) {
  return createMultiSourceLiveSession({ sources: { tour: f.tour, busan: f.busan }, context, projector: projectMultiSourceLiveCatalog, receiptRoutes: routes });
}
async function evaluateWithFailedInitialDetails(s: ReturnType<typeof session>) {
  const p = s.reserveDetails();
  if (p.reservation) s.acceptDetails(p.reservation, []);
  return s.evaluate();
}
const unavailableBusan: BusanLiveResult = { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } };

test('191=82/93/16 real projection preserved; source ordering is deterministic', () => {
  const f = fixture();
  const p = projectLiveSessionSources(f, projectMultiSourceLiveCatalog);
  assert.equal(p.status, 'accepted');
  if (p.status !== 'accepted') return;
  assert.equal(p.projection.candidates.length, 191);
  assert.deepEqual(p.projection.summary.representativePartitions, { tourapiOnly: 82, busanOnly: 93, tourapiAndBusan: 16 });
  const reversed = { ...f, tour: { ...f.tour, candidates: [...f.tour.candidates].reverse(), records: [...f.tour.records].reverse() }, tourSupplements: [...f.tourSupplements].reverse() };
  assert.deepEqual(projectLiveSessionSources(reversed, projectMultiSourceLiveCatalog), p);
  assert.deepEqual(session(reversed).reserveDetails(), session(f).reserveDetails());
});

test('snapshot mismatch includes supplements; null ID active catalog cannot be mixed', () => {
  const f = fixture();
  assert.equal(projectLiveSessionSources({ ...f, tour: { ...f.tour, liveSourceSnapshotId: 'other' } }, projectMultiSourceLiveCatalog).status, 'snapshot_mismatch');
  assert.equal(projectLiveSessionSources({ ...f, tourSupplements: [{ ...f.tourSupplements[0], liveSourceSnapshotId: 'other' }] }, projectMultiSourceLiveCatalog).status, 'snapshot_mismatch');
  assert.equal(projectLiveSessionSources({ ...f, tour: { ...f.tour, liveSourceSnapshotId: null } }, projectMultiSourceLiveCatalog).status, 'snapshot_mismatch');
  const s = session({ ...f, tour: { ...f.tour, liveSourceSnapshotId: 'other' } });
  assert.equal(s.view().state, 'unavailable');
  assert.equal(s.reserveDetails().reason, 'unavailable');
});

test('provider failures isolated and identity conflict / Tour missing-review opening never uses Busan', () => {
  const f = fixture();
  const tourDown = { ...f.tour, status: 'unavailable' as const, candidates: [], records: [], liveSourceSnapshotId: null };
  const p = projectLiveSessionSources({ ...f, tour: tourDown, tourSupplements: [] }, projectMultiSourceLiveCatalog);
  assert.equal(p.status === 'accepted' && p.projection.candidates.length, 109);
  const q = projectLiveSessionSources({ ...f, busan: unavailableBusan }, projectMultiSourceLiveCatalog);
  assert.equal(q.status === 'accepted' && q.projection.candidates.length, 98);
  const both = reps.find(l => l.partition === 'tourapi_and_busan')!;
  const review = normalizeTourLiveOpening({ placeId: both.place.id, sourceId: both.tourapiSourceId!, contentTypeId: both.place.mapping!.contentTypeId, referenceDate: '2026-09-22', opening: {} });
  for (const openingResult of [undefined, review]) {
    const changed = { ...f, tourSupplements: f.tourSupplements.map(s => s.placeId === both.place.id ? { ...s, openingResult } : s) };
    const result = projectLiveSessionSources(changed, projectMultiSourceLiveCatalog);
    assert.equal(result.status === 'accepted' && result.projection.candidates.some(c => c.id === both.place.id), false);
  }
  const conflict = projectLiveSessionSources({ ...f, tour: { ...f.tour, records: f.tour.records.map(r => r.placeId === both.place.id ? { ...r, state: 'identity_conflict' } : r) } }, projectMultiSourceLiveCatalog);
  assert.equal(conflict.status === 'accepted' && conflict.projection.candidates.some(c => c.id === both.place.id), false);
});

test('12+6+6+6 reservations, stale/duplicate rejected; exhausted zero stays empty without fallback', async () => {
  const f = fixture(); const s = session({ ...f, busan: unavailableBusan });
  for (const count of [12, 6, 6, 6]) {
    const plan = s.reserveDetails(); assert.ok(plan.reservation); assert.equal(plan.reservation.candidates.length, count);
    assert.equal(s.reserveDetails().reason, 'awaiting_batch');
    assert.equal(s.acceptDetails(plan.reservation, [{ ...supplement(plan.reservation.candidates[0].placeId), liveSourceSnapshotId: 'wrong' }]), 'snapshot_mismatch');
    assert.equal(s.acceptDetails(plan.reservation, []), 'accepted');
    assert.equal(s.acceptDetails(plan.reservation, []), 'stale_reservation');
    await s.evaluate();
  }
  assert.equal(s.reserveDetails().reason, 'detail_cap');
  assert.equal(s.view().detailRequested, 30);
  assert.equal(s.view().state, 'empty');
  assert.equal(s.view().nextAction, 'edit_inputs');
});

for (const count of [1, 2, 3]) test(`partial ${count} verified courses retained, no hard four requirement`, async () => {
  const f = fixture(); const wanted = f.tour.candidates.slice(0, count);
  const ids = new Set(wanted.map(c => c.id));
  const s = session({ ...f, busan: unavailableBusan, tour: { ...f.tour, candidates: wanted, records: f.tour.records.filter(r => ids.has(r.placeId)) } }, { async getRouteReceipt() { return { result: 'exact', route: { mode: 'transit', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } });
  const r = s.reserveDetails().reservation!;
  s.acceptDetails(r, r.candidates.map(c => supplement(c.placeId)));
  const view = await s.evaluate();
  assert.equal(view.state, 'partial'); assert.equal(view.courses.length, count);
  assert.equal(s.reserveDetails().reason, 'queue_exhausted');
  assert.equal(s.view().courses.length, count);
  assert.notEqual(s.view().nextAction, 'edit_inputs');
});

test('same session receipt cache and initial8 ledger survive batches; single writer blocks concurrent work', async () => {
  const f = fixture(); const calls: string[] = []; let release!: () => void;
  let first = true;
  const routes: CourseV1RouteReceiptAdapter = { async getRouteReceipt(a, b, budget) {
    calls.push(`${a.id}>${b.id}`); assert.ok(budget.maxNewProviderAttemptCount <= 2);
    if (first) { first = false; await new Promise<void>(resolve => { release = resolve; }); }
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
  } };
  const s = session({ ...f, busan: unavailableBusan }, routes);
  const p = s.reserveDetails().reservation!;
  s.acceptDetails(p, [supplement(p.candidates[0].placeId)]);
  const running = s.evaluate();
  assert.equal(s.reserveDetails().reason, 'awaiting_evaluation');
  await assert.rejects(s.evaluate(), /evaluation_in_progress/);
  release(); await running;
  assert.equal(s.view().ledger.initialOneStopAttempts, 2);
  const next = s.reserveDetails().reservation!;
  s.acceptDetails(next, next.candidates.map(c => supplement(c.placeId)));
  await s.evaluate();
  assert.equal(s.view().ledger.initialOneStopAttempts, 8);
  assert.equal(s.view().ledger.totalNewProviderAttempts, 8);
  assert.equal(s.view().ledger.automaticTwoStopAttempts, 0);
  assert.equal(s.view().ledger.sharedExpansionAttempts, 0);
  assert.equal(new Set(calls).size, calls.length);
  assert.equal(calls.length, 8);
  const before = s.view(); await s.evaluate();
  assert.equal(calls.length, 8); assert.deepEqual(s.view().ledger, before.ledger);
  assert.equal(s.view().courses.length, 4);
  assert.equal(s.reserveDetails().reason, 'sufficient');
});

test('public entry stays disconnected; engine has no runtime service/data/HTTP imports', () => {
  for (const path of ['src/engine/index.ts', 'src/ui/recommendation/v1Session.ts']) {
    if (fs.existsSync(path)) assert.doesNotMatch(fs.readFileSync(path, 'utf8'), /liveMultiSourceOrchestrator|createMultiSourceLiveSession/);
  }
  const code = fs.readFileSync('src/engine/liveMultiSourceOrchestrator.ts', 'utf8');
  assert.doesNotMatch(code, /\bfetch\s*\(|process\.env|console\.|AsyncStorage/);
  assert.doesNotMatch(code.replace(/^import type .*;$/gm, ''), /from ['"]\.\.\/(data|services)\//);
});

test('Busan-only active survives Tour detail failure, never routes inactive/review/out-of-scope rows', async () => {
  const f = fixture(); const visited = new Set<string>();
  const s = session(f, { async getRouteReceipt(a, b) {
    visited.add(a.id); visited.add(b.id);
    return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false };
  } });
  const p = s.reserveDetails().reservation!;
  assert.equal(s.acceptDetails(p, []), 'accepted');
  const v = await s.evaluate();
  assert.equal(v.state, 'ready');
  assert.equal(v.activeCandidateCount, 93);
  assert.ok(v.routeCandidates.length <= 18);
  assert.ok([...visited].filter(id => id !== 'origin').every(id => reps.some(l => l.place.id === id && l.partition === 'busan_only')));
  assert.ok(v.courses.every(c => c.placeIds.length === 1 && c.totalMin <= 180));
  assert.equal(s.reserveDetails().reason, 'sufficient');
  assert.doesNotMatch(JSON.stringify(v.diagnostics), /lat|lon|openingText|description|raw|stack|origin/);
});

test('unavailable/throwing receipts consume reserved allowance and stop without exposing raw error or retry', async () => {
  const f = fixture(); let calls = 0;
  const s = session(f, { async getRouteReceipt() { calls++; throw new Error('RAW_SECRET_COORDINATES'); } });
  const v = await evaluateWithFailedInitialDetails(s);
  assert.equal(v.state, 'unavailable'); assert.equal(v.ledger.initialOneStopAttempts, 2);
  assert.equal(v.routeCacheEntries, 0); assert.equal(v.stopReason, 'provider_unavailable');
  assert.equal(s.reserveDetails().reason, 'provider_unavailable');
  await s.evaluate(); assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(v), /RAW_SECRET/);
});

test('two attempts per receipt conditionally extend from8 to16; zero-attempt failures preserve route18 and adapter24 caps', async () => {
  const f = fixture();
  for (const cost of [0, 2] as const) {
    let calls = 0;
    const s = session({ ...f, busan: unavailableBusan }, { async getRouteReceipt(_a, _b, budget) {
      calls++; assert.ok(cost <= budget.maxNewProviderAttemptCount);
      return { result: 'no_route', newProviderAttemptCount: cost, reused: cost === 0 };
    } });
    for (let i = 0; i < 4; i++) {
      const p = s.reserveDetails(); if (!p.reservation) break;
      s.acceptDetails(p.reservation, p.reservation.candidates.map(c => supplement(c.placeId)));
      await s.evaluate();
    }
    const v = s.view();
    assert.ok(v.ledger.initialOneStopAttempts <= 16); assert.ok(v.adapterCalls <= 24); assert.ok(v.routeCandidates.length <= 18);
    assert.equal(v.courses.length, 0);
    assert.equal(v.state, 'empty');
    if (cost === 2) { assert.equal(calls, 8); assert.equal(v.ledger.initialOneStopAttempts, 16); assert.equal(s.reserveDetails().reason, 'route_budget_exhausted'); }
    else { assert.ok(calls <= 18); assert.equal(v.ledger.totalNewProviderAttempts, 0); assert.equal(v.detailRequested, 30); }
  }
});

test('invalid batch is atomic; caller mutation cannot change fixed context, queue, cache or output', async () => {
  const f = fixture(); const ctx = { ...context, origin: { ...context.origin }, now: new Date(context.now) };
  const s = createMultiSourceLiveSession({ sources: { tour: f.tour, busan: unavailableBusan }, context: ctx, projector: projectMultiSourceLiveCatalog, receiptRoutes: noRoute });
  ctx.origin.lat = 80; ctx.now.setFullYear(2099);
  const p = s.reserveDetails().reservation!;
  const before = s.view(); const sample = supplement(p.candidates[0].placeId);
  assert.equal(s.acceptDetails(p, [sample, sample]), 'invalid_batch');
  assert.equal(s.acceptDetails(p, [{ ...sample, sourceId: 'unmapped' }]), 'invalid_batch');
  assert.deepEqual(s.view(), before);
  assert.equal(s.acceptDetails({ ...p }, []), 'stale_reservation');
  assert.equal(s.acceptDetails(p, [sample]), 'accepted');
  const v = await s.evaluate();
  assert.ok(Object.isFrozen(v)); assert.ok(Object.isFrozen(v.ledger));
  assert.equal(v.routeCandidates[0].id, sample.placeId);
});

test('181 and invalid buffer rejected before ports; 120/121/180 keep existing one-stop time and dwell', async () => {
  const f = fixture(); let calls = 0;
  const route: CourseV1RouteReceiptAdapter = { async getRouteReceipt() { calls++; return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } };
  const make = (remainingMin: number, arrivalBufferMin = 10) => createMultiSourceLiveSession({ sources: f, context: { ...context, remainingMin, arrivalBufferMin }, projector: projectMultiSourceLiveCatalog, receiptRoutes: route });
  assert.throws(() => make(181), /invalid_session_input/); assert.throws(() => make(120, 0), /invalid_session_input/); assert.equal(calls, 0);
  for (const minutes of [120, 121, 180]) {
    const v = await evaluateWithFailedInitialDetails(make(minutes));
    assert.equal(v.courses.length, 4); assert.equal(v.ledger.initialOneStopAttempts, 8);
    for (const c of v.courses) { assert.equal(c.placeIds.length, 1); assert.equal(c.stayMin, 30); assert.equal(c.totalMin, 50); assert.equal(c.remainingAfterCourseMin, minutes - 50); }
  }
});

test('initial Tour detail cannot be bypassed by evaluating Busan first; wrong receipt budget fails closed', async () => {
  const f = fixture(); let calls = 0;
  const s = session(f, { async getRouteReceipt() { calls++; return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 3, reused: false } as never; } });
  await assert.rejects(s.evaluate(), /initial_detail_batch_required/); assert.equal(calls, 0);
  const v = await evaluateWithFailedInitialDetails(s);
  assert.equal(calls, 1); assert.equal(v.ledger.initialOneStopAttempts, 2);
  assert.equal(v.state, 'unavailable'); assert.equal(v.courses.length, 0);
});

test('detail provider lower cap honored without deleting verified partial course', async () => {
  const f = fixture();
  const s = session({ ...f, busan: unavailableBusan }, { async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } });
  const p = s.reserveDetails().reservation!;
  assert.equal(s.acceptDetails(p, [], { nextBatchMax: 7 }), 'invalid_batch');
  assert.equal(s.acceptDetails(p, [supplement(p.candidates[0].placeId)], { nextBatchMax: 0 }), 'accepted');
  const v = await s.evaluate();
  assert.equal(v.state, 'partial'); assert.equal(v.courses.length, 1);
  assert.equal(v.stopReason, 'detail_provider_limit'); assert.equal(s.reserveDetails().reason, 'detail_provider_limit');
});

test('entire source failure stays unavailable, complete inactive stays empty', async () => {
  const f = fixture();
  const tour = { ...f.tour, status: 'unavailable' as const, liveSourceSnapshotId: null, candidates: [], records: [] };
  const s = session({ ...f, tour, busan: unavailableBusan });
  assert.equal((await s.evaluate()).state, 'unavailable');
  const inactive = { ...f.tour, candidates: [], records: f.tour.records.map(r => ({ ...r, state: 'inactive' as const })) };
  const v = await session({ ...f, tour: inactive, busan: { status: 'unavailable', liveSourceSnapshotId: snapshot, providerCalls: 0, sources: { busan_attraction: down(), busan_food: down(), busan_shopping: down() } } }).evaluate();
  assert.equal(v.state, 'empty'); assert.equal(v.nextAction, 'edit_inputs');
});
