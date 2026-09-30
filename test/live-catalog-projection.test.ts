import assert from 'node:assert/strict';
import test from 'node:test';
import type { TourLiveCatalogCandidateState, TourLiveCatalogPlace, TourLiveCatalogResult } from '../src/services/tourApiLiveAdapter';
import {
  createRuntimeLiveCatalogInputs,
  liveCatalogSourceDistanceMeters,
  projectTourLiveCatalog,
  type LocalLiveCatalogPlace,
} from '../src/data/liveCatalogProjection';

const local = (patch: Partial<LocalLiveCatalogPlace> = {}): LocalLiveCatalogPlace => ({
  id: 'poi_fixture',
  order: 1,
  providerScope: 'tourapi',
  mapping: { contentId: '100', contentTypeId: '12' },
  identity: { title: '기존 공원', aliases: ['검토 별칭'], lat: 35.1, lon: 129.1 },
  policy: {
    category: '자연',
    subCategory: '공원',
    classification: 'representative_standard',
    availabilityProfile: 'outdoor',
    activityType: 'scenic_pause',
    minStayMin: 20,
    recommendedStayMin: 30,
    maxStayMin: 60,
    discoveryEligibility: 'representative',
    evidenceReviewDueAt: '2027-09-21',
  },
  relations: { siteGroupId: 'fixture_site', siteRole: 'parent', mergedPlaceIds: ['fixture_old'] },
  ...patch,
});

const livePlace = (patch: Partial<TourLiveCatalogPlace> = {}): TourLiveCatalogPlace => ({
  contentId: '100',
  contentTypeId: '12',
  title: '기존 공원',
  address: '부산광역시 테스트구',
  lat: 35.1,
  lon: 129.1,
  modifiedAt: '20260921010101',
  ...patch,
});

function catalogResult(
  places: readonly TourLiveCatalogPlace[],
  states: readonly TourLiveCatalogCandidateState[] = places.map((place) => ({ contentId: place.contentId, contentTypeId: place.contentTypeId, state: 'active_catalog' as const })),
  unreviewedCount = 0,
): TourLiveCatalogResult {
  return {
    kind: 'catalog',
    status: states.some((state) => state.state === 'identity_conflict') ? 'partial' : 'ready',
    snapshot: {
      liveSourceSnapshotId: 'fixture-live-catalog-1',
      fetchedAt: '2026-09-21T01:00:00Z',
      catalogPlaces: places,
      candidateStates: states,
      unreviewedCount,
    },
    budgetToken: 'fixture-budget-token',
    ...(states.some((state) => state.state === 'identity_conflict')
      ? { failures: [{ operation: 'areaBasedList2' as const, code: 'identity_conflict' as const, status: null }] }
      : {}),
  } as TourLiveCatalogResult;
}

test('DATA-LIVE-CATALOG-PROJECTION-03: runtime 369, representative 191, TourAPI representative 98 and traditional-only 118 remain exact', () => {
  const inputs = createRuntimeLiveCatalogInputs();
  const mapped = inputs.filter((place) => place.providerScope === 'tourapi' && place.mapping);
  const representative = inputs.filter((place) => place.policy.classification === 'representative_core' || place.policy.classification === 'representative_standard');
  assert.equal(inputs.length, 369);
  assert.equal(representative.length, 191);
  assert.equal(mapped.length, 139);
  assert.equal(mapped.filter((place) => place.policy.classification === 'representative_core' || place.policy.classification === 'representative_standard').length, 98);
  const traditionalMarketOnly = inputs.filter((place) => place.providerScope === 'traditional_market_only');
  assert.equal(traditionalMarketOnly.length, 118);
  assert.ok(traditionalMarketOnly.every((place) => place.policy.classification === 'conditional_more'));

  const places = mapped.map((place) => ({
    contentId: place.mapping!.contentId,
    contentTypeId: place.mapping!.contentTypeId,
    title: place.identity.title,
    lat: place.identity.lat,
    lon: place.identity.lon,
  }));
  const projection = projectTourLiveCatalog(inputs, catalogResult(places));
  assert.equal(projection.status, 'ready');
  assert.deepEqual(projection.summary, {
    runtimePlaces: 369,
    tourapiMapped: 139,
    activeCatalog: 139,
    inactive: 0,
    identityConflict: 0,
    providerOutOfScope: 230,
    traditionalMarketOnly: 118,
  });
  assert.equal(projection.candidates.filter((place) => place.policy.classification === 'representative_core' || place.policy.classification === 'representative_standard').length, 98);
});

test('exact ID/type accepts ordinary title-only or coordinate-only updates but reviews the approved compound anomaly', () => {
  const base = local();
  assert.equal(projectTourLiveCatalog([base], catalogResult([livePlace({ title: '새 공원명' })])).candidates.length, 1);
  assert.equal(projectTourLiveCatalog([base], catalogResult([livePlace({ lat: 35.12 })])).candidates.length, 1);
  assert.equal(projectTourLiveCatalog([base], catalogResult([livePlace({ title: '검토 별칭', lat: 35.12 })])).candidates.length, 1);

  const conflict = projectTourLiveCatalog([base], catalogResult([livePlace({ title: '미등록 시설명', lat: 35.12 })]));
  assert.equal(conflict.candidates.length, 0);
  assert.equal(conflict.records[0].state, 'identity_conflict');
  assert.equal(conflict.records[0].reason, 'compound_identity_change');
  assert.equal(conflict.status, 'partial');

  const equator = local({ identity: { title: '기존 공원', aliases: [], lat: 0, lon: 0 } });
  for (const meters of [999, 1000, 1001]) {
    const longitude = meters / 6371000 * 180 / Math.PI;
    const distance = liveCatalogSourceDistanceMeters(equator.identity, { lat: 0, lon: longitude });
    assert.ok(Math.abs(distance - meters) < 1e-8);
    const result = projectTourLiveCatalog([equator], catalogResult([livePlace({ title: '미등록 시설명', lat: 0, lon: longitude })]));
    assert.equal(result.candidates.length, meters >= 1000 ? 0 : 1);
  }
});

