import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createMultiSourceLiveSession } from '../src/engine/liveMultiSourceOrchestrator';
import type { MultiSourceLiveProjection } from '../src/data/busanLiveProjection';
import { continueReleaseOneStopRepresentativeCourseV1, type CourseV1RouteReceiptAdapter } from '../src/engine/courseV1';
import { createTwoStopSelectionEnginePort } from '../src/ui/recommendation/twoStopSelectionEnginePort';

function fixture(count = 18, receiptRoutes?: CourseV1RouteReceiptAdapter) {
  const calls: string[] = [];
  const candidates: MultiSourceLiveProjection['candidates'] = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, order: i, state: 'active', facts: { title: `Place ${i}`, lat: 35.16 + i * 0.0001, lon: 129.06,
      availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] } },
    provenance: { opening: ['busan_attraction'] }, photoDisposition: 'default_no_approved_evidence',
    policy: { category: '자연', classification: 'representative_standard', availabilityProfile: 'always_open', activityType: 'outdoor', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, evidenceReviewDueAt: '2027-01-01' },
    relations: { mergedPlaceIds: [] },
  }));
  const projection: MultiSourceLiveProjection = { status: 'ready', liveSourceSnapshotId: 'fixture', candidates, records: [], summary: { runtimePlaces: count, representativePlaces: count, representativePartitions: { tourapiOnly: 0, busanOnly: count, tourapiAndBusan: 0 }, activeRepresentative: count, inactive: 0, reviewRequired: 0, sourceUnavailable: 0, providerOutOfScope: 0, traditionalMarketOnly: 0 } };
  const input = {
    sources: {
      tour: { status: 'unavailable' as const, liveSourceSnapshotId: null, fetchedAt: null, candidates: [], records: [], unreviewedSourceCount: 0, summary: { runtimePlaces: 0, tourapiMapped: 0, activeCatalog: 0, inactive: 0, identityConflict: 0, providerOutOfScope: 0, traditionalMarketOnly: 0 } },
      busan: { status: 'ready' as const, liveSourceSnapshotId: 'fixture', providerCalls: 0, sources: { busan_attraction: { status: 'unavailable' as const, complete: false as const, providerCalls: 0 as const, reason: { code: 'network' as const, status: null } }, busan_food: { status: 'unavailable' as const, complete: false as const, providerCalls: 0 as const, reason: { code: 'network' as const, status: null } }, busan_shopping: { status: 'unavailable' as const, complete: false as const, providerCalls: 0 as const, reason: { code: 'network' as const, status: null } } } },
    },
    context: { now: new Date('2026-09-22T01:00:00Z'), origin: { id: 'origin', lat: 35.16, lon: 129.06 }, destination: null, remainingMin: 180, arrivalBufferMin: 10 },
    projector: () => projection,
    receiptRoutes: receiptRoutes ?? { async getRouteReceipt(a, b) { calls.push(`${a.id}>${b.id}`); return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } } satisfies CourseV1RouteReceiptAdapter,
  };
  return { session: createMultiSourceLiveSession(input), calls, input };
}

for (const count of [1, 2, 3, 4]) test(`initial ${count} courses are compatible verified result and exact ledger`, async () => {
  const f = fixture(count); await f.session.evaluate();
  const result = f.session.initialResult();
  assert.equal(result.resultState, 'verified'); assert.equal(result.alternativeCourses.length, count - 1);
  assert.equal(result.diagnostics.newProviderAttemptCount, count * 2);
  assert.equal(f.session.view().state, count < 4 ? 'partial' : 'ready');
  const bridge = f.session.sealRuntime();
  assert.deepEqual(bridge.result, result); assert.equal(bridge.ledger.initialOneStopAttempts, count * 2);
});

test('empty candidate, no verified route and unavailable have distinct compatible outcomes', async () => {
  const empty = fixture(0); await empty.session.evaluate();
  assert.equal(empty.session.initialResult().resultState, 'no_representative_candidates');
  const failed = fixture(2, { async getRouteReceipt() { return { result: 'no_route', newProviderAttemptCount: 1, reused: false }; } });
  await failed.session.evaluate();
  assert.equal(failed.session.initialResult().resultState, 'no_verified_course_within_limit');
  assert.equal(failed.session.initialResult().primaryOutcomeReason, 'route_not_verified');
  const down = fixture(2, { async getRouteReceipt() { throw new Error('RAW_ERROR'); } }); await down.session.evaluate();
  assert.equal(down.session.initialResult().primaryOutcomeReason, 'route_verification_unavailable');
  assert.doesNotMatch(JSON.stringify(down.session.initialResult()), /RAW_ERROR|providerCalls|liveSourceSnapshotId|"(?:lat|lon)":/);
});

