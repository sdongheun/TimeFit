import assert from 'node:assert/strict';
import test from 'node:test';
import marketSnapshot from '../src/data/traditional_market_browse_snapshot.json';
import mapping from '../data/processed/review/live_source_place_mapping_manifest.json';
import { createMultiSourceLiveInputs } from '../src/data/busanLiveProjection';
import { projectLiveNearbyReadModel } from '../src/data/liveNearbyReadModel';
import { nearbyCatalogFromLiveModel } from '../src/ui/nearbyLiveSession';
import type { BusanLiveResult, BusanLiveSourceKey, BusanLiveSourceResult } from '../src/services/busanLiveAdapter';
import type { LiveMultiSourceFacadeInitial } from '../src/services/liveMultiSourceSessionFacade';

const snapshotId = 'nearby-fixture-001';
const keys: readonly BusanLiveSourceKey[] = ['busan_attraction', 'busan_food', 'busan_shopping'];
const locals = createMultiSourceLiveInputs();
const down = (): BusanLiveSourceResult => ({ status: 'unavailable', complete: false, providerCalls: 0, reason: { code: 'network', status: null } });
const counts = { tourCatalogCalls: 1 as const, busanSnapshotCalls: 1 as const, busanProviderCalls: 3, tourDetailBatches: 0, tourDetailRequested: 0 };

test('market browse snapshot contains only the 118 reviewed exact static source IDs', () => {
  const approved = mapping.data.filter((row) => row.traditionalMarketSourceIds.length);
  assert.equal(approved.length, 118);
  assert.deepEqual(marketSnapshot.data.map((row) => [row.placeId, row.sourceId]).sort(),
    approved.map((row) => [row.contentId, row.traditionalMarketSourceIds[0]]).sort());
  assert.ok(approved.every((row) => row.classification === 'conditional_more' && !row.tourapiContentId
    && Object.values(row.busanSourceIds).every((ids) => ids.length === 0)));
  assert.equal(marketSnapshot.meta.operatingHoursStatus, 'unverified');
});

function busan(active = true): BusanLiveResult {
  return {
    status: 'ready', liveSourceSnapshotId: snapshotId, providerCalls: 3,
    sources: Object.fromEntries(keys.map((source) => {
      const links = locals.flatMap((local) => local.busanMappings.filter((mapping) => mapping.source === source).map((mapping) => ({ local, sourceId: mapping.sourceId })));
      return [source, {
        status: 'ready', complete: true, providerCalls: 1,
        activeApprovedSourceIds: active ? links.map((link) => link.sourceId) : [],
        inactiveApprovedSourceIds: active ? [] : links.map((link) => link.sourceId),
        records: active ? links.map((link) => ({ source, sourceId: link.sourceId, title: link.local.place.identity.title,
          lat: link.local.place.identity.lat, lon: link.local.place.identity.lon,
          description: `live-${link.local.place.id}`, openingText: '09:00~18:00',
          photo: { status: 'not_returned_without_approved_evidence' } as const })) : [],
      } satisfies BusanLiveSourceResult];
    })) as unknown as Record<BusanLiveSourceKey, BusanLiveSourceResult>,
  };
}

function initial(tourStatus: 'ready' | 'partial' | 'unavailable' = 'ready', busanResult = busan()): LiveMultiSourceFacadeInitial {
  const linked = locals.filter((local) => local.tourapiSourceId && local.place.mapping);
  const snapshot = { liveSourceSnapshotId: snapshotId, fetchedAt: '2026-09-22T00:00:00Z',
    catalogPlaces: linked.map((local) => ({ contentId: local.tourapiSourceId!, contentTypeId: local.place.mapping!.contentTypeId,
      title: local.place.identity.title, lat: local.place.identity.lat, lon: local.place.identity.lon })),
    candidateStates: linked.map((local) => ({ contentId: local.tourapiSourceId!, contentTypeId: local.place.mapping!.contentTypeId, state: 'active_catalog' as const })),
    unreviewedCount: 0 };
  const tourCatalog: LiveMultiSourceFacadeInitial['tourCatalog'] = tourStatus === 'unavailable'
    ? { status: 'unavailable', reason: { operation: 'areaBasedList2', code: 'network', status: null } }
    : tourStatus === 'partial'
      ? { kind: 'catalog', status: 'partial', snapshot, failures: [{ operation: 'areaBasedList2', code: 'page_limit', status: null }] }
      : { kind: 'catalog', status: 'ready', snapshot };
  return {
    status: 'active', snapshotContext: { liveSourceSnapshotId: snapshotId, source: tourStatus === 'unavailable' ? 'facade_fallback' : 'tour_catalog' },
    tourCatalog,
    busan: busanResult, counts,
  };
}

test('complete exact snapshot yields 251 live and 118 static market browse candidates without opening claims', () => {
  const result = projectLiveNearbyReadModel(initial());
  assert.equal(result.status, 'ready');
  assert.equal(result.summary.runtimePlaces, 369);
  assert.equal(result.summary.liveMappedPlaces, 251);
  assert.equal(result.summary.active, 369);
  assert.equal(result.summary.staticMarketBrowse, 118);
  assert.equal(result.summary.providerOutOfScope, 0);
  assert.equal(result.candidates.length, 369);
  assert.equal(result.candidates.filter((row) => row.classification === 'conditional_more').length, 178);
  const markets = result.candidates.filter((row) => row.sourceKind === 'traditional_market_standard_static');
  assert.equal(markets.length, 118);
  assert.ok(markets.every((row) => row.operatingHoursStatus === 'unverified'
    && row.informationOnly && row.provenance.title[0] === 'traditional_market_standard' && !row.photo));
  assert.ok(result.records.filter((row) => row.partition === 'traditional_market_only')
    .every((row) => row.state === 'active' && row.providers.length === 1
      && row.providers[0].provider === 'traditional_market_standard' && row.providers[0].state === 'static_snapshot'));
  assert.ok(result.candidates.every((row) => !('availability' in row) && !('operatingHours' in row)));
  assert.doesNotMatch(JSON.stringify(result), /09:00~18:00|budgetToken|rawText|openingText/);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.candidates[0]));
  assert.deepEqual(projectLiveNearbyReadModel(initial()), result);
});

