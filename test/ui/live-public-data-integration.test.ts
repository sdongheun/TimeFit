import assert from 'node:assert/strict';
import test from 'node:test';
import { runLivePublicDataInitial, type LivePublicDataPorts } from '../../src/ui/recommendation/livePublicDataSession';
import { continueReleaseRecommendationSession, getRecommendationSessionAttemptLedger, getTwoStopSelectionPort, runRecommendationSession } from '../../src/ui/recommendation/v1Session';
import { recommendationFailureMessage } from '../../src/ui/captchaRecommendationGateModel';
import { LivePublicDataUnavailableError } from '../../src/ui/recommendation/livePublicDataSession';
import { createMultiSourceLiveSession } from '../../src/engine/liveMultiSourceOrchestrator';
import type { MultiSourceLiveProjection } from '../../src/data/busanLiveProjection';

test('live source failure exposes only concise retry copy, not provider or raw diagnostics', () => {
  const message = recommendationFailureMessage(new LivePublicDataUnavailableError());
  assert.equal(message, '장소 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  assert.doesNotMatch(message, /tourapi|busan|supabase|token|coordinate|source/i);
});

test('blocked production facade fails closed before static results can be produced', async () => {
  await assert.rejects(() => runLivePublicDataInitial({
    context: {
      now: new Date('2026-09-22T03:00:00.000Z'),
      origin: { id: 'origin', lat: 35.15, lon: 129.06 }, destination: null,
      remainingMin: 120, arrivalBufferMin: 10,
    },
    receiptRoutes: { getRouteReceipt: async () => ({ result: 'unavailable', reason: 'transport', newProviderAttemptCount: 0, reused: false }) },
    isCurrent: () => true,
    ports: {
      async createFacade() { return { status: 'unavailable', reason: 'auth_session_unavailable' }; },
      buildApprovedInput() { throw new Error('must_not_run'); },
      projectInitial() { throw new Error('must_not_run'); },
      projectDetails() { throw new Error('must_not_run'); },
      projectCatalog() { throw new Error('must_not_run'); },
      createSession() { throw new Error('must_not_run'); },
    },
  }), /live_public_data_unavailable/);
});

const context = {
  now: new Date('2026-09-22T03:00:00.000Z'),
  origin: { id: 'origin', lat: 35.15, lon: 129.06 }, destination: null,
  remainingMin: 120, arrivalBufferMin: 10,
};
const receiptRoutes = { getRouteReceipt: async () => ({ result: 'unavailable' as const, reason: 'transport' as const, newProviderAttemptCount: 0 as const, reused: false }) };

function fixture(states: readonly ('partial' | 'ready' | 'empty' | 'unavailable')[]) {
  const events: string[] = [];
  const reservations = (states.length > 1 ? states : []).map((_, index) => ({
    liveSourceSnapshotId: 'snapshot', sequence: index + 1,
    candidates: Array.from({ length: index ? 6 : 12 }, (__, offset) => ({ placeId: `p${index * 12 + offset}`, contentId: String(index * 12 + offset + 1), contentTypeId: '12' })),
  }));
  let next = 0;
  let currentReservation: unknown;
  const bridge = { result: { resultState: 'verified', diagnostics: { newProviderAttemptCount: 1 } }, input: {}, ledger: { version: 1, initialOneStopAttempts: 1, automaticTwoStopAttempts: 0, sharedExpansionAttempts: 0, totalNewProviderAttempts: 1 } };
  const facade = {
    async initialize() { events.push('initialize'); return { status: 'active' }; },
    async loadDetails(reservation: unknown) { events.push(`details:${(reservation as { candidates: unknown[] }).candidates.length}`); currentReservation = reservation; return { status: 'accepted', reservation }; },
    cancel() { events.push('cancel'); },
    close() { events.push('close'); },
  };
  const ports = {
    async createFacade() { events.push('factory'); return { status: 'ready', facade }; },
    buildApprovedInput() { events.push('approved'); return {}; },
    projectInitial() { events.push('project_initial'); return { status: 'accepted', sources: { tour: {}, busan: {} } }; },
    projectDetails({ reservation, response }: { reservation: unknown; response: { reservation: unknown } }) {
      assert.equal(reservation, currentReservation);
      assert.equal(response.reservation, reservation);
      return { status: 'accepted', supplements: [], nextBatchMax: 6 };
    },
    projectCatalog() { events.push('project_catalog'); return { status: 'ready', liveSourceSnapshotId: 'snapshot', candidates: [], records: [] }; },
    createSession() {
      events.push('engine');
      return {
        reserveDetails() { return next < reservations.length ? { reason: 'request', reservation: reservations[next] } : { reason: 'queue_exhausted' }; },
        acceptDetails(reservation: unknown, _supplements: unknown, limits: { nextBatchMax: number }) {
          assert.equal(reservation, reservations[next]); assert.equal(limits.nextBatchMax, 6); events.push('accept'); return 'accepted';
        },
        async evaluate() {
          events.push('evaluate');
          const state = states[next++];
          return { state, liveSourceSnapshotId: 'snapshot', ...(state === 'partial' && next === states.length ? { stopReason: 'queue_exhausted' } : {}) };
        },
        sealRuntime() { events.push('seal'); return bridge; },
      };
    },
  } as unknown as LivePublicDataPorts;
  return { events, ports, bridge };
}

test('live controller uses one facade, exact reservation, 12→6 and seals only after final ready', async () => {
  const f = fixture(['partial', 'ready']);
  const result = await runLivePublicDataInitial({ context, receiptRoutes, isCurrent: () => true, ports: f.ports });
  assert.equal(result.bridge, f.bridge);
  assert.deepEqual(f.events, ['factory', 'approved', 'initialize', 'project_initial', 'engine', 'details:12', 'accept', 'evaluate', 'details:6', 'accept', 'evaluate', 'project_catalog', 'seal', 'close']);
});

test('live controller never resets the detail budget across 12→6→6→6, capped at 30', async () => {
  const f = fixture(['partial', 'partial', 'partial', 'partial']);
  const result = await runLivePublicDataInitial({ context, receiptRoutes, isCurrent: () => true, ports: f.ports });
  assert.equal(result.state, 'partial');
  assert.deepEqual(f.events.filter((event) => event.startsWith('details:')), ['details:12', 'details:6', 'details:6', 'details:6']);
  assert.equal(f.events.filter((event) => event === 'factory').length, 1);
  assert.equal(f.events.filter((event) => event === 'seal').length, 1);
});

test('live controller keeps final partial and Busan-only empty distinct from unavailable', async () => {
  for (const state of ['partial', 'empty'] as const) {
    const f = fixture([state]);
    const result = await runLivePublicDataInitial({ context, receiptRoutes, isCurrent: () => true, ports: f.ports });
    assert.equal(result.state, state);
    assert.deepEqual(f.events.slice(-4), ['evaluate', 'project_catalog', 'seal', 'close']);
  }
  const f = fixture(['unavailable']);
  await assert.rejects(() => runLivePublicDataInitial({ context, receiptRoutes, isCurrent: () => true, ports: f.ports }), /live_public_data_unavailable/);
  assert.equal(f.events.includes('seal'), false);
  assert.deepEqual(f.events.slice(-2), ['cancel', 'close']);
});

test('blocked detail cannot fall back to bundled candidates or seal a false success', async () => {
  const f = fixture(['partial', 'ready']);
  const original = f.ports.createFacade;
  const ports = {
    ...f.ports,
    async createFacade() {
      const result = await original();
      if (result.status !== 'ready') throw new Error('fixture_unavailable');
      return { ...result, facade: { ...result.facade, async loadDetails() { f.events.push('blocked_detail'); return { status: 'blocked', reason: 'detail_provider_unavailable' }; } } };
    },
  } as unknown as LivePublicDataPorts;
  await assert.rejects(() => runLivePublicDataInitial({ context, receiptRoutes, isCurrent: () => true, ports }), /live_public_data_unavailable/);
  assert.equal(f.events.includes('engine'), true);
  assert.equal(f.events.includes('seal'), false);
  assert.deepEqual(f.events.slice(-2), ['cancel', 'close']);
});

test('abort during initialize cancels facade and prevents projection, engine and navigation result', async () => {
  const f = fixture(['empty']);
  const controller = new AbortController();
  let complete!: (value: { status: 'active' }) => void;
  const original = f.ports.createFacade;
  const ports = {
    ...f.ports,
    async createFacade() {
      const result = await original();
      if (result.status !== 'ready') throw new Error('fixture_unavailable');
      return { ...result, facade: { ...result.facade, initialize: () => new Promise<{ status: 'active' }>((resolve) => { complete = resolve; }) } };
    },
  } as unknown as LivePublicDataPorts;
  const pending = runLivePublicDataInitial({ context, receiptRoutes, isCurrent: () => true, signal: controller.signal, ports });
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.abort();
  complete({ status: 'active' });
  await assert.rejects(pending, /recommendation_scope_changed/);
  assert.equal(f.events.includes('engine'), false);
  assert.equal(f.events.includes('project_initial'), false);
  assert.deepEqual(f.events.slice(-2), ['cancel', 'close']);
});

test('explicit legacy test seam uses legacy builder and never loads live modules', async () => {
  const session = { nowIso: '2026-09-22T03:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.06 }, destination: null, remainingMin: 120, arrivalBufferMin: 10 };
  let liveLoads = 0; let builds = 0;
  const result = await runRecommendationSession(session, { routeProxyEnabled: false }, {
    useLegacyStaticFixture: () => true,
    loadLivePorts: async () => { liveLoads++; throw new Error('unexpected_live_load'); },
    readPersonalizationSnapshot: async () => ({ samples: [], isCurrent: () => true } as never),
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    buildRelease: async () => { builds++; return { resultState: 'no_representative_candidates', representativeCourse: null, alternativeCourses: [], alternativeState: 'no_candidates', diagnostics: { newProviderAttemptCount: 0 } } as never; },
  });
  assert.equal(result.resultState, 'no_representative_candidates');
  assert.equal(builds, 1);
  assert.equal(liveLoads, 0);
});

test('public recommendation defaults to live data without a release flag', async () => {
  const f = fixture(['empty']);
  const session = { nowIso: '2026-09-22T03:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.06 }, destination: null, remainingMin: 120, arrivalBufferMin: 10 };
  let staticBuilds = 0;
  const result = await runRecommendationSession(session, { routeProxyEnabled: true }, {
    loadLivePorts: async () => f.ports,
    readPersonalizationSnapshot: async () => ({ samples: [], isCurrent: () => true } as never),
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: async () => ({ async getRoute() { return null; }, ...receiptRoutes }),
    buildRelease: async () => { staticBuilds++; throw new Error('static_fallback'); },
  });
  assert.equal(result.resultState, 'verified');
  assert.equal(staticBuilds, 0);
  assert.ok(f.events.includes('factory'));
});

test('public live path refuses missing route proxy before facade and never invokes static builder', async () => {
  const session = { nowIso: '2026-09-22T03:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.06 }, destination: null, remainingMin: 120, arrivalBufferMin: 10 };
  let liveLoads = 0; let builds = 0;
  await assert.rejects(() => runRecommendationSession(session, { routeProxyEnabled: false }, {
    loadLivePorts: async () => { liveLoads++; return fixture(['empty']).ports; },
    readPersonalizationSnapshot: async () => ({ samples: [], isCurrent: () => true } as never),
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    buildRelease: async () => { builds++; throw new Error('static_fallback'); },
  }), /live_public_data_unavailable/);
  assert.equal(liveLoads, 0);
  assert.equal(builds, 0);
});

test('public live path registers sealed Results runtime and loading-screen abort cannot disable shared continuation', async () => {
  const f = fixture(['empty']);
  const session = { nowIso: '2026-09-22T03:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.15, lon: 129.06 }, destination: null, remainingMin: 120, arrivalBufferMin: 10 };
  const continuation = { version: 1 as const, cursor: 0, candidatePlaceIds: [], candidateSetSignature: 'fixture', attemptedCandidateIds: [], rejectedCandidateIds: [], verifiedCandidateIds: [], routeReceiptKeys: [] };
  Object.assign(f.bridge, {
    input: { ...context, provider: { listRepresentativeCandidates: () => [] }, routes: { async getRoute() { return null; } }, receiptRoutes },
    result: { representativeCourse: null, alternativeCourses: [], resultState: 'no_representative_candidates', alternativeState: 'no_candidates', continuation, diagnostics: { newProviderAttemptCount: 1 } },
    ledgerStore: { read: () => f.bridge.ledger, commit() { f.events.push('ledger_commit'); } },
    run: async (_phase: string, _ledger: unknown, operation: () => Promise<unknown>) => { f.events.push(`run:${_phase}`); return operation(); },
  });
  const loading = new AbortController();
  let staticBuilds = 0;
  const result = await runRecommendationSession(session, { routeProxyEnabled: true, signal: loading.signal }, {
    loadLivePorts: async () => f.ports,
    readPersonalizationSnapshot: async () => ({ samples: [], isCurrent: () => true } as never),
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: async () => ({ async getRoute() { return null; }, ...receiptRoutes }),
    buildRelease: async () => { staticBuilds++; throw new Error('static_fallback'); },
  });
  assert.equal(result.resultState, 'no_representative_candidates');
  assert.equal(staticBuilds, 0);
  assert.equal(getRecommendationSessionAttemptLedger(session)?.initialOneStopAttempts, 1);
  loading.abort();
  const page = await continueReleaseRecommendationSession(session, continuation, {
    continueRelease: async () => ({ appendedCourses: [], continuation, pageState: 'exhausted', outcomeReasons: [], diagnostics: { newProviderAttemptCount: 0 } } as never),
  });
  assert.equal(page?.pageState, 'exhausted');
  assert.ok(f.events.includes('run:shared'));
  assert.ok(f.events.includes('ledger_commit'));
});

test('live Results pair begin/continue use the same sealed bridge and preserve initial receipt cache', async () => {
  const session = { nowIso: '2026-09-22T03:00:00.000Z', origin: { id: 'origin', label: '출발', lat: 35.16, lon: 129.06 }, destination: null, remainingMin: 180, arrivalBufferMin: 10 };
  const candidates: MultiSourceLiveProjection['candidates'] = Array.from({ length: 18 }, (_, index) => ({
    id: `p${index}`, order: index, state: 'active', facts: { title: `Place ${index}`, lat: 35.16 + index * 0.0001, lon: 129.06,
      availability: { status: 'structured', alwaysAccessible: true, dayTypes: ['weekday', 'weekend'], windows: [] } },
    provenance: { opening: ['busan_attraction'] }, photoDisposition: 'default_no_approved_evidence',
    policy: { category: '자연', classification: 'representative_standard', availabilityProfile: 'always_open', activityType: 'outdoor', minStayMin: 20, recommendedStayMin: 30, maxStayMin: 60, evidenceReviewDueAt: '2027-01-01' },
    relations: { mergedPlaceIds: [] },
  }));
  const projection: MultiSourceLiveProjection = { status: 'ready', liveSourceSnapshotId: 'fixture', candidates, records: [],
    summary: { runtimePlaces: 18, representativePlaces: 18, representativePartitions: { tourapiOnly: 0, busanOnly: 18, tourapiAndBusan: 0 }, activeRepresentative: 18, inactive: 0, reviewRequired: 0, sourceUnavailable: 0, providerOutOfScope: 0, traditionalMarketOnly: 0 } };
  const sources = {
    tour: { status: 'unavailable' as const, liveSourceSnapshotId: null, fetchedAt: null, candidates: [], records: [], unreviewedSourceCount: 0,
      summary: { runtimePlaces: 0, tourapiMapped: 0, activeCatalog: 0, inactive: 0, identityConflict: 0, providerOutOfScope: 0, traditionalMarketOnly: 0 } },
    busan: { status: 'ready' as const, liveSourceSnapshotId: 'fixture', providerCalls: 0, sources: {
      busan_attraction: { status: 'unavailable' as const, complete: false as const, providerCalls: 0 as const, reason: { code: 'network' as const, status: null } },
      busan_food: { status: 'unavailable' as const, complete: false as const, providerCalls: 0 as const, reason: { code: 'network' as const, status: null } },
      busan_shopping: { status: 'unavailable' as const, complete: false as const, providerCalls: 0 as const, reason: { code: 'network' as const, status: null } },
    } },
  };
  const events: string[] = [];
  const receiptCalls: string[] = [];
  const activated = { async getRoute() { return null; }, async getRouteReceipt(from: { id: string }, to: { id: string }) {
    receiptCalls.push(`${from.id}>${to.id}`);
    return { result: 'exact' as const, route: { mode: 'walk' as const, min: 5, exact: true as const }, newProviderAttemptCount: 1 as const, reused: false };
  } };
  const ports = {
    async createFacade() { return { status: 'ready', facade: { async initialize() { return { status: 'active' }; }, async loadDetails() { throw new Error('busan_only'); }, close() { events.push('close'); }, cancel() { events.push('cancel'); } } }; },
    buildApprovedInput() { return {}; },
    projectInitial() { return { status: 'accepted', sources }; },
    projectDetails() { throw new Error('busan_only'); },
    projectCatalog() { return projection; },
    createSession(input: Parameters<typeof createMultiSourceLiveSession>[0]) { return createMultiSourceLiveSession({ ...input, sources, projector: () => projection }); },
  } as unknown as LivePublicDataPorts;
  const result = await runRecommendationSession(session, { routeProxyEnabled: true }, {
    loadLivePorts: async () => ports,
    readPersonalizationSnapshot: async () => ({ samples: [], isCurrent: () => true } as never),
    createLegacyRoutes: () => ({ async getRoute() { return null; } }),
    createActivatedProxyRoutes: async () => activated,
  });
  assert.equal(result.resultState, 'verified');
  const first = result.representativeCourse!;
  const initialCalls = receiptCalls.length;
  const port = getTwoStopSelectionPort(session)!;
  const firstPage = await port.begin({ firstCourse: first, requestId: 'live-pair-1', signal: new AbortController().signal, onProgress() {} });
  assert.ok(firstPage.courses.length > 0);
  assert.ok(getRecommendationSessionAttemptLedger(session)!.automaticTwoStopAttempts > 0);
  assert.equal(new Set(receiptCalls).size, receiptCalls.length, 'cached initial routes must not be fetched again');
  assert.ok(receiptCalls.length >= initialCalls);
  assert.ok(firstPage.continuation);
  const more = await port.continue({ firstCourse: first, continuation: firstPage.continuation!, requestId: 'live-pair-2', signal: new AbortController().signal, onProgress() {} });
  assert.ok(more.courses.length > 0);
  assert.ok(getRecommendationSessionAttemptLedger(session)!.totalNewProviderAttempts <= 36);
  assert.deepEqual(events, ['close']);
});