test('content type change, provider conflict, inactive and missing state remain distinct and never become candidates', () => {
  const base = local();
  const changedType = projectTourLiveCatalog([base], catalogResult(
    [livePlace({ contentTypeId: '14' })],
    [{ contentId: '100', contentTypeId: '14', state: 'active_catalog' }],
  ));
  assert.equal(changedType.candidates.length, 0);
  assert.deepEqual(changedType.records[0], {
    placeId: 'poi_fixture', providerScope: 'tourapi', sourceContentId: '100', sourceContentTypeId: '12', state: 'identity_conflict', reason: 'content_type_changed',
  });

  const conflict = projectTourLiveCatalog([base], catalogResult([], [{ contentId: '100', contentTypeId: '12', state: 'identity_conflict' }]));
  assert.equal(conflict.records[0].reason, 'provider_identity_conflict');
  const inactive = projectTourLiveCatalog([base], catalogResult([], [{ contentId: '100', contentTypeId: '12', state: 'inactive' }]));
  assert.equal(inactive.status, 'ready');
  assert.equal(inactive.records[0].state, 'inactive');
  assert.equal(inactive.candidates.length, 0);
  const missing = projectTourLiveCatalog([base], catalogResult([], []));
  assert.equal(missing.records[0].reason, 'missing_source_state');
});

test('new source IDs and provider-out-of-scope places never auto-match or auto-promote', () => {
  const busanOnly = local({ id: 'poi_busan', order: 2, providerScope: 'other_provider', mapping: undefined });
  const marketOnly = local({ id: 'poi_market', order: 3, providerScope: 'traditional_market_only', mapping: undefined, policy: { ...local().policy, classification: 'conditional_more' } });
  const result = projectTourLiveCatalog(
    [marketOnly, busanOnly, local()],
    catalogResult(
      [livePlace(), livePlace({ contentId: '999', title: '신규 API 장소' })],
      [
        { contentId: '100', contentTypeId: '12', state: 'active_catalog' },
        { contentId: '999', contentTypeId: '12', state: 'active_catalog' },
      ],
      1,
    ),
  );
  assert.deepEqual(result.candidates.map((place) => place.id), ['poi_fixture']);
  assert.equal(result.unreviewedSourceCount, 1);
  assert.equal(result.records.find((record) => record.placeId === 'poi_market')?.reason, 'traditional_market_provider_out_of_scope');
  assert.equal(result.records.find((record) => record.placeId === 'poi_busan')?.reason, 'not_tourapi_mapped');
  assert.doesNotMatch(JSON.stringify(result), /신규 API 장소/);
});

test('missing optional live fields stay absent; missing or invalid required facts fail closed without bundle fallback', () => {
  const base = local();
  const noOptional = projectTourLiveCatalog([base], catalogResult([{
    contentId: '100', contentTypeId: '12', title: '기존 공원', lat: 35.1, lon: 129.1,
  }]));
  assert.deepEqual(noOptional.candidates[0].facts, { title: '기존 공원', lat: 35.1, lon: 129.1 });
  assert.equal(Object.hasOwn(noOptional.candidates[0].facts, 'address'), false);
  assert.equal(Object.hasOwn(noOptional.candidates[0].facts, 'modifiedAt'), false);

  for (const place of [
    { contentId: '100', contentTypeId: '12', lat: 35.1, lon: 129.1 },
    { contentId: '100', contentTypeId: '12', title: '기존 공원', lon: 129.1 },
    { contentId: '100', contentTypeId: '12', title: '기존 공원', lat: 91, lon: 129.1 },
  ]) {
    const result = projectTourLiveCatalog([base], catalogResult([place as TourLiveCatalogPlace]));
    assert.equal(result.candidates.length, 0);
    assert.equal(result.records[0].state, 'identity_conflict');
  }
  assert.doesNotMatch(JSON.stringify(noOptional), /기존 주소|local_snapshot/);
});

test('API order and local input order do not change output; result is detached, deeply frozen and contains no AI-Hub identity', () => {
  const first = local();
  const second = local({ id: 'poi_second', order: 2, mapping: { contentId: '200', contentTypeId: '14' }, identity: { title: '두번째 문화관', aliases: [], lat: 35.2, lon: 129.2 } });
  const places = [livePlace(), livePlace({ contentId: '200', contentTypeId: '14', title: '두번째 문화관', lat: 35.2, lon: 129.2 })];
  const states = [
    { contentId: '100', contentTypeId: '12', state: 'active_catalog' as const },
    { contentId: '200', contentTypeId: '14', state: 'active_catalog' as const },
  ];
  const normal = projectTourLiveCatalog([first, second], catalogResult(places, states));
  const reversed = projectTourLiveCatalog([second, first], catalogResult([...places].reverse(), [...states].reverse()));
  assert.deepEqual(normal, reversed);
  assert.ok(Object.isFrozen(normal));
  assert.ok(Object.isFrozen(normal.candidates[0].policy));
  assert.ok(Object.isFrozen(normal.candidates[0].relations.mergedPlaceIds));
  assert.doesNotMatch(JSON.stringify(normal), /aihub|aiHub/i);
});

test('unavailable never returns stale source facts or recommendations', () => {
  const result = projectTourLiveCatalog([local()], {
    status: 'unavailable',
    reason: { operation: 'areaBasedList2', code: 'network', status: null },
  });
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.records[0].state, 'source_unavailable');
  assert.equal(result.liveSourceSnapshotId, null);
});