test('initial8 -> real UI pair port reuses cache, allows automatic attempts and verifies max2 within time', async () => {
  const f = fixture(); await f.session.evaluate(); const bridge = f.session.sealRuntime();
  const port = createTwoStopSelectionEnginePort({ ...bridge.input, ledger: bridge.ledger, ledgerStore: bridge.ledgerStore });
  const first = bridge.result.representativeCourse!;
  const result = await bridge.run('automatic', bridge.ledgerStore.read(), () => port.begin({ firstCourse: first, requestId: 'pair', onProgress() {}, signal: new AbortController().signal }));
  assert.equal(bridge.ledger.initialOneStopAttempts, 8);
  assert.ok(bridge.ledgerStore.read().automaticTwoStopAttempts > 0);
  assert.ok(result.courses.length > 0);
  assert.ok(result.courses.every(c => c.placeIds.length === 2 && c.totalMin <= 180 && c.stayMin >= 40));
  assert.equal(new Set(f.calls).size, f.calls.length, 'initial receipt not fetched again by pair');
  assert.ok(result.continuation);
  const page = await bridge.run('shared', bridge.ledgerStore.read(), () => port.continue({ firstCourse: first, continuation: result.continuation!, requestId: 'more', onProgress() {}, signal: new AbortController().signal }));
  assert.ok(page.courses.length > 0); assert.ok(page.courses.every(c => c.placeIds.length === 2 && c.totalMin <= 180));
  assert.ok(bridge.actualLedger().sharedExpansionAttempts <= 12);
  assert.deepEqual(bridge.ledgerStore.read(), bridge.actualLedger());
});

test('phase budgets automatic16/shared12/total36 and ledger mismatch fail closed', async () => {
  const f = fixture(); await f.session.evaluate(); const b = f.session.sealRuntime();
  const points = b.input.provider.listRepresentativeCandidates(b.input.now);
  for (const [phase, count] of [['automatic', 16], ['shared', 12]] as const) {
    await b.run(phase, b.ledgerStore.read(), async () => {
      for (let i = 0; i < count; i++) {
        const from = points[phase === 'automatic' ? 0 : 1];
        const to = points[i + 2 >= points.length ? 0 : i + 2];
        const receipt = await b.input.receiptRoutes!.getRouteReceipt(from, to, { maxNewProviderAttemptCount: 2 });
        const ui = b.ledgerStore.read(); const used = receipt.newProviderAttemptCount;
        b.ledgerStore.commit({ ...ui, automaticTwoStopAttempts: ui.automaticTwoStopAttempts + (phase === 'automatic' ? used : 0), sharedExpansionAttempts: ui.sharedExpansionAttempts + (phase === 'shared' ? used : 0), totalNewProviderAttempts: ui.totalNewProviderAttempts + used });
      }
      const extra = await b.input.receiptRoutes!.getRouteReceipt(points[17], points[16], { maxNewProviderAttemptCount: 2 });
      assert.equal(extra.result, 'unavailable');
      b.ledgerStore.commit(b.actualLedger());
    });
  }
  assert.equal(b.actualLedger().totalNewProviderAttempts, 36);
  assert.equal(b.actualLedger().automaticTwoStopAttempts, 16);
  assert.equal(b.actualLedger().sharedExpansionAttempts, 12);
  const before = f.calls.length;
  await assert.rejects(b.run('automatic', b.ledger, async () => {}), /ledger_mismatch/);
  assert.equal(f.calls.length, before);
});

test('seal once, no work before/during/after lifecycle; caller mutation does not affect bridge', async () => {
  let release!: () => void; let first = true;
  const f = fixture(4, { async getRouteReceipt() { if (first) { first = false; await new Promise<void>(r => { release = r; }); } return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false }; } });
  assert.throws(() => f.session.sealRuntime(), /initial_not_final/);
  const running = f.session.evaluate(); assert.throws(() => f.session.sealRuntime(), /initial_not_final/);
  release(); await running; const b = f.session.sealRuntime();
  assert.throws(() => f.session.sealRuntime(), /session_sealed/);
  await assert.rejects(f.session.evaluate(), /session_sealed/);
  assert.equal(f.session.reserveDetails().reason, 'session_sealed');
  const date = b.input.now; date.setFullYear(2099); assert.equal(b.input.now.getUTCFullYear(), 2026);
  assert.ok(Object.isFrozen(b.input.origin)); assert.ok(Object.isFrozen(b.input.provider.listRepresentativeCandidates(b.input.now)));
  const receipt = await b.input.receiptRoutes!.getRouteReceipt(b.input.origin, b.input.provider.listRepresentativeCandidates(b.input.now)[0], { maxNewProviderAttemptCount: 2 });
  assert.equal(receipt.result, 'unavailable');
  assert.equal(await b.input.routes.getRoute(b.input.origin, b.input.origin), null);
});