test('Tour unavailable preserves Busan-only and overlap via live Busan; no stale Tour fallback', () => {
  const result = projectLiveNearbyReadModel(initial('unavailable'));
  assert.equal(result.status, 'partial');
  assert.equal(result.summary.active, 250);
  assert.equal(result.summary.staticMarketBrowse, 118);
  assert.equal(result.summary.sourceUnavailable, 119);
  assert.equal(result.records.find((row) => row.partition === 'tourapi_only')?.state, 'source_unavailable');
});

test('Busan unavailable preserves Tour-only and overlap from live Tour', () => {
  const result = projectLiveNearbyReadModel(initial('ready', { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } }));
  assert.equal(result.status, 'partial');
  assert.equal(result.summary.active, 257);
  assert.equal(result.summary.sourceUnavailable, 112);
});

test('both live providers unavailable never turn static markets into live facts', () => {
  const result = projectLiveNearbyReadModel(initial('unavailable', { status: 'unavailable', providerCalls: 0, reason: { code: 'network', status: null } }));
  assert.equal(result.status, 'partial');
  assert.equal(result.summary.active, 118);
  assert.equal(result.summary.sourceUnavailable, 251);
  assert.equal(result.summary.staticMarketBrowse, 118);
  assert.ok(result.candidates.every((candidate) => candidate.sourceKind === 'traditional_market_standard_static'
    && candidate.operatingHoursStatus === 'unverified'));
  const uiCatalog = nearbyCatalogFromLiveModel(result);
  assert.equal(uiCatalog.length, 118);
  assert.ok(uiCatalog.every((place) => !place.operatingHours && !place.imageUrl));
});

test('complete inactive is distinct from failure; partial/catalog mismatch fail closed', () => {
  const inactive = projectLiveNearbyReadModel(initial('ready', busan(false)));
  assert.equal(inactive.summary.active, 257);
  assert.equal(inactive.summary.inactive, 112);
  assert.equal(projectLiveNearbyReadModel(initial('partial')).status, 'partial');
  const stale = initial('ready', { ...busan(), liveSourceSnapshotId: 'stale' });
  const mismatch = projectLiveNearbyReadModel(stale);
  assert.equal(mismatch.status, 'unavailable');
  assert.equal(mismatch.candidates.length, 0);
  assert.equal(mismatch.reason, 'snapshot_mismatch');
});

test('identity conflict excludes mapped place without changing another provider’s state', () => {
  const seed = initial();
  if (seed.tourCatalog.status === 'unavailable' || !('sources' in seed.busan)) return;
  const chosen = locals.find((local) => local.partition === 'tourapi_and_busan')!;
  const row = seed.tourCatalog.snapshot.candidateStates.find((state) => state.contentId === chosen.tourapiSourceId)!;
  const conflicted: LiveMultiSourceFacadeInitial = { ...seed, tourCatalog: { ...seed.tourCatalog,
    snapshot: { ...seed.tourCatalog.snapshot, candidateStates: seed.tourCatalog.snapshot.candidateStates.map((state) => state === row ? { ...state, state: 'identity_conflict' as const } : state) } } };
  const result = projectLiveNearbyReadModel(conflicted);
  assert.equal(result.records.find((record) => record.placeId === chosen.place.id)?.state, 'review_required');
  assert.equal(result.candidates.some((candidate) => candidate.id === chosen.place.id), false);
  assert.equal(result.summary.active, 368);
});

test('exact adapter-approved photo is optional; no photo never removes a browse place', () => {
  const local = locals.find((item) => item.partition === 'busan_only' && item.busanMappings.length === 1 && item.busanMappings[0].source === 'busan_attraction')!;
  const sourceKey = local.busanMappings[0].source;
  const sourceId = local.busanMappings[0].sourceId;
  const current = busan();
  if (!('sources' in current)) return;
  const source = current.sources[sourceKey];
  if (source.status !== 'ready') return;
  const photo = { status: 'approved' as const, url: 'https://example.test/exact.jpg', attribution: '부산광역시',
    sourcePageUrl: 'https://www.data.go.kr/data/15063481/openapi.do', licenseName: '이용허락범위 제한 없음' as const,
    commercialUseAllowed: true as const, modificationAllowed: true as const, verifiedAt: '2026-09-07' };
  const withPhoto: BusanLiveResult = { ...current, sources: { ...current.sources, [sourceKey]: { ...source,
    records: source.records.map((record) => record.sourceId === sourceId ? { ...record, photo } : record) } } };
  const before = projectLiveNearbyReadModel(initial('ready', current));
  const after = projectLiveNearbyReadModel(initial('ready', withPhoto));
  assert.equal(before.summary.active, after.summary.active);
  assert.equal(before.candidates.find((row) => row.id === local.place.id)?.photoDisposition, 'default_no_approved_evidence');
  assert.equal(after.candidates.find((row) => row.id === local.place.id)?.photo?.url, photo.url);
});