test('missing UI ledger commit poisons further runtime operations without new calls', async () => {
  const f = fixture(); await f.session.evaluate(); const b = f.session.sealRuntime();
  const [a, c] = b.input.provider.listRepresentativeCandidates(b.input.now);
  await assert.rejects(b.run('automatic', b.ledgerStore.read(), async () => {
    await b.input.receiptRoutes!.getRouteReceipt(a, c, { maxNewProviderAttemptCount: 2 });
    // Intentionally omit UI commit.
  }), /ledger_mismatch/);
  const before = f.calls.length;
  await assert.rejects(b.run('shared', b.actualLedger(), async () => {}), /ledger_mismatch/);
  assert.equal(f.calls.length, before);
});

test('runtime concurrent operation blocked; wrong category commit fails closed', async () => {
  const f = fixture(); await f.session.evaluate(); const b = f.session.sealRuntime();
  let release!: () => void;
  const running = b.run('automatic', b.ledgerStore.read(), async () => { await new Promise<void>(r => { release = r; }); });
  await assert.rejects(b.run('shared', b.ledgerStore.read(), async () => {}), /runtime_operation_in_progress/);
  release(); await running;
  const points = b.input.provider.listRepresentativeCandidates(b.input.now);
  await assert.rejects(b.run('automatic', b.ledgerStore.read(), async () => {
    const receipt = await b.input.receiptRoutes!.getRouteReceipt(points[0], points[1], { maxNewProviderAttemptCount: 2 });
    b.ledgerStore.commit({ ...b.ledger, sharedExpansionAttempts: receipt.newProviderAttemptCount, totalNewProviderAttempts: b.ledger.totalNewProviderAttempts + receipt.newProviderAttemptCount });
  }), /ledger_mismatch/);
});

test('pair time budget and live closing window are not weakened by bridge', async () => {
  for (const mode of ['short_time', 'closing'] as const) {
    const f = fixture(6);
    const base = f.input.projector();
    const s = createMultiSourceLiveSession({ ...f.input,
      context: { ...f.input.context, now: new Date(2026, 8, 22, 10, 0), remainingMin: mode === 'short_time' ? 55 : 180 },
      projector: () => mode === 'short_time' ? base : { ...base, candidates: base.candidates.map(c => ({ ...c, facts: { ...c.facts, availability: { status: 'structured', alwaysAccessible: false, dayTypes: ['weekday', 'weekend'], windows: [{ startMin: 600, endMin: 640 }] } } })) },
    });
    await s.evaluate(); const b = s.sealRuntime(); assert.ok(b.result.representativeCourse);
    const port = createTwoStopSelectionEnginePort({ ...b.input, ledger: b.ledger, ledgerStore: b.ledgerStore });
    const result = await b.run('automatic', b.ledgerStore.read(), () => port.begin({ firstCourse: b.result.representativeCourse!, requestId: mode, onProgress() {}, signal: new AbortController().signal }));
    assert.equal(result.courses.length, 0);
    assert.ok(b.actualLedger().automaticTwoStopAttempts <= 16);
  }
});

test('context exact coordinates and direction bind the shared cache; forged point cannot call provider', async () => {
  const f = fixture(); await f.session.evaluate(); const b = f.session.sealRuntime();
  const [a, c] = b.input.provider.listRepresentativeCandidates(b.input.now);
  const before = f.calls.length;
  await b.run('automatic', b.ledgerStore.read(), async () => {
    const hit = await b.input.receiptRoutes!.getRouteReceipt(b.input.origin, a, { maxNewProviderAttemptCount: 2 });
    assert.equal(hit.newProviderAttemptCount, 0); assert.equal(hit.reused, true);
    const bad = await b.input.receiptRoutes!.getRouteReceipt({ ...a, lat: a.lat + 1 }, c, { maxNewProviderAttemptCount: 2 });
    assert.equal(bad.result, 'unavailable');
    assert.equal(f.calls.length, before);
    const forward = await b.input.receiptRoutes!.getRouteReceipt(a, c, { maxNewProviderAttemptCount: 2 });
    const reverse = await b.input.receiptRoutes!.getRouteReceipt(c, a, { maxNewProviderAttemptCount: 2 });
    assert.equal(forward.newProviderAttemptCount, 1); assert.equal(reverse.newProviderAttemptCount, 1);
    b.ledgerStore.commit({ ...b.ledger, automaticTwoStopAttempts: 2, totalNewProviderAttempts: b.ledger.totalNewProviderAttempts + 2 });
  });
});

test('public path remains disconnected and bridge production never imports UI/data/services', () => {
  for (const file of ['src/engine/index.ts', 'src/ui/recommendation/v1Session.ts', 'App.tsx']) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /liveRuntimeBridge|sealRuntime/);
  const code = fs.readFileSync('src/engine/liveRuntimeBridge.ts', 'utf8');
  assert.doesNotMatch(code, /from ['"].*(?:ui|data|services)\//);
  assert.doesNotMatch(code, /process\.env|\bfetch\s*\(|console\./);
});

test('pending detail and settled-but-unevaluated input cannot seal; accept after seal is blocked', async () => {
  const f = fixture(1); const c = f.input.projector().candidates[0];
  const s = createMultiSourceLiveSession({ ...f.input, sources: { ...f.input.sources, tour: { ...f.input.sources.tour,
    status: 'ready', liveSourceSnapshotId: 'fixture',
    candidates: [{ id: c.id, order: 0, state: 'active_catalog', source: { provider: 'tourapi', contentId: '100', contentTypeId: '12' }, facts: { title: c.facts.title, lat: c.facts.lat, lon: c.facts.lon }, provenance: { title: 'tourapi_live_catalog', lat: 'tourapi_live_catalog', lon: 'tourapi_live_catalog' }, policy: c.policy, relations: c.relations }],
    records: [{ placeId: c.id, providerScope: 'tourapi', state: 'active_catalog', sourceContentId: '100', sourceContentTypeId: '12' }],
  } } });
  const p = s.reserveDetails().reservation!;
  assert.throws(() => s.sealRuntime(), /initial_not_final/);
  s.acceptDetails(p, []); assert.throws(() => s.sealRuntime(), /initial_not_final/);
  await s.evaluate(); s.sealRuntime(); assert.equal(s.acceptDetails(p, []), 'session_sealed');
});

test('existing one-stop continuation uses shared budget and compatible sealed result', async () => {
  const f = fixture(); await f.session.evaluate(); const b = f.session.sealRuntime();
  assert.ok(b.result.continuation);
  const page = await b.run('shared', b.ledgerStore.read(), async () => {
    const result = await continueReleaseOneStopRepresentativeCourseV1({ ...b.input, continuation: b.result.continuation!, pageProviderAttemptLimit: 8 });
    const before = b.ledgerStore.read(); const used = result.diagnostics.newProviderAttemptCount!;
    b.ledgerStore.commit({ ...before, sharedExpansionAttempts: before.sharedExpansionAttempts + used, totalNewProviderAttempts: before.totalNewProviderAttempts + used });
    return result;
  });
  assert.ok(page.appendedCourses.length > 0); assert.ok(page.appendedCourses.every(c => c.placeIds.length === 1));
  assert.ok(b.actualLedger().sharedExpansionAttempts <= 8);
});

test('provider extra raw fields cannot leak through sealed cached receipt', async () => {
  const f = fixture(1, { async getRouteReceipt() { return { result: 'exact', route: { mode: 'walk', min: 5, exact: true }, newProviderAttemptCount: 1, reused: false, rawBody: 'RAW_BODY' } as never; } });
  await f.session.evaluate(); const b = f.session.sealRuntime();
  await b.run('automatic', b.ledgerStore.read(), async () => {
    const c = b.input.provider.listRepresentativeCandidates(b.input.now)[0];
    const receipt = await b.input.receiptRoutes!.getRouteReceipt(b.input.origin, c, { maxNewProviderAttemptCount: 2 });
    assert.doesNotMatch(JSON.stringify(receipt), /RAW_BODY|rawBody/);
    assert.equal(receipt.newProviderAttemptCount, 0);
  });
});

test('sealed provider retains active structured deterministic pool18 and same-site dedup', async () => {
  const f = fixture(24); const base = f.input.projector();
  const changed: MultiSourceLiveProjection = { ...base, candidates: base.candidates.map((c, i) => i < 2 ? { ...c, relations: { ...c.relations, siteGroupId: 'same-site' } }
    : i === 2 ? { ...c, facts: { ...c.facts, availability: { ...c.facts.availability, status: 'needs_review' } } }
    : i === 3 ? { ...c, policy: { ...c.policy, classification: 'hold' } } : c) };
  const make = (reverse: boolean) => createMultiSourceLiveSession({ ...f.input, projector: () => ({ ...changed, candidates: reverse ? [...changed.candidates].reverse() : changed.candidates }) });
  const a = make(false), b = make(true); await a.evaluate(); await b.evaluate();
  const left = a.sealRuntime().input, right = b.sealRuntime().input;
  const pool = left.provider.listRepresentativeCandidates(left.now);
  assert.equal(pool.length, 18);
  assert.equal(pool.filter(c => c.siteGroupId === 'same-site').length, 1);
  assert.ok(pool.every(c => c.availability.status === 'structured' && c.classification !== 'hold'));
  assert.deepEqual(pool, right.provider.listRepresentativeCandidates(right.now));
});
